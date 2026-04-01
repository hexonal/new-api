package service

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

func TestShouldPollVideoTaskNow_ChannelBased(t *testing.T) {
	makeChannel := func(delaySeconds int) *model.Channel {
		ch := &model.Channel{}
		settings := dto.ChannelSettings{PollInitialDelaySeconds: delaySeconds}
		ch.SetSetting(settings)
		return ch
	}

	t.Run("nil channel should always poll", func(t *testing.T) {
		task := &model.Task{SubmitTime: 100}
		if !shouldPollVideoTaskNow(task, 110, nil) {
			t.Fatal("expected nil channel to always poll")
		}
	})

	t.Run("no delay configured should always poll", func(t *testing.T) {
		task := &model.Task{SubmitTime: 100}
		ch := makeChannel(0)
		if !shouldPollVideoTaskNow(task, 110, ch) {
			t.Fatal("expected zero delay to always poll")
		}
	})

	t.Run("within initial delay should not poll", func(t *testing.T) {
		task := &model.Task{SubmitTime: 100}
		ch := makeChannel(300) // 5 min delay
		if shouldPollVideoTaskNow(task, 200, ch) { // age=100s < 300s
			t.Fatal("expected task within initial delay not to be polled")
		}
	})

	t.Run("past initial delay should poll", func(t *testing.T) {
		task := &model.Task{SubmitTime: 100}
		ch := makeChannel(300)
		if !shouldPollVideoTaskNow(task, 500, ch) { // age=400s > 300s
			t.Fatal("expected task past initial delay to be polled")
		}
	})
}

func TestGetTaskBackoffSeconds_ChannelBased(t *testing.T) {
	t.Run("nil channel uses default", func(t *testing.T) {
		task := &model.Task{}
		backoff := getTaskBackoffSeconds(task, nil)
		if backoff != int64(taskPollingTickSeconds) {
			t.Fatalf("expected %d, got %d", taskPollingTickSeconds, backoff)
		}
	})

	t.Run("channel with poll_interval_seconds", func(t *testing.T) {
		task := &model.Task{}
		ch := &model.Channel{}
		settings := dto.ChannelSettings{PollIntervalSeconds: 300}
		ch.SetSetting(settings)
		backoff := getTaskBackoffSeconds(task, ch)
		if backoff != 300 {
			t.Fatalf("expected 300, got %d", backoff)
		}
	})

	t.Run("channel with zero uses default", func(t *testing.T) {
		task := &model.Task{}
		ch := &model.Channel{}
		settings := dto.ChannelSettings{PollIntervalSeconds: 0}
		ch.SetSetting(settings)
		backoff := getTaskBackoffSeconds(task, ch)
		if backoff != int64(taskPollingTickSeconds) {
			t.Fatalf("expected %d, got %d", taskPollingTickSeconds, backoff)
		}
	})
}
