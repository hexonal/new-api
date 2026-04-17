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

import { collectInvalidStatusCodeEntries } from '../../../../components/table/channels/modals/statusCodeRiskGuard.js';

export const DEFAULT_DOUBAO_BASE_URL = 'https://ark.cn-beijing.volces.com';

export const BREAKER_ERROR_TYPE_OPTIONS = [
  'balance_insufficient',
  'service_unavailable',
  '429',
  '5xx',
  'timeout',
  '524',
];

export const BREAKER_DEFAULTS = {
  breaker_enabled: false,
  breaker_threshold_count: 10,
  breaker_window_seconds: 60,
  breaker_cooldown_seconds: 300,
  breaker_half_open_probe_count: 1,
  breaker_recovery_success_count: 1,
  breaker_error_types: [...BREAKER_ERROR_TYPE_OPTIONS],
};

const BOOLEAN_FIELDS = [
  'auto_ban',
  'is_enterprise_account',
  'allow_service_tier',
  'disable_store',
  'allow_safety_identifier',
  'allow_include_obfuscation',
  'allow_inference_geo',
  'claude_beta_query',
  'upstream_model_update_check_enabled',
  'upstream_model_update_auto_sync_enabled',
  'call_error_alert_enabled',
  'breaker_enabled',
  'force_format',
  'thinking_to_content',
  'image_url_auto_base64',
  'image_url_supported',
  'image_url_unsupported',
  'pass_through_body_enabled',
  'system_prompt_override',
];

const createDefaultValues = () => ({
  name: '',
  type: 1,
  key: '',
  openai_organization: '',
  max_input_tokens: 0,
  base_url: '',
  other: '',
  model_mapping: '',
  param_override: '',
  status_code_mapping: '',
  models: [],
  auto_ban: true,
  test_model: '',
  groups: ['default'],
  priority: 0,
  weight: 0,
  tag: '',
  multi_key_mode: 'random',
  force_format: false,
  thinking_to_content: false,
  image_url_auto_base64: false,
  image_url_supported: true,
  image_url_unsupported: false,
  proxy: '',
  pass_through_body_enabled: false,
  system_prompt: '',
  system_prompt_override: false,
  poll_interval_seconds: 0,
  poll_initial_delay_seconds: 0,
  poll_timeout_hours: 0,
  poll_qps: 0,
  ima_pro_tenant_id: '',
  ima_pro_app_id: '',
  ima_pro_app_kind: '',
  settings: '',
  vertex_key_type: 'json',
  aws_key_type: 'ak_sk',
  is_enterprise_account: false,
  allow_service_tier: false,
  disable_store: false,
  allow_safety_identifier: false,
  allow_include_obfuscation: false,
  allow_inference_geo: false,
  claude_beta_query: false,
  upstream_model_update_check_enabled: false,
  upstream_model_update_auto_sync_enabled: false,
  upstream_model_update_last_check_time: 0,
  upstream_model_update_last_detected_models: [],
  upstream_model_update_ignored_models: '',
  call_error_alert_enabled: false,
  call_error_threshold_count: 10,
  call_error_threshold_window_minutes: 5,
  call_error_cooldown_minutes: '',
  breaker_enabled: false,
  breaker_threshold_count: BREAKER_DEFAULTS.breaker_threshold_count,
  breaker_window_seconds: BREAKER_DEFAULTS.breaker_window_seconds,
  breaker_cooldown_seconds: BREAKER_DEFAULTS.breaker_cooldown_seconds,
  breaker_half_open_probe_count: BREAKER_DEFAULTS.breaker_half_open_probe_count,
  breaker_recovery_success_count:
    BREAKER_DEFAULTS.breaker_recovery_success_count,
  breaker_error_types: [...BREAKER_DEFAULTS.breaker_error_types],
});

function hasText(value) {
  return String(value ?? '').trim() !== '';
}

function toBoolean(value) {
  return value === true || value === 1 || value === '1';
}

function toPositiveInteger(value, fallback) {
  const numericValue = Math.floor(Number(value));
  return Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : fallback;
}

function toNonNegativeInteger(value, fallback) {
  const numericValue = Math.floor(Number(value));
  return Number.isFinite(numericValue) && numericValue >= 0
    ? numericValue
    : fallback;
}

function safeParseJsonObject(raw) {
  if (!hasText(raw)) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    return {};
  }
}

