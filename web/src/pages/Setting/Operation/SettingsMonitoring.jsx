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

import React, { useEffect, useState, useRef } from 'react';
import { Button, Col, Form, Row, Spin } from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
  parseHttpStatusCodeRules,
  isRoot,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import HttpStatusCodeRulesInput from '../../../components/settings/HttpStatusCodeRulesInput';

const consumeCallbackOptionKeys = new Set([
  'ConsumeCallbackEnabled',
  'ConsumeCallbackUrl',
  'ConsumeCallbackSecret',
  'ConsumeCallbackUserPrefixFilter',
  'ConsumeCallbackRetryTimes',
  'ConsumeCallbackInitialBackoffMs',
  'ConsumeCallbackMaxBackoffMs',
  'ConsumeCallbackWorkerCount',
  'ConsumeCallbackQueueCapacity',
  'CallbackLogMaskSensitiveEnabled',
]);

const normalizeConsumeCallbackUsernamePrefixes = (value) =>
  Array.from(
    new Set(
      String(value || '')
        .split(/[\n,]+/g)
        .map((prefix) => prefix.trim())
        .filter(Boolean),
    ),
  ).join(',');

const defaultInputs = {
  ChannelDisableThreshold: '',
  QuotaRemindThreshold: '',
  AutomaticDisableChannelEnabled: false,
  AutomaticEnableChannelEnabled: false,
  AutomaticDisableKeywords: '',
  AutomaticDisableStatusCodes: '401',
  AutomaticRetryStatusCodes:
    '100-199,300-399,401-407,409-499,500-503,505-523,525-599',
  'monitor_setting.auto_test_channel_enabled': false,
  'monitor_setting.auto_test_channel_minutes': 10,
  ConsumeCallbackEnabled: false,
  ConsumeCallbackUrl: '',
  ConsumeCallbackSecret: '',
  ConsumeCallbackUserPrefixFilter: '',
  ConsumeCallbackRetryTimes: 3,
  ConsumeCallbackInitialBackoffMs: 200,
  ConsumeCallbackMaxBackoffMs: 5000,
  ConsumeCallbackWorkerCount: 2,
  ConsumeCallbackQueueCapacity: 256,
  CallbackLogMaskSensitiveEnabled: false,
};

