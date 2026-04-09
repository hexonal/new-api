import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../primitives/card';
import { Input } from '../../primitives/input';
import { Switch } from '../../primitives/switch';
import { Button } from '../../primitives/button';
import { parseBoolean, parseString } from './useSettingsOptions';

export default function OptionCard({
  title,
  description,
  optionPrefix,
  options,
  saveOptions,
  showInput = true,
  showSwitch = true,
  inputLabel = '值',
  inputPlaceholder = '请输入配置值',
}) {
  const [value, setValue] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  const keys = useMemo(
    () => ({
      valueKey: `${optionPrefix}.value`,
      enabledKey: `${optionPrefix}.enabled`,
    }),
    [optionPrefix],
  );

  useEffect(() => {
    if (showInput) {
      setValue(parseString(options[keys.valueKey], ''));
    }
    if (showSwitch) {
      setEnabled(parseBoolean(options[keys.enabledKey], false));
    }
  }, [keys.enabledKey, keys.valueKey, options, showInput, showSwitch]);

  const onSave = async () => {
    setSaving(true);
    const entries = [];
    if (showInput) {
      entries.push({ key: keys.valueKey, value });
    }
    if (showSwitch) {
      entries.push({ key: keys.enabledKey, value: enabled });
    }
    await saveOptions(entries, `${title} 已保存`);
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className='space-y-4'>
        {showInput ? (
          <Input
            label={inputLabel}
            placeholder={inputPlaceholder}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        ) : null}
        {showSwitch ? (
          <div className='flex items-center justify-between rounded-lg border border-border px-3 py-2'>
            <span className='text-sm'>启用</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        ) : null}
      </CardContent>
      <CardFooter>
        <Button onClick={onSave} loading={saving}>
          保存
        </Button>
      </CardFooter>
    </Card>
  );
}
