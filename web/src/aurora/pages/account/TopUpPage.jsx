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

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Copy as CopyIcon,
  CreditCard,
  Gift,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import {
  API,
  copy,
  getQuotaPerUnit,
  renderQuota,
  renderQuotaWithAmount,
  showError,
  showInfo,
  showSuccess,
} from '../../../helpers';
import { getCurrencyConfig } from '../../../helpers/render';
import { UserContext } from '../../../context/User';
import { StatusContext } from '../../../context/Status';
import SubscriptionPlansCard from '../../../components/topup/SubscriptionPlansCard';
import TransferModal from '../../../components/topup/modals/TransferModal';
import PaymentConfirmModal from '../../../components/topup/modals/PaymentConfirmModal';
import TopupHistoryModal from '../../../components/topup/modals/TopupHistoryModal';

const formatTime = (unixTs) => {
  if (!unixTs) return '-';
  const value = Number(unixTs);
  if (Number.isNaN(value)) return '-';
  const date = value > 1e12 ? new Date(value) : new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
};

const formatMoney = (money) => {
  const number = Number(money);
  if (Number.isNaN(number)) return '-';
  return `¥${number.toFixed(2)}`;
};

const INVALID_TEXT_SET = new Set([
  'NA',
  'N/A',
  'NaN',
  'nan',
  'null',
  'undefined',
]);

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value, fallback = '-') => {
  if (value === null || value === undefined) {
    return fallback;
  }
  const text = String(value).trim();
  if (!text || INVALID_TEXT_SET.has(text)) {
    return fallback;
  }
  return text;
};

function parsePayMethods(rawMethods, stripeMinTopup, t) {
  let methods = rawMethods || [];
  if (typeof methods === 'string') {
    try {
      methods = JSON.parse(methods);
    } catch (error) {
      methods = [];
    }
  }
  if (!Array.isArray(methods)) {
    return [];
  }
  return methods
    .filter((method) => method?.name && method?.type)
    .map((method) => {
      const nextMethod = { ...method };
      const normalizedMinTopup = Number(nextMethod.min_topup);
      nextMethod.min_topup = Number.isFinite(normalizedMinTopup)
        ? normalizedMinTopup
        : 0;
      if (
        nextMethod.type === 'stripe' &&
        (!nextMethod.min_topup || nextMethod.min_topup <= 0)
      ) {
        const stripeMin = Number(stripeMinTopup);
        if (Number.isFinite(stripeMin)) {
          nextMethod.min_topup = stripeMin;
        }
      }
      if (!nextMethod.color) {
        if (nextMethod.type === 'alipay') {
          nextMethod.color = '#1677FF';
        } else if (nextMethod.type === 'wxpay') {
          nextMethod.color = '#07C160';
        } else if (nextMethod.type === 'stripe') {
          nextMethod.color = '#635BFF';
        } else {
          nextMethod.color = '#4a4bd7';
        }
      }
      if (!nextMethod.name) {
        nextMethod.name = t('支付方式');
      }
      return nextMethod;
    });
}

function generatePresetAmounts(minAmount) {
  const multipliers = [1, 5, 10, 30, 50, 100, 300, 500];
  return multipliers.map((multiplier) => ({
    value: minAmount * multiplier,
  }));
}

