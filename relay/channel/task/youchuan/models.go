package youchuan

// DiffusionRequest is the request body for /v1/tob/diffusion (text-to-image).
type DiffusionRequest struct {
	Text        string `json:"text"`
	Version     string `json:"version,omitempty"`
	AspectRatio string `json:"aspect_ratio,omitempty"`
	Mode        string `json:"mode,omitempty"`
	CallbackURL string `json:"callback_url,omitempty"`
}

// YouchuanResponse is the common response structure for both submit and query.
type YouchuanResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		ID     string   `json:"id"`
		Status int      `json:"status"`
		URLs   []string `json:"urls"`
		Cost   float64  `json:"cost"`
		Audit  int      `json:"audit"`
	} `json:"data"`
}

// 悠船任务状态
const (
	StatusQueued     = 0
	StatusProcessing = 1
	StatusSuccess    = 2
	StatusFailed     = 3
	StatusAuditFail  = 4
)
