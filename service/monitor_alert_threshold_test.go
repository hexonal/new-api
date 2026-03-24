package service

import (
	"sync"
	"testing"
	"time"
)

func TestAllowMonitorCallErrorByThreshold(t *testing.T) {
	monitorCallErrorStats = sync.Map{}
	channelID := 9527
	now := time.Now()

	if allowMonitorCallErrorByThreshold(channelID, now, 3, 5) {
		t.Fatalf("first failure should not trigger alert")
	}
	if allowMonitorCallErrorByThreshold(channelID, now.Add(5*time.Second), 3, 5) {
		t.Fatalf("second failure should not trigger alert")
	}
	if !allowMonitorCallErrorByThreshold(channelID, now.Add(10*time.Second), 3, 5) {
		t.Fatalf("third failure should trigger alert")
	}
	if allowMonitorCallErrorByThreshold(channelID, now.Add(15*time.Second), 3, 5) {
		t.Fatalf("counter should reset after trigger, fourth failure should not trigger")
	}
}

func TestAllowMonitorCallErrorByThresholdWindowPrune(t *testing.T) {
	monitorCallErrorStats = sync.Map{}
	channelID := 2001
	base := time.Now()

	if allowMonitorCallErrorByThreshold(channelID, base, 2, 1) {
		t.Fatalf("first failure should not trigger alert")
	}
	if allowMonitorCallErrorByThreshold(channelID, base.Add(61*time.Second), 2, 1) {
		t.Fatalf("second failure is outside window, should not trigger")
	}
	if !allowMonitorCallErrorByThreshold(channelID, base.Add(90*time.Second), 2, 1) {
		t.Fatalf("third failure with one recent failure should trigger")
	}
}

func TestAllowMonitorCallErrorByThresholdBypass(t *testing.T) {
	monitorCallErrorStats = sync.Map{}
	now := time.Now()

	if !allowMonitorCallErrorByThreshold(0, now, 3, 5) {
		t.Fatalf("channel id 0 should bypass threshold")
	}
	if !allowMonitorCallErrorByThreshold(123, now, 1, 5) {
		t.Fatalf("threshold <= 1 should bypass threshold")
	}
}
