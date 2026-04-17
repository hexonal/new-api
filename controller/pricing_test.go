package controller

import "testing"

func TestResolveMarketplaceDefaultPricingGroup(t *testing.T) {
	usable := map[string]string{
		"default": "默认分组",
		"vip":     "VIP分组",
	}

	testCases := []struct {
		name       string
		configured string
		isAdmin    bool
		expected   string
	}{
		{
			name:       "管理员始终失效",
			configured: "default",
			isAdmin:    true,
			expected:   "",
		},
		{
			name:       "配置为空",
			configured: "",
			isAdmin:    false,
			expected:   "",
		},
		{
			name:       "配置仅空白字符",
			configured: "   ",
			isAdmin:    false,
			expected:   "",
		},
		{
			name:       "配置分组不存在",
			configured: "unknown",
			isAdmin:    false,
			expected:   "",
		},
		{
			name:       "配置分组存在",
			configured: "vip",
			isAdmin:    false,
			expected:   "vip",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got := resolveMarketplaceDefaultPricingGroup(tc.configured, usable, tc.isAdmin)
			if got != tc.expected {
				t.Fatalf("expected %q, got %q", tc.expected, got)
			}
		})
	}
}
