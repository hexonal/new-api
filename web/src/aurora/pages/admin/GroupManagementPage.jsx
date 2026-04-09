import React, { useEffect, useMemo, useState } from 'react';
import { API, showError } from '../../../helpers';
import { cn } from '../../lib/cn';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../primitives/card';
import { Button } from '../../primitives/button';
import {
  GroupDetail,
  GroupRatioOverrides,
  GroupModelAccess,
  GroupMembersTable,
  GroupChannelsTable,
} from './components';

export default function GroupManagementPage() {
  const [loading, setLoading] = useState(true);
  const [groupRatio, setGroupRatio] = useState({});
  const [groupModelRatio, setGroupModelRatio] = useState({});
  const [models, setModels] = useState([]);
  const [users, setUsers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');

  const groupNames = useMemo(() => {
    const set = new Set([...Object.keys(groupRatio || {}), ...Object.keys(groupModelRatio || {})]);
    return Array.from(set).sort();
  }, [groupRatio, groupModelRatio]);

  useEffect(() => {
    if (!selectedGroup && groupNames.length > 0) {
      setSelectedGroup(groupNames[0]);
    }
  }, [groupNames, selectedGroup]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [optionRes, pricingRes, usersRes, channelsRes] = await Promise.all([
        API.get('/api/option/'),
        API.get('/api/pricing'),
        API.get('/api/user/?p=1&page_size=200'),
        API.get('/api/channel/?p=1&page_size=200'),
      ]);

      if (optionRes?.data?.success) {
        const list = optionRes.data.data || [];
        const groupRatioRaw = list.find((item) => item.key === 'GroupRatio')?.value || '{}';
        const groupModelRatioRaw = list.find((item) => item.key === 'GroupModelRatio')?.value || '{}';
        try {
          setGroupRatio(JSON.parse(groupRatioRaw));
        } catch {
          setGroupRatio({});
        }
        try {
          setGroupModelRatio(JSON.parse(groupModelRatioRaw));
        } catch {
          setGroupModelRatio({});
        }
      }

      if (pricingRes?.data?.success) {
        const pricingData = pricingRes.data.data || [];
        setModels(
          pricingData
            .map((item) => (typeof item === 'string' ? item : item?.model_name || item?.id || ''))
            .filter(Boolean),
        );
      }

      if (usersRes?.data?.success) {
        setUsers(usersRes.data.data?.items || []);
      }

      if (channelsRes?.data?.success) {
        setChannels(channelsRes.data.data?.items || []);
      }
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || '加载分组配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currentRatio = Number(groupRatio[selectedGroup] ?? 1);
  const currentModelRatio = groupModelRatio[selectedGroup] || {};

  const groupUsers = useMemo(() => {
    return (users || []).filter((item) => String(item.group || '') === String(selectedGroup || ''));
  }, [users, selectedGroup]);

  const groupChannels = useMemo(() => {
    return (channels || []).filter((item) => {
      const groups = String(item.group || '')
        .split(',')
        .map((it) => it.trim())
        .filter(Boolean);
      return groups.includes(selectedGroup);
    });
  }, [channels, selectedGroup]);

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader className='pb-4'>
          <CardTitle className='text-base'>分组管理</CardTitle>
          <CardDescription>Master-Detail 双面板布局：左侧分组列表，右侧分组详情与策略。</CardDescription>
        </CardHeader>
      </Card>

      <div className='grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr]'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>分组列表</CardTitle>
            <CardDescription>{loading ? '加载中...' : `共 ${groupNames.length} 个分组`}</CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            {groupNames.map((groupName) => {
              const active = selectedGroup === groupName;
              return (
                <button
                  key={groupName}
                  type='button'
                  onClick={() => setSelectedGroup(groupName)}
                  className={cn(
                    'w-full rounded border px-3 py-2 text-left text-sm transition-colors',
                    active
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card hover:bg-muted/40',
                  )}
                >
                  <div className='font-medium'>{groupName}</div>
                  <div className='text-xs text-muted-foreground mt-0.5'>基础倍率 {Number(groupRatio[groupName] ?? 1).toFixed(2)}</div>
                </button>
              );
            })}
            {groupNames.length === 0 ? (
              <div className='rounded border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground'>
                暂无分组配置
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className='space-y-4'>
          <div className='flex items-center justify-end'>
            <Button variant='outline' size='sm' onClick={loadData}>
              刷新数据
            </Button>
          </div>

          <GroupDetail
            title='分组详情'
            data={{
              id: selectedGroup || '-',
              name: selectedGroup || '-',
              type: '权限分组',
              status: currentRatio > 0 ? '启用' : '异常',
            }}
          />

          <div className='grid grid-cols-1 gap-4 2xl:grid-cols-2'>
            <GroupRatioOverrides
              values={{
                __base_ratio__: currentRatio,
                ...currentModelRatio,
              }}
              description='__base_ratio__ 为分组基础倍率，其余为模型级覆盖。'
            />
            <GroupModelAccess
              groupName={selectedGroup || '未选择'}
              options={models}
              selected={Object.keys(currentModelRatio)}
              disabled={true}
            />
          </div>

          <div className='grid grid-cols-1 gap-4 2xl:grid-cols-2'>
            <GroupMembersTable users={groupUsers} />
            <GroupChannelsTable channels={groupChannels} />
          </div>
        </div>
      </div>
    </div>
  );
}
