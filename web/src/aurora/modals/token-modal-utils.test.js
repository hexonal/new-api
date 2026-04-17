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

import { describe, expect, test } from 'bun:test';
import {
  buildTokenCreatePayloads,
  formatTokenGroupOptions,
  getTokenFormInitialValues,
  normalizeTokenFormPayload,
  quotaToUsdInput,
  resolveDefaultGroupValue,
  toDateTimeLocalValue,
  usdInputToQuota,
} from './token-modal-utils';

describe('token-modal-utils', () => {
  test('resolves default group while preferring a single non-auto group', () => {
    expect(resolveDefaultGroupValue([])).toBe('');
    expect(
      resolveDefaultGroupValue([{ value: 'auto' }, { value: 'default' }]),
    ).toBe('default');
    expect(resolveDefaultGroupValue([{ value: 'auto' }])).toBe('auto');
    expect(
      resolveDefaultGroupValue([{ value: 'alpha' }, { value: 'beta' }]),
    ).toBe('');
  });

  test('normalizes token form payload with explicit limits and expiry', () => {
    expect(
      normalizeTokenFormPayload({
        ...getTokenFormInitialValues(),
        remain_quota: '500000',
        expired_time: '2026-04-20T10:30',
        model_limits: ['gpt-4.1', 'gpt-4.1-mini'],
        allow_ips: '10.0.0.1\n10.0.0.2',
        group: 'default',
      }),
    ).toEqual({
      name: '',
      remain_quota: 500000,
      expired_time: 1776681000,
      unlimited_quota: false,
      model_limits_enabled: true,
      model_limits: 'gpt-4.1,gpt-4.1-mini',
      allow_ips: '10.0.0.1\n10.0.0.2',
      group: 'default',
      cross_group_retry: false,
    });
  });

  test('builds create payloads with deterministic suffixes', () => {
    const payloads = buildTokenCreatePayloads(
      {
        ...getTokenFormInitialValues(),
        name: 'demo',
        unlimited_quota: false,
        remain_quota: '1200',
        tokenCount: '3',
      },
      () => 'ABC123',
    );

    expect(payloads).toHaveLength(3);
    expect(payloads[0].name).toBe('demo');
    expect(payloads[1].name).toBe('demo-ABC123');
    expect(payloads[2].name).toBe('demo-ABC123');
    expect(payloads.every((item) => item.remain_quota === 1200)).toBe(true);
  });

  test('formats unix timestamp for datetime-local inputs', () => {
    expect(toDateTimeLocalValue(-1)).toBe('');
    expect(toDateTimeLocalValue(1776681000)).toBe('2026-04-20T10:30');
  });

  test('formats token groups differently for admin and user sides', () => {
    const groupMap = {
      auto: { desc: '自动分组' },
      default: { desc: '默认分组' },
      vip: { desc: '高优先级' },
    };

    expect(formatTokenGroupOptions(groupMap, 'default', false)).toEqual([
      { value: 'auto', label: '自动分组' },
      { value: 'default', label: '默认分组' },
    ]);
    expect(formatTokenGroupOptions(groupMap, 'default', true)).toEqual([
      { value: 'auto', label: '自动分组' },
      { value: 'default', label: '默认分组' },
      { value: 'vip', label: '高优先级' },
    ]);
  });

  test('converts quota and usd inputs reversibly', () => {
    expect(quotaToUsdInput('5000000', 500000)).toBe('10');
    expect(quotaToUsdInput('5500000', 500000)).toBe('11');
    expect(usdInputToQuota('10', 500000)).toBe('5000000');
    expect(usdInputToQuota('10.5', 500000)).toBe('5250000');
    expect(usdInputToQuota('', 500000)).toBe('0');
  });
});
