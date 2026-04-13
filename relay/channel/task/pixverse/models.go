package pixverse

// ── Request structures ───────────────────────────────────────────

// TextToVideoRequest is the primary request body for PixVerse video generation.
// For image-to-video, pass img_id via metadata.
type TextToVideoRequest struct {
	Prompt              string `json:"prompt"`
	Model               string `json:"model"`
	AspectRatio         string `json:"aspect_ratio,omitempty"`
	Duration            int    `json:"duration"`
	Quality             string `json:"quality"`
	NegPrompt           string `json:"negative_prompt,omitempty"`
	MotionMode          string `json:"motion_mode,omitempty"`
	Seed                int    `json:"seed,omitempty"`
	Style               string `json:"style,omitempty"`
	TemplateID          int    `json:"template_id,omitempty"`
	ThinkingType        string `json:"thinking_type,omitempty"`
	ImgID               int    `json:"img_id,omitempty"`
	GenerateAudioSwitch *bool  `json:"generate_audio_switch,omitempty"`
}

// ── Response structures ──────────────────────────────────────────

type PixVerseResponse struct {
	ErrCode int    `json:"ErrCode"`
	ErrMsg  string `json:"ErrMsg"`
	Resp    struct {
		VideoID int64 `json:"video_id"`
	} `json:"Resp"`
}

type VideoResultResponse struct {
	ErrCode int    `json:"ErrCode"`
	ErrMsg  string `json:"ErrMsg"`
	Resp    struct {
		ID           int64       `json:"id"`
		Status       int         `json:"status"`
		URL          string      `json:"url"`
		Prompt       string      `json:"prompt"`
		NegPrompt    string      `json:"negative_prompt"`
		OutputWidth  int         `json:"outputWidth"`
		OutputHeight int         `json:"outputHeight"`
		CreateTime   string      `json:"create_time"`
		ModifyTime   string      `json:"modify_time"`
		Style        string      `json:"style"`
		Seed         int         `json:"seed"`
		Size         interface{} `json:"size"`
	} `json:"Resp"`
}

// PixVerse task status codes
const (
	StatusSuccess    = 1
	StatusProcessing = 5
	StatusModeration = 7
	StatusFailed     = 8
)
