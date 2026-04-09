package service

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestApplyJWTHeaderConsumeCallbackOverrides(t *testing.T) {
	payload := consumeCallbackPayload{
		AppID:          "token-app",
		Env:            "token-env",
		BusinessUserID: "token-user",
	}
	relayInfo := &relaycommon.RelayInfo{
		RequestHeaders: map[string]string{
			"x-app-id":  "header-app",
			"x-env":     "header-env",
			"x-user-id": "header-user",
		},
	}

	applyJWTHeaderConsumeCallbackOverrides(relayInfo, &payload)
	if payload.AppID != "token-app" || payload.Env != "token-env" || payload.BusinessUserID != "token-user" {
		t.Fatalf("expected non-jwt callback metadata to remain unchanged, got %+v", payload)
	}

	relayInfo.JWTHeaderAuth = true
	applyJWTHeaderConsumeCallbackOverrides(relayInfo, &payload)
	if payload.AppID != "header-app" || payload.Env != "header-env" || payload.BusinessUserID != "header-user" {
		t.Fatalf("expected jwt header callback metadata override, got %+v", payload)
	}
}
