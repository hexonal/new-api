package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestResolveAssetBillingGroups(t *testing.T) {
	tests := []struct {
		name          string
		token         *model.Token
		userGroup     string
		wantGroup     string
		wantPricing   string
	}{
		{
			name:        "prefer token group when present",
			token:       &model.Token{Group: "shizeying"},
			userGroup:   "default",
			wantGroup:   "shizeying",
			wantPricing: "shizeying",
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

