import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readSource = () =>
  readFileSync(join(import.meta.dir, 'utils.jsx'), 'utf8');

describe('helpers utils toast regression', () => {
  test('routes helper toasts through react-toastify instead of Semi Toast', () => {
    const source = readSource();

    expect(source).not.toContain(
      "import { Toast, Pagination } from '@douyinfe/semi-ui';",
    );
    expect(source).toContain("import { Pagination } from '@douyinfe/semi-ui';");
    expect(source).toContain('toast.error(');
    expect(source).toContain('toast.warn(');
    expect(source).toContain('toast.success(');
    expect(source).toContain('toast.info(');
  });
});
