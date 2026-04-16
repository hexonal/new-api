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
import {
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Shield,
  UserPlus,
  Users,
} from 'lucide-react';
import { useUsersData } from '../../../hooks/users/useUsersData';
import { cn } from '../../lib/cn';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../../primitives/card';
import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';
import { Badge } from '../../primitives/badge';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../primitives/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../primitives/dropdown-menu';
import { QuotaProgressBar } from './components';
import { getQuotaPerUnit } from '../../../helpers/quota';
import AddUserModal from '../../components/modals/AddUserModal';
import EditUserModal from '../../components/modals/EditUserModal';
import PromoteUserModal from '../../../components/table/users/modals/PromoteUserModal';
import DemoteUserModal from '../../../components/table/users/modals/DemoteUserModal';
import EnableDisableUserModal from '../../../components/table/users/modals/EnableDisableUserModal';
import DeleteUserModal from '../../../components/table/users/modals/DeleteUserModal';
import ResetPasskeyModal from '../../../components/table/users/modals/ResetPasskeyModal';
import ResetTwoFAModal from '../../../components/table/users/modals/ResetTwoFAModal';
import UserSubscriptionsModal from '../../../components/table/users/modals/UserSubscriptionsModal';

const roleMeta = {
  1: { text: '普通用户', variant: 'secondary' },
  10: { text: '管理员', variant: 'default' },
  100: { text: '超级管理员', variant: 'destructive' },
};

const getRoleBadge = (role) =>
  roleMeta[role] || { text: '未知身份', variant: 'outline' };

const formatCount = (value) => Number(value || 0).toLocaleString();

