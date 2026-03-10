package model

import "testing"

func TestLogExactRequestPriority(t *testing.T) {
	if got := logExactRequestPriority(&Log{Type: LogTypeConsume}); got != 0 {
		t.Fatalf("expected consume priority 0, got %d", got)
	}
	if got := logExactRequestPriority(&Log{Type: LogTypeManage}); got != 1 {
		t.Fatalf("expected normal priority 1, got %d", got)
	}
	if got := logExactRequestPriority(&Log{Type: LogTypeError}); got != 2 {
		t.Fatalf("expected error priority 2, got %d", got)
	}
	if got := logExactRequestPriority(nil); got != 99 {
		t.Fatalf("expected nil priority 99, got %d", got)
	}
}
