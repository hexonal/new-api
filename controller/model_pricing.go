package controller

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

// modelPricingPatchMutex 保护单条 patch 的读改写区间，避免并发覆盖。
// 由于底层 ratio_setting 暴露的是快照 + 全量替换接口，在 controller 层加锁
// 串行化所有 patch 写入。
var modelPricingPatchMutex sync.Mutex

// modelPricingEntry 表示单个模型的定价负载（透传，不解析 ratios 内部结构）。
type modelPricingEntry struct {
	Unit   string          `json:"unit"`
	Ratios json.RawMessage `json:"ratios"`
}

// modelPricingPatchRequest 是 PUT /api/model-pricing/:model_name 的请求体。
type modelPricingPatchRequest struct {
	Unit   string          `json:"unit"`
	Ratios json.RawMessage `json:"ratios"`
}

// GetModelPricingMap 返回全量 model pricing map。
// GET /api/model-pricing
func GetModelPricingMap(c *gin.Context) {
	raw := ratio_setting.GetModelPricingMap()
	data := make(map[string]json.RawMessage, len(raw))
	for name, payload := range raw {
		data[name] = payload
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    data,
	})
}

// PatchModelPricing 单条 upsert/delete。
// PUT /api/model-pricing/:model_name
// body 为空（unit 空 + ratios 空/null）视为删除。
func PatchModelPricing(c *gin.Context) {
	rawName := c.Param("model_name")
	decoded, err := url.PathUnescape(rawName)
	if err != nil {
		decoded = rawName
	}
	modelName := strings.TrimSpace(decoded)
	if modelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "model_name 不能为空",
		})
		return
	}

	var req modelPricingPatchRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的请求体: " + err.Error(),
		})
		return
	}

	finalEntry, err := applyModelPricingPatch(modelName, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    finalEntry,
	})
}

// applyModelPricingPatch 在锁保护下完成读改写。
// 返回该模型最终条目（被删除时返回 nil）。
func applyModelPricingPatch(modelName string, req modelPricingPatchRequest) (*modelPricingEntry, error) {
	modelPricingPatchMutex.Lock()
	defer modelPricingPatchMutex.Unlock()

	snapshot := ratio_setting.GetModelPricingMap()
	next := make(map[string]json.RawMessage, len(snapshot)+1)
	for k, v := range snapshot {
		next[k] = v
	}

	shouldDelete := isEmptyPricingPayload(req)
	var finalEntry *modelPricingEntry
	if shouldDelete {
		delete(next, modelName)
	} else {
		entry := modelPricingEntry{
			Unit:   req.Unit,
			Ratios: req.Ratios,
		}
		encoded, err := common.Marshal(entry)
		if err != nil {
			return nil, err
		}
		next[modelName] = encoded
		finalEntry = &entry
	}

	jsonStr, err := common.Marshal(next)
	if err != nil {
		return nil, err
	}
	if err := model.UpdateOption("ModelPricing", string(jsonStr)); err != nil {
		return nil, err
	}
	return finalEntry, nil
}

// isEmptyPricingPayload 判断 unit 与 ratios 是否同时视为空（触发删除）。
func isEmptyPricingPayload(req modelPricingPatchRequest) bool {
	if strings.TrimSpace(req.Unit) != "" {
		return false
	}
	return isEmptyRawJSON(req.Ratios)
}

// isEmptyRawJSON 判断 RawMessage 是否为空 / null / 空对象 / 空数组。
func isEmptyRawJSON(raw json.RawMessage) bool {
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" {
		return true
	}
	switch trimmed {
	case "null", "{}", "[]":
		return true
	}
	return false
}
