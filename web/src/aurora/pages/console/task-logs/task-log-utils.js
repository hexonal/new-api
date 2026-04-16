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

import {
  TASK_ACTION_FIRST_TAIL_GENERATE,
  TASK_ACTION_GENERATE,
  TASK_ACTION_REFERENCE_GENERATE,
  TASK_ACTION_REMIX_GENERATE,
  TASK_ACTION_TEXT_GENERATE,
} from '../../../../constants/common.constant.js';
import { CHANNEL_OPTIONS } from '../../../../constants/channel.constants.js';

const VIDEO_ACTIONS = new Set([
  TASK_ACTION_GENERATE,
  TASK_ACTION_TEXT_GENERATE,
  TASK_ACTION_FIRST_TAIL_GENERATE,
  TASK_ACTION_REFERENCE_GENERATE,
  TASK_ACTION_REMIX_GENERATE,
]);

const IMAGE_MODEL_KEYWORDS = ['image-preview', 'gpt-image', 'imagen'];
const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|gif|bmp|webp|svg)(\?|$)/i;
const VIDEO_EXTENSION_PATTERN = /\.(mp4|mov|avi|mkv|webm|m4v)(\?|$)/i;

const INPUT_TYPE_LABELS = {
  text: '文本',
  image: '图片',
  video: '视频',
  audio: '音频',
};

export const TASK_COLUMN_CONFIG = [
  { key: 'submit_time', labelKey: 'Submitted Time' },
  { key: 'finish_time', labelKey: 'Completed Time' },
  { key: 'duration', labelKey: 'Duration' },
  { key: 'channel', labelKey: 'Channel' },
  { key: 'username', labelKey: 'User' },
  { key: 'platform', labelKey: 'Platform' },
  { key: 'type', labelKey: 'Type' },
  { key: 'model', labelKey: 'Model' },
  { key: 'task_id', labelKey: 'Task ID' },
  { key: 'task_status', labelKey: 'Status' },
  { key: 'progress', labelKey: 'Progress' },
  { key: 'fail_reason', labelKey: 'Details' },
];

/**
 * 格式化为 datetime-local 输入值。
 * @param {Date} date - 日期对象。
 * @returns {string}
 */
export function formatTaskDateTimeLocalValue(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * 构建任务日志默认筛选条件。
 * @returns {{channel_id:string,task_id:string,from:string,to:string}}
 */
export function buildTaskLogDefaultFilters() {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
  );
  return {
    channel_id: '',
    task_id: '',
    from: formatTaskDateTimeLocalValue(start),
    to: formatTaskDateTimeLocalValue(now),
  };
}

/**
 * 转换为接口日期时间格式。
 * @param {string} value - datetime-local 字符串。
 * @returns {string}
 */
export function toTaskLogApiDateTime(value) {
  if (!value) {
    return '';
  }
  return `${value.replace('T', ' ')}:00`;
}

const TASK_STATUS_META = {
  SUCCESS: {
    labelKey: '成功',
    badgeClassName: 'bg-emerald-50 text-emerald-600',
    progressClassName: 'bg-emerald-500',
  },
  NOT_START: {
    labelKey: '未启动',
    badgeClassName: 'bg-slate-100 text-slate-600',
    progressClassName: 'bg-slate-400',
  },
  SUBMITTED: {
    labelKey: '队列中',
    badgeClassName: 'bg-amber-50 text-amber-700',
    progressClassName: 'bg-amber-500',
  },
  IN_PROGRESS: {
    labelKey: '执行中',
    badgeClassName: 'bg-sky-50 text-sky-700',
    progressClassName: 'bg-sky-500',
  },
  FAILURE: {
    labelKey: '失败',
    badgeClassName: 'bg-rose-50 text-rose-600',
    progressClassName: 'bg-rose-500',
  },
  QUEUED: {
    labelKey: '排队中',
    badgeClassName: 'bg-orange-50 text-orange-700',
    progressClassName: 'bg-orange-500',
  },
  UNKNOWN: {
    labelKey: '未知',
    badgeClassName: 'bg-slate-100 text-slate-600',
    progressClassName: 'bg-slate-400',
  },
};

