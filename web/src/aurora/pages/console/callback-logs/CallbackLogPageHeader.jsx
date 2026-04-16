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
import { Download, RefreshCw } from 'lucide-react';
import { Button } from '../../../primitives/button';

export default function CallbackLogPageHeader({
  loading,
  onExport,
  onRefresh,
  t,
}) {
  return (
    <section className='flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between'>
      <div>
        <h2 className='text-[2rem] font-extrabold tracking-tight text-on-surface'>
          Callback Logs
        </h2>
        <p className='mt-1 text-sm font-medium text-on-surface-variant'>
          {t('Monitor webhook callback delivery status')}
        </p>
      </div>

      <div className='flex flex-wrap gap-3'>
        <Button
          variant='outline'
          className='h-11 rounded-lg border-outline-variant bg-white px-4 text-on-surface hover:bg-surface-container-low'
          onClick={onRefresh}
          loading={loading}
        >
          <RefreshCw className='mr-2 h-4 w-4' />
          {t('刷新')}
        </Button>
        <Button
          className='h-11 rounded-lg bg-primary px-4 text-white hover:bg-primary-dim'
          onClick={onExport}
        >
          <Download className='mr-2 h-4 w-4' />
          {t('导出 CSV')}
        </Button>
      </div>
    </section>
  );
}