function normalizeStringList(value, fallbackKey) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item.trim();
        }
        if (
          fallbackKey &&
          item &&
          typeof item === 'object' &&
          typeof item[fallbackKey] === 'string'
        ) {
          return item[fallbackKey].trim();
        }
        return String(item ?? '').trim();
      })
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeBreakerErrorTypes(value) {
  const allowedValues = new Set(BREAKER_ERROR_TYPE_OPTIONS);
  return normalizeStringList(value)
    .filter((item) => allowedValues.has(item))
    .filter((item, index, array) => array.indexOf(item) === index);
}

function buildBreakerSettingsFromRaw(settings) {
  const breakerSettings = {
    breaker_enabled: settings.breaker_enabled === true,
    breaker_threshold_count: toPositiveInteger(
      settings.breaker_threshold_count,
      BREAKER_DEFAULTS.breaker_threshold_count,
    ),
    breaker_window_seconds: toPositiveInteger(
      settings.breaker_window_seconds,
      BREAKER_DEFAULTS.breaker_window_seconds,
    ),
    breaker_cooldown_seconds: toNonNegativeInteger(
      settings.breaker_cooldown_seconds,
      BREAKER_DEFAULTS.breaker_cooldown_seconds,
    ),
    breaker_half_open_probe_count: toPositiveInteger(
      settings.breaker_half_open_probe_count,
      BREAKER_DEFAULTS.breaker_half_open_probe_count,
    ),
    breaker_recovery_success_count: toPositiveInteger(
      settings.breaker_recovery_success_count,
      BREAKER_DEFAULTS.breaker_recovery_success_count,
    ),
    breaker_error_types: normalizeBreakerErrorTypes(
      settings.breaker_error_types,
    ),
  };

  if (breakerSettings.breaker_error_types.length === 0) {
    breakerSettings.breaker_error_types = [
      ...BREAKER_DEFAULTS.breaker_error_types,
    ];
  }

  return breakerSettings;
}

function parseSettingFields(channel) {
  const defaults = {
    force_format: false,
    thinking_to_content: false,
    image_url_auto_base64: false,
    image_url_supported: true,
    image_url_unsupported: false,
    proxy: '',
    pass_through_body_enabled: false,
    system_prompt: '',
    system_prompt_override: false,
    poll_interval_seconds: 0,
    poll_initial_delay_seconds: 0,
    poll_timeout_hours: 0,
    poll_qps: 0,
    ima_pro_tenant_id: '',
    ima_pro_app_id: '',
    ima_pro_app_kind: '',
  };

  const parsedSettings = safeParseJsonObject(channel.setting);
  const imageUrlAutoBase64 = parsedSettings.image_url_auto_base64 === true;
  const imageUrlSupported = parsedSettings.image_url_supported !== false;

  return {
    ...defaults,
    force_format: parsedSettings.force_format === true,
    thinking_to_content: parsedSettings.thinking_to_content === true,
    image_url_auto_base64: imageUrlAutoBase64,
    image_url_supported: imageUrlSupported,
    image_url_unsupported: imageUrlAutoBase64 ? false : !imageUrlSupported,
    proxy: parsedSettings.proxy || '',
    pass_through_body_enabled:
      parsedSettings.pass_through_body_enabled === true,
    system_prompt: parsedSettings.system_prompt || '',
    system_prompt_override: parsedSettings.system_prompt_override === true,
    poll_interval_seconds: Number(parsedSettings.poll_interval_seconds) || 0,
    poll_initial_delay_seconds:
      Number(parsedSettings.poll_initial_delay_seconds) || 0,
    poll_timeout_hours: Number(parsedSettings.poll_timeout_hours) || 0,
    poll_qps: Number(parsedSettings.poll_qps) || 0,
    ima_pro_tenant_id: parsedSettings.ima_pro_tenant_id || '',
    ima_pro_app_id: parsedSettings.ima_pro_app_id || '',
    ima_pro_app_kind: parsedSettings.ima_pro_app_kind || '',
  };
}

