package model

import "testing"

func TestPropertiesScan_LegacyJSONWithoutBillingSku(t *testing.T) {
	var props Properties

	err := props.Scan([]byte(`{"input":"video","origin_model_name":"ima-pro"}`))
	if err != nil {
		t.Fatalf("props.Scan() error = %v", err)
	}

	if props.Input != "video" {
		t.Fatalf("props.Input = %q, want %q", props.Input, "video")
	}
	if props.OriginModelName != "ima-pro" {
		t.Fatalf("props.OriginModelName = %q, want %q", props.OriginModelName, "ima-pro")
	}
	if props.BillingSku != "" {
		t.Fatalf("props.BillingSku = %q, want empty string", props.BillingSku)
	}
}

func TestPropertiesValueScan_RoundTripBillingSku(t *testing.T) {
	original := Properties{
		Input:             "video",
		UpstreamModelName: "seedance-2.0",
		OriginModelName:   "ima-pro",
		BillingSku:        "seedance-2.0-withvideo-1080p",
	}

	value, err := original.Value()
	if err != nil {
		t.Fatalf("original.Value() error = %v", err)
	}

	bytesValue, ok := value.([]byte)
	if !ok {
		t.Fatalf("original.Value() type = %T, want []byte", value)
	}

	var roundTrip Properties
	err = roundTrip.Scan(bytesValue)
	if err != nil {
		t.Fatalf("roundTrip.Scan() error = %v", err)
	}

	if roundTrip != original {
		t.Fatalf("roundTrip = %+v, want %+v", roundTrip, original)
	}
}
