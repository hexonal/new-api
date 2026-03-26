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
import {
  Button,
  Form,
  Row,
  Col,
  Typography,
  Spin,
  Collapsible,
  Space,
  InputNumber,
  Switch as SemiSwitch,
  Input,
  Select,
  Popconfirm,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete } from '@douyinfe/semi-icons';
const { Text } = Typography;
import {
  API,
  removeTrailingSlash,
  showError,
  showSuccess,
  verifyJSON,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsPaymentGateway(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    PayAddress: '',
    EpayId: '',
    EpayKey: '',
    Price: 7.3,
    MinTopUp: 1,
    TopupGroupRatio: '',
    CustomCallbackAddress: '',
    PayMethods: '',
    AmountOptions: '',
    AmountDiscount: '',
    UserPointsEnabled: false,
    UserPointsQueryUrl: '',
    UserPointsUsernamePrefixFilter: '',
    UserPointsCanPreDeductJsonpath: 'data.can_pre_deduct',
    UserPointsOnErrorDecision: 'allow',
    UserPointsRechargeUrl: '',
    UserPointsInsufficientMessage: '',
    ImaProMinBalanceGateEnabled: false,
    ImaProMinBalanceUsdThreshold: 10,
  });
  const [originInputs, setOriginInputs] = useState({});
  const [routingRules, setRoutingRules] = useState([]);
  const [originRoutingRules, setOriginRoutingRules] = useState([]);
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        PayAddress: props.options.PayAddress || '',
        EpayId: props.options.EpayId || '',
        EpayKey: props.options.EpayKey || '',
        Price:
          props.options.Price !== undefined
            ? parseFloat(props.options.Price)
            : 7.3,
        MinTopUp:
          props.options.MinTopUp !== undefined
            ? parseFloat(props.options.MinTopUp)
            : 1,
        TopupGroupRatio: props.options.TopupGroupRatio || '',
        CustomCallbackAddress: props.options.CustomCallbackAddress || '',
        PayMethods: props.options.PayMethods || '',
        AmountOptions: props.options.AmountOptions || '',
        AmountDiscount: props.options.AmountDiscount || '',
        UserPointsEnabled: !!props.options.UserPointsEnabled,
        UserPointsQueryUrl: props.options.UserPointsQueryUrl || '',
        UserPointsUsernamePrefixFilter:
          props.options.UserPointsUsernamePrefixFilter || '',
        UserPointsCanPreDeductJsonpath:
          props.options.UserPointsCanPreDeductJsonpath ||
          'data.can_pre_deduct',
        UserPointsOnErrorDecision:
          props.options.UserPointsOnErrorDecision || 'allow',
        UserPointsRechargeUrl: props.options.UserPointsRechargeUrl || '',
        UserPointsInsufficientMessage:
          props.options.UserPointsInsufficientMessage || '',
        ImaProMinBalanceGateEnabled: !!props.options.ImaProMinBalanceGateEnabled,
        ImaProMinBalanceUsdThreshold:
          props.options.ImaProMinBalanceUsdThreshold !== undefined
            ? Number(props.options.ImaProMinBalanceUsdThreshold)
            : 10,
      };
      const currentRoutingRules = Array.isArray(
        props.options.UserPointsRoutingRules,
      )
        ? props.options.UserPointsRoutingRules
        : [];
      const normalizedRoutingRules = currentRoutingRules.map((rule) => ({
        ...rule,
        match_by: rule.match_by || 'username',
      }));

      // 美化 JSON 展示
      try {
        if (currentInputs.AmountOptions) {
          currentInputs.AmountOptions = JSON.stringify(
            JSON.parse(currentInputs.AmountOptions),
            null,
            2,
          );
        }
      } catch {}
      try {
        if (currentInputs.AmountDiscount) {
          currentInputs.AmountDiscount = JSON.stringify(
            JSON.parse(currentInputs.AmountDiscount),
            null,
            2,
          );
        }
      } catch {}

      setInputs(currentInputs);
      setOriginInputs({ ...currentInputs });
      setRoutingRules(normalizedRoutingRules);
      setOriginRoutingRules(structuredClone(normalizedRoutingRules));
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const addRoutingRule = () => {
    setRoutingRules([
      ...routingRules,
      {
        name: '',
        enabled: true,
        match_by: 'username',
        prefix_pattern: '',
        query_url: '',
        recharge_url: '',
        insufficient_message: '',
        priority: 0,
      },
    ]);
  };

  const updateRoutingRule = (index, key, value) => {
    setRoutingRules((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  };

  const removeRoutingRule = (index) => {
    setRoutingRules((prev) => prev.filter((_, i) => i !== index));
  };

  const submitPayAddress = async () => {
    if (props.options.ServerAddress === '') {
      showError(t('请先填写服务器地址'));
      return;
    }

    if (originInputs['TopupGroupRatio'] !== inputs.TopupGroupRatio) {
      if (!verifyJSON(inputs.TopupGroupRatio)) {
        showError(t('充值分组倍率不是合法的 JSON 字符串'));
        return;
      }
    }

    if (originInputs['PayMethods'] !== inputs.PayMethods) {
      if (!verifyJSON(inputs.PayMethods)) {
        showError(t('充值方式设置不是合法的 JSON 字符串'));
        return;
      }
    }

    if (
      originInputs['AmountOptions'] !== inputs.AmountOptions &&
      inputs.AmountOptions.trim() !== ''
    ) {
      if (!verifyJSON(inputs.AmountOptions)) {
        showError(t('自定义充值数量选项不是合法的 JSON 数组'));
        return;
      }
    }

    if (
      originInputs['AmountDiscount'] !== inputs.AmountDiscount &&
      inputs.AmountDiscount.trim() !== ''
    ) {
      if (!verifyJSON(inputs.AmountDiscount)) {
        showError(t('充值金额折扣配置不是合法的 JSON 对象'));
        return;
      }
    }
    if (
      inputs.UserPointsEnabled &&
      (inputs.UserPointsQueryUrl || '').trim() === ''
    ) {
      showError(t('请填写 user_points 查询 URL'));
      return;
    }
    if (
      inputs.UserPointsEnabled &&
      (inputs.UserPointsCanPreDeductJsonpath || '').trim() === ''
    ) {
      showError(t('请填写 can_pre_deduct 路径（如 data.can_pre_deduct 或 $.data.can_pre_deduct）'));
      return;
    }
    if (
      inputs.UserPointsEnabled &&
      (inputs.UserPointsOnErrorDecision || '').trim() === ''
    ) {
      showError(t('请选择 user_points 异常时处理策略'));
      return;
    }
    if (
      inputs.UserPointsEnabled &&
      (inputs.UserPointsInsufficientMessage || '').includes('{recharge_url}') &&
      (inputs.UserPointsRechargeUrl || '').trim() === ''
    ) {
      showError(t('文案使用了 {recharge_url}，请同时填写充值链接 URL'));
      return;
    }
    if (
      inputs.ImaProMinBalanceGateEnabled &&
      Number(inputs.ImaProMinBalanceUsdThreshold) <= 0
    ) {
      showError(t('请填写 ima-pro 最低余额门槛（USD > 0）'));
      return;
    }
    for (let i = 0; i < routingRules.length; i++) {
      const rule = routingRules[i];
      const ruleName = (rule.name || '').trim() || `${i + 1}`;
      if (rule.enabled && (rule.prefix_pattern || '').trim() === '') {
        const matchByLabel =
          (rule.match_by || 'username') === 'token_prefix'
            ? t('Token 前缀')
            : t('用户名前缀');
        showError(
          t('规则 {{name}} 已启用，请填写{{matchByLabel}}', {
            name: ruleName,
            matchByLabel,
          }),
        );
        return;
      }
      if (rule.enabled && (rule.query_url || '').trim() === '') {
        showError(
          t('规则 {{name}} 已启用，请填写查询 URL', {
            name: ruleName,
          }),
        );
        return;
      }
      if (
        (rule.insufficient_message || '').includes('{recharge_url}') &&
        (rule.recharge_url || '').trim() === ''
      ) {
        showError(
          t('规则 {{name}} 文案使用了 {recharge_url}，请同时填写充值链接 URL', {
            name: ruleName,
          }),
        );
        return;
      }
    }

    setLoading(true);
    try {
      const options = [
        { key: 'PayAddress', value: removeTrailingSlash(inputs.PayAddress) },
      ];

      if (inputs.EpayId !== '') {
        options.push({ key: 'EpayId', value: inputs.EpayId });
      }
      if (inputs.EpayKey !== undefined && inputs.EpayKey !== '') {
        options.push({ key: 'EpayKey', value: inputs.EpayKey });
      }
      if (inputs.Price !== '') {
        options.push({ key: 'Price', value: inputs.Price.toString() });
      }
      if (inputs.MinTopUp !== '') {
        options.push({ key: 'MinTopUp', value: inputs.MinTopUp.toString() });
      }
      if (inputs.CustomCallbackAddress !== '') {
        options.push({
          key: 'CustomCallbackAddress',
          value: inputs.CustomCallbackAddress,
        });
      }
      if (originInputs['TopupGroupRatio'] !== inputs.TopupGroupRatio) {
        options.push({ key: 'TopupGroupRatio', value: inputs.TopupGroupRatio });
      }
      if (originInputs['PayMethods'] !== inputs.PayMethods) {
        options.push({ key: 'PayMethods', value: inputs.PayMethods });
      }
      if (originInputs['AmountOptions'] !== inputs.AmountOptions) {
        options.push({
          key: 'payment_setting.amount_options',
          value: inputs.AmountOptions,
        });
      }
      if (originInputs['AmountDiscount'] !== inputs.AmountDiscount) {
        options.push({
          key: 'payment_setting.amount_discount',
          value: inputs.AmountDiscount,
        });
      }
      if (originInputs['UserPointsEnabled'] !== inputs.UserPointsEnabled) {
        options.push({
          key: 'payment_setting.user_points_enabled',
          value: inputs.UserPointsEnabled ? 'true' : 'false',
        });
      }
      if (originInputs['UserPointsQueryUrl'] !== inputs.UserPointsQueryUrl) {
        options.push({
          key: 'payment_setting.user_points_query_url',
          value: inputs.UserPointsQueryUrl,
        });
      }
      if (
        originInputs['UserPointsUsernamePrefixFilter'] !==
        inputs.UserPointsUsernamePrefixFilter
      ) {
        options.push({
          key: 'payment_setting.user_points_username_prefix_filter',
          value: inputs.UserPointsUsernamePrefixFilter,
        });
      }
      if (
        originInputs['UserPointsCanPreDeductJsonpath'] !==
        inputs.UserPointsCanPreDeductJsonpath
      ) {
        options.push({
          key: 'payment_setting.user_points_can_pre_deduct_jsonpath',
          value: inputs.UserPointsCanPreDeductJsonpath,
        });
      }
      if (
        originInputs['UserPointsOnErrorDecision'] !==
        inputs.UserPointsOnErrorDecision
      ) {
        options.push({
          key: 'payment_setting.user_points_on_error_decision',
          value: inputs.UserPointsOnErrorDecision,
        });
      }
      if (
        originInputs['UserPointsRechargeUrl'] !== inputs.UserPointsRechargeUrl
      ) {
        options.push({
          key: 'payment_setting.user_points_recharge_url',
          value: inputs.UserPointsRechargeUrl,
        });
      }
      if (
        originInputs['UserPointsInsufficientMessage'] !==
        inputs.UserPointsInsufficientMessage
      ) {
        options.push({
          key: 'payment_setting.user_points_insufficient_message',
          value: inputs.UserPointsInsufficientMessage,
        });
      }
      if (
        originInputs['ImaProMinBalanceGateEnabled'] !==
        inputs.ImaProMinBalanceGateEnabled
      ) {
        options.push({
          key: 'payment_setting.ima_pro_min_balance_gate_enabled',
          value: inputs.ImaProMinBalanceGateEnabled ? 'true' : 'false',
        });
      }
      if (
        originInputs['ImaProMinBalanceUsdThreshold'] !==
        inputs.ImaProMinBalanceUsdThreshold
      ) {
        options.push({
          key: 'payment_setting.ima_pro_min_balance_usd_threshold',
          value: String(inputs.ImaProMinBalanceUsdThreshold),
        });
      }
      if (
        JSON.stringify(originRoutingRules) !== JSON.stringify(routingRules)
      ) {
        options.push({
          key: 'payment_setting.user_points_routing_rules',
          value: JSON.stringify(routingRules),
        });
      }

      // 发送请求
      const requestQueue = options.map((opt) =>
        API.put('/api/option/', {
          key: opt.key,
          value: opt.value,
        }),
      );

      const results = await Promise.all(requestQueue);

      // 检查所有请求是否成功
      const errorResults = results.filter((res) => !res.data.success);
      if (errorResults.length > 0) {
        errorResults.forEach((res) => {
          showError(res.data.message);
        });
      } else {
        showSuccess(t('更新成功'));
        // 更新本地存储的原始值
        setOriginInputs({ ...inputs });
        setOriginRoutingRules(structuredClone(routingRules));
        props.refresh && props.refresh();
      }
    } catch (error) {
      showError(t('更新失败'));
    }
    setLoading(false);
  };

  return (
    <Spin spinning={loading}>
      <Form
        initValues={inputs}
        onValueChange={handleFormChange}
        getFormApi={(api) => (formApiRef.current = api)}
      >
        <Form.Section text={t('支付设置')}>
          <Text>
            {t(
              '（当前仅支持易支付接口，默认使用上方服务器地址作为回调地址！）',
            )}
          </Text>
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='PayAddress'
                label={t('支付地址')}
                placeholder={t('例如：https://yourdomain.com')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='EpayId'
                label={t('易支付商户ID')}
                placeholder={t('例如：0001')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='EpayKey'
                label={t('易支付商户密钥')}
                placeholder={t('敏感信息不会发送到前端显示')}
                type='password'
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='CustomCallbackAddress'
                label={t('回调地址')}
                placeholder={t('例如：https://yourdomain.com')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='Price'
                precision={2}
                label={t('充值价格（x元/美金）')}
                placeholder={t('例如：7，就是7元/美金')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='MinTopUp'
                label={t('最低充值美元数量')}
                placeholder={t('例如：2，就是最低充值2$')}
              />
            </Col>
          </Row>
          <Form.TextArea
            field='TopupGroupRatio'
            label={t('充值分组倍率')}
            placeholder={t('为一个 JSON 文本，键为组名称，值为倍率')}
            autosize
          />
          <Form.TextArea
            field='PayMethods'
            label={t('充值方式设置')}
            placeholder={t('为一个 JSON 文本')}
            autosize
          />

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col span={24}>
              <Form.TextArea
                field='AmountOptions'
                label={t('自定义充值数量选项')}
                placeholder={t(
                  '为一个 JSON 数组，例如：[10, 20, 50, 100, 200, 500]',
                )}
                autosize
                extraText={t(
                  '设置用户可选择的充值数量选项，例如：[10, 20, 50, 100, 200, 500]',
                )}
              />
            </Col>
          </Row>

          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col span={24}>
              <Form.TextArea
                field='AmountDiscount'
                label={t('充值金额折扣配置')}
                placeholder={t(
                  '为一个 JSON 对象，例如：{"100": 0.95, "200": 0.9, "500": 0.85}',
                )}
                autosize
                extraText={t(
                  '设置不同充值金额对应的折扣，键为充值金额，值为折扣率，例如：{"100": 0.95, "200": 0.9, "500": 0.85}',
                )}
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col span={24}>
              <Text strong>{t('User Points 预扣校验（可选）')}</Text>
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 12 }}
          >
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Switch
                field='UserPointsEnabled'
                size='default'
                checkedText='｜'
                uncheckedText='〇'
                label={t('启用 user_points 预扣校验')}
                extraText={t('仅匹配用户名前缀的 token 生效')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Select
                field='UserPointsOnErrorDecision'
                label={t('快速失败策略')}
                optionList={[
                  {
                    label: t('异常时优先通过（fail-open）'),
                    value: 'allow',
                  },
                  {
                    label: t('异常时优先拒绝（fail-close）'),
                    value: 'deny',
                  },
                ]}
                extraText={t(
                  '仅对 user_points 请求失败、路径不存在或值非布尔等异常生效；若结果为 false，仍会直接拦截',
                )}
                placeholder={t('请选择异常处理策略')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='UserPointsQueryUrl'
                label={t('user_points 查询 URL')}
                placeholder={t(
                  '例如：https://example.com/api/v1/user_points?sk={sk}',
                )}
                extraText={t(
                  '支持 {sk} 占位符；不写占位符时将自动追加 ?sk=... 参数',
                )}
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='UserPointsCanPreDeductJsonpath'
                label={t('can_pre_deduct JSONPath')}
                placeholder={t('例如：$.data.can_pre_deduct 或 data.can_pre_deduct')}
                extraText={t(
                  '使用 JSONPath 风格（内部按 gjson 解析）；仅当解析值为 true 才放行。false 会直接拦截；路径不存在或值非布尔时按异常策略处理',
                )}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.TextArea
                field='UserPointsUsernamePrefixFilter'
                label={t('用户名前缀过滤')}
                placeholder={t('例如：ima_,\nteam_')}
                autosize
                extraText={t('支持逗号或换行分隔；仅命中前缀的用户名会触发校验')}
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='UserPointsRechargeUrl'
                label={t('额度不足充值 URL（可选）')}
                placeholder={t('例如：https://example.com/topup')}
                extraText={t(
                  '当预扣校验返回不可扣减时，用于引导用户充值；可与文案占位符联动',
                )}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.TextArea
                field='UserPointsInsufficientMessage'
                label={t('额度不足提示文案（可选）')}
                placeholder={t(
                  '例如：Insufficient quota. Please recharge at {recharge_url}',
                )}
                autosize
                extraText={t(
                  '默认英文为 Insufficient quota；支持 {recharge_url} 占位符',
                )}
              />
            </Col>
          </Row>
          <Row
            gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}
            style={{ marginTop: 16 }}
          >
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Switch
                field='ImaProMinBalanceGateEnabled'
                size='default'
                checkedText='｜'
                uncheckedText='〇'
                label={t('启用 ima-pro 最低余额门槛')}
                extraText={t('仅对 ima-pro 生效')}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='ImaProMinBalanceUsdThreshold'
                precision={2}
                min={0}
                label={t('ima-pro 最低余额门槛（USD）')}
                placeholder={t('例如：10')}
                extraText={t(
                  '启用后仅当余额大于等于该美元门槛时才允许提交；默认 10',
                )}
              />
            </Col>
          </Row>
          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Space>
                <Text strong>{t('User Points 路由规则（按用户名或 Token 前缀）')}</Text>
                <Button
                  icon={<IconPlus />}
                  theme='light'
                  onClick={addRoutingRule}
                >
                  {t('新增规则')}
                </Button>
              </Space>
            </Col>
          </Row>
          <Row style={{ marginTop: 12 }}>
            <Col span={24}>
              <Text>{t('查看/编辑规则')}</Text>
              <Collapsible isOpen keepDOM>
                <Space vertical style={{ width: '100%' }}>
                  {routingRules.map((rule, index) => (
                    <div
                      key={`rule-${index}`}
                      style={{
                        border: '1px solid var(--semi-color-border)',
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <Row gutter={12}>
                        <Col xs={24} sm={8} md={8} lg={8} xl={8}>
                          <Input
                            value={rule.name || ''}
                            placeholder={t('规则名称')}
                            onChange={(v) => updateRoutingRule(index, 'name', v)}
                          />
                        </Col>
                        <Col xs={12} sm={4} md={4} lg={4} xl={4}>
                          <SemiSwitch
                            checked={!!rule.enabled}
                            checkedText='｜'
                            uncheckedText='〇'
                            onChange={(v) =>
                              updateRoutingRule(index, 'enabled', !!v)
                            }
                          />
                        </Col>
                        <Col xs={12} sm={4} md={4} lg={4} xl={4}>
                          <InputNumber
                            value={rule.priority ?? 0}
                            min={-9999}
                            max={9999}
                            onChange={(v) =>
                              updateRoutingRule(index, 'priority', v ?? 0)
                            }
                          />
                        </Col>
                        <Col xs={24} sm={8} md={8} lg={8} xl={8}>
                          <Popconfirm
                            title={t('确认删除该规则吗？')}
                            onConfirm={() => removeRoutingRule(index)}
                          >
                            <Button
                              icon={<IconDelete />}
                              theme='borderless'
                              type='danger'
                            >
                              {t('删除')}
                            </Button>
                          </Popconfirm>
                        </Col>
                      </Row>
                      <Row gutter={12} style={{ marginTop: 10 }}>
                        <Col xs={24} sm={8} md={8} lg={8} xl={8}>
                          <Select
                            value={rule.match_by || 'username'}
                            placeholder={t('匹配维度')}
                            optionList={[
                              { label: t('按用户名前缀'), value: 'username' },
                              { label: t('按 Token 前缀'), value: 'token_prefix' },
                            ]}
                            onChange={(v) =>
                              updateRoutingRule(index, 'match_by', v || 'username')
                            }
                          />
                        </Col>
                      </Row>
                      <Row gutter={12} style={{ marginTop: 10 }}>
                        <Col span={24}>
                          <Input
                            value={rule.prefix_pattern || ''}
                            placeholder={
                              (rule.match_by || 'username') === 'token_prefix'
                                ? t('前缀模式，例如：ima_,sk-ima_')
                                : t('前缀模式，例如：ima_,vip_')
                            }
                            onChange={(v) =>
                              updateRoutingRule(index, 'prefix_pattern', v)
                            }
                          />
                        </Col>
                      </Row>
                      <Row gutter={12} style={{ marginTop: 10 }}>
                        <Col xs={24} sm={12} md={12} lg={12} xl={12}>
                          <Input
                            value={rule.query_url || ''}
                            placeholder={t('查询 URL')}
                            onChange={(v) =>
                              updateRoutingRule(index, 'query_url', v)
                            }
                          />
                        </Col>
                        <Col xs={24} sm={12} md={12} lg={12} xl={12}>
                          <Input
                            value={rule.recharge_url || ''}
                            placeholder={t('充值 URL（可选）')}
                            onChange={(v) =>
                              updateRoutingRule(index, 'recharge_url', v)
                            }
                          />
                        </Col>
                      </Row>
                      <Row gutter={12} style={{ marginTop: 10 }}>
                        <Col span={24}>
                          <Input
                            value={rule.insufficient_message || ''}
                            placeholder={t('额度不足文案（可选，支持 {recharge_url}）')}
                            onChange={(v) =>
                              updateRoutingRule(
                                index,
                                'insufficient_message',
                                v,
                              )
                            }
                          />
                        </Col>
                      </Row>
                    </div>
                  ))}
                </Space>
              </Collapsible>
            </Col>
          </Row>

          <Button onClick={submitPayAddress}>{t('更新支付设置')}</Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
