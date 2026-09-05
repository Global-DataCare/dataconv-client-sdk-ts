// Flow contract: reuse shared test fixtures and canonical types; do not introduce duplicated literals.
/**
 * Flow contract: browser consumers inspect research workbooks without bundling
 * the Node-only filesystem writer used by the CLI template generator.
 */
import { readFileSync } from 'node:fs';

describe('browser package entry', () => {
  it('resolves the package browser condition to an entry without the Node-only generator', () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as {
      exports?: Record<string, { browser?: string }>;
    };
    const browserSource = readFileSync('src/browser.ts', 'utf8');

    expect(manifest.exports?.['.']?.browser).toBe('./dist/browser.js');
    expect(browserSource).toContain("export { availableResearchSourceFields, inspectResearchWorkbook } from './workbook-inspection.js'");
    expect(browserSource).not.toContain('excel-generator');
    expect(browserSource).not.toContain('node:fs');
  });
});
