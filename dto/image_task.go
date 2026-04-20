package dto

type ImageTaskPublicResponse struct {
	ID          string       `json:"id"`
	Object      string       `json:"object"`
	Status      string       `json:"status"`
	Model       string       `json:"model,omitempty"`
	CreatedAt   int64        `json:"created_at"`
	CompletedAt int64        `json:"completed_at,omitempty"`
	Result      *ImageResult `json:"result,omitempty"`
	Error       *ImageError  `json:"error,omitempty"`
	Usage       *ImageUsage  `json:"usage,omitempty"`
}

type ImageResult struct {
	Data []ImageResultItem `json:"data"`
}

type ImageResultItem struct {
	URL     string `json:"url,omitempty"`
	B64JSON string `json:"b64_json,omitempty"`
}

type ImageError struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Retryable bool   `json:"retryable,omitempty"`
}

type ImageUsage struct {
	TotalTokens int `json:"total_tokens,omitempty"`
}
