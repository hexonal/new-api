package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestGetEndpointTypesByChannelTypeIncludesSuno(t *testing.T) {
	endpointTypes := GetEndpointTypesByChannelType(constant.ChannelTypeSunoAPI, "suno-v4")
	if len(endpointTypes) != 1 || endpointTypes[0] != constant.EndpointTypeSuno {
		t.Fatalf("expected suno channel type to map to suno endpoint, got %#v", endpointTypes)
	}
}

func TestGetEndpointTypesByChannelTypeIncludesMidjourney(t *testing.T) {
	endpointTypes := GetEndpointTypesByChannelType(constant.ChannelTypeMidjourney, "midjourney")
	if len(endpointTypes) != 1 || endpointTypes[0] != constant.EndpointTypeMidjourney {
		t.Fatalf("expected midjourney channel type to map to midjourney endpoint, got %#v", endpointTypes)
	}
}

func TestGetEndpointTypesByChannelTypeIncludesMidjourneyPlus(t *testing.T) {
	endpointTypes := GetEndpointTypesByChannelType(constant.ChannelTypeMidjourneyPlus, "midjourney")
	if len(endpointTypes) != 1 || endpointTypes[0] != constant.EndpointTypeMidjourney {
		t.Fatalf("expected midjourney plus channel type to map to midjourney endpoint, got %#v", endpointTypes)
	}
}

func TestGetEndpointTypesByChannelTypeIncludesKling(t *testing.T) {
	endpointTypes := GetEndpointTypesByChannelType(constant.ChannelTypeKling, "kling-v2-master")
	if len(endpointTypes) != 1 || endpointTypes[0] != constant.EndpointTypeKling {
		t.Fatalf("expected kling channel type to map to kling endpoint, got %#v", endpointTypes)
	}
}

func TestGetEndpointTypesByChannelTypeIncludesJimeng(t *testing.T) {
	endpointTypes := GetEndpointTypesByChannelType(constant.ChannelTypeJimeng, "jimeng_high_aes_general_v21_L")
	if len(endpointTypes) != 1 || endpointTypes[0] != constant.EndpointTypeJimeng {
		t.Fatalf("expected jimeng channel type to map to jimeng endpoint, got %#v", endpointTypes)
	}
}

func TestGetDefaultEndpointInfoIncludesMidjourney(t *testing.T) {
	info, ok := GetDefaultEndpointInfo(constant.EndpointTypeMidjourney)
	if !ok {
		t.Fatalf("expected midjourney endpoint type to have default endpoint info")
	}
	if info.Path != "/mj/submit/imagine" {
		t.Fatalf("unexpected midjourney default path: %q", info.Path)
	}
	if info.Method != "POST" {
		t.Fatalf("unexpected midjourney default method: %q", info.Method)
	}
}

func TestGetDefaultEndpointInfoIncludesKling(t *testing.T) {
	info, ok := GetDefaultEndpointInfo(constant.EndpointTypeKling)
	if !ok {
		t.Fatalf("expected kling endpoint type to have default endpoint info")
	}
	if info.Path != "/v1/videos/generations" {
		t.Fatalf("unexpected kling default path: %q", info.Path)
	}
	if info.Method != "POST" {
		t.Fatalf("unexpected kling default method: %q", info.Method)
	}
}

func TestGetDefaultEndpointInfoIncludesJimeng(t *testing.T) {
	info, ok := GetDefaultEndpointInfo(constant.EndpointTypeJimeng)
	if !ok {
		t.Fatalf("expected jimeng endpoint type to have default endpoint info")
	}
	if info.Path != "/v1/images/generations" {
		t.Fatalf("unexpected jimeng default path: %q", info.Path)
	}
	if info.Method != "POST" {
		t.Fatalf("unexpected jimeng default method: %q", info.Method)
	}
}
