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
  ArrowUpRight,
  Copy,
  CreditCard,
  Gift,
  Loader2,
  RefreshCcw,
  Sparkles,
  Ticket,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  API,
  copy,
  getCurrencyConfig,
  getQuotaPerUnit,
  renderQuota,
  showError,
  showInfo,
  showSuccess,
} from '../../../helpers';
import { formatSubscriptionDuration } from '../../../helpers/subscriptionFormat';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../primitives/select';

const TAB_SUBSCRIPTION = 'subscription';
const TAB_WALLET = 'wallet';
const TAB_HISTORY = 'history';

const BILLING_PREFERENCES = [
  { value: 'subscription_first', label: '优先订阅' },
  { value: 'wallet_first', label: '优先钱包' },
  { value: 'subscription_only', label: '仅用订阅' },
  { value: 'wallet_only', label: '仅用钱包' },
];

const PAYMENT_METHOD_LABELS = {
  alipay: '支付宝',
  wxpay: '微信支付',
  stripe: 'Stripe',
  creem: 'Creem',
};

const parseJSON = (value, fallback) => {
  if (!value) return fallback;
  if (Array.isArray(value) || typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const submitEpayForm = ({ url, params }) => {
  if (!url || !params) return;
  const form = document.createElement('form');
  form.action = url;
  form.method = 'POST';
  const isSafari =
    navigator.userAgent.indexOf('Safari') > -1 &&
    navigator.userAgent.indexOf('Chrome') < 1;
  if (!isSafari) {
    form.target = '_blank';
  }

  Object.keys(params).forEach((key) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = params[key];
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};

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
  const { symbol } = getCurrencyConfig();
  return `${symbol}${num.toFixed(2)}`;
};

const statusToBadge = (status, t) => {
  if (status === 'success') return <Badge>{t('成功')}</Badge>;
  if (status === 'pending')
    return <Badge variant='outline'>{t('待支付')}</Badge>;
  if (status === 'expired')
    return <Badge variant='destructive'>{t('已过期')}</Badge>;
  return <Badge variant='destructive'>{status || t('未知')}</Badge>;
};

const normalizePayMethods = (rawMethods, topupInfo) => {
  const parsedMethods = parseJSON(rawMethods, []);
  if (!Array.isArray(parsedMethods)) return [];

  return parsedMethods
    .filter((method) => method?.name && method?.type)
    .map((method) => {
      const normalized = { ...method };
      const minimum = Number(normalized.min_topup);
      normalized.min_topup = Number.isFinite(minimum) ? minimum : 0;
      if (
        normalized.type === 'stripe' &&
        (!normalized.min_topup || normalized.min_topup <= 0)
      ) {
        const stripeMinimum = Number(topupInfo?.stripe_min_topup);
        if (Number.isFinite(stripeMinimum)) {
          normalized.min_topup = stripeMinimum;
        }
      }
      return normalized;
    });
};

const getPlanDefaultMethod = (plan, epayMethods, channelFlags) => {
  if (channelFlags.enableStripeTopUp && plan?.stripe_price_id) return 'stripe';
  if (channelFlags.enableCreemTopUp && plan?.creem_product_id) return 'creem';
  if (channelFlags.enableOnlineTopUp && epayMethods.length > 0) {
    return `epay:${epayMethods[0].type}`;
  }
  return '';
};

export default function TopUpPage() {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(TAB_SUBSCRIPTION);

  const [statusLoading, setStatusLoading] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [amountLoading, setAmountLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [paying, setPaying] = useState(false);
  const [planPayingId, setPlanPayingId] = useState(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [refreshingSubscription, setRefreshingSubscription] = useState(false);

  const [userInfo, setUserInfo] = useState(null);
  const [topupHistory, setTopupHistory] = useState([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [activeSubscriptions, setActiveSubscriptions] = useState([]);
  const [allSubscriptions, setAllSubscriptions] = useState([]);
  const [billingPreference, setBillingPreference] = useState('subscription_first');

  const [redeemCode, setRedeemCode] = useState('');
  const [topUpCount, setTopUpCount] = useState(1);
  const [minTopUp, setMinTopUp] = useState(1);
  const [amount, setAmount] = useState(0);
  const [selectedPayMethod, setSelectedPayMethod] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [presetAmounts, setPresetAmounts] = useState([]);

  const [payMethods, setPayMethods] = useState([]);
  const [enableOnlineTopUp, setEnableOnlineTopUp] = useState(false);
  const [enableStripeTopUp, setEnableStripeTopUp] = useState(false);
  const [enableCreemTopUp, setEnableCreemTopUp] = useState(false);
  const [priceRatio, setPriceRatio] = useState(1);
  const [topUpLink, setTopUpLink] = useState('');
  const [topupDiscount, setTopupDiscount] = useState({});

  const [creemProducts, setCreemProducts] = useState([]);
  const [selectedCreemProductId, setSelectedCreemProductId] = useState('');

  const [affCode, setAffCode] = useState('');
  const [transferAmount, setTransferAmount] = useState(0);
  const [subscriptionMethodByPlan, setSubscriptionMethodByPlan] = useState({});

  const affLink = useMemo(() => {
    if (!affCode) return '';
    return `${window.location.origin}/register?aff=${affCode}`;
  }, [affCode]);

  const epayMethods = useMemo(() => {
    return payMethods.filter(
      (method) => method?.type !== 'stripe' && method?.type !== 'creem',
    );
  }, [payMethods]);

  const quotaUnit = useMemo(() => {
    const value = Number(getQuotaPerUnit());
    return Number.isFinite(value) && value > 0 ? value : 1;
  }, []);

  const renderAmountText = useMemo(() => {
    const { symbol } = getCurrencyConfig();
    if (!Number.isFinite(amount)) return '-';
    return `${symbol}${Number(amount).toFixed(2)}`;
  }, [amount]);

  const hasActiveSubscription = activeSubscriptions.length > 0;
  const subscriptionPreferenceNeedsFallback =
    (billingPreference === 'subscription_first' ||
      billingPreference === 'subscription_only') &&
    !hasActiveSubscription;

  const loadUserInfo = async () => {
    try {
      const res = await API.get('/api/user/self');
      if (res.data?.success) {
        setUserInfo(res.data.data || null);
      }
    } catch {
      setUserInfo(null);
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
    } catch {
      setAffCode('');
    }
  };

  const refreshAmount = async (count, paymentMethod) => {
    const amountValue = Number(count);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setAmount(0);
      return;
    }
    const method = paymentMethod || selectedPayMethod;
    const isStripe = method === 'stripe';
    setAmountLoading(true);
    try {
      const endpoint = isStripe ? '/api/user/stripe/amount' : '/api/user/amount';
      const res = await API.post(endpoint, {
        amount: parseFloat(amountValue),
      });

      const message = res.data?.message;
      const success = res.data?.success;
      if (message === 'success' || success) {
        const apiAmount = Number(res.data?.data || 0);
        if (Number.isFinite(apiAmount)) {
          setAmount(apiAmount);
          return;
        }
      }
      const discount = Number(topupDiscount?.[amountValue] || 1);
      const fallbackAmount = amountValue * Number(priceRatio || 1) * discount;
      setAmount(Number.isFinite(fallbackAmount) ? fallbackAmount : 0);
    } catch {
      const discount = Number(topupDiscount?.[amountValue] || 1);
      const fallbackAmount = amountValue * Number(priceRatio || 1) * discount;
      setAmount(Number.isFinite(fallbackAmount) ? fallbackAmount : 0);
    } finally {
      setAmountLoading(false);
    }
  };

  const loadStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await API.get('/api/status');
      if (res.data?.success) {
        const status = res.data.data || {};
        setTopUpLink(status.top_up_link || '');
        setPriceRatio(Number(status.price || 1));
      }
    } catch {
      setTopUpLink('');
    } finally {
      setStatusLoading(false);
    }
  };

  const loadTopupInfo = async () => {
    try {
      const res = await API.get('/api/user/topup/info');
      if (!res.data?.success) {
        return;
      }
      const data = res.data.data || {};
      const methods = normalizePayMethods(data.pay_methods, data);
      const onlineEnabled = Boolean(data.enable_online_topup);
      const stripeEnabled = Boolean(data.enable_stripe_topup);
      const creemEnabled = Boolean(data.enable_creem_topup);
      const minimumValue = onlineEnabled
        ? Number(data.min_topup || 1)
        : stripeEnabled
          ? Number(data.stripe_min_topup || 1)
          : 1;
      const normalizedMinimum =
        Number.isFinite(minimumValue) && minimumValue > 0 ? minimumValue : 1;

      const amountOptions = Array.isArray(data.amount_options)
        ? data.amount_options
        : [];
      const discount = data.discount || {};
      const computedPresets =
        amountOptions.length > 0
          ? amountOptions.map((value) => ({
              value,
              discount: Number(discount?.[value] || 1),
            }))
          : [1, 5, 10, 30, 50, 100].map((times) => ({
              value: normalizedMinimum * times,
              discount: 1,
            }));

      const parsedCreemProducts = parseJSON(data.creem_products, []);
      const normalizedCreemProducts = Array.isArray(parsedCreemProducts)
        ? parsedCreemProducts.filter((product) => product?.productId)
        : [];

      setEnableOnlineTopUp(onlineEnabled);
      setEnableStripeTopUp(stripeEnabled);
      setEnableCreemTopUp(creemEnabled);
      setMinTopUp(normalizedMinimum);
      setTopUpCount((prev) => {
        const next = Number(prev);
        if (Number.isFinite(next) && next >= normalizedMinimum) {
          return next;
        }
        return normalizedMinimum;
      });
      setPayMethods(methods);
      setTopupDiscount(discount);
      setPresetAmounts(computedPresets);
      setCreemProducts(normalizedCreemProducts);
      setSelectedCreemProductId(normalizedCreemProducts[0]?.productId || '');

      const preferredMethod =
        methods.find((method) => method.type === 'stripe' && stripeEnabled)
          ?.type || methods[0]?.type;
      if (preferredMethod) {
        setSelectedPayMethod(preferredMethod);
      }
    } catch {
      setPayMethods([]);
    }
  };

  const loadSubscriptionPlans = async () => {
    setSubscriptionLoading(true);
    try {
      const res = await API.get('/api/subscription/plans');
      if (res.data?.success) {
        setSubscriptionPlans(res.data.data || []);
      } else {
        setSubscriptionPlans([]);
      }
    } catch {
      setSubscriptionPlans([]);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const loadSubscriptionSelf = async (showLoading = false) => {
    if (showLoading) {
      setRefreshingSubscription(true);
    }
    try {
      const res = await API.get('/api/subscription/self');
      if (res.data?.success) {
        const payload = res.data.data || {};
        setBillingPreference(payload.billing_preference || 'subscription_first');
        setActiveSubscriptions(payload.subscriptions || []);
        setAllSubscriptions(payload.all_subscriptions || []);
      } else {
        setActiveSubscriptions([]);
        setAllSubscriptions([]);
      }
    } catch {
      setActiveSubscriptions([]);
      setAllSubscriptions([]);
    } finally {
      if (showLoading) {
        setRefreshingSubscription(false);
      }
    }
  };

  const loadTopupHistory = async () => {
    setHistoryLoading(true);
    try {
      let res;
      try {
        res = await API.get('/api/user/topup/self?p=1&page_size=10');
      } catch {
        res = await API.get('/api/user/topup?p=1&page_size=10');
      }
      if (res.data?.success) {
        setTopupHistory(res.data?.data?.items || []);
      } else {
        setTopupHistory([]);
      }
    } catch {
      setTopupHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      loadUserInfo(),
      loadAffCode(),
      loadStatus(),
      loadTopupInfo(),
      loadSubscriptionPlans(),
      loadSubscriptionSelf(),
      loadTopupHistory(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!selectedPayMethod) {
      return;
    }
    refreshAmount(topUpCount, selectedPayMethod);
  }, [selectedPayMethod]);

  useEffect(() => {
    setTransferAmount(quotaUnit);
  }, [quotaUnit]);

  const handleRedeem = async () => {
    if (!redeemCode.trim()) {
      showError(t('请输入兑换码'));
      return;
    }
    setRedeeming(true);
    try {
      const res = await API.post('/api/user/topup', {
        key: redeemCode.trim(),
      });
      if (res.data?.success) {
        showSuccess(t('兑换成功'));
        setRedeemCode('');
        await Promise.all([loadUserInfo(), loadTopupHistory()]);
      } else {
        showError(res.data?.message || t('兑换失败'));
      }
    } catch (error) {
      showError(error?.response?.data?.message || t('兑换失败'));
    } finally {
      setRedeeming(false);
    }
  };

  const handleCopyAffLink = async () => {
    if (!affLink) return;
    const copied = await copy(affLink);
    if (copied) {
      showSuccess(t('邀请链接已复制到剪贴板'));
    } else {
      showError(t('复制失败，请手动复制'));
    }
  };

  const handleTransferAffQuota = async () => {
    const amountValue = Number(transferAmount);
    if (!Number.isFinite(amountValue) || amountValue < quotaUnit) {
      showError(`${t('划转金额最低为')} ${renderQuota(quotaUnit)}`);
      return;
    }
    setTransferLoading(true);
    try {
      const res = await API.post('/api/user/aff_transfer', {
        quota: amountValue,
      });
      if (res.data?.success) {
        showSuccess(res.data?.message || t('划转成功'));
        await loadUserInfo();
      } else {
        showError(res.data?.message || t('划转失败'));
      }
    } catch (error) {
      showError(error?.response?.data?.message || t('划转失败'));
    } finally {
      setTransferLoading(false);
    }
  };

  const handleBillingPreferenceChange = async (value) => {
    const previous = billingPreference;
    setBillingPreference(value);
    try {
      const res = await API.put('/api/subscription/self/preference', {
        billing_preference: value,
      });
      if (res.data?.success) {
        setBillingPreference(res.data?.data?.billing_preference || value);
        showSuccess(t('扣费偏好已更新'));
      } else {
        setBillingPreference(previous);
        showError(res.data?.message || t('更新失败'));
      }
    } catch {
      setBillingPreference(previous);
      showError(t('更新失败'));
    }
  };

  const handleOpenTopUpLink = () => {
    if (!topUpLink) {
      showError(t('管理员未配置外部充值链接'));
      return;
    }
    window.open(topUpLink, '_blank');
  };

  const handleTopupCountInput = (event) => {
    const onlyDigits = event.target.value.replace(/[^\d]/g, '');
    if (!onlyDigits) {
      setTopUpCount('');
      return;
    }
    setTopUpCount(parseInt(onlyDigits, 10));
    setSelectedPreset(null);
  };

  const handleTopupCountBlur = () => {
    let normalized = Number(topUpCount);
    if (!Number.isFinite(normalized) || normalized < minTopUp) {
      normalized = minTopUp;
    }
    setTopUpCount(normalized);
    void refreshAmount(normalized, selectedPayMethod);
  };

  const handleSelectPreset = (preset) => {
    const value = Number(preset?.value || 0);
    if (!Number.isFinite(value) || value <= 0) return;
    setTopUpCount(value);
    setSelectedPreset(value);
    void refreshAmount(value, selectedPayMethod);
  };

  const handleWalletPay = async () => {
    const count = Number(topUpCount);
    if (!Number.isFinite(count) || count < minTopUp) {
      showError(`${t('充值数量不能小于')} ${minTopUp}`);
      return;
    }
    if (!selectedPayMethod) {
      showError(t('请选择支付方式'));
      return;
    }

    if (selectedPayMethod === 'stripe' && !enableStripeTopUp) {
      showError(t('管理员未开启 Stripe 充值'));
      return;
    }
    if (
      selectedPayMethod !== 'stripe' &&
      selectedPayMethod !== 'creem' &&
      !enableOnlineTopUp
    ) {
      showError(t('管理员未开启在线充值'));
      return;
    }
    if (selectedPayMethod === 'creem' && !enableCreemTopUp) {
      showError(t('管理员未开启 Creem 充值'));
      return;
    }

    setPaying(true);
    try {
      if (selectedPayMethod === 'stripe') {
        const res = await API.post('/api/user/stripe/pay', {
          amount: parseInt(count, 10),
          payment_method: 'stripe',
        });
        if (res.data?.message === 'success') {
          window.open(res.data?.data?.pay_link, '_blank');
          showSuccess(t('已打开支付页面'));
        } else {
          showError(res.data?.message || t('支付失败'));
        }
      } else if (selectedPayMethod === 'creem') {
        if (!selectedCreemProductId) {
          showError(t('请选择 Creem 产品'));
          return;
        }
        const res = await API.post('/api/user/creem/pay', {
          product_id: selectedCreemProductId,
          payment_method: 'creem',
        });
        if (res.data?.message === 'success') {
          window.open(res.data?.data?.checkout_url, '_blank');
          showSuccess(t('已打开支付页面'));
        } else {
          showError(res.data?.message || t('支付失败'));
        }
      } else {
        const res = await API.post('/api/user/pay', {
          amount: parseInt(count, 10),
          payment_method: selectedPayMethod,
        });
        if (res.data?.message === 'success') {
          submitEpayForm({ url: res.data?.url, params: res.data?.data });
          showSuccess(t('已发起支付'));
        } else {
          showError(res.data?.message || t('支付失败'));
        }
      }
      await loadTopupHistory();
    } catch (error) {
      showError(error?.response?.data?.message || t('支付请求失败'));
    } finally {
      setPaying(false);
    }
  };

  const handleSubscriptionMethodChange = (planId, methodValue) => {
    setSubscriptionMethodByPlan((prev) => ({
      ...prev,
      [planId]: methodValue,
    }));
  };

  const handleSubscriptionPay = async (record) => {
    const plan = record?.plan || {};
    const planId = plan?.id;
    if (!planId) return;

    const selectedMethod =
      subscriptionMethodByPlan[planId] ||
      getPlanDefaultMethod(plan, epayMethods, {
        enableOnlineTopUp,
        enableStripeTopUp,
        enableCreemTopUp,
      });

    if (!selectedMethod) {
      showInfo(t('当前套餐暂无可用支付渠道'));
      return;
    }

    setPlanPayingId(planId);
    try {
      if (selectedMethod === 'stripe') {
        const res = await API.post('/api/subscription/stripe/pay', {
          plan_id: planId,
        });
        if (res.data?.message === 'success') {
          window.open(res.data?.data?.pay_link, '_blank');
          showSuccess(t('已打开支付页面'));
        } else {
          showError(res.data?.message || t('支付失败'));
        }
      } else if (selectedMethod === 'creem') {
        const res = await API.post('/api/subscription/creem/pay', {
          plan_id: planId,
        });
        if (res.data?.message === 'success') {
          window.open(res.data?.data?.checkout_url, '_blank');
          showSuccess(t('已打开支付页面'));
        } else {
          showError(res.data?.message || t('支付失败'));
        }
      } else {
        const epayMethod = selectedMethod.replace('epay:', '');
        const res = await API.post('/api/subscription/epay/pay', {
          plan_id: planId,
          payment_method: epayMethod,
        });
        if (res.data?.message === 'success') {
          submitEpayForm({ url: res.data?.url, params: res.data?.data });
          showSuccess(t('已发起支付'));
        } else {
          showError(res.data?.message || t('支付失败'));
        }
      }
      await loadSubscriptionSelf();
    } catch (error) {
      showError(error?.response?.data?.message || t('支付请求失败'));
    } finally {
      setPlanPayingId(null);
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
    <div className='grid grid-cols-12 gap-6'>
      <div className='col-span-12 space-y-6 lg:col-span-7'>
        <Card className='overflow-hidden border-[#d7e3f4]'>
          <CardHeader className='pb-4'>
            <div className='flex items-center justify-between gap-3'>
              <div>
                <CardTitle className='text-2xl font-extrabold tracking-tight'>
                  {t('Billing')}
                </CardTitle>
                <CardDescription className='mt-1 text-sm'>
                  {t('订阅、充值与账单历史统一管理')}
                </CardDescription>
              </div>
              <Button
                variant='outline'
                size='sm'
                onClick={loadAll}
                loading={statusLoading || subscriptionLoading}
              >
                <RefreshCcw className='mr-1.5 h-3.5 w-3.5' />
                {t('刷新')}
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className='mb-5 flex border-b border-[#d8e3f4]'>
              <TabButton
                active={activeTab === TAB_SUBSCRIPTION}
                onClick={() => {
                  setActiveTab(TAB_SUBSCRIPTION);
                }}
              >
                {t('Subscription Plans')}
              </TabButton>
              <TabButton
                active={activeTab === TAB_WALLET}
                onClick={() => {
                  setActiveTab(TAB_WALLET);
                }}
              >
                {t('在线充值')}
              </TabButton>
              <TabButton
                active={activeTab === TAB_HISTORY}
                onClick={() => {
                  setActiveTab(TAB_HISTORY);
                }}
              >
                {t('Top-up History')}
              </TabButton>
            </div>

            {activeTab === TAB_SUBSCRIPTION ? (
              <div className='space-y-4'>
                <div className='rounded-xl border border-[#dbe7f8] bg-[#f4f8ff] p-4'>
                  <div className='mb-3 flex flex-wrap items-center justify-between gap-3'>
                    <div className='flex items-center gap-2'>
                      <p className='text-sm font-semibold text-slate-800'>
                        {t('我的订阅')}
                      </p>
                      <Badge variant={hasActiveSubscription ? 'default' : 'outline'}>
                        {hasActiveSubscription
                          ? `${activeSubscriptions.length}${t('个生效中')}`
                          : t('无生效订阅')}
                      </Badge>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Select
                        value={
                          subscriptionPreferenceNeedsFallback
                            ? 'wallet_first'
                            : billingPreference
                        }
                        onValueChange={handleBillingPreferenceChange}
                      >
                        <SelectTrigger className='h-8 w-[150px] rounded-lg border-[#c9d8ef] bg-white text-xs'>
                          <SelectValue placeholder={t('扣费策略')} />
                        </SelectTrigger>
                        <SelectContent>
                          {BILLING_PREFERENCES.map((item) => (
                            <SelectItem
                              key={item.value}
                              value={item.value}
                              disabled={
                                !hasActiveSubscription &&
                                (item.value === 'subscription_first' ||
                                  item.value === 'subscription_only')
                              }
                            >
                              {t(item.label)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          loadSubscriptionSelf(true);
                        }}
                        loading={refreshingSubscription}
                      >
                        <RefreshCcw className='h-3.5 w-3.5' />
                      </Button>
                    </div>
                  </div>

                  {subscriptionPreferenceNeedsFallback ? (
                    <p className='text-xs text-slate-500'>
                      {t('当前无生效订阅，系统会自动回退到钱包扣费。')}
                    </p>
                  ) : null}

                  {allSubscriptions.length > 0 ? (
                    <div className='mt-3 space-y-2'>
                      {allSubscriptions.slice(0, 4).map((sub, index) => {
                        const subscription = sub?.subscription || {};
                        const now = Date.now() / 1000;
                        const isActive =
                          subscription?.status === 'active' &&
                          Number(subscription?.end_time || 0) > now;
                        return (
                          <div
                            key={subscription?.id || index}
                            className='rounded-lg border border-[#cfddf2] bg-white px-3 py-2 text-xs'
                          >
                            <div className='flex items-center justify-between gap-3'>
                              <span className='font-medium text-slate-700'>
                                #{subscription?.id || '-'} · {t('套餐')}:{' '}
                                {subscription?.plan_id || '-'}
                              </span>
                              <Badge variant={isActive ? 'default' : 'outline'}>
                                {isActive ? t('生效中') : t('已过期')}
                              </Badge>
                            </div>
                            <div className='mt-1 text-slate-500'>
                              {t('到期时间')}: {formatTime(subscription?.end_time)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className='text-xs text-slate-500'>
                      {t('暂无订阅记录，购买后即可在此查看权益。')}
                    </p>
                  )}
                </div>

                {subscriptionLoading ? (
                  <div className='flex min-h-[140px] items-center justify-center rounded-xl border border-dashed border-[#d5e0f2] bg-[#f9fbff]'>
                    <Loader2 className='h-5 w-5 animate-spin text-slate-400' />
                  </div>
                ) : subscriptionPlans.length === 0 ? (
                  <div className='rounded-xl border border-dashed border-[#d5e0f2] bg-[#f9fbff] p-8 text-center text-sm text-slate-500'>
                    {t('暂无可购买套餐')}
                  </div>
                ) : (
                  <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                    {subscriptionPlans.map((record, index) => {
                      const plan = record?.plan || {};
                      const { symbol, rate } = getCurrencyConfig();
                      const planId = plan?.id;
                      const amountValue = Number(plan?.price_amount || 0) * rate;
                      const displayAmount = amountValue.toFixed(
                        Number.isInteger(amountValue) ? 0 : 2,
                      );
                      const planMethod =
                        subscriptionMethodByPlan[planId] ||
                        getPlanDefaultMethod(plan, epayMethods, {
                          enableOnlineTopUp,
                          enableStripeTopUp,
                          enableCreemTopUp,
                        });
                      const methodOptions = [];
                      if (enableStripeTopUp && plan?.stripe_price_id) {
                        methodOptions.push({
                          value: 'stripe',
                          label: PAYMENT_METHOD_LABELS.stripe,
                        });
                      }
                      if (enableCreemTopUp && plan?.creem_product_id) {
                        methodOptions.push({
                          value: 'creem',
                          label: PAYMENT_METHOD_LABELS.creem,
                        });
                      }
                      if (enableOnlineTopUp) {
                        epayMethods.forEach((method) => {
                          methodOptions.push({
                            value: `epay:${method.type}`,
                            label:
                              method.name ||
                              t(PAYMENT_METHOD_LABELS[method.type] || method.type),
                          });
                        });
                      }

                      return (
                        <div
                          key={planId || index}
                          className='flex h-full flex-col rounded-xl border border-[#d5e1f4] bg-white p-4 shadow-sm'
                        >
                          {index === 0 ? (
                            <Badge className='mb-2 w-fit rounded-full bg-[#ecefff] text-[#4a4bd7] hover:bg-[#e0e6ff]'>
                              <Sparkles className='mr-1 h-3.5 w-3.5' />
                              {t('推荐')}
                            </Badge>
                          ) : null}
                          <p className='text-lg font-bold text-slate-900'>
                            {plan?.title || t('未命名套餐')}
                          </p>
                          <p className='mt-1 min-h-[36px] text-xs text-slate-500'>
                            {plan?.description || t('暂无套餐说明')}
                          </p>

                          <div className='mt-3'>
                            <p className='text-3xl font-extrabold text-[#4a4bd7]'>
                              {symbol}
                              {displayAmount}
                            </p>
                            <p className='text-xs text-slate-500'>
                              {t('有效期')}: {formatSubscriptionDuration(plan, t)}
                            </p>
                            <p className='text-xs text-slate-500'>
                              {t('总额度')}:{' '}
                              {Number(plan?.total_amount || 0) > 0
                                ? renderQuota(Number(plan.total_amount))
                                : t('不限')}
                            </p>
                          </div>

                          <div className='mt-4 space-y-2'>
                            {methodOptions.length > 0 ? (
                              <Select
                                value={planMethod}
                                onValueChange={(value) => {
                                  handleSubscriptionMethodChange(planId, value);
                                }}
                              >
                                <SelectTrigger className='h-8 rounded-lg border-[#d2ddf2] bg-[#f8fbff] text-xs'>
                                  <SelectValue placeholder={t('选择支付方式')} />
                                </SelectTrigger>
                                <SelectContent>
                                  {methodOptions.map((method) => (
                                    <SelectItem
                                      key={`${planId}-${method.value}`}
                                      value={method.value}
                                    >
                                      {method.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <p className='rounded-lg border border-dashed border-[#d5e1f4] px-3 py-2 text-xs text-slate-500'>
                                {t('当前套餐未配置支付方式')}
                              </p>
                            )}
                            <Button
                              className='h-9 w-full rounded-lg bg-[#4a4bd7] text-sm font-semibold hover:bg-[#3f40c6]'
                              onClick={() => {
                                handleSubscriptionPay(record);
                              }}
                              loading={planPayingId === planId}
                              disabled={methodOptions.length === 0}
                            >
                              {t('立即订阅')}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === TAB_WALLET ? (
              <div className='space-y-4'>
                <div className='rounded-xl border border-[#d5e1f4] bg-gradient-to-br from-[#4a4bd7] to-[#6973ff] p-4 text-white'>
                  <div className='grid grid-cols-3 gap-3'>
                    <MetricBlock
                      label={t('当前余额')}
                      value={renderQuota(userInfo?.quota || 0)}
                    />
                    <MetricBlock
                      label={t('历史消耗')}
                      value={renderQuota(userInfo?.used_quota || 0)}
                    />
                    <MetricBlock
                      label={t('请求次数')}
                      value={String(userInfo?.request_count || 0)}
                    />
                  </div>
                </div>

                <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                  <Card className='border-[#d7e3f4]'>
                    <CardHeader className='pb-2'>
                      <CardTitle className='flex items-center gap-2 text-sm'>
                        <Wallet className='h-4 w-4' />
                        {t('在线充值')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-3'>
                      <Input
                        label={t('充值数量')}
                        value={String(topUpCount)}
                        onChange={handleTopupCountInput}
                        onBlur={handleTopupCountBlur}
                        className='h-9 rounded-lg border-[#d6e3f5] bg-[#f8fbff]'
                      />
                      <p className='text-xs text-slate-500'>
                        {t('最低充值')}: {renderQuota(minTopUp)}
                      </p>
                      <div className='grid grid-cols-3 gap-2'>
                        {presetAmounts.slice(0, 6).map((preset) => (
                          <button
                            key={preset.value}
                            type='button'
                            className={[
                              'rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
                              selectedPreset === preset.value
                                ? 'border-[#4a4bd7] bg-[#eef2ff] text-[#4a4bd7]'
                                : 'border-[#d3deef] bg-white text-slate-600 hover:bg-[#f7f9ff]',
                            ].join(' ')}
                            onClick={() => {
                              handleSelectPreset(preset);
                            }}
                          >
                            {preset.value}
                          </button>
                        ))}
                      </div>
                      <Select
                        value={selectedPayMethod}
                        onValueChange={(value) => {
                          setSelectedPayMethod(value);
                        }}
                      >
                        <SelectTrigger className='h-9 rounded-lg border-[#d6e3f5] bg-[#f8fbff] text-sm'>
                          <SelectValue placeholder={t('选择支付方式')} />
                        </SelectTrigger>
                        <SelectContent>
                          {payMethods.map((method) => (
                            <SelectItem key={method.type} value={method.type}>
                              {method.name ||
                                t(PAYMENT_METHOD_LABELS[method.type] || method.type)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedPayMethod === 'creem' && creemProducts.length > 0 ? (
                        <Select
                          value={selectedCreemProductId}
                          onValueChange={(value) => {
                            setSelectedCreemProductId(value);
                          }}
                        >
                          <SelectTrigger className='h-9 rounded-lg border-[#d6e3f5] bg-[#f8fbff] text-sm'>
                            <SelectValue placeholder={t('选择 Creem 产品')} />
                          </SelectTrigger>
                          <SelectContent>
                            {creemProducts.map((product) => (
                              <SelectItem
                                key={product.productId}
                                value={product.productId}
                              >
                                {product.name} ({product.currency || 'USD'} {product.price})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null}

                      <div className='flex items-center justify-between rounded-lg border border-[#dce7f8] bg-[#f5f8ff] px-3 py-2'>
                        <span className='text-xs text-slate-600'>{t('实付金额')}</span>
                        <span className='text-sm font-semibold text-[#3349c7]'>
                          {amountLoading ? t('计算中...') : renderAmountText}
                        </span>
                      </div>
                      <Button
                        onClick={handleWalletPay}
                        loading={paying}
                        className='h-9 w-full rounded-lg bg-[#4a4bd7] text-sm font-semibold hover:bg-[#3f40c6]'
                      >
                        {t('立即支付')}
                      </Button>
                      {topUpLink ? (
                        <Button
                          variant='outline'
                          className='h-9 w-full rounded-lg text-sm'
                          onClick={handleOpenTopUpLink}
                        >
                          <ArrowUpRight className='mr-1.5 h-3.5 w-3.5' />
                          {t('打开外部充值链接')}
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card className='border-[#d7e3f4]'>
                    <CardHeader className='pb-2'>
                      <CardTitle className='flex items-center gap-2 text-sm'>
                        <Ticket className='h-4 w-4' />
                        {t('兑换码充值')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-3'>
                      <Input
                        label={t('兑换码')}
                        icon={<Ticket className='h-4 w-4 text-slate-400' />}
                        value={redeemCode}
                        onChange={(event) => {
                          setRedeemCode(event.target.value);
                        }}
                        className='h-9 rounded-lg border-[#d6e3f5] bg-[#f8fbff]'
                      />
                      <Button
                        onClick={handleRedeem}
                        loading={redeeming}
                        className='h-9 w-full rounded-lg bg-[#4a4bd7] text-sm font-semibold hover:bg-[#3f40c6]'
                      >
                        {t('立即兑换')}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : null}

            {activeTab === TAB_HISTORY ? (
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <h3 className='text-sm font-semibold text-slate-900'>
                    {t('最近充值记录')}
                  </h3>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={loadTopupHistory}
                    loading={historyLoading}
                  >
                    <RefreshCcw className='mr-1.5 h-3.5 w-3.5' />
                    {t('刷新')}
                  </Button>
                </div>

                {topupHistory.length === 0 ? (
                  <div className='rounded-xl border border-dashed border-[#d5e1f4] bg-[#f9fbff] p-8 text-center text-sm text-slate-500'>
                    {historyLoading ? t('加载中...') : t('暂无充值记录')}
                  </div>
                ) : (
                  <div className='rounded-xl border border-[#d5e1f4] bg-white p-2'>
                    <Table>
                      <Thead>
                        <Tr>
                          <Th>{t('订单号')}</Th>
                          <Th>{t('支付方式')}</Th>
                          <Th>{t('额度')}</Th>
                          <Th>{t('金额')}</Th>
                          <Th>{t('状态')}</Th>
                          <Th>{t('时间')}</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {topupHistory.map((record) => (
                          <Tr key={record?.id || record?.trade_no}>
                            <Td className='max-w-[150px] truncate font-mono text-xs'>
                              {record?.trade_no || '-'}
                            </Td>
                            <Td>
                              {t(
                                PAYMENT_METHOD_LABELS[record?.payment_method] ||
                                  record?.payment_method ||
                                  '-',
                              )}
                            </Td>
                            <Td>{record?.amount ?? '-'}</Td>
                            <Td>{formatMoney(record?.money)}</Td>
                            <Td>{statusToBadge(record?.status, t)}</Td>
                            <Td className='text-xs text-slate-500'>
                              {formatTime(record?.create_time)}
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className='col-span-12 space-y-6 lg:col-span-5'>
        <Card className='border-[#d7e3f4]'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Gift className='h-4 w-4 text-[#4a4bd7]' />
              {t('Referral Program')}
            </CardTitle>
            <CardDescription>{t('邀请好友注册并获得返利收益')}</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-3 gap-3'>
              <RightMetricCard
                label={t('待使用收益')}
                value={renderQuota(userInfo?.aff_quota || 0)}
              />
              <RightMetricCard
                label={t('历史收益')}
                value={renderQuota(userInfo?.aff_history_quota || 0)}
              />
              <RightMetricCard
                label={t('邀请人数')}
                value={String(userInfo?.aff_count || 0)}
              />
            </div>

            <Input label={t('邀请码')} value={affCode || '-'} readOnly />
            <Input label={t('邀请链接')} value={affLink || '-'} readOnly />
            <Button
              variant='outline'
              onClick={handleCopyAffLink}
              disabled={!affLink}
              className='h-9 w-full rounded-lg text-sm'
            >
              <Copy className='mr-1.5 h-3.5 w-3.5' />
              {t('复制邀请链接')}
            </Button>

            <div className='rounded-xl border border-[#dbe7f8] bg-[#f6f9ff] p-3'>
              <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500'>
                {t('邀请额度划转')}
              </p>
              <Input
                type='number'
                min={quotaUnit}
                value={String(transferAmount)}
                onChange={(event) => {
                  setTransferAmount(event.target.value);
                }}
                className='h-9 rounded-lg border-[#d6e3f5] bg-white'
              />
              <Button
                className='mt-2 h-9 w-full rounded-lg bg-[#4a4bd7] text-sm font-semibold hover:bg-[#3f40c6]'
                onClick={handleTransferAffQuota}
                loading={transferLoading}
                disabled={Number(userInfo?.aff_quota || 0) <= 0}
              >
                {t('划转到余额')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className='overflow-hidden border-0 bg-gradient-to-br from-[#4a4bd7] to-[#3039a6] text-white shadow-lg shadow-[#4a4bd7]/30'>
          <CardContent className='relative p-6'>
            <div className='absolute -right-8 -bottom-8 opacity-20'>
              <CreditCard className='h-24 w-24' />
            </div>
            <p className='text-[11px] uppercase tracking-[0.2em] text-white/75'>
              {t('Available Credits')}
            </p>
            <p className='mt-2 text-3xl font-black'>
              {renderQuota(userInfo?.quota || 0)}
            </p>
            <Button
              variant='outline'
              className='mt-4 h-9 rounded-lg border-white/50 bg-white/10 text-sm text-white hover:bg-white/20'
              onClick={() => {
                setActiveTab(TAB_WALLET);
              }}
            >
              <TrendingUp className='mr-1.5 h-3.5 w-3.5' />
              {t('去充值')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={[
        'px-4 py-2.5 text-sm font-semibold transition-colors',
        active
          ? 'border-b-2 border-[#4a4bd7] text-[#4a4bd7]'
          : 'text-slate-500 hover:text-slate-700',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function MetricBlock({ label, value }) {
  return (
    <div className='rounded-lg border border-white/25 bg-white/10 px-3 py-2'>
      <p className='text-[10px] uppercase tracking-wide text-white/70'>{label}</p>
      <p className='mt-1 text-base font-bold text-white'>{value}</p>
    </div>
  );
}

function RightMetricCard({ label, value }) {
  return (
    <div className='rounded-xl border border-[#dce7f8] bg-[#f5f8ff] p-3'>
      <p className='text-[10px] uppercase tracking-wide text-slate-500'>{label}</p>
      <p className='mt-1 text-sm font-semibold text-slate-900'>{value}</p>
    </div>
  );
}
