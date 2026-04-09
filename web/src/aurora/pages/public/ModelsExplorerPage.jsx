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
import { useTranslation } from 'react-i18next';
import PricingPage from '../../../components/table/model-pricing/layout/PricingPage';

const ModelsExplorerPage = () => {
  const { t } = useTranslation();

  return (
    <div className='aurora-pricing-page'>
      <div className='aurora-pricing-header'>
        <h1>{t('模型价格一览')}</h1>
        <p>{t('按供应商、端点和计费方式筛选模型，并查看定价、上下文与能力')}</p>
      </div>
      <PricingPage />
    </div>
  );
};

export default ModelsExplorerPage;

