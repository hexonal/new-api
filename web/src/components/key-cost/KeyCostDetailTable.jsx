import React, { useMemo, useState } from 'react';
import { Card, Table, Input } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { List } from 'lucide-react';
import {
  CARD_PROPS,
  DEFAULT_PAGE_SIZE,
} from '../../constants/key-cost.constants';
import {
  aggregateByModel,
  quotaToNumeric,
  formatQuotaDisplay,
} from '../../helpers/key-cost';

const KeyCostDetailTable = ({ summaryData, loading, t }) => {
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const modelData = useMemo(() => {
    const agg = aggregateByModel(summaryData, 999);
    const totalQuota = agg.reduce((sum, m) => sum + m.quota, 0);

    return agg.map((m) => ({
      model: m.model,
      requests: m.count,
      tokens: m.tokens,
      costUSD: quotaToNumeric(m.quota),
      share:
        totalQuota > 0
          ? ((m.quota / totalQuota) * 100).toFixed(1) + '%'
          : '0%',
    }));
  }, [summaryData]);

  const filteredData = useMemo(() => {
    if (!searchText) return modelData;
    const lower = searchText.toLowerCase();
    return modelData.filter((row) => row.model.toLowerCase().includes(lower));
  }, [modelData, searchText]);

  const columns = [
    {
      title: t('模型名称'),
      dataIndex: 'model',
      sorter: (a, b) => a.model.localeCompare(b.model),
    },
    {
      title: t('请求次数'),
      dataIndex: 'requests',
      sorter: (a, b) => a.requests - b.requests,
      render: (val) => val.toLocaleString(),
    },
    {
      title: t('Token 消耗'),
      dataIndex: 'tokens',
      sorter: (a, b) => a.tokens - b.tokens,
      render: (val) => val.toLocaleString(),
    },
    {
      title: t('成本') + ' (USD)',
      dataIndex: 'costUSD',
      sorter: (a, b) => a.costUSD - b.costUSD,
      render: (val) => formatQuotaDisplay(val),
      defaultSortOrder: 'descend',
    },
    {
      title: t('占比'),
      dataIndex: 'share',
    },
  ];

  return (
    <Card
      {...CARD_PROPS}
      className='!rounded-2xl mb-4'
      title={
        <div className='flex items-center justify-between w-full'>
          <div className='flex items-center gap-2'>
            <List size={16} />
            {t('模型明细')}
          </div>
          <Input
            prefix={<IconSearch />}
            placeholder={t('搜索模型')}
            value={searchText}
            onChange={setSearchText}
            style={{ width: 200 }}
            showClear
          />
        </div>
      }
    >
      <Table
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        pagination={{
          currentPage,
          pageSize: DEFAULT_PAGE_SIZE,
          total: filteredData.length,
          onPageChange: setCurrentPage,
          showSizeChanger: false,
        }}
        rowKey='model'
        size='small'
        empty={t('暂无数据')}
      />
    </Card>
  );
};

export default KeyCostDetailTable;
