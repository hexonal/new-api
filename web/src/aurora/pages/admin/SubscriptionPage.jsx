import React from 'react';
import { useSubscriptionsData } from '../../../hooks/subscriptions/useSubscriptionsData';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../primitives/card';
import { Button } from '../../primitives/button';
import { Badge } from '../../primitives/badge';
import { Switch } from '../../primitives/switch';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../primitives/table';

const formatDuration = (plan) => {
  const value = Number(plan?.duration_value || 0);
  const unit = plan?.duration_unit || 'month';
  const labels = {
    year: '年',
    month: '月',
    day: '天',
    hour: '小时',
  };
  return `${value}${labels[unit] || unit}`;
};

export default function SubscriptionPage() {
  const data = useSubscriptionsData();

  const {
    plans,
    planCount,
    loading,
    activePage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    setPlanEnabled,
    refresh,
    openCreate,
    openEdit,
    t,
  } = data;

  const totalPages = Math.max(1, Math.ceil((planCount || 0) / Math.max(1, pageSize || 10)));

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader className='pb-4'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <CardTitle className='text-base'>{t('订阅套餐管理')}</CardTitle>
              <CardDescription>{t('使用 useSubscriptionsData 管理套餐状态与分页')}</CardDescription>
            </div>
            <div className='flex items-center gap-2'>
              <Button variant='outline' size='sm' onClick={() => refresh()}>
                {t('刷新')}
              </Button>
              <Button size='sm' onClick={() => openCreate()}>
                {t('新建套餐')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className='rounded-lg border border-border'>
            <Table>
              <Thead>
                <Tr>
                  <Th>{t('套餐')}</Th>
                  <Th>{t('价格')}</Th>
                  <Th>{t('总额度')}</Th>
                  <Th>{t('有效期')}</Th>
                  <Th>{t('状态')}</Th>
                  <Th className='text-right'>{t('操作')}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(plans || []).map((record) => {
                  const plan = record?.plan || record || {};
                  const enabled = !!plan.enabled;
                  return (
                    <Tr key={plan.id || plan.name}>
                      <Td>
                        <div className='font-medium'>{plan.name || '-'}</div>
                        {plan.subtitle ? (
                          <div className='text-xs text-muted-foreground mt-0.5'>{plan.subtitle}</div>
                        ) : null}
                      </Td>
                      <Td>{Number(plan.price_amount || 0).toFixed(2)} USD</Td>
                      <Td>{Number(plan.total_amount || 0).toLocaleString()}</Td>
                      <Td>{formatDuration(plan)}</Td>
                      <Td>
                        <div className='flex items-center gap-2'>
                          <Switch
                            checked={enabled}
                            onCheckedChange={(checked) => setPlanEnabled(record, checked)}
                          />
                          <Badge variant={enabled ? 'secondary' : 'destructive'}>
                            {enabled ? t('启用') : t('禁用')}
                          </Badge>
                        </div>
                      </Td>
                      <Td>
                        <div className='flex justify-end gap-2'>
                          <Button variant='outline' size='sm' onClick={() => openEdit(record)}>
                            {t('编辑')}
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
                {(plans || []).length === 0 ? (
                  <Tr>
                    <Td colSpan={6} className='py-8 text-center text-sm text-muted-foreground'>
                      {loading ? t('加载中...') : t('暂无订阅套餐')}
                    </Td>
                  </Tr>
                ) : null}
              </Tbody>
            </Table>
          </div>

          <div className='mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
            <div className='text-xs text-muted-foreground'>{t('共 {{count}} 条', { count: planCount || 0 })}</div>
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
