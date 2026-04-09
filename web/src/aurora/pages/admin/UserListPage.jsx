import React, { useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { useUsersData } from '../../../hooks/users/useUsersData';
import { cn } from '../../lib/cn';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../primitives/card';
import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';
import { Badge } from '../../primitives/badge';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../primitives/table';
import { QuotaProgressBar } from './components';

const roleMeta = {
  1: { text: '普通用户', variant: 'secondary' },
  10: { text: '管理员', variant: 'default' },
  100: { text: '超级管理员', variant: 'destructive' },
};

const getRoleBadge = (role) => roleMeta[role] || { text: '未知身份', variant: 'outline' };

export default function UserListPage() {
  const usersData = useUsersData();
  const [keyword, setKeyword] = useState('');

  const {
    users,
    loading,
    searching,
    activePage,
    pageSize,
    userCount,
    handlePageChange,
    handlePageSizeChange,
    manageUser,
    setShowAddUser,
    refresh,
    t,
  } = usersData;

  const filteredRows = useMemo(() => {
    if (!keyword.trim()) {
      return users || [];
    }
    const lower = keyword.toLowerCase();
    return (users || []).filter((item) => {
      const username = String(item.username || '').toLowerCase();
      const group = String(item.group || '').toLowerCase();
      const email = String(item.email || '').toLowerCase();
      return username.includes(lower) || group.includes(lower) || email.includes(lower);
    });
  }, [users, keyword]);

  const totalPages = Math.max(1, Math.ceil((userCount || 0) / Math.max(1, pageSize || 10)));

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader className='pb-4'>
          <CardTitle className='text-base'>{t('用户管理')}</CardTitle>
          <CardDescription>{t('展示角色、配额进度与账号状态')}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
            <div className='max-w-sm w-full'>
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={t('按用户名 / 邮箱 / 分组筛选当前页')}
                icon={<Search className='h-4 w-4' />}
              />
            </div>
            <div className='flex items-center gap-2'>
              <Button variant='outline' size='sm' onClick={() => refresh()}>
                {t('刷新')}
              </Button>
              <Button size='sm' onClick={() => setShowAddUser(true)}>
                <UserPlus className='mr-1 h-3.5 w-3.5' />
                {t('新增用户')}
              </Button>
            </div>
          </div>

          <div className='rounded-lg border border-border'>
            <Table>
              <Thead>
                <Tr>
                  <Th>{t('用户')}</Th>
                  <Th>{t('角色')}</Th>
                  <Th>{t('分组')}</Th>
                  <Th>{t('Quota')}</Th>
                  <Th>{t('状态')}</Th>
                  <Th className='text-right'>{t('操作')}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredRows.map((user) => {
                  const isDeleted = user.DeletedAt !== null;
                  const disabled = user.status !== 1;
                  const role = getRoleBadge(user.role);
                  return (
                    <Tr key={user.id} className={cn((isDeleted || disabled) && 'bg-muted/40')}>
                      <Td>
                        <div className='font-medium'>{user.username}</div>
                        <div className='text-xs text-muted-foreground mt-0.5'>{t('ID:')} {user.id}</div>
                      </Td>
                      <Td>
                        <Badge variant={role.variant}>{t(role.text)}</Badge>
                      </Td>
                      <Td className='text-sm text-muted-foreground'>{user.group || '-'}</Td>
                      <Td className='min-w-[260px]'>
                        <QuotaProgressBar
                          used={Number(user.used_quota || 0)}
                          total={Number(user.used_quota || 0) + Number(user.quota || 0)}
                          unit={t('quota')}
                          title=''
                          className='p-2'
                        />
                      </Td>
                      <Td>
                        <Badge variant={disabled ? 'destructive' : 'secondary'}>
                          {isDeleted ? t('已注销') : disabled ? t('已禁用') : t('已启用')}
                        </Badge>
                      </Td>
                      <Td>
                        <div className='flex justify-end gap-2'>
                          {user.status === 1 ? (
                            <Button
                              size='sm'
                              variant='destructive'
                              onClick={() => manageUser(user.id, 'disable', user)}
                              disabled={isDeleted}
                            >
                              {t('禁用')}
                            </Button>
                          ) : (
                            <Button
                              size='sm'
                              onClick={() => manageUser(user.id, 'enable', user)}
                              disabled={isDeleted}
                            >
                              {t('启用')}
                            </Button>
                          )}
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => manageUser(user.id, user.role >= 10 ? 'demote' : 'promote', user)}
                            disabled={isDeleted}
                          >
                            {user.role >= 10 ? t('降权') : t('提权')}
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
                {filteredRows.length === 0 ? (
                  <Tr>
                    <Td colSpan={6} className='py-8 text-center text-sm text-muted-foreground'>
                      {t('暂无用户数据')}
                    </Td>
                  </Tr>
                ) : null}
              </Tbody>
            </Table>
          </div>

          <div className='flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
            <div className='text-xs text-muted-foreground'>
              {t('共 {{count}} 条', { count: userCount || 0 })}
              {(loading || searching) ? ` · ${t('加载中...')}` : ''}
            </div>
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
