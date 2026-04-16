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
    specPie.data[0].values.length > 0;

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
