package middleware

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// OperatorAuth validates an API token from the Authorization header and
// ensures the token owner is an active admin (role >= RoleAdminUser).
// On success it sets "operator_user_id" and "operator_token_id" in the context.
func OperatorAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.Request.Header.Get("Authorization")
		if strings.HasPrefix(key, "Bearer ") || strings.HasPrefix(key, "bearer ") {
			key = strings.TrimSpace(key[7:])
		}
		key = strings.TrimPrefix(key, "sk-")

		if key == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "未提供有效的令牌",
			})
			c.Abort()
			return
		}

		token, err := model.GetTokenByKey(key, false)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "无效的令牌",
			})
			c.Abort()
			return
		}

		if token.Status != common.TokenStatusEnabled {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "令牌已被禁用",
			})
			c.Abort()
			return
		}

		if token.ExpiredTime != -1 && token.ExpiredTime < common.GetTimestamp() {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "令牌已过期",
			})
			c.Abort()
			return
		}

		user, err := model.GetUserById(token.UserId, false)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "无法获取用户信息",
			})
			c.Abort()
			return
		}

		if user.Status != common.UserStatusEnabled {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": "用户已被封禁",
			})
			c.Abort()
			return
		}

		if user.Role < common.RoleAdminUser {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": "权限不足，需要管理员权限",
			})
			c.Abort()
			return
		}

		c.Set("operator_user_id", user.Id)
		c.Set("operator_token_id", token.Id)
		c.Set("id", user.Id)
		c.Set("username", user.Username)
		c.Set("role", user.Role)
		c.Next()
	}
}
