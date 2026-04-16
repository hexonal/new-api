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
import { Bell, BellOff, RadioTower } from 'lucide-react';
import { marked } from 'marked';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../primitives/tabs';
import { Badge } from '../../../primitives/badge';

const getHealthPercent = (group) => {
  const monitors = Array.isArray(group?.monitors) ? group.monitors.length : 0;
  if (!monitors) {
    return 0;
  }

  const healthyCount = (group?.monitors || []).filter(
    (item) => Number(item?.status) === 1,
  ).length;

  return Math.round((healthyCount / monitors) * 100);
};

const SectionTitle = ({ icon, title }) => (
  <div className='mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-slate-900'>
    <span className='h-1.5 w-1.5 rounded-full bg-indigo-600' />
    {icon}
    <span>{title}</span>
  </div>
);

const AnnouncementEmptyState = ({ title, description }) => (
  <div className='flex h-[340px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-center shadow-sm'>
    <div className='relative mb-6'>
      <div className='flex h-24 w-24 items-center justify-center rounded-full bg-indigo-50 text-indigo-300'>
        <Bell className='h-10 w-10' />
      </div>
      <div className='absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-100 bg-white text-indigo-400 shadow-sm'>
        <BellOff className='h-4 w-4' />
      </div>
    </div>
    <h3 className='mb-2 text-sm font-bold text-slate-900'>{title}</h3>
    <p className='max-w-[220px] text-xs leading-5 text-slate-500'>{description}</p>
  </div>
);

const AnnouncementList = ({ items = [] }) => (
  <div className='space-y-3'>
    {items.map((item, index) => {
      const time = item?.relative || item?.time || item?.publishDate || '';
      const htmlContent = marked.parse(item?.content || '');

      return (
        <article
          key={item?.id || item?.title || index}
          className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm'
        >
          <div className='mb-2 flex items-center justify-between gap-3'>
            <p className='text-xs font-semibold uppercase tracking-[0.16em] text-slate-400'>
              Notice
            </p>
            {time ? <span className='text-xs text-slate-400'>{time}</span> : null}
          </div>
          <div
            className='prose prose-sm max-w-none text-sm text-slate-700'
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </article>
      );
    })}
  </div>
);

const HealthList = ({ items = [], t = (value) => value }) => (
  <div className='space-y-3'>
    {items.map((group, index) => {
      const healthPercent = getHealthPercent(group);

      return (
        <article
          key={group?.categoryName || group?.name || index}
          className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm'
        >
          <div className='mb-3 flex items-center justify-between gap-3'>
            <div className='flex items-center gap-2'>
              <RadioTower className='h-4 w-4 text-indigo-500' />
              <h3 className='text-sm font-semibold text-slate-900'>
                {group?.categoryName || group?.name || t('服务分组')}
              </h3>
            </div>
            <Badge
              variant={healthPercent >= 90 ? 'default' : 'destructive'}
              className='rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.12em]'
            >
              {healthPercent >= 90 ? t('稳定') : t('波动')}
            </Badge>
          </div>
          <div className='mb-2 h-2 overflow-hidden rounded-full bg-slate-100'>
            <div
              className='h-full rounded-full bg-emerald-500'
              style={{ width: `${healthPercent}%` }}
            />
          </div>
          <p className='text-xs text-slate-500'>
            {healthPercent}% · {(group?.monitors || []).length} {t('个监控项')}
          </p>
        </article>
      );
    })}
  </div>
);

export default function AnnouncementCenterCard({
  title = 'Announcements',
  announcementItems = [],
  uptimeItems = [],
  emptyTitle = '',
  emptyDescription = '',
  t = (value) => value,
}) {
  const hasAnnouncements = announcementItems.length > 0;
  const hasHealth = uptimeItems.length > 0;

  return (
    <section className='space-y-4'>
      <SectionTitle icon={<Bell className='h-4 w-4 text-indigo-600' />} title={title} />
      <Tabs defaultValue='announcements' className='w-full'>
        <TabsList className='grid w-full grid-cols-2 bg-slate-100'>
          <TabsTrigger value='announcements'>{t('公告')}</TabsTrigger>
          <TabsTrigger value='health'>{t('健康度')}</TabsTrigger>
        </TabsList>
        <TabsContent value='announcements'>
          {hasAnnouncements ? (
            <AnnouncementList items={announcementItems} />
          ) : (
            <AnnouncementEmptyState
              title={emptyTitle}
              description={emptyDescription}
            />
          )}
        </TabsContent>
        <TabsContent value='health'>
          {hasHealth ? (
            <HealthList items={uptimeItems} t={t} />
          ) : (
            <AnnouncementEmptyState
              title={t('暂无健康度数据')}
              description={t('服务监控数据可用后会显示在这里')}
            />
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
