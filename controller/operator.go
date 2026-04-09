package controller

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// resolveTargetUser looks up a User and Token by the sk- prefixed key.
func resolveTargetUser(sk string) (*model.User, *model.Token, error) {
	rawKey := normalizeOperatorSKToRawKey(sk)
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
	TokenGroup         string   `json:"token_group"`
	AmountUSD          float64  `json:"amount_usd"` // 充值金额（美元），1.0 = $1 = 500000 quota
	Token              string   `json:"token"`
	TokenName          string   `json:"token_name"`
	ModelLimitsEnabled bool     `json:"model_limits_enabled"`
	ModelLimits        []string `json:"model_limits"`
	Remark             string   `json:"remark"`
}

var operatorProvisionTokenPattern = regexp.MustCompile(`^[0-9a-zA-Z_]{1,48}$`)
var operatorProvisionIMASuffixPattern = regexp.MustCompile(`^(ima_[0-9]+)_[0-9A-Za-z]+$`)

func validateOperatorProvisionToken(token string) bool {
	return operatorProvisionTokenPattern.MatchString(strings.TrimSpace(token))
}

func getOperatorProvisionUsernameCandidates(username string) []string {
	normalized := strings.TrimSpace(username)
	if normalized == "" {
		return nil
	}
	candidates := []string{normalized}
	match := operatorProvisionIMASuffixPattern.FindStringSubmatch(normalized)
	if len(match) != 2 {
		return candidates
	}
	baseUsername := strings.TrimSpace(match[1])
	if baseUsername != "" && baseUsername != normalized {
		candidates = append(candidates, baseUsername)
	}
	return candidates
}

func normalizeOperatorProvisionCreateUsername(username string) string {
	normalized := strings.TrimSpace(username)
	if normalized == "" {
		return ""
	}
	match := operatorProvisionIMASuffixPattern.FindStringSubmatch(normalized)
	if len(match) != 2 {
		return normalized
	}
	baseUsername := strings.TrimSpace(match[1])
	if baseUsername == "" {
		return normalized
	}
	return baseUsername
}

func findOperatorProvisionUserByCandidates(tx *gorm.DB, candidates []string) (model.User, bool, error) {
	for _, candidate := range candidates {
		if strings.TrimSpace(candidate) == "" {
			continue
		}
		var existing model.User
		err := tx.Where("username = ?", candidate).First(&existing).Error
		if err == nil {
			return existing, true, nil
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			continue
		}
		return model.User{}, false, err
	}
	return model.User{}, false, nil
}

func normalizeOperatorSKToRawKey(sk string) string {
	key := strings.TrimSpace(sk)
	return strings.TrimPrefix(key, "sk-")
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
		Group:              req.TokenGroup,
		Status:             common.TokenStatusEnabled,
		CreatedTime:        common.GetTimestamp(),
		AccessedTime:       common.GetTimestamp(),
		ExpiredTime:        -1,
		UnlimitedQuota:     true,
		ModelLimitsEnabled: req.ModelLimitsEnabled,
		ModelLimits:        strings.Join(req.ModelLimits, ","),
	}
}

