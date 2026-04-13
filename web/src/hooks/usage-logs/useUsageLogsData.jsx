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

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@douyinfe/semi-ui';
import {
  API,
  getTodayStartTimestamp,
  isAdmin,
  showError,
  showSuccess,
  timestamp2string,
  renderQuota,
  renderNumber,
  getLogOther,
  copy,
  getQuotaPerUnit,
  renderClaudeLogContent,
  renderLogContent,
  renderAudioModelPrice,
  renderClaudeModelPrice,
  renderModelPrice,
} from '../../helpers';
import {
  hasDynamicPerCallRatios,
  calculateDynamicPerCallPrice,
  buildDynamicPerCallFormula,
  buildDynamicPerCallParameterText,
  getBillingSKU,
  calculateFixedPerCallPrice,
  buildFixedPerCallFormula,
  buildCreditsSettlementFormula,
  formatDirectPerCallPrice,
  derivePerCallUnitPriceFromQuota,
} from '../../helpers/dynamicPerCall';
import { ITEMS_PER_PAGE } from '../../constants';
import { useTableCompactMode } from '../common/useTableCompactMode';

const toPositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const hasAudioTokenBreakdown = (other) =>
  Boolean(other?.ws) ||
  [
    other?.audio_input,
    other?.audio_output,
    other?.text_input,
    other?.text_output,
    other?.audio_ratio,
    other?.audio_completion_ratio,
  ].some((value) => toPositiveNumber(value) > 0);

const parseTokenRecalculateTotal = (...candidates) => {
  for (const candidate of candidates) {
    const text = String(candidate || '');
    const matched = text.match(/token(?:_recalculate|重算)\s*[:=]\s*(\d+)/i);
    if (!matched) {
      continue;
    }
    const total = Number(matched[1]);
    if (Number.isFinite(total) && total > 0) {
      return total;
    }
  }
  return 0;
};

const resolveDeferredTotalTokens = (
  log,
  other,
  promptTokens,
  completionTokens,
) => {
  const directTotal = toPositiveNumber(other?.task_total_tokens);
  if (directTotal > 0) {
    return directTotal;
  }
  const recalculatedTotal = parseTokenRecalculateTotal(
    other?.terminal_charge_reason,
    log?.content,
  );
  if (recalculatedTotal > 0) {
    return recalculatedTotal;
  }
  return toPositiveNumber(promptTokens) + toPositiveNumber(completionTokens);
};

const isDeferredTokenRecalculateLog = (log, other) => {
  if (!other?.deferred_settle) {
    return false;
  }
  const reason = String(other?.terminal_charge_reason || '').toLowerCase();
  const content = String(log?.content || '').toLowerCase();
  const hasTokenUsage =
    toPositiveNumber(other?.task_total_tokens) > 0 ||
    toPositiveNumber(other?.task_completion_tokens) > 0 ||
    toPositiveNumber(other?.task_prompt_tokens) > 0;
  return (
    reason.startsWith('token_recalculate') ||
    reason.startsWith('token重算') ||
    reason.startsWith('adaptor_adjust') ||
    content.startsWith('token_recalculate') ||
    content.startsWith('token重算') ||
    content.startsWith('adaptor_adjust') ||
    hasTokenUsage
  );
};

const isDeferredSettlePendingLog = (log, other) => {
  if (!other?.deferred_settle) {
    return false;
  }
  if (isDeferredTokenRecalculateLog(log, other)) {
    return false;
  }
  const state = String(other?.terminal_charge_state || '').toLowerCase();
  return state === 'pending';
};

const buildDeferredPendingFormula = (quota, modelRatio, groupRatio, t) => {
  const quotaValue = Number(quota);
  const modelRatioValue = Number(modelRatio);
  const groupRatioValue = Number(groupRatio);
  if (
    !Number.isFinite(quotaValue) ||
    quotaValue <= 0 ||
    !Number.isFinite(modelRatioValue) ||
    modelRatioValue <= 0 ||
    !Number.isFinite(groupRatioValue) ||
    groupRatioValue <= 0
  ) {
    return null;
  }
  const estimatedTokens = Math.round(
    quotaValue / (modelRatioValue * groupRatioValue),
  );
  const inputPrice = modelRatioValue * 2;
  return t(
    '(预扣 {{tokens}} tokens / 1M tokens * ${{inputPrice}}) * 分组倍率（模型覆盖） {{groupRatio}} = {{cost}}',
    {
      tokens: renderNumber(estimatedTokens),
      inputPrice: Number(inputPrice).toFixed(6),
      groupRatio: Number(groupRatioValue).toFixed(4),
      cost: renderQuota(quotaValue, 6),
    },
  );
};

const buildDeferredTokenFormula = (
  promptTokens,
  completionTokens,
  cacheTokens,
  modelRatio,
  completionRatio,
  cacheRatio,
  groupRatio,
  t,
  totalTokens,
  thoughtRatio,
) => {
  const p = Number(promptTokens);
  const c = Number(completionTokens);
  const k = Number(cacheTokens || 0);
  const mr = Number(modelRatio);
  const cr = Number(completionRatio || 1);
  const kr = Number(cacheRatio || 1);
  const gr = Number(groupRatio);
  if (
    !Number.isFinite(p) ||
    !Number.isFinite(c) ||
    !Number.isFinite(mr) ||
    mr <= 0 ||
    !Number.isFinite(cr) ||
    cr <= 0 ||
    !Number.isFinite(gr) ||
    gr <= 0
  ) {
    return null;
  }
  const inputPrice = mr * 2;
  const completionPrice = inputPrice * cr;
  const cachePrice = inputPrice * kr;
  const nonCachePrompt = Math.max(p - k, 0);

  // Derive thought tokens from total - prompt - completion
  const total = Number(totalTokens || 0);
  const thoughtTokens = total > 0 ? Math.max(total - p - c, 0) : 0;
  const tr = Number(thoughtRatio || cr);
  const thoughtPrice = inputPrice * tr;

  const terms = [];
  if (nonCachePrompt > 0) {
    terms.push(
      `${t('输入')} ${renderNumber(nonCachePrompt)} tokens / 1M tokens * $${inputPrice.toFixed(6)}`,
    );
  }
  if (k > 0) {
    terms.push(
      `${t('缓存')} ${renderNumber(k)} tokens / 1M tokens * $${cachePrice.toFixed(6)}`,
    );
  }
  terms.push(
    `${t('输出')} ${renderNumber(c)} tokens / 1M tokens * $${completionPrice.toFixed(6)}`,
  );
  if (thoughtTokens > 0) {
    terms.push(
      `${t('思考')} ${renderNumber(thoughtTokens)} tokens / 1M tokens * $${thoughtPrice.toFixed(6)}`,
    );
  }
  return `(${terms.join(' + ')}) * ${t('分组倍率（模型覆盖）')} ${gr.toFixed(4)}`;
};