export default function SettingsMonitoring(props) {
  const { t } = useTranslation();
  const isRootUser = isRoot();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(defaultInputs);
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(defaultInputs);
  const parsedAutoDisableStatusCodes = parseHttpStatusCodeRules(
    inputs.AutomaticDisableStatusCodes || '',
  );
  const parsedAutoRetryStatusCodes = parseHttpStatusCodeRules(
    inputs.AutomaticRetryStatusCodes || '',
  );

  const validateConsumeCallbackConfig = () => {
    if (!inputs.ConsumeCallbackEnabled) {
      return true;
    }
    const callbackUrl = (inputs.ConsumeCallbackUrl || '').trim();
    if (!callbackUrl) {
      showError(t('开启消费回调时，回调 URL 为必填项'));
      return false;
    }
    try {
      const parsedUrl = new URL(callbackUrl);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('invalid protocol');
      }
    } catch {
      showError(t('回调 URL 必须是以 http:// 或 https:// 开头的有效地址'));
      return false;
    }

    const retryTimes = Number(inputs.ConsumeCallbackRetryTimes);
    const initialBackoffMs = Number(inputs.ConsumeCallbackInitialBackoffMs);
    const maxBackoffMs = Number(inputs.ConsumeCallbackMaxBackoffMs);
    const workerCount = Number(inputs.ConsumeCallbackWorkerCount);
    const queueCapacity = Number(inputs.ConsumeCallbackQueueCapacity);

    if (!Number.isFinite(retryTimes) || retryTimes < 0 || retryTimes > 20) {
      showError(t('回调重试次数必须在 0 到 20 之间'));
      return false;
    }
    if (
      !Number.isFinite(initialBackoffMs) ||
      initialBackoffMs < 50 ||
      initialBackoffMs > 600000
    ) {
      showError(t('初始退避毫秒必须在 50 到 600000 之间'));
      return false;
    }
    if (
      !Number.isFinite(maxBackoffMs) ||
      maxBackoffMs < initialBackoffMs ||
      maxBackoffMs > 3600000
    ) {
      showError(t('最大退避毫秒必须大于等于初始退避毫秒，且不超过 3600000'));
      return false;
    }
    if (!Number.isFinite(workerCount) || workerCount < 1 || workerCount > 64) {
      showError(t('回调 Worker 数必须在 1 到 64 之间'));
      return false;
    }
    if (
      !Number.isFinite(queueCapacity) ||
      queueCapacity < 1 ||
      queueCapacity > 20000
    ) {
      showError(t('回调队列容量必须在 1 到 20000 之间'));
      return false;
    }

    return true;
  };

  function onSubmit() {
    const normalizedConsumeCallbackUrl = (inputs.ConsumeCallbackUrl || '').trim();
    const normalizedPreviousConsumeCallbackUrl = (
      inputsRow.ConsumeCallbackUrl || ''
    ).trim();
    const normalizedConsumeCallbackUserPrefixFilter =
      normalizeConsumeCallbackUsernamePrefixes(
        inputs.ConsumeCallbackUserPrefixFilter,
      );
    const normalizedPreviousConsumeCallbackUserPrefixFilter =
      normalizeConsumeCallbackUsernamePrefixes(
        inputsRow.ConsumeCallbackUserPrefixFilter,
      );

    let updateArray = compareObjects(inputs, inputsRow);
    if (!isRootUser) {
      updateArray = updateArray.filter(
        (item) => !consumeCallbackOptionKeys.has(item.key),
      );
    }
    if (
      normalizedConsumeCallbackUrl === normalizedPreviousConsumeCallbackUrl &&
      normalizedConsumeCallbackUrl !== inputs.ConsumeCallbackUrl
    ) {
      updateArray = updateArray.filter((item) => item.key !== 'ConsumeCallbackUrl');
    }
    if (
      normalizedConsumeCallbackUserPrefixFilter ===
      normalizedPreviousConsumeCallbackUserPrefixFilter
    ) {
      updateArray = updateArray.filter(
        (item) => item.key !== 'ConsumeCallbackUserPrefixFilter',
      );
    }

    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const hasConsumeCallbackChanges = updateArray.some((item) =>
      consumeCallbackOptionKeys.has(item.key),
    );
    if (hasConsumeCallbackChanges && !validateConsumeCallbackConfig()) return;
    if (!parsedAutoDisableStatusCodes.ok) {
      const details =
        parsedAutoDisableStatusCodes.invalidTokens &&
        parsedAutoDisableStatusCodes.invalidTokens.length > 0
          ? `: ${parsedAutoDisableStatusCodes.invalidTokens.join(', ')}`
          : '';
      return showError(`${t('自动禁用状态码格式不正确')}${details}`);
    }
    if (!parsedAutoRetryStatusCodes.ok) {
      const details =
        parsedAutoRetryStatusCodes.invalidTokens &&
        parsedAutoRetryStatusCodes.invalidTokens.length > 0
          ? `: ${parsedAutoRetryStatusCodes.invalidTokens.join(', ')}`
          : '';
      return showError(`${t('自动重试状态码格式不正确')}${details}`);
    }
    const requestQueue = updateArray.map((item) => {
      let value = '';
      if (typeof inputs[item.key] === 'boolean') {
        value = String(inputs[item.key]);
      } else {
        const normalizedMap = {
          AutomaticDisableStatusCodes: parsedAutoDisableStatusCodes.normalized,
          AutomaticRetryStatusCodes: parsedAutoRetryStatusCodes.normalized,
          ConsumeCallbackUrl: normalizedConsumeCallbackUrl,
          ConsumeCallbackUserPrefixFilter:
            normalizedConsumeCallbackUserPrefixFilter,
          ConsumeCallbackRetryTimes: String(
            parseInt(inputs.ConsumeCallbackRetryTimes, 10),
          ),
          ConsumeCallbackInitialBackoffMs: String(
            parseInt(inputs.ConsumeCallbackInitialBackoffMs, 10),
          ),
          ConsumeCallbackMaxBackoffMs: String(
            parseInt(inputs.ConsumeCallbackMaxBackoffMs, 10),
          ),
          ConsumeCallbackWorkerCount: String(
            parseInt(inputs.ConsumeCallbackWorkerCount, 10),
          ),
          ConsumeCallbackQueueCapacity: String(
            parseInt(inputs.ConsumeCallbackQueueCapacity, 10),
          ),
        };
        value = normalizedMap[item.key] ?? inputs[item.key];
      }
      return API.put('/api/option/', {
        key: item.key,
        value,
      });
    });
    setLoading(true);
    Promise.all(requestQueue)
      .then((res) => {
        if (requestQueue.length === 1) {
          if (res.includes(undefined)) return;
        } else if (requestQueue.length > 1) {
          if (res.includes(undefined))
            return showError(t('部分保存失败，请重试'));
        }
        showSuccess(t('保存成功'));
        props.refresh();
      })
      .catch(() => {
        showError(t('保存失败，请重试'));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    const currentInputs = structuredClone(defaultInputs);
    for (let key in props.options) {
      if (Object.keys(defaultInputs).includes(key)) {
        currentInputs[key] = props.options[key];
      }
    }
    // Secret 只写不回显，每次加载后清空输入框，避免暴露已保存值
    currentInputs.ConsumeCallbackSecret = '';
    currentInputs.ConsumeCallbackUserPrefixFilter =
      normalizeConsumeCallbackUsernamePrefixes(
        currentInputs.ConsumeCallbackUserPrefixFilter,
      );
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    refForm.current?.setValues(currentInputs);
  }, [props.options]);

  return (
    <>
      <Spin spinning={loading}>
        <Form
          values={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
          style={{ marginBottom: 15 }}
        >
          <Form.Section text={t('监控设置')}>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'monitor_setting.auto_test_channel_enabled'}
                  label={t('定时测试所有通道')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      'monitor_setting.auto_test_channel_enabled': value,
                    })
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  label={t('自动测试所有通道间隔时间')}
                  step={1}
                  min={1}
                  suffix={t('分钟')}
                  extraText={t('每隔多少分钟测试一次所有通道')}
                  placeholder={''}
                  field={'monitor_setting.auto_test_channel_minutes'}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      'monitor_setting.auto_test_channel_minutes':
                        parseInt(value),
                    })
                  }
                />
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  label={t('测试所有渠道的最长响应时间')}
                  step={1}
                  min={0}
                  suffix={t('秒')}
                  extraText={t(
                    '当运行通道全部测试时，超过此时间将自动禁用通道',
                  )}
                  placeholder={''}
                  field={'ChannelDisableThreshold'}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      ChannelDisableThreshold: String(value),
                    })
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.InputNumber
                  label={t('额度提醒阈值')}
                  step={1}
                  min={0}
                  suffix={'Token'}
                  extraText={t('低于此额度时将发送邮件提醒用户')}
                  placeholder={''}
                  field={'QuotaRemindThreshold'}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      QuotaRemindThreshold: String(value),
                    })
                  }
                />
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'AutomaticDisableChannelEnabled'}
                  label={t('失败时自动禁用通道')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={(value) => {
                    setInputs({
                      ...inputs,
                      AutomaticDisableChannelEnabled: value,
                    });
                  }}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Switch
                  field={'AutomaticEnableChannelEnabled'}
                  label={t('成功时自动启用通道')}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      AutomaticEnableChannelEnabled: value,
                    })
                  }
                />
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={16}>
                <HttpStatusCodeRulesInput
                  label={t('自动禁用状态码')}
                  placeholder={t('例如：401, 403, 429, 500-599')}
                  extraText={t(
                    '支持填写单个状态码或范围（含首尾），使用逗号分隔',
                  )}
                  field={'AutomaticDisableStatusCodes'}
                  onChange={(value) =>
                    setInputs({ ...inputs, AutomaticDisableStatusCodes: value })
                  }
                  parsed={parsedAutoDisableStatusCodes}
                  invalidText={t('自动禁用状态码格式不正确')}
                />
                <HttpStatusCodeRulesInput
                  label={t('自动重试状态码')}
                  placeholder={t('例如：401, 403, 429, 500-599')}
                  extraText={t(
                    '支持填写单个状态码或范围（含首尾），使用逗号分隔；504 和 524 始终不重试，不受此处配置影响',
                  )}
                  field={'AutomaticRetryStatusCodes'}
                  onChange={(value) =>
                    setInputs({ ...inputs, AutomaticRetryStatusCodes: value })
                  }
                  parsed={parsedAutoRetryStatusCodes}
                  invalidText={t('自动重试状态码格式不正确')}
                />
                <Form.TextArea
                  label={t('自动禁用关键词')}
                  placeholder={t('一行一个，不区分大小写')}
                  extraText={t(
                    '当上游通道返回错误中包含这些关键词时（不区分大小写），自动禁用通道',
                  )}
                  field={'AutomaticDisableKeywords'}
                  autosize={{ minRows: 6, maxRows: 12 }}
                  onChange={(value) =>
                    setInputs({ ...inputs, AutomaticDisableKeywords: value })
                  }
                />
              </Col>
            </Row>
            {isRootUser && (
              <>
                <Row gutter={16}>
                  <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                    <Form.Switch
                      field={'ConsumeCallbackEnabled'}
                      label={t('启用消费回调')}
                      extraText={t(
                        '仅用于 openai/anthropic/responses 三类端点的消费结算事件；开启后会异步推送到你配置的回调地址（可用于告警系统或工单系统）',
                      )}
                      size='default'
                      checkedText='｜'
                      uncheckedText='〇'
                      onChange={(value) =>
                        setInputs({
                          ...inputs,
                          ConsumeCallbackEnabled: value,
                        })
                      }
                    />
                  </Col>
                  <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                    <Form.Input
                      field={'ConsumeCallbackUrl'}
                      label={t('回调 URL')}
                      placeholder={t(
                        '例如：https://ops.example.com/new-api/consume',
                      )}
                      extraText={t(
                        '开启消费回调时必填，仅支持 http:// 或 https://',
                      )}
                      onChange={(value) =>
                        setInputs({
                          ...inputs,
                          ConsumeCallbackUrl: value,
                        })
                      }
                      showClear
                    />
                  </Col>
                  <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                    <Form.Input
                      field={'ConsumeCallbackSecret'}
                      label={t('回调 Secret')}
                      placeholder={t(
                        '用于签名校验；留空表示不修改，且已保存值不会回显',
                      )}
                      type='password'
                      onChange={(value) =>
                        setInputs({
                          ...inputs,
                          ConsumeCallbackSecret: value,
                        })
                      }
                      showClear
                    />
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24}>
                    <Form.TextArea
                      field={'ConsumeCallbackUserPrefixFilter'}
                      label={t('用户名前缀列表')}
                      placeholder={t(
                        '例如：vip_,test-\n也可换行输入：\nvip_\ntest-',
                      )}
                      extraText={t(
                        '仅匹配这些前缀的用户名才推送；多个前缀可用逗号或换行分隔，区分大小写，留空表示全部用户',
                      )}
                      autosize={{ minRows: 3, maxRows: 6 }}
                      onChange={(value) =>
                        setInputs({
                          ...inputs,
                          ConsumeCallbackUserPrefixFilter: value,
                        })
                      }
                    />
                  </Col>
                  <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                    <Form.Switch
                      field={'CallbackLogMaskSensitiveEnabled'}
                      label={t('回调日志敏感信息脱敏')}
                      extraText={t(
                        '关闭后将显示完整 URL、错误与请求内容；建议仅在内部环境使用',
                      )}
                      size='default'
                      checkedText='｜'
                      uncheckedText='〇'
                      onChange={(value) =>
                        setInputs({
                          ...inputs,
                          CallbackLogMaskSensitiveEnabled: value,
                        })
                      }
                    />
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                    <Form.InputNumber
                      field={'ConsumeCallbackRetryTimes'}
                      label={t('回调重试次数')}
                      min={0}
                      max={20}
                      step={1}
                      extraText={t('异步推送失败后的最大重试次数（默认 3）')}
                      onChange={(value) =>
                        setInputs({
                          ...inputs,
                          ConsumeCallbackRetryTimes: parseInt(value, 10),
                        })
                      }
                    />
                  </Col>
                  <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                    <Form.InputNumber
                      field={'ConsumeCallbackInitialBackoffMs'}
                      label={t('初始退避毫秒')}
                      min={50}
                      max={600000}
                      step={50}
                      extraText={t('首次重试前等待时长（毫秒）')}
                      onChange={(value) =>
                        setInputs({
                          ...inputs,
                          ConsumeCallbackInitialBackoffMs: parseInt(value, 10),
                        })
                      }
                    />
                  </Col>
                  <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                    <Form.InputNumber
                      field={'ConsumeCallbackMaxBackoffMs'}
                      label={t('最大退避毫秒')}
                      min={50}
                      max={3600000}
                      step={100}
                      extraText={t('指数退避等待上限（毫秒）')}
                      onChange={(value) =>
                        setInputs({
                          ...inputs,
                          ConsumeCallbackMaxBackoffMs: parseInt(value, 10),
                        })
                      }
                    />
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                    <Form.InputNumber
                      field={'ConsumeCallbackWorkerCount'}
                      label={t('回调 Worker 数')}
                      min={1}
                      max={64}
                      step={1}
                      extraText={t(
                        '并发处理回调事件的 Worker 数量（修改后需重启服务生效）',
                      )}
                      onChange={(value) =>
                        setInputs({
                          ...inputs,
                          ConsumeCallbackWorkerCount: parseInt(value, 10),
                        })
                      }
                    />
                  </Col>
                  <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                    <Form.InputNumber
                      field={'ConsumeCallbackQueueCapacity'}
                      label={t('回调队列容量')}
                      min={1}
                      max={20000}
                      step={1}
                      extraText={t(
                        '本地分发队列容量，队列越大占用内存越高（修改后需重启服务生效）',
                      )}
                      onChange={(value) =>
                        setInputs({
                          ...inputs,
                          ConsumeCallbackQueueCapacity: parseInt(value, 10),
                        })
                      }
                    />
                  </Col>
                </Row>
              </>
            )}
            <Row>
              <Button size='default' onClick={onSubmit}>
                {t('保存监控设置')}
              </Button>
            </Row>
          </Form.Section>
        </Form>
      </Spin>
    </>
  );
}
