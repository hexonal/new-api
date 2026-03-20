package service

import "testing"

func TestValidateAssetSortBy(t *testing.T) {
	valid := []string{"CreateTime", "UpdateTime", "GroupId"}
	for _, v := range valid {
		if err := validateAssetSortBy(v); err != nil {
			t.Fatalf("expected valid sort_by %s, got error: %v", v, err)
		}
	}
	if err := validateAssetSortBy("created_at"); err == nil {
		t.Fatalf("expected invalid sort_by to fail")
	}
}

func TestValidateAssetGroupSortBy(t *testing.T) {
	valid := []string{"CreateTime", "UpdateTime"}
	for _, v := range valid {
		if err := validateAssetGroupSortBy(v); err != nil {
			t.Fatalf("expected valid group sort_by %s, got error: %v", v, err)
		}
	}
	if err := validateAssetGroupSortBy("GroupId"); err == nil {
		t.Fatalf("expected GroupId invalid for group/list")
	}
}

func TestValidateAssetSortOrder(t *testing.T) {
	if err := validateAssetSortOrder("Asc"); err != nil {
		t.Fatalf("Asc should be valid, got %v", err)
	}
	if err := validateAssetSortOrder("Desc"); err != nil {
		t.Fatalf("Desc should be valid, got %v", err)
	}
	if err := validateAssetSortOrder("desc"); err == nil {
		t.Fatalf("lowercase desc should be rejected")
	}
}

