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
WHERE model_name = 'doubao-seedream-4-0-250828';

COMMIT;
