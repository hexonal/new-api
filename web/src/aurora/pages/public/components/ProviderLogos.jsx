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
import {
  OpenAI,
  Claude,
  Gemini,
  Qwen,
  DeepSeek,
  Zhipu,
  Suno,
  Hunyuan,
  Cohere,
  Midjourney,
} from '@lobehub/icons';

const providers = [
  { name: 'OpenAI', icon: OpenAI },
  { name: 'Claude', icon: Claude },
  { name: 'Gemini', icon: Gemini },
  { name: 'Qwen', icon: Qwen },
  { name: 'DeepSeek', icon: DeepSeek },
  { name: 'Zhipu', icon: Zhipu },
  { name: 'Suno', icon: Suno },
  { name: 'Hunyuan', icon: Hunyuan },
  { name: 'Cohere', icon: Cohere },
  { name: 'Midjourney', icon: Midjourney },
];

const ProviderLogos = () => {
  return (
    <div className='aurora-provider-logos'>
      {providers.map((provider) => (
        <div key={provider.name} className='aurora-provider-logo-item'>
          <provider.icon size={30} />
          <span>{provider.name}</span>
        </div>
      ))}
    </div>
  );
};

export default ProviderLogos;
