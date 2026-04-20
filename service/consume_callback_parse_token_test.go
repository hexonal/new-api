package service

import "testing"

func TestParseTokenNameUsesEnvFirstFormat(t *testing.T) {
	appID, userID, env := parseTokenName("prod_app123_user456")
	if appID != "app123" || userID != "user456" || env != "prod" {
		t.Fatalf("expected env-first token name parsing, got appID=%q userID=%q env=%q", appID, userID, env)
	}
}

func TestParseTokenNameSupportsHyphenatedAppID(t *testing.T) {
	appID, userID, env := parseTokenName("dev_vid-craft_30")
	if appID != "vid-craft" || userID != "30" || env != "dev" {
		t.Fatalf("expected hyphenated app id parsing, got appID=%q userID=%q env=%q", appID, userID, env)
	}
}
