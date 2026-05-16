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

import React, { useState, useEffect, useRef, useMemo } from 'react';
import JSONEditor from '../../../common/ui/JSONEditor';
import {
  Banner,
  SideSheet,
  Form,
  Button,
  Space,
  Spin,
  Typography,
  Card,
  Tag,
  Avatar,
  Col,
  Row,
} from '@douyinfe/semi-ui';
import { Save, X, FileText, DollarSign } from 'lucide-react';
import { IconAlertTriangle, IconLink } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../../helpers';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const { Text, Title } = Typography;

// Example endpoint template for quick fill
const ENDPOINT_TEMPLATE = {
  chat: {
    path: '/v1/chat/completions',
    method: 'POST',
    provider_style: 'openai-chat',
    async: false,
    parameters: {},
  },
  text_to_image: {
    path: '/v1/images/generations',
    method: 'POST',
    provider_style: 'openai-image',
    async: false,
    parameters: {},
  },
  image_to_image: {
    path: '/v1/images/edits',
    method: 'POST',
    provider_style: 'openai-image',
    async: false,
    parameters: {},
  },
  text_to_video: {
    path: '/v1/videos',
    method: 'POST',
    provider_style: 'openai-video',
    async: true,
    parameters: {},
  },
  image_to_video: {
    path: '/v1/videos',
    method: 'POST',
    provider_style: 'openai-video',
    async: true,
    parameters: {},
  },
  embeddings: {
    path: '/v1/embeddings',
    method: 'POST',
    provider_style: 'openai',
    async: false,
    parameters: {},
  },
};

const CAPABILITY_ENDPOINT_TEMPLATE = {
  chat: { path: '/v1/chat/completions', method: 'POST' },
  text_to_image: { path: '/v1/images/generations', method: 'POST' },
  image_to_image: { path: '/v1/images/edits', method: 'POST' },
  speech_to_text: { path: '/v1/audio/transcriptions', method: 'POST' },
  text_to_speech: { path: '/v1/audio/speech', method: 'POST' },
  audio_translation: { path: '/v1/audio/translations', method: 'POST' },
  embeddings: { path: '/v1/embeddings', method: 'POST' },
  text_to_video: { path: '/v1/videos', method: 'POST' },
  image_to_video: { path: '/v1/videos', method: 'POST' },
  rerank: { path: '/v1/rerank', method: 'POST' },
  music_generation: { path: '/suno/submit/MUSIC', method: 'POST' },
  realtime: { path: '/v1/realtime', method: 'GET' },
};

const parseEndpointsValue = (value) => {
  if (!value || typeof value !== 'string' || !value.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
};

const stringifyEndpointsValue = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return '';
  }
  return Object.keys(value).length === 0 ? '' : JSON.stringify(value, null, 2);
};

const normalizeEndpointsValue = (value) => {
  if (!value || typeof value !== 'string' || !value.trim()) {
    return '';
  }
  return stringifyEndpointsValue(parseEndpointsValue(value));
};

// ===== Model Pricing helpers =====
// 后端提供单条 patch endpoint /api/model-pricing/:model_name，
// 避免并发覆盖整张 ModelPricing map。
const PRICING_UNIT_VALUES = [
  'per-image',
  'per-second',
  'per-1k-tokens',
  'per-call',
];

const UNIT_LABEL_KEYS = {
  'per-image': 'unit.per-image',
  'per-second': 'unit.per-second',
  'per-1k-tokens': 'unit.per-1k-tokens',
  'per-call': 'unit.per-call',
};

// 把 unit 内部值转成 i18n label；非内置值原样返回
const resolveUnitLabel = (unit, t) => {
  if (!unit) return '';
  const key = UNIT_LABEL_KEYS[unit];
  return key ? t(key) : unit;
};

