import React from 'react';
import { Card, Empty } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import { PieChart, BarChart3 } from 'lucide-react';
import { CHART_CONFIG, CARD_PROPS } from '../../constants/key-cost.constants';
import {
  IllustrationNoContent,
  IllustrationNoContentDark,
} from '@douyinfe/semi-illustrations';

const KeyCostDistributionPanel = ({ specPie, specRankBar, t }) => {
  const hasPieData =
    specPie &&
    specPie.data &&
    specPie.data[0] &&
    specPie.data[0].values &&
    specPie.data[0].values.length > 0 &&
    !(
      specPie.data[0].values.length === 1 &&
      specPie.data[0].values[0].type === 'N/A'
    );

  const hasBarData =
    specRankBar &&
    specRankBar.data &&
    specRankBar.data[0] &&
    specRankBar.data[0].values &&
    specRankBar.data[0].values.length > 0;

  const emptyNode = (
    <div className='flex items-center justify-center h-full'>
      <Empty
        image={
          <IllustrationNoContent style={{ width: 96, height: 96 }} />
        }
        darkModeImage={
          <IllustrationNoContentDark style={{ width: 96, height: 96 }} />
        }
        description={t('暂无数据')}
      />
    </div>
  );

  return (
    <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4'>
      <Card
        {...CARD_PROPS}
        className='!rounded-2xl'
        title={
          <div className='flex items-center gap-2'>
            <PieChart size={16} />
            {t('模型消耗占比')}
          </div>
        }
        bodyStyle={{ padding: 0 }}
      >
        <div className='h-80 p-2'>
          {hasPieData ? (
            <VChart spec={specPie} option={CHART_CONFIG} />
          ) : (
            emptyNode
          )}
        </div>
      </Card>

      <Card
        {...CARD_PROPS}
        className='!rounded-2xl'
        title={
          <div className='flex items-center gap-2'>
            <BarChart3 size={16} />
            {t('模型成本排行')}
          </div>
        }
        bodyStyle={{ padding: 0 }}
      >
        <div className='h-80 p-2'>
          {hasBarData ? (
            <VChart spec={specRankBar} option={CHART_CONFIG} />
          ) : (
            emptyNode
          )}
        </div>
      </Card>
    </div>
  );
};

export default KeyCostDistributionPanel;
