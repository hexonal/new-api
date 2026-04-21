# IMA-Pro With-Video Resolution Cases

Purpose:
- Verify `ima-pro` with-video billing SKU selection for `metadata.reference_video_urls` plus explicit/default output resolution.
- These cases include reference video input, so all expected SKUs use `withvideo`.
- Replace `BASE_URL` and `API_KEY` before running.

```bash
export BASE_URL='http://123.56.96.202:3000'
export API_KEY='sk-REPLACE_ME'
export REF_VIDEO_URL='https://file2.fashionlabs.cn/aiagent/src/d/20260314/in/87b58c9507584c2e6d7fa69a9276e877.mp4'
```

Expected pricing:

| Case | Input | Expected SKU | Rate |
|---|---|---|---|
| V01 | `metadata.reference_video_urls` + `metadata.resolution=480p` | `ima-pro-withvideo-480p` | `$4.3 / 1M tokens` |
| V02 | `metadata.reference_video_urls` + `metadata.resolution=720p` | `ima-pro-withvideo-720p` | `$4.3 / 1M tokens` |
| V03 | `metadata.reference_video_urls` + `metadata.resolution=1080p` | `ima-pro-withvideo-1080p` | `$4.7 / 1M tokens` |
| V04 | `metadata.reference_video_urls`, no `size`, no `metadata.resolution` | `ima-pro-withvideo-720p` | `$4.3 / 1M tokens` |

Notes:
- `withvideo` is selected only when `metadata.reference_video_urls`, `metadata.reference_video_url`, `metadata.video_urls`, or `metadata.video_url` is non-empty.
- `images` do not count as with-video billing input; image-only or text+image requests use `novideo`.
- When no valid `size` or `metadata.resolution` is provided, the adaptor default output resolution is `720p`, so billing should hit `-720p`.
- The default `REF_VIDEO_URL` is an overseas-friendly video candidate verified by HEAD/ffprobe as `video/mp4`, `1280x720`, about `10.04s`.

## V01: with-video metadata.resolution=480p

```bash
curl -sS "$BASE_URL/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"ima-pro\",
    \"prompt\": \"参考视频风格，生成清晨城市延时摄影，暖色调，电影感。\",
    \"duration\": 4,
    \"metadata\": {
      \"resolution\": \"480p\",
      \"aspect_ratio\": \"16:9\",
      \"audio\": false,
      \"reference_video_urls\": [
        \"$REF_VIDEO_URL\"
      ]
    }
  }"
```

Expected SKU: `ima-pro-withvideo-480p`

## V02: with-video metadata.resolution=720p

```bash
curl -sS "$BASE_URL/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"ima-pro\",
    \"prompt\": \"参考视频风格，生成清晨城市延时摄影，暖色调，电影感。\",
    \"duration\": 4,
    \"metadata\": {
      \"resolution\": \"720p\",
      \"aspect_ratio\": \"16:9\",
      \"audio\": false,
      \"reference_video_urls\": [
        \"$REF_VIDEO_URL\"
      ]
    }
  }"
```

Expected SKU: `ima-pro-withvideo-720p`

## V03: with-video metadata.resolution=1080p

```bash
curl -sS "$BASE_URL/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"ima-pro\",
    \"prompt\": \"参考视频风格，生成清晨城市延时摄影，暖色调，电影感。\",
    \"duration\": 4,
    \"metadata\": {
      \"resolution\": \"1080p\",
      \"aspect_ratio\": \"16:9\",
      \"audio\": false,
      \"reference_video_urls\": [
        \"$REF_VIDEO_URL\"
      ]
    }
  }"
```

Expected SKU: `ima-pro-withvideo-1080p`

## V04: with-video default resolution

No `size` and no `metadata.resolution`; adaptor default is `720p`.

```bash
curl -sS "$BASE_URL/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"ima-pro\",
    \"prompt\": \"参考视频风格，生成清晨城市延时摄影，暖色调，电影感。\",
    \"duration\": 4,
    \"metadata\": {
      \"aspect_ratio\": \"16:9\",
      \"audio\": false,
      \"reference_video_urls\": [
        \"$REF_VIDEO_URL\"
      ]
    }
  }"
```

Expected SKU: `ima-pro-withvideo-720p`
