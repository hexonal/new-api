-- Clean up disabled media channels/models and normalize media model tags.
-- Intended for PostgreSQL deployments.

BEGIN;

-- Remove disabled legacy video channel and its stale abilities.
DELETE FROM abilities WHERE channel_id = 18;
DELETE FROM channels WHERE id = 18 AND status = 0;

-- Remove orphaned unavailable sora-2 model metadata if no active ability remains.
DELETE FROM abilities WHERE model = 'sora-2' AND channel_id <> 29;
DELETE FROM models
WHERE model_name = 'sora-2'
  AND NOT EXISTS (
    SELECT 1
    FROM abilities
    WHERE abilities.model = 'sora-2'
      AND abilities.enabled = true
  );

-- Normalize tags for active image/video models shown in model management.
UPDATE models
SET tags = '视频,文生视频,Veo,Google'
WHERE model_name IN ('veo_3_1', 'veo_3_1-fast', 'veo_3_1-portrait-fast');

UPDATE models
SET tags = '图片,文生图,即梦'
WHERE model_name IN ('jimeng-4.0', 'jimeng-4.1', 'jimeng-4.5');

UPDATE models
SET tags = '图片,文生图,豆包,ByteDance'
WHERE model_name IN (
    'doubao-seedream-4-0-250828',
    'doubao-seedream-4-5-251128'
);

UPDATE models
SET tags = CASE
    WHEN tags IS NULL OR btrim(tags) = '' THEN 'nsfw'
    WHEN lower(',' || regexp_replace(tags, '[[:space:]]+', '', 'g') || ',') LIKE '%,nsfw,%' THEN tags
    ELSE tags || ',nsfw'
END
WHERE model_name IN (
    'doubao-seedream-4-5-251128',
    'wan2.6-t2v',
    'wan2.6-i2v',
    'wan2.6-i2v-flash',
    'wan2.6-r2v',
    'wan2.6-t2i',
    'wan2.6-image'
);

UPDATE channels
SET models = CASE
    WHEN models IS NULL OR btrim(models) = '' THEN 'doubao-seedream-4-5-251128'
    WHEN ',' || regexp_replace(models, '[[:space:]]+', '', 'g') || ',' LIKE '%,doubao-seedream-4-5-251128,%' THEN models
    ELSE models || ',doubao-seedream-4-5-251128'
END
WHERE name = 'ai-router-internal'
  AND status = 1
  AND deleted_at IS NULL;

INSERT INTO abilities ("group", model, channel_id, enabled, priority, weight, tag)
SELECT 'default', 'doubao-seedream-4-5-251128', c.id, true, 0, 0, NULL
FROM channels c
WHERE c.name = 'ai-router-internal'
  AND c.deleted_at IS NULL
  AND c.status = 1
  AND ',' || regexp_replace(c.models, '[[:space:]]+', '', 'g') || ',' LIKE '%,doubao-seedream-4-5-251128,%'
  AND NOT EXISTS (
      SELECT 1
      FROM abilities a
      WHERE a."group" = 'default'
        AND a.model = 'doubao-seedream-4-5-251128'
        AND a.channel_id = c.id
  );

INSERT INTO options (key, value)
VALUES (
    'ModelNSFWMap',
    '{"doubao-seedream-4-5-251128":true,"wan2.6-t2v":true,"wan2.6-i2v":true,"wan2.6-i2v-flash":true,"wan2.6-r2v":true,"wan2.6-t2i":true,"wan2.6-image":true}'
)
ON CONFLICT (key) DO UPDATE
SET value = (
    COALESCE(NULLIF(options.value, ''), '{}')::jsonb ||
    EXCLUDED.value::jsonb
)::text;

-- Persist public OSS icon URLs and vendor metadata for media models.
UPDATE vendors
SET icon = 'https://oss.axis-ai.dev/oss/aigc-model-icons/seedance.svg',
    updated_time = EXTRACT(EPOCH FROM NOW())::bigint
WHERE deleted_at IS NULL
  AND name = 'ByteDance';

UPDATE vendors
SET icon = 'https://oss.axis-ai.dev/oss/aigc-model-icons/nano-2.png',
    updated_time = EXTRACT(EPOCH FROM NOW())::bigint
WHERE deleted_at IS NULL
  AND name = 'Google';

INSERT INTO vendors (name, description, icon, status, created_time, updated_time)
SELECT
    'Alibaba',
    'Alibaba image and video generation models',
    'https://oss.axis-ai.dev/oss/aigc-model-icons/wan-2.png',
    1,
    EXTRACT(EPOCH FROM NOW())::bigint,
    EXTRACT(EPOCH FROM NOW())::bigint
WHERE NOT EXISTS (
    SELECT 1
    FROM vendors
    WHERE deleted_at IS NULL
      AND name = 'Alibaba'
);

UPDATE vendors
SET description = 'Alibaba image and video generation models',
    icon = 'https://oss.axis-ai.dev/oss/aigc-model-icons/wan-2.png',
    status = 1,
    updated_time = EXTRACT(EPOCH FROM NOW())::bigint
WHERE deleted_at IS NULL
  AND name = 'Alibaba';

UPDATE models
SET vendor_id = (
        SELECT id
        FROM vendors
        WHERE deleted_at IS NULL
          AND name = 'ByteDance'
        ORDER BY id
        LIMIT 1
    ),
    icon = 'https://oss.axis-ai.dev/oss/aigc-model-icons/seedance.svg',
    updated_time = EXTRACT(EPOCH FROM NOW())::bigint
WHERE deleted_at IS NULL
  AND model_name IN (
      'doubao-seedream-4-0-250828',
      'doubao-seedream-4-5-251128',
      'doubao-seedream-5-0-lite-260128',
      'seedance-2.0',
      'seedance-2.0-fast'
  );

UPDATE models
SET vendor_id = (
        SELECT id
        FROM vendors
        WHERE deleted_at IS NULL
          AND name = 'Google'
        ORDER BY id
        LIMIT 1
    ),
    icon = 'https://oss.axis-ai.dev/oss/aigc-model-icons/nano-2.png',
    updated_time = EXTRACT(EPOCH FROM NOW())::bigint
WHERE deleted_at IS NULL
  AND model_name IN (
      'gemini-3-pro-image-preview',
      'gemini-3.1-flash-image-preview'
  );

UPDATE models
SET vendor_id = (
        SELECT id
        FROM vendors
        WHERE deleted_at IS NULL
          AND name = 'Alibaba'
        ORDER BY id
        LIMIT 1
    ),
    icon = 'https://oss.axis-ai.dev/oss/aigc-model-icons/wan-2.png',
    updated_time = EXTRACT(EPOCH FROM NOW())::bigint
WHERE deleted_at IS NULL
  AND model_name IN (
      'wan2.6-t2v',
      'wan2.6-i2v',
      'wan2.6-i2v-flash',
      'wan2.6-r2v',
      'wan2.6-t2i',
      'wan2.6-image',
      'wan2.7-image',
      'wan2.7-image-pro'
  );

COMMIT;
