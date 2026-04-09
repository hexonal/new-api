import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useRedemptionsData } from '../../../hooks/redemptions/useRedemptionsData';
import { REDEMPTION_STATUS } from '../../../constants/redemption.constants';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../primitives/card';
import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';
import { Badge } from '../../primitives/badge';
import { Checkbox } from '../../primitives/checkbox';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../primitives/table';

const statusMeta = {
  [REDEMPTION_STATUS.UNUSED]: { text: '未使用', variant: 'secondary' },
  [REDEMPTION_STATUS.USED]: { text: '已使用', variant: 'outline' },
  [REDEMPTION_STATUS.DISABLED]: { text: '已禁用', variant: 'destructive' },
};

const formatTime = (timestamp) => {
  const value = Number(timestamp || 0);
  if (!value) {
    return '-';
  }
  return new Date(value * 1000).toLocaleString();
};

const isExpired = (record) =>
  record.status === REDEMPTION_STATUS.UNUSED &&
  Number(record.expired_time || 0) > 0 &&
  Number(record.expired_time) < Math.floor(Date.now() / 1000);

export default function RedemptionPage() {
  const data = useRedemptionsData();
  const [keyword, setKeyword] = useState('');

  const {
    redemptions,
    loading,
    searching,
    activePage,
    pageSize,
    tokenCount,
    selectedKeys,
    setSelectedKeys,
    handlePageChange,
    handlePageSizeChange,
    manageRedemption,
    copyText,
    batchCopyRedemptions,
    batchDeleteRedemptions,
    t,
  } = data;

  const filteredRows = useMemo(() => {
    if (!keyword.trim()) {
      return redemptions || [];
    }
    const lower = keyword.toLowerCase();
    return (redemptions || []).filter((item) => {
      const name = String(item.name || '').toLowerCase();
      const key = String(item.key || '').toLowerCase();
      return name.includes(lower) || key.includes(lower);
    });
  }, [redemptions, keyword]);

  const selectedIdSet = useMemo(() => new Set((selectedKeys || []).map((item) => item.id)), [selectedKeys]);
  const totalPages = Math.max(1, Math.ceil((tokenCount || 0) / Math.max(1, pageSize || 10)));

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader className='pb-4'>
          <CardTitle className='text-base'>{t('兑换码管理')}</CardTitle>
          <CardDescription>{t('使用 useRedemptionsData；保留有效操作并清理无效按钮')}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
            <div className='max-w-sm w-full'>
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={t('按名称/兑换码筛选当前页')}
                icon={<Search className='h-4 w-4' />}
              />
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              <Button variant='outline' size='sm' onClick={batchCopyRedemptions} disabled={!selectedKeys.length}>
                {t('复制所选')}
              </Button>
              <Button variant='outline' size='sm' onClick={batchDeleteRedemptions}>
                {t('清理失效兑换码')}
              </Button>
            </div>
          </div>

          <div className='rounded-lg border border-border'>
            <Table>
              <Thead>
                <Tr>
                  <Th className='w-10'>#</Th>
                  <Th>{t('名称')}</Th>
                  <Th>{t('状态')}</Th>
                  <Th>{t('额度')}</Th>
                  <Th>{t('过期时间')}</Th>
                  <Th>{t('兑换码')}</Th>
                  <Th className='text-right'>{t('操作')}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredRows.map((record) => {
                  const expired = isExpired(record);
                  const status = expired
                    ? { text: '已过期', variant: 'destructive' }
                    : statusMeta[record.status] || { text: '未知', variant: 'outline' };
                  const checked = selectedIdSet.has(record.id);
                  return (
                    <Tr key={record.id} className={expired || record.status !== REDEMPTION_STATUS.UNUSED ? 'bg-muted/40' : ''}>
                      <Td>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) => {
                            if (next) {
                              setSelectedKeys([...(selectedKeys || []), record]);
                            } else {
                              setSelectedKeys((selectedKeys || []).filter((item) => item.id !== record.id));
                            }
                          }}
                        />
                      </Td>
                      <Td className='font-medium'>{record.name || '-'}</Td>
                      <Td>
                        <Badge variant={status.variant}>{t(status.text)}</Badge>
                      </Td>
                      <Td>{Number(record.quota || 0).toLocaleString()}</Td>
                      <Td>{Number(record.expired_time) === 0 ? t('永不过期') : formatTime(record.expired_time)}</Td>
                      <Td className='font-mono text-xs text-muted-foreground max-w-[200px] truncate'>{record.key}</Td>
                      <Td>
                        <div className='flex justify-end gap-2'>
                          <Button variant='outline' size='sm' onClick={() => copyText(record.key)}>
                            {t('复制')}
                          </Button>
                          {record.status === REDEMPTION_STATUS.UNUSED && !expired ? (
                            <Button
                              size='sm'
                              variant='destructive'
                              onClick={() => manageRedemption(record.id, 'disable', record)}
                            >
                              {t('禁用')}
                            </Button>
                          ) : (
                            <Button
                              size='sm'
                              onClick={() => manageRedemption(record.id, 'enable', record)}
                              disabled={record.status === REDEMPTION_STATUS.USED || expired}
                            >
                              {t('启用')}
                            </Button>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
                {filteredRows.length === 0 ? (
                  <Tr>
                    <Td colSpan={7} className='py-8 text-center text-sm text-muted-foreground'>
                      {loading || searching ? t('加载中...') : t('暂无兑换码')}
                    </Td>
                  </Tr>
                ) : null}
              </Tbody>
            </Table>
          </div>

          <div className='flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
            <div className='text-xs text-muted-foreground'>{t('共 {{count}} 条', { count: tokenCount || 0 })}</div>
            <div className='flex items-center gap-2'>
              <select
                className='h-9 rounded border border-input bg-background px-2 text-sm'
                value={pageSize}
                onChange={(event) => handlePageSizeChange(Number(event.target.value))}
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
              <Button
                variant='outline'
                size='sm'
                disabled={activePage <= 1}
                onClick={() => handlePageChange(activePage - 1)}
              >
                {t('上一页')}
              </Button>
              <span className='text-xs text-muted-foreground'>
                {activePage} / {totalPages}
              </span>
              <Button
                variant='outline'
                size='sm'
                disabled={activePage >= totalPages}
                onClick={() => handlePageChange(activePage + 1)}
              >
                {t('下一页')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
