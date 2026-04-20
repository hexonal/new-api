import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readSource = (file) => readFileSync(join(import.meta.dir, file), 'utf8');

describe('models explorer state regression', () => {
  test('does not hardcode text as the default active category', () => {
    const source = readSource('useModelsExplorerPageState.js');

    expect(source).toContain(
      'const [activeCategory, setActiveCategory] = useState(null);',
    );
    expect(source).not.toContain(
      "const [activeCategory, setActiveCategory] = useState('text');",
    );
  });

  test('auto-selects the primary modality from the highest priority discoverable model', () => {
    const source = readSource('useModelsExplorerPageState.js');

    expect(source).toContain(
      'const useExplorerAutoCategory = ({ modelRows, selections }) => {',
    );
    expect(source).toContain('activeCategory: null,');
    expect(source).toContain(
      "const nextCategory = discoverableModels[0]?.primaryModality || 'text';",
    );
    expect(source).toContain('selections.setActiveCategory(nextCategory);');
  });
});
