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
  Copy,
  CreditCard,
  Gift,
  Loader2,
  RefreshCcw,
  Ticket,
  Wallet,
} from 'lucide-react';
import { API, copy, showError, showSuccess } from '../../../helpers';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../primitives/card';
import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';
import { Badge } from '../../primitives/badge';
import { Table, Tbody, Td, Th, Thead, Tr } from '../../primitives/table';

const formatTime = (unixTs) => {
  if (!unixTs) return '-';
  const value = Number(unixTs);
  if (Number.isNaN(value)) return '-';
  const date = value > 1e12 ? new Date(value) : new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
};

const formatMoney = (money) => {
  const num = Number(money);
  if (Number.isNaN(num)) return '-';
  return `¥${num.toFixed(2)}`;
};

const statusToBadge = (status, t) => {
  if (status === 'success') return <Badge>{t('成功')}</Badge>;
  if (status === 'pending')
    return <Badge variant='outline'>{t('待支付')}</Badge>;
  return <Badge variant='destructive'>{status || t('未知')}</Badge>;
};

export default function TopUpPage() {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [plansLoading, setPlansLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [submittingTopup, setSubmittingTopup] = useState(false);

  const [redeemCode, setRedeemCode] = useState('');
  const [plans, setPlans] = useState([]);
  const [affCode, setAffCode] = useState('');
  const [topupHistory, setTopupHistory] = useState([]);

  const affLink = useMemo(() => {
    if (!affCode) return '';
    return `${window.location.origin}/register?aff=${affCode}`;
  }, [affCode]);

  const loadPlans = async () => {
    setPlansLoading(true);
    try {
      const res = await API.get('/api/subscription/plans');
      if (res.data?.success) {
        setPlans(res.data.data || []);
      } else {
        setPlans([]);
      }
    } catch (error) {
      setPlans([]);
    } finally {
      setPlansLoading(false);
    }
  };

  const loadAffCode = async () => {
    try {
      const res = await API.get('/api/user/aff');
      if (res.data?.success) {
        setAffCode(res.data.data || '');
      } else {
        setAffCode('');
      }
    } catch (error) {
      setAffCode('');
    }
  };

  const loadTopupHistory = async () => {
    setHistoryLoading(true);
    try {
      let res;
      try {
        res = await API.get('/api/user/topup/self?p=0&page_size=10');
      } catch (primaryError) {
        res = await API.get('/api/user/topup?p=0&page_size=10');
      }

      if (res.data?.success) {
        setTopupHistory(res.data.data?.items || []);
      } else {
        setTopupHistory([]);
      }
    } catch (error) {
      setTopupHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadPlans(), loadAffCode(), loadTopupHistory()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleRedeem = async () => {
    if (!redeemCode.trim()) {
      showError(t('请输入兑换码'));
      return;
    }

    setSubmittingTopup(true);
    try {
      const res = await API.post('/api/user/topup', {
        key: redeemCode.trim(),
      });
      if (res.data?.success) {
        showSuccess(t('充值兑换成功'));
        setRedeemCode('');
        await loadTopupHistory();
      } else {
        showError(res.data?.message || t('兑换失败'));
      }
    } catch (error) {
      showError(
        error?.response?.data?.message || error.message || t('兑换失败'),
      );
    } finally {
      setSubmittingTopup(false);
    }
  };

  const handleCopyAffLink = async () => {
    if (!affLink) return;
    const ok = await copy(affLink);
    if (ok) {
      showSuccess(t('邀请链接已复制'));
    } else {
      showError(t('复制失败，请手动复制'));
    }
  };

  if (loading) {
    return (
      <div className='flex min-h-[280px] items-center justify-center'>
        <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
      </div>
    );
  }

  return (
    <div className='grid grid-cols-1 gap-4 xl:grid-cols-5'>
      <div className='space-y-4 xl:col-span-3'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <CreditCard className='h-4 w-4' />
                {t('订阅套餐')}
              </CardTitle>
              <CardDescription>{t('浏览当前可购买套餐')}</CardDescription>
            </div>
            <Button
              variant='outline'
              size='sm'
              onClick={loadPlans}
              loading={plansLoading}
            >
              <RefreshCcw className='mr-1.5 h-3.5 w-3.5' />
              {t('刷新')}
            </Button>
          </CardHeader>
          <CardContent>
            {plans.length === 0 ? (
              <div className='rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground'>
                {t('暂无可用订阅套餐')}
              </div>
            ) : (
              <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                {plans.map((item) => {
                  const plan = item.plan || {};
                  return (
                    <div
                      key={plan.id || plan.title}
                      className='rounded-lg border border-border p-3'
                    >
                      <div className='mb-1 flex items-center justify-between'>
                        <div className='font-medium'>
                          {plan.title || t('未命名套餐')}
                        </div>
                        <Badge
                          variant={
                            plan.enabled === false ? 'outline' : 'default'
                          }
                        >
                          {plan.enabled === false ? t('未启用') : t('启用中')}
                        </Badge>
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        {plan.description || t('暂无套餐说明')}
                      </div>
                      <div className='mt-3 flex items-center justify-between text-sm'>
                        <span>{t('价格')}</span>
                        <span className='font-semibold'>
                          {plan.currency || 'USD'}{' '}
                          {Number(plan.price_amount || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className='mt-1 flex items-center justify-between text-sm'>
                        <span>{t('周期')}</span>
                        <span>
                          {plan.duration_value || 0} {plan.duration_unit || '-'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Wallet className='h-4 w-4' />
              {t('充值兑换')}
            </CardTitle>
            <CardDescription>
              {t('输入兑换码并立即充值到当前账户')}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <Input
              label={t('兑换码')}
              icon={<Ticket className='h-4 w-4' />}
              value={redeemCode}
              onChange={(event) => {
                setRedeemCode(event.target.value);
              }}
              placeholder={t('请输入兑换码')}
            />
            <Button onClick={handleRedeem} loading={submittingTopup}>
              {t('立即充值')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className='space-y-4 xl:col-span-2'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Gift className='h-4 w-4' />
              {t('邀请返利')}
            </CardTitle>
            <CardDescription>
              {t('复制邀请链接，邀请注册获得返利')}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <Input label={t('邀请码')} value={affCode || '-'} readOnly />
            <Input label={t('邀请链接')} value={affLink || '-'} readOnly />
            <Button
              variant='outline'
              onClick={handleCopyAffLink}
              disabled={!affLink}
            >
              <Copy className='mr-1.5 h-3.5 w-3.5' />
              {t('复制邀请链接')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between'>
            <div>
              <CardTitle>{t('充值历史')}</CardTitle>
              <CardDescription>{t('最近 10 条充值记录')}</CardDescription>
            </div>
            <Button
              variant='outline'
              size='sm'
              onClick={loadTopupHistory}
              loading={historyLoading}
            >
              <RefreshCcw className='mr-1.5 h-3.5 w-3.5' />
              {t('刷新')}
            </Button>
          </CardHeader>
          <CardContent>
            {topupHistory.length === 0 ? (
              <div className='rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground'>
                {t('暂无充值记录')}
              </div>
            ) : (
              <Table>
                <Thead>
                  <Tr>
                    <Th>{t('订单号')}</Th>
                    <Th>{t('额度')}</Th>
                    <Th>{t('金额')}</Th>
                    <Th>{t('状态')}</Th>
                    <Th>{t('时间')}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {topupHistory.map((record) => (
                    <Tr key={record.id || record.trade_no}>
                      <Td className='max-w-[160px] truncate font-mono text-xs'>
                        {record.trade_no || '-'}
                      </Td>
                      <Td>{record.amount ?? '-'}</Td>
                      <Td>{formatMoney(record.money)}</Td>
                      <Td>{statusToBadge(record.status, t)}</Td>
                      <Td className='text-xs text-muted-foreground'>
                        {formatTime(record.create_time)}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
