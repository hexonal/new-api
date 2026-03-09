package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

func UpdateMidjourneyTaskBulk() {
	//imageModel := "midjourney"
	ctx := context.TODO()
	for {
		time.Sleep(time.Duration(15) * time.Second)

		tasks := model.GetAllUnFinishTasks()
		if len(tasks) == 0 {
			continue
		}

		logger.LogInfo(ctx, fmt.Sprintf("检测到未完成的任务数有: %v", len(tasks)))
		taskChannelM := make(map[int][]string)
		taskM := make(map[string]*model.Midjourney)
		nullTaskIds := make([]int, 0)
		for _, task := range tasks {
			if task.MjId == "" {
				// 统计失败的未完成任务
				nullTaskIds = append(nullTaskIds, task.Id)
				continue
			}
			taskM[task.MjId] = task
			taskChannelM[task.ChannelId] = append(taskChannelM[task.ChannelId], task.MjId)
		}
		if len(nullTaskIds) > 0 {
			err := model.MjBulkUpdateByTaskIds(nullTaskIds, map[string]any{
				"status":   "FAILURE",
				"progress": "100%",
			})
			if err != nil {
				logger.LogError(ctx, fmt.Sprintf("Fix null mj_id task error: %v", err))
			} else {
				logger.LogInfo(ctx, fmt.Sprintf("Fix null mj_id task success: %v", nullTaskIds))
			}
		}
		if len(taskChannelM) == 0 {
			continue
		}

		for channelId, taskIds := range taskChannelM {
			logger.LogInfo(ctx, fmt.Sprintf("渠道 #%d 未完成的任务有: %d", channelId, len(taskIds)))
			if len(taskIds) == 0 {
				continue
			}
			midjourneyChannel, err := model.CacheGetChannel(channelId)
			if err != nil {
				logger.LogError(ctx, fmt.Sprintf("CacheGetChannel: %v", err))
				err := model.MjBulkUpdate(taskIds, map[string]any{
					"fail_reason": fmt.Sprintf("获取渠道信息失败，请联系管理员，渠道ID：%d", channelId),
					"status":      "FAILURE",
					"progress":    "100%",
				})
				if err != nil {
					logger.LogInfo(ctx, fmt.Sprintf("UpdateMidjourneyTask error: %v", err))
				}
				continue
			}
			// ── 悠船渠道：仅依赖 callback 更新，不做轮询（上游无任务查询端点）──
			if midjourneyChannel.Type == constant.ChannelTypeYouchuan {
				continue
			}

			// ── 标准 MJ proxy 批量查询 ──
			requestUrl := fmt.Sprintf("%s/mj/task/list-by-condition", *midjourneyChannel.BaseURL)

			body, _ := json.Marshal(map[string]any{
				"ids": taskIds,
			})
			req, err := http.NewRequest("POST", requestUrl, bytes.NewBuffer(body))
			if err != nil {
				logger.LogError(ctx, fmt.Sprintf("Get Task error: %v", err))
				continue
			}
			// 设置超时时间
			timeout := time.Second * 15
			ctx, cancel := context.WithTimeout(context.Background(), timeout)
			// 使用带有超时的 context 创建新的请求
			req = req.WithContext(ctx)
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("mj-api-secret", midjourneyChannel.Key)
			resp, err := service.GetHttpClient().Do(req)
			if err != nil {
				logger.LogError(ctx, fmt.Sprintf("Get Task Do req error: %v", err))
				continue
			}
			if resp.StatusCode != http.StatusOK {
				logger.LogError(ctx, fmt.Sprintf("Get Task status code: %d", resp.StatusCode))
				continue
			}
			responseBody, err := io.ReadAll(resp.Body)
			if err != nil {
				logger.LogError(ctx, fmt.Sprintf("Get Mjp Task parse body error: %v", err))
				continue
			}
			var responseItems []dto.MidjourneyDto
			err = json.Unmarshal(responseBody, &responseItems)
			if err != nil {
				logger.LogError(ctx, fmt.Sprintf("Get Mjp Task parse body error2: %v, body: %s", err, string(responseBody)))
				continue
			}
			resp.Body.Close()
			req.Body.Close()
			cancel()

			for _, responseItem := range responseItems {
				task := taskM[responseItem.MjId]

				useTime := (time.Now().UnixNano() / int64(time.Millisecond)) - task.SubmitTime
				// 如果时间超过一小时，且进度不是100%，则认为任务失败
				if useTime > 3600000 && task.Progress != "100%" {
					responseItem.FailReason = "上游任务超时（超过1小时）"
					responseItem.Status = "FAILURE"
				}
				if !checkMjTaskNeedUpdate(task, responseItem) {
					continue
				}
				preStatus := task.Status
				task.Code = 1
				task.Progress = responseItem.Progress
				task.PromptEn = responseItem.PromptEn
				task.State = responseItem.State
				task.SubmitTime = responseItem.SubmitTime
				task.StartTime = responseItem.StartTime
				task.FinishTime = responseItem.FinishTime
				task.ImageUrl = responseItem.ImageUrl
				imageUrls := responseItem.Urls
				if len(imageUrls) == 0 && responseItem.ImageUrl != "" {
					imageUrls = []string{responseItem.ImageUrl}
				}
				if len(imageUrls) > 0 {
					imageUrlsStr, err := json.Marshal(imageUrls)
					if err != nil {
						logger.LogError(ctx, fmt.Sprintf("序列化 ImageUrls 失败: %v", err))
					} else {
						task.ImageUrls = string(imageUrlsStr)
					}
					if task.ImageUrl == "" {
						task.ImageUrl = imageUrls[0]
					}
				}
				task.Status = responseItem.Status
				task.FailReason = responseItem.FailReason
				if responseItem.Properties != nil {
					propertiesStr, _ := json.Marshal(responseItem.Properties)
					task.Properties = string(propertiesStr)
				}
				if responseItem.Buttons != nil {
					buttonStr, _ := json.Marshal(responseItem.Buttons)
					task.Buttons = string(buttonStr)
				}
				// 映射 VideoUrl
				task.VideoUrl = responseItem.VideoUrl

				// 映射 VideoUrls - 将数组序列化为 JSON 字符串
				if responseItem.VideoUrls != nil && len(responseItem.VideoUrls) > 0 {
					videoUrlsStr, err := json.Marshal(responseItem.VideoUrls)
					if err != nil {
						logger.LogError(ctx, fmt.Sprintf("序列化 VideoUrls 失败: %v", err))
						task.VideoUrls = "[]" // 失败时设置为空数组
					} else {
						task.VideoUrls = string(videoUrlsStr)
					}
				} else {
					task.VideoUrls = "" // 空值时清空字段
				}

				shouldReturnQuota := false
				if (task.Progress != "100%" && responseItem.FailReason != "") || (task.Progress == "100%" && task.Status == "FAILURE") {
					logger.LogInfo(ctx, task.MjId+" 构建失败，"+task.FailReason)
					task.Progress = "100%"
					if task.Quota != 0 {
						shouldReturnQuota = true
					}
				}
				won, err := task.UpdateWithStatus(preStatus)
				if err != nil {
					logger.LogError(ctx, "UpdateMidjourneyTask task error: "+err.Error())
				} else if won && shouldReturnQuota {
					err = model.IncreaseUserQuota(task.UserId, task.Quota, false)
					if err != nil {
						logger.LogError(ctx, "fail to increase user quota: "+err.Error())
					}
					model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
						UserId:    task.UserId,
						LogType:   model.LogTypeRefund,
						Content:   "",
						ChannelId: task.ChannelId,
						ModelName: service.CovertMjpActionToModelName(task.Action),
						Quota:     task.Quota,
						Other: map[string]interface{}{
							"task_id": task.MjId,
							"reason":  "构图失败",
						},
					})
				}
			}
		}
	}
}

