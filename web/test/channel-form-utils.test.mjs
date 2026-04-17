import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BREAKER_DEFAULTS,
  buildChannelSubmitRequest,
  createChannelFormDefaults,
  deserializeChannelForm,
} from '../src/aurora/pages/admin/channel-form-page/channel-form-utils.js';

test('createChannelFormDefaults 提供 Aurora 创建页初始值', () => {
  const defaults = createChannelFormDefaults();

  assert.equal(defaults.type, 1);
  assert.deepEqual(defaults.groups, ['default']);
  assert.deepEqual(
    defaults.breaker_error_types,
    BREAKER_DEFAULTS.breaker_error_types,
  );
  assert.equal(defaults.auto_ban, true);
});

test('deserializeChannelForm 兼容旧版 models/group/setting/settings 结构', () => {
  const result = deserializeChannelForm({
    type: 45,
    models: 'doubao-pro-32k, doubao-lite-4k',
    group: 'default,vip',
    model_mapping: '{"doubao-pro-32k":"doubao-pro-2025"}',
    setting: JSON.stringify({
      proxy: 'http://127.0.0.1:7890',
      system_prompt: 'hello',
      image_url_supported: false,
    }),
    settings: JSON.stringify({
      upstream_model_update_check_enabled: true,
      breaker_enabled: true,
      breaker_error_types: ['429'],
    }),
    channel_info: {
      is_multi_key: true,
      multi_key_mode: 'polling',
    },
  });

  assert.deepEqual(result.form.models, ['doubao-pro-32k', 'doubao-lite-4k']);
  assert.deepEqual(result.form.groups, ['default', 'vip']);
  assert.equal(result.form.proxy, 'http://127.0.0.1:7890');
  assert.equal(result.form.image_url_unsupported, true);
  assert.equal(result.form.upstream_model_update_check_enabled, true);
  assert.equal(result.form.breaker_enabled, true);
  assert.equal(result.meta.multiToSingle, true);
  assert.equal(result.meta.multiKeyMode, 'polling');
});

test('buildChannelSubmitRequest 为创建页生成旧版兼容 payload', () => {
  const request = buildChannelSubmitRequest({
    form: {
      ...createChannelFormDefaults(),
      name: 'Aurora Create',
      key: 'sk-test',
      models: ['gpt-4.1-mini'],
      groups: ['default', 'vip'],
      model_mapping: '{"gpt-4.1":"gpt-4.1-mini"}',
      status_code_mapping: '{"400":"500"}',
      upstream_model_update_check_enabled: true,
      upstream_model_update_auto_sync_enabled: true,
      upstream_model_update_ignored_models: 'foo,bar',
      breaker_enabled: true,
      breaker_error_types: ['429'],
      system_prompt: 'system',
    },
    isEdit: false,
    channelId: undefined,
    batch: true,
    multiToSingle: true,
    multiKeyMode: 'polling',
    isMultiKeyChannel: false,
    keyMode: 'append',
  });

  assert.equal(request.method, 'post');
  assert.equal(request.payload.mode, 'multi_to_single');
  assert.equal(request.payload.multi_key_mode, 'polling');
  assert.equal(request.payload.channel.group, 'default,vip');
  assert.equal(request.payload.channel.models, 'gpt-4.1-mini,gpt-4.1');

  const setting = JSON.parse(request.payload.channel.setting);
  const settings = JSON.parse(request.payload.channel.settings);
  assert.equal(setting.system_prompt, 'system');
  assert.equal(settings.upstream_model_update_auto_sync_enabled, true);
  assert.deepEqual(settings.upstream_model_update_ignored_models, [
    'foo',
    'bar',
  ]);
  assert.deepEqual(settings.breaker_error_types, ['429']);
});

test('buildChannelSubmitRequest 拒绝非法状态码映射', () => {
  assert.throws(
    () =>
      buildChannelSubmitRequest({
        form: {
          ...createChannelFormDefaults(),
          name: 'bad',
          key: 'sk-test',
          models: ['gpt-4.1-mini'],
          status_code_mapping: '{"foo":"500"}',
        },
        isEdit: false,
        channelId: undefined,
        batch: false,
        multiToSingle: false,
        multiKeyMode: 'random',
        isMultiKeyChannel: false,
        keyMode: 'append',
      }),
    /状态码复写包含无效的状态码/,
  );
});
