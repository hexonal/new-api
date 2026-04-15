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
import { Button, Empty, Form, Tag, Typography, Toast } from '@douyinfe/semi-ui';
import { IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import CardPro from '../../components/common/ui/CardPro';
import CardTable from '../../components/common/ui/CardTable';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../helpers/utils';
import { API, isAdmin, showError, timestamp2string } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import {
  formatGenerationRecordId,
  formatGenerationTaskId,
  formatNullableText,
  formatQuota,
  formatTokenCount,
} from './utils';

const { Text } = Typography;

const STATUS_COLOR_MAP = {
  pending: 'grey',
  running: 'blue',
  success: 'green',
  failed: 'red',
};

const FILTER_INIT_VALUES = {
  kind: '',
  status: '',
  platform: '',
  token: '',
};

const normalizeTimestamp = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return '-';
  }
  return timestamp2string(Math.floor(num));
};

const formatDuration = (startTime, finishTime) => {
  const start = Number(startTime);
  const end = Number(finishTime);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start <= 0 ||
    end <= 0
  ) {
    return '-';
  }
  if (end < start) {
    return '-';
  }
  return `${end - start}s`;
};

const DetailItem = ({ label, children }) => (
  <div className='flex min-w-0 flex-col gap-1 rounded-lg border border-[var(--semi-color-border)] p-2'>
    <Text type='secondary' size='small'>
      {label}
    </Text>
    <Text className='break-all'>{children}</Text>
  </div>
);

const GenerationRecordDetail = ({ record, t }) => (
  <div className='flex flex-col gap-3 py-2'>
    <div className='grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-4'>
      <DetailItem label={t('记录ID')}>
        {formatGenerationRecordId(record.id)}
      </DetailItem>
      <DetailItem label={t('令牌')}>
        {formatNullableText(record.token)}
      </DetailItem>
      <DetailItem label={t('任务ID')}>
        {formatGenerationTaskId(record)}
      </DetailItem>
      <DetailItem label={t('请求ID')}>
        {formatNullableText(record.request_id)}
      </DetailItem>
      <DetailItem label={t('平台')}>
        {formatNullableText(record.platform)}
      </DetailItem>
      <DetailItem label={t('配额')}>{formatQuota(record.quota)}</DetailItem>
      <DetailItem label={t('提示Token')}>
        {formatTokenCount(record.prompt_tokens)}
      </DetailItem>
      <DetailItem label={t('完成Token')}>
        {formatTokenCount(record.completion_tokens)}
      </DetailItem>
      <DetailItem label={t('总Token')}>
        {formatTokenCount(record.total_tokens)}
      </DetailItem>
      <DetailItem label={t('提交时间')}>
        {normalizeTimestamp(record.submit_time)}
      </DetailItem>
      <DetailItem label={t('耗时')}>
        {formatDuration(record.start_time, record.finish_time)}
      </DetailItem>
      <DetailItem label={t('退款')}>
        {record.refunded ? `${t('已退款')} ${record.refunded_quota || 0}` : '-'}
      </DetailItem>
    </div>
    <div className='flex flex-col gap-1'>
      <Text type='secondary'>{t('请求体')}</Text>
      <pre className='max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-[var(--semi-color-border)] bg-[var(--semi-color-fill-0)] p-2 text-sm'>
        {formatNullableText(record.request_body)}
      </pre>
    </div>
    <div className='flex flex-col gap-1'>
      <Text type='secondary'>{t('上游返回')}</Text>
      <pre className='max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-[var(--semi-color-border)] bg-[var(--semi-color-fill-0)] p-2 text-sm'>
        {formatNullableText(record.response_body)}
      </pre>
    </div>
    <div className='flex flex-col gap-1'>
      <Text type='secondary'>{t('错误信息')}</Text>
      <pre className='max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-[var(--semi-color-border)] bg-[var(--semi-color-fill-0)] p-2 text-sm'>
        {formatNullableText(record.error_message)}
      </pre>
    </div>
  </div>
);