func checkMjTaskNeedUpdate(oldTask *model.Midjourney, newTask dto.MidjourneyDto) bool {
	if oldTask.Code != 1 {
		return true
	}
	if oldTask.Progress != newTask.Progress {
		return true
	}
	if oldTask.PromptEn != newTask.PromptEn {
		return true
	}
	if oldTask.State != newTask.State {
		return true
	}
	if oldTask.SubmitTime != newTask.SubmitTime {
		return true
	}
	if oldTask.StartTime != newTask.StartTime {
		return true
	}
	if oldTask.FinishTime != newTask.FinishTime {
		return true
	}
	if oldTask.ImageUrl != newTask.ImageUrl {
		return true
	}
	newImageUrls := newTask.Urls
	if len(newImageUrls) == 0 && newTask.ImageUrl != "" {
		newImageUrls = []string{newTask.ImageUrl}
	}
	if len(newImageUrls) > 0 {
		newImageUrlsStr, _ := json.Marshal(newImageUrls)
		if oldTask.ImageUrls != string(newImageUrlsStr) {
			return true
		}
	}
	if oldTask.Status != newTask.Status {
		return true
	}
	if oldTask.FailReason != newTask.FailReason {
		return true
	}
	if oldTask.FinishTime != newTask.FinishTime {
		return true
	}
	if oldTask.Progress != "100%" && newTask.FailReason != "" {
		return true
	}
	// 检查 VideoUrl 是否需要更新
	if oldTask.VideoUrl != newTask.VideoUrl {
		return true
	}
	// 检查 VideoUrls 是否需要更新
	if newTask.VideoUrls != nil && len(newTask.VideoUrls) > 0 {
		newVideoUrlsStr, _ := json.Marshal(newTask.VideoUrls)
		if oldTask.VideoUrls != string(newVideoUrlsStr) {
			return true
		}
	} else if oldTask.VideoUrls != "" {
		// 如果新数据没有 VideoUrls 但旧数据有，需要更新（清空）
		return true
	}

	return false
}

