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

import React, { useMemo, useState } from 'react';
import { Modal } from '@douyinfe/semi-ui';
import { useSubscriptionsData } from '../../../hooks/subscriptions/useSubscriptionsData';
import { renderQuota } from '../../../helpers';
import { convertUSDToCurrency } from '../../../helpers/render';
import SubscriptionPlanFormDialog from './components/SubscriptionPlanFormDialog';

const DURATION_LABELS = {
  year: '年',
  month: '月',
  day: '日',
  hour: '小时',
};

/**
 * 格式化套餐有效期显示。
 * @param {object} plan
 * @returns {string}
 */
function formatDuration(plan) {
  const unit = plan?.duration_unit || 'month';
  if (unit === 'custom') {
    return `自定义 ${Number(plan?.custom_seconds || 0)}s`;
  }
  const label = DURATION_LABELS[unit] || unit;
  return `${Number(plan?.duration_value || 0)}${label}`;
}

/**
 * 格式化额度显示。
 * @param {object} plan
 * @returns {string}
 */
function formatQuotaLimit(plan) {
  const total = Number(plan?.total_amount || 0);
  if (total <= 0) {
    return '不限';
  }
  return renderQuota(total);
}

/**
 * 生成特征摘要文案。
 * @param {object} plan
 * @returns {string}
 */
function buildFeatureSummary(plan) {
  if (plan?.subtitle) {
    return plan.subtitle;
  }
  const features = [];
  if (plan?.upgrade_group) {
    features.push(`升级分组 ${plan.upgrade_group}`);
  }
  if (Number(plan?.max_purchase_per_user || 0) > 0) {
    features.push(`限购 ${Number(plan.max_purchase_per_user)} 次`);
  }
  if (plan?.quota_reset_period && plan.quota_reset_period !== 'never') {
    features.push(`额度重置 ${plan.quota_reset_period}`);
  }
  return features.length > 0 ? features.join('，') : '无附加说明';
}

/**
 * 套餐状态切换按钮。
 * @param {object} props
 * @returns {JSX.Element}
 */
