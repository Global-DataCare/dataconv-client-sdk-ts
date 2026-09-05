// Flow contract: research import detects embedded API-CONFIG mappings or exposes unique source columns for explicit field-by-field mapping.

import { availableResearchSourceFields, inspectResearchWorkbook } from '../workbook-inspection';
import { buildXlsxWorkbook } from '../xlsx-codec';

function workbookBytes(rows: unknown[][]): Uint8Array {
  return buildXlsxWorkbook([{ name: 'Research', rows }]);
}

it('reads API-CONFIG from cell A1 and pairs row two server fields with row three source fields', () => {
  const result = inspectResearchWorkbook(workbookBytes([
    ['API-CONFIG:language=es:dataUse=secondary'],
    ['subject_id', 'date', 'DiagnosticReport.code-text'],
    ['CHIP', 'FECHA', 'DIAGNOSTICO'],
    ['chip-1', '2026-09-04', 'Otitis'],
  ]));

  expect(result.mode).toBe('embedded-api-config');
  expect(result.sourceFields).toEqual(['CHIP', 'FECHA', 'DIAGNOSTICO']);
  expect(result.mappings).toEqual([
    { serverField: 'subject_id', sourceField: 'CHIP' },
    { serverField: 'date', sourceField: 'FECHA' },
    { serverField: 'DiagnosticReport.code-text', sourceField: 'DIAGNOSTICO' },
  ]);
});

it('uses row one as source fields and removes already mapped choices', () => {
  const result = inspectResearchWorkbook(workbookBytes([
    ['CHIP', 'FECHA', 'DIAGNOSTICO'],
    ['chip-1', '2026-09-04', 'Otitis'],
  ]));

  expect(result.mode).toBe('manual-mapping');
  expect(result.sourceFields).toEqual(['CHIP', 'FECHA', 'DIAGNOSTICO']);
  expect(availableResearchSourceFields(result.sourceFields, [
    { serverField: 'subject_id', sourceField: 'CHIP' },
    { serverField: 'date', sourceField: 'FECHA' },
  ])).toEqual(['DIAGNOSTICO']);
});