const parseRatiosValue = (value) => {
  if (!value || typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

const stringifyRatiosValue = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  return Object.keys(value).length === 0 ? '' : JSON.stringify(value, null, 2);
};

const nameRuleOptions = [
  { label: '精确名称匹配', value: 0 },
  { label: '前缀名称匹配', value: 1 },
  { label: '包含名称匹配', value: 2 },
  { label: '后缀名称匹配', value: 3 },
];

const EditModelModal = (props) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);
  const isEdit = props.editingModel && props.editingModel.id !== undefined;
  const placement = useMemo(() => (isEdit ? 'right' : 'left'), [isEdit]);

  // 供应商列表
  const [vendors, setVendors] = useState([]);

  // 预填组（标签、端点）
  const [tagGroups, setTagGroups] = useState([]);
  const [endpointGroups, setEndpointGroups] = useState([]);

  // 获取供应商列表
  const fetchVendors = async () => {
    try {
      const res = await API.get('/api/vendors/?page_size=1000'); // 获取全部供应商
      if (res.data.success) {
        const items = res.data.data.items || res.data.data || [];
        setVendors(Array.isArray(items) ? items : []);
      }
    } catch (error) {
      // ignore
    }
  };

  // 获取预填组（标签、端点）
  const fetchPrefillGroups = async () => {
    try {
      const [tagRes, endpointRes] = await Promise.all([
        API.get('/api/prefill_group?type=tag'),
        API.get('/api/prefill_group?type=endpoint'),
      ]);
      if (tagRes?.data?.success) {
        setTagGroups(tagRes.data.data || []);
      }
      if (endpointRes?.data?.success) {
        setEndpointGroups(endpointRes.data.data || []);
      }
    } catch (error) {
      // ignore
    }
  };

  // 获取全局 ModelPricing map（专用 endpoint）
  const fetchModelPricing = async () => {
    try {
      const res = await API.get('/api/model-pricing');
      if (!res?.data?.success) return;
      const map =
        res.data.data && typeof res.data.data === 'object'
          ? res.data.data
          : {};
      // 回填当前模型的 pricing 字段
      const modelName =
        formApiRef.current?.getValue('model_name') ||
        props.editingModel?.model_name;
      if (modelName && map[modelName] && formApiRef.current) {
        const entry = map[modelName] || {};
        formApiRef.current.setValue('pricing_unit', entry.unit || '');
        formApiRef.current.setValue(
          'pricing_ratios',
          stringifyRatiosValue(entry.ratios),
        );
      }
    } catch (error) {
      // ignore
    }
  };

  useEffect(() => {
    if (props.visiable) {
      fetchVendors();
      fetchPrefillGroups();
      fetchModelPricing();
    }
  }, [props.visiable]);

  const getInitValues = () => ({
    model_name: props.editingModel?.model_name || '',
    description: '',
    icon: '',
    tags: [],
    vendor_id: undefined,
    vendor: '',
    vendor_icon: '',
    endpoints: '',
    name_rule: props.editingModel?.model_name ? 0 : undefined, // 通过未配置模型过来的固定为精确匹配
    status: true,
    sync_official: true,
    pricing_unit: '',
    pricing_ratios: '',
  });

  const handleCancel = () => {
    props.handleClose();
  };

  const loadModel = async () => {
    if (!isEdit || !props.editingModel.id) return;

    setLoading(true);
    try {
      const res = await API.get(`/api/models/${props.editingModel.id}`);
      const { success, message, data } = res.data;
      if (success) {
        // 处理tags
        if (data.tags) {
          data.tags = data.tags.split(',').filter(Boolean);
        } else {
          data.tags = [];
        }
        data.endpoints = normalizeEndpointsValue(data.endpoints);
        // 处理status/sync_official，将数字转为布尔值
        data.status = data.status === 1;
        data.sync_official = (data.sync_official ?? 1) === 1;
        if (formApiRef.current) {
          formApiRef.current.setValues({ ...getInitValues(), ...data });
        }
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('加载模型信息失败'));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (formApiRef.current) {
      if (!isEdit) {
        formApiRef.current.setValues({
          ...getInitValues(),
          model_name: props.editingModel?.model_name || '',
        });
      }
    }
  }, [props.editingModel?.id, props.editingModel?.model_name]);

  useEffect(() => {
    if (props.visiable) {
      if (isEdit) {
        loadModel();
      } else {
        formApiRef.current?.setValues({
          ...getInitValues(),
          model_name: props.editingModel?.model_name || '',
        });
      }
    } else {
      formApiRef.current?.reset();
    }
  }, [props.visiable, props.editingModel?.id, props.editingModel?.model_name]);

  // 单条 patch ModelPricing：unit + ratios 都空时由后端按 delete 语义处理
  const saveModelPricing = async (modelName, unit, ratiosStr) => {
    if (!modelName) return;
    const trimmedUnit = (unit || '').trim();
    const parsedRatios = parseRatiosValue(ratiosStr);
    try {
      const res = await API.put(
        `/api/model-pricing/${encodeURIComponent(modelName)}`,
        {
          unit: trimmedUnit,
          ratios: parsedRatios || {},
        },
      );
      if (!res?.data?.success) {
        showError(res?.data?.message || t('保存定价失败'));
      }
    } catch (error) {
      showError(t('保存定价失败'));
    }
  };

  const submit = async (values) => {
    setLoading(true);
    try {
      const submitData = {
        ...values,
        tags: Array.isArray(values.tags) ? values.tags.join(',') : values.tags,
        endpoints: normalizeEndpointsValue(values.endpoints),
        status: values.status ? 1 : 0,
        sync_official: values.sync_official ? 1 : 0,
      };
      // pricing 字段不属于模型表，提交模型前剥离
      delete submitData.pricing_unit;
      delete submitData.pricing_ratios;

      if (isEdit) {
        submitData.id = props.editingModel.id;
        const res = await API.put('/api/models/', submitData);
        const { success, message } = res.data;
        if (success) {
          await saveModelPricing(
            values.model_name,
            values.pricing_unit,
            values.pricing_ratios,
          );
          showSuccess(t('模型更新成功！'));
          props.refresh();
          props.handleClose();
        } else {
          showError(t(message));
        }
      } else {
        const res = await API.post('/api/models/', submitData);
        const { success, message } = res.data;
        if (success) {
          await saveModelPricing(
            values.model_name,
            values.pricing_unit,
            values.pricing_ratios,
          );
          showSuccess(t('模型创建成功！'));
          props.refresh();
          props.handleClose();
        } else {
          showError(t(message));
        }
      }
    } catch (error) {
      showError(error.response?.data?.message || t('操作失败'));
    }
    setLoading(false);
    formApiRef.current?.setValues(getInitValues());
  };

  return (
    <SideSheet
      placement={placement}
      title={
        <Space>
          {isEdit ? (
            <Tag color='blue' shape='circle'>
              {t('更新')}
            </Tag>
          ) : (
            <Tag color='green' shape='circle'>
              {t('新建')}
            </Tag>
          )}
          <Title heading={4} className='m-0'>
            {isEdit ? t('更新模型信息') : t('创建新的模型')}
          </Title>
        </Space>
      }
      bodyStyle={{ padding: '0' }}
      visible={props.visiable}
      width={isMobile ? '100%' : 600}
      footer={
        <div className='flex justify-end bg-white'>
          <Space>
            <Button
              theme='solid'
              className='!rounded-lg'
              onClick={() => formApiRef.current?.submitForm()}
              icon={<Save size={16} />}
              loading={loading}
            >
              {t('提交')}
            </Button>
            <Button
              theme='light'
              className='!rounded-lg'
              type='primary'
              onClick={handleCancel}
              icon={<X size={16} />}
            >
              {t('取消')}
            </Button>
          </Space>
        </div>
      }
      closeIcon={null}
      onCancel={() => handleCancel()}
    >
      <Spin spinning={loading}>
        <Form
          key={isEdit ? 'edit' : 'new'}
          initValues={getInitValues()}
          getFormApi={(api) => (formApiRef.current = api)}
          onSubmit={submit}
        >
          {({ values }) => (
            <div className='p-2'>
              {/* 基本信息 */}
              <Card className='!rounded-2xl shadow-sm border-0'>
                <div className='flex items-center mb-2'>
                  <Avatar size='small' color='green' className='mr-2 shadow-md'>
                    <FileText size={16} />
                  </Avatar>
                  <div>
                    <Text className='text-lg font-medium'>{t('基本信息')}</Text>
                    <div className='text-xs text-gray-600'>
                      {t('设置模型的基本信息')}
                    </div>
                  </div>
                </div>
                <Row gutter={12}>
                  <Col span={24}>
                    <Form.Input
                      field='model_name'
                      label={t('模型名称')}
                      placeholder={t('请输入模型名称，如：gpt-4')}
                      rules={[{ required: true, message: t('请输入模型名称') }]}
                      showClear
                    />
                  </Col>

                  <Col span={24}>
                    <Form.Select
                      field='name_rule'
                      label={t('名称匹配类型')}
                      placeholder={t('请选择名称匹配类型')}
                      optionList={nameRuleOptions.map((o) => ({
                        label: t(o.label),
                        value: o.value,
                      }))}
                      rules={[
                        { required: true, message: t('请选择名称匹配类型') },
                      ]}
                      extraText={t(
                        '根据模型名称和匹配规则查找模型元数据，优先级：精确 > 前缀 > 后缀 > 包含',
                      )}
                      style={{ width: '100%' }}
                    />
                  </Col>

                  <Col span={24}>
                    <Form.Input
                      field='icon'
                      label={t('模型图标')}
                      placeholder={t('请输入图标名称')}
                      extraText={
                        <span>
                          {t(
                            "图标使用@lobehub/icons库，如：OpenAI、Claude.Color，支持链式参数：OpenAI.Avatar.type={'platform'}、OpenRouter.Avatar.shape={'square'}，查询所有可用图标请 ",
                          )}
                          <Typography.Text
                            link={{
                              href: 'https://icons.lobehub.com/components/lobe-hub',
                              target: '_blank',
                            }}
                            icon={<IconLink />}
                            underline
                          >
                            {t('请点击我')}
                          </Typography.Text>
                        </span>
                      }
                      showClear
                    />
                  </Col>

                  <Col span={24}>
                    <Form.TextArea
                      field='description'
                      label={t('描述')}
                      placeholder={t('请输入模型描述')}
                      rows={3}
                      showClear
                    />
                  </Col>
                  <Col span={24}>
                    <Form.TagInput
                      field='tags'
                      label={t('标签')}
                      placeholder={t('输入标签或使用","分隔多个标签')}
                      addOnBlur
                      showClear
                      onChange={(newTags) => {
                        if (!formApiRef.current) return;
                        const normalize = (tags) => {
                          if (!Array.isArray(tags)) return [];
                          return [
                            ...new Set(
                              tags.flatMap((tag) =>
                                tag
                                  .split(',')
                                  .map((t) => t.trim())
                                  .filter(Boolean),
                              ),
                            ),
                          ];
                        };
                        const normalized = normalize(newTags);
                        formApiRef.current.setValue('tags', normalized);
                      }}
                      style={{ width: '100%' }}
                      {...(tagGroups.length > 0 && {
                        extraText: (
                          <Space wrap>
                            {tagGroups.map((group) => (
                              <Button
                                key={group.id}
                                size='small'
                                type='primary'
                                onClick={() => {
                                  if (formApiRef.current) {
                                    const currentTags =
                                      formApiRef.current.getValue('tags') || [];
                                    const newTags = [
                                      ...currentTags,
                                      ...(group.items || []),
                                    ];
                                    const uniqueTags = [...new Set(newTags)];
                                    formApiRef.current.setValue(
                                      'tags',
                                      uniqueTags,
                                    );
                                  }
                                }}
                              >
                                {group.name}
                              </Button>
                            ))}
                          </Space>
                        ),
                      })}
                    />
                  </Col>
                  <Col span={24}>
                    <Form.Select
                      field='vendor_id'
                      label={t('供应商')}
                      placeholder={t('选择模型供应商')}
                      optionList={vendors.map((v) => ({
                        label: v.name,
                        value: v.id,
                      }))}
                      filter
                      showClear
                      onChange={(value) => {
                        const vendorInfo = vendors.find((v) => v.id === value);
                        if (vendorInfo && formApiRef.current) {
                          formApiRef.current.setValue(
                            'vendor',
                            vendorInfo.name,
                          );
                        }
                      }}
                      style={{ width: '100%' }}
                    />
                  </Col>
                  <Col span={24}>
                    <Banner
                      type='warning'
                      closeIcon={null}
                      icon={
                        <IconAlertTriangle
                          size='large'
                          style={{ color: 'var(--semi-color-warning)' }}
                        />
                      }
                      description={t(
                        '提示：此处配置仅用于控制「模型广场」对用户的展示效果，不会影响模型的实际调用与路由。若需配置真实调用行为，请前往「渠道管理」进行设置。',
                      )}
                      style={{ marginBottom: 12 }}
                    />
                    <JSONEditor
                      field='endpoints'
                      label={t('在模型广场向用户展示的端点')}
                      placeholder={
                        '{\n  "text_to_video": {\n    "path": "/v1/videos",\n    "method": "POST",\n    "parameters": {}\n  }\n}'
                      }
                      value={values.endpoints}
                      onChange={(val) =>
                        formApiRef.current?.setValue(
                          'endpoints',
                          normalizeEndpointsValue(val),
                        )
                      }
                      formApi={formApiRef.current}
                      editorType='endpointSchema'
                      template={ENDPOINT_TEMPLATE}
                      templateLabel={t('填入模板')}
                      extraText={t(
                        '留空则使用默认端点；支持 path、method、parameters',
                      )}
                      extraFooter={
                        endpointGroups.length > 0 && (
                          <Space wrap>
                            {endpointGroups.map((group) => (
                              <Button
                                key={group.id}
                                size='small'
                                type='primary'
                                onClick={() => {
                                  try {
                                    const current =
                                      formApiRef.current?.getValue(
                                        'endpoints',
                                      ) || '';
                                    let base = {};
                                    if (current && current.trim())
                                      base = JSON.parse(current);
                                    const groupObj =
                                      typeof group.items === 'string'
                                        ? JSON.parse(group.items || '{}')
                                        : group.items || {};
                                    const merged = { ...base, ...groupObj };
                                    formApiRef.current?.setValue(
                                      'endpoints',
                                      JSON.stringify(merged, null, 2),
                                    );
                                  } catch (e) {
                                    try {
                                      const groupObj =
                                        typeof group.items === 'string'
                                          ? JSON.parse(group.items || '{}')
                                          : group.items || {};
                                      formApiRef.current?.setValue(
                                        'endpoints',
                                        JSON.stringify(groupObj, null, 2),
                                      );
                                    } catch {}
                                  }
                                }}
                              >
                                {group.name}
                              </Button>
                            ))}
                          </Space>
                        )
                      }
                    />
                  </Col>
                  <Col span={24}>
                    <Form.Switch
                      field='sync_official'
                      label={t('参与官方同步')}
                      extraText={t(
                        '关闭后，此模型将不会被“同步官方”自动覆盖或创建',
                      )}
                      size='large'
                    />
                  </Col>
                  <Col span={24}>
                    <Form.Switch
                      field='status'
                      label={t('状态')}
                      size='large'
                    />
                  </Col>
                </Row>
              </Card>

              {/* 模型定价 */}
              <Card className='!rounded-2xl shadow-sm border-0 mt-3'>
                <div className='flex items-center mb-2'>
                  <Avatar size='small' color='orange' className='mr-2 shadow-md'>
                    <DollarSign size={16} />
                  </Avatar>
                  <div>
                    <Text className='text-lg font-medium'>{t('定价')}</Text>
                    <div className='text-xs text-gray-600'>
                      {t(
                        '配置该模型对外暴露的计价单位与子规格倍率（写入全局 ModelPricing）',
                      )}
                    </div>
                  </div>
                </div>
                <Row gutter={12}>
                  <Col span={24}>
                    <Form.AutoComplete
                      field='pricing_unit'
                      label={t('计价单位')}
                      placeholder={t(
                        '如 per-image / per-second / per-1k-tokens，可自定义',
                      )}
                      data={PRICING_UNIT_VALUES.map((v) => ({
                        value: v,
                        label: `${resolveUnitLabel(v, t)} (${v})`,
                      }))}
                      showClear
                      style={{ width: '100%' }}
                      extraText={t('用户自由填写，不限枚举')}
                    />
                  </Col>
                  <Col span={24}>
                    <JSONEditor
                      field='pricing_ratios'
                      label={t('子规格倍率(JSON)')}
                      placeholder={
                        '{\n  "1024x1024": 0.04,\n  "1792x1024": 0.08\n}'
                      }
                      value={values.pricing_ratios}
                      onChange={(val) =>
                        formApiRef.current?.setValue('pricing_ratios', val)
                      }
                      formApi={formApiRef.current}
                      extraText={t(
                        '任意 JSON 对象，键为子规格（如分辨率/档位），值为倍率或单价',
                      )}
                    />
                  </Col>
                </Row>
              </Card>
            </div>
          )}
        </Form>
      </Spin>
    </SideSheet>
  );
};

export default EditModelModal;
