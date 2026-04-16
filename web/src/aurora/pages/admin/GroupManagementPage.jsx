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
import {
  CircleHelp,
  FolderTree,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../primitives/dialog';
import { useGroupManagementPage } from './hooks/use-group-management-page';
import {
  GroupChannelsTable,
  GroupDetail,
  GroupList,
  GroupMembersTable,
  GroupRatioOverrides,
} from './components';

function LoadingState({ text }) {
  return (
    <div className='flex min-h-[480px] items-center justify-center rounded-[28px] border border-border/70 bg-white'>
      <div className='flex items-center gap-3 text-sm text-muted-foreground'>
        <LoaderCircle className='h-4 w-4 animate-spin' />
        <span>{text}</span>
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className='flex min-h-[480px] items-center justify-center rounded-[28px] border border-dashed border-border bg-white'>
      <div className='max-w-sm space-y-3 px-6 text-center'>
        <div className='mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary'>
          <FolderTree className='h-6 w-6' />
        </div>
        <div className='space-y-1'>
          <h2 className='text-lg font-semibold text-foreground'>{text}</h2>
          <p className='text-sm text-muted-foreground'>
            请先创建一个分组，或检查后端分组配置是否已初始化。
          </p>
        </div>
      </div>
    </div>
  );
}

function CreateGroupDialog({
  open,
  onOpenChange,
  name,
  onNameChange,
  baseRatio,
  onBaseRatioChange,
  onSubmit,
  saving,
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md rounded-[24px] border border-border/80 bg-white p-0 shadow-2xl shadow-slate-950/10'>
        <DialogHeader className='border-b border-border/70 px-6 py-5'>
          <DialogTitle className='text-lg font-semibold'>
            {t('新增分组')}
          </DialogTitle>
          <DialogDescription className='mt-1 text-sm text-muted-foreground'>
            {t('创建新的业务分组，并为其初始化基础倍率配置。')}
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-5 px-6 py-6'>
          <Input
            label={t('分组名称')}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={t('例如：enterprise-vip')}
            autoFocus={true}
          />
          <Input
            label={t('基础倍率')}
            type='number'
            step='0.1'
            min='0'
            value={baseRatio}
            onChange={(event) => onBaseRatioChange(event.target.value)}
            placeholder='1'
          />
        </div>
        <DialogFooter className='border-t border-border/70 px-6 py-5'>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t('取消')}
          </Button>
          <Button onClick={onSubmit} loading={saving}>
            <Plus className='mr-1 h-4 w-4' />
            {t('创建分组')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function GroupManagementPage() {
  const { t } = useTranslation();
  const {
    loading,
    saving,
    searchQuery,
    setSearchQuery,
    selectedGroup,
    setSelectedGroup,
    filteredGroups,
    memberCounts,
    channelCounts,
    createDialogOpen,
    setCreateDialogOpen,
    newGroupName,
    setNewGroupName,
    newGroupBaseRatio,
    setNewGroupBaseRatio,
    editBaseRatio,
    handleBaseRatioChange,
    modelRatioEntries,
    addModelName,
    setAddModelName,
    addModelRatio,
    setAddModelRatio,
    availableModelOptions,
    handleAddModelRatio,
    handleRemoveModelRatio,
    handleModelRatioChange,
    handleSave,
    handleCreateGroup,
    handleDeleteGroup,
    hasUnsavedChanges,
    groupUsers,
    groupChannels,
    groupDescription,
    isSystemGroup,
    loadData,
  } = useGroupManagementPage();

  if (loading) {
    return <LoadingState text={t('正在加载分组配置...')} />;
  }

  if (!selectedGroup && filteredGroups.length === 0) {
    return <EmptyState text={t('当前还没有可管理的分组')} />;
  }

  return (
    <>
      <div className='min-h-[calc(100vh-120px)] rounded-[32px] bg-[#f8f9ff] p-4 text-slate-900 md:p-6'>
        <div className='overflow-hidden rounded-[28px] border border-[#e5e7eb] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)]'>
          <div className='flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4'>
            <div className='relative w-full max-w-md'>
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('搜索分组...')}
                className='h-11 rounded-xl border-none bg-[#f8fafc] pl-10 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-primary/30'
                icon={<Search className='h-4 w-4 text-slate-400' />}
              />
            </div>
            <div className='ml-4 hidden items-center gap-5 lg:flex'>
              <button
                type='button'
                className='text-sm font-medium text-slate-500 transition-colors hover:text-slate-900'
              >
                {t('模型')}
              </button>
              <button
                type='button'
                className='text-sm font-medium text-slate-500 transition-colors hover:text-slate-900'
              >
                {t('活动')}
              </button>
              <button
                type='button'
                className='text-sm font-medium text-slate-500 transition-colors hover:text-slate-900'
              >
                {t('密钥')}
              </button>
              <button
                type='button'
                className='text-sm font-medium text-slate-500 transition-colors hover:text-slate-900'
              >
                {t('文档')}
              </button>
              <div className='h-6 w-px bg-slate-200' />
              <button
                type='button'
                className='text-slate-500 transition-colors hover:text-primary'
              >
                <CircleHelp className='h-5 w-5' />
              </button>
            </div>
          </div>

          <div className='flex min-h-[760px] flex-col xl:flex-row'>
            <GroupList
              groups={filteredGroups}
              selectedGroup={selectedGroup}
              onSelect={setSelectedGroup}
              memberCounts={memberCounts}
              channelCounts={channelCounts}
              onCreateGroup={() => setCreateDialogOpen(true)}
            />

            <section className='flex-1 overflow-y-auto bg-white'>
              <div className='mx-auto flex h-full max-w-5xl flex-col gap-8 px-6 py-8 lg:px-8'>
                <div className='flex flex-col justify-between gap-4 sm:flex-row sm:items-start'>
                  <GroupDetail
                    groupName={selectedGroup}
                    description={groupDescription}
                    memberCount={memberCounts[selectedGroup] || 0}
                    channelCount={channelCounts[selectedGroup] || 0}
                    isSystemGroup={isSystemGroup}
                    hasUnsavedChanges={hasUnsavedChanges}
                  />
                  <div className='flex items-center gap-2 self-start'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => loadData()}
                      disabled={saving}
                    >
                      <RefreshCw className='mr-1 h-3.5 w-3.5' />
                      {t('刷新')}
                    </Button>
                    {isSystemGroup ? (
                      <div className='inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700'>
                        <ShieldCheck className='h-3.5 w-3.5' />
                        {t('系统分组')}
                      </div>
                    ) : null}
                  </div>
                </div>

                <GroupRatioOverrides
                  selectedGroup={selectedGroup}
                  editBaseRatio={editBaseRatio}
                  onBaseRatioChange={handleBaseRatioChange}
                  modelRatioEntries={modelRatioEntries}
                  onModelRatioChange={handleModelRatioChange}
                  onRemoveModelRatio={handleRemoveModelRatio}
                  addModelName={addModelName}
                  onAddModelNameChange={setAddModelName}
                  addModelRatio={addModelRatio}
                  onAddModelRatioChange={setAddModelRatio}
                  availableModelOptions={availableModelOptions}
                  onAddModelRatio={handleAddModelRatio}
                  isSystemGroup={isSystemGroup}
                />

                <GroupMembersTable users={groupUsers} />

                <GroupChannelsTable channels={groupChannels} />

                <div className='flex flex-col items-start justify-between gap-3 border-t border-[#eef2f7] pt-8 sm:flex-row sm:items-center'>
                  <Button
                    className='h-11 rounded-2xl px-6 text-sm font-semibold shadow-[0_10px_24px_rgba(99,102,241,0.25)]'
                    onClick={() => handleSave()}
                    loading={saving}
                    disabled={isSystemGroup || !hasUnsavedChanges}
                  >
                    {t('保存变更')}
                  </Button>
                  <Button
                    variant='ghost'
                    className='h-11 rounded-2xl px-5 text-sm font-semibold text-destructive hover:bg-destructive/5 hover:text-destructive'
                    onClick={() => handleDeleteGroup()}
                    disabled={saving || isSystemGroup}
                  >
                    {t('删除分组')}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <CreateGroupDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        name={newGroupName}
        onNameChange={setNewGroupName}
        baseRatio={newGroupBaseRatio}
        onBaseRatioChange={setNewGroupBaseRatio}
        onSubmit={() => handleCreateGroup()}
        saving={saving}
      />
    </>
  );
}