export const useLogsData = () => {
  const { t } = useTranslation();

  // Define column keys for selection
  const COLUMN_KEYS = {
    TIME: 'time',
    CHANNEL: 'channel',
    CHANNEL_ID: 'channel_id',
    USERNAME: 'username',
    TOKEN: 'token',
    GROUP: 'group',
    PRICING_GROUP: 'pricing_group',
    TYPE: 'type',
    MODEL: 'model',
    USE_TIME: 'use_time',
    PROMPT: 'prompt',
    COMPLETION: 'completion',
    COST: 'cost',
    RETRY: 'retry',
    IP: 'ip',
    DETAILS: 'details',
  };

  // Basic state
  const [logs, setLogs] = useState([]);
  const [expandData, setExpandData] = useState({});
  const [showStat, setShowStat] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStat, setLoadingStat] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [logCount, setLogCount] = useState(0);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [logType, setLogType] = useState(0);

  // User and admin
  const isAdminUser = isAdmin();
  // Role-specific storage key to prevent different roles from overwriting each other
  const STORAGE_KEY = isAdminUser
    ? 'logs-table-columns-admin'
    : 'logs-table-columns-user';
  const BILLING_DISPLAY_MODE_STORAGE_KEY = isAdminUser
    ? 'logs-billing-display-mode-admin'
    : 'logs-billing-display-mode-user';

  // Statistics state
  const [stat, setStat] = useState({
    quota: 0,
    token: 0,
  });

  // Form state
  const [formApi, setFormApi] = useState(null);
  let now = new Date();
  const formInitValues = {
    username: '',
    token_name: '',
    model_name: '',
    channel: '',
    group: '',
    pricing_group: '',
    request_id: '',
    dateRange: [
      timestamp2string(getTodayStartTimestamp()),
      timestamp2string(now.getTime() / 1000 + 3600),
    ],
    logType: '0',
  };

  // Get default column visibility based on user role
  const getDefaultColumnVisibility = () => {
    return {
      [COLUMN_KEYS.TIME]: true,
      [COLUMN_KEYS.CHANNEL]: isAdminUser,
      [COLUMN_KEYS.CHANNEL_ID]: isAdminUser,
      [COLUMN_KEYS.USERNAME]: isAdminUser,
      [COLUMN_KEYS.TOKEN]: true,
      [COLUMN_KEYS.GROUP]: true,
      [COLUMN_KEYS.PRICING_GROUP]: false,
      [COLUMN_KEYS.TYPE]: true,
      [COLUMN_KEYS.MODEL]: true,
      [COLUMN_KEYS.USE_TIME]: true,
      [COLUMN_KEYS.PROMPT]: true,
      [COLUMN_KEYS.COMPLETION]: true,
      [COLUMN_KEYS.COST]: true,
      [COLUMN_KEYS.RETRY]: isAdminUser,
      [COLUMN_KEYS.IP]: true,
      [COLUMN_KEYS.DETAILS]: true,
    };
  };

  const getInitialVisibleColumns = () => {
    const defaults = getDefaultColumnVisibility();
    const savedColumns = localStorage.getItem(STORAGE_KEY);

    if (!savedColumns) {
      return defaults;
    }

    try {
      const parsed = JSON.parse(savedColumns);
      const merged = { ...defaults, ...parsed };

      if (!isAdminUser) {
        merged[COLUMN_KEYS.CHANNEL] = false;
        merged[COLUMN_KEYS.CHANNEL_ID] = false;
        merged[COLUMN_KEYS.USERNAME] = false;
        merged[COLUMN_KEYS.RETRY] = false;
      }

      return merged;
    } catch (e) {
      console.error('Failed to parse saved column preferences', e);
      return defaults;
    }
  };

  const getInitialBillingDisplayMode = () => {
    const savedMode = localStorage.getItem(BILLING_DISPLAY_MODE_STORAGE_KEY);
    if (savedMode === 'price' || savedMode === 'ratio') {
      return savedMode;
    }
    return localStorage.getItem('quota_display_type') === 'TOKENS'
      ? 'ratio'
      : 'price';
  };

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState(
    getInitialVisibleColumns,
  );
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [billingDisplayMode, setBillingDisplayMode] = useState(
    getInitialBillingDisplayMode,
  );

  // Compact mode
  const [compactMode, setCompactMode] = useTableCompactMode('logs');

  // User info modal state
  const [showUserInfo, setShowUserInfoModal] = useState(false);
  const [userInfoData, setUserInfoData] = useState(null);

  // Channel affinity usage cache stats modal state (admin only)
  const [
    showChannelAffinityUsageCacheModal,
    setShowChannelAffinityUsageCacheModal,
  ] = useState(false);
  const [channelAffinityUsageCacheTarget, setChannelAffinityUsageCacheTarget] =
    useState(null);

  // Initialize default column visibility
  const initDefaultColumns = () => {
    const defaults = getDefaultColumnVisibility();
    setVisibleColumns(defaults);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  };

  // Handle column visibility change
  const handleColumnVisibilityChange = (columnKey, checked) => {
    const updatedColumns = { ...visibleColumns, [columnKey]: checked };
    setVisibleColumns(updatedColumns);
  };

  // Handle "Select All" checkbox
  const handleSelectAll = (checked) => {
    const allKeys = Object.keys(COLUMN_KEYS).map((key) => COLUMN_KEYS[key]);
    const updatedColumns = {};

    allKeys.forEach((key) => {
      if (
        (key === COLUMN_KEYS.CHANNEL ||
          key === COLUMN_KEYS.CHANNEL_ID ||
          key === COLUMN_KEYS.USERNAME ||
          key === COLUMN_KEYS.RETRY) &&
        !isAdminUser
      ) {
        updatedColumns[key] = false;
      } else {
        updatedColumns[key] = checked;
      }
    });

    setVisibleColumns(updatedColumns);
  };

  // Persist column settings to the role-specific STORAGE_KEY
  useEffect(() => {
    if (Object.keys(visibleColumns).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
    }
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem(BILLING_DISPLAY_MODE_STORAGE_KEY, billingDisplayMode);
  }, [BILLING_DISPLAY_MODE_STORAGE_KEY, billingDisplayMode]);

  // 获取表单值的辅助函数，确保所有值都是字符串
  const getFormValues = () => {
    const formValues = formApi ? formApi.getValues() : {};
    const requestId = (formValues.request_id || '').trim();
    const exactRequestSearch = requestId !== '';

    let start_timestamp = timestamp2string(getTodayStartTimestamp());
    let end_timestamp = timestamp2string(now.getTime() / 1000 + 3600);

    if (
      !exactRequestSearch &&
      formValues.dateRange &&
      Array.isArray(formValues.dateRange) &&
      formValues.dateRange.length === 2
    ) {
      start_timestamp = formValues.dateRange[0];
      end_timestamp = formValues.dateRange[1];
    }

    return {
      username: exactRequestSearch ? '' : (formValues.username || '').trim(),
      token_name: exactRequestSearch
        ? ''
        : (formValues.token_name || '').trim(),
      model_name: exactRequestSearch
        ? ''
        : (formValues.model_name || '').trim(),
      start_timestamp,
      end_timestamp,
      channel: exactRequestSearch ? '' : (formValues.channel || '').trim(),
      group: exactRequestSearch ? '' : (formValues.group || '').trim(),
      pricing_group: exactRequestSearch
        ? ''
        : (formValues.pricing_group || '').trim(),
      request_id: requestId,
      logType: exactRequestSearch
        ? ''
        : formValues.logType
          ? parseInt(formValues.logType)
          : 0,
      exactRequestSearch,
    };
  };

  // Statistics functions
  const getLogSelfStat = async () => {
    const {
      token_name,
      model_name,
      start_timestamp,
      end_timestamp,
      group,
      pricing_group,
      logType: formLogType,
      exactRequestSearch,
    } = getFormValues();
    if (exactRequestSearch) {
      setShowStat(false);
      return;
    }
    const currentLogType = formLogType !== undefined ? formLogType : logType;
    let localStartTimestamp = Date.parse(start_timestamp) / 1000;
    let localEndTimestamp = Date.parse(end_timestamp) / 1000;
    let url = `/api/log/self/stat?type=${currentLogType}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&group=${group}&pricing_group=${pricing_group}`;
    url = encodeURI(url);
    let res = await API.get(url);
    const { success, message, data } = res.data;
    if (success) {
      setStat(data);
    } else {
      showError(message);
    }
  };

  const getLogStat = async () => {
    const {
      username,
      token_name,
      model_name,
      start_timestamp,
      end_timestamp,
      channel,
      group,
      pricing_group,
      logType: formLogType,
      exactRequestSearch,
    } = getFormValues();
    if (exactRequestSearch) {
      setShowStat(false);
      return;
    }
    const currentLogType = formLogType !== undefined ? formLogType : logType;
    let localStartTimestamp = Date.parse(start_timestamp) / 1000;
    let localEndTimestamp = Date.parse(end_timestamp) / 1000;
    let url = `/api/log/stat?type=${currentLogType}&username=${username}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&channel=${channel}&group=${group}&pricing_group=${pricing_group}`;
    url = encodeURI(url);
    let res = await API.get(url);
    const { success, message, data } = res.data;
    if (success) {
      setStat(data);
    } else {
      showError(message);
    }
  };

  const handleEyeClick = async () => {
    if (loadingStat) {
      return;
    }
    setLoadingStat(true);
    if (isAdminUser) {
      await getLogStat();
    } else {
      await getLogSelfStat();
    }
    setShowStat(true);
    setLoadingStat(false);
  };

  // User info function
  const showUserInfoFunc = async (userId) => {
    if (!isAdminUser) {
      return;
    }
    const res = await API.get(`/api/user/${userId}`);
    const { success, message, data } = res.data;
    if (success) {
      setUserInfoData(data);
      setShowUserInfoModal(true);
    } else {
      showError(message);
    }
  };

  const openChannelAffinityUsageCacheModal = (affinity) => {
    const a = affinity || {};
    setChannelAffinityUsageCacheTarget({
      rule_name: a.rule_name || a.reason || '',
      using_group: a.using_group || '',
      key_hint: a.key_hint || '',
      key_fp: a.key_fp || '',
    });
    setShowChannelAffinityUsageCacheModal(true);
  };

  // Format logs data
  const setLogsFormat = (logs) => {
    const requestConversionDisplayValue = (conversionChain) => {
      const chain = Array.isArray(conversionChain)
        ? conversionChain.filter(Boolean)
        : [];
      if (chain.length <= 1) {
        return t('原生格式');
      }
      return `${chain.join(' -> ')}`;
    };

    let expandDatesLocal = {};
    for (let i = 0; i < logs.length; i++) {
      logs[i].timestamp2string = timestamp2string(logs[i].created_at);
      logs[i].key = logs[i].id;
      let other = getLogOther(logs[i].other);
      let expandDataLocal = [];

      if (
        isAdminUser &&
        (logs[i].type === 0 || logs[i].type === 2 || logs[i].type === 6)
      ) {
        expandDataLocal.push({
          key: t('渠道信息'),
          value: `${logs[i].channel} - ${logs[i].channel_name || '[未知]'}`,
        });
      }
      if (logs[i].pricing_group) {
        expandDataLocal.push({
          key: t('定价分组'),
          value: logs[i].pricing_group,
        });
      }
      if (logs[i].request_id) {
        expandDataLocal.push({
          key: t('Request ID'),
          value: logs[i].request_id,
        });
      } else if (other?.request_id) {
        expandDataLocal.push({
          key: t('Request ID'),
          value: other.request_id,
        });
      } else if (other?.task_id) {
        expandDataLocal.push({
          key: t('Request ID'),
          value: other.task_id,
        });
      }
      expandDataLocal.push({
        key: t('输入 Tokens'),
        value: renderNumber(logs[i].prompt_tokens || 0),
      });
      expandDataLocal.push({
        key: t('输出 Tokens'),
        value: renderNumber(logs[i].completion_tokens || 0),
      });
      if (hasAudioTokenBreakdown(other)) {
        expandDataLocal.push({
          key: t('语音输入'),
          value: other.audio_input,
        });
        expandDataLocal.push({
          key: t('语音输出'),
          value: other.audio_output,
        });
        expandDataLocal.push({
          key: t('文字输入'),
          value: other.text_input,
        });
        expandDataLocal.push({
          key: t('文字输出'),
          value: other.text_output,
        });
      }
      if (other?.cache_tokens > 0) {
        expandDataLocal.push({
          key: t('缓存 Tokens'),
          value: other.cache_tokens,
        });
      }
      if (other?.cache_creation_tokens > 0) {
        expandDataLocal.push({
          key: t('缓存创建 Tokens'),
          value: other.cache_creation_tokens,
        });
      }
      if (logs[i].type === 2) {
        const deferredTokenRecalculate =
          isDeferredTokenRecalculateLog(logs[i], other) &&
          toPositiveNumber(other?.actual_quota || logs[i]?.quota) > 0;
        const deferredPendingSubmit = isDeferredSettlePendingLog(
          logs[i],
          other,
        );
        const promptTokens = toPositiveNumber(
          logs[i]?.prompt_tokens || other?.task_prompt_tokens,
        );
        const completionTokens = toPositiveNumber(
          logs[i]?.completion_tokens || other?.task_completion_tokens,
        );
        const totalTokens = resolveDeferredTotalTokens(
          logs[i],
          other,
          promptTokens,
          completionTokens,
        );
        const isAdaptorAdjustLog = String(
          other?.terminal_charge_reason || '',
        ).includes('adaptor_adjust');
        const isCreditSettlement = other?.settlement_type === 'credits';
        const upstreamCredits = toPositiveNumber(other?.upstream_credits);
        const billedQuota = toPositiveNumber(
          other?.actual_quota || logs[i]?.quota || 0,
        );
        const deferredBillingSummary = deferredTokenRecalculate
          ? isAdaptorAdjustLog
            ? isCreditSettlement && upstreamCredits > 0
              ? buildCreditsSettlementFormula({
                  credits: upstreamCredits,
                  groupRatio: Number(other?.group_ratio || 1),
                  finalPrice: billedQuota / getQuotaPerUnit(),
                  labels: {
                    groupRatio: t('分组倍率（模型覆盖）'),
                  },
                })
              : t('上游实际消耗结算，分组倍率(模型覆盖) {{ratio}}', {
                  ratio: Number(other?.group_ratio || 1).toFixed(1),
                })
            : renderLogContent(
                other?.model_ratio,
                other?.completion_ratio,
                other?.model_price,
                other?.group_ratio,
                other?.user_group_ratio,
                other?.cache_ratio || 1.0,
                false,
                1.0,
                false,
                0,
                false,
                0,
                billingDisplayMode,
                other?.group_ratio_source,
                other,
              )
          : null;
        const deferredPromptTokens =
          toPositiveNumber(logs[i]?.prompt_tokens) > 0
            ? toPositiveNumber(logs[i]?.prompt_tokens)
            : toPositiveNumber(other?.task_prompt_tokens);
        const deferredCompletionTokens =
          toPositiveNumber(logs[i]?.completion_tokens) > 0
            ? toPositiveNumber(logs[i]?.completion_tokens)
            : toPositiveNumber(other?.task_completion_tokens);
        expandDataLocal.push({
          key: t('日志详情'),
          value: deferredTokenRecalculate
            ? [
                totalTokens > 0
                  ? t('Token 消耗：{{tokens}}', {
                      tokens: renderNumber(totalTokens),
                    })
                  : null,
                t('终态重算扣费：{{cost}}', {
                  cost: renderQuota(logs[i].quota || 0, 6),
                }),
                deferredBillingSummary,
                t('结算原因：{{reason}}', {
                  reason:
                    other?.terminal_charge_reason || logs[i].content || '-',
                }),
              ]
                .filter(Boolean)
                .join(' | ')
            : deferredPendingSubmit
              ? [
                  t('延迟结算（提交阶段）'),
                  toPositiveNumber(other?.estimated_quota) > 0
                    ? t('预估扣费：{{cost}}', {
                        cost: renderQuota(other.estimated_quota, 6),
                      })
                    : null,
                  buildDeferredPendingFormula(
                    other?.estimated_quota,
                    other?.model_ratio,
                    other?.group_ratio,
                    t,
                  ),
                  t('结算状态：{{state}}', {
                    state: other?.terminal_charge_state || 'pending',
                  }),
                ]
                  .filter(Boolean)
                  .join(' | ')
              : other?.claude
                ? renderClaudeLogContent(
                    other?.model_ratio,
                    other?.completion_ratio,
                    other?.model_price,
                    other?.group_ratio,
                    other?.user_group_ratio,
                    other?.cache_ratio || 1.0,
                    other?.cache_creation_ratio || 1.0,
                    other.cache_creation_tokens_5m || 0,
                    other.cache_creation_ratio_5m ||
                      other.cache_creation_ratio ||
                      1.0,
                    other.cache_creation_tokens_1h || 0,
                    other.cache_creation_ratio_1h ||
                      other.cache_creation_ratio ||
                      1.0,
                    billingDisplayMode,
                    other?.group_ratio_source,
                  )
                : renderLogContent(
                    other?.model_ratio,
                    other?.completion_ratio,
                    other?.model_price,
                    other?.group_ratio,
                    other?.user_group_ratio,
                    other?.cache_ratio || 1.0,
                    false,
                    1.0,
                    other?.web_search || false,
                    other?.web_search_call_count || 0,
                    other?.file_search || false,
                    other?.file_search_call_count || 0,
                    billingDisplayMode,
                    other?.group_ratio_source,
                    other,
                  ),
        });
        if (logs[i]?.content) {
          expandDataLocal.push({
            key: t('其他详情'),
            value: logs[i].content,
          });
        }
        if (isAdminUser && other?.reject_reason) {
          expandDataLocal.push({
            key: t('拦截原因'),
            value: other.reject_reason,
          });
        }
      }
      if (logs[i].type === 2) {
        let modelMapped =
          other?.is_model_mapped &&
          other?.upstream_model_name &&
          other?.upstream_model_name !== '';
        if (modelMapped) {
          expandDataLocal.push({
            key: t('请求并计费模型'),
            value: logs[i].model_name,
          });
          expandDataLocal.push({
            key: t('实际模型'),
            value: other.upstream_model_name,
          });
        }

        const isViolationFeeLog =
          other?.violation_fee === true ||
          Boolean(other?.violation_fee_code) ||
          Boolean(other?.violation_fee_marker);

        let content = '';
        if (!isViolationFeeLog) {
          const requestPath = String(other?.request_path || '');
          const isNonTextTaskEndpoint =
            requestPath.includes('/v1/videos') ||
            requestPath.includes('/v1/video/generations') ||
            requestPath.includes('/v1/images/generations') ||
            requestPath.includes('/kling/v1/videos') ||
            requestPath.includes('/jimeng') ||
            requestPath.includes('/mj/');
          const hasNoTokenUsage =
            toPositiveNumber(logs[i]?.prompt_tokens) +
              toPositiveNumber(logs[i]?.completion_tokens) ===
            0;

          if (hasAudioTokenBreakdown(other)) {
            content = renderAudioModelPrice(
              other?.text_input,
              other?.text_output,
              other?.model_ratio,
              other?.model_price,
              other?.completion_ratio,
              other?.audio_input,
              other?.audio_output,
              other?.audio_ratio,
              other?.audio_completion_ratio,
              other?.group_ratio,
              other?.user_group_ratio,
              other?.cache_tokens || 0,
              other?.cache_ratio || 1.0,
              billingDisplayMode,
              other?.group_ratio_source,
            );
          } else if (other?.claude) {
            content = renderClaudeModelPrice(
              logs[i].prompt_tokens,
              logs[i].completion_tokens,
              other?.model_ratio,
              other?.model_price,
              other?.completion_ratio,
              other?.group_ratio,
              other?.user_group_ratio,
              other.cache_tokens || 0,
              other.cache_ratio || 1.0,
              other.cache_creation_tokens || 0,
              other.cache_creation_ratio || 1.0,
              other.cache_creation_tokens_5m || 0,
              other.cache_creation_ratio_5m ||
                other.cache_creation_ratio ||
                1.0,
              other.cache_creation_tokens_1h || 0,
              other.cache_creation_ratio_1h ||
                other.cache_creation_ratio ||
                1.0,
              billingDisplayMode,
              other?.group_ratio_source,
            );
          } else if (
            isDeferredTokenRecalculateLog(logs[i], other) &&
            toPositiveNumber(other?.actual_quota || logs[i]?.quota) > 0
          ) {
            const billedQuota = Number(
              other?.actual_quota || logs[i]?.quota || 0,
            );
            const reason =
              other?.terminal_charge_reason || logs[i].content || '-';
            const isAdaptorAdjust = String(reason).includes('adaptor_adjust');

            if (isAdaptorAdjust) {
              // Adaptor-based settlement: show actual charge as authoritative amount.
              const groupRatio = Number(other?.group_ratio);
              const credits = toPositiveNumber(other?.upstream_credits);
              const isCreditSettle = other?.settlement_type === 'credits';
              const creditsFormula =
                isCreditSettle && credits > 0
                  ? buildCreditsSettlementFormula({
                      credits,
                      groupRatio,
                      finalPrice: billedQuota / quotaPerUnit,
                      labels: {
                        groupRatio: t('分组倍率（模型覆盖）'),
                      },
                    })
                  : '';
              content = (
                <article>
                  <p>
                    {t('终态重算扣费：{{cost}}', {
                      cost: renderQuota(billedQuota, 6),
                    })}
                  </p>
                  <p>
                    {isCreditSettle
                      ? t('结算方式：上游实际消耗结算（按 credits）')
                      : t('结算方式：上游实际消耗结算')}
                  </p>
                  {isCreditSettle && credits > 0 && (
                    <p>{t('上游消耗：{{credits}} credits', { credits })}</p>
                  )}
                  {Number.isFinite(groupRatio) && groupRatio !== 1 && (
                    <p>
                      {t('分组倍率（模型覆盖）：{{ratio}}', {
                        ratio: groupRatio.toFixed(4),
                      })}
                    </p>
                  )}
                  {creditsFormula && <p>{creditsFormula}</p>}
                  <p>{t('结算原因：{{reason}}', { reason })}</p>
                </article>
              );
            } else {
              // Token-based recalculation: show full token formula
              const deferredPromptTokens =
                toPositiveNumber(logs[i]?.prompt_tokens) > 0
                  ? toPositiveNumber(logs[i]?.prompt_tokens)
                  : toPositiveNumber(other?.task_prompt_tokens);
              const deferredCompletionTokens =
                toPositiveNumber(logs[i]?.completion_tokens) > 0
                  ? toPositiveNumber(logs[i]?.completion_tokens)
                  : toPositiveNumber(other?.task_completion_tokens);
              const totalTokens = resolveDeferredTotalTokens(
                logs[i],
                other,
                deferredPromptTokens,
                deferredCompletionTokens,
              );
              const billingProcess = renderLogContent(
                other?.model_ratio,
                other?.completion_ratio,
                other?.model_price,
                other?.group_ratio,
                other?.user_group_ratio,
                other?.cache_ratio || 1.0,
                false,
                1.0,
                false,
                0,
                false,
                0,
                billingDisplayMode,
                other?.group_ratio_source,
                other,
              );
              const modelName = logs[i]?.model_name || '';
              const isGeminiImagePreview =
                modelName.includes('image-preview') ||
                modelName.includes('image_preview');
              const thoughtRatio = isGeminiImagePreview ? 6.0 : undefined;
              const forcedFormula = buildDeferredTokenFormula(
                deferredPromptTokens,
                deferredCompletionTokens,
                other?.cache_tokens || 0,
                other?.model_ratio,
                other?.completion_ratio,
                other?.cache_ratio || 1.0,
                other?.group_ratio,
                t,
                totalTokens,
                thoughtRatio,
              );
              content = (
                <article>
                  <p>
                    {t('终态重算扣费：{{cost}}', {
                      cost: renderQuota(billedQuota, 6),
                    })}
                  </p>
                  {billingProcess}
                  {forcedFormula && <p>{forcedFormula}</p>}
                  <p>{t('结算原因：{{reason}}', { reason })}</p>
                  {totalTokens > 0 && (
                    <p>
                      {t('任务总 Tokens：{{tokens}}', {
                        tokens: renderNumber(totalTokens),
                      })}
                    </p>
                  )}
                  <p>{t('仅供参考，以实际扣费为准')}</p>
                </article>
              );
            }
          } else if (isDeferredSettlePendingLog(logs[i], other)) {
            const pendingFormula = buildDeferredPendingFormula(
              other?.estimated_quota,
              other?.model_ratio,
              other?.group_ratio,
              t,
            );
            // Extract OtherRatios from log data (e.g. seconds, duration, quality, resolution)
            const otherRatioKeys = Object.keys(other || {}).filter(
              (k) =>
                [
                  'duration',
                  'quality',
                  'speed_ratio',
                  'seconds',
                  'size',
                  'resolution',
                ].includes(k) &&
                Number(other[k]) !== 1 &&
                Number.isFinite(Number(other[k])),
            );
            content = (
              <article>
                <p>{t('延迟结算（提交阶段）')}</p>
                {toPositiveNumber(other?.estimated_quota) > 0 && (
                  <p>
                    {t('预估扣费：{{cost}}', {
                      cost: renderQuota(other.estimated_quota, 6),
                    })}
                  </p>
                )}
                {pendingFormula && <p>{pendingFormula}</p>}
                {otherRatioKeys.length > 0 && (
                  <p>
                    {t('计算参数')}：
                    {otherRatioKeys
                      .map((k) => `${k}=${Number(other[k]).toFixed(2)}`)
                      .join(', ')}
                  </p>
                )}
                <p>
                  {t('结算状态：{{state}}', {
                    state: other?.terminal_charge_state || 'pending',
                  })}
                </p>
                <p>{t('仅供参考，以实际扣费为准')}</p>
              </article>
            );
          } else if (
            isNonTextTaskEndpoint &&
            hasNoTokenUsage &&
            Number.isFinite(Number(other?.model_price)) &&
            Number(other?.model_price) > 0
          ) {
            // Per-call billing for task models (e.g. Kling video)
            const billedQuota = toPositiveNumber(logs[i]?.quota);
            const quotaPerUnit = Number(getQuotaPerUnit());
            const perCallPrice = Number(other?.model_price);
            const groupRatio = Number(other?.group_ratio);
            const billingSKU = getBillingSKU(other);
            const dynamicPrice = hasDynamicPerCallRatios(other)
              ? calculateDynamicPerCallPrice({
                  modelPrice: perCallPrice,
                  groupRatio,
                  otherRatios: other,
                })
              : null;
            const fixedPerCallPrice =
              !dynamicPrice && billingSKU
                ? calculateFixedPerCallPrice({
                    modelPrice: perCallPrice,
                    groupRatio,
                  })
                : null;
            const parameterText = buildDynamicPerCallParameterText(other);
            const otherRatioKeys = Object.keys(other || {}).filter(
              (k) =>
                [
                  'duration',
                  'quality',
                  'speed_ratio',
                  'seconds',
                  'size',
                  'resolution',
                ].includes(k) && Number(other[k]) !== 1,
            );
            content = (
              <article>
                <p>{t('按次计费')}</p>
                <p>
                  {t(
                    dynamicPrice
                      ? '基础单价：{{price}} / 次'
                      : fixedPerCallPrice
                        ? 'SKU单价：{{price}} / 次'
                        : '模型单价：{{price}} / 次',
                    {
                      price: formatDirectPerCallPrice(perCallPrice),
                    },
                  )}
                </p>
                {billingSKU && (
                  <p>{t('计费SKU：{{sku}}', { sku: billingSKU })}</p>
                )}
                <p>
                  {t('分组倍率（模型覆盖）：{{ratio}}', {
                    ratio: Number.isFinite(groupRatio)
                      ? Number(groupRatio).toFixed(4)
                      : '-',
                  })}
                </p>
                {otherRatioKeys.length > 0 && (
                  <p>
                    {t('计算参数')}：
                    {parameterText ||
                      otherRatioKeys
                        .map((k) => `${k}=${Number(other[k]).toFixed(2)}`)
                        .join(', ')}
                  </p>
                )}
                {dynamicPrice && (
                  <p>
                    {buildDynamicPerCallFormula({
                      basePrice: dynamicPrice.basePrice,
                      finalPrice: dynamicPrice.finalPrice,
                      groupRatio: dynamicPrice.groupRatio,
                      otherRatios: other,
                    })}
                  </p>
                )}
                {fixedPerCallPrice && (
                  <p>
                    {buildFixedPerCallFormula({
                      unitPrice: fixedPerCallPrice.unitPrice,
                      finalPrice:
                        billedQuota > 0
                          ? billedQuota / quotaPerUnit
                          : fixedPerCallPrice.finalPrice,
                      groupRatio: fixedPerCallPrice.groupRatio,
                    })}
                  </p>
                )}
                <p>
                  {t('实际扣费：{{cost}}', {
                    cost: renderQuota(billedQuota, 6),
                  })}
                </p>
              </article>
            );
          } else if (isNonTextTaskEndpoint && hasNoTokenUsage) {
            const billedQuota = toPositiveNumber(logs[i]?.quota);
            if (billedQuota > 0) {
              const groupRatio = Number(other?.group_ratio);
              const safeGroupRatio =
                Number.isFinite(groupRatio) && groupRatio > 0 ? groupRatio : 1;
              const quotaPerUnit = Number(getQuotaPerUnit());
              const derivedModelPrice = derivePerCallUnitPriceFromQuota({
                billedQuota,
                groupRatio: safeGroupRatio,
                quotaPerUnit,
              });
              const derivedModelPriceText = formatDirectPerCallPrice(
                derivedModelPrice,
              );
              content = (
                <article>
                  <p>{t('按次计费（根据实际扣费反推）')}</p>
                  <p>
                    {t('模型单价：{{price}} / 次', {
                      price: derivedModelPriceText,
                    })}
                  </p>
                  <p>
                    {t('分组倍率（模型覆盖）：{{ratio}}', {
                      ratio: Number.isFinite(groupRatio)
                        ? Number(groupRatio).toFixed(4)
                        : '-',
                    })}
                  </p>
                  <p>
                    {t(
                      '(模型单价 {{price}} / 次) * 分组倍率（模型覆盖） {{ratio}} = {{cost}}',
                      {
                        price: derivedModelPriceText,
                        ratio: safeGroupRatio.toFixed(4),
                        cost: renderQuota(billedQuota, 6),
                      },
                    )}
                  </p>
                  <p>{t('仅供参考，以实际扣费为准')}</p>
                </article>
              );
            } else {
              const modelRatio = Number(other?.model_ratio);
              const groupRatio = Number(other?.group_ratio);
              const estimatedPreconsumeTokens =
                Number.isFinite(modelRatio) &&
                modelRatio > 0 &&
                Number.isFinite(groupRatio) &&
                groupRatio > 0 &&
                billedQuota > 0
                  ? Math.round(billedQuota / (modelRatio * groupRatio))
                  : 0;

              content = (
                <article>
                  <p>{t('按量计费（预扣阶段）')}</p>
                  <p>
                    {t('输入价格：{{price}} / 1M tokens', {
                      price: `${Number(modelRatio * 2 || 0).toFixed(6)}`,
                    })}
                  </p>
                  <p>
                    {t('分组倍率（模型覆盖）：{{ratio}}', {
                      ratio: Number.isFinite(groupRatio)
                        ? Number(groupRatio).toFixed(4)
                        : '-',
                    })}
                  </p>
                  <p>
                    {t('本次未回传 Token，用预扣额度计费：{{cost}}', {
                      cost: renderQuota(billedQuota, 6),
                    })}
                  </p>
                  {estimatedPreconsumeTokens > 0 && (
                    <p>
                      {t(
                        '预扣 Token 基数（估算）：{{tokens}}（公式：quota / model_ratio / group_ratio）',
                        {
                          tokens: renderNumber(estimatedPreconsumeTokens),
                        },
                      )}
                    </p>
                  )}
                  <p>{t('仅供参考，以实际扣费为准')}</p>
                </article>
              );
            }
          } else {
            content = renderModelPrice(
              logs[i].prompt_tokens,
              logs[i].completion_tokens,
              other?.model_ratio,
              other?.model_price,
              other?.completion_ratio,
              other?.group_ratio,
              other?.user_group_ratio,
              other?.cache_tokens || 0,
              other?.cache_ratio || 1.0,
              other?.image || false,
              other?.image_ratio || 0,
              other?.image_output || 0,
              other?.web_search || false,
              other?.web_search_call_count || 0,
              other?.web_search_price || 0,
              other?.file_search || false,
              other?.file_search_call_count || 0,
              other?.file_search_price || 0,
              other?.audio_input_seperate_price || false,
              other?.audio_input_token_count || 0,
              other?.audio_input_price || 0,
              other?.image_generation_call || false,
              other?.image_generation_call_price || 0,
              billingDisplayMode,
              other?.group_ratio_source,
              other,
            );
          }
          expandDataLocal.push({
            key: t('计费过程'),
            value: content,
          });
        }
        if (other?.reasoning_effort) {
          expandDataLocal.push({
            key: t('Reasoning Effort'),
            value: other.reasoning_effort,
          });
        }
      }
      if (logs[i].type === 6) {
        if (logs[i]?.token_name) {
          expandDataLocal.push({
            key: t('令牌'),
            value: `${logs[i].token_name}${logs[i]?.token_id ? ` (#${logs[i].token_id})` : ''}`,
          });
        }
        if (logs[i]?.model_name) {
          expandDataLocal.push({
            key: t('模型'),
            value: logs[i].model_name,
          });
        }
        if (other?.task_id) {
          expandDataLocal.push({
            key: t('任务ID'),
            value: other.task_id,
          });
        }
        if (other?.reason) {
          expandDataLocal.push({
            key: t('失败原因'),
            value: (
              <div
                style={{
                  maxWidth: 600,
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                  lineHeight: 1.6,
                }}
              >
                {other.reason}
              </div>
            ),
          });
        }
      }
      if (other?.request_path) {
        expandDataLocal.push({
          key: t('请求路径'),
          value: other.request_path,
        });
      }
      if (other?.cache_status) {
        expandDataLocal.push({
          key: t('缓存状态（上游）'),
          value: other.cache_status,
        });
      }
      if (other?.cache_miss_reason) {
        let missReasonDetail = other.cache_miss_reason;
        expandDataLocal.push({
          key: t('缓存未命中原因（上游）'),
          value: (
            <div
              style={{
                maxWidth: 600,
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                lineHeight: 1.6,
              }}
            >
              {missReasonDetail}
            </div>
          ),
        });
      }
      if (other?.cache_miss_local_hint) {
        let hintDetail = other.cache_miss_local_hint;
        if (
          other.cache_miss_local_hint === 'below_min_prompt_tokens' &&
          typeof other?.cache_prompt_tokens_observed === 'number' &&
          typeof other?.cache_min_tokens_required === 'number'
        ) {
          hintDetail += ` (${other.cache_prompt_tokens_observed}/${other.cache_min_tokens_required})`;
        }
        expandDataLocal.push({
          key: t('缓存未命中提示（本地）'),
          value: (
            <div
              style={{
                maxWidth: 600,
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                lineHeight: 1.6,
              }}
            >
              {hintDetail}
            </div>
          ),
        });
      }
      if (other?.billing_source === 'subscription') {
        const planId = other?.subscription_plan_id;
        const planTitle = other?.subscription_plan_title || '';
        const subscriptionId = other?.subscription_id;
        const unit = t('额度');
        const pre = other?.subscription_pre_consumed ?? 0;
        const postDelta = other?.subscription_post_delta ?? 0;
        const finalConsumed = other?.subscription_consumed ?? pre + postDelta;
        const remain = other?.subscription_remain;
        const total = other?.subscription_total;
        // Use multiple Description items to avoid an overlong single line.
        if (planId) {
          expandDataLocal.push({
            key: t('订阅套餐'),
            value: `#${planId} ${planTitle}`.trim(),
          });
        }
        if (subscriptionId) {
          expandDataLocal.push({
            key: t('订阅实例'),
            value: `#${subscriptionId}`,
          });
        }
        const settlementLines = [
          `${t('预扣')}：${pre} ${unit}`,
          `${t('结算差额')}：${postDelta > 0 ? '+' : ''}${postDelta} ${unit}`,
          `${t('最终抵扣')}：${finalConsumed} ${unit}`,
        ]
          .filter(Boolean)
          .join('\n');
        expandDataLocal.push({
          key: t('订阅结算'),
          value: (
            <div style={{ whiteSpace: 'pre-line' }}>{settlementLines}</div>
          ),
        });
        if (remain !== undefined && total !== undefined) {
          expandDataLocal.push({
            key: t('订阅剩余'),
            value: `${remain}/${total} ${unit}`,
          });
        }
        expandDataLocal.push({
          key: t('订阅说明'),
          value: t(
            'token 会按倍率换算成“额度/次数”，请求结束后再做差额结算（补扣/返还）。',
          ),
        });
      }
      if (isAdminUser && logs[i].type !== 6) {
        expandDataLocal.push({
          key: t('请求转换'),
          value: requestConversionDisplayValue(other?.request_conversion),
        });
      }
      if (isAdminUser && logs[i].type !== 6) {
        let localCountMode = '';
        if (other?.admin_info?.local_count_tokens) {
          localCountMode = t('本地计费');
        } else {
          localCountMode = t('上游返回');
        }
        expandDataLocal.push({
          key: t('计费模式'),
          value: localCountMode,
        });
      }
      expandDatesLocal[logs[i].key] = expandDataLocal;
    }

    setExpandData(expandDatesLocal);
    setLogs(logs);
  };

  // Load logs function
  const loadLogs = async (startIdx, pageSize, customLogType = null) => {
    setLoading(true);

    let url = '';
    const {
      username,
      token_name,
      model_name,
      start_timestamp,
      end_timestamp,
      channel,
      group,
      pricing_group,
      request_id,
      logType: formLogType,
      exactRequestSearch,
    } = getFormValues();

    const currentLogType =
      customLogType !== null
        ? customLogType
        : formLogType !== undefined
          ? formLogType
          : logType;

    let localStartTimestamp = exactRequestSearch
      ? 0
      : Date.parse(start_timestamp) / 1000;
    let localEndTimestamp = exactRequestSearch
      ? 0
      : Date.parse(end_timestamp) / 1000;
    if (isAdminUser) {
      url = `/api/log/?p=${startIdx}&page_size=${pageSize}&type=${currentLogType}&username=${username}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&channel=${channel}&group=${group}&pricing_group=${pricing_group}&request_id=${request_id}`;
    } else {
      url = `/api/log/self/?p=${startIdx}&page_size=${pageSize}&type=${currentLogType}&token_name=${token_name}&model_name=${model_name}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&group=${group}&pricing_group=${pricing_group}&request_id=${request_id}`;
    }
    url = encodeURI(url);
    const res = await API.get(url);
    const { success, message, data } = res.data;
    if (success) {
      const newPageData = data.items;
      setActivePage(data.page);
      setPageSize(data.page_size);
      setLogCount(data.total);

      setLogsFormat(newPageData);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  // Page handlers
  const handlePageChange = (page) => {
    setActivePage(page);
    loadLogs(page, pageSize).then((r) => {});
  };

  const handlePageSizeChange = async (size) => {
    localStorage.setItem('page-size', size + '');
    setPageSize(size);
    setActivePage(1);
    loadLogs(activePage, size)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  };

  // Refresh function
  const refresh = async () => {
    setActivePage(1);
    handleEyeClick();
    await loadLogs(1, pageSize);
  };

  // Copy text function
  const copyText = async (e, text) => {
    e.stopPropagation();
    if (await copy(text)) {
      showSuccess('已复制：' + text);
    } else {
      Modal.error({ title: t('无法复制到剪贴板，请手动复制'), content: text });
    }
  };

  // Initialize data
  useEffect(() => {
    const localPageSize =
      parseInt(localStorage.getItem('page-size')) || ITEMS_PER_PAGE;
    setPageSize(localPageSize);
    loadLogs(activePage, localPageSize)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  }, []);

  // Initialize statistics when formApi is available
  useEffect(() => {
    if (formApi) {
      handleEyeClick();
    }
  }, [formApi]);

  // Check if any record has expandable content
  const hasExpandableRows = () => {
    return logs.some(
      (log) => expandData[log.key] && expandData[log.key].length > 0,
    );
  };

  return {
    // Basic state
    logs,
    expandData,
    showStat,
    loading,
    loadingStat,
    activePage,
    logCount,
    pageSize,
    logType,
    stat,
    isAdminUser,

    // Form state
    formApi,
    setFormApi,
    formInitValues,
    getFormValues,

    // Column visibility
    visibleColumns,
    showColumnSelector,
    setShowColumnSelector,
    billingDisplayMode,
    setBillingDisplayMode,
    handleColumnVisibilityChange,
    handleSelectAll,
    initDefaultColumns,
    COLUMN_KEYS,

    // Compact mode
    compactMode,
    setCompactMode,

    // User info modal
    showUserInfo,
    setShowUserInfoModal,
    userInfoData,
    showUserInfoFunc,

    // Channel affinity usage cache stats modal
    showChannelAffinityUsageCacheModal,
    setShowChannelAffinityUsageCacheModal,
    channelAffinityUsageCacheTarget,
    openChannelAffinityUsageCacheModal,

    // Functions
    loadLogs,
    handlePageChange,
    handlePageSizeChange,
    refresh,
    copyText,
    handleEyeClick,
    setLogsFormat,
    hasExpandableRows,
    setLogType,

    // Translation
    t,
  };
};
