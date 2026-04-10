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

import React from 'react';
import {
  Avatar,
  Space,
  Tag,
  Tooltip,
  Popover,
  Typography,
  Button
} from '@douyinfe/semi-ui';
import {
  timestamp2string,
  renderGroup,
  renderQuota,
  stringToColor,
  getLogOther,
  renderModelTag,
  renderClaudeLogContent,
  renderLogContent,
  renderModelPriceSimple,
  renderAudioModelPrice,
  renderClaudeModelPrice,
  renderModelPrice,
  getQuotaPerUnit,
  getCurrencyConfig,
} from '../../../helpers';
import { IconHelpCircle } from '@douyinfe/semi-icons';
import { Route, Sparkles } from 'lucide-react';

const colors = [
  'amber',
  'blue',
  'cyan',
  'green',
  'grey',
  'indigo',
  'light-blue',
  'lime',
  'orange',
  'pink',
  'purple',
  'red',
  'teal',
  'violet',
  'yellow',
];

function formatRatio(ratio) {
  if (ratio === undefined || ratio === null) {
    return '-';
  }
  if (typeof ratio === 'number') {
    return ratio.toFixed(4);
  }
  return String(ratio);
}

function buildChannelAffinityTooltip(affinity, t) {
  if (!affinity) {
    return null;
  }

  const keySource = affinity.key_source || '-';
  const keyPath = affinity.key_path || affinity.key_key || '-';
  const keyHint = affinity.key_hint || '';
  const keyFp = affinity.key_fp ? `#${affinity.key_fp}` : '';
  const keyText = `${keySource}:${keyPath}${keyFp}`;

  const lines = [
    t('渠道亲和性'),
    `${t('规则')}：${affinity.rule_name || '-'}`,
    `${t('分组')}：${affinity.selected_group || '-'}`,
    `${t('Key')}：${keyText}`,
    ...(keyHint ? [`${t('Key 摘要')}：${keyHint}`] : []),
  ];

  return (
    <div style={{ lineHeight: 1.6, display: 'flex', flexDirection: 'column' }}>
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

// Render functions
function renderType(type, t) {
  switch (type) {
    case 1:
      return (
        <Tag color='cyan' shape='circle'>
          {t('充值')}
        </Tag>
      );
    case 2:
      return (
        <Tag color='lime' shape='circle'>
          {t('消费')}
        </Tag>
      );
    case 3:
      return (
        <Tag color='orange' shape='circle'>
          {t('管理')}
        </Tag>
      );
    case 4:
      return (
        <Tag color='purple' shape='circle'>
          {t('系统')}
        </Tag>
      );
    case 5:
      return (
        <Tag color='red' shape='circle'>
          {t('错误')}
        </Tag>
      );
    case 6:
      return (
        <Tag color='teal' shape='circle'>
          {t('退款')}
        </Tag>
      );
    default:
      return (
        <Tag color='grey' shape='circle'>
          {t('未知')}
        </Tag>
      );
  }
}

function renderIsStream(bool, t) {
  if (bool) {
    return (
      <Tag color='blue' shape='circle'>
        {t('流')}
      </Tag>
    );
  } else {
    return (
      <Tag color='purple' shape='circle'>
        {t('非流')}
      </Tag>
    );
  }
}

function renderUseTime(type, t) {
  const time = parseInt(type);
  if (time < 101) {
    return (
      <Tag color='green' shape='circle'>
        {' '}
        {time} s{' '}
      </Tag>
    );
  } else if (time < 300) {
    return (
      <Tag color='orange' shape='circle'>
        {' '}
        {time} s{' '}
      </Tag>
    );
  } else {
    return (
      <Tag color='red' shape='circle'>
        {' '}
        {time} s{' '}
      </Tag>
    );
  }
}

function renderFirstUseTime(type, t) {
  let time = parseFloat(type) / 1000.0;
  time = time.toFixed(1);
  if (time < 3) {
    return (
      <Tag color='green' shape='circle'>
        {' '}
        {time} s{' '}
      </Tag>
    );
  } else if (time < 10) {
    return (
      <Tag color='orange' shape='circle'>
        {' '}
        {time} s{' '}
      </Tag>
    );
  } else {
    return (
      <Tag color='red' shape='circle'>
        {' '}
        {time} s{' '}
      </Tag>
    );
  }
}

function renderBillingTag(record, t) {
  const other = getLogOther(record.other);
  if (other?.billing_source === 'subscription') {
    return (
      <Tag color='green' shape='circle'>
        {t('订阅抵扣')}
      </Tag>
    );
  }
  return null;
}

function renderModelName(record, copyText, t) {
  let other = getLogOther(record.other);
  let modelMapped =
    other?.is_model_mapped &&
    other?.upstream_model_name &&
    other?.upstream_model_name !== '';
  if (!modelMapped) {
    return renderModelTag(record.model_name, {
      onClick: (event) => {
        copyText(event, record.model_name).then((r) => {});
      },
    });
  } else {
    return (
      <>
        <Space vertical align={'start'}>
          <Popover
            content={
              <div style={{ padding: 10 }}>
                <Space vertical align={'start'}>
                  <div className='flex items-center'>
                    <Typography.Text strong style={{ marginRight: 8 }}>
                      {t('请求并计费模型')}:
                    </Typography.Text>
                    {renderModelTag(record.model_name, {
                      onClick: (event) => {
                        copyText(event, record.model_name).then((r) => {});
                      },
                    })}
                  </div>
                  <div className='flex items-center'>
                    <Typography.Text strong style={{ marginRight: 8 }}>
                      {t('实际模型')}:
                    </Typography.Text>
                    {renderModelTag(other.upstream_model_name, {
                      onClick: (event) => {
                        copyText(event, other.upstream_model_name).then(
                          (r) => {},
                        );
                      },
                    })}
                  </div>
                </Space>
              </div>
            }
          >
            {renderModelTag(record.model_name, {
              onClick: (event) => {
                copyText(event, record.model_name).then((r) => {});
              },
              suffixIcon: (
                <Route
                  style={{ width: '0.9em', height: '0.9em', opacity: 0.75 }}
                />
              ),
            })}
          </Popover>
        </Space>
      </>
    );
  }
}

function toTokenNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed;
}

function formatTokenCount(value) {
  return toTokenNumber(value).toLocaleString();
}

function isDeferredTokenRecalculateLog(record, other) {
  if (!other?.deferred_settle) {
    return false;
  }
  const reason = String(other?.terminal_charge_reason || '').toLowerCase();
  const content = String(record?.content || '').toLowerCase();
  const hasTokenUsage =
    toTokenNumber(other?.task_total_tokens) > 0 ||
    toTokenNumber(other?.task_completion_tokens) > 0 ||
    toTokenNumber(other?.task_prompt_tokens) > 0;
  return (
    reason.startsWith('token_recalculate') ||
    reason.startsWith('token重算') ||
    content.startsWith('token_recalculate') ||
    content.startsWith('token重算') ||
    hasTokenUsage
  );
}

function isDeferredSettlePendingLog(record, other) {
  if (!other?.deferred_settle) {
    return false;
  }
  if (isDeferredTokenRecalculateLog(record, other)) {
    return false;
  }
  const state = String(other?.terminal_charge_state || '').toLowerCase();
  return state === 'pending';
}

function deriveEffectiveTokenPricePer1M(quota, totalTokens) {
  const quotaValue = Number(quota);
  const tokensValue = Number(totalTokens);
  const quotaPerUnit = Number(getQuotaPerUnit());
  if (
    !Number.isFinite(quotaValue) ||
    quotaValue <= 0 ||
    !Number.isFinite(tokensValue) ||
    tokensValue <= 0 ||
    !Number.isFinite(quotaPerUnit) ||
    quotaPerUnit <= 0
  ) {
    return null;
  }
  const totalUsd = quotaValue / quotaPerUnit;
  return (totalUsd * 1000000) / tokensValue;
}

function formatDisplayPrice(usdAmount) {
  if (!Number.isFinite(usdAmount)) {
    return '-';
  }
  const { symbol, rate } = getCurrencyConfig();
  return `${symbol}${(usdAmount * rate).toFixed(6)}`;
}

function buildDeferredTokenFormulaPreview(record, other, t) {
  const promptTokens =
    toTokenNumber(record?.prompt_tokens) || toTokenNumber(other?.task_prompt_tokens);
  const completionTokens =
    toTokenNumber(record?.completion_tokens) ||
    toTokenNumber(other?.task_completion_tokens);
  const cacheTokens = toTokenNumber(other?.cache_tokens);
  const modelRatio = Number(other?.model_ratio);
  const completionRatio = Number(other?.completion_ratio || 1);
  const cacheRatio = Number(other?.cache_ratio || 1);
  const groupRatio = Number(other?.group_ratio);

  if (
    !Number.isFinite(modelRatio) ||
    modelRatio <= 0 ||
    !Number.isFinite(completionRatio) ||
    completionRatio <= 0 ||
    !Number.isFinite(groupRatio) ||
    groupRatio <= 0
  ) {
    return null;
  }

  const inputPrice = modelRatio * 2;
  const completionPrice = inputPrice * completionRatio;
  const cachePrice = inputPrice * cacheRatio;
  const nonCacheInputTokens = Math.max(promptTokens - cacheTokens, 0);

  const terms = [];
  if (nonCacheInputTokens > 0) {
    terms.push(
      `${t('输入')} ${formatTokenCount(nonCacheInputTokens)} tokens / 1M tokens * $${inputPrice.toFixed(6)}`,
    );
  }
  if (cacheTokens > 0) {
    terms.push(
      `${t('缓存')} ${formatTokenCount(cacheTokens)} tokens / 1M tokens * $${cachePrice.toFixed(6)}`,
    );
  }
  if (completionTokens > 0) {
    terms.push(
      `${t('输出')} ${formatTokenCount(completionTokens)} tokens / 1M tokens * $${completionPrice.toFixed(6)}`,
    );
  }
  if (terms.length === 0) {
    return null;
  }

  return `(${terms.join(' + ')}) * ${t('分组倍率（模型覆盖）')} ${groupRatio}`;
}

function buildDeferredPendingFormulaPreview(other, t) {
  const quota = Number(other?.estimated_quota);
  const modelRatio = Number(other?.model_ratio);
  const groupRatio = Number(other?.group_ratio);
  if (
    !Number.isFinite(quota) ||
    quota <= 0 ||
    !Number.isFinite(modelRatio) ||
    modelRatio <= 0 ||
    !Number.isFinite(groupRatio) ||
    groupRatio <= 0
  ) {
    return null;
  }
  const estimatedTokens = Math.round(quota / (modelRatio * groupRatio));
  const inputPrice = modelRatio * 2;
  return `(${t('预扣')} ${formatTokenCount(estimatedTokens)} tokens / 1M tokens * $${inputPrice.toFixed(6)}) * ${t('分组倍率（模型覆盖）')} ${groupRatio.toFixed(4)} = ${renderQuota(quota, 6)}`;
}

function getPromptCacheSummary(other) {
  if (!other || typeof other !== 'object') {
    return null;
  }

  const cacheReadTokens = toTokenNumber(other.cache_tokens);
  const cacheCreationTokens = toTokenNumber(other.cache_creation_tokens);
  const cacheCreationTokens5m = toTokenNumber(other.cache_creation_tokens_5m);
  const cacheCreationTokens1h = toTokenNumber(other.cache_creation_tokens_1h);

  const hasSplitCacheCreation =
    cacheCreationTokens5m > 0 || cacheCreationTokens1h > 0;
  const cacheWriteTokens = hasSplitCacheCreation
    ? cacheCreationTokens5m + cacheCreationTokens1h
    : cacheCreationTokens;

  if (cacheReadTokens <= 0 && cacheWriteTokens <= 0) {
    return null;
  }

  return {
    cacheReadTokens,
    cacheWriteTokens,
  };
}

function buildTokenUsageSummary(record, other, t) {
  if (!record || record.type !== 2) {
    return '';
  }
  const promptTokens = toTokenNumber(
    record?.prompt_tokens || other?.task_prompt_tokens,
  );
  const completionTokens = toTokenNumber(
    record?.completion_tokens || other?.task_completion_tokens,
  );
  let totalTokens = promptTokens + completionTokens;
  if (totalTokens <= 0) {
    totalTokens = toTokenNumber(other?.task_total_tokens);
  }
  if (totalTokens <= 0) {
    return '';
  }

  const parts = [`${t('Token 消耗')}：${formatTokenCount(totalTokens)}`];
  if (promptTokens > 0 || completionTokens > 0) {
    parts.push(
      `${t('输入 Tokens')} ${formatTokenCount(promptTokens)} / ${t('输出 Tokens')} ${formatTokenCount(completionTokens)}`,
    );
  }
  return parts.join(' | ');
}

export const getLogsColumns = ({
  t,
  COLUMN_KEYS,
  copyText,
  showUserInfoFunc,
  openChannelAffinityUsageCacheModal,
  isAdminUser,
  isMobile = false,
  billingDisplayMode = 'price',
}) => {
  return [
    {
      key: COLUMN_KEYS.TIME,
      title: t('时间'),
      dataIndex: 'timestamp2string',
    },
    {
      key: COLUMN_KEYS.CHANNEL,
      title: t('渠道'),
      dataIndex: 'channel',
      render: (text, record, index) => {
        const fullChannelName = (record.channel_name || String(text || '')).trim();
        const shortChannelName = fullChannelName
          ? fullChannelName.slice(0, 2)
          : String(text || '-');
        let isMultiKey = false;
        let multiKeyIndex = -1;
        let content = t('渠道') + `：${record.channel}`;
        let affinity = null;
        let showMarker = false;
        let other = getLogOther(record.other);
        if (other?.admin_info) {
          let adminInfo = other.admin_info;
          if (adminInfo?.is_multi_key) {
            isMultiKey = true;
            multiKeyIndex = adminInfo.multi_key_index;
          }
          if (
            Array.isArray(adminInfo.use_channel) &&
            adminInfo.use_channel.length > 0
          ) {
            content = t('渠道') + `：${adminInfo.use_channel.join('->')}`;
          }
          if (adminInfo.channel_affinity) {
            affinity = adminInfo.channel_affinity;
            showMarker = true;
          }
        }

        return isAdminUser &&
          (record.type === 0 || record.type === 2 || record.type === 5 || record.type === 6) ? (
          <Space>
            <span style={{ position: 'relative', display: 'inline-block' }}>
              <Tooltip content={fullChannelName || t('未知渠道')}>
                <span>
                  <Tag
                    color={colors[(parseInt(text, 10) || 0) % colors.length]}
                    shape='circle'
                  >
                    {shortChannelName}
                  </Tag>
                </span>
              </Tooltip>
              {showMarker && (
                <Tooltip
                  content={
                    <div style={{ lineHeight: 1.6 }}>
                      <div>{content}</div>
                      {affinity ? (
                        <div style={{ marginTop: 6 }}>
                          {buildChannelAffinityTooltip(affinity, t)}
                        </div>
                      ) : null}
                    </div>
                  }
                >
                  <span
                    style={{
                      position: 'absolute',
                      right: -4,
                      top: -4,
                      lineHeight: 1,
                      fontWeight: 600,
                      color: '#f59e0b',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openChannelAffinityUsageCacheModal?.(affinity);
                    }}
                  >
                    <Sparkles
                      size={14}
                      strokeWidth={2}
                      color='currentColor'
                      fill='currentColor'
                    />
                  </span>
                </Tooltip>
              )}
            </span>
            {isMultiKey && (
              <Tag color='white' shape='circle'>
                {multiKeyIndex}
              </Tag>
            )}
          </Space>
        ) : null;
      },
    },
    {
      key: COLUMN_KEYS.CHANNEL_ID,
      title: '渠道ID',
      dataIndex: 'channel',
      render: (text, record, index) => {
        return isAdminUser &&
          (record.type === 0 || record.type === 2 || record.type === 5 || record.type === 6) ? (
          <Tag
            color={colors[(parseInt(text, 10) || 0) % colors.length]}
            shape='circle'
            onClick={(event) => {
              copyText(event, text);
            }}
          >
            {text}
          </Tag>
        ) : null;
      },
    },
    {
      key: COLUMN_KEYS.USERNAME,
      title: t('用户'),
      dataIndex: 'username',
      render: (text, record, index) => {
        return isAdminUser ? (
          <div>
            <Avatar
              size='extra-small'
              color={stringToColor(text)}
              style={{ marginRight: 4 }}
              onClick={(event) => {
                event.stopPropagation();
                showUserInfoFunc(record.user_id);
              }}
            >
              {typeof text === 'string' && text.slice(0, 1)}
            </Avatar>
            {text}
          </div>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.TOKEN,
      title: t('令牌'),
      dataIndex: 'token_name',
      render: (text, record, index) => {
        return record.type === 0 || record.type === 2 || record.type === 5 || record.type === 6 ? (
          <div>
            <Tag
              color='grey'
              shape='circle'
              onClick={(event) => {
                copyText(event, text);
              }}
            >
              {' '}
              {t(text)}{' '}
            </Tag>
          </div>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.GROUP,
      title: t('分组'),
      dataIndex: 'group',
      render: (text, record, index) => {
        if (record.type === 0 || record.type === 2 || record.type === 5 || record.type === 6) {
          if (record.group) {
            return <>{renderGroup(record.group)}</>;
          } else {
            let other = null;
            try {
              other = JSON.parse(record.other);
            } catch (e) {
              console.error(
                `Failed to parse record.other: "${record.other}".`,
                e,
              );
            }
            if (other === null) {
              return <></>;
            }
            if (other.group !== undefined) {
              return <>{renderGroup(other.group)}</>;
            } else {
              return <></>;
            }
          }
        } else {
          return <></>;
        }
      },
    },
    {
      key: COLUMN_KEYS.PRICING_GROUP,
      title: t('定价分组'),
      dataIndex: 'pricing_group',
      render: (text, record, index) => {
        if (record.type === 0 || record.type === 2 || record.type === 5 || record.type === 6) {
          if (text) {
            return <>{renderGroup(text)}</>;
          }
        }
        return <></>;
      },
    },
    {
      key: COLUMN_KEYS.TYPE,
      title: t('类型'),
      dataIndex: 'type',
      render: (text, record, index) => {
        return <>{renderType(text, t)}</>;
      },
    },
    {
      key: COLUMN_KEYS.MODEL,
      title: t('模型'),
      dataIndex: 'model_name',
      render: (text, record, index) => {
        return record.type === 0 || record.type === 2 || record.type === 5 || record.type === 6 ? (
          <>{renderModelName(record, copyText, t)}</>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.USE_TIME,
      title: t('用时/首字'),
      dataIndex: 'use_time',
      render: (text, record, index) => {
        if (!(record.type === 2 || record.type === 5)) {
          return <></>;
        }
        if (record.is_stream) {
          let other = getLogOther(record.other);
          return (
            <>
              <Space>
                {renderUseTime(text, t)}
                {renderFirstUseTime(other?.frt, t)}
                {renderIsStream(record.is_stream, t)}
              </Space>
            </>
          );
        } else {
          return (
            <>
              <Space>
                {renderUseTime(text, t)}
                {renderIsStream(record.is_stream, t)}
              </Space>
            </>
          );
        }
      },
    },
    {
      key: COLUMN_KEYS.PROMPT,
      title: (
        <div className='flex items-center gap-1'>
          {t('输入')}
          <Tooltip
            content={t(
              '根据 Anthropic 协定，/v1/messages 的输入 tokens 仅统计非缓存输入，不包含缓存读取与缓存写入 tokens。',
            )}
          >
            <IconHelpCircle className='text-gray-400 cursor-help' />
          </Tooltip>
        </div>
      ),
      dataIndex: 'prompt_tokens',
      render: (text, record, index) => {
        const other = getLogOther(record.other);
        const cacheSummary = getPromptCacheSummary(other);
        const hasCacheRead = (cacheSummary?.cacheReadTokens || 0) > 0;
        const hasCacheWrite = (cacheSummary?.cacheWriteTokens || 0) > 0;
        let cacheText = '';
        if (hasCacheRead && hasCacheWrite) {
          cacheText = `${t('缓存读')} ${formatTokenCount(cacheSummary.cacheReadTokens)} · ${t('写')} ${formatTokenCount(cacheSummary.cacheWriteTokens)}`;
        } else if (hasCacheRead) {
          cacheText = `${t('缓存读')} ${formatTokenCount(cacheSummary.cacheReadTokens)}`;
        } else if (hasCacheWrite) {
          cacheText = `${t('缓存写')} ${formatTokenCount(cacheSummary.cacheWriteTokens)}`;
        }

        return record.type === 0 || record.type === 2 || record.type === 5 || record.type === 6 ? (
          <div
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              lineHeight: 1.2,
            }}
          >
            <span>{text}</span>
            {cacheText ? (
              <span
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  color: 'var(--semi-color-text-2)',
                  whiteSpace: 'nowrap',
                }}
              >
                {cacheText}
              </span>
            ) : null}
          </div>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.COMPLETION,
      title: t('输出'),
      dataIndex: 'completion_tokens',
      render: (text, record, index) => {
        return parseInt(text) > 0 &&
          (record.type === 0 || record.type === 2 || record.type === 5 || record.type === 6) ? (
          <>{<span> {text} </span>}</>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.COST,
      title: t('花费'),
      dataIndex: 'quota',
      render: (text, record, index) => {
        if (!(record.type === 0 || record.type === 2 || record.type === 5 || record.type === 6)) {
          return <></>;
        }
        const other = getLogOther(record.other);
        const isSubscription = other?.billing_source === 'subscription';
        if (isSubscription) {
          // Subscription billed: show only tag (no $0), but keep tooltip for equivalent cost.
          return (
            <Tooltip content={`${t('由订阅抵扣')}：${renderQuota(text, 6)}`}>
              <span>{renderBillingTag(record, t)}</span>
            </Tooltip>
          );
        }
        return <>{renderQuota(text, 6)}</>;
      },
    },
    {
      key: COLUMN_KEYS.IP,
      title: (
        <div className='flex items-center gap-1'>
          {t('IP')}
          <Tooltip
            content={t(
              '只有当用户设置开启IP记录时，才会进行请求和错误类型日志的IP记录',
            )}
          >
            <IconHelpCircle className='text-gray-400 cursor-help' />
          </Tooltip>
        </div>
      ),
      dataIndex: 'ip',
      render: (text, record, index) => {
        return (record.type === 2 || record.type === 5) && text ? (
          <Tooltip content={text}>
            <span>
              <Tag
                color='orange'
                shape='circle'
                onClick={(event) => {
                  copyText(event, text);
                }}
              >
                {text}
              </Tag>
            </span>
          </Tooltip>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.RETRY,
      title: t('重试'),
      dataIndex: 'retry',
      render: (text, record, index) => {
        if (!(record.type === 2 || record.type === 5)) {
          return <></>;
        }
        let content = t('渠道') + `：${record.channel}`;
        if (record.other !== '') {
          let other = JSON.parse(record.other);
          if (other === null) {
            return <></>;
          }
          if (other.admin_info !== undefined) {
            if (
                other.admin_info.use_channel !== null &&
                other.admin_info.use_channel !== undefined &&
                other.admin_info.use_channel !== ''
            ) {
              let useChannel = other.admin_info.use_channel;
              let useChannelStr = useChannel.join('->');
              content = t('渠道') + `：${useChannelStr}`;
            }
          }
        }
        return isAdminUser ? <div>{content}</div> : <></>;
      },
    },
    {
      key: COLUMN_KEYS.DETAILS,
      title: t('详情'),
      dataIndex: 'content',
      fixed: 'right',
      render: (text, record, index) => {
        let other = getLogOther(record.other);
        if (record.type === 6) {
          const refundTarget = [
            record?.token_name ? `${t('令牌')}：${record.token_name}` : null,
            record?.token_id ? `${t('令牌ID')}：${record.token_id}` : null,
            record?.model_name ? `${t('模型')}：${record.model_name}` : null,
          ]
            .filter(Boolean)
            .join('\n');
          const summary = [t('异步任务退款'), refundTarget].filter(Boolean).join('\n');
          return (
            <Typography.Paragraph
              ellipsis={{ rows: 2 }}
              style={{ maxWidth: 240 }}
            >
              {summary}
            </Typography.Paragraph>
          );
        }
        if (other == null || record.type !== 2) {
          const tokenSummary = buildTokenUsageSummary(record, other, t);
          const plainContent = tokenSummary
            ? [tokenSummary, text].filter(Boolean).join('\n')
            : text;
          return (
            <Typography.Paragraph
              ellipsis={{
                rows: 2,
                showTooltip: {
                  type: 'popover',
                  opts: { style: { width: 240 } },
                },
              }}
              style={{ maxWidth: 240 }}
            >
              {plainContent}
            </Typography.Paragraph>
          );
        }

        if (
          other?.violation_fee === true ||
          Boolean(other?.violation_fee_code) ||
          Boolean(other?.violation_fee_marker)
        ) {
          const feeQuota = other?.fee_quota ?? record?.quota;
          const summary = [
            t('违规扣费'),
            `${t('扣费')}：${renderQuota(feeQuota, 6)}`,
            `${t('分组倍率')}：${formatRatio(other?.group_ratio)}`,
            text ? `${t('详情')}：${text}` : null,
          ]
            .filter(Boolean)
            .join('\n');
          return (
            <Typography.Paragraph
              ellipsis={{
                rows: 2,
                showTooltip: {
                  type: 'popover',
                  opts: { style: { width: 240 } },
                },
              }}
              style={{ maxWidth: 240, whiteSpace: 'pre-line' }}
            >
              {summary}
            </Typography.Paragraph>
          );
        }

        if (
          isDeferredTokenRecalculateLog(record, other) &&
          Number(other?.actual_quota || record?.quota || 0) > 0
        ) {
          const billedQuota = Number(record?.quota || 0);
          const tokenTotal =
            toTokenNumber(other?.task_total_tokens) ||
            toTokenNumber(record?.prompt_tokens) +
              toTokenNumber(record?.completion_tokens);
          const billingSummary = renderLogContent(
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
          );
          const formulaPreview = buildDeferredTokenFormulaPreview(record, other, t);
          const summary = [
            t('终态重算扣费') + `：${renderQuota(billedQuota, 6)}`,
            billingSummary,
            formulaPreview,
            `${t('结算原因')}：${other?.terminal_charge_reason || record?.content || '-'}`,
            tokenTotal > 0
              ? `${t('任务总 Tokens')}：${formatTokenCount(tokenTotal)}`
              : null,
            t('仅供参考，以实际扣费为准'),
          ]
            .filter(Boolean)
            .join('\n');
          return (
            <Typography.Paragraph
              ellipsis={{
                rows: 2,
                showTooltip: {
                  type: 'popover',
                  opts: { style: { width: 240 } },
                },
              }}
              style={{ maxWidth: 240, whiteSpace: 'pre-line' }}
            >
              {summary}
            </Typography.Paragraph>
          );
        }

        if (isDeferredSettlePendingLog(record, other)) {
          const pendingFormula = buildDeferredPendingFormulaPreview(other, t);
          const summary = [
            t('延迟结算（提交阶段）'),
            toTokenNumber(other?.estimated_quota) > 0
              ? `${t('预估扣费')}：${renderQuota(other.estimated_quota, 6)}`
              : null,
            pendingFormula,
            `${t('结算状态')}：${other?.terminal_charge_state || 'pending'}`,
            t('仅供参考，以实际扣费为准'),
          ]
            .filter(Boolean)
            .join('\n');
          return (
            <Typography.Paragraph
              ellipsis={{
                rows: 2,
                showTooltip: {
                  type: 'popover',
                  opts: { style: { width: 240 } },
                },
              }}
              style={{ maxWidth: 240, whiteSpace: 'pre-line' }}
            >
              {summary}
            </Typography.Paragraph>
          );
        }

        const requestPath = String(other?.request_path || '');
        const isNonTextTaskEndpoint =
          requestPath.startsWith('/v1/video/') ||
          requestPath.startsWith('/v1/images/generations') ||
          requestPath.startsWith('/mj/');
        const hasNoTokenUsage =
          toTokenNumber(record?.prompt_tokens) <= 0 &&
          toTokenNumber(record?.completion_tokens) <= 0 &&
          toTokenNumber(other?.task_prompt_tokens) <= 0 &&
          toTokenNumber(other?.task_completion_tokens) <= 0 &&
          toTokenNumber(other?.task_total_tokens) <= 0;

        // Deferred settle tasks: show actual settled amount instead of
        // misleading $0 token-based estimate.
        if (other?.deferred_settle) {
          const billedQuota = toTokenNumber(record?.quota);
          const groupRatio = Number(other?.group_ratio);
          const chargeState = other?.terminal_charge_state || 'pending';
          const estimatedQuota = toTokenNumber(other?.estimated_quota);
          const summaryLines = [
            t('延迟结算'),
            chargeState === 'applied'
              ? `${t('终态重算扣费')}：${renderQuota(billedQuota, 6)}`
              : chargeState === 'skipped'
                ? t('终态未扣费')
                : `${t('等待任务完成结算')}`,
            `${t('分组倍率（模型覆盖）')}：${Number.isFinite(groupRatio) ? groupRatio : '-'}`,
            estimatedQuota > 0
              ? `${t('预估额度')}：${renderQuota(estimatedQuota, 6)}`
              : null,
          ]
            .filter(Boolean)
            .join('\n');
          return (
            <Typography.Paragraph
              ellipsis={{
                rows: 2,
                showTooltip: {
                  type: 'popover',
                  opts: { style: { width: 300 } },
                },
              }}
              style={{ maxWidth: 240, whiteSpace: 'pre-line' }}
            >
              {summaryLines}
            </Typography.Paragraph>
          );
        }

        const modelPrice = Number(other?.model_price);
        if (isNonTextTaskEndpoint && hasNoTokenUsage && !(Number.isFinite(modelPrice) && modelPrice > 0)) {
          const billedQuota = toTokenNumber(record?.quota);
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
          const summary = [
            t('按量计费（预扣阶段）'),
            `${t('输入价格')}：$${Number(modelRatio * 2 || 0).toFixed(6)} / 1M tokens`,
            `${t('分组倍率（模型覆盖）')}：${Number.isFinite(groupRatio) ? groupRatio : '-'}`,
            `${t('本次未回传 Token，用预扣额度计费')}：${renderQuota(billedQuota, 6)}`,
            estimatedPreconsumeTokens > 0
              ? `${t('预扣 Token 基数（估算）')}：${formatTokenCount(estimatedPreconsumeTokens)}`
              : null,
            t('仅供参考，以实际扣费为准'),
          ]
            .filter(Boolean)
            .join('\n');
          return (
            <Typography.Paragraph
              ellipsis={{
                rows: 2,
                showTooltip: {
                  type: 'popover',
                  opts: { style: { width: 300 } },
                },
              }}
              style={{ maxWidth: 240, whiteSpace: 'pre-line' }}
            >
              {summary}
            </Typography.Paragraph>
          );
        }

        let content = other?.claude
          ? renderModelPriceSimple(
              other.model_ratio,
              other.model_price,
              other.group_ratio,
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
              false,
              1.0,
              other?.is_system_prompt_overwritten,
              'claude',
              billingDisplayMode,
              other?.group_ratio_source,
            )
          : renderModelPriceSimple(
              other.model_ratio,
              other.model_price,
              other.group_ratio,
              other?.user_group_ratio,
              other.cache_tokens || 0,
              other.cache_ratio || 1.0,
              0,
              1.0,
              0,
              1.0,
              0,
              1.0,
              false,
              1.0,
              other?.is_system_prompt_overwritten,
              'openai',
              billingDisplayMode,
              other?.group_ratio_source,
            );
        let cacheSummary = '';
        const tokenSummary = buildTokenUsageSummary(record, other, t);
        if (other?.cache_status) {
          let upstreamMissReason = other?.cache_miss_reason || '';
          let localHint = other?.cache_miss_local_hint || '';
          if (
            localHint === 'below_min_prompt_tokens' &&
            Number.isFinite(other?.cache_prompt_tokens_observed) &&
            Number.isFinite(other?.cache_min_tokens_required)
          ) {
            localHint = `${localHint} (${other.cache_prompt_tokens_observed}/${other.cache_min_tokens_required})`;
          }
          cacheSummary = `${t('缓存状态（上游）')}：${other.cache_status}`;
          if (upstreamMissReason) {
            cacheSummary += ` | ${t('缓存未命中原因（上游）')}：${upstreamMissReason}`;
          }
          if (localHint) {
            cacheSummary += ` | ${t('缓存未命中提示（本地）')}：${localHint}`;
          }
        }
        return (
            <Typography.Paragraph
                ellipsis={
                  isMobile
                    ? false
                    : {
                        rows: 3,
                        showTooltip: {
                          type: 'popover',
                          opts: { style: { width: 420 } },
                        },
                      }
                }
                style={{
                  maxWidth: isMobile ? 'none' : 240,
                  whiteSpace: 'pre-line',
                  wordBreak: 'break-word',
                }}
            >
              {[tokenSummary, cacheSummary, content].filter(Boolean).join('\n')}
            </Typography.Paragraph>
        );
      },
    },
  ];
};
