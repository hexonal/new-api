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
import { CircleCheck, Infinity, KeyRound, Layers3, Search } from 'lucide-react';
import { useTokensData } from '../../../hooks/tokens/useTokensData';
import { timestamp2string, renderQuota } from '../../../helpers';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../primitives/table';
import { Badge } from '../../primitives/badge';
import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';
import EditTokenModal from '../../modals/EditTokenModal';
import { filterExistingTokenIds } from './token-list-utils';
import {
  getTokenListTitle,
  getTokenTableHeaderLabels,
} from './token-list-copy';

const getStatusBadge = (status, t) => {
  if (status === 1) {
    return <Badge variant='secondary'>{t('已启用')}</Badge>;
  }
  if (status === 2) {
    return <Badge variant='destructive'>{t('已禁用')}</Badge>;
  }
  if (status === 3) {
    return <Badge variant='outline'>{t('已过期')}</Badge>;
  }
  if (status === 4) {
    return <Badge variant='outline'>{t('已耗尽')}</Badge>;
  }
  return <Badge variant='outline'>{t('未知')}</Badge>;
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
        label: t('API 密钥'),
        value: data.tokenCount || 0,
        icon: <KeyRound className='h-4 w-4' />,
      },
      {
        key: 'enabled',
        label: t('已启用'),
        value: enabledCount,
        icon: <CircleCheck className='h-4 w-4' />,
      },
      {
        key: 'unlimited',
        label: t('无限额度'),
        value: unlimitedCount,
        icon: <Infinity className='h-4 w-4' />,
      },
      {
        key: 'page',
        label: t('当前页'),
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
    <div className='mx-auto w-full max-w-[1680px] space-y-6 pb-6'>
      <EditTokenModal
        refresh={data.refresh}
        editingToken={data.editingToken}
        visiable={data.showEdit}
        handleClose={data.closeEdit}
      />

      <section className='rounded-[28px] border border-[#e7ebf3] bg-white px-6 py-5 shadow-[0_22px_50px_rgba(15,23,42,0.06)]'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
          <div className='space-y-2'>
            <div className='text-xs font-medium uppercase tracking-[0.24em] text-slate-400'>
              {t('令牌工作区')}
            </div>
            <div className='text-2xl font-semibold text-slate-950'>
              {getTokenListTitle(t)}
            </div>
            <p className='max-w-2xl text-sm leading-6 text-slate-500'>
              {t(
                '为常用操作预留更清晰的工作区，便于筛选、复制、禁用和批量管理令牌。',
              )}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => data.refresh()}
              loading={data.loading}
            >
              {t('刷新')}
            </Button>
            <Button
              size='sm'
              onClick={() => {
                data.setEditingToken({ id: undefined });
                data.setShowEdit(true);
              }}
            >
              {t('添加令牌')}
            </Button>
          </div>
        </div>
      </section>

      <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        {summaryCards.map((item) => (
          <div
            key={item.key}
            className='rounded-[24px] border border-[#e7ebf3] bg-white px-5 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]'
          >
            <div className='flex items-start justify-between gap-4'>
              <div className='space-y-2'>
                <div className='text-xs uppercase tracking-[0.18em] text-slate-400'>
                  {item.label}
                </div>
                <div className='text-2xl font-semibold text-slate-950'>
                  {item.value}
                </div>
              </div>
              <div className='rounded-2xl border border-[#e7ebf3] bg-[#f7f9fc] p-2 text-[#3652f5]'>
                {item.icon}
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className='rounded-[28px] border border-[#e7ebf3] bg-white p-5 shadow-[0_22px_50px_rgba(15,23,42,0.06)]'>
        <div className='flex flex-col gap-5'>
          <div className='flex items-center justify-between'>
            <h2 className='text-lg font-semibold text-slate-950'>
              {getTokenListTitle(t)}
            </h2>
          </div>

          <div className='flex flex-col gap-3 rounded-[24px] border border-[#e7ebf3] bg-[#fbfcff] p-4'>
            <div className='grid grid-cols-1 gap-3 xl:grid-cols-2'>
              <Input
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                placeholder={t('搜索关键字')}
                icon={<Search className='h-4 w-4' />}
                className='bg-white'
              />
              <Input
                value={searchToken}
                onChange={(event) => setSearchToken(event.target.value)}
                placeholder={t('密钥')}
                icon={<Search className='h-4 w-4' />}
                className='bg-white'
              />
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              <Button
                size='sm'
                variant='outline'
                onClick={handleSearch}
                loading={data.searching}
              >
                {t('查询')}
              </Button>
              <Button size='sm' variant='outline' onClick={handleReset}>
                {t('重置')}
              </Button>
              <div className='mx-1 h-5 w-px bg-border' />
              <Button size='sm' variant='outline' onClick={handleBatchCopy}>
                {t('复制所选令牌')}
              </Button>
              <Button
                size='sm'
                variant='destructive'
                onClick={handleBatchDelete}
              >
                {t('删除所选令牌')}
              </Button>
            </div>
          </div>

          <div className='overflow-hidden rounded-[24px] border border-[#e7ebf3] bg-white'>
            <Table className='min-w-[1040px]'>
              <Thead>
                <Tr>
                  <Th className='w-10'>
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
                  </Th>
                  {tableHeaderLabels.map((label) => (
                    <Th key={label}>{label}</Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {(data.tokens || []).map((token) => (
                  <Tr
                    key={token.id}
                    className={token.status === 1 ? '' : 'bg-muted/40'}
                  >
                    <Td>
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
                    </Td>
                    <Td>
                      <div className='min-w-[220px]'>
                        <div className='text-sm font-medium'>
                          {token.name || t('未命名令牌')}
                        </div>
                        <div className='font-mono text-xs text-muted-foreground'>{`sk-${token.key || ''}`}</div>
                      </div>
                    </Td>
                    <Td className='whitespace-nowrap'>
                      {getStatusBadge(token.status, t)}
                    </Td>
                    <Td className='whitespace-nowrap text-xs'>
                      {getModelRestrictions(token, t)}
                    </Td>
                    <Td className='whitespace-nowrap text-xs'>
                      {getUsageText(token, t)}
                    </Td>
                    <Td className='whitespace-nowrap text-xs'>
                      {getLimitText(token, t)}
                    </Td>
                    <Td className='whitespace-nowrap text-xs'>
                      {token.created_time
                        ? timestamp2string(token.created_time)
                        : '-'}
                    </Td>
                    <Td className='min-w-[252px]'>
                      <div className='flex flex-nowrap gap-2'>
                        <Button
                          size='sm'
                          variant='outline'
                          className='whitespace-nowrap'
                          onClick={() => openChat(token)}
                          disabled={chatLinks.length === 0}
                        >
                          {t('聊天')}
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          className='whitespace-nowrap'
                          onClick={() => data.copyTokenKey(token)}
                        >
                          {t('复制')}
                        </Button>
                        {token.status === 1 ? (
                          <Button
                            size='sm'
                            variant='outline'
                            className='whitespace-nowrap'
                            onClick={() =>
                              data.manageToken(token.id, 'disable', token)
                            }
                          >
                            {t('禁用')}
                          </Button>
                        ) : (
                          <Button
                            size='sm'
                            variant='outline'
                            className='whitespace-nowrap'
                            onClick={() =>
                              data.manageToken(token.id, 'enable', token)
                            }
                          >
                            {t('启用')}
                          </Button>
                        )}
                        <Button
                          size='sm'
                          variant='outline'
                          className='whitespace-nowrap'
                          onClick={() => {
                            data.setEditingToken(token);
                            data.setShowEdit(true);
                          }}
                        >
                          {t('编辑')}
                        </Button>
                        <Button
                          size='sm'
                          variant='destructive'
                          className='whitespace-nowrap'
                          onClick={() =>
                            data.manageToken(token.id, 'delete', token)
                          }
                        >
                          {t('删除')}
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
                {!data.loading && (data.tokens || []).length === 0 && (
                  <Tr>
                    <Td
                      colSpan={8}
                      className='py-8 text-center text-muted-foreground'
                    >
                      {t('暂无数据')}
                    </Td>
                  </Tr>
                )}
              </Tbody>
            </Table>
          </div>

          <div className='flex items-center justify-between text-sm text-muted-foreground'>
            <span>
              {t('共')} {data.tokenCount || 0} {t('条')}
            </span>
            <div className='flex items-center gap-2'>
              <Button
                size='sm'
                variant='outline'
                disabled={data.activePage <= 1 || data.loading}
                onClick={() => data.handlePageChange(data.activePage - 1)}
              >
                {t('上一页')}
              </Button>
              <span>
                {data.activePage} / {totalPages}
              </span>
              <Button
                size='sm'
                variant='outline'
                disabled={data.activePage >= totalPages || data.loading}
                onClick={() => data.handlePageChange(data.activePage + 1)}
              >
                {t('下一页')}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
