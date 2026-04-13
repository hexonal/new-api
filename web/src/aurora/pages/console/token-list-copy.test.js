import { describe, expect, test } from 'bun:test';
import {
  getTokenListTitle,
  getTokenTableHeaderLabels,
} from './token-list-copy';

describe('token-list-copy', () => {
  test('builds localized token page title and table headers', () => {
    const t = (key) => `t:${key}`;

    expect(getTokenListTitle(t)).toBe('t:API 密钥');
    expect(getTokenTableHeaderLabels(t)).toEqual([
      't:密钥',
      't:状态',
      't:模型限制',
      't:用量',
      't:额度',
      't:创建时间',
      't:操作',
    ]);
  });
});
