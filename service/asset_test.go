package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
)

func TestResolveAssetBillingGroups(t *testing.T) {
	tests := []struct {
		name        string
		token       *model.Token
		userGroup   string
		wantGroup   string
		wantPricing string
	}{
		{
			name:        "prefer using group when present",
			token:       &model.Token{Group: "shizeying"},
			userGroup:   "default",
			wantGroup:   "default",
			wantPricing: "default",
		},
		{
			name:        "fallback to user group when token group empty",
			token:       &model.Token{Group: ""},
			userGroup:   "default",
			wantGroup:   "default",
			wantPricing: "default",
		},
		{
			name:        "fallback to default when both empty",
			token:       &model.Token{Group: ""},
			userGroup:   "",
			wantGroup:   "default",
			wantPricing: "default",
		},
		{
			name:        "nil token uses user group",
			token:       nil,
			userGroup:   "vip",
			wantGroup:   "vip",
			wantPricing: "vip",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gotGroup, gotPricing := resolveAssetBillingGroups(tc.token, tc.userGroup)
			if gotGroup != tc.wantGroup {
				t.Fatalf("group mismatch: got %q, want %q", gotGroup, tc.wantGroup)
			}
			if gotPricing != tc.wantPricing {
				t.Fatalf("pricing group mismatch: got %q, want %q", gotPricing, tc.wantPricing)
			}
		})
	}
}

func TestBuildAssetBillingLogOther_IncludesRequestMetadata(t *testing.T) {
	other := buildAssetBillingLogOther(710, 0.00142, RequestLogMetadata{
		RequestPath:       "/v1/assets",
		RequestConversion: []string{"OpenAI Compatible"},
	})

	assert.Equal(t, 0.00142, other["model_price"])
	assert.Equal(t, 1.0, other["group_ratio"])
	assert.Equal(t, 710, other["actual_quota"])
	assert.Equal(t, "asset_upload", other["billing_stage"])
	assert.Equal(t, "/v1/assets", other["request_path"])
	assert.Equal(t, []string{"OpenAI Compatible"}, other["request_conversion"])
}
