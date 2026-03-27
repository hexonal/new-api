import React from 'react';
import { Card, Avatar, Skeleton } from '@douyinfe/semi-ui';
import { CARD_PROPS } from '../../constants/key-cost.constants';

function getChangeColor(changeType) {
  if (changeType === 'up') return 'text-red-500';
  if (changeType === 'down') return 'text-green-500';
  return 'text-gray-400';
}

const KeyCostStatsCards = ({ statsData, loading }) => {
  return (
    <div className='mb-4'>
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        {(statsData || []).map((item, idx) => (
          <Card
            key={idx}
            {...CARD_PROPS}
            className='!rounded-2xl w-full'
          >
            <div className='flex items-center justify-between'>
              <div className='flex items-center'>
                <Avatar
                  className='mr-3'
                  size='small'
                  color={item.avatarColor}
                >
                  {item.icon}
                </Avatar>
                <div>
                  <div className='text-xs text-gray-500'>{item.title}</div>
                  <div className='text-lg font-semibold'>
                    <Skeleton
                      loading={loading}
                      active
                      placeholder={
                        <Skeleton.Paragraph
                          active
                          rows={1}
                          style={{
                            width: '80px',
                            height: '24px',
                            marginTop: '4px',
                          }}
                        />
                      }
                    >
                      {item.value}
                    </Skeleton>
                  </div>
                </div>
              </div>
              {item.change !== null && (
                <div
                  className={`text-sm font-medium ${getChangeColor(item.changeType)}`}
                >
                  {item.changeType === 'up' && '+'}
                  {item.change}%
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default KeyCostStatsCards;