export default function TopUpPage() {
  const { t } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);

  const [statusLoading, setStatusLoading] = useState(true);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [amountLoading, setAmountLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeBillingTab, setActiveBillingTab] = useState('subscription');
  const [redemptionCode, setRedemptionCode] = useState('');
  const [topUpCount, setTopUpCount] = useState(1);
  const [minTopUp, setMinTopUp] = useState(1);
  const [priceRatio, setPriceRatio] = useState(1);
  const [amount, setAmount] = useState(0);
  const [payWay, setPayWay] = useState('');
  const [payMethods, setPayMethods] = useState([]);
  const [presetAmounts, setPresetAmounts] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [topupInfo, setTopupInfo] = useState({
    amount_options: [],
    discount: {},
  });

  const [topUpLink, setTopUpLink] = useState('');
  const [enableOnlineTopUp, setEnableOnlineTopUp] = useState(false);
  const [enableStripeTopUp, setEnableStripeTopUp] = useState(false);
  const [enableCreemTopUp, setEnableCreemTopUp] = useState(false);
  const [creemProducts, setCreemProducts] = useState([]);
  const [creemOpen, setCreemOpen] = useState(false);
  const [selectedCreemProduct, setSelectedCreemProduct] = useState(null);

  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [billingPreference, setBillingPreference] =
    useState('subscription_first');
  const [activeSubscriptions, setActiveSubscriptions] = useState([]);
  const [allSubscriptions, setAllSubscriptions] = useState([]);

  const [affLink, setAffLink] = useState('');
  const [openTransfer, setOpenTransfer] = useState(false);
  const [transferAmount, setTransferAmount] = useState(0);

  const [openConfirm, setOpenConfirm] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);
  const [topupPreview, setTopupPreview] = useState([]);

  const affFetchedRef = useRef(false);

  const currencyConfig = getCurrencyConfig();
  const currentDiscountRate = topupInfo?.discount?.[topUpCount] || 1.0;
  const displayPaidAmount = `${toFiniteNumber(amount, 0).toFixed(2)} ${t('元')}`;

  const hasPayGatewayEnabled =
    enableOnlineTopUp || enableStripeTopUp || enableCreemTopUp;

  const referralStats = useMemo(
    () => [
      {
        label: t('待使用收益'),
        value: renderQuota(userState?.user?.aff_quota || 0),
      },
      {
        label: t('总收益'),
        value: renderQuota(userState?.user?.aff_history_quota || 0),
      },
      {
        label: t('邀请人数'),
        value: String(userState?.user?.aff_count || 0),
      },
    ],
    [
      t,
      userState?.user?.aff_count,
      userState?.user?.aff_history_quota,
      userState?.user?.aff_quota,
    ],
  );

  const getAmount = async (value) => {
    const nextAmount = Number(value ?? topUpCount);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setAmount(0);
      return;
    }
    setAmountLoading(true);
    try {
      const res = await API.post('/api/user/amount', {
        amount: Number.parseFloat(String(nextAmount)),
      });
      if (res?.data?.message === 'success') {
        setAmount(toFiniteNumber(Number.parseFloat(String(res.data?.data)), 0));
      } else {
        setAmount(0);
      }
    } catch (error) {
      setAmount(0);
    } finally {
      setAmountLoading(false);
    }
  };

  const getStripeAmount = async (value) => {
    const nextAmount = Number(value ?? topUpCount);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setAmount(0);
      return;
    }
    setAmountLoading(true);
    try {
      const res = await API.post('/api/user/stripe/amount', {
        amount: Number.parseFloat(String(nextAmount)),
      });
      if (res?.data?.message === 'success') {
        setAmount(toFiniteNumber(Number.parseFloat(String(res.data?.data)), 0));
      } else {
        setAmount(0);
      }
    } catch (error) {
      setAmount(0);
    } finally {
      setAmountLoading(false);
    }
  };

  const getUserQuota = async () => {
    try {
      const res = await API.get('/api/user/self');
      if (res.data?.success) {
        userDispatch({ type: 'login', payload: res.data.data });
      } else {
        showError(res.data?.message || t('获取用户信息失败'));
      }
    } catch (error) {
      showError(t('获取用户信息失败'));
    }
  };

  const loadTopupPreview = async () => {
    setHistoryLoading(true);
    try {
      let res;
      try {
        res = await API.get('/api/user/topup/self?p=0&page_size=8');
      } catch (primaryError) {
        res = await API.get('/api/user/topup?p=0&page_size=8');
      }
      if (res.data?.success) {
        setTopupPreview(res.data.data?.items || []);
      } else {
        setTopupPreview([]);
      }
    } catch (error) {
      setTopupPreview([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const getSubscriptionPlans = async () => {
    setSubscriptionLoading(true);
    try {
      const res = await API.get('/api/subscription/plans');
      if (res.data?.success) {
        setSubscriptionPlans(res.data.data || []);
      } else {
        setSubscriptionPlans([]);
      }
    } catch (error) {
      setSubscriptionPlans([]);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const getSubscriptionSelf = async () => {
    try {
      const res = await API.get('/api/subscription/self');
      if (res.data?.success) {
        setBillingPreference(
          res.data.data?.billing_preference || 'subscription_first',
        );
        setActiveSubscriptions(res.data.data?.subscriptions || []);
        setAllSubscriptions(res.data.data?.all_subscriptions || []);
      }
    } catch (error) {
      setActiveSubscriptions([]);
      setAllSubscriptions([]);
    }
  };

  const updateBillingPreference = async (preference) => {
    const previousPreference = billingPreference;
    setBillingPreference(preference);
    try {
      const res = await API.put('/api/subscription/self/preference', {
        billing_preference: preference,
      });
      if (res.data?.success) {
        showSuccess(t('更新成功'));
        const normalizedPreference =
          res.data?.data?.billing_preference ||
          preference ||
          previousPreference;
        setBillingPreference(normalizedPreference);
      } else {
        showError(res.data?.message || t('更新失败'));
        setBillingPreference(previousPreference);
      }
    } catch (error) {
      showError(t('请求失败'));
      setBillingPreference(previousPreference);
    }
  };

  const getTopupInfo = async () => {
    try {
      const res = await API.get('/api/user/topup/info');
      const { success, data } = res.data;
      if (!success) {
        return;
      }

      const amountOptions = data?.amount_options || [];
      const discountMap = data?.discount || {};
      const parsedPayMethods = parsePayMethods(
        data?.pay_methods,
        data?.stripe_min_topup,
        t,
      );
      const onlineEnabled = !!data?.enable_online_topup;
      const stripeEnabled = !!data?.enable_stripe_topup;
      const creemEnabled = !!data?.enable_creem_topup;
      const resolvedMinTopup = onlineEnabled
        ? Number(data?.min_topup || 1)
        : stripeEnabled
          ? Number(data?.stripe_min_topup || 1)
          : 1;
      const safeMinTopup = Number.isFinite(resolvedMinTopup)
        ? Math.max(1, resolvedMinTopup)
        : 1;

      let parsedCreemProducts = [];
      try {
        parsedCreemProducts = JSON.parse(data?.creem_products || '[]');
      } catch (error) {
        parsedCreemProducts = [];
      }

      setTopupInfo({
        amount_options: amountOptions,
        discount: discountMap,
      });
      setPayMethods(parsedPayMethods);
      setEnableOnlineTopUp(onlineEnabled);
      setEnableStripeTopUp(stripeEnabled);
      setEnableCreemTopUp(creemEnabled);
      setMinTopUp(safeMinTopup);
      setTopUpCount(safeMinTopup);
      setSelectedPreset(safeMinTopup);
      setCreemProducts(parsedCreemProducts);

      if (amountOptions.length > 0) {
        setPresetAmounts(
          amountOptions.map((option) => ({
            value: option,
            discount: discountMap[option] || 1.0,
          })),
        );
      } else {
        setPresetAmounts(generatePresetAmounts(safeMinTopup));
      }
      await getAmount(safeMinTopup);
    } catch (error) {
      setPayMethods([]);
    }
  };

  const getAffLink = async () => {
    try {
      const res = await API.get('/api/user/aff');
      if (res.data?.success) {
        setAffLink(`${window.location.origin}/register?aff=${res.data.data}`);
      } else {
        showError(res.data?.message || t('获取邀请链接失败'));
      }
    } catch (error) {
      showError(t('获取邀请链接失败'));
    }
  };

  const handleAffLinkClick = async () => {
    if (!affLink) return;
    const ok = await copy(affLink);
    if (ok) {
      showSuccess(t('邀请链接已复制到剪切板'));
      return;
    }
    showError(t('复制失败，请手动复制'));
  };

  const transfer = async () => {
    if (transferAmount < getQuotaPerUnit()) {
      showError(t('划转金额最低为') + ' ' + renderQuota(getQuotaPerUnit()));
      return;
    }
    try {
      const res = await API.post('/api/user/aff_transfer', {
        quota: transferAmount,
      });
      if (res.data?.success) {
        showSuccess(res.data?.message || t('划转成功'));
        setOpenTransfer(false);
        await getUserQuota();
      } else {
        showError(res.data?.message || t('划转失败'));
      }
    } catch (error) {
      showError(t('划转失败'));
    }
  };

  const openTopUpLink = () => {
    if (!topUpLink) {
      showError(t('超级管理员未设置充值链接！'));
      return;
    }
    window.open(topUpLink, '_blank');
  };

  const topUp = async () => {
    if (!redemptionCode.trim()) {
      showInfo(t('请输入兑换码！'));
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await API.post('/api/user/topup', {
        key: redemptionCode.trim(),
      });
      if (res.data?.success) {
        const quotaDelta = Number(res.data?.data || 0);
        showSuccess(t('兑换成功！'));
        if (userState.user) {
          userDispatch({
            type: 'login',
            payload: {
              ...userState.user,
              quota: Number(userState.user.quota || 0) + quotaDelta,
            },
          });
        }
        setRedemptionCode('');
        await loadTopupPreview();
      } else {
        showError(res.data?.message || t('兑换失败'));
      }
    } catch (error) {
      showError(t('请求失败'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const preTopUp = async (paymentType) => {
    const isStripe = paymentType === 'stripe';
    if (isStripe && !enableStripeTopUp) {
      showError(t('管理员未开启Stripe充值！'));
      return;
    }
    if (!isStripe && !enableOnlineTopUp) {
      showError(t('管理员未开启在线充值！'));
      return;
    }
    const methodConfig = payMethods.find(
      (method) => method.type === paymentType,
    );
    const methodMinTopup = Number(methodConfig?.min_topup || minTopUp || 1);
    if (Number(topUpCount) < methodMinTopup) {
      showError(t('充值数量不能小于') + methodMinTopup);
      return;
    }
    setPayWay(paymentType);
    setPaymentLoading(true);
    try {
      if (isStripe) {
        await getStripeAmount(topUpCount);
      } else {
        await getAmount(topUpCount);
      }
      setOpenConfirm(true);
    } catch (error) {
      showError(t('获取金额失败'));
    } finally {
      setPaymentLoading(false);
    }
  };

  const onlineTopUp = async () => {
    const isStripe = payWay === 'stripe';
    const methodConfig = payMethods.find((method) => method.type === payWay);
    const methodMinTopup = Number(methodConfig?.min_topup || minTopUp || 1);
    if (Number(topUpCount) < methodMinTopup) {
      showError(t('充值数量不能小于') + methodMinTopup);
      return;
    }
    if (amount === 0) {
      if (isStripe) {
        await getStripeAmount(topUpCount);
      } else {
        await getAmount(topUpCount);
      }
    }

    setConfirmLoading(true);
    try {
      let res;
      if (isStripe) {
        res = await API.post('/api/user/stripe/pay', {
          amount: Number.parseInt(String(topUpCount), 10),
          payment_method: 'stripe',
        });
      } else {
        res = await API.post('/api/user/pay', {
          amount: Number.parseInt(String(topUpCount), 10),
          payment_method: payWay,
        });
      }
      if (res?.data?.message === 'success') {
        if (isStripe) {
          window.open(res.data?.data?.pay_link, '_blank');
        } else {
          const form = document.createElement('form');
          form.action = res.data?.url;
          form.method = 'POST';
          const isSafari =
            navigator.userAgent.includes('Safari') &&
            !navigator.userAgent.includes('Chrome');
          if (!isSafari) {
            form.target = '_blank';
          }
          Object.keys(res.data?.data || {}).forEach((key) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = res.data.data[key];
            form.appendChild(input);
          });
          document.body.appendChild(form);
          form.submit();
          document.body.removeChild(form);
        }
        showSuccess(t('已发起支付'));
      } else {
        const errorMessage =
          typeof res?.data?.data === 'string'
            ? res.data.data
            : res?.data?.message || t('支付失败');
        showError(errorMessage);
      }
    } catch (error) {
      showError(t('支付请求失败'));
    } finally {
      setOpenConfirm(false);
      setConfirmLoading(false);
    }
  };

  const creemPreTopUp = (product) => {
    if (!enableCreemTopUp) {
      showError(t('管理员未开启 Creem 充值！'));
      return;
    }
    setSelectedCreemProduct(product);
    setCreemOpen(true);
  };

  const onlineCreemTopUp = async () => {
    if (!selectedCreemProduct?.productId) {
      showError(t('产品配置错误，请联系管理员'));
      return;
    }
    setConfirmLoading(true);
    try {
      const res = await API.post('/api/user/creem/pay', {
        product_id: selectedCreemProduct.productId,
        payment_method: 'creem',
      });
      if (res?.data?.message === 'success') {
        window.open(res.data?.data?.checkout_url, '_blank');
        showSuccess(t('已打开支付页面'));
      } else {
        const errorMessage =
          typeof res?.data?.data === 'string'
            ? res.data.data
            : res?.data?.message || t('支付失败');
        showError(errorMessage);
      }
    } catch (error) {
      showError(t('支付请求失败'));
    } finally {
      setCreemOpen(false);
      setSelectedCreemProduct(null);
      setConfirmLoading(false);
    }
  };

  const selectPresetAmount = async (preset) => {
    const selectedAmount = toFiniteNumber(preset?.value, 0);
    if (!Number.isFinite(selectedAmount) || selectedAmount <= 0) return;
    setTopUpCount(selectedAmount);
    setSelectedPreset(selectedAmount);
    const discount = toFiniteNumber(
      preset?.discount || topupInfo?.discount?.[selectedAmount] || 1.0,
      1.0,
    );
    const validDiscount = discount > 0 ? discount : 1.0;
    const validPriceRatio = toFiniteNumber(priceRatio, 1.0);
    const discountedAmount = selectedAmount * validPriceRatio * validDiscount;
    setAmount(discountedAmount);
    if (payWay === 'stripe') {
      await getStripeAmount(selectedAmount);
    } else if (payWay) {
      await getAmount(selectedAmount);
    }
  };

  useEffect(() => {
    getUserQuota().then();
    setTransferAmount(getQuotaPerUnit());
  }, []);

  useEffect(() => {
    if (affFetchedRef.current) return;
    affFetchedRef.current = true;
    getAffLink().then();
  }, []);

  useEffect(() => {
    getTopupInfo().then();
    getSubscriptionPlans().then();
    getSubscriptionSelf().then();
    loadTopupPreview().then();
  }, []);

  useEffect(() => {
    if (!statusState?.status) return;
    setTopUpLink(statusState.status.top_up_link || '');
    setPriceRatio(statusState.status.price || 1);
    setStatusLoading(false);
  }, [statusState?.status]);

  return (
    <div className='mx-auto w-full max-w-[1200px] p-4 sm:p-6'>
      <TransferModal
        t={t}
        openTransfer={openTransfer}
        transfer={transfer}
        handleTransferCancel={() => setOpenTransfer(false)}
        userState={userState}
        renderQuota={renderQuota}
        getQuotaPerUnit={getQuotaPerUnit}
        transferAmount={transferAmount}
        setTransferAmount={setTransferAmount}
      />

      <PaymentConfirmModal
        t={t}
        open={openConfirm}
        onlineTopUp={onlineTopUp}
        handleCancel={() => setOpenConfirm(false)}
        confirmLoading={confirmLoading}
        topUpCount={topUpCount}
        renderQuotaWithAmount={renderQuotaWithAmount}
        amountLoading={amountLoading}
        renderAmount={() => displayPaidAmount}
        payWay={payWay}
        payMethods={payMethods}
        amountNumber={amount}
        discountRate={currentDiscountRate}
      />

      <TopupHistoryModal
        visible={openHistory}
        onCancel={() => setOpenHistory(false)}
        t={t}
      />

      <Modal
        title={t('确定要充值')}
        visible={creemOpen}
        onOk={onlineCreemTopUp}
        onCancel={() => {
          setCreemOpen(false);
          setSelectedCreemProduct(null);
        }}
        maskClosable={false}
        size='small'
        centered
        confirmLoading={confirmLoading}
      >
        {selectedCreemProduct ? (
          <div className='space-y-2 text-sm'>
            <p>
              {t('产品名称')}：{selectedCreemProduct.name}
            </p>
            <p>
              {t('价格')}：{selectedCreemProduct.currency === 'EUR' ? '€' : '$'}
              {selectedCreemProduct.price}
            </p>
            <p>
              {t('充值额度')}：{selectedCreemProduct.quota}
            </p>
            <p>{t('是否确认充值？')}</p>
          </div>
        ) : null}
      </Modal>

      <div className='mb-8 flex flex-wrap items-end justify-between gap-4'>
        <div>
          <h1 className='font-headline text-3xl font-black tracking-tight text-[#05345c]'>
            {t('Wallet & Billing')}
          </h1>
          <p className='mt-1 text-sm text-[#3d618c]'>
            {t('订阅套餐、在线充值、邀请返利与账单记录')}
          </p>
        </div>
        <div className='rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600'>
          {currencyConfig.type} ({currencyConfig.symbol})
        </div>
      </div>

      <div className='grid grid-cols-12 gap-6'>
        <section className='col-span-12 space-y-6 lg:col-span-7'>
          <div className='overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm'>
            <div className='flex items-center border-b border-gray-100 px-4'>
              <button
                type='button'
                className={`border-b-2 px-4 py-3 text-sm font-semibold ${
                  activeBillingTab === 'subscription'
                    ? 'border-[#4a4bd7] text-[#4a4bd7]'
                    : 'border-transparent text-gray-500'
                }`}
                onClick={() => setActiveBillingTab('subscription')}
              >
                {t('Subscription Plans')}
              </button>
              <button
                type='button'
                className={`border-b-2 px-4 py-3 text-sm font-semibold ${
                  activeBillingTab === 'history'
                    ? 'border-[#4a4bd7] text-[#4a4bd7]'
                    : 'border-transparent text-gray-500'
                }`}
                onClick={() => setActiveBillingTab('history')}
              >
                {t('Top-up History')}
              </button>
            </div>

            <div className='p-4 sm:p-6'>
              {activeBillingTab === 'subscription' ? (
                <SubscriptionPlansCard
                  t={t}
                  loading={subscriptionLoading}
                  plans={subscriptionPlans}
                  payMethods={payMethods}
                  enableOnlineTopUp={enableOnlineTopUp}
                  enableStripeTopUp={enableStripeTopUp}
                  enableCreemTopUp={enableCreemTopUp}
                  billingPreference={billingPreference}
                  onChangeBillingPreference={updateBillingPreference}
                  activeSubscriptions={activeSubscriptions}
                  allSubscriptions={allSubscriptions}
                  reloadSubscriptionSelf={getSubscriptionSelf}
                  withCard={false}
                />
              ) : (
                <div className='space-y-4'>
                  <div className='flex items-center justify-between'>
                    <h3 className='text-sm font-bold uppercase tracking-wider text-gray-500'>
                      {t('最近充值记录')}
                    </h3>
                    <div className='flex items-center gap-2'>
                      <button
                        type='button'
                        className='rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50'
                        onClick={() => loadTopupPreview()}
                        disabled={historyLoading}
                      >
                        <RefreshCw
                          size={13}
                          className={historyLoading ? 'animate-spin' : ''}
                        />
                      </button>
                      <button
                        type='button'
                        className='rounded-lg bg-[#4a4bd7] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3d3dcb]'
                        onClick={() => setOpenHistory(true)}
                      >
                        {t('查看全部')}
                      </button>
                    </div>
                  </div>
                  <div className='overflow-hidden rounded-lg border border-gray-100'>
                    <table className='w-full border-collapse text-left text-sm'>
                      <thead className='bg-gray-50 text-xs uppercase tracking-wider text-gray-500'>
                        <tr>
                          <th className='px-3 py-2'>{t('订单号')}</th>
                          <th className='px-3 py-2'>{t('额度')}</th>
                          <th className='px-3 py-2'>{t('金额')}</th>
                          <th className='px-3 py-2'>{t('状态')}</th>
                          <th className='px-3 py-2'>{t('时间')}</th>
                        </tr>
                      </thead>
                      <tbody className='divide-y divide-gray-100'>
                        {topupPreview.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className='px-3 py-8 text-center text-sm text-gray-400'
                            >
                              {historyLoading
                                ? t('加载中...')
                                : t('暂无充值记录')}
                            </td>
                          </tr>
                        ) : (
                          topupPreview.map((record) => (
                            <tr key={record.id || record.trade_no}>
                              <td className='max-w-[180px] truncate px-3 py-2 font-mono text-xs text-gray-500'>
                                {normalizeText(record.trade_no)}
                              </td>
                              <td className='px-3 py-2'>
                                {normalizeText(record.amount)}
                              </td>
                              <td className='px-3 py-2'>
                                {formatMoney(record.money)}
                              </td>
                              <td className='px-3 py-2'>
                                {normalizeText(record.status)}
                              </td>
                              <td className='px-3 py-2 text-xs text-gray-500'>
                                {formatTime(record.create_time)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className='rounded-xl border border-gray-200 bg-white p-5 shadow-sm'>
            <div className='mb-4 flex items-start justify-between gap-4'>
              <div>
                <h3 className='text-lg font-bold text-gray-900'>
                  {t('Recharge Center')}
                </h3>
                <p className='mt-1 text-sm text-gray-500'>
                  {t('支持在线支付、Stripe、Creem 与兑换码充值')}
                </p>
              </div>
              <button
                type='button'
                className='inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50'
                onClick={() => setOpenHistory(true)}
              >
                {t('账单明细')}
                <ArrowRight size={13} />
              </button>
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='rounded-xl border border-gray-100 bg-gray-50/60 p-4'>
                <label className='mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500'>
                  {t('充值数量')} ({t('最低')} {renderQuotaWithAmount(minTopUp)}
                  )
                </label>
                <input
                  className='w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#4a4bd7] focus:ring-2 focus:ring-[#4a4bd7]/15'
                  type='number'
                  min={minTopUp}
                  value={topUpCount}
                  onChange={async (event) => {
                    const nextValue = Number(event.target.value || minTopUp);
                    const safeValue = Number.isFinite(nextValue)
                      ? Math.max(1, nextValue)
                      : minTopUp;
                    setTopUpCount(safeValue);
                    setSelectedPreset(null);
                    if (payWay === 'stripe') {
                      await getStripeAmount(safeValue);
                    } else {
                      await getAmount(safeValue);
                    }
                  }}
                />
                <p className='mt-2 text-xs text-gray-500'>
                  {amountLoading
                    ? t('正在计算金额...')
                    : `${t('实付金额')}：${displayPaidAmount}`}
                </p>
              </div>

              <div className='rounded-xl border border-gray-100 bg-gray-50/60 p-4'>
                <label className='mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500'>
                  {t('兑换码充值')}
                </label>
                <input
                  className='w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#4a4bd7] focus:ring-2 focus:ring-[#4a4bd7]/15'
                  placeholder={t('请输入兑换码')}
                  value={redemptionCode}
                  onChange={(event) => {
                    setRedemptionCode(event.target.value);
                  }}
                />
                <button
                  type='button'
                  className='mt-3 w-full rounded-lg bg-[#4a4bd7] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3d3dcb] disabled:cursor-not-allowed disabled:opacity-60'
                  onClick={topUp}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t('提交中...') : t('立即兑换')}
                </button>
              </div>
            </div>

            <div className='mt-4 space-y-3'>
              <div>
                <p className='mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500'>
                  {t('推荐充值额度')}
                </p>
                <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
                  {presetAmounts.map((preset) => {
                    const discount =
                      toFiniteNumber(
                        preset?.discount ||
                          topupInfo?.discount?.[preset?.value] ||
                          1.0,
                        1.0,
                      ) || 1.0;
                    const validDiscount = discount > 0 ? discount : 1.0;
                    const presetValue = toFiniteNumber(preset?.value, 0);
                    const discountedAmount =
                      presetValue *
                      toFiniteNumber(priceRatio, 1.0) *
                      validDiscount;
                    const isActive = selectedPreset === presetValue;
                    return (
                      <button
                        key={presetValue}
                        type='button'
                        className={`rounded-lg border px-2 py-2 text-left text-xs transition ${
                          isActive
                            ? 'border-[#4a4bd7] bg-[#4a4bd7]/10 text-[#3d3dcb]'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-[#4a4bd7]/40'
                        }`}
                        onClick={() => selectPresetAmount(preset)}
                      >
                        <p className='font-semibold'>
                          {renderQuotaWithAmount(presetValue)}
                        </p>
                        <p className='text-[11px] text-gray-500'>
                          {currencyConfig.symbol}
                          {toFiniteNumber(discountedAmount, 0).toFixed(2)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className='mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500'>
                  {t('支付方式')}
                </p>
                {payMethods.length > 0 ? (
                  <div className='flex flex-wrap gap-2'>
                    {payMethods.map((method) => {
                      const methodMinTopup = Number(
                        method.min_topup || minTopUp || 1,
                      );
                      const disabled = topUpCount < methodMinTopup;
                      return (
                        <button
                          key={method.type}
                          type='button'
                          className='rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50'
                          style={{
                            borderColor:
                              !disabled && payWay === method.type
                                ? method.color
                                : undefined,
                          }}
                          onClick={() => preTopUp(method.type)}
                          disabled={disabled || paymentLoading}
                        >
                          {method.name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className='rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-500'>
                    {t('暂无可用的支付方式，请联系管理员配置')}
                  </div>
                )}
              </div>

              {enableCreemTopUp && creemProducts.length > 0 ? (
                <div>
                  <p className='mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500'>
                    {t('Creem 产品')}
                  </p>
                  <div className='grid gap-2 sm:grid-cols-2'>
                    {creemProducts.map((product) => (
                      <button
                        key={product.productId || product.name}
                        type='button'
                        className='flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs hover:border-[#4a4bd7]/50'
                        onClick={() => creemPreTopUp(product)}
                      >
                        <span>
                          <span className='block font-semibold text-gray-800'>
                            {product.name}
                          </span>
                          <span className='text-gray-500'>{product.quota}</span>
                        </span>
                        <span className='font-semibold text-[#4a4bd7]'>
                          {product.currency === 'EUR' ? '€' : '$'}
                          {product.price}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {!hasPayGatewayEnabled && topUpLink ? (
                <button
                  type='button'
                  className='inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50'
                  onClick={openTopUpLink}
                >
                  <CreditCard size={14} />
                  {t('打开外部充值链接')}
                </button>
              ) : null}

              {statusLoading ? (
                <p className='text-xs text-gray-500'>
                  {t('加载支付配置中...')}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <aside className='col-span-12 space-y-6 lg:col-span-5'>
          <div className='rounded-xl border border-gray-200 bg-white p-6 shadow-sm'>
            <div className='mb-6 flex items-center justify-between'>
              <h3 className='text-xl font-bold text-gray-900'>
                {t('邀请计划')}
              </h3>
              <Gift size={18} className='text-[#4a4bd7]' />
            </div>

            <div className='mb-6 grid grid-cols-3 gap-3'>
              {referralStats.map((item) => (
                <div
                  key={item.label}
                  className='rounded-lg border border-gray-100 bg-gray-50 p-3'
                >
                  <p className='mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500'>
                    {item.label}
                  </p>
                  <p className='truncate text-sm font-bold text-gray-900'>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className='mb-6'>
              <label className='mb-2 block text-sm font-semibold text-gray-700'>
                {t('邀请链接')}
              </label>
              <div className='flex gap-2'>
                <input
                  className='min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-600 outline-none'
                  readOnly
                  value={affLink}
                />
                <button
                  type='button'
                  className='rounded-lg border border-gray-200 bg-gray-100 p-2 text-gray-600 hover:bg-gray-200'
                  onClick={handleAffLinkClick}
                >
                  <CopyIcon size={15} />
                </button>
              </div>
            </div>

            <div className='space-y-2 border-t border-gray-100 pt-5'>
              <h4 className='text-sm font-bold text-gray-900'>
                {t('奖励规则')}
              </h4>
              <p className='text-sm text-gray-600'>
                1. {t('邀请好友注册并充值后，可获得邀请奖励额度。')}
              </p>
              <p className='text-sm text-gray-600'>
                2. {t('奖励额度可划转到钱包余额后再进行消费。')}
              </p>
              <p className='text-sm text-gray-600'>
                3. {t('请勿进行自邀请或异常行为，系统会执行风控审查。')}
              </p>
            </div>
          </div>

          <div className='relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 text-white shadow-sm'>
            <div className='relative z-10 space-y-3'>
              <p className='text-xs font-semibold uppercase tracking-widest text-white/75'>
                {t('可划转邀请额度')}
              </p>
              <p className='text-3xl font-black'>
                {renderQuota(userState?.user?.aff_quota || 0)}
              </p>
              <button
                type='button'
                className='inline-flex items-center gap-2 rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-white/30'
                onClick={() => setOpenTransfer(true)}
              >
                <Wallet size={14} />
                {t('划转到余额')}
              </button>
            </div>
            <div className='pointer-events-none absolute -right-8 -bottom-8 text-[120px] font-black text-white/10'>
              ¥
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
