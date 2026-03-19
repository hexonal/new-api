package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

const doubaoAssetBasePath = "/api/v1/doubao/asset"

type AssetProxyClient struct {
	baseURL string
	apiKey  string
	// uid 对应上游要求的字符串用户名。
	uid    string
	client *http.Client
}

func NewAssetProxyClient(channel *model.Channel, uid string) *AssetProxyClient {
	baseURL := ""
	if channel != nil && channel.BaseURL != nil {
		baseURL = strings.TrimRight(*channel.BaseURL, "/")
	}
	apiKey := ""
	if channel != nil {
		apiKey = channel.Key
	}
	return &AssetProxyClient{
		baseURL: baseURL,
		apiKey:  apiKey,
		uid:     strings.TrimSpace(uid),
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *AssetProxyClient) doRequest(ctx context.Context, subPath string, body map[string]any) (*dto.DoubaoData, error) {
	if c == nil || c.baseURL == "" || c.apiKey == "" {
		return nil, fmt.Errorf("asset client is not initialized")
	}
	if body == nil {
		body = map[string]any{}
	}
	uid := c.uid
	if uid == "" {
		return nil, fmt.Errorf("asset uid resolve failed: username is empty")
	}
	if uid != "" {
		// 兼容上游不同字段命名：部分环境要求 uid，部分环境要求 user_id。
		body["uid"] = uid
		body["user_id"] = uid
	}

	payload, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}

	url := c.baseURL + doubaoAssetBasePath + subPath
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var parsed dto.DoubaoResponse
	if err = common.Unmarshal(respBody, &parsed); err != nil {
		return nil, fmt.Errorf("parse doubao response failed: %w", err)
	}

	if parsed.Code != 200 {
		common.SysLog(fmt.Sprintf("doubao asset upstream error: path=%s code=%d log_id=%s uid=%v message=%s", subPath, parsed.Code, parsed.LogID, body["uid"], parsed.Message))
		return nil, fmt.Errorf("doubao asset request failed: %s (code=%d, log_id=%s)", parsed.Message, parsed.Code, parsed.LogID)
	}

	requestID := ""
	if parsed.Data.ResponseMetadata != nil {
		if value, ok := parsed.Data.ResponseMetadata["RequestId"]; ok {
			requestID = fmt.Sprint(value)
		}
		if requestID == "" {
			if value, ok := parsed.Data.ResponseMetadata["request_id"]; ok {
				requestID = fmt.Sprint(value)
			}
		}
	}
	if requestID != "" {
		common.SysLog(fmt.Sprintf("doubao asset response request_id=%s path=%s", requestID, subPath))
	} else {
		common.SysLog(fmt.Sprintf("doubao asset response warning: missing request_id path=%s", subPath))
	}
	if len(bytes.TrimSpace(parsed.Data.Result)) == 0 || bytes.Equal(bytes.TrimSpace(parsed.Data.Result), []byte("null")) {
		common.SysLog(fmt.Sprintf("doubao asset response warning: empty result, request_id=%s path=%s", requestID, subPath))
	}

	return &parsed.Data, nil
}

