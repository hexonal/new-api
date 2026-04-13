import { describe, expect, test } from 'bun:test';
import {
  buildTokenCreatePayloads,
  getTokenFormInitialValues,
  normalizeTokenFormPayload,
  resolveDefaultGroupValue,
  toDateTimeLocalValue,
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
      unlimited_quota: true,
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
});
