import React, { useState } from 'react';
import { Tabs, TabPane } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import KeyCostPanel from '../../components/key-cost';
import KeyComparePanel from '../../components/key-cost/compare';
import { TAB_ANALYSIS, TAB_COMPARE } from '../../constants/key-cost.constants';

const KeyCostAnalysis = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(TAB_ANALYSIS);

  return (
    <div className='mt-[60px] px-2'>
      <Tabs
        type='line'
        activeKey={activeTab}
        onChange={setActiveTab}
        lazyRender
        style={{ marginBottom: 16 }}
      >
        <TabPane tab={t('Key 成本分析')} itemKey={TAB_ANALYSIS}>
          <KeyCostPanel />
        </TabPane>
        <TabPane tab={t('Key 成本对比')} itemKey={TAB_COMPARE}>
          <KeyComparePanel />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default KeyCostAnalysis;
