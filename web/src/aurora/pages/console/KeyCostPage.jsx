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

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../primitives/tabs';
import { TAB_ANALYSIS, TAB_COMPARE } from '../../../constants/key-cost.constants';
import { KeyCostAnalysis, KeyCostCompare } from './components';

export default function KeyCostPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(TAB_ANALYSIS);

  return (
    <div className='space-y-4'>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value={TAB_ANALYSIS}>{t('Key 成本分析')}</TabsTrigger>
          <TabsTrigger value={TAB_COMPARE}>{t('Key 成本对比')}</TabsTrigger>
        </TabsList>

        <TabsContent value={TAB_ANALYSIS}>
          <KeyCostAnalysis />
        </TabsContent>
        <TabsContent value={TAB_COMPARE}>
          <KeyCostCompare />
        </TabsContent>
      </Tabs>
    </div>
  );
}
