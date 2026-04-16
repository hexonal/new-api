/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TASK_COLUMN_CONFIG,
  buildTaskDetailItems,
  getTaskDetailPanelValue,
  getTaskListDetailAction,
  getTaskProgressInfo,
  getTaskPreviewActionMeta,
  getTaskTypeMeta,
  resolveTaskPreview,
} from './task-log-utils.js';

function createElementStub() {
  return {
    style: {},
    children: [],
    setAttribute() {},
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    removeChild() {},
    addEventListener() {},
    removeEventListener() {},
    getContext() {
      return {};
    },
    getElementsByTagName() {
      return [];
    },
    cloneNode() {
      return createElementStub();
    },
  };
}

if (!globalThis.window) {
  globalThis.window = globalThis;
}

if (!globalThis.document) {
  globalThis.document = {
    body: createElementStub(),
    head: createElementStub(),
    createElement: createElementStub,
    createElementNS() {
      return createElementStub();
    },
    getElementsByTagName() {
      return [];
    },
    querySelector() {
      return null;
    },
  };
}

if (!globalThis.navigator) {
  globalThis.navigator = { userAgent: 'bun' };
}

if (!globalThis.self) {
  globalThis.self = globalThis;
}

const t = (value) => value;

test('getTaskTypeMeta prefers image model semantics over raw input type', () => {
  const meta = getTaskTypeMeta(
    {
      model_name: 'gpt-image-1',
      properties: { input: 'image' },
    },
    t,
  );

  assert.equal(meta.label, '图生图');
});

test('getTaskTypeMeta prefers properties.input for video tasks to preserve old UI semantics', () => {
  const meta = getTaskTypeMeta(
    {
      action: 'textGenerate',
      properties: { input: 'text' },
      model_name: 'kling-v1-6',
    },
    t,
  );

  assert.equal(meta.label, '文本');
});

test('getTaskTypeMeta falls back to hailuo model heuristics when input type is absent', () => {
  const meta = getTaskTypeMeta(
    {
      model_name: 'MiniMax-Hailuo-2.3-Fast',
      properties: {},
    },
    t,
  );

  assert.equal(meta.label, '文生视频');
});

test('resolveTaskPreview reads nested task_result media urls', () => {
  const preview = resolveTaskPreview({
    status: 'SUCCESS',
    action: 'textGenerate',
    model_name: 'kling-v1-6',
    data: {
      data: {
        task_result: {
          videos: [{ url: 'https://example.com/result.mp4' }],
        },
      },
    },
  });

  assert.deepEqual(preview, {
    kind: 'video',
    value: 'https://example.com/result.mp4',
  });
});

test('getTaskPreviewActionMeta returns detail action when only fail reason exists', () => {
  const meta = getTaskPreviewActionMeta(
    {
      status: 'FAILURE',
      fail_reason: 'provider timeout',
    },
    t,
  );

  assert.deepEqual(meta, {
    label: '点击查看详情',
    kind: 'detail',
  });
});

test('getTaskListDetailAction returns audio payload for suno success records', () => {
  const clips = [{ id: 'clip_1', audio_url: 'https://example.com/a.mp3' }];

  assert.deepEqual(
    getTaskListDetailAction({
      platform: 'suno',
      status: 'SUCCESS',
      data: clips,
    }),
    {
      type: 'audio',
      payload: clips,
    },
  );
});

test('getTaskListDetailAction returns image result url for image models', () => {
  assert.deepEqual(
    getTaskListDetailAction({
      status: 'SUCCESS',
      model_name: 'gpt-image-1',
      result_url: 'https://example.com/result.png',
    }),
    {
      type: 'image',
      payload: 'https://example.com/result.png',
    },
  );
});

test('getTaskListDetailAction returns video result url for video tasks', () => {
  assert.deepEqual(
    getTaskListDetailAction({
      status: 'SUCCESS',
      action: 'textGenerate',
      model_name: 'kling-v1-6',
      result_url: 'https://example.com/result.mp4',
    }),
    {
      type: 'video',
      payload: 'https://example.com/result.mp4',
    },
  );
});

test('getTaskListDetailAction returns text payload when only fail reason exists', () => {
  assert.deepEqual(
    getTaskListDetailAction({
      status: 'FAILURE',
      fail_reason: 'provider timeout',
    }),
    {
      type: 'text',
      payload: 'provider timeout',
    },
  );
});

test('getTaskListDetailAction returns none when no preview or detail exists', () => {
  assert.deepEqual(
    getTaskListDetailAction({
      status: 'SUCCESS',
      model_name: 'unknown-model',
    }),
    {
      type: 'none',
      payload: null,
    },
  );
});

test('getTaskDetailPanelValue prefers upstream data payload for separated detail panel', () => {
  assert.deepEqual(
    getTaskDetailPanelValue({
      data: { code: 0, message: 'ok' },
      fail_reason: 'provider timeout',
    }),
    { code: 0, message: 'ok' },
  );
});

test('TASK_COLUMN_CONFIG matches legacy task log columns', () => {
  assert.deepEqual(
    TASK_COLUMN_CONFIG.map((column) => column.key),
    [
      'submit_time',
      'finish_time',
      'duration',
      'channel',
      'username',
      'platform',
      'type',
      'model',
      'task_id',
      'task_status',
      'progress',
      'fail_reason',
    ],
  );
});

test('getTaskProgressInfo keeps legacy non-numeric progress text', () => {
  assert.deepEqual(getTaskProgressInfo('排队中'), {
    displayText: '排队中',
    numericValue: null,
  });
});

test('buildTaskDetailItems keeps legacy field set and merges consumed model', () => {
  const detailItems = buildTaskDetailItems(
    {
      submit_time: 1710000000,
      finish_time: 1710000061,
      channel_name: 'Kling AI',
      username: 'tester',
      platform: 4,
      properties: {
        input: 'text,image',
        origin_model_name: 'kling-v1-6',
      },
      consumed_model: 'kling-v1-6-master',
      task_id: 'task_123',
      status: 'SUCCESS',
      progress: '100%',
      fail_reason: 'https://example.com/result.mp4',
    },
    true,
    t,
  );

  assert.deepEqual(
    detailItems.map((item) => item.label),
    [
      '提交时间',
      '结束时间',
      '花费时间',
      '渠道',
      '用户',
      '平台',
      '类型',
      '模型',
      '任务ID',
      '任务状态',
      '进度',
      '详情',
    ],
  );
  assert.equal(detailItems[7].value, 'kling-v1-6\n消耗模型: kling-v1-6-master');
  assert.equal(detailItems[9].value, '成功');
  assert.equal(detailItems[11].value, 'JSON 面板');
});
