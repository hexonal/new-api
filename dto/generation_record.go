package dto

// GenerationOutputDTO 单个产物
type GenerationOutputDTO struct {
	Type  string `json:"type"`
	URL   string `json:"url"`
	Index int    `json:"index"`
}

// GenerationRecordDTO 对外暴露的生成记录 DTO
type GenerationRecordDTO struct {
	ID               int64                 `json:"id"`
	Kind             string                `json:"kind"`
	Status           string                `json:"status"`
	Model            string                `json:"model"`
	Platform         string                `json:"platform,omitempty"`
	TaskID           string                `json:"task_id,omitempty"`
	RequestID        string                `json:"request_id,omitempty"`
	InputPreview     string                `json:"input_preview,omitempty"`
	Outputs          []GenerationOutputDTO `json:"outputs"`
	Quota            int                   `json:"quota"`
	PromptTokens     int                   `json:"prompt_tokens,omitempty"`
	CompletionTokens int                   `json:"completion_tokens,omitempty"`
	TotalTokens      int                   `json:"total_tokens,omitempty"`
	ErrorMessage     string                `json:"error_message,omitempty"`
	Refunded         bool                  `json:"refunded"`
	RefundedQuota    int                   `json:"refunded_quota,omitempty"`
	SubmitTime       int64                 `json:"submit_time"`
	StartTime        int64                 `json:"start_time,omitempty"`
	FinishTime       int64                 `json:"finish_time,omitempty"`
}
