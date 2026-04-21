# IMA-Pro Novideo Resolution Cases

Purpose:
- Verify `ima-pro` novideo billing SKU selection for `metadata.resolution`, `size`, `metadata.size`, and default resolution.
- These cases do not include reference video input, so all expected SKUs use `novideo`.
- Replace `BASE_URL` and `API_KEY` before running.

```bash
export BASE_URL='http://123.56.96.202:3000'
export API_KEY='sk-REPLACE_ME'
```

Expected pricing:

| Case | Input | Expected SKU | Rate |
|---|---|---|---|
| N01 | `metadata.resolution=480p` | `ima-pro-novideo-480p` | `$7.0 / 1M tokens` |
| N02 | `metadata.resolution=720p` | `ima-pro-novideo-720p` | `$7.0 / 1M tokens` |
| N03 | `metadata.resolution=1080p` | `ima-pro-novideo-1080p` | `$7.7 / 1M tokens` |
| N04 | no `size`, no `metadata.resolution` | `ima-pro-novideo-720p` | `$7.0 / 1M tokens` |
| N05 | `size=854x480` | invalid ratio negative case | no billing |
| N06 | `metadata.size=1920×1080` | `ima-pro-novideo-1080p` | `$7.7 / 1M tokens` |
| N07 | `size=1280x720` | `ima-pro-novideo-720p` | `$7.0 / 1M tokens` |
| N08 | `size=1920*1080` | `ima-pro-novideo-1080p` | `$7.7 / 1M tokens` |
| N09 | `size=2K` + `metadata.resolution=480p` | `ima-pro-novideo-480p` | `$7.0 / 1M tokens` |

## N01: metadata.resolution=480p

```bash
curl -sS "$BASE_URL/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ima-pro",
    "prompt": "清晨城市延时摄影，暖色调，电影感。",
    "duration": 4,
    "metadata": {
      "resolution": "480p",
      "aspect_ratio": "16:9",
      "audio": false
    }
  }'
```

Expected SKU: `ima-pro-novideo-480p`

## N02: metadata.resolution=720p

```bash
curl -sS "$BASE_URL/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ima-pro",
    "prompt": "清晨城市延时摄影，暖色调，电影感。",
    "duration": 4,
    "metadata": {
      "resolution": "720p",
      "aspect_ratio": "16:9",
      "audio": false
    }
  }'
```

Expected SKU: `ima-pro-novideo-720p`

## N03: metadata.resolution=1080p

```bash
curl -sS "$BASE_URL/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ima-pro",
    "prompt": "清晨城市延时摄影，暖色调，电影感。",
    "duration": 4,
    "metadata": {
      "resolution": "1080p",
      "aspect_ratio": "16:9",
      "audio": false
    }
  }'
```

Expected SKU: `ima-pro-novideo-1080p`

## N04: default resolution

No `size` and no `metadata.resolution`; adaptor default is `720p`.

```bash
curl -sS "$BASE_URL/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ima-pro",
    "prompt": "清晨城市延时摄影，暖色调，电影感。",
    "duration": 4,
    "metadata": {
      "aspect_ratio": "16:9",
      "audio": false
    }
  }'
```

Expected SKU: `ima-pro-novideo-720p`

## N05: size=854x480 invalid ratio negative case

`854x480` is not an exact `16:9` size. It normalizes to `427:240`, so the request is rejected before task creation with `ratio is invalid: 427:240`.

Expected result:
- submit fails
- no `task_id`
- no SKU billing
- no consume log

```bash
curl -sS "$BASE_URL/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ima-pro",
    "prompt": "清晨城市延时摄影，暖色调，电影感。",
    "duration": 4,
    "size": "854x480",
    "metadata": {
      "audio": false
    }
  }'
```

Expected error: `ratio is invalid: 427:240`

## N06: metadata.size=1920×1080

```bash
curl -sS "$BASE_URL/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ima-pro",
    "prompt": "清晨城市延时摄影，暖色调，电影感。",
    "duration": 4,
    "metadata": {
      "size": "1920×1080",
      "audio": false
    }
  }'
```

Expected SKU: `ima-pro-novideo-1080p`

## N07: size=1280x720

```bash
curl -sS "$BASE_URL/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ima-pro",
    "prompt": "清晨城市延时摄影，暖色调，电影感。",
    "duration": 4,
    "size": "1280x720",
    "metadata": {
      "audio": false
    }
  }'
```

Expected SKU: `ima-pro-novideo-720p`

## N08: size=1920*1080

```bash
curl -sS "$BASE_URL/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ima-pro",
    "prompt": "清晨城市延时摄影，暖色调，电影感。",
    "duration": 4,
    "size": "1920*1080",
    "metadata": {
      "audio": false
    }
  }'
```

Expected SKU: `ima-pro-novideo-1080p`

## N09: size fallback to metadata.resolution

`size=2K` is not a `WxH` size, so billing should fall back to `metadata.resolution=480p`.

```bash
curl -sS "$BASE_URL/v1/videos" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ima-pro",
    "prompt": "清晨城市延时摄影，暖色调，电影感。",
    "duration": 4,
    "size": "2K",
    "metadata": {
      "resolution": "480p",
      "aspect_ratio": "16:9",
      "audio": false
    }
  }'
```

Expected SKU: `ima-pro-novideo-480p`