function parseAdvancedSettings(channel) {
  const parsedSettings = safeParseJsonObject(channel.settings);
  const breakerSettings = buildBreakerSettingsFromRaw(parsedSettings);

  return {
    settings: hasText(channel.settings)
      ? JSON.stringify(parsedSettings, null, 2)
      : '',
    vertex_key_type: parsedSettings.vertex_key_type || 'json',
    aws_key_type: parsedSettings.aws_key_type || 'ak_sk',
    is_enterprise_account: parsedSettings.openrouter_enterprise === true,
    allow_service_tier: parsedSettings.allow_service_tier === true,
    disable_store: parsedSettings.disable_store === true,
    allow_safety_identifier: parsedSettings.allow_safety_identifier === true,
    allow_include_obfuscation:
      parsedSettings.allow_include_obfuscation === true,
    allow_inference_geo: parsedSettings.allow_inference_geo === true,
    claude_beta_query: parsedSettings.claude_beta_query === true,
    upstream_model_update_check_enabled:
      parsedSettings.upstream_model_update_check_enabled === true,
    upstream_model_update_auto_sync_enabled:
      parsedSettings.upstream_model_update_auto_sync_enabled === true,
    upstream_model_update_last_check_time:
      Number(parsedSettings.upstream_model_update_last_check_time) || 0,
    upstream_model_update_last_detected_models: Array.isArray(
      parsedSettings.upstream_model_update_last_detected_models,
    )
      ? parsedSettings.upstream_model_update_last_detected_models
      : [],
    upstream_model_update_ignored_models: Array.isArray(
      parsedSettings.upstream_model_update_ignored_models,
    )
      ? parsedSettings.upstream_model_update_ignored_models.join(',')
      : '',
    call_error_alert_enabled: parsedSettings.call_error_alert_enabled === true,
    call_error_threshold_count: toPositiveInteger(
      parsedSettings.call_error_threshold_count,
      10,
    ),
    call_error_threshold_window_minutes: toPositiveInteger(
      parsedSettings.call_error_threshold_window_minutes,
      5,
    ),
    call_error_cooldown_minutes:
      Number(parsedSettings.call_error_cooldown_minutes) > 0
        ? Number(parsedSettings.call_error_cooldown_minutes)
        : '',
    ...breakerSettings,
  };
}

