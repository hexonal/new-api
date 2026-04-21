import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readSource = (file) => readFileSync(join(import.meta.dir, file), 'utf8');

describe('models explorer state regression', () => {
  test('defaults the active category to all', () => {
    const source = readSource('useModelsExplorerPageState.js');

    expect(source).toContain(
      "const [activeCategory, setActiveCategory] = useState('all');",
    );
    expect(source).not.toContain(
      'const [activeCategory, setActiveCategory] = useState(null);',
    );
  });

  test('does not keep the auto-category hook that overrides the global ranking view', () => {
    const source = readSource('useModelsExplorerPageState.js');

    expect(source).not.toContain(
      'const useExplorerAutoCategory = ({ modelRows, selections }) => {',
    );
    expect(source).not.toContain('discoverableModels[0]?.primaryModality');
    expect(source).not.toContain('useExplorerAutoCategory({');
  });
});