// OperatorCreateToken creates a token under the authenticated operator user.
func OperatorCreateToken(c *gin.Context) {
	var req struct {
		Name           string `json:"name"`
		UnlimitedQuota bool   `json:"unlimited_quota"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" || len(name) > 100 {
		common.ApiErrorMsg(c, "name is required and must be <= 100 chars")
		return
	}
	currentTimestamp := common.GetTimestamp()
	token := model.Token{
		UserId:         c.GetInt("id"),
		Name:           name,
		Key:            name,
		CreatedTime:    currentTimestamp,
		AccessedTime:   currentTimestamp,
		ExpiredTime:    -1,
		UnlimitedQuota: req.UnlimitedQuota,
	}
	if err := token.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
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
	if len(req.Username) > model.UserNameMaxLength {
		common.ApiErrorMsg(c, fmt.Sprintf("username must be %d characters or less", model.UserNameMaxLength))
		return
	}

	if req.Group == "" {
		req.Group = "default"
	}
	req.TokenGroup = strings.TrimSpace(req.TokenGroup)
	if req.TokenGroup == "" {
		// Backward compatible behavior: when tokenGroup is omitted,
		// reuse group as token-level routing group.
		req.TokenGroup = req.Group
	}
	if req.TokenName == "" {
		req.TokenName = "default"
	}
	createUsername := normalizeOperatorProvisionCreateUsername(req.Username)
	if req.DisplayName == "" {
		req.DisplayName = createUsername
	}
	if len(req.DisplayName) > model.UserNameMaxLength {
		req.DisplayName = req.DisplayName[:model.UserNameMaxLength]
	}

	tokenKey := ""
	responseSK := ""
	if strings.TrimSpace(req.Token) != "" {
		req.Token = strings.TrimSpace(req.Token)
		if !validateOperatorProvisionToken(req.Token) {
			common.ApiErrorMsg(c, "token must contain only letters, numbers, or underscore, and be 1-48 characters")
			return
		}
		tokenKey = req.Token
		if req.TokenName == "default" {
			req.TokenName = req.Token
		}
		responseSK = req.Token
	} else {
		var err error
		tokenKey, err = common.GenerateKey()
		if err != nil {
			common.ApiError(c, err)
			return
		}
		responseSK = "sk-" + tokenKey
	}

	var userId int
	usernameCandidates := getOperatorProvisionUsernameCandidates(req.Username)

	err := model.DB.Transaction(func(tx *gorm.DB) error {
		if existingUser, found, findErr := findOperatorProvisionUserByCandidates(tx, usernameCandidates); findErr != nil {
			return findErr
		} else if found {
			userId = existingUser.Id
		}

		if userId > 0 {
			if req.AmountUSD > 0 {
				quota := int(math.Round(req.AmountUSD * float64(common.QuotaPerUnit)))
				if err := tx.Model(&model.User{}).Where("id = ?", userId).
					Update("quota", gorm.Expr("quota + ?", quota)).Error; err != nil {
					return err
				}
			}
			t := buildProvisionToken(userId, tokenKey, req)
			if err := t.InsertWithTx(tx); err != nil {
				// Existing username + duplicate token should be idempotent success,
				// and quota top-up has already been applied above.
				if req.Token != "" && isDuplicateError(err) {
					var existingToken model.Token
					if tokenErr := tx.Where("key = ?", tokenKey).First(&existingToken).Error; tokenErr == nil && existingToken.UserId == userId {
						return nil
					}
				}
				return err
			}
			return nil
		}

		// Try to create user inside the transaction to avoid race conditions.
		cleanUser := model.User{
			Username:    createUsername,
			DisplayName: req.DisplayName,
			Password:    req.Password,
			Group:       req.Group,
			Status:      common.UserStatusEnabled,
			Role:        common.RoleCommonUser,
		}
		if insertErr := cleanUser.InsertWithTx(tx, 0); insertErr != nil {
			if isDuplicateError(insertErr) {
				// User already exists — look up within the same transaction.
				existingUser, found, findErr := findOperatorProvisionUserByCandidates(tx, usernameCandidates)
				if findErr != nil {
					return findErr
				}
				if !found {
					return insertErr
				}
				userId = existingUser.Id
			} else {
				return insertErr
			}
		} else {
			userId = cleanUser.Id
			// InsertWithTx initializes quota with QuotaForNewUser;
			// amount_usd here represents total target quota for new users.
			if req.AmountUSD > 0 {
				quota := int(math.Round(req.AmountUSD * float64(common.QuotaPerUnit)))
				if err := tx.Model(&model.User{}).Where("id = ?", cleanUser.Id).
					Update("quota", quota).Error; err != nil {
					return err
				}
			}
		}

		t := buildProvisionToken(userId, tokenKey, req)
		return t.InsertWithTx(tx)
	})
	if err != nil {
		if req.Token != "" && isDuplicateError(err) {
			common.ApiErrorMsg(c, "token already exists")
			return
		}
		common.ApiError(c, err)
		return
	}

	if req.Remark != "" {
		model.RecordLog(userId, model.LogTypeSystem, fmt.Sprintf("Operator API provisioned user: %s", req.Remark))
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"user_id": userId,
			"sk":      responseSK,
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
		modelLimits := make([]string, 0)
		if t.ModelLimits != "" {
			modelLimits = strings.Split(t.ModelLimits, ",")
		}
		sk := t.Key
		// Auto-generated keys are 48-char random strings; prepend "sk-".
		// Custom tokens (shorter or non-standard) are returned as-is.
		if len(t.Key) == 48 {
			sk = "sk-" + t.Key
		}
		items = append(items, operatorTokenItem{
			SK:                 sk,
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
	SK             string  `json:"sk"`
	AmountUSD      float64 `json:"amount_usd"`      // 充值金额（美元），1.0 = $1 = 500000 quota
	IdempotencyKey string  `json:"idempotency_key"` // 幂等 key，防止重复充值；24 小时内相同 key 只处理一次
	Remark         string  `json:"remark"`
}

func OperatorQuota(c *gin.Context) {
	var req operatorQuotaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.AmountUSD <= 0 {
		common.ApiErrorMsg(c, "amount_usd must be greater than 0")
		return
	}

	// 幂等校验：相同 idempotency_key 在 24 小时内只处理一次
	if req.IdempotencyKey != "" && common.RedisEnabled {
		redisKey := "operator:quota:idem:" + req.IdempotencyKey
		ok, err := common.RDB.SetNX(context.Background(), redisKey, "1", 24*time.Hour).Result()
		if err != nil {
			common.ApiError(c, fmt.Errorf("idempotency check failed: %w", err))
			return
		}
		if !ok {
			// 已处理过，直接返回成功（幂等）
			c.JSON(http.StatusOK, gin.H{
				"success":    true,
				"message":    "already processed (idempotent)",
				"idempotent": true,
			})
			return
		}
	}

	quota := int(math.Round(req.AmountUSD * float64(common.QuotaPerUnit)))

	user, _, err := resolveTargetUser(req.SK)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	previousQuota := user.Quota
	if err := model.IncreaseUserQuota(user.Id, quota, true); err != nil {
		common.ApiError(c, err)
		return
	}

	remark := req.Remark
	if remark == "" {
		remark = fmt.Sprintf("$%.4f", req.AmountUSD)
	}
	model.RecordLog(user.Id, model.LogTypeManage, fmt.Sprintf("Operator API charged %d quota (%s)", quota, remark))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"previous_quota": previousQuota,
			"current_quota":  previousQuota + quota,
			"quota_charged":  quota,
			"amount_usd":     req.AmountUSD,
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

func OperatorEnable(c *gin.Context) {
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

	token.Status = common.TokenStatusEnabled
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
