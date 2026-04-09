import React, { useEffect, useState } from 'react';
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
import { Table, Tbody, Td, Th, Thead, Tr } from '../../primitives/table';
import useSettingsOptions, { parseBoolean, parseString } from './useSettingsOptions';

const MODEL_KEYS = ['gpt-4o', 'claude-3-7-sonnet', 'gemini-2.5-pro', 'grok-3'];

export default function RateLimitTab() {
  const { options, saveOptions } = useSettingsOptions();
  const [globalRpm, setGlobalRpm] = useState('');
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [modelRpm, setModelRpm] = useState({});
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingModel, setSavingModel] = useState('');

  useEffect(() => {
    setGlobalRpm(parseString(options['aurora.rate_limit.global.value'], ''));
    setGlobalEnabled(parseBoolean(options['aurora.rate_limit.global.enabled'], false));

    const nextModelRpm = {};
    MODEL_KEYS.forEach((model) => {
      nextModelRpm[model] = parseString(options[`aurora.rate_limit.model.${model}`], '');
    });
    setModelRpm(nextModelRpm);
  }, [options]);

  const saveGlobal = async () => {
    setSavingGlobal(true);
    await saveOptions(
      [
        { key: 'aurora.rate_limit.global.value', value: globalRpm },
        { key: 'aurora.rate_limit.global.enabled', value: globalEnabled },
      ],
      '全局限速已保存',
    );
    setSavingGlobal(false);
  };

  const saveModel = async (model) => {
    setSavingModel(model);
    await saveOptions(
      [{ key: `aurora.rate_limit.model.${model}`, value: modelRpm[model] || '' }],
      `${model} 限速已保存`,
    );
    setSavingModel('');
  };

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle>全局限速</CardTitle>
          <CardDescription>统一限制所有模型的请求速率。</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <Input
            label='RPM'
            placeholder='例如 3000'
            value={globalRpm}
            onChange={(event) => setGlobalRpm(event.target.value)}
          />
          <div className='flex items-center justify-between rounded-lg border border-border px-3 py-2'>
            <span className='text-sm'>启用全局限速</span>
            <Switch checked={globalEnabled} onCheckedChange={setGlobalEnabled} />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={saveGlobal} loading={savingGlobal}>
            保存
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-Model</CardTitle>
          <CardDescription>按模型定义独立限速策略。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <Thead>
              <Tr>
                <Th>Model</Th>
                <Th>RPM</Th>
                <Th className='text-right'>Action</Th>
              </Tr>
            </Thead>
            <Tbody>
              {MODEL_KEYS.map((model) => (
                <Tr key={model}>
                  <Td>{model}</Td>
                  <Td>
                    <Input
                      placeholder='输入 RPM'
                      value={modelRpm[model] || ''}
                      onChange={(event) =>
                        setModelRpm((prev) => ({ ...prev, [model]: event.target.value }))
                      }
                    />
                  </Td>
                  <Td className='text-right'>
                    <Button
                      size='sm'
                      onClick={() => saveModel(model)}
                      loading={savingModel === model}
                    >
                      保存
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
