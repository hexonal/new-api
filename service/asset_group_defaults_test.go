package service

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestFillAssetGroupDefaults(t *testing.T) {
	group := &dto.DoubaoAssetGroupResult{Id: "group-1"}
	req := dto.AssetGroupCreateRequest{
		Name:        "test-group",
		Description: "desc",
	}
	fillAssetGroupDefaults(group, req)
	if group.Name != "test-group" {
		t.Fatalf("expected name to be filled from request")
	}
	if group.Description != "desc" {
		t.Fatalf("expected description to be filled from request")
	}
	if group.GroupType != "AIGC" {
		t.Fatalf("expected default GroupType AIGC, got %s", group.GroupType)
	}
	if group.ProjectName != "default" {
		t.Fatalf("expected default ProjectName default, got %s", group.ProjectName)
	}
}