function normalizeLoadedModelMapping(value) {
  if (!hasText(value)) {
    return '';
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch (error) {
    return value;
  }
}

function normalizeModelsFromMapping(channel) {
  const parsedModelMapping = safeParseJsonObject(channel.model_mapping);
  const missingModels = Object.keys(parsedModelMapping)
    .map((key) => key.trim())
    .filter(Boolean)
    .filter((model) => !channel.models.includes(model));

  return missingModels.length > 0
    ? [...channel.models, ...missingModels]
    : channel.models;
}

function buildChannelExtraSettings(channel) {
  return {
    force_format: channel.force_format === true,
    thinking_to_content: channel.thinking_to_content === true,
    image_url_auto_base64: channel.image_url_auto_base64 === true,
    image_url_supported: channel.image_url_unsupported === true ? false : true,
    proxy: channel.proxy || '',
    pass_through_body_enabled: channel.pass_through_body_enabled === true,
    system_prompt: channel.system_prompt || '',
    system_prompt_override: channel.system_prompt_override === true,
    poll_interval_seconds: Number(channel.poll_interval_seconds) || 0,
    poll_initial_delay_seconds: Number(channel.poll_initial_delay_seconds) || 0,
    poll_timeout_hours: Number(channel.poll_timeout_hours) || 0,
    poll_qps: Number(channel.poll_qps) || 0,
    ima_pro_tenant_id: (channel.ima_pro_tenant_id || '').trim(),
    ima_pro_app_id: (channel.ima_pro_app_id || '').trim(),
    ima_pro_app_kind: (channel.ima_pro_app_kind || '').trim(),
  };
}

function buildSettingsPayload(channel) {
  const settings = safeParseJsonObject(channel.settings);

  if (channel.type === 20) {
    settings.openrouter_enterprise = channel.is_enterprise_account === true;
  }
  if (channel.type === 33) {
    settings.aws_key_type = channel.aws_key_type || 'ak_sk';
  }
  if (channel.type === 41) {
    settings.vertex_key_type = channel.vertex_key_type || 'json';
  } else {
    delete settings.vertex_key_type;
  }
  if (channel.type === 1 || channel.type === 14) {
    settings.allow_service_tier = channel.allow_service_tier === true;
  }
  if (channel.type === 1) {
    settings.disable_store = channel.disable_store === true;
    settings.allow_safety_identifier = channel.allow_safety_identifier === true;
    settings.allow_include_obfuscation =
      channel.allow_include_obfuscation === true;
  }
  if (channel.type === 14) {
    settings.allow_inference_geo = channel.allow_inference_geo === true;
    settings.claude_beta_query = channel.claude_beta_query === true;
  }

  settings.upstream_model_update_check_enabled =
    channel.upstream_model_update_check_enabled === true;
  settings.upstream_model_update_auto_sync_enabled =
    settings.upstream_model_update_check_enabled &&
    channel.upstream_model_update_auto_sync_enabled === true;
  settings.upstream_model_update_ignored_models = normalizeStringList(
    channel.upstream_model_update_ignored_models,
  );
  settings.upstream_model_update_last_detected_models = Array.isArray(
    settings.upstream_model_update_last_detected_models,
  )
    ? settings.upstream_model_update_last_detected_models
    : [];
  settings.upstream_model_update_last_check_time =
    Number(settings.upstream_model_update_last_check_time) || 0;

  settings.call_error_alert_enabled = channel.call_error_alert_enabled === true;
  if (settings.call_error_alert_enabled) {
    if (Number(channel.call_error_threshold_count) <= 0) {
      throw new Error('调用错误次数阈值必须大于 0');
    }
    if (Number(channel.call_error_threshold_window_minutes) <= 0) {
      throw new Error('调用错误统计窗口必须大于 0 分钟');
    }
  }

  settings.call_error_threshold_count = toPositiveInteger(
    channel.call_error_threshold_count,
    10,
  );
  settings.call_error_threshold_window_minutes = toPositiveInteger(
    channel.call_error_threshold_window_minutes,
    5,
  );

  if (Number(channel.call_error_cooldown_minutes) > 0) {
    settings.call_error_cooldown_minutes = Math.floor(
      Number(channel.call_error_cooldown_minutes),
    );
  } else {
    delete settings.call_error_cooldown_minutes;
  }

  settings.breaker_enabled = channel.breaker_enabled === true;
  settings.breaker_threshold_count = toPositiveInteger(
    channel.breaker_threshold_count,
    BREAKER_DEFAULTS.breaker_threshold_count,
  );
  settings.breaker_window_seconds = toPositiveInteger(
    channel.breaker_window_seconds,
    BREAKER_DEFAULTS.breaker_window_seconds,
  );
  settings.breaker_cooldown_seconds = toNonNegativeInteger(
    channel.breaker_cooldown_seconds,
    BREAKER_DEFAULTS.breaker_cooldown_seconds,
  );
  settings.breaker_half_open_probe_count = toPositiveInteger(
    channel.breaker_half_open_probe_count,
    BREAKER_DEFAULTS.breaker_half_open_probe_count,
  );
  settings.breaker_recovery_success_count = toPositiveInteger(
    channel.breaker_recovery_success_count,
    BREAKER_DEFAULTS.breaker_recovery_success_count,
  );
  settings.breaker_error_types = normalizeBreakerErrorTypes(
    channel.breaker_error_types,
  );

  if (settings.breaker_error_types.length === 0) {
    throw new Error('Breaker 错误类型至少选择一项');
  }

  return settings;
}

function cleanupChannelPayload(channel) {
  const payload = { ...channel };
  const transientFields = [
    'groups',
    'vertex_key_type',
    'aws_key_type',
    'is_enterprise_account',
    'allow_service_tier',
    'disable_store',
    'allow_safety_identifier',
    'allow_include_obfuscation',
    'allow_inference_geo',
    'claude_beta_query',
    'upstream_model_update_check_enabled',
    'upstream_model_update_auto_sync_enabled',
    'upstream_model_update_last_check_time',
    'upstream_model_update_last_detected_models',
    'upstream_model_update_ignored_models',
    'call_error_alert_enabled',
    'call_error_threshold_count',
    'call_error_threshold_window_minutes',
    'call_error_cooldown_minutes',
    'breaker_enabled',
    'breaker_threshold_count',
    'breaker_window_seconds',
    'breaker_cooldown_seconds',
    'breaker_half_open_probe_count',
    'breaker_recovery_success_count',
    'breaker_error_types',
    'force_format',
    'thinking_to_content',
    'image_url_auto_base64',
    'image_url_supported',
    'image_url_unsupported',
    'proxy',
    'pass_through_body_enabled',
    'system_prompt',
    'system_prompt_override',
    'poll_interval_seconds',
    'poll_initial_delay_seconds',
    'poll_timeout_hours',
    'poll_qps',
    'ima_pro_tenant_id',
    'ima_pro_app_id',
    'ima_pro_app_kind',
  ];

  transientFields.forEach((field) => {
    delete payload[field];
  });

  return payload;
}

/**
 * 创建 Aurora 渠道表单默认值。
 * @returns {Record<string, unknown>}
 */
export function createChannelFormDefaults() {
  return createDefaultValues();
}

/**
 * 将旧版渠道详情反序列化为 Aurora 页面可编辑表单。
 * @param {Record<string, unknown>} data - 接口返回的渠道详情
 * @returns {{form: Record<string, unknown>, meta: Record<string, unknown>}}
 */
export function deserializeChannelForm(data) {
  const baseForm = createDefaultValues();
  const normalized = {
    ...baseForm,
    ...data,
    type: Number(data?.type) || 1,
    models: normalizeStringList(data?.models, 'id'),
    groups: normalizeStringList(data?.group),
    model_mapping: normalizeLoadedModelMapping(data?.model_mapping),
  };

  Object.assign(normalized, parseSettingFields(data || {}));
  Object.assign(normalized, parseAdvancedSettings(data || {}));

  BOOLEAN_FIELDS.forEach((field) => {
    normalized[field] = toBoolean(normalized[field]);
  });

  normalized.models = normalizeModelsFromMapping(normalized);

  if (normalized.type === 45 && !hasText(normalized.base_url)) {
    normalized.base_url = DEFAULT_DOUBAO_BASE_URL;
  }

  const channelInfo = data?.channel_info || {};
  const isMultiKeyChannel = channelInfo.is_multi_key === true;

  return {
    form: normalized,
    meta: {
      batch: isMultiKeyChannel,
      multiToSingle: isMultiKeyChannel,
      multiKeyMode: channelInfo.multi_key_mode || 'random',
      isMultiKeyChannel,
      keyMode: 'append',
    },
  };
}

/**
 * 构建创建或编辑渠道时要发送给后端的请求体。
 * @param {object} params - 表单上下文
 * @returns {{method: 'post' | 'put', payload: Record<string, unknown>}}
 */
export function buildChannelSubmitRequest(params) {
  const {
    form,
    isEdit,
    channelId,
    batch,
    multiToSingle,
    multiKeyMode,
    isMultiKeyChannel,
    keyMode,
  } = params;
  const channel = {
    ...createDefaultValues(),
    ...form,
    type: Number(form.type) || 1,
    models: normalizeStringList(form.models),
    groups: normalizeStringList(form.groups),
    breaker_error_types: normalizeBreakerErrorTypes(form.breaker_error_types),
  };

  if (!isEdit && (!hasText(channel.name) || !hasText(channel.key))) {
    throw new Error('请填写渠道名称和渠道密钥！');
  }
  if (channel.models.length === 0) {
    throw new Error('请至少选择一个模型！');
  }
  if (channel.type === 45 && !hasText(channel.base_url)) {
    throw new Error('请输入API地址！');
  }
  if (hasText(channel.model_mapping)) {
    try {
      const parsedMapping = JSON.parse(channel.model_mapping);
      if (!parsedMapping || Array.isArray(parsedMapping)) {
        throw new Error('模型映射必须是合法的 JSON 格式！');
      }
      channel.models = normalizeModelsFromMapping(channel);
      channel.model_mapping = JSON.stringify(parsedMapping, null, 2);
    } catch (error) {
      throw new Error('模型映射必须是合法的 JSON 格式！');
    }
  }

  if (hasText(channel.settings)) {
    try {
      const parsedSettings = JSON.parse(channel.settings);
      if (!parsedSettings || Array.isArray(parsedSettings)) {
        throw new Error('更多设置必须是合法的 JSON 格式！');
      }
    } catch (error) {
      throw new Error('更多设置必须是合法的 JSON 格式！');
    }
  }

  const invalidStatusCodes = collectInvalidStatusCodeEntries(
    channel.status_code_mapping,
  );
  if (invalidStatusCodes.length > 0) {
    throw new Error(
      `状态码复写包含无效的状态码: ${invalidStatusCodes.join(', ')}`,
    );
  }

  if (hasText(channel.base_url) && channel.base_url.endsWith('/')) {
    channel.base_url = channel.base_url.slice(0, -1);
  }
  if (channel.type === 18 && !hasText(channel.other)) {
    channel.other = 'v2.1';
  }
  if (channel.image_url_auto_base64 === true) {
    channel.image_url_supported = true;
    channel.image_url_unsupported = false;
  }
  if (isEdit && !hasText(channel.key)) {
    delete channel.key;
  }

  channel.setting = JSON.stringify(buildChannelExtraSettings(channel));
  channel.settings = JSON.stringify(buildSettingsPayload(channel));
  channel.auto_ban = channel.auto_ban ? 1 : 0;
  channel.models = channel.models.join(',');
  channel.group = channel.groups.join(',');

  const cleanedChannel = cleanupChannelPayload(channel);
  if (isEdit) {
    return {
      method: 'put',
      payload: {
        ...cleanedChannel,
        id: Number(channelId),
        key_mode: isMultiKeyChannel ? keyMode : undefined,
      },
    };
  }

  const mode = batch ? (multiToSingle ? 'multi_to_single' : 'batch') : 'single';
  return {
    method: 'post',
    payload: {
      mode,
      multi_key_mode: mode === 'multi_to_single' ? multiKeyMode : undefined,
      channel: cleanedChannel,
    },
  };
}
