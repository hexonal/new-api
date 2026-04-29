package openai_image_task

const ChannelName = "openai_image_task"

// ModelList is empty by design. This channel type is generic, so any image
// model configured on the channel.models field is accepted.
var ModelList = []string{}

// Upstream status strings observed from POST /v1/images and GET /v1/images/{task_id}.
const (
	statusQueued     = "queued"
	statusProcessing = "processing"
	statusInProgress = "in_progress"
	statusRunning    = "running"
	statusSucceeded  = "succeeded"
	statusCompleted  = "completed"
	statusFailed     = "failed"
	statusCancelled  = "cancelled"
)