const GenerationRecord = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [formApi, setFormApi] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [total, setTotal] = useState(0);

  const getFilters = () => {
    const values = formApi ? formApi.getValues() : FILTER_INIT_VALUES;
    return {
      kind: String(values.kind || '').trim(),
      status: String(values.status || '').trim(),
      platform: String(values.platform || '').trim(),
      token: String(values.token || '').trim(),
    };
  };

  const loadRecords = async (page = 1, size = pageSize) => {
    setLoading(true);
    try {
      const filters = getFilters();
      const endpoint = isAdmin()
        ? '/api/generation/search'
        : '/api/generation/self/search';
      const params = {
        p: page,
        page_size: size,
      };
      if (filters.kind) {
        params.kind = filters.kind;
      }
      if (filters.status) {
        params.status = filters.status;
      }
      if (filters.platform) {
        params.platform = filters.platform;
      }
      if (isAdmin() && filters.token) {
        params.token = filters.token;
      }

      const res = await API.get(endpoint, { params });
      const { success, message, data } = res.data;
      if (!success) {
        showError(message || t('获取生成记录失败'));
        return;
      }

      const items = Array.isArray(data?.items) ? data.items : [];
      setRecords(
        items.map((item) => ({
          ...item,
          key: `${item.id}`,
        })),
      );
      setTotal(data?.total || 0);
      setActivePage(data?.page || page);
      setPageSize(data?.page_size || size);
    } catch (error) {
      showError(error?.message || t('获取生成记录失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    await loadRecords(1, pageSize);
  };

  const handleRefresh = async () => {
    await loadRecords(activePage, pageSize);
  };

  const handlePageChange = (page) => {
    loadRecords(page, pageSize).then();
  };

  const handlePageSizeChange = (size) => {
    localStorage.setItem('generation-record-page-size', `${size}`);
    loadRecords(1, size).then();
  };

  useEffect(() => {
    const localPageSize = Number(
      localStorage.getItem('generation-record-page-size') || '',
    );
    const initialSize =
      Number.isInteger(localPageSize) && localPageSize > 0
        ? localPageSize
        : ITEMS_PER_PAGE;
    setPageSize(initialSize);
    loadRecords(1, initialSize).then();
  }, []);

  const columns = useMemo(
    () => [
      {
        title: t('记录ID'),
        dataIndex: 'id',
        key: 'id',
        width: 100,
        render: (value) => formatGenerationRecordId(value),
      },
      {
        title: t('令牌'),
        dataIndex: 'token',
        key: 'token',
        width: 180,
        render: (value) => value || '-',
      },
      {
        title: t('提交时间'),
        dataIndex: 'submit_time',
        key: 'submit_time',
        width: 170,
        render: (value) => normalizeTimestamp(value),
      },
      {
        title: t('类型'),
        dataIndex: 'kind',
        key: 'kind',
        width: 100,
        render: (value) => value || '-',
      },
      {
        title: t('状态'),
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (value) => (
          <Tag color={STATUS_COLOR_MAP[value] || 'grey'}>{value || '-'}</Tag>
        ),
      },
      {
        title: t('模型'),
        dataIndex: 'model',
        key: 'model',
        width: 190,
        render: (value) => value || '-',
      },
      {
        title: t('平台'),
        dataIndex: 'platform',
        key: 'platform',
        width: 120,
        render: (value) => value || '-',
      },
      {
        title: t('任务ID'),
        dataIndex: 'task_id',
        key: 'task_id',
        width: 180,
        render: (_, record) => formatGenerationTaskId(record),
      },
      {
        title: t('请求ID'),
        dataIndex: 'request_id',
        key: 'request_id',
        width: 180,
        render: (value) => value || '-',
      },
      {
        title: t('配额'),
        dataIndex: 'quota',
        key: 'quota',
        width: 100,
        render: (value) => formatQuota(value),
      },
      {
        title: t('提示Token'),
        dataIndex: 'prompt_tokens',
        key: 'prompt_tokens',
        width: 110,
        render: (value) => formatTokenCount(value),
      },
      {
        title: t('完成Token'),
        dataIndex: 'completion_tokens',
        key: 'completion_tokens',
        width: 110,
        render: (value) => formatTokenCount(value),
      },
      {
        title: t('总Token'),
        dataIndex: 'total_tokens',
        key: 'total_tokens',
        width: 100,
        render: (value) => formatTokenCount(value),
      },
      {
        title: t('耗时'),
        key: 'duration',
        width: 100,
        render: (_, record) =>
          formatDuration(record.start_time, record.finish_time),
      },
      {
        title: t('退款'),
        key: 'refunded',
        width: 90,
        render: (_, record) => {
          if (!record.refunded) {
            return '-';
          }
          return (
            <span>
              {t('已退款')} {record.refunded_quota || 0}
            </span>
          );
        },
      },
    ],
    [t],
  );

  return (
    <div className='mt-[60px] px-2'>
      <CardPro
        type='type2'
        searchArea={
          <Form
            initValues={FILTER_INIT_VALUES}
            getFormApi={setFormApi}
            layout='vertical'
          >
            <div className='flex flex-wrap gap-2 items-end'>
              <div className='w-40'>
                <Form.Select
                  field='kind'
                  label={t('类型')}
                  optionList={[
                    { label: t('全部类型'), value: '' },
                    { label: 'image', value: 'image' },
                    { label: 'audio', value: 'audio' },
                    { label: 'video', value: 'video' },
                    { label: 'music', value: 'music' },
                  ]}
                />
              </div>
              <div className='w-40'>
                <Form.Select
                  field='status'
                  label={t('状态')}
                  optionList={[
                    { label: t('全部状态'), value: '' },
                    { label: 'pending', value: 'pending' },
                    { label: 'running', value: 'running' },
                    { label: 'success', value: 'success' },
                    { label: 'failed', value: 'failed' },
                  ]}
                />
              </div>
              <div className='w-40'>
                <Form.Input field='platform' label={t('平台')} />
              </div>
              {isAdmin() && (
                <div className='w-40'>
                  <Form.Input field='token' label={t('令牌')} />
                </div>
              )}
              <div className='flex gap-2'>
                <Button
                  icon={<IconSearch />}
                  onClick={handleSearch}
                  theme='solid'
                >
                  {t('搜索')}
                </Button>
                <Button
                  icon={<IconRefresh />}
                  onClick={handleRefresh}
                  theme='light'
                >
                  {t('刷新')}
                </Button>
              </div>
            </div>
          </Form>
        }
        paginationArea={createCardProPagination({
          currentPage: activePage,
          pageSize,
          total,
          onPageChange: handlePageChange,
          onPageSizeChange: handlePageSizeChange,
          isMobile,
          t,
        })}
        t={t}
      >
        <CardTable
          columns={columns}
          dataSource={records}
          loading={loading}
          rowKey='key'
          pagination={false}
          scroll={{ x: 1740 }}
          empty={
            <Empty
              image={<IllustrationNoResult />}
              darkModeImage={<IllustrationNoResultDark />}
              description={t('暂无生成记录')}
            >
              <Button
                type='primary'
                onClick={() => {
                  Toast.warning(t('可通过筛选条件后刷新查看'));
                }}
              >
                {t('提示')}
              </Button>
            </Empty>
          }
          expandedRowRender={(record) => (
            <GenerationRecordDetail record={record} t={t} />
          )}
        />
      </CardPro>
    </div>
  );
};

export default GenerationRecord;