const TASK_TYPE_META = {
  MUSIC: { labelKey: '生成音乐', className: 'bg-gray-100 text-gray-700' },
  LYRICS: { labelKey: '生成歌词', className: 'bg-pink-50 text-pink-700' },
  [TASK_ACTION_GENERATE]: {
    labelKey: '图生视频',
    className: 'bg-sky-50 text-sky-700',
  },
  [TASK_ACTION_TEXT_GENERATE]: {
    labelKey: '文生视频',
    className: 'bg-sky-50 text-sky-700',
  },
  [TASK_ACTION_FIRST_TAIL_GENERATE]: {
    labelKey: '首尾生视频',
    className: 'bg-sky-50 text-sky-700',
  },
  [TASK_ACTION_REFERENCE_GENERATE]: {
    labelKey: '参照生视频',
    className: 'bg-sky-50 text-sky-700',
  },
  [TASK_ACTION_REMIX_GENERATE]: {
    labelKey: '视频 Remix',
    className: 'bg-sky-50 text-sky-700',
  },
};

/**
 * 构建分页按钮序列。
 * @param {number} currentPage - 当前页。
 * @param {number} totalPages - 总页数。
 * @returns {Array<number|string>}
 */
export function buildPaginationItems(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= 3) {
    return [1, 2, 3, 'ellipsis', totalPages];
  }
  if (currentPage >= totalPages - 2) {
    return [1, 'ellipsis', totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, 'ellipsis-left', currentPage, 'ellipsis-right', totalPages];
}

/**
 * 格式化任务时间。
 * @param {number|string} value - 原始时间。
 * @returns {string}
 */
