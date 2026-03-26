import React, { useState } from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import KeyCostPanel from '../../components/key-cost';
import KeyComparePanel from '../../components/key-cost/compare';

const KeyCostAnalysis = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('analysis');

  return (
    <div className='mt-[60px] px-2'>
      <Tabs
        type='line'
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginBottom: 16 }}
      >
        <TabPane tab={t('Key 成本分析')} itemKey='analysis'>
          <KeyCostPanel />
        </TabPane>
        <TabPane tab={t('Key 成本对比')} itemKey='compare'>
          <KeyComparePanel />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default KeyCostAnalysis;
