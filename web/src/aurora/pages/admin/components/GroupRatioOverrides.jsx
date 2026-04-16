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
import { Plus, Settings, Trash2 } from 'lucide-react';
import { Input } from '../../../primitives/input';

function getFieldClassName(disabled) {
  const disabledClassName = disabled
    ? 'cursor-not-allowed bg-slate-100 text-slate-500'
    : 'bg-white text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
  return `h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition ${disabledClassName}`;
}

function SettingField({
  label,
  value,
  onChange,
  helper,
  readOnly = false,
  disabled = false,
}) {
  return (
    <div>
      <label className='mb-1 block text-sm font-semibold text-slate-700'>
        {label}
      </label>
      <input
        className={getFieldClassName(disabled)}
        type='number'
        step='0.1'
        min='0'
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        onChange={
          readOnly || disabled
            ? undefined
            : (event) => onChange(event.target.value)
        }
      />
      <p className='mt-1 text-[11px] leading-5 text-slate-400'>{helper}</p>
    </div>
  );
}

function ModelRatioItem({ entry, onChange, onRemove, disabled }) {
  return (
    <div className='grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_120px_44px] md:items-center'>
      <div className='min-w-0'>
        <div className='truncate text-sm font-semibold text-slate-900'>
          {entry.model}
        </div>
        <div className='mt-1 text-xs text-slate-500'>
          该模型命中分组时，将覆盖基础倍率。
        </div>
      </div>
      <input
        className={getFieldClassName(disabled).replace('h-11', 'h-10')}
        type='number'
        min='0'
        step='0.1'
        value={entry.ratio}
        disabled={disabled}
        onChange={
          disabled
            ? undefined
            : (event) => onChange(entry.model, event.target.value)
        }
      />
      <button
        type='button'
        onClick={disabled ? undefined : () => onRemove(entry.model)}
        disabled={disabled}
        className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
          disabled
            ? 'cursor-not-allowed text-slate-300'
            : 'text-slate-400 hover:bg-red-50 hover:text-red-600'
        }`}
      >
        <Trash2 className='h-4 w-4' />
      </button>
    </div>
  );
}

function AddModelRow({
  addModelName,
  onAddModelNameChange,
  addModelRatio,
  onAddModelRatioChange,
  availableModelOptions,
  onAddModelRatio,
  t,
  disabled,
}) {
  return (
    <div className='rounded-xl border border-dashed border-slate-200 bg-white p-3'>
      <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_120px] md:items-center'>
        <select
          className={getFieldClassName(disabled).replace('h-11', 'h-10')}
          value={addModelName}
          disabled={disabled}
          onChange={
            disabled
              ? undefined
              : (event) => onAddModelNameChange(event.target.value)
          }
        >
          <option value=''>{t('选择模型')}</option>
          {availableModelOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <Input
          type='number'
          min='0'
          step='0.1'
          value={addModelRatio}
          disabled={disabled}
          onChange={(event) => onAddModelRatioChange(event.target.value)}
          placeholder='1'
          className={`h-10 rounded-xl border-slate-200 ${
            disabled ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''
          }`}
        />
        <button
          type='button'
          onClick={disabled ? undefined : onAddModelRatio}
          disabled={disabled}
          className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors ${
            disabled
              ? 'cursor-not-allowed bg-slate-100 text-slate-400'
              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
          }`}
        >
          <Plus className='h-4 w-4' />
          {t('添加模型')}
        </button>
      </div>
    </div>
  );
}

export default function GroupRatioOverrides({
  selectedGroup,
  editBaseRatio,
  onBaseRatioChange,
  modelRatioEntries,
  onModelRatioChange,
  onRemoveModelRatio,
  addModelName,
  onAddModelNameChange,
  addModelRatio,
  onAddModelRatioChange,
  availableModelOptions,
  onAddModelRatio,
  isSystemGroup,
}) {
  const { t } = useTranslation();

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-2'>
        <Settings className='h-4 w-4 text-slate-400' />
        <h3 className='text-sm font-bold uppercase tracking-[0.22em] text-slate-500'>
          {t('分组设置')}
        </h3>
      </div>

      <div className='grid gap-6 rounded-[24px] border border-slate-100 bg-slate-50/60 p-6 md:grid-cols-2'>
        <SettingField
          label={t('基础倍率')}
          value={editBaseRatio}
          onChange={onBaseRatioChange}
          disabled={isSystemGroup}
          helper={t(
            isSystemGroup
              ? 'default 为系统默认分组，基础倍率不可编辑。'
              : '旧版 GroupRatio 的真实保存字段，控制该分组的整体价格倍率。',
          )}
        />
        <SettingField
          label={t('当前生效倍率')}
          value={editBaseRatio}
          readOnly={true}
          helper={t(
            '当前后端没有独立 completion ratio 字段，因此这里展示与基础倍率一致的最终结果。',
          )}
        />

        <div className='md:col-span-2'>
          <label className='mb-2 block text-sm font-semibold text-slate-700'>
            {t('模型倍率覆盖')}
          </label>
          <div className='min-h-[56px] rounded-xl border border-slate-200 bg-white p-3'>
            <div className='flex min-h-[32px] flex-wrap items-center gap-2'>
              {modelRatioEntries.map((entry) => (
                <div
                  key={entry.model}
                  className='inline-flex items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700'
                >
                  <span>{entry.model}</span>
                  <span className='rounded bg-white/70 px-1.5 py-0.5 text-[10px] text-indigo-600'>
                    ×{entry.ratio}
                  </span>
                </div>
              ))}
              {modelRatioEntries.length === 0 ? (
                <span className='text-sm text-slate-400'>
                  {t('该分组暂未配置模型级覆盖')}
                </span>
              ) : null}
            </div>
          </div>
          <p className='mt-1 text-[11px] leading-5 text-slate-400'>
            {t(
              isSystemGroup
                ? 'default 为系统默认分组，不允许新增、删除或修改模型倍率覆盖。'
                : '通过 GroupModelRatio 为指定模型配置更细粒度的倍率覆盖。',
            )}
          </p>
        </div>
      </div>

      <div className='space-y-3'>
        <div className='flex items-center justify-between'>
          <div>
            <h4 className='text-sm font-semibold text-slate-900'>
              {t('模型覆盖清单')}
            </h4>
            <p className='mt-1 text-xs text-slate-500'>
              {t('当前分组：{{group}}', { group: selectedGroup })}
            </p>
          </div>
          <span className='rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600'>
            {t('{{count}} 项', { count: modelRatioEntries.length })}
          </span>
        </div>

        {modelRatioEntries.map((entry) => (
          <ModelRatioItem
            key={entry.model}
            entry={entry}
            onChange={onModelRatioChange}
            onRemove={onRemoveModelRatio}
            disabled={isSystemGroup}
          />
        ))}

        <AddModelRow
          addModelName={addModelName}
          onAddModelNameChange={onAddModelNameChange}
          addModelRatio={addModelRatio}
          onAddModelRatioChange={onAddModelRatioChange}
          availableModelOptions={availableModelOptions}
          onAddModelRatio={onAddModelRatio}
          t={t}
          disabled={isSystemGroup}
        />
      </div>
    </div>
  );
}
