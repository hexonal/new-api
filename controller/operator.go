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
	Remark             string   `json:"remark"`
}

func isDuplicateError(err error) bool {
	msg := err.Error()
	return strings.Contains(msg, "duplicate") || strings.Contains(msg, "UNIQUE") || strings.Contains(msg, "uni_")
}

func buildProvisionToken(userId int, tokenKey string, req operatorProvisionRequest) model.Token {
	return model.Token{
		UserId:             userId,
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
		common.ApiError(c, err)
		return
	}

	// Check user existence first to decide whether to create the user or reuse it.
	var existingUser model.User
	userExists := model.DB.Where("username = ?", req.Username).First(&existingUser).Error == nil

	var userId int

	if !userExists {
		// Normal path: new user — create user + token in one transaction.
		err := model.DB.Transaction(func(tx *gorm.DB) error {
			cleanUser := model.User{
				Username:    req.Username,
				DisplayName: req.DisplayName,
				Password:    req.Password,
				Group:       req.Group,
				Status:      common.UserStatusEnabled,
				Role:        common.RoleCommonUser,
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

			t := buildProvisionToken(cleanUser.Id, tokenKey, req)
			return t.InsertWithTx(tx)
		})
		if err != nil {
			common.ApiError(c, err)
			return
		}
	} else {
		// User already exists — add a new token to the existing user.
		userId = existingUser.Id
		t := buildProvisionToken(existingUser.Id, tokenKey, req)
		if err := t.Insert(); err != nil {
			common.ApiError(c, err)
			return
		}
	}

	if req.Remark != "" {
		model.RecordLog(userId, model.LogTypeSystem, fmt.Sprintf("Operator API provisioned user: %s", req.Remark))
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

// --- Tokens ---

type operatorTokensRequest struct {
	Username string `json:"username"`
}

type operatorTokenItem struct {
	SK                 string   `json:"sk"`
	Name               string   `json:"name"`
	Status             int      `json:"status"`
	CreatedTime        int64    `json:"created_time"`
	ExpiredTime        int64    `json:"expired_time"`
	ModelLimitsEnabled bool     `json:"model_limits_enabled"`
	ModelLimits        []string `json:"model_limits"`
}

func OperatorTokens(c *gin.Context) {
	var req operatorTokensRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" {
		common.ApiErrorMsg(c, "username is required")
		return
	}

	var user model.User
	if err := model.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		common.ApiErrorMsg(c, "user not found")
		return
	}

	var tokens []model.Token
	if err := model.DB.Where("user_id = ?", user.Id).Order("id desc").Find(&tokens).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	items := make([]operatorTokenItem, 0, len(tokens))
	for _, t := range tokens {
		var modelLimits []string
		if t.ModelLimits != "" {
			modelLimits = strings.Split(t.ModelLimits, ",")
		}
		items = append(items, operatorTokenItem{
			SK:                 "sk-" + t.Key,
			Name:               t.Name,
			Status:             t.Status,
			CreatedTime:        t.CreatedTime,
			ExpiredTime:        t.ExpiredTime,
			ModelLimitsEnabled: t.ModelLimitsEnabled,
			ModelLimits:        modelLimits,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"user_id": user.Id,
			"tokens":  items,
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

	_, token, err := resolveTargetUser(req.SK)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	token.Status = common.TokenStatusDisabled
	if err := token.Update(); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

// --- DisableUser ---

type operatorDisableUserRequest struct {
	Username string `json:"username"`
}

func OperatorDisableUser(c *gin.Context) {
	var req operatorDisableUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" {
		common.ApiErrorMsg(c, "username is required")
		return
	}

	var user model.User
	if err := model.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		common.ApiErrorMsg(c, "user not found")
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
