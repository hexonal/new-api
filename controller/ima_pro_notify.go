package controller

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/sora"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// RelayImaProNotify handles ima-pro / ima-pro-fast upstream callback payloads.
// The provider identifies tasks by id_task (upstream task id), while New API
// uses public task_xxx for external querying.
func RelayImaProNotify(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "read body failed"})
		return
	}

	upstreamTaskID := extractImaProCallbackString(body,
		"id_task",
		"data.id_task",
		"response.id_task",
		"task_id",
		"data.task_id",
		"response.task_id",
	)
	if upstreamTaskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing id_task"})
		return
	}

	platform := constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeImaPro))
	task, exist, err := model.GetTaskByPlatformAndUpstreamID(platform, upstreamTaskID)
	if err != nil {
		logger.LogError(c, "ima_pro notify: db query error: "+err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}
	if !exist {
		logger.LogWarn(c, "ima_pro notify: task not found for upstream id: "+upstreamTaskID)
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	adaptor := &sora.TaskAdaptor{}
	taskInfo, err := adaptor.ParseTaskResult(body)
	if err != nil {
		logger.LogError(c, "ima_pro notify: parse result failed: "+err.Error())
		c.JSON(http.StatusBadRequest, gin.H{"error": "parse failed"})
		return
	}
	taskCodeRaw := extractImaProCallbackString(body, "task_code", "data.task_code", "response.task_code")
	if strings.TrimSpace(taskInfo.Status) == "" && !sora.IsTaskCodeFailure(taskCodeRaw) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing task status"})
		return
	}

	if sora.IsTaskCodeFailure(taskCodeRaw) {
		taskInfo.Status = model.TaskStatusFailure
		if strings.TrimSpace(taskInfo.Reason) == "" {
			taskInfo.Reason = fmt.Sprintf("task failed, code=%s", taskCodeRaw)
		}
	}

	finishAt := normalizeImaProFinishAt(extractImaProCallbackResult(body,
		"finish_at",
		"data.finish_at",
		"response.finish_at",
	))
	_, err = service.ApplyExternalTaskStateUpdate(c, task, taskInfo, body, "ima_pro_notify", finishAt)
	if err != nil {
		logger.LogError(c, "ima_pro notify: apply callback state failed: "+err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "state update failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func normalizeImaProFinishAt(v gjson.Result) int64 {
	if !v.Exists() {
		return 0
	}

	switch v.Type {
	case gjson.Number:
		return normalizeUnixTimestamp(v.Int())
	case gjson.String:
		raw := strings.TrimSpace(v.String())
		if raw == "" {
			return 0
		}
		if n, err := strconv.ParseInt(raw, 10, 64); err == nil {
			return normalizeUnixTimestamp(n)
		}
		for _, layout := range []string{time.RFC3339Nano, time.RFC3339} {
			if t, err := time.Parse(layout, raw); err == nil {
				return t.Unix()
			}
		}
	}
	return 0
}

func normalizeUnixTimestamp(v int64) int64 {
	if v <= 0 {
		return 0
	}
	// ms timestamp -> seconds
	if v > 1_000_000_000_000 {
		return v / 1000
	}
	return v
}

func extractImaProCallbackString(body []byte, paths ...string) string {
	for _, path := range paths {
		v := strings.TrimSpace(gjson.GetBytes(body, path).String())
		if v != "" {
			return v
		}
	}
	return ""
}

func extractImaProCallbackResult(body []byte, paths ...string) gjson.Result {
	for _, path := range paths {
		v := gjson.GetBytes(body, path)
		if v.Exists() {
			return v
		}
	}
	return gjson.Result{}
}