function StatusSwitch({ enabled, onToggle }) {
  const trackClass = enabled ? 'bg-emerald-500' : 'bg-gray-300';
  const knobClass = enabled ? 'translate-x-4' : 'translate-x-0';
  return (
    <button
      type='button'
      className='relative inline-flex h-5 w-9 items-center rounded-full'
      onClick={onToggle}
      aria-label={enabled ? 'disable-plan' : 'enable-plan'}
    >
      <span
        className={`h-5 w-9 rounded-full transition-colors ${trackClass}`}
      />
      <span
        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${knobClass}`}
      />
    </button>
  );
}

/**
 * 页面顶部操作区。
 * @param {object} props
 * @returns {JSX.Element}
 */
function PlanPageHeader({ t, onRefresh, onCreate }) {
  return (
    <div className='mb-8 flex flex-wrap items-end justify-between gap-4'>
      <div>
        <h1 className='font-headline text-3xl font-black tracking-tight text-[#05345c]'>
          {t('订阅套餐')}
        </h1>
        <p className='mt-1 text-sm text-[#3d618c]'>
          {t('管理订阅档位、价格和用户可见状态')}
        </p>
      </div>
      <div className='flex items-center gap-2'>
        <button
          type='button'
          className='rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50'
          onClick={onRefresh}
        >
          {t('刷新')}
        </button>
        <button
          type='button'
          className='rounded-lg bg-[#4a4bd7] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#3d3dcb]'
          onClick={onCreate}
        >
          {t('新建套餐')}
        </button>
      </div>
    </div>
  );
}

/**
 * 提示 Banner。
 * @param {object} props
 * @returns {JSX.Element}
 */
function InfoBanner({ t }) {
  return (
    <div className='mb-8 flex items-center gap-4 rounded-xl border border-[#91b4e4]/30 bg-[#e5eeff] p-4 shadow-sm'>
      <div className='rounded-lg bg-[#4a4bd7]/10 p-2 text-[#4a4bd7]'>i</div>
      <p className='text-sm font-medium text-[#3d618c]'>
        {t('Stripe/Creem 集成后可在套餐中配置对应的商品 ID。')}
      </p>
    </div>
  );
}

/**
 * 套餐单行。
 * @param {object} props
 * @returns {JSX.Element}
 */
function PlanRow({ record, t, onToggle, onEdit }) {
  const plan = record?.plan || {};
  const enabled = !!plan.enabled;
  const planTitle = plan.title || plan.name || t('未命名套餐');
  return (
    <tr className='transition-colors hover:bg-gray-50/80'>
      <td className='px-6 py-4 font-mono text-sm text-gray-400'>
        #{plan.id || '-'}
      </td>
      <td className='px-6 py-4'>
        <p className='text-sm font-bold text-gray-900'>{planTitle}</p>
        <p className='mt-0.5 text-xs text-gray-400'>{plan.subtitle || '-'}</p>
      </td>
      <td className='px-6 py-4 text-sm font-bold text-emerald-600'>
        {convertUSDToCurrency(Number(plan.price_amount || 0), 2)}
      </td>
      <td className='px-6 py-4 text-sm text-gray-600'>
        {formatQuotaLimit(plan)}
      </td>
      <td className='px-6 py-4 text-sm text-gray-500'>
        {formatDuration(plan)}
      </td>
      <td className='px-6 py-4'>
        <p className='line-clamp-2 text-xs leading-tight text-gray-500'>
          {buildFeatureSummary(plan)}
        </p>
      </td>
      <td className='px-6 py-4'>
        <StatusSwitch enabled={enabled} onToggle={onToggle} />
      </td>
      <td className='px-6 py-4 text-right'>
        <button
          type='button'
          className='text-xs font-bold text-[#4a4bd7] transition-colors hover:text-[#3d3dcb]'
          onClick={onEdit}
        >
          {t('编辑')}
        </button>
      </td>
    </tr>
  );
}

/**
 * 空表格提示行。
 * @param {object} props
 * @returns {JSX.Element}
 */
function EmptyRow({ loading, t }) {
  return (
    <tr>
      <td className='px-6 py-12 text-center text-sm text-gray-500' colSpan={8}>
        {loading ? t('加载中...') : t('暂无订阅套餐')}
      </td>
    </tr>
  );
}

/**
 * 分页区。
 * @param {object} props
 * @returns {JSX.Element}
 */
function PaginationBar({
  t,
  activePage,
  totalPages,
  pageSize,
  onPageSizeChange,
  onPrev,
  onNext,
}) {
  return (
    <div className='flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/30 px-6 py-4'>
      <div className='flex items-center gap-3 text-xs text-gray-500'>
        <span>
          {t('第 {{page}} / {{total}} 页', {
            page: activePage,
            total: totalPages,
          })}
        </span>
        <select
          className='rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600'
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {[10, 20, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>
      </div>
      <div className='flex gap-2'>
        <button
          type='button'
          className='rounded border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 disabled:cursor-not-allowed disabled:text-gray-400'
          disabled={activePage <= 1}
          onClick={onPrev}
        >
          {t('上一页')}
        </button>
        <button
          type='button'
          className='rounded border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 disabled:cursor-not-allowed disabled:text-gray-400'
          disabled={activePage >= totalPages}
          onClick={onNext}
        >
          {t('下一页')}
        </button>
      </div>
    </div>
  );
}

/**
 * 套餐表格区域。
 * @param {object} props
 * @returns {JSX.Element}
 */
function PlansTableSection({
  t,
  plans,
  planCount,
  loading,
  activePage,
  totalPages,
  pageSize,
  onPageSizeChange,
  onPrev,
  onNext,
  onToggle,
  onEdit,
}) {
  return (
    <div className='mb-12 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm'>
      <div className='flex items-center justify-between border-b border-gray-100 bg-gray-50/50 p-4'>
        <h3 className='text-sm font-bold text-gray-900'>{t('已定义套餐')}</h3>
        <span className='text-xs font-medium text-gray-500'>
          {t('共 {{count}} 个套餐', { count: planCount || 0 })}
        </span>
      </div>

      <div className='overflow-x-auto'>
        <table className='w-full border-collapse text-left'>
          <thead>
            <tr className='border-b border-gray-100 bg-gray-50/50'>
              <th className='px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500'>
                ID
              </th>
              <th className='px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500'>
                {t('套餐名称')}
              </th>
              <th className='px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500'>
                {t('价格')}
              </th>
              <th className='px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500'>
                {t('额度限制')}
              </th>
              <th className='px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500'>
                {t('有效期')}
              </th>
              <th className='px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500'>
                {t('特征')}
              </th>
              <th className='px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500'>
                {t('状态')}
              </th>
              <th className='px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500'>
                {t('操作')}
              </th>
            </tr>
          </thead>
          <tbody className='divide-y divide-gray-100'>
            {plans.map((record) => (
              <PlanRow
                key={record?.plan?.id || record?.plan?.title || 'plan-row'}
                record={record}
                t={t}
                onToggle={() => onToggle(record)}
                onEdit={() => onEdit(record)}
              />
            ))}
            {plans.length === 0 ? <EmptyRow loading={loading} t={t} /> : null}
          </tbody>
        </table>
      </div>

      <PaginationBar
        t={t}
        activePage={activePage}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageSizeChange={onPageSizeChange}
        onPrev={onPrev}
        onNext={onNext}
      />
    </div>
  );
}

/**
 * 活跃订阅提示区。
 * @param {object} props
 * @returns {JSX.Element}
 */
function ActiveSubscriptionsHint({ t }) {
  return (
    <>
      <div className='mb-3'>
        <h3 className='font-headline text-xl font-bold tracking-tight text-[#05345c]'>
          {t('活跃订阅概览')}
        </h3>
        <p className='text-sm text-[#3d618c]'>
          {t('当前版本保持 legacy 业务范围：套餐管理与用户侧订阅关系维护。')}
        </p>
      </div>
      <div className='overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm'>
        <div className='px-6 py-10 text-center text-sm text-gray-500'>
          {t('全局活跃订阅明细可在用户管理中查看（用户详情 -> 订阅记录）。')}
        </div>
      </div>
    </>
  );
}

export default function SubscriptionPage() {
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
    t,
  } = useSubscriptionsData();
  const [planDialogVisible, setPlanDialogVisible] = useState(false);
  const [editingPlanRecord, setEditingPlanRecord] = useState(null);

  const totalPages = useMemo(() => {
    const safeSize = Math.max(1, Number(pageSize || 10));
    return Math.max(1, Math.ceil(Number(planCount || 0) / safeSize));
  }, [pageSize, planCount]);

  const handlePlanToggle = (record) => {
    const enabled = !!record?.plan?.enabled;
    const title = enabled ? t('确认禁用') : t('确认启用');
    const content = enabled
      ? t('禁用后用户端不再展示，但历史订单不受影响。是否继续？')
      : t('启用后套餐将在用户端展示。是否继续？');
    Modal.confirm({
      title,
      content,
      centered: true,
      onOk: () => setPlanEnabled(record, !enabled),
    });
  };

  const handlePrevPage = () => {
    if (activePage > 1) {
      handlePageChange(activePage - 1);
    }
  };

  const handleNextPage = () => {
    if (activePage < totalPages) {
      handlePageChange(activePage + 1);
    }
  };

  const handleOpenCreate = () => {
    setEditingPlanRecord(null);
    setPlanDialogVisible(true);
  };

  const handleOpenEdit = (record) => {
    setEditingPlanRecord(record);
    setPlanDialogVisible(true);
  };

  const handleCloseDialog = () => {
    setPlanDialogVisible(false);
    setEditingPlanRecord(null);
  };

  return (
    <div className='w-full text-[#05345c]'>
      <SubscriptionPlanFormDialog
        visible={planDialogVisible}
        handleClose={handleCloseDialog}
        editingPlan={editingPlanRecord}
        refresh={refresh}
        t={t}
      />

      <div className='w-full min-w-0 px-6 py-8'>
        <PlanPageHeader t={t} onRefresh={refresh} onCreate={handleOpenCreate} />
        <InfoBanner t={t} />
        <PlansTableSection
          t={t}
          plans={plans}
          planCount={planCount}
          loading={loading}
          activePage={activePage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
          onPrev={handlePrevPage}
          onNext={handleNextPage}
          onToggle={handlePlanToggle}
          onEdit={handleOpenEdit}
        />
        <ActiveSubscriptionsHint t={t} />
      </div>
    </div>
  );
}
