import React from 'react';
import { Card, Skeleton, Empty } from '@douyinfe/semi-ui';
import { CARD_PROPS, COMPARE_COLORS } from '../../../constants/key-cost.constants';
import {
  IllustrationNoContent,
  IllustrationNoContentDark,
} from '@douyinfe/semi-illustrations';

const KeyCompareStatsCards = ({ compareStats, loading, t }) => {
  if (!compareStats || compareStats.length === 0) {
    return (
      <div className='mb-4'>
        <Empty
          image={
            <IllustrationNoContent style={{ width: 96, height: 96 }} />
          }
          darkModeImage={
            <IllustrationNoContentDark style={{ width: 96, height: 96 }} />
          }
          description={t('请选择 Key 查看对比数据')}
        />
      </div>
    );
  }

  return (
    <div className='mb-4'>
      <div
        className='grid gap-4'
        style={{
          gridTemplateColumns: `repeat(${Math.min(compareStats.length, 4)}, minmax(0, 1fr))`,
        }}
      >
        {compareStats.map((stat, idx) => {
          const color = COMPARE_COLORS[idx % COMPARE_COLORS.length];
          return (
            <Card
              key={stat.tokenId}
              {...CARD_PROPS}
              className='!rounded-2xl overflow-hidden'
            >
              <div
                className='h-1 -mt-4 -mx-6 mb-3'
                style={{ backgroundColor: color }}
              />
              <Skeleton loading={loading} active placeholder={<Skeleton.Paragraph rows={4} />}>
                <div className='text-sm font-semibold mb-3 truncate' style={{ color }}>
                  {stat.name}
                </div>
                <div className='space-y-2'>
                  <div className='flex justify-between text-sm'>
                    <span className='text-gray-500'>{t('总成本')}</span>
                    <span className='font-medium'>{stat.cost}</span>
                  </div>
                  <div className='flex justify-between text-sm'>
                    <span className='text-gray-500'>{t('请求次数')}</span>
                    <span className='font-medium'>
                      {stat.requests.toLocaleString()}
                    </span>
                  </div>
                  <div className='flex justify-between text-sm'>
                    <span className='text-gray-500'>{t('Token 消耗')}</span>
                    <span className='font-medium'>
                      {stat.tokens.toLocaleString()}
                    </span>
                  </div>
                  <div className='flex justify-between text-sm'>
                    <span className='text-gray-500'>{t('平均单次成本')}</span>
                    <span className='font-medium'>{stat.avgCost}</span>
                  </div>
                </div>
              </Skeleton>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default KeyCompareStatsCards;
