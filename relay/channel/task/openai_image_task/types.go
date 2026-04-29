package openai_image_task

// submitResponse mirrors ai-router POST /v1/images return body.
type submitResponse struct {
	ID        string `json:"id,omitempty"`
	TaskID    string `json:"task_id,omitempty"`
	Object    string `json:"object,omitempty"`
	Model     string `json:"model,omitempty"`
	Status    string `json:"status,omitempty"`
	CreatedAt int64  `json:"created_at,omitempty"`
}

// fetchData is the inner data envelope for ai-router GET /v1/images/{task_id}.
type fetchData struct {
	TaskID    string  `json:"task_id,omitempty"`
	Status    string  `json:"status,omitempty"`
	URL       string  `json:"url,omitempty"`
	Format    string  `json:"format,omitempty"`
	Error     *string `json:"error,omitempty"`
	AmountUSD float64 `json:"amount_usd,omitempty"`
}

// fetchResponse wraps fetchData under {code, message, data}.
type fetchResponse struct {
	Code    string    `json:"code,omitempty"`
	Message string    `json:"message,omitempty"`
	Data    fetchData `json:"data,omitempty"`
}
