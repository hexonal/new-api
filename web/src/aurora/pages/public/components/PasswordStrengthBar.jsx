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

const getStrength = (value = '') => {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(4, score);
};

const labels = ['weak', 'fair', 'good', 'strong', 'very strong'];

const getStrengthLabel = (score) => {
  if (score <= 0) {
    return '';
  }
  return labels[score - 1] || '';
};

const PasswordStrengthBar = ({ value }) => {
  const score = getStrength(value);
  const width = `${Math.max(score, 0) * 25}%`;
  const colorClass =
    score <= 1
      ? 'aurora-strength-weak'
      : score === 2
        ? 'aurora-strength-fair'
        : score === 3
          ? 'aurora-strength-good'
          : 'aurora-strength-strong';

  return (
    <div className='aurora-strength-wrap'>
      <div className='aurora-strength-track'>
        <div
          className={`aurora-strength-fill ${colorClass}`}
          style={{ width }}
          aria-hidden={true}
        />
      </div>
      <div className='aurora-strength-label'>{getStrengthLabel(score)}</div>
    </div>
  );
};

export default PasswordStrengthBar;