func (c *AssetProxyClient) CreateAssetGroup(ctx context.Context, req dto.AssetGroupCreateRequest) (*dto.DoubaoAssetGroupResult, error) {
	body := map[string]any{
		"name": req.Name,
	}
	if req.Description != "" {
		body["description"] = req.Description
	}
	if req.GroupType != "" {
		body["group_type"] = req.GroupType
	}
	if req.ProjectName != "" {
		body["project_name"] = req.ProjectName
	}
	resp, err := c.doRequest(ctx, "/group/create", body)
	if err != nil {
		return nil, err
	}
	result := &dto.DoubaoAssetGroupResult{}
	if err = common.Unmarshal(resp.Result, result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *AssetProxyClient) ListAssetGroups(ctx context.Context, req dto.AssetGroupListRequest) (*dto.DoubaoListResult, error) {
	body := map[string]any{}
	if req.Filters != nil {
		body["filters"] = req.Filters
	}
	if req.PageNumber != nil {
		body["page_number"] = *req.PageNumber
	}
	if req.PageSize != nil {
		body["page_size"] = *req.PageSize
	}
	if req.SortBy != "" {
		body["sort_by"] = req.SortBy
	}
	if req.SortOrder != "" {
		body["sort_order"] = req.SortOrder
	}
	if req.ProjectName != "" {
		body["project_name"] = req.ProjectName
	}
	resp, err := c.doRequest(ctx, "/group/list", body)
	if err != nil {
		return nil, err
	}
	result := &dto.DoubaoListResult{}
	if err = common.Unmarshal(resp.Result, result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *AssetProxyClient) GetAssetGroup(ctx context.Context, id string, projectName string) (*dto.DoubaoAssetGroupResult, error) {
	body := map[string]any{"id": id}
	if projectName != "" {
		body["project_name"] = projectName
	}
	resp, err := c.doRequest(ctx, "/group/get", body)
	if err != nil {
		return nil, err
	}
	result := &dto.DoubaoAssetGroupResult{}
	if err = common.Unmarshal(resp.Result, result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *AssetProxyClient) UpdateAssetGroup(ctx context.Context, req dto.AssetGroupUpdateRequest) (*dto.DoubaoIDResult, error) {
	body := map[string]any{"id": req.Id}
	if req.Name != "" {
		body["name"] = req.Name
	}
	if req.Description != "" {
		body["description"] = req.Description
	}
	if req.ProjectName != "" {
		body["project_name"] = req.ProjectName
	}
	resp, err := c.doRequest(ctx, "/group/update", body)
	if err != nil {
		return nil, err
	}
	result := &dto.DoubaoIDResult{}
	if err = common.Unmarshal(resp.Result, result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *AssetProxyClient) CreateAsset(ctx context.Context, req dto.AssetCreateRequest) (*dto.DoubaoIDResult, error) {
	body := map[string]any{
		"group_id": req.GroupId,
		"url":      req.URL,
	}
	if req.Name != "" {
		body["name"] = req.Name
	}
	if req.AssetType != "" {
		body["asset_type"] = req.AssetType
	}
	if req.ProjectName != "" {
		body["project_name"] = req.ProjectName
	}
	resp, err := c.doRequest(ctx, "/create", body)
	if err != nil {
		return nil, err
	}
	result := &dto.DoubaoIDResult{}
	if err = common.Unmarshal(resp.Result, result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *AssetProxyClient) ListAssets(ctx context.Context, req dto.AssetListRequest) (*dto.DoubaoListResult, error) {
	body := map[string]any{}
	if req.Filters != nil {
		body["filters"] = req.Filters
	}
	if req.PageNumber != nil {
		body["page_number"] = *req.PageNumber
	}
	if req.PageSize != nil {
		body["page_size"] = *req.PageSize
	}
	if req.SortBy != "" {
		body["sort_by"] = req.SortBy
	}
	if req.SortOrder != "" {
		body["sort_order"] = req.SortOrder
	}
	if req.ProjectName != "" {
		body["project_name"] = req.ProjectName
	}
	resp, err := c.doRequest(ctx, "/list", body)
	if err != nil {
		return nil, err
	}
	result := &dto.DoubaoListResult{}
	if err = common.Unmarshal(resp.Result, result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *AssetProxyClient) GetAsset(ctx context.Context, id string, projectName string) (*dto.DoubaoAssetResult, error) {
	body := map[string]any{"id": id}
	if projectName != "" {
		body["project_name"] = projectName
	}
	resp, err := c.doRequest(ctx, "/get", body)
	if err != nil {
		return nil, err
	}
	result := &dto.DoubaoAssetResult{}
	if err = common.Unmarshal(resp.Result, result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *AssetProxyClient) UpdateAsset(ctx context.Context, req dto.AssetUpdateRequest) (*dto.DoubaoIDResult, error) {
	body := map[string]any{
		"id":   req.Id,
		"name": req.Name,
	}
	if req.ProjectName != "" {
		body["project_name"] = req.ProjectName
	}
	resp, err := c.doRequest(ctx, "/update", body)
	if err != nil {
		return nil, err
	}
	result := &dto.DoubaoIDResult{}
	if err = common.Unmarshal(resp.Result, result); err != nil {
		return nil, err
	}
	return result, nil
}
