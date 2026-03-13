package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestIsImaSlowModel(t *testing.T) {
	t.Run("origin model ima-pro", func(t *testing.T) {
		task := &model.Task{
			Properties: model.Properties{
				OriginModelName: "ima-pro",
			},
		}
		if !isImaSlowModel(task) {
			t.Fatal("expected ima-pro to be detected as slow model")
		}
	})

	t.Run("upstream model ima-pro-fast", func(t *testing.T) {
		task := &model.Task{
			Properties: model.Properties{
				UpstreamModelName: "ima-pro-fast",
			},
		}
		if !isImaSlowModel(task) {
			t.Fatal("expected ima-pro-fast to be detected as slow model")
		}
	})

	t.Run("other model", func(t *testing.T) {
		task := &model.Task{
			Properties: model.Properties{
				OriginModelName: "gpt-4o-mini",
			},
		}
		if isImaSlowModel(task) {
			t.Fatal("expected non-ima model not to be detected as slow model")
		}
	})
}

func TestShouldPollVideoTaskNow(t *testing.T) {
	nowInWindow := int64(600)  // 600 % 300 == 0
	nowOutWindow := int64(631) // 631 % 300 == 31 (outside 30s window)

	t.Run("non-ima should always poll", func(t *testing.T) {
		task := &model.Task{
			SubmitTime: 590,
			Properties: model.Properties{
				OriginModelName: "gpt-4o-mini",
			},
		}
		if !shouldPollVideoTaskNow(task, nowOutWindow) {
			t.Fatal("expected non-ima task to be polled")
		}
	})

	t.Run("ima less than 5 minutes should not poll", func(t *testing.T) {
		task := &model.Task{
			SubmitTime: 400, // age 200s
			Properties: model.Properties{
				OriginModelName: "ima-pro",
			},
		}
		if shouldPollVideoTaskNow(task, nowInWindow) {
			t.Fatal("expected ima task under 5 minutes not to be polled")
		}
	})

	t.Run("ima after 5 minutes and in poll window should poll", func(t *testing.T) {
		task := &model.Task{
			SubmitTime: 200, // age 400s
			Properties: model.Properties{
				OriginModelName: "ima-pro-fast",
			},
		}
		if !shouldPollVideoTaskNow(task, nowInWindow) {
			t.Fatal("expected ima task over 5 minutes in window to be polled")
		}
	})

	t.Run("ima after 5 minutes but outside poll window should not poll", func(t *testing.T) {
		task := &model.Task{
			SubmitTime: 200, // age 431s
			Properties: model.Properties{
				UpstreamModelName: "ima-pro",
			},
		}
		if shouldPollVideoTaskNow(task, nowOutWindow) {
			t.Fatal("expected ima task outside poll window not to be polled")
		}
	})
}

func TestShouldSkipTimeoutForSlowModel(t *testing.T) {
	t.Run("ima model should skip timeout", func(t *testing.T) {
		task := &model.Task{
			SubmitTime: 1,
			Properties: model.Properties{
				OriginModelName: "ima-pro",
			},
		}
		if !shouldSkipTimeoutForSlowModel(task, 10_000) {
			t.Fatal("expected ima task to skip timeout")
		}
	})

	t.Run("other model should not skip timeout", func(t *testing.T) {
		task := &model.Task{
			SubmitTime: 1,
			Properties: model.Properties{
				OriginModelName: "gpt-4o",
			},
		}
		if shouldSkipTimeoutForSlowModel(task, 10_000) {
			t.Fatal("expected non-ima task not to skip timeout")
		}
	})
}
