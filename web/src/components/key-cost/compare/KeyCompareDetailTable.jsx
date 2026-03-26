import React from 'react';
import { Card, Table } from '@douyinfe/semi-ui';
import { List } from 'lucide-react';
import { CARD_PROPS } from '../../../constants/key-cost.constants';

const KeyCompareDetailTable = ({ compareStats, loading, t }) => {
  const columns = [
    {
      title: t('Key 名称'),
      dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: t('总成本'),
      dataIndex: 'cost',
      sorter: (a, b) => {
        const parseVal = (s) => parseFloat(String(s).replace('$', '')) || 0;
        return parseVal(a.cost) - parseVal(b.cost);
      },
      defaultSortOrder: 'descend',
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
      title: t('平均单次成本'),
      dataIndex: 'avgCost',
    },
  ];

  return (
    <Card
      {...CARD_PROPS}
      className='!rounded-2xl mb-4'
      title={
        <div className='flex items-center gap-2'>
          <List size={16} />
          {t('Key 对比明细')}
        </div>
      }
    >
      <Table
        columns={columns}
        dataSource={compareStats || []}
        loading={loading}
        pagination={false}
        rowKey='tokenId'
        size='small'
        empty={t('暂无数据')}
      />
    </Card>
  );
};

export default KeyCompareDetailTable;