export default function UserListPage() {
  const usersData = useUsersData();
  const [keyword, setKeyword] = useState('');
  const [group, setGroup] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [confirmAction, setConfirmAction] = useState('');
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showDemoteModal, setShowDemoteModal] = useState(false);
  const [showEnableDisableModal, setShowEnableDisableModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetPasskeyModal, setShowResetPasskeyModal] = useState(false);
  const [showResetTwoFAModal, setShowResetTwoFAModal] = useState(false);
  const [showUserSubscriptionsModal, setShowUserSubscriptionsModal] =
    useState(false);

  const {
    users,
    loading,
    searching,
    activePage,
    pageSize,
    userCount,
    groupOptions,
    loadUsers,
    searchUsers,
    handlePageChange,
    handlePageSizeChange,
    manageUser,
    refresh,
    resetUserPasskey,
    resetUserTwoFA,
    setShowAddUser,
    showAddUser,
    showEditUser,
    editingUser,
    setEditingUser,
    setShowEditUser,
    closeAddUser,
    closeEditUser,
    t,
  } = usersData;

  const totalPages = Math.max(
    1,
    Math.ceil((userCount || 0) / Math.max(1, pageSize || 10)),
  );
  const usdFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  );

  const stats = useMemo(() => {
    const items = users || [];
    return {
      enabled: items.filter(
        (item) => item.status === 1 && item.DeletedAt === null,
      ).length,
      admins: items.filter((item) => Number(item.role || 0) >= 10).length,
      disabled: items.filter(
        (item) => item.status !== 1 || item.DeletedAt !== null,
      ).length,
    };
  }, [users]);
  const formatQuotaToUSD = (quotaValue) => {
    const numericQuota = Number(quotaValue || 0);
    const safeQuota = Number.isFinite(numericQuota) ? numericQuota : 0;
    const quotaPerUnit = getQuotaPerUnit();
    const usdValue = safeQuota / quotaPerUnit;
    const safeUsdValue = Number.isFinite(usdValue) ? usdValue : 0;
    return usdFormatter.format(safeUsdValue);
  };

  const openActionModal = (user, action) => {
    setSelectedUser(user);
    setConfirmAction(action);

    if (action === 'promote') {
      setShowPromoteModal(true);
      return;
    }
    if (action === 'demote') {
      setShowDemoteModal(true);
      return;
    }
    if (action === 'delete') {
      setShowDeleteModal(true);
      return;
    }
    if (action === 'reset-passkey') {
      setShowResetPasskeyModal(true);
      return;
    }
    if (action === 'reset-2fa') {
      setShowResetTwoFAModal(true);
      return;
    }
    if (action === 'subscriptions') {
      setShowUserSubscriptionsModal(true);
      return;
    }
    setShowEnableDisableModal(true);
  };

  const handleSearch = async () => {
    await searchUsers(1, pageSize, keyword, group);
  };

  const handleReset = async () => {
    setKeyword('');
    setGroup('');
    await loadUsers(1, pageSize);
  };

  const handleEnableDisableConfirm = async () => {
    if (!selectedUser) return;
    await manageUser(selectedUser.id, confirmAction, selectedUser);
    setShowEnableDisableModal(false);
  };

  const handlePromoteConfirm = async () => {
    if (!selectedUser) return;
    await manageUser(selectedUser.id, 'promote', selectedUser);
    setShowPromoteModal(false);
  };

  const handleDemoteConfirm = async () => {
    if (!selectedUser) return;
    await manageUser(selectedUser.id, 'demote', selectedUser);
    setShowDemoteModal(false);
  };

  const handleResetPasskeyConfirm = async () => {
    if (!selectedUser) return;
    await resetUserPasskey(selectedUser);
    setShowResetPasskeyModal(false);
  };

  const handleResetTwoFAConfirm = async () => {
    if (!selectedUser) return;
    await resetUserTwoFA(selectedUser);
    setShowResetTwoFAModal(false);
  };

  return (
    <>
      {showAddUser ? (
        <AddUserModal
          open={showAddUser}
          onClose={closeAddUser}
          onSuccess={() => refresh?.()}
        />
      ) : null}

      {showEditUser ? (
        <EditUserModal
          open={showEditUser}
          onClose={closeEditUser}
          user={editingUser}
          onSuccess={() => refresh?.()}
        />
      ) : null}

      <PromoteUserModal
        visible={showPromoteModal}
        onCancel={() => setShowPromoteModal(false)}
        onConfirm={handlePromoteConfirm}
        user={selectedUser}
        t={t}
      />

      <DemoteUserModal
        visible={showDemoteModal}
        onCancel={() => setShowDemoteModal(false)}
        onConfirm={handleDemoteConfirm}
        user={selectedUser}
        t={t}
      />

      <EnableDisableUserModal
        visible={showEnableDisableModal}
        onCancel={() => setShowEnableDisableModal(false)}
        onConfirm={handleEnableDisableConfirm}
        user={selectedUser}
        action={confirmAction}
        t={t}
      />

      <DeleteUserModal
        visible={showDeleteModal}
        onCancel={() => setShowDeleteModal(false)}
        user={selectedUser}
        users={users}
        activePage={activePage}
        refresh={refresh}
        manageUser={manageUser}
        t={t}
      />

      <ResetPasskeyModal
        visible={showResetPasskeyModal}
        onCancel={() => setShowResetPasskeyModal(false)}
        onConfirm={handleResetPasskeyConfirm}
        user={selectedUser}
        t={t}
      />

      <ResetTwoFAModal
        visible={showResetTwoFAModal}
        onCancel={() => setShowResetTwoFAModal(false)}
        onConfirm={handleResetTwoFAConfirm}
        user={selectedUser}
        t={t}
      />

      <UserSubscriptionsModal
        visible={showUserSubscriptionsModal}
        onCancel={() => setShowUserSubscriptionsModal(false)}
        user={selectedUser}
        t={t}
        onSuccess={() => refresh?.()}
      />

      <div className='space-y-5'>
        <div className='grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]'>
          <div className='rounded-[28px] border border-border/70 bg-card px-6 py-6 shadow-sm'>
            <div className='text-xs uppercase tracking-[0.16em] text-muted-foreground'>
              {t('Users')}
            </div>
            <h2 className='mt-3 text-4xl font-semibold tracking-tight'>
              {t('用户管理')}
            </h2>
            <p className='mt-2 max-w-3xl text-sm text-muted-foreground'>
              {t('统一维护平台账户、权限级别、订阅状态与安全凭证。')}
            </p>
          </div>

          <div className='rounded-[28px] border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-secondary/10 px-6 py-6 shadow-sm'>
            <div className='text-xs uppercase tracking-[0.16em] text-muted-foreground'>
              {t('当前页概览')}
            </div>
            <div className='mt-4 grid grid-cols-2 gap-3'>
              <div className='rounded-2xl border border-border/60 bg-background/75 p-4'>
                <div className='text-xs text-muted-foreground'>
                  {t('总用户')}
                </div>
                <div className='mt-2 text-2xl font-semibold'>
                  {formatCount(userCount)}
                </div>
              </div>
              <div className='rounded-2xl border border-border/60 bg-background/75 p-4'>
                <div className='text-xs text-muted-foreground'>
                  {t('已启用')}
                </div>
                <div className='mt-2 text-2xl font-semibold'>
                  {formatCount(stats.enabled)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className='grid gap-4 md:grid-cols-3'>
          <Card className='border-border/70'>
            <CardContent className='flex items-start justify-between p-5'>
              <div>
                <div className='text-xs uppercase tracking-[0.16em] text-muted-foreground'>
                  {t('管理员')}
                </div>
                <div className='mt-2 text-3xl font-semibold'>
                  {formatCount(stats.admins)}
                </div>
              </div>
              <Shield className='h-5 w-5 text-muted-foreground' />
            </CardContent>
          </Card>
          <Card className='border-border/70'>
            <CardContent className='flex items-start justify-between p-5'>
              <div>
                <div className='text-xs uppercase tracking-[0.16em] text-muted-foreground'>
                  {t('普通用户')}
                </div>
                <div className='mt-2 text-3xl font-semibold'>
                  {formatCount((userCount || 0) - stats.admins)}
                </div>
              </div>
              <Users className='h-5 w-5 text-muted-foreground' />
            </CardContent>
          </Card>
          <Card className='border-border/70'>
            <CardContent className='flex items-start justify-between p-5'>
              <div>
                <div className='text-xs uppercase tracking-[0.16em] text-muted-foreground'>
                  {t('异常状态')}
                </div>
                <div className='mt-2 text-3xl font-semibold'>
                  {formatCount(stats.disabled)}
                </div>
              </div>
              <RefreshCw className='h-5 w-5 text-muted-foreground' />
            </CardContent>
          </Card>
        </div>

        <Card className='border-border/70 shadow-sm'>
          <CardHeader className='pb-4'>
            <CardTitle className='text-2xl'>{t('Users')}</CardTitle>
            <CardDescription>
              {t('结合 Stitch 的信息层级保留旧版用户管理能力。')}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-5'>
            <div className='flex flex-col gap-4 rounded-[24px] border border-border/70 bg-muted/15 p-4'>
              <div className='flex flex-col gap-4 xl:flex-row xl:items-center'>
                <div className='grid flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]'>
                  <Input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder={t(
                      '支持搜索用户的 ID、用户名、显示名称和邮箱地址',
                    )}
                    icon={<Search className='h-4 w-4' />}
                  />
                  <label className='w-full'>
                    <span className='mb-1.5 block text-sm font-medium text-foreground'>
                      {t('分组')}
                    </span>
                    <select
                      className='flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm'
                      value={group}
                      onChange={(event) => setGroup(event.target.value)}
                    >
                      <option value=''>{t('全部分组')}</option>
                      {groupOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className='flex flex-wrap items-center gap-2'>
                  <Button
                    variant='outline'
                    onClick={handleSearch}
                    loading={searching}
                  >
                    {t('查询')}
                  </Button>
                  <Button variant='outline' onClick={handleReset}>
                    {t('重置')}
                  </Button>
                  <Button variant='outline' onClick={() => refresh()}>
                    <RefreshCw className='mr-2 h-4 w-4' />
                    {t('刷新')}
                  </Button>
                  <Button onClick={() => setShowAddUser(true)}>
                    <UserPlus className='mr-2 h-4 w-4' />
                    {t('添加用户')}
                  </Button>
                </div>
              </div>
            </div>

            <div className='overflow-hidden rounded-[24px] border border-border/70'>
              <div className='overflow-x-auto'>
                <Table className='min-w-[1180px]'>
                <Thead className='bg-muted/25'>
                  <Tr className='hover:bg-muted/25'>
                    <Th className='min-w-[300px] px-6 py-4 text-[11px] uppercase tracking-[0.18em]'>
                      {t('用户')}
                    </Th>
                    <Th className='min-w-[120px] px-6 py-4 text-[11px] uppercase tracking-[0.18em]'>
                      {t('角色')}
                    </Th>
                    <Th className='min-w-[140px] px-6 py-4 text-[11px] uppercase tracking-[0.18em]'>
                      {t('分组')}
                    </Th>
                    <Th className='w-[260px] px-4 py-4 text-[11px] uppercase tracking-[0.18em]'>
                      {t('Quota')}
                    </Th>
                    <Th className='min-w-[240px] px-6 py-4 text-[11px] uppercase tracking-[0.18em]'>
                      {t('邀请')}
                    </Th>
                    <Th className='min-w-[120px] px-6 py-4 text-[11px] uppercase tracking-[0.18em]'>
                      {t('状态')}
                    </Th>
                    <Th className='min-w-[220px] px-6 py-4 text-right text-[11px] uppercase tracking-[0.18em]'>
                      {t('操作')}
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {(users || []).map((user) => {
                    const isDeleted = user.DeletedAt !== null;
                    const disabled = user.status !== 1;
                    const role = getRoleBadge(user.role);
                    const totalQuota =
                      Number(user.used_quota || 0) + Number(user.quota || 0);

                    return (
                      <Tr
                        key={user.id}
                        className={cn(
                          'hover:bg-muted/20',
                          (isDeleted || disabled) && 'bg-muted/20',
                        )}
                      >
                        <Td className='px-6 py-5 align-top'>
                          <div className='flex items-start gap-3'>
                            <div className='flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary'>
                              {(user.username || 'U').slice(0, 2).toUpperCase()}
                            </div>
                            <div className='space-y-1'>
                              <div className='font-semibold'>
                                {user.username}
                              </div>
                              <div className='text-sm text-muted-foreground'>
                                {t('ID')}: {user.id}
                              </div>
                              {user.email ? (
                                <div className='text-sm text-muted-foreground'>
                                  {user.email}
                                </div>
                              ) : null}
                              {user.remark ? (
                                <Badge variant='outline' className='mt-1'>
                                  {user.remark}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </Td>
                        <Td className='min-w-[120px] px-6 py-5 align-top whitespace-nowrap'>
                          <Badge variant={role.variant}>{t(role.text)}</Badge>
                        </Td>
                        <Td className='min-w-[140px] px-6 py-5 align-top text-sm text-muted-foreground whitespace-nowrap'>
                          {user.group || '-'}
                        </Td>
                        <Td className='w-[260px] px-4 py-4 align-top'>
                          <QuotaProgressBar
                            used={Number(user.used_quota || 0)}
                            total={totalQuota}
                            unit=''
                            title=''
                            className='max-w-[232px] rounded-xl bg-background/70 p-3'
                            formatValue={formatQuotaToUSD}
                          />
                        </Td>
                        <Td className='min-w-[240px] px-6 py-5 align-top'>
                          <div className='space-y-2 text-sm text-muted-foreground'>
                            <div className='whitespace-nowrap'>
                              {t('邀请人数')}: {formatCount(user.aff_count)}
                            </div>
                            <div className='whitespace-nowrap'>
                              {t('历史收益')}:{' '}
                              {formatCount(user.aff_history_quota)}
                            </div>
                            <div className='whitespace-nowrap'>
                              {user.inviter_id
                                ? `${t('邀请人')}: ${user.inviter_id}`
                                : t('无邀请人')}
                            </div>
                          </div>
                        </Td>
                        <Td className='min-w-[120px] px-6 py-5 align-top whitespace-nowrap'>
                          <Badge
                            variant={
                              disabled || isDeleted
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {isDeleted
                              ? t('已注销')
                              : disabled
                                ? t('已禁用')
                                : t('已启用')}
                          </Badge>
                        </Td>
                        <Td className='min-w-[220px] px-6 py-5 align-top'>
                          <div className='flex justify-end gap-2 whitespace-nowrap'>
                            {user.status === 1 ? (
                              <Button
                                size='sm'
                                variant='destructive'
                                onClick={() => openActionModal(user, 'disable')}
                                disabled={isDeleted}
                              >
                                {t('禁用')}
                              </Button>
                            ) : (
                              <Button
                                size='sm'
                                onClick={() => openActionModal(user, 'enable')}
                                disabled={isDeleted}
                              >
                                {t('启用')}
                              </Button>
                            )}
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() => {
                                setEditingUser(user);
                                setShowEditUser(true);
                              }}
                              disabled={isDeleted}
                            >
                              <Pencil className='mr-1 h-3.5 w-3.5' />
                              {t('编辑')}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant='outline'
                                  size='icon'
                                  disabled={isDeleted}
                                >
                                  <MoreHorizontal className='h-4 w-4' />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align='end'>
                                <DropdownMenuItem
                                  onSelect={() =>
                                    openActionModal(
                                      user,
                                      user.role >= 10 ? 'demote' : 'promote',
                                    )
                                  }
                                >
                                  {user.role >= 10 ? t('降级') : t('提升')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() =>
                                    openActionModal(user, 'subscriptions')
                                  }
                                >
                                  {t('订阅管理')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={() =>
                                    openActionModal(user, 'reset-passkey')
                                  }
                                >
                                  {t('重置 Passkey')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() =>
                                    openActionModal(user, 'reset-2fa')
                                  }
                                >
                                  {t('重置 2FA')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className='text-destructive focus:text-destructive'
                                  onSelect={() =>
                                    openActionModal(user, 'delete')
                                  }
                                >
                                  {t('注销')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}

                  {(users || []).length === 0 ? (
                    <Tr>
                      <Td
                        colSpan={7}
                        className='px-6 py-10 text-center text-sm text-muted-foreground'
                      >
                        {searching ? t('搜索中...') : t('暂无用户数据')}
                      </Td>
                    </Tr>
                  ) : null}
                </Tbody>
                </Table>
              </div>
            </div>

            <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
              <div className='text-sm text-muted-foreground'>
                {t('共 {{count}} 条', { count: userCount || 0 })}
                {loading || searching ? ` · ${t('加载中...')}` : ''}
              </div>

              <div className='flex items-center gap-2'>
                <select
                  className='h-9 rounded-lg border border-input bg-background px-3 text-sm'
                  value={pageSize}
                  onChange={(event) =>
                    handlePageSizeChange(Number(event.target.value))
                  }
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
                <span className='min-w-[72px] text-center text-sm text-muted-foreground'>
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
    </>
  );
}
