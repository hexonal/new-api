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

const FooterLink = ({ children }) => (
  <span className='cursor-pointer transition-colors hover:text-indigo-600'>
    {children}
  </span>
);

const ModelsExplorerFooter = ({ t }) => (
  <footer className='mx-auto flex max-w-[1400px] items-center justify-between border-t border-gray-100 px-6 py-8 text-xs text-gray-400'>
    <div>{t('模型广场')}</div>
    <div className='flex gap-6'>
      <FooterLink>{t('状态')}</FooterLink>
      <FooterLink>{t('API 文档')}</FooterLink>
      <FooterLink>{t('计费类型')}</FooterLink>
      <FooterLink>{t('联系我们')}</FooterLink>
    </div>
  </footer>
);

export default ModelsExplorerFooter;
