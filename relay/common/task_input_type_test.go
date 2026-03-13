package common

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDescribeTaskInputType(t *testing.T) {
	tests := []struct {
		name string
		req  TaskSubmitReq
		want string
	}{
		{
			name: "text only",
			req: TaskSubmitReq{
				Prompt: "make a video",
			},
			want: "text",
		},
		{
			name: "text and image",
			req: TaskSubmitReq{
				Prompt: "make a video",
				Images: []string{"https://example.com/img.png"},
			},
			want: "text,image",
		},
		{
			name: "image and video",
			req: TaskSubmitReq{
				Image: "https://example.com/img.png",
				Metadata: map[string]interface{}{
					"reference_video_urls": []string{"https://example.com/video.mp4"},
				},
			},
			want: "image,video",
		},
		{
			name: "all modalities",
			req: TaskSubmitReq{
				Prompt: "make a video",
				Images: []string{"https://example.com/img.png"},
				Metadata: map[string]interface{}{
					"reference_video_urls": []any{
						"https://example.com/video.mp4",
					},
					"reference_audio_urls": []any{
						map[string]any{"url": "https://example.com/audio.mp3"},
					},
				},
			},
			want: "text,image,video,audio",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, DescribeTaskInputType(tt.req))
		})
	}
}
