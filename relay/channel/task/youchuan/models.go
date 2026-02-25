package youchuan

// DiffusionRequest is the request body for /v1/tob/diffusion (text-to-image).
// Fields discovered through API testing — the API uses protobuf underneath,
// so only fields defined in the proto schema are accepted.
type DiffusionRequest struct {
	Text string `json:"text"`
}

// YouchuanResponse is the flat response structure from the Youchuan API.
// Used for both submit and query endpoints.
type YouchuanResponse struct {
	ID      string   `json:"id"`
	Text    string   `json:"text"`
	URLs    []string `json:"urls"`
	Status  int      `json:"status"`
	Comment string   `json:"comment"`
	Seed    int      `json:"seed"`
	Cost    any      `json:"cost"`
	Audits  any      `json:"audits"`
	// Error fields (when code != 0)
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// 悠船任务状态
const (
	StatusQueued     = 0
	StatusProcessing = 1
	StatusSuccess    = 2
	StatusFailed     = 3
	StatusAuditFail  = 4
)
