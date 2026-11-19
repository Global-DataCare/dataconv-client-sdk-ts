// Flow contract: reuse shared test fixtures and canonical types; do not introduce duplicated literals.
/**
 * Flow contract: browser consumers inspect research workbooks without bundling
 * the Node-only filesystem writer used by the CLI template generator.
 */
import { readFileSync } from 'node:fs';
import { getDataResults, getThidFromMessage, includeFileInMessage, includeVpTokenInMessage, prepareDidCommRequest } from '../browser.js';

describe('browser package entry', () => {
  it('preserves the public DIDComm helper behavior for browser consumers', () => {
    const message = prepareDidCommRequest('https://example.org/message', { data: [{ id: 'row' }] });
    expect(getThidFromMessage(message)).toBe(message.id);
    expect(getDataResults(message)).toEqual([{ id: 'row' }]);
    includeVpTokenInMessage(message, 'demo-token');
    includeFileInMessage(message, new Uint8Array([1, 2, 3]), 'application/octet-stream', 'sheet');
    expect(message.body.vp_token).toBe('demo-token');
    expect(message.attachments).toEqual([{ id: 'sheet', media_type: 'application/octet-stream', data: { base64: 'AQID' } }]);
  });

  it('resolves the package browser condition to an entry without the Node-only generator', () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as {
      exports?: Record<string, { browser?: string }>;
    };
    const browserSource = readFileSync('src/browser.ts', 'utf8');

    expect(manifest.exports?.['.']?.browser).toBe('./dist/browser.js');
    expect(browserSource).toContain('extractResearchWorkbookSheet');
    expect(browserSource).toContain('inspectResearchWorkbookSheets');
    expect(browserSource).toContain("from './workbook-inspection.js'");
    expect(browserSource).not.toContain('excel-generator');
    expect(browserSource).not.toContain('node:fs');
  });
});
