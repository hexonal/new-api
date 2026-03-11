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

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Empty,
  Form,
  Modal,
  Spin,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { IconEyeOpened, IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import CardPro from '../../components/common/ui/CardPro';
import CardTable from '../../components/common/ui/CardTable';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { ITEMS_PER_PAGE } from '../../constants';
import { API, showError, showWarning, timestamp2string } from '../../helpers';
import { createCardProPagination } from '../../helpers/utils';

const { Text } = Typography;

const FILTER_INIT_VALUES = {
  status: '',
  source: '',
  request_id: '',
  username: '',
};

const STATUS_META = {
  pending: { color: 'grey', label: '待处理' },
  processing: { color: 'blue', label: '处理中' },
  retry_wait: { color: 'orange', label: '重试等待' },
  succeeded: { color: 'green', label: '成功' },
  dead: { color: 'red', label: '失败' },
  cancelled: { color: 'grey', label: '已取消' },
};

const SOURCE_META = {
  consume: { color: 'cyan', label: '消费回调' },
  operator: { color: 'purple', label: '运营回调' },
  feishu: { color: 'orange', label: '飞书通知' },
  user_points_guard: { color: 'indigo', label: '积分预扣校验' },
};

const EVENT_TYPE_META = {
  'consume.settle': { color: 'cyan', label: '消费结算' },
  'quota.warning': { color: 'orange', label: '额度预警' },
  'user_points.pre_deduct.check_failed': {
    color: 'red',
    label: '预扣校验失败',
  },
};

const normalizeTimestamp = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  if (numeric > 9999999999) {
    return Math.floor(numeric / 1000);
  }
  return Math.floor(numeric);
};

const formatTimestamp = (value) => {
  const normalized = normalizeTimestamp(value);
  if (!normalized) {
    return '-';
  }
  return timestamp2string(normalized);
};

const getDurationText = (startAt, endAt) => {
  const start = normalizeTimestamp(startAt);
  const end = normalizeTimestamp(endAt);
  if (!start || !end || end < start) {
    return '-';
  }
  return `${end - start}s`;
};

const formatJSONBlock = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '-';
  }
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return trimmed;
  }
};

