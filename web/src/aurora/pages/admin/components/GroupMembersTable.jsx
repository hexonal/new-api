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

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MoreVertical, Users } from 'lucide-react';
import { Avatar, AvatarFallback } from '../../../primitives/avatar';
import { Badge } from '../../../primitives/badge';
import { Table, Tbody, Td, Th, Thead, Tr } from '../../../primitives/table';

const ROLE_META = {
  1: { text: '普通用户', variant: 'secondary' },
  10: { text: '管理员', variant: 'default' },
  100: { text: '超级管理员', variant: 'destructive' },
};

function getRoleMeta(role) {
  return ROLE_META[role] || { text: '成员', variant: 'outline' };
}

function formatJoinTime(user) {
  const value = user?.created_at || user?.created_time;

  if (!value) {
    return '-';
  }
  const date =
    typeof value === 'number' ? new Date(value * 1000) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function MemberRow({ user, t }) {
  const roleMeta = getRoleMeta(user.role);
  const initial = String(user?.username || '?')
    .slice(0, 1)
    .toUpperCase();

  return (
    <Tr key={user.id} className='hover:bg-slate-50/60'>
      <Td className='px-6 py-4'>
        <div className='flex items-center gap-3'>
          <Avatar className='h-8 w-8 border border-slate-200'>
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <div className='min-w-0'>
            <div className='truncate font-semibold text-slate-900'>
              {user.username || '-'}
            </div>
            <div className='mt-0.5 text-xs text-slate-500'>
              {t('ID:')} {user.id || '-'}
            </div>
          </div>
        </div>
      </Td>
      <Td className='px-6 py-4'>
        <Badge variant={roleMeta.variant} className='rounded-full uppercase'>
          {t(roleMeta.text)}
        </Badge>
      </Td>
      <Td className='px-6 py-4 text-xs text-slate-500'>
        {formatJoinTime(user)}
      </Td>
      <Td className='px-6 py-4 text-right'>
        <button
          type='button'
          className='text-slate-400 transition-colors hover:text-slate-700'
        >
          <MoreVertical className='h-4 w-4' />
        </button>
      </Td>
    </Tr>
  );
}

export default function GroupMembersTable({ users }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Users className='h-4 w-4 text-slate-400' />
          <h3 className='text-sm font-bold uppercase tracking-[0.22em] text-slate-500'>
            {t('成员')}
          </h3>
        </div>
        <button
          type='button'
          onClick={() => navigate('/console/user')}
          className='text-sm font-bold text-indigo-600 transition-colors hover:text-indigo-800'
        >
          {t('查看全部成员')}
        </button>
      </div>

      <div className='overflow-hidden rounded-[24px] border border-slate-100 bg-white'>
        <Table>
          <Thead className='bg-slate-50'>
            <Tr className='border-b border-slate-100 hover:bg-slate-50'>
              <Th className='px-6 py-4 font-bold text-slate-700'>
                {t('用户名')}
              </Th>
              <Th className='px-6 py-4 font-bold text-slate-700'>
                {t('角色')}
              </Th>
              <Th className='px-6 py-4 font-bold text-slate-700'>
                {t('加入时间')}
              </Th>
              <Th className='px-6 py-4 text-right' />
            </Tr>
          </Thead>
          <Tbody>
            {users.map((user) => (
              <MemberRow key={user.id} user={user} t={t} />
            ))}
            {users.length === 0 ? (
              <Tr>
                <Td
                  colSpan={4}
                  className='px-6 py-10 text-center text-sm text-slate-500'
                >
                  {t('当前分组暂无成员')}
                </Td>
              </Tr>
            ) : null}
          </Tbody>
        </Table>
      </div>
    </div>
  );
}
