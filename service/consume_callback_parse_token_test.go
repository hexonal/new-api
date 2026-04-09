package service

import "testing"

func TestParseTokenNameUsesEnvFirstFormat(t *testing.T) {
	appID, userID, env := parseTokenName("prod_app123_user456")
	if appID != "app123" || userID != "user456" || env != "prod" {
		t.Fatalf("expected env-first token name parsing, got appID=%q userID=%q env=%q", appID, userID, env)
	}
}
