package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// resolveTargetUser looks up a User and Token by the sk- prefixed key.
func resolveTargetUser(sk string) (*model.User, *model.Token, error) {
	rawKey := strings.TrimPrefix(sk, "sk-")
	if rawKey == "" {
		return nil, nil, errors.New("sk is empty")
	}
	token, err := model.GetTokenByKey(rawKey, false)
	if err != nil {
		return nil, nil, fmt.Errorf("invalid sk: %w", err)
	}
	user, err := model.GetUserById(token.UserId, false)
	if err != nil {
		return nil, nil, fmt.Errorf("user not found: %w", err)
	}
	return user, token, nil
}

// --- Provision ---

type operatorProvisionRequest struct {
	Username           string   `json:"username"`
	DisplayName        string   `json:"display_name"`
	Password           string   `json:"password"`
	Group              string   `json:"group"`
	Quota              int      `json:"quota"`
	TokenName          string   `json:"token_name"`
	ModelLimitsEnabled bool     `json:"model_limits_enabled"`
	ModelLimits        []string `json:"model_limits"`
}

func OperatorProvision(c *gin.Context) {
	var req operatorProvisionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" {
		common.ApiErrorMsg(c, "username is required")
		return
	}
	if req.Group == "" {
		req.Group = "default"
	}
	if req.TokenName == "" {
		req.TokenName = "default"
	}
	if req.DisplayName == "" {
		req.DisplayName = req.Username
	}

	tokenKey, err := common.GenerateKey()
	if err != nil {
		common.ApiErrorMsg(c, "failed to generate token key")
		return
	}

	var userId int
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		cleanUser := model.User{
			Username:    req.Username,
			DisplayName: req.DisplayName,
			Password:    req.Password,
			Group:       req.Group,
			Status:      common.UserStatusEnabled,
			Role:        common.RoleCommonUser,
		}
		if req.Quota > 0 {
			cleanUser.Quota = req.Quota
		}
		if err := cleanUser.InsertWithTx(tx, 0); err != nil {
			return err
		}
		userId = cleanUser.Id

		// InsertWithTx always overwrites Quota with common.QuotaForNewUser;
		// explicitly set the requested quota if provided.
		if req.Quota > 0 {
			if err := tx.Model(&model.User{}).Where("id = ?", cleanUser.Id).
				Update("quota", req.Quota).Error; err != nil {
				return err
			}
		}

		cleanToken := model.Token{
			UserId:             cleanUser.Id,
			Name:               req.TokenName,
			Key:                tokenKey,
			Status:             common.TokenStatusEnabled,
			CreatedTime:        common.GetTimestamp(),
			AccessedTime:       common.GetTimestamp(),
			ExpiredTime:        -1,
			UnlimitedQuota:     true,
			ModelLimitsEnabled: req.ModelLimitsEnabled,
			ModelLimits:        strings.Join(req.ModelLimits, ","),
		}
		return cleanToken.InsertWithTx(tx)
	})
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "UNIQUE") || strings.Contains(err.Error(), "uni_") {
			c.JSON(http.StatusConflict, gin.H{
				"success": false,
				"message": "username already exists",
			})
			return
		}
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"user_id": userId,
			"sk":      "sk-" + tokenKey,
		},
	})
}

// --- Quota ---

type operatorQuotaRequest struct {
	SK     string `json:"sk"`
	Quota  int    `json:"quota"`
	Remark string `json:"remark"`
}

func OperatorQuota(c *gin.Context) {
	var req operatorQuotaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Quota <= 0 {
		common.ApiErrorMsg(c, "quota must be greater than 0")
		return
	}

	user, _, err := resolveTargetUser(req.SK)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	previousQuota := user.Quota
	if err := model.IncreaseUserQuota(user.Id, req.Quota, true); err != nil {
		common.ApiError(c, err)
		return
	}

	if req.Remark != "" {
		model.RecordLog(user.Id, model.LogTypeManage, fmt.Sprintf("Operator API charged %d quota: %s", req.Quota, req.Remark))
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"previous_quota": previousQuota,
			"current_quota":  previousQuota + req.Quota,
		},
	})
}

// --- Group ---

type operatorGroupRequest struct {
	SK    string `json:"sk"`
	Group string `json:"group"`
}

func OperatorGroup(c *gin.Context) {
	var req operatorGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Group == "" {
		common.ApiErrorMsg(c, "group is required")
		return
	}

	user, _, err := resolveTargetUser(req.SK)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	previousGroup := user.Group
	user.Group = req.Group
	if err := user.Update(false); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"previous_group": previousGroup,
			"current_group":  req.Group,
		},
	})
}

// --- Models ---

type operatorModelsRequest struct {
	SK                 string   `json:"sk"`
	ModelLimitsEnabled bool     `json:"model_limits_enabled"`
	ModelLimits        []string `json:"model_limits"`
}

func OperatorModels(c *gin.Context) {
	var req operatorModelsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	_, token, err := resolveTargetUser(req.SK)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	token.ModelLimitsEnabled = req.ModelLimitsEnabled
	token.ModelLimits = strings.Join(req.ModelLimits, ",")
	if err := token.Update(); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"model_limits_enabled": req.ModelLimitsEnabled,
			"model_limits":         req.ModelLimits,
		},
	})
}

// --- Disable ---

type operatorDisableRequest struct {
	SK string `json:"sk"`
}

func OperatorDisable(c *gin.Context) {
	var req operatorDisableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	user, _, err := resolveTargetUser(req.SK)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if user.Role >= common.RoleAdminUser {
		common.ApiErrorMsg(c, "cannot disable admin or root user")
		return
	}

	user.Status = common.UserStatusDisabled
	if err := user.Update(false); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}
