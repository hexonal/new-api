import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../primitives/card';
import { Button } from '../../primitives/button';

export default function ActionCard({
  title,
  description,
  optionKey,
  optionValue,
  saveOptions,
  buttonText = '执行并保存',
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setSaving(true);
    await saveOptions(
      [{ key: optionKey, value: optionValue ?? String(Date.now()) }],
      `${title} ${t('已执行')}`,
    );
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <p className='text-sm text-muted-foreground'>
          {t('该操作会通过配置写入触发后端处理流程。')}
        </p>
      </CardContent>
      <CardFooter>
        <Button onClick={onSave} loading={saving}>
          {buttonText}
        </Button>
      </CardFooter>
    </Card>
  );
}