export function formatTaskTimestamp(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '-';
  }
  const date = new Date(numeric * 1000);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  const second = `${date.getSeconds()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * 格式化耗时。
 * @param {number|string} submitTime - 提交时间。
 * @param {number|string} finishTime - 结束时间。
 * @returns {string}
 */
export function formatTaskDuration(submitTime, finishTime) {
  const start = Number(submitTime);
  const end = Number(finishTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return '-';
  }
  return `${end - start}s`;
}

/**
 * 规范化进度值。
 * @param {string|number} progress - 原始进度。
 * @param {string} status - 任务状态。
 * @returns {number}
 */
export function normalizeTaskProgress(progress, status) {
  const numeric =
    typeof progress === 'string'
      ? Number(progress.replace('%', ''))
      : Number(progress);
  if (!Number.isFinite(numeric)) {
    return status === 'FAILURE' ? 12 : 0;
  }
  return Math.max(0, Math.min(100, numeric));
}

/**
 * 获取旧版语义下的任务状态文本。
 * @param {string} status - 状态值。
 * @param {(key:string)=>string} t - 国际化函数。
 * @returns {string}
 */
export function getTaskStatusLabel(status, t) {
  return t(getTaskStatusMeta(status).labelKey);
}

/**
 * 获取旧版语义下的进度信息。
 * @param {string|number} progress - 原始进度。
 * @returns {{displayText:string,numericValue:number|null}}
 */
export function getTaskProgressInfo(progress) {
  if (progress === undefined || progress === null || progress === '') {
    return { displayText: '-', numericValue: null };
  }

  const rawValue = String(progress).trim();
  if (!rawValue) {
    return { displayText: '-', numericValue: null };
  }

  const numericValue = Number(rawValue.replace('%', ''));
  if (!Number.isFinite(numericValue)) {
    return { displayText: rawValue, numericValue: null };
  }

  const clampedValue = Math.max(0, Math.min(100, parseInt(numericValue, 10)));
  return {
    displayText: `${clampedValue}%`,
    numericValue: clampedValue,
  };
}

/**
 * 获取任务状态元信息。
 * @param {string} status - 状态值。
 * @returns {{labelKey:string,badgeClassName:string,progressClassName:string}}
 */
export function getTaskStatusMeta(status) {
  if (status === '') {
    return {
      labelKey: '正在提交',
      badgeClassName: 'bg-slate-100 text-slate-600',
      progressClassName: 'bg-slate-400',
    };
  }
  return TASK_STATUS_META[status] || TASK_STATUS_META.UNKNOWN;
}

/**
 * 获取平台元信息。
 * @param {string|number} platform - 平台值。
 * @returns {{label:string,className:string}}
 */
export function getTaskPlatformMeta(platform) {
  const matched = CHANNEL_OPTIONS.find(
    (option) => String(option.value) === String(platform),
  );
  if (matched) {
    const colorMap = {
      blue: 'bg-blue-50 text-blue-700',
      purple: 'bg-purple-50 text-purple-700',
      orange: 'bg-orange-50 text-orange-700',
      green: 'bg-emerald-50 text-emerald-700',
      grey: 'bg-slate-100 text-slate-700',
      indigo: 'bg-indigo-50 text-indigo-700',
      teal: 'bg-cyan-50 text-cyan-700',
      violet: 'bg-violet-50 text-violet-700',
      pink: 'bg-pink-50 text-pink-700',
    };
    return {
      label: matched.label,
      className: colorMap[matched.color] || 'bg-slate-100 text-slate-700',
    };
  }

  const label = String(platform || '未知');
  return {
    label,
    className: 'bg-slate-100 text-slate-700',
  };
}

function getTaskModelText(log) {
  return String(
    log?.model_name ||
      log?.model ||
      log?.properties?.origin_model_name ||
      log?.properties?.upstream_model_name ||
      '',
  );
}

function getTaskLowerCaseModelText(log) {
  return getTaskModelText(log).toLowerCase();
}

function getTaskInputParts(inputType) {
  if (!inputType || typeof inputType !== 'string') {
    return [];
  }
  return inputType
    .split(/[,+]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function buildInputTypeMeta(inputType, t) {
  const parts = getTaskInputParts(inputType);
  if (!parts.length) {
    return null;
  }
  const label = parts
    .map((part) => t(INPUT_TYPE_LABELS[part] || part))
    .join('+');
  return {
    label,
    className: 'bg-indigo-50 text-indigo-700',
  };
}

function buildModelTypeMeta(modelName, t) {
  if (!modelName) {
    return null;
  }
  if (modelName.includes('i2v')) {
    return { label: t('图生视频'), className: 'bg-sky-50 text-sky-700' };
  }
  if (modelName.includes('s2v')) {
    return { label: t('参照生视频'), className: 'bg-sky-50 text-sky-700' };
  }
  if (modelName.includes('t2v') || modelName.includes('hailuo')) {
    return { label: t('文生视频'), className: 'bg-sky-50 text-sky-700' };
  }
  return null;
}

/**
 * 获取任务类型元信息。
 * @param {Record<string, unknown>} log - 日志记录。
 * @param {(key:string)=>string} t - 国际化函数。
 * @returns {{label:string,className:string}}
 */
export function getTaskTypeMeta(log, t) {
  const modelName = getTaskLowerCaseModelText(log);
  const inputType = String(log?.properties?.input || '').toLowerCase();
  const isImageModel = IMAGE_MODEL_KEYWORDS.some((keyword) =>
    modelName.includes(keyword),
  );

  if (isImageModel) {
    return {
      label: inputType.includes('image') ? t('图生图') : t('文生图'),
      className: 'bg-sky-50 text-sky-700',
    };
  }

  const inputMeta = buildInputTypeMeta(log?.properties?.input, t);
  if (inputMeta) {
    return inputMeta;
  }

  const modelMeta = buildModelTypeMeta(modelName, t);
  if (modelMeta) {
    return modelMeta;
  }

  const matched = TASK_TYPE_META[log?.action];
  if (matched) {
    return {
      label: t(matched.labelKey),
      className: matched.className,
    };
  }

  return {
    label: t('未知'),
    className: 'bg-slate-100 text-slate-700',
  };
}

/**
 * 判断记录是否为音频结果。
 * @param {Record<string, unknown>} log - 日志记录。
 * @returns {boolean}
 */
export function hasAudioPreview(log) {
  return (
    log?.platform === 'suno' &&
    log?.status === 'SUCCESS' &&
    Array.isArray(log?.data) &&
    log.data.some((clip) => clip?.audio_url)
  );
}

/**
 * 判断记录是否为图片模型。
 * @param {Record<string, unknown>} log - 日志记录。
 * @returns {boolean}
 */
export function isImageResult(log) {
  const modelName = getTaskLowerCaseModelText(log);
  return IMAGE_MODEL_KEYWORDS.some((keyword) => modelName.includes(keyword));
}

function getNestedTaskMediaUrl(log) {
  const result = log?.data?.data?.task_result;
  const videoUrl = result?.videos?.[0]?.url || result?.video_url;
  if (typeof videoUrl === 'string' && /^https?:\/\//.test(videoUrl)) {
    return videoUrl;
  }
  const imageUrl = result?.images?.[0]?.url || result?.image_url;
  if (typeof imageUrl === 'string' && /^https?:\/\//.test(imageUrl)) {
    return imageUrl;
  }
  return '';
}

/**
 * 获取任务结果地址。
 * @param {Record<string, unknown>} log - 日志记录。
 * @returns {string}
 */
export function getTaskResultUrl(log) {
  const directResultUrl = String(log?.result_url || '').trim();
  if (/^https?:\/\//.test(directResultUrl)) {
    return directResultUrl;
  }
  const failReasonUrl = String(log?.fail_reason || '').trim();
  if (/^https?:\/\//.test(failReasonUrl)) {
    return failReasonUrl;
  }
  return getNestedTaskMediaUrl(log);
}

function inferPreviewKindFromUrl(url) {
  if (IMAGE_EXTENSION_PATTERN.test(url)) {
    return 'image';
  }
  if (VIDEO_EXTENSION_PATTERN.test(url)) {
    return 'video';
  }
  return 'none';
}

function isTaskVideoResult(log) {
  const modelName = getTaskLowerCaseModelText(log);
  if (VIDEO_ACTIONS.has(log?.action)) {
    return true;
  }
  return (
    modelName.includes('hailuo') ||
    modelName.includes('vidu') ||
    modelName.includes('kling') ||
    modelName.includes('i2v') ||
    modelName.includes('t2v') ||
    modelName.includes('s2v')
  );
}

/**
 * 解析媒体预览类型。
 * @param {Record<string, unknown>} log - 日志记录。
 * @returns {{kind:'audio'|'image'|'video'|'none',value:unknown}}
 */
export function resolveTaskPreview(log) {
  if (hasAudioPreview(log)) {
    return { kind: 'audio', value: log.data };
  }

  const resultUrl = getTaskResultUrl(log);
  if (!resultUrl || log?.status !== 'SUCCESS') {
    return { kind: 'none', value: null };
  }

  if (isImageResult(log)) {
    return { kind: 'image', value: resultUrl };
  }

  if (isTaskVideoResult(log)) {
    return { kind: 'video', value: resultUrl };
  }

  return {
    kind: inferPreviewKindFromUrl(resultUrl),
    value: resultUrl,
  };
}

/**
 * 获取预览操作元信息。
 * @param {Record<string, unknown>} log - 日志记录。
 * @param {(key:string)=>string} t - 国际化函数。
 * @returns {{label:string,kind:'audio'|'image'|'video'|'detail'|'none'}}
 */
export function getTaskPreviewActionMeta(log, t) {
  if (hasAudioPreview(log)) {
    return { label: t('点击预览音乐'), kind: 'audio' };
  }
  const preview = resolveTaskPreview(log);
  if (preview.kind === 'image') {
    return { label: t('点击预览图片'), kind: 'image' };
  }
  if (preview.kind === 'video') {
    return { label: t('点击预览视频'), kind: 'video' };
  }
  if (log?.fail_reason) {
    return { label: t('点击查看详情'), kind: 'detail' };
  }
  return { label: t('无'), kind: 'none' };
}

/**
 * 获取列表详情列点击行为。
 * @param {Record<string, unknown>} log - 日志记录。
 * @returns {{type:'audio'|'image'|'video'|'text'|'none',payload:unknown}}
 */
export function getTaskListDetailAction(log) {
  const preview = resolveTaskPreview(log);
  const resultUrl = getTaskResultUrl(log);

  if (preview.kind === 'audio') {
    return { type: 'audio', payload: log?.data || [] };
  }

  if (preview.kind === 'image' && resultUrl) {
    return { type: 'image', payload: resultUrl };
  }

  if (preview.kind === 'video' && resultUrl) {
    return { type: 'video', payload: resultUrl };
  }

  if (log?.fail_reason) {
    return { type: 'text', payload: log.fail_reason };
  }

  return { type: 'none', payload: null };
}

/**
 * 获取详情面板内容。
 * @param {Record<string, unknown>} log - 日志记录。
 * @returns {unknown}
 */
export function getTaskDetailPanelValue(log) {
  if (log?.data) {
    return log.data;
  }
  if (log?.fail_reason) {
    return log.fail_reason;
  }
  return null;
}

/**
 * 获取基础信息中的详情摘要。
 * @param {Record<string, unknown>} log - 日志记录。
 * @param {(key:string)=>string} t - 国际化函数。
 * @returns {string}
 */
export function getTaskDetailSummaryValue(log, t) {
  return getTaskDetailPanelValue(log) ? t('JSON 面板') : t('无');
}

/**
 * 安全格式化 JSON。
 * @param {unknown} value - 原始值。
 * @returns {string}
 */
export function formatTaskJson(value) {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return '-';
    }
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return trimmed;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * 获取模型展示名称。
 * @param {Record<string, unknown>} log - 日志记录。
 * @returns {string}
 */
export function getTaskModelName(log) {
  return (
    log?.properties?.origin_model_name ||
    log?.properties?.upstream_model_name ||
    log?.model_name ||
    log?.model ||
    '-'
  );
}

/**
 * 获取消耗模型名称。
 * @param {Record<string, unknown>} log - 日志记录。
 * @returns {string}
 */
export function getTaskConsumedModelName(log) {
  return log?.consumed_model || '-';
}

/**
 * 获取旧版语义下的模型展示文本。
 * @param {Record<string, unknown>} log - 日志记录。
 * @param {(key:string)=>string} t - 国际化函数。
 * @returns {string}
 */
export function getTaskModelDisplayValue(log, t) {
  const modelName = getTaskModelName(log);
  const consumedModel = getTaskConsumedModelName(log);

  if (consumedModel !== '-' && consumedModel !== modelName) {
    return `${modelName}\n${t('消耗模型')}: ${consumedModel}`;
  }

  return modelName;
}

/**
 * 获取上游任务 ID。
 * @param {Record<string, unknown>} log - 日志记录。
 * @returns {string}
 */
export function getTaskUpstreamTaskId(log) {
  return (
    log?.data?.data?.task_id ||
    log?.data?.task_id ||
    log?.properties?.task_id ||
    '-'
  );
}

/**
 * 获取上游状态文本。
 * @param {Record<string, unknown>} log - 日志记录。
 * @returns {string}
 */
export function getTaskProviderStatus(log) {
  return (
    log?.data?.data?.task_status ||
    log?.data?.message ||
    log?.data?.base_resp?.status_msg ||
    '-'
  );
}

/**
 * 获取任务结果摘要。
 * @param {Record<string, unknown>} log - 日志记录。
 * @param {(key:string)=>string} t - 国际化函数。
 * @returns {string}
 */
export function getTaskResultSummary(log, t) {
  if (hasAudioPreview(log)) {
    return `${log.data.length}${t(' 个音频片段')}`;
  }
  const taskResult = log?.data?.data?.task_result;
  if (Array.isArray(taskResult?.videos) && taskResult.videos.length > 0) {
    return `${taskResult.videos.length}${t(' 个视频结果')}`;
  }
  if (Array.isArray(taskResult?.images) && taskResult.images.length > 0) {
    return `${taskResult.images.length}${t(' 张图片')}`;
  }
  const preview = resolveTaskPreview(log);
  if (preview.kind === 'video') {
    return t('视频结果');
  }
  if (preview.kind === 'image') {
    return t('图片结果');
  }
  return '-';
}

/**
 * 获取任务结果载荷。
 * @param {Record<string, unknown>} log - 日志记录。
 * @returns {unknown}
 */
export function getTaskResultPayload(log) {
  return log?.data?.data?.task_result || log?.data || null;
}

/**
 * 构建详情字段。
 * @param {Record<string, unknown>} log - 日志记录。
 * @param {boolean} isAdminUser - 是否管理员。
 * @param {(key:string)=>string} t - 国际化函数。
 * @returns {Array<{label:string,value:string}>}
 */
export function buildTaskDetailItems(log, isAdminUser, t) {
  const progressInfo = getTaskProgressInfo(log?.progress);
  const items = [
    { label: t('提交时间'), value: formatTaskTimestamp(log?.submit_time) },
    { label: t('结束时间'), value: formatTaskTimestamp(log?.finish_time) },
    {
      label: t('花费时间'),
      value: formatTaskDuration(log?.submit_time, log?.finish_time),
    },
  ];

  if (isAdminUser) {
    items.push({
      label: t('渠道'),
      value: log?.channel_name || log?.channel_id || '-',
    });
    items.push({
      label: t('用户'),
      value: log?.username || '-',
    });
  }

  items.push(
    { label: t('平台'), value: getTaskPlatformMeta(log?.platform).label },
    { label: t('类型'), value: getTaskTypeMeta(log, t).label },
    { label: t('模型'), value: getTaskModelDisplayValue(log, t) },
    { label: t('任务ID'), value: log?.task_id || '-' },
    { label: t('任务状态'), value: getTaskStatusLabel(log?.status, t) },
    { label: t('进度'), value: progressInfo.displayText },
    { label: t('详情'), value: getTaskDetailSummaryValue(log, t) },
  );

  return items;
}
