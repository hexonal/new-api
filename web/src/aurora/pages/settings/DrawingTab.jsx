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
import { Brush } from 'lucide-react';
import useSettingsOptions from './useSettingsOptions';
import { parseBoolean } from './useSettingsOptions';
import { showWarning } from '../../../helpers';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../primitives/card';
import { Switch } from '../../primitives/switch';
import { Button } from '../../primitives/button';

const DRAWING_KEYS = [
  { key: 'DrawingEnabled', label: '启用绘图功能' },
  { key: 'MjNotifyEnabled', label: '允许回调（会泄露服务器 IP 地址）' },
  { key: 'MjAccountFilterEnabled', label: '允许 AccountFilter 参数' },
  { key: 'MjForwardUrlEnabled', label: '开启之后将上游地址替换为服务器地址' },
  {
    key: 'MjModeClearEnabled',
    label: '清除提示词中的 --fast/--relax/--turbo 参数',
  },
  {
    key: 'MjActionCheckSuccessEnabled',
    label: '放大/变体操作前检测绘图成功状态',
  },
];

const toBooleanState = (options) => {
  return DRAWING_KEYS.reduce((accumulator, item) => {
    accumulator[item.key] = parseBoolean(options[item.key], false);
    return accumulator;
  }, {});
};

const buildChangedEntries = (draft, initial) => {
  return DRAWING_KEYS.filter(
    (item) => draft[item.key] !== initial[item.key],
  ).map((item) => ({
    key: item.key,
    value: draft[item.key],
  }));
};

export default function DrawingTab() {
  const { t } = useTranslation();
  const { options, saveOptions, loading } = useSettingsOptions();
  const [draft, setDraft] = React.useState(() => toBooleanState({}));
  const [initial, setInitial] = React.useState(() => toBooleanState({}));
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const nextState = toBooleanState(options);
    setDraft(nextState);
    setInitial(nextState);
    localStorage.setItem(
      'mj_notify_enabled',
      String(nextState.MjNotifyEnabled),
    );
  }, [options]);

  const saveDrawingOptions = React.useCallback(async () => {
    const entries = buildChangedEntries(draft, initial);
    if (!entries.length) {
      showWarning(t('你似乎并没有修改什么'));
      return;
    }

    setSaving(true);
    const success = await saveOptions(entries, t('保存成功'));
    if (success) {
      setInitial(draft);
      localStorage.setItem('mj_notify_enabled', String(draft.MjNotifyEnabled));
    }
    setSaving(false);
  }, [draft, initial, saveOptions, t]);

  return (
    <Card className='border-border shadow-sm'>
      <CardHeader className='space-y-2 border-b border-border/70 pb-4'>
        <div className='flex items-center gap-2'>
          <Brush className='h-5 w-5 text-primary' />
          <CardTitle>{t('MJ设置')}</CardTitle>
        </div>
        <p className='text-sm text-muted-foreground'>
          {t('Midjourney 相关参数和开关。')}
        </p>
      </CardHeader>
      <CardContent className='space-y-3 pt-4'>
        {DRAWING_KEYS.map((item) => (
          <div
            key={item.key}
            className='flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2'
          >
            <span className='text-sm'>{t(item.label)}</span>
            <Switch
              checked={!!draft[item.key]}
              onCheckedChange={(checked) =>
                setDraft((prev) => ({ ...prev, [item.key]: Boolean(checked) }))
              }
              disabled={loading || saving}
            />
          </div>
        ))}
        <div className='pt-2'>
          <Button
            className='w-full sm:w-auto'
            onClick={saveDrawingOptions}
            loading={saving}
            disabled={loading}
          >
            {t('保存绘图设置')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