const CallbackLog = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const [formApi, setFormApi] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [eventCount, setEventCount] = useState(0);

  const [showAttemptsModal, setShowAttemptsModal] = useState(false);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attempts, setAttempts] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const statusOptions = useMemo(
    () => [
      { label: t('全部状态'), value: '' },
      { label: t('待处理'), value: 'pending' },
      { label: t('处理中'), value: 'processing' },
      { label: t('重试等待'), value: 'retry_wait' },
      { label: t('成功'), value: 'succeeded' },
      { label: t('失败'), value: 'dead' },
      { label: t('已取消'), value: 'cancelled' },
    ],
    [t],
  );

  const sourceOptions = useMemo(
    () => [
      { label: t('全部来源'), value: '' },
      { label: t('消费回调'), value: 'consume' },
      { label: t('运营回调'), value: 'operator' },
      { label: t('飞书通知'), value: 'feishu' },
      { label: t('积分预扣校验'), value: 'user_points_guard' },
    ],
    [t],
  );

  const getFilters = () => {
    const values = formApi ? formApi.getValues() : FILTER_INIT_VALUES;
    return {
      status: (values.status || '').trim(),
      source: (values.source || '').trim(),
      request_id: (values.request_id || '').trim(),
      username: (values.username || '').trim(),
    };
  };

  const loadEvents = async (page = 1, size = pageSize) => {
    setLoading(true);
    try {
      const filters = getFilters();
      const params = {
        p: page,
        page_size: size,
      };

      if (filters.status) {
        params.status = filters.status;
      }
      if (filters.source) {
        params.source = filters.source;
      }
      if (filters.request_id) {
        params.request_id = filters.request_id;
      }
      if (filters.username) {
        params.username = filters.username;
      }

      const res = await API.get('/api/callback/events', { params });
      const { success, message, data } = res.data;
      if (!success) {
        showError(message || t('获取回调事件失败'));
        return;
      }

      const items = Array.isArray(data?.items) ? data.items : [];
      setEvents(
        items.map((item) => ({
          ...item,
          key: `${item.id}`,
        })),
      );
      setEventCount(data?.total || 0);
      setActivePage(data?.page || page);
      setPageSize(data?.page_size || size);
    } catch (error) {
      console.error(error);
      showError(error?.message || t('获取回调事件失败'));
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page) => {
    loadEvents(page, pageSize).then();
  };

  const handlePageSizeChange = (size) => {
    localStorage.setItem('callback-events-page-size', `${size}`);
    loadEvents(1, size).then();
  };

  const handleSearch = async () => {
    await loadEvents(1, pageSize);
  };

  const handleRefresh = async () => {
    await loadEvents(activePage, pageSize);
  };

  const openAttemptsModal = async (event) => {
    setSelectedEvent(event);
    setShowAttemptsModal(true);
    setAttempts([]);
    setAttemptsLoading(true);

    try {
      const res = await API.get(`/api/callback/events/${event.id}/attempts`);
      const { success, message, data } = res.data;
      if (!success) {
        showError(message || t('获取重试明细失败'));
        return;
      }
      const items = Array.isArray(data) ? data : [];
      setAttempts(
        items.map((item) => ({
          ...item,
          key: `${item.id}`,
        })),
      );
    } catch (error) {
      console.error(error);
      if (error?.response?.status === 404) {
        showWarning(t('重试明细暂不可用，服务可能刚更新，请稍后重试'));
        return;
      }
      showError(error?.message || t('获取重试明细失败'));
    } finally {
      setAttemptsLoading(false);
    }
  };

  useEffect(() => {
    const localPageSize = parseInt(
      localStorage.getItem('callback-events-page-size') || '',
      10,
    );
    const initialPageSize =
      Number.isInteger(localPageSize) && localPageSize > 0
        ? localPageSize
        : ITEMS_PER_PAGE;
    setPageSize(initialPageSize);
    loadEvents(1, initialPageSize).then();
  }, []);

  const renderStatusTag = (status) => {
    const meta = STATUS_META[status];
    if (!meta) {
      return <Tag>{status || '-'}</Tag>;
    }
    return <Tag color={meta.color}>{t(meta.label)}</Tag>;
  };

  const renderSourceTag = (source) => {
    const meta = SOURCE_META[source];
    if (!meta) {
      return <Tag>{source || '-'}</Tag>;
    }
    return <Tag color={meta.color}>{t(meta.label)}</Tag>;
  };

  const renderEventTypeTag = (eventType) => {
    const meta = EVENT_TYPE_META[eventType];
    if (!meta) {
      return eventType || '-';
    }
    return <Tag color={meta.color}>{t(meta.label)}</Tag>;
  };

  const eventColumns = useMemo(
    () => [
      {
        title: t('创建时间'),
        dataIndex: 'created_at',
        key: 'created_at',
        width: 170,
        render: (value) => formatTimestamp(value),
      },
      {
        title: t('来源'),
        dataIndex: 'source',
        key: 'source',
        width: 120,
        render: (value) => renderSourceTag(value),
      },
      {
        title: t('状态'),
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (value) => renderStatusTag(value),
      },
      {
        title: t('事件类型'),
        dataIndex: 'event_type',
        key: 'event_type',
        width: 150,
        render: (value) => renderEventTypeTag(value),
      },
      {
        title: t('Request ID'),
        dataIndex: 'request_id',
        key: 'request_id',
        width: 210,
        render: (value) => (
          <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 190 }}>
            {value || '-'}
          </Text>
        ),
      },
      {
        title: t('用户 ID'),
        dataIndex: 'user_id',
        key: 'user_id',
        width: 90,
        render: (value) => value || '-',
      },
      {
        title: t('用户名'),
        dataIndex: 'username',
        key: 'username',
        width: 180,
        render: (value) => value || '-',
      },
      {
        title: t('目标 SK'),
        dataIndex: 'token_sk',
        key: 'token_sk',
        width: 220,
        render: (value, record) => {
          const display = value || record?.token_sk_masked || '-';
          return (
            <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 200 }} copyable>
              {display}
            </Text>
          );
        },
      },
      {
        title: t('重试进度'),
        key: 'attempts',
        width: 120,
        render: (_, record) =>
          `${record.attempt_count || 0}/${Math.max(
            Number(record.max_retries || 0) + 1,
            1,
          )}`,
      },
      {
        title: t('下次重试'),
        dataIndex: 'next_retry_at',
        key: 'next_retry_at',
        width: 170,
        render: (value) => formatTimestamp(value),
      },
      {
        title: t('HTTP 状态'),
        dataIndex: 'last_http_status',
        key: 'last_http_status',
        width: 110,
        render: (value) => value || '-',
      },
      {
        title: t('最近错误'),
        dataIndex: 'last_error',
        key: 'last_error',
        minWidth: 220,
        render: (value) => (
          <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 360 }}>
            {value || '-'}
          </Text>
        ),
      },
      {
        title: t('操作'),
        key: 'actions',
        width: 120,
        render: (_, record) => (
          <Button
            size='small'
            type='tertiary'
            theme='borderless'
            onClick={() => openAttemptsModal(record)}
          >
            {t('重试明细')}
          </Button>
        ),
      },
    ],
    [t],
  );

  const attemptColumns = useMemo(
    () => [
      {
        title: t('尝试次数'),
        dataIndex: 'attempt_no',
        key: 'attempt_no',
        width: 100,
      },
      {
        title: t('开始时间'),
        dataIndex: 'started_at',
        key: 'started_at',
        width: 170,
        render: (value) => formatTimestamp(value),
      },
      {
        title: t('结束时间'),
        dataIndex: 'finished_at',
        key: 'finished_at',
        width: 170,
        render: (value) => formatTimestamp(value),
      },
      {
        title: t('耗时'),
        key: 'duration',
        width: 90,
        render: (_, record) =>
          getDurationText(record.started_at, record.finished_at),
      },
      {
        title: t('HTTP 状态'),
        dataIndex: 'http_status',
        key: 'http_status',
        width: 110,
        render: (value) => value || '-',
      },
      {
        title: t('结果'),
        dataIndex: 'success',
        key: 'success',
        width: 90,
        render: (value) =>
          value ? <Tag color='green'>{t('成功')}</Tag> : <Tag>{t('失败')}</Tag>,
      },
      {
        title: t('错误信息'),
        dataIndex: 'error',
        key: 'error',
        minWidth: 220,
        render: (value) => (
          <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 320 }}>
            {value || '-'}
          </Text>
        ),
      },
      {
        title: t('响应片段'),
        dataIndex: 'response_snippet',
        key: 'response_snippet',
        minWidth: 220,
        render: (value) => (
          <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 320 }}>
            {value || '-'}
          </Text>
        ),
      },
      {
        title: t('节点'),
        dataIndex: 'node_id',
        key: 'node_id',
        width: 160,
        render: (value) => value || '-',
      },
    ],
    [t],
  );

  return (
    <div className='mt-[60px] px-2'>
      <CardPro
        type='type2'
        statsArea={
          <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full'>
            <div className='flex items-center text-orange-500 mb-2 md:mb-0'>
              <IconEyeOpened className='mr-2' />
              <Text>{t('回调日志')}</Text>
            </div>
            <Button
              icon={<IconRefresh />}
              type='tertiary'
              size='small'
              loading={loading}
              onClick={handleRefresh}
            >
              {t('刷新')}
            </Button>
          </div>
        }
        searchArea={
          <Form
            initValues={FILTER_INIT_VALUES}
            getFormApi={setFormApi}
            onSubmit={handleSearch}
            allowEmpty={true}
            autoComplete='off'
            layout='vertical'
            trigger='change'
            stopValidateWithError={false}
          >
            <div className='flex flex-col gap-2'>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2'>
                <Form.Select
                  field='status'
                  optionList={statusOptions}
                  placeholder={t('状态')}
                  showClear
                  pure
                  size='small'
                />
                <Form.Select
                  field='source'
                  optionList={sourceOptions}
                  placeholder={t('来源')}
                  showClear
                  pure
                  size='small'
                />
                <Form.Input
                  field='request_id'
                  prefix={<IconSearch />}
                  placeholder={t('Request ID')}
                  showClear
                  pure
                  size='small'
                />
                <Form.Input
                  field='username'
                  prefix={<IconSearch />}
                  placeholder={t('用户名（精确）')}
                  showClear
                  pure
                  size='small'
                />
              </div>
              <div className='flex justify-end items-center gap-2'>
                <Button
                  type='tertiary'
                  htmlType='submit'
                  loading={loading}
                  size='small'
                >
                  {t('查询')}
                </Button>
                <Button
                  type='tertiary'
                  size='small'
                  onClick={async () => {
                    if (formApi) {
                      formApi.reset();
                    }
                    await loadEvents(1, pageSize);
                  }}
                >
                  {t('重置')}
                </Button>
              </div>
            </div>
          </Form>
        }
        paginationArea={createCardProPagination({
          currentPage: activePage,
          pageSize,
          total: eventCount,
          onPageChange: handlePageChange,
          onPageSizeChange: handlePageSizeChange,
          isMobile,
          t,
        })}
        t={t}
      >
        <CardTable
          columns={eventColumns}
          dataSource={events}
          rowKey='key'
          loading={loading}
          className='rounded-xl overflow-hidden'
          size='middle'
          scroll={{ x: 'max-content' }}
          hidePagination={true}
          empty={
            <Empty
              image={
                <IllustrationNoResult style={{ width: 150, height: 150 }} />
              }
              darkModeImage={
                <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
              }
              description={t('搜索无结果')}
              style={{ padding: 30 }}
            />
          }
        />
      </CardPro>

      <Modal
        title={t('重试明细')}
        visible={showAttemptsModal}
        onCancel={() => setShowAttemptsModal(false)}
        footer={null}
        width={1000}
      >
        <div className='mb-3'>
          <Text type='secondary'>
            {t('事件 ID')}: {selectedEvent?.event_id || selectedEvent?.id || '-'}
          </Text>
        </div>
        <div className='mb-3'>
          <Text type='secondary'>
            {t('用户名')}: {selectedEvent?.username || '-'} · {t('目标 SK')}:{' '}
            {selectedEvent?.token_sk || selectedEvent?.token_sk_masked || '-'}
          </Text>
        </div>
        <div className='mb-3'>
          <Text type='secondary'>
            {t('回调地址')}: {selectedEvent?.callback_url || '-'} · {t('请求方式')}:{' '}
            {selectedEvent?.request_method || 'POST'} · {t('内容类型')}:{' '}
            {selectedEvent?.content_type || 'application/json'}
          </Text>
        </div>
        <div className='mb-3'>
          <Text strong>{t('发送请求头')}</Text>
          <pre
            style={{
              marginTop: 8,
              padding: 12,
              borderRadius: 8,
              background: 'var(--semi-color-fill-0)',
              maxHeight: 180,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 12,
            }}
          >
            {formatJSONBlock(selectedEvent?.request_headers)}
          </pre>
        </div>
        <div className='mb-3'>
          <Text strong>{t('发送内容')}</Text>
          <pre
            style={{
              marginTop: 8,
              padding: 12,
              borderRadius: 8,
              background: 'var(--semi-color-fill-0)',
              maxHeight: 220,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 12,
            }}
          >
            {formatJSONBlock(selectedEvent?.request_body)}
          </pre>
        </div>

        {attemptsLoading ? (
          <div className='flex justify-center py-10'>
            <Spin size='large' />
          </div>
        ) : (
          <Table
            columns={attemptColumns}
            dataSource={attempts}
            rowKey='key'
            pagination={false}
            size='small'
            scroll={{ x: 'max-content' }}
            empty={
              <Empty
                image={
                  <IllustrationNoResult style={{ width: 130, height: 130 }} />
                }
                darkModeImage={
                  <IllustrationNoResultDark style={{ width: 130, height: 130 }} />
                }
                description={t('暂无重试记录')}
                style={{ padding: 20 }}
              />
            }
          />
        )}
      </Modal>
    </div>
  );
};

export default CallbackLog;
