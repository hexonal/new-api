package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestDurationUntilNextCallbackCleanup(t *testing.T) {
	loc := time.FixedZone("UTC+8", 8*3600)

	beforeMidnight := time.Date(2026, 3, 5, 23, 59, 0, 0, loc)
	assert.Equal(t, time.Minute, durationUntilNextCallbackCleanup(beforeMidnight))

	atMidnight := time.Date(2026, 3, 6, 0, 0, 0, 0, loc)
	assert.Equal(t, 24*time.Hour, durationUntilNextCallbackCleanup(atMidnight))

	afterMidnight := time.Date(2026, 3, 6, 0, 0, 1, 0, loc)
	assert.Equal(t, 24*time.Hour-time.Second, durationUntilNextCallbackCleanup(afterMidnight))
}