func GetAllMidjourney(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)

	// 解析其他查询参数
	queryParams := model.TaskQueryParams{
		ChannelID:      c.Query("channel_id"),
		MjID:           c.Query("mj_id"),
		StartTimestamp: c.Query("start_timestamp"),
		EndTimestamp:   c.Query("end_timestamp"),
	}

	items := model.GetAllTasks(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), queryParams)
	total := model.CountAllTasks(queryParams)

	if setting.MjForwardUrlEnabled {
		for i, midjourney := range items {
			midjourney.ImageUrl = system_setting.ServerAddress + "/mj/image/" + midjourney.MjId
			items[i] = midjourney
		}
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetUserMidjourney(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)

	userId := c.GetInt("id")

	queryParams := model.TaskQueryParams{
		MjID:           c.Query("mj_id"),
		StartTimestamp: c.Query("start_timestamp"),
		EndTimestamp:   c.Query("end_timestamp"),
	}

	items := model.GetAllUserTask(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), queryParams)
	total := model.CountAllUserTask(userId, queryParams)

	if setting.MjForwardUrlEnabled {
		for i, midjourney := range items {
			midjourney.ImageUrl = system_setting.ServerAddress + "/mj/image/" + midjourney.MjId
			items[i] = midjourney
		}
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

// pollYouchuanMjTasks 逐任务查询悠船接口，更新 midjourneys 表。
// 回调是主通道，此轮询作为兜底，两者通过 CAS (UpdateWithStatus) 避免冲突。
func pollYouchuanMjTasks(ctx context.Context, ch *model.Channel, taskIds []string, taskM map[string]*model.Midjourney) {
	parts := strings.SplitN(ch.Key, "|", 2)
	if len(parts) != 2 {
		logger.LogError(ctx, fmt.Sprintf("youchuan poll: invalid key format for channel %d", ch.Id))
		return
	}
	appKey := strings.TrimSpace(parts[0])
	secret := strings.TrimSpace(parts[1])

	for _, mjId := range taskIds {
		task, ok := taskM[mjId]
		if !ok {
			continue
		}
		// 已完成的任务跳过
		if task.Status == "SUCCESS" || task.Status == "FAILURE" {
			continue
		}

		url := fmt.Sprintf("%s/v1/tob/task/%s", *ch.BaseURL, mjId)
		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			logger.LogError(ctx, fmt.Sprintf("youchuan poll: create request error: %v", err))
			continue
		}
		reqCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		req = req.WithContext(reqCtx)
		req.Header.Set("x-youchuan-app", appKey)
		req.Header.Set("x-youchuan-secret", secret)
		req.Header.Set("Accept", "application/json")

		resp, err := service.GetHttpClient().Do(req)
		if err != nil {
			cancel()
			logger.LogError(ctx, fmt.Sprintf("youchuan poll: request error for %s: %v", mjId, err))
			continue
		}
		respBody, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		cancel()
		if err != nil {
			logger.LogError(ctx, fmt.Sprintf("youchuan poll: read body error for %s: %v", mjId, err))
			continue
		}
		if resp.StatusCode != http.StatusOK {
			logger.LogError(ctx, fmt.Sprintf("youchuan poll: status %d for %s, body: %s", resp.StatusCode, mjId, string(respBody)))
			continue
		}

		// 解析悠船响应
		var ycResp struct {
			ID      string   `json:"id"`
			URLs    []string `json:"urls"`
			Status  int      `json:"status"`
			Comment string   `json:"comment"`
			Code    int      `json:"code"`
			Message string   `json:"message"`
		}
		if err := json.Unmarshal(respBody, &ycResp); err != nil {
			logger.LogError(ctx, fmt.Sprintf("youchuan poll: unmarshal error for %s: %v", mjId, err))
			continue
		}

		// 状态映射
		preStatus := task.Status
		now := time.Now().UnixNano() / int64(time.Millisecond)
		needUpdate := false

		switch ycResp.Status {
		case 0: // StatusQueued
			if task.Progress != "0%" {
				task.Progress = "0%"
				needUpdate = true
			}
		case 1: // StatusProcessing
			if task.Status != "" || task.Progress != "50%" {
				task.Status = ""
				task.Progress = "50%"
				if task.StartTime == 0 {
					task.StartTime = now
				}
				needUpdate = true
			}
		case 2: // StatusSuccess
			task.Status = "SUCCESS"
			task.Progress = "100%"
			if len(ycResp.URLs) > 0 {
				task.ImageUrl = ycResp.URLs[0]
				if imageUrls, err := json.Marshal(ycResp.URLs); err == nil {
					task.ImageUrls = string(imageUrls)
				} else {
					logger.LogError(ctx, fmt.Sprintf("youchuan poll: marshal urls error for %s: %v", mjId, err))
				}
			}
			task.FinishTime = now
			needUpdate = true
		case 3, 4: // StatusFailed, StatusAuditFail
			task.Status = "FAILURE"
			task.Progress = "100%"
			task.FailReason = ycResp.Comment
			if task.FailReason == "" {
				task.FailReason = ycResp.Message
			}
			task.FinishTime = now
			needUpdate = true
		}

		if !needUpdate {
			continue
		}

		won, err := task.UpdateWithStatus(preStatus)
		if err != nil {
			logger.LogError(ctx, fmt.Sprintf("youchuan poll: update error for %s: %v", mjId, err))
			continue
		}
		if won && task.Status == "FAILURE" && task.Quota != 0 {
			err = model.IncreaseUserQuota(task.UserId, task.Quota, false)
			if err != nil {
				logger.LogError(ctx, fmt.Sprintf("youchuan poll: refund error for %s: %v", mjId, err))
			}
			model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
				UserId:    task.UserId,
				LogType:   model.LogTypeRefund,
				Content:   "",
				ChannelId: task.ChannelId,
				ModelName: service.CovertMjpActionToModelName(task.Action),
				Quota:     task.Quota,
				Other: map[string]any{
					"task_id": mjId,
					"reason":  "构图失败",
				},
			})
		}
	}
}
