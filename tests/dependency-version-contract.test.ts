// Flow contract: reuse shared test fixtures and canonical types; do not introduce duplicated literals.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('release dependency tree is independent of GDC', () => {
  const lock = JSON.parse(readFileSync(resolve(process.cwd(), 'package-lock.json'), 'utf8'));
  expect(Object.keys(lock.packages).filter(path => /(?:^|\/)node_modules\/(?:@[^/]+\/)?gdc-/u.test(path))).toEqual([]);
});
