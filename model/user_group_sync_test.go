package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestInsertWithTx_MirrorsPricingGroupToGroup(t *testing.T) {
	truncateTables(t)

	tx := DB.Begin()
	require.NoError(t, tx.Error)

	user := &User{
		Username:     "sync_insert",
		DisplayName:  "sync_insert",
		Password:     "secret123",
		Group:        "shizeing3",
		PricingGroup: "shizeying2",
		Status:       common.UserStatusEnabled,
		Role:         common.RoleCommonUser,
	}
	require.NoError(t, user.InsertWithTx(tx, 0))
	require.NoError(t, tx.Commit().Error)

	var fresh User
	require.NoError(t, DB.First(&fresh, user.Id).Error)
	require.Equal(t, "shizeing3", fresh.Group)
	require.Equal(t, "shizeing3", fresh.PricingGroup)
}

func TestEditWithTx_MirrorsPricingGroupToGroup(t *testing.T) {
	truncateTables(t)

	user := &User{
		Username:     "sync_edit",
		DisplayName:  "sync_edit",
		Password:     "secret123",
		Group:        "default",
		PricingGroup: "default",
		Status:       common.UserStatusEnabled,
		Role:         common.RoleCommonUser,
	}
	require.NoError(t, user.Insert(0))

	user.Group = "shizeing3"
	user.PricingGroup = "shizeying2"

	tx := DB.Begin()
	require.NoError(t, tx.Error)
	require.NoError(t, user.EditWithTx(tx, false))
	require.NoError(t, tx.Commit().Error)

	var fresh User
	require.NoError(t, DB.First(&fresh, user.Id).Error)
	require.Equal(t, "shizeing3", fresh.Group)
	require.Equal(t, "shizeing3", fresh.PricingGroup)
}

func TestUserBaseWriteContext_UsesGroupForPricingGroup(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)

	user := &UserBase{
		Group:        "shizeing3",
		PricingGroup: "shizeying2",
	}
	user.WriteContext(ctx)

	require.Equal(t, "shizeing3", common.GetContextKeyString(ctx, constant.ContextKeyUserGroup))
	require.Equal(t, "shizeing3", common.GetContextKeyString(ctx, constant.ContextKeyUserPricingGroup))
}
