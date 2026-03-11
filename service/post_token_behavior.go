package service

import (
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

type PostTokenBehavior func(c *gin.Context, token *model.Token) *types.NewAPIError

// postTokenBehaviors keeps post-auth behaviors in execution order.
// Keep each behavior idempotent and side-effect scoped because it runs on every relay request.
var postTokenBehaviors = []PostTokenBehavior{
	RunUserPointsPreDeductGuard,
}

// RunPostTokenBehaviors runs all post-token-auth hooks.
// The first behavior that returns an error will stop the chain.
func RunPostTokenBehaviors(c *gin.Context, token *model.Token) *types.NewAPIError {
	for _, behavior := range postTokenBehaviors {
		if behavior == nil {
			continue
		}
		if err := behavior(c, token); err != nil {
			return err
		}
	}
	return nil
}
