package constant

type TaskPlatform string

const (
	TaskPlatformSuno       TaskPlatform = "suno"
	TaskPlatformMidjourney              = "mj"
	TaskPlatformImage                   = "image"
)

const (
	SunoActionMusic  = "MUSIC"
	SunoActionLyrics = "LYRICS"

	TaskActionGenerate          = "generate"
	TaskActionTextGenerate      = "textGenerate"
	TaskActionFirstTailGenerate = "firstTailGenerate"
	TaskActionReferenceGenerate = "referenceGenerate"
	TaskActionRemix             = "remixGenerate"
	TaskActionImageGenerate     = "imageGenerate"
)

var SunoModel2Action = map[string]string{
	"suno_music":  SunoActionMusic,
	"suno_lyrics": SunoActionLyrics,
}

// MaxLocalImageReclaimCount 本地 image worker 超时重试次数上限，超过即永久失败 + 退款
const MaxLocalImageReclaimCount = 3

// LocalImageLeaseTimeoutSeconds 本地 image worker 租约超时时间，超时后任务可被 reclaim。
const LocalImageLeaseTimeoutSeconds int64 = 120
