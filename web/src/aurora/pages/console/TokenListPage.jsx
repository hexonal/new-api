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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown } from '@douyinfe/semi-ui';
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Infinity,
  KeyRound,
  Layers3,
  MoreVertical,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useTokensData } from '../../../hooks/tokens/useTokensData';
import { timestamp2string, renderQuota } from '../../../helpers';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../primitives/table';
import EditTokenModal from '../../modals/EditTokenModal';
import { filterExistingTokenIds } from './token-list-utils';
import {
  getTokenListTitle,
  getTokenTableHeaderLabels,
} from './token-list-copy';

const getStatusBadge = (status, t) => {
  if (status === 1) {
    return (
      <span className='inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700'>
        {t('已启用')}
      </span>
    );
  }
  if (status === 2) {
    return (
      <span className='inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700'>
        {t('已禁用')}
      </span>
    );
  }
  if (status === 3) {
    return (
      <span className='inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600'>
        {t('已过期')}
      </span>
    );
  }
  if (status === 4) {
    return (
      <span className='inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700'>
        {t('已耗尽')}
      </span>
    );
  }
  return (
    <span className='inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600'>
      {t('未知')}
    </span>
  );
};

const getLimitText = (token, t) => {
  if (token?.unlimited_quota) {
    return t('无限制');
  }
  const used = Number(token?.used_quota || 0);
  const remain = Number(token?.remain_quota || 0);
  return renderQuota(used + remain);
};

const getUsageText = (token, t) => {
  const used = Number(token?.used_quota || 0);
  if (token?.unlimited_quota) {
    return `${renderQuota(used)} / ${t('无限制')}`;
  }
  const remain = Number(token?.remain_quota || 0);
  return `${renderQuota(used)} / ${renderQuota(used + remain)}`;
};

const getModelRestrictions = (token, t) => {
  const raw = String(token?.model_limits || '').trim();
  if (!token?.model_limits_enabled || !raw) {
    return t('无限制');
  }
  const models = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (models.length <= 2) {
    return models.join(', ');
  }
  return `${models.slice(0, 2).join(', ')} +${models.length - 2}`;
};

const maskTokenKey = (value) => {
  const text = String(value || '').trim();
  if (!text) {
    return 'sk-...';
  }
  if (text.length <= 10) {
    return `sk-${text}`;
  }
  return `sk-${text.slice(0, 6)}...${text.slice(-4)}`;
};

