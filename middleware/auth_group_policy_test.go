package middleware

import "testing"

func TestResolveUsingGroupRejectsDefaultOverrideForNonDefaultUser(t *testing.T) {
	_, err := resolveUsingGroup("vip_group", "default")
	if err == nil {
		t.Fatalf("expected error when non-default user overrides to default token group")
	}
}

func TestResolveUsingGroupAllowsDefaultUserDefaultTokenGroup(t *testing.T) {
	group, err := resolveUsingGroup("default", "default")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if group != "default" {
		t.Fatalf("group = %q, want %q", group, "default")
	}
}

func TestResolveUsingGroupKeepsUserGroupWhenTokenGroupEmpty(t *testing.T) {
	group, err := resolveUsingGroup("vip_group", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if group != "vip_group" {
		t.Fatalf("group = %q, want %q", group, "vip_group")
	}
}
