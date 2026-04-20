package local_image

import (
	"bytes"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

type TaskAdaptor struct {
	ChannelType int
}

type taskResponse struct {
	Code    int    `json:"code"`
	TaskID  string `json:"task_id"`
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
	URL     string `json:"url,omitempty"`
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	if info != nil && info.ChannelMeta != nil {
		a.ChannelType = info.ChannelMeta.ChannelType
	}
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	return nil
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return "", nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	if c == nil || c.Request == nil {
		return nil, nil
	}
	body, err := common.GetRequestBody(c)
	if err != nil {
		return nil, err
	}
	readBody, ok := body.(io.ReadSeeker)
	if !ok {
		return nil, io.ErrUnexpectedEOF
	}
	if _, err = readBody.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	c.Request.Body = io.NopCloser(readBody)
	return readBody, nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	publicID := ""
	if info != nil && info.TaskRelayInfo != nil {
		publicID = info.TaskRelayInfo.PublicTaskID
	}
	reqBytes := make([]byte, 0)
	if requestBody != nil {
		readBytes, err := io.ReadAll(requestBody)
		if err != nil {
			return nil, err
		}
		reqBytes = readBytes
	}
	if len(reqBytes) == 0 && c != nil && c.Request != nil && c.Request.Body != nil {
		readBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			return nil, err
		}
		reqBytes = readBytes
		c.Request.Body = io.NopCloser(bytes.NewReader(reqBytes))
	}
	if c != nil {
		c.Set("image_input_request", reqBytes)
	}

	respBody, err := common.Marshal(taskResponse{
		Code:   0,
		TaskID: "local_" + publicID,
		Status: string(model.TaskStatusSubmitted),
	})
	if err != nil {
		return nil, err
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(respBody)),
		Header:     http.Header{"Content-Type": []string{"application/json"}},
	}, nil
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, err *dto.TaskError) {
	taskData, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return "", nil, &dto.TaskError{
			Code:    "read_response_body_failed",
			Message: readErr.Error(),
		}
	}
	_ = resp.Body.Close()

	var parsed taskResponse
	if unmarshalErr := common.Unmarshal(taskData, &parsed); unmarshalErr != nil {
		return "", taskData, &dto.TaskError{
			Code:    "unmarshal_response_body_failed",
			Message: unmarshalErr.Error(),
		}
	}
	if parsed.TaskID == "" {
		return "", taskData, &dto.TaskError{
			Code:    "invalid_task_id",
			Message: "empty task_id in response",
		}
	}
	publicID := ""
	if info != nil && info.TaskRelayInfo != nil {
		publicID = info.TaskRelayInfo.PublicTaskID
	}
	return "local_" + publicID, taskData, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	rawID, _ := body["task_id"].(string)
	publicID := strings.TrimPrefix(rawID, "local_")
	task := model.GetTaskByTaskID(publicID)
	if task == nil {
		failBody, err := common.Marshal(taskResponse{
			Code:    1,
			TaskID:  rawID,
			Status:  string(model.TaskStatusFailure),
			Message: "task not found",
		})
		if err != nil {
			return nil, err
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(bytes.NewReader(failBody)),
			Header:     http.Header{"Content-Type": []string{"application/json"}},
		}, nil
	}

	respBody, err := common.Marshal(taskResponse{
		Code:   0,
		TaskID: rawID,
		Status: string(task.Status),
		URL:    task.PrivateData.ResultURL,
	})
	if err != nil {
		return nil, err
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(respBody)),
		Header:     http.Header{"Content-Type": []string{"application/json"}},
	}, nil
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var parsed taskResponse
	if err := common.Unmarshal(respBody, &parsed); err != nil {
		return nil, err
	}
	return &relaycommon.TaskInfo{
		Code:   parsed.Code,
		TaskID: parsed.TaskID,
		Status: parsed.Status,
		Url:    parsed.URL,
		Reason: parsed.Message,
	}, nil
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	return nil
}

func (a *TaskAdaptor) AdjustBillingOnSubmit(info *relaycommon.RelayInfo, taskData []byte) map[string]float64 {
	return nil
}

func (a *TaskAdaptor) AdjustBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int {
	return 0
}

func (a *TaskAdaptor) GetModelList() []string {
	return nil
}

func (a *TaskAdaptor) GetChannelName() string {
	return "local_image"
}