const formatTokenCreatedAt = (createdAt) => {
  const seconds = Number(createdAt);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '-';
  }

  const createdDate = new Date(seconds * 1000);
  const deltaSeconds = Math.max(
    0,
    Math.floor((Date.now() - createdDate.getTime()) / 1000),
  );

  if (deltaSeconds < 86400) {
    const hours = Math.max(1, Math.floor(deltaSeconds / 3600));
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (deltaSeconds < 86400 * 30) {
    const days = Math.max(1, Math.floor(deltaSeconds / 86400));
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  return timestamp2string(seconds);
};

export default function TokenListPage() {
  const { t } = useTranslation();
  const data = useTokensData(
    () => {},
    () => {},
  );
  const tableHeaderLabels = useMemo(() => getTokenTableHeaderLabels(t), [t]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchToken, setSearchToken] = useState('');
  const [selectedTokenIds, setSelectedTokenIds] = useState([]);
  const formValuesRef = useRef({
    searchKeyword: '',
    searchToken: '',
  });

  useEffect(() => {
    formValuesRef.current = {
      searchKeyword,
      searchToken,
    };
  }, [searchKeyword, searchToken]);

  useEffect(() => {
    data.setFormApi({
      getValues: () => formValuesRef.current,
      reset: () => {
        setSearchKeyword('');
        setSearchToken('');
      },
    });
  }, [data.setFormApi]);

  useEffect(() => {
    const selectedRows = (data.tokens || []).filter((token) =>
      selectedTokenIds.includes(token.id),
    );
    data.setSelectedKeys(selectedRows);
  }, [data.setSelectedKeys, data.tokens, selectedTokenIds]);

  useEffect(() => {
    setSelectedTokenIds((prev) => filterExistingTokenIds(prev, data.tokens));
  }, [data.tokens]);

  const chatLinks = useMemo(() => {
    try {
      const raw = localStorage.getItem('chats');
      const parsed = JSON.parse(raw || '[]');
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .map((item) => {
          const name = item ? Object.keys(item)[0] : '';
          if (!name) {
            return null;
          }
          return {
            name,
            url: item[name],
          };
        })
        .filter(Boolean);
    } catch (_) {
      return [];
    }
  }, []);

  const totalPages = Math.max(
    1,
    Math.ceil(
      Number(data.tokenCount || 0) / Math.max(1, Number(data.pageSize || 1)),
    ),
  );
  const currentTokenCount = (data.tokens || []).length;
  const pageStart =
    currentTokenCount === 0
      ? 0
      : (Number(data.activePage || 1) - 1) * Number(data.pageSize || 1) + 1;
  const pageEnd =
    currentTokenCount === 0 ? 0 : pageStart + currentTokenCount - 1;

  const summaryCards = useMemo(() => {
    const currentTokens = data.tokens || [];
    const enabledCount = currentTokens.filter(
      (token) => token.status === 1,
    ).length;
    const unlimitedCount = currentTokens.filter(
      (token) => token.unlimited_quota,
    ).length;

    return [
      {
        key: 'total',
        label: 'Total Keys',
        value: data.tokenCount || 0,
        icon: <KeyRound className='h-4 w-4' />,
      },
      {
        key: 'enabled',
        label: 'Active Keys',
        value: enabledCount,
        icon: <CircleCheck className='h-4 w-4' />,
      },
      {
        key: 'unlimited',
        label: 'Unlimited',
        value: unlimitedCount,
        icon: <Infinity className='h-4 w-4' />,
      },
      {
        key: 'page',
        label: 'Page',
        value: `${data.activePage || 1}/${totalPages}`,
        icon: <Layers3 className='h-4 w-4' />,
      },
    ];
  }, [data.activePage, data.tokenCount, data.tokens, t, totalPages]);

  const allChecked =
    (data.tokens || []).length > 0 &&
    selectedTokenIds.length === (data.tokens || []).length;
  const indeterminate =
    selectedTokenIds.length > 0 &&
    selectedTokenIds.length < (data.tokens || []).length;

  const handleSelectAll = (event) => {
    const checked = !!event.target.checked;
    if (!checked) {
      setSelectedTokenIds([]);
      return;
    }
    setSelectedTokenIds((data.tokens || []).map((token) => token.id));
  };

  const handleSearch = () => {
    data.searchTokens(1);
    setSelectedTokenIds([]);
  };

  const handleReset = () => {
    setSearchKeyword('');
    setSearchToken('');
    formValuesRef.current = {
      searchKeyword: '',
      searchToken: '',
    };
    data.searchTokens(1);
    setSelectedTokenIds([]);
  };

  const handleBatchCopy = () => {
    data.batchCopyTokens('name+key');
  };

  const handleBatchDelete = () => {
    if (selectedTokenIds.length === 0) {
      return;
    }
    const confirmed = window.confirm(
      t('确认删除已选中的 {{count}} 个令牌吗？', {
        count: selectedTokenIds.length,
      }),
    );
    if (!confirmed) {
      return;
    }
    data.batchDeleteTokens();
    setSelectedTokenIds([]);
  };

  const openChat = (token) => {
    if (chatLinks.length === 0) {
      return;
    }
    const target = chatLinks[0];
    if (!target?.url) {
      return;
    }
    data.onOpenLink(target.name, target.url, token);
  };

  return (
    <div className='mt-4 mx-auto w-full max-w-[1200px] pb-8'>
      <EditTokenModal
        refresh={data.refresh}
        editingToken={data.editingToken}
        visiable={data.showEdit}
        handleClose={data.closeEdit}
      />

      <section className='mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='text-3xl font-black tracking-[-0.75px] text-slate-950'>
            {getTokenListTitle(t)}
          </h1>
          <p className='mt-1 text-sm text-slate-500'>
            Create and manage your API keys for programmatic access to the
            gateway.
          </p>
        </div>
        <button
          type='button'
          className='inline-flex items-center justify-center gap-2 rounded-sm bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.99]'
          onClick={() => {
            data.setEditingToken({ id: undefined });
            data.setShowEdit(true);
          }}
        >
          <Plus className='h-4 w-4' />
          Create Key
        </button>
      </section>

      <section className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex min-w-0 flex-1 flex-col gap-3 sm:flex-row'>
          <label className='relative min-w-0 flex-1'>
            <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
            <input
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder='Search by name...'
              className='w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
            />
          </label>
          {/* <label className='relative min-w-0 sm:w-[280px]'>
            <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
            <input
              value={searchToken}
              onChange={(event) => setSearchToken(event.target.value)}
              placeholder={t('密钥')}
              className='w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
            />
          </label> */}
        </div>

        <div className='flex flex-wrap items-center justify-end gap-2'>
          <button
            type='button'
            className='inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50'
            onClick={handleSearch}
            disabled={data.searching}
          >
            <SlidersHorizontal className='h-4 w-4' />
            {t('查询')}
          </button>
          {/* <button
            type='button'
            className='rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50'
            onClick={handleReset}
          >
            {t('重置')}
          </button>
          <button
            type='button'
            className='rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50'
            onClick={handleBatchCopy}
          >
            {t('复制所选令牌')}
          </button>
          <button
            type='button'
            className='rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50'
            onClick={handleBatchDelete}
          >
            {t('删除所选令牌')}
          </button> */}
        </div>
      </section>

      {/* <section className='mb-8 grid gap-6 md:grid-cols-3 xl:grid-cols-4'>
        {summaryCards.map((item) => (
          <div
            key={item.key}
            className='rounded-xl border border-slate-200 bg-white p-5'
          >
            <div className='flex items-start justify-between gap-3'>
              <div>
                <div className='mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400'>
                  {item.label}
                </div>
                <div className='text-2xl font-black text-slate-950'>
                  {item.value}
                </div>
              </div>
              <div className='rounded-xl border border-slate-200 bg-slate-50 p-2 text-indigo-600'>
                {item.icon}
              </div>
            </div>
          </div>
        ))}
      </section> */}

      <section className='overflow-hidden rounded-xl border border-slate-200 bg-white'>
        <div className='overflow-x-auto'>
          <Table className='min-w-[1120px]'>
            <Thead>
              <Tr>
                {/* <Th className='w-10 px-4 py-4'>
                  <input
                    type='checkbox'
                    checked={allChecked}
                    ref={(node) => {
                      if (node) {
                        node.indeterminate = indeterminate;
                      }
                    }}
                    onChange={handleSelectAll}
                  />
                </Th> */}
                {tableHeaderLabels.map((label) => (
                  <Th
                    key={label}
                    className='px-6 py-4 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400'
                  >
                    {label}
                  </Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {(data.tokens || []).map((token) => (
                <Tr
                  key={token.id}
                  className='group border-b border-slate-100 transition-colors hover:bg-indigo-50/30'
                >
                  {/* <Td className='px-4 py-5'>
                    <input
                      type='checkbox'
                      checked={selectedTokenIds.includes(token.id)}
                      onChange={(event) => {
                        const checked = !!event.target.checked;
                        setSelectedTokenIds((prev) => {
                          if (checked) {
                            return Array.from(new Set([...prev, token.id]));
                          }
                          return prev.filter((item) => item !== token.id);
                        });
                      }}
                    />
                  </Td> */}
                  <Td className='px-6 py-5'>
                    <div className='min-w-[220px]'>
                      <div className='mb-0.5 text-sm font-bold text-slate-950'>
                        {token.name || t('未命名令牌')}
                      </div>
                      <div className='font-mono text-xs text-slate-400'>
                        {maskTokenKey(token.key)}
                      </div>
                    </div>
                  </Td>
                  <Td className='px-6 py-5 whitespace-nowrap'>
                    {getStatusBadge(token.status, t)}
                  </Td>
                  <Td className='min-w-[220px] px-6 py-5 whitespace-nowrap text-xs text-slate-500'>
                    {getModelRestrictions(token, t)}
                  </Td>
                  <Td className='px-6 py-5 whitespace-nowrap text-sm font-medium text-slate-900'>
                    {getUsageText(token, t)}
                  </Td>
                  <Td className='px-6 py-5 whitespace-nowrap text-xs text-slate-500'>
                    {getLimitText(token, t)}
                  </Td>
                  <Td className='px-6 py-5 whitespace-nowrap text-xs text-slate-400'>
                    {formatTokenCreatedAt(token.created_time)}
                  </Td>
                  <Td className='min-w-[80px] px-6 py-5'>
                    <div className='flex justify-center'>
                      <Dropdown
                        position='bottomRight'
                        render={
                          <Dropdown.Menu>
                            <Dropdown.Item
                              disabled={chatLinks.length === 0}
                              onClick={() => openChat(token)}
                            >
                              {t('聊天')}
                            </Dropdown.Item>
                            <Dropdown.Item
                              onClick={() => data.copyTokenKey(token)}
                            >
                              {t('复制')}
                            </Dropdown.Item>
                            <Dropdown.Item
                              onClick={() =>
                                data.manageToken(
                                  token.id,
                                  token.status === 1 ? 'disable' : 'enable',
                                  token,
                                )
                              }
                            >
                              {token.status === 1 ? t('禁用') : t('启用')}
                            </Dropdown.Item>
                            <Dropdown.Item
                              onClick={() => {
                                data.setEditingToken(token);
                                data.setShowEdit(true);
                              }}
                            >
                              {t('编辑')}
                            </Dropdown.Item>
                            <Dropdown.Item
                              style={{ color: '#e11d48' }}
                              onClick={() =>
                                data.manageToken(token.id, 'delete', token)
                              }
                            >
                              {t('删除')}
                            </Dropdown.Item>
                          </Dropdown.Menu>
                        }
                      >
                        <button
                          type='button'
                          className='h-[34px] w-4'
                        >
                          <MoreVertical className='h-4 w-4 text-[rgba(156,163,175,1)]' />
                        </button>
                      </Dropdown>
                    </div>
                  </Td>
                </Tr>
              ))}
              {!data.loading && (data.tokens || []).length === 0 && (
                <Tr>
                  <Td
                    colSpan={8}
                    className='px-6 py-10 text-center text-sm text-slate-500'
                  >
                    {t('暂无数据')}
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </div>

        <div className='flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between'>
          <span className='text-xs font-medium text-slate-500'>
            {`Showing ${pageStart}-${pageEnd} of ${data.tokenCount || 0} keys`}
          </span>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              className='inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition-colors hover:text-slate-600 disabled:opacity-50'
              disabled={data.activePage <= 1 || data.loading}
              onClick={() => data.handlePageChange(data.activePage - 1)}
            >
              <ChevronLeft className='h-4 w-4' />
            </button>
            <span className='inline-flex h-7 min-w-7 items-center justify-center rounded bg-indigo-600 px-2 text-xs font-bold text-white shadow-sm'>
              {data.activePage}
            </span>
            {/* <span className='text-xs font-medium text-slate-500'>
              / {totalPages}
            </span> */}
            <button
              type='button'
              className='inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition-colors hover:text-slate-600 disabled:opacity-50'
              disabled={data.activePage >= totalPages || data.loading}
              onClick={() => data.handlePageChange(data.activePage + 1)}
            >
              <ChevronRight className='h-4 w-4' />
            </button>
          </div>
        </div>
      </section>

      <section className='my-8 grid gap-6 md:grid-cols-3 xl:grid-cols-4'>
        {summaryCards.map((item) => (
          <div
            key={item.key}
            className='rounded-xl border border-slate-200 bg-white p-5'
          >
            <div className='flex items-start justify-between gap-3'>
              <div>
                <div className='mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400'>
                  {item.label}
                </div>
                <div className='text-2xl font-black text-slate-950'>
                  {item.value}
                </div>
              </div>
              <div className='rounded-xl border border-slate-200 bg-slate-50 p-2 text-indigo-600'>
                {item.icon}
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
