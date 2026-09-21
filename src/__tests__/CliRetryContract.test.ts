// Flow contract: CLI uploads inherit the same bounded three-attempt polling default as library consumers.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('DataConv CLI polling contract', () => {
  it('defaults to at most three attempts when DATACONV_RETRY_TIMES is absent', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/cli.ts'), 'utf8');

    expect(source).toContain('DATACONV_RETRY_TIMES || 3');
    expect(source).not.toContain('DATACONV_RETRY_TIMES || 60');
  });
});
