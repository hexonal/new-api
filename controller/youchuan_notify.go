package controller

import (
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/youchuan"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// RelayYouchuanNotify 处理悠船 callback 回调。
// 悠船 API 没有任务查询端点，只通过提交时传入的 callback URL 推送结果。
// 此路由无需 TokenAuth，由悠船服务器直接调用。
func RelayYouchuanNotify(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "read body failed"})
		return
	}

	var ycResp youchuan.YouchuanResponse
	if err := common.Unmarshal(body, &ycResp); err != nil {
		logger.LogError(c, "youchuan notify: unmarshal failed: "+err.Error())
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid json"})
		return
	}

	if ycResp.ID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing id"})
		return
	}

	platform := constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeYouchuan))
	task, exist, err := model.GetTaskByPlatformAndUpstreamID(platform, ycResp.ID)
	if err != nil {
		logger.LogError(c, "youchuan notify: db query error: "+err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}
	if !exist {
		logger.LogWarn(c, "youchuan notify: task not found for upstream id: "+ycResp.ID)
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	// 解析回调结果
	adaptor := &youchuan.TaskAdaptor{}
	taskResult, err := adaptor.ParseTaskResult(body)
	if err != nil {
		logger.LogError(c, "youchuan notify: parse result failed: "+err.Error())
		c.JSON(http.StatusBadRequest, gin.H{"error": "parse failed"})
		return
	}

	snap := task.Snapshot()

	// 更新任务状态
	task.Data = body
	task.Status = model.TaskStatus(taskResult.Status)
	task.Progress = taskResult.Progress
	if taskResult.Url != "" {
		task.PrivateData.ResultURL = taskResult.Url
	}
	if taskResult.Reason != "" {
		task.FailReason = taskResult.Reason
	}

	now := time.Now().Unix()
	isTerminal := task.Status == model.TaskStatusSuccess || task.Status == model.TaskStatusFailure
	if isTerminal && task.FinishTime == 0 {
		task.FinishTime = now
	}
	if task.Status == model.TaskStatusInProgress && task.StartTime == 0 {
		task.StartTime = now
	}

	// CAS 更新：防止与超时清理或重复回调竞争
	won, err := task.UpdateWithStatus(snap.Status)
	if err != nil {
		logger.LogError(c, "youchuan notify: update failed: "+err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}
	if !won {
		logger.LogWarn(c, "youchuan notify: task "+task.TaskID+" already transitioned, skip")
		c.JSON(http.StatusOK, gin.H{"status": "ok", "note": "already processed"})
		return
	}

	// 计费结算
	if task.Status == model.TaskStatusFailure && task.Quota != 0 {
		service.RefundTaskQuota(c, task, task.FailReason)
	}
	// SUCCESS 时保持预扣额度（悠船使用 BaseBilling，无需差额结算）

	logger.LogInfo(c, "youchuan notify: task "+task.TaskID+" updated to "+string(task.Status))
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
