import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTokensData } from '../../../hooks/tokens/useTokensData';
import { timestamp2string, renderQuota } from '../../../helpers';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../primitives/table';
import { Badge } from '../../primitives/badge';
import { Button } from '../../primitives/button';

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
  const data = useTokensData(() => {}, () => {});

  const totalPages = Math.max(
    1,
    Math.ceil(Number(data.tokenCount || 0) / Math.max(1, Number(data.pageSize || 1))),
  );

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h2 className='text-lg font-semibold'>{t('API Keys')}</h2>
        <Button
          variant='outline'
          size='sm'
          onClick={() => data.refresh()}
          loading={data.loading}
        >
          {t('刷新')}
        </Button>
      </div>

      <div className='rounded-xl border border-border bg-card/70'>
        <Table>
          <Thead>
            <Tr>
              <Th>{t('Key')}</Th>
              <Th>{t('Status')}</Th>
              <Th>{t('Model Restrictions')}</Th>
              <Th>{t('Usage')}</Th>
              <Th>{t('Limit')}</Th>
              <Th>{t('Created')}</Th>
              <Th>{t('Actions')}</Th>
            </Tr>
          </Thead>
          <Tbody>
            {(data.tokens || []).map((token) => (
              <Tr key={token.id}>
                <Td className='font-mono text-xs'>{`sk-${token.key || ''}`}</Td>
                <Td>{getStatusBadge(token.status, t)}</Td>
                <Td className='text-xs'>{getModelRestrictions(token, t)}</Td>
                <Td className='text-xs'>{getUsageText(token, t)}</Td>
                <Td className='text-xs'>{getLimitText(token, t)}</Td>
                <Td className='text-xs'>
                  {token.created_time ? timestamp2string(token.created_time) : '-'}
                </Td>
                <Td>
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => data.copyTokenKey(token)}
                    >
                      {t('复制')}
                    </Button>
                    {token.status === 1 ? (
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => data.manageToken(token.id, 'disable', token)}
                      >
                        {t('禁用')}
                      </Button>
                    ) : (
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => data.manageToken(token.id, 'enable', token)}
                      >
                        {t('启用')}
                      </Button>
                    )}
                    <Button
                      size='sm'
                      variant='destructive'
                      onClick={() => data.manageToken(token.id, 'delete', token)}
                    >
                      {t('删除')}
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
            {!data.loading && (data.tokens || []).length === 0 && (
              <Tr>
                <Td colSpan={7} className='py-8 text-center text-muted-foreground'>
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
  );
}
