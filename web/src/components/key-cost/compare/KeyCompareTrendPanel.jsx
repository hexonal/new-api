import React from 'react';
import { Card, Tabs, TabPane, Empty } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import { TrendingUp } from 'lucide-react';
import {
  CHART_CONFIG,
  CARD_PROPS,
  METRIC_COST,
  METRIC_REQUESTS,
  METRIC_TOKENS,
} from '../../../constants/key-cost.constants';
import {
  IllustrationNoContent,
  IllustrationNoContentDark,
} from '@douyinfe/semi-illustrations';

const KeyCompareTrendPanel = ({
  specMultiLine,
  activeMetric,
  onMetricChange,
  t,
}) => {
  const hasData =
    specMultiLine &&
    specMultiLine.data &&
    specMultiLine.data[0] &&
    specMultiLine.data[0].values &&
    specMultiLine.data[0].values.length > 0;

  return (
    <Card
      {...CARD_PROPS}
      className='!rounded-2xl mb-4'
      title={
        <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between w-full gap-3'>
          <div className='flex items-center gap-2'>
            <TrendingUp size={16} />
            {t('Key 对比趋势')}
          </div>
          <Tabs
            type='slash'
            activeKey={activeMetric}
            onChange={onMetricChange}
          >
            <TabPane tab={<span>{t('成本')}</span>} itemKey={METRIC_COST} />
            <TabPane tab={<span>{t('请求次数')}</span>} itemKey={METRIC_REQUESTS} />
            <TabPane tab={<span>{t('Token 消耗')}</span>} itemKey={METRIC_TOKENS} />
          </Tabs>
        </div>
      }
      bodyStyle={{ padding: 0 }}
    >
      <div className='h-96 p-2'>
        {hasData ? (
          <VChart spec={specMultiLine} option={CHART_CONFIG} />
        ) : (
          <div className='flex items-center justify-center h-full'>
            <Empty
              image={
                <IllustrationNoContent style={{ width: 96, height: 96 }} />
              }
              darkModeImage={
                <IllustrationNoContentDark
                  style={{ width: 96, height: 96 }}
                />
              }
              description={t('请选择至少一个 Key 进行对比')}
            />
          </div>
        )}
      </div>
    </Card>
  );
};

export default KeyCompareTrendPanel;
