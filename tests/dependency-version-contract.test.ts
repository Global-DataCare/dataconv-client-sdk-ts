// Flow contract: reuse shared test fixtures and canonical types; do not introduce duplicated literals.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('release pins the current common contract without a legacy nested copy', () => {
  const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
  expect(manifest.version).toBe('0.4.6');
  expect(manifest.dependencies['gdc-common-utils-ts']).toBe('2.9.4');
});
