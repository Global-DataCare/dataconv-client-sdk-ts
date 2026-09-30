// Flow contract: reuse shared test fixtures and canonical types; do not introduce duplicated literals.
// Research import inspects every worksheet independently and isolates exactly one selected sheet for its homonymous ResearchStudy.

import {
  availableResearchSourceFields,
  extractResearchWorkbookSheet,
  inspectResearchWorkbook,
  inspectResearchWorkbookSheets,
} from '../workbook-inspection';
import { buildXlsxWorkbook, readXlsxWorkbook } from '../xlsx-codec';

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
  expect(result.sheetName).toBe('Research');
  expect(result.dataHeaderRowIndex).toBe(3);
  expect(result.sampleValuesBySourceField).toEqual({
    CHIP: ['chip-1'],
    FECHA: ['2026-09-04'],
    DIAGNOSTICO: ['Otitis'],
  });
});

it('inspects every worksheet and isolates only the sheet selected for the homonymous study', () => {
  // Sheet names and markers are the workbook-routing behavior under test.
  const bytes = buildXlsxWorkbook([
    { name: 'Canitas 2', rows: [
      ['API-CONFIG:language=es:software-id=canitas-2'],
      ['subject_id', 'Immunization.vaccine-code-text'],
      ['PACIENTE', 'VACUNA'],
      ['animal-1', 'rabia'],
    ] },
    { name: 'Pinol Vepahi', rows: [
      ['API-CONFIG:language=es:software-id=pinol-vepahi'],
      ['subject_id', 'Condition.code-text'],
      ['PACIENTE', 'DIAGNOSTICO'],
      ['animal-2', 'otitis'],
    ] },
  ]);

  expect(inspectResearchWorkbookSheets(bytes).map(({ sheetName, apiConfig }) => ({ sheetName, apiConfig }))).toEqual([
    { sheetName: 'Canitas 2', apiConfig: 'API-CONFIG:language=es:software-id=canitas-2' },
    { sheetName: 'Pinol Vepahi', apiConfig: 'API-CONFIG:language=es:software-id=pinol-vepahi' },
  ]);

  const isolated = readXlsxWorkbook(extractResearchWorkbookSheet(bytes, 'Pinol Vepahi'));
  expect(isolated).toEqual([{
    name: 'Pinol Vepahi',
    rows: [
      ['API-CONFIG:language=es:software-id=pinol-vepahi'],
      ['subject_id', 'Condition.code-text'],
      ['PACIENTE', 'DIAGNOSTICO'],
      ['animal-2', 'otitis'],
    ],
  }]);
});

it('fails closed when the requested ResearchStudy sheet does not exist', () => {
  expect(() => extractResearchWorkbookSheet(workbookBytes([['PATIENT'], ['one']]), 'Missing study'))
    .toThrow('Research workbook does not contain worksheet: Missing study');
});

it('keeps the first three non-empty samples per source column for mapping previews', () => {
  const result = inspectResearchWorkbook(workbookBytes([
    ['A', 'B'],
    ['one', ''],
    ['', 'first'],
    ['two', 'second'],
    ['three', 'third'],
    ['four', 'fourth'],
  ]));

  expect(result.sampleValuesBySourceField).toEqual({
    A: ['one', 'two', 'three'],
    B: ['first', 'second', 'third'],
  });
});

it('preserves source column positions when an embedded mapping column is blank', () => {
  const result = inspectResearchWorkbook(workbookBytes([
    ['API-CONFIG:language=es:dataUse=secondary'],
    ['subject_id', '', 'Condition.code-text'],
    ['CHIP', '', 'DIAGNOSTICO'],
    ['chip-1', 'ignored', 'Otitis'],
  ]));

  expect(result.sampleValuesBySourceField).toEqual({
    CHIP: ['chip-1'],
    DIAGNOSTICO: ['Otitis'],
  });
});

it('uses row one as source fields and removes already mapped choices', () => {
  const result = inspectResearchWorkbook(workbookBytes([
    ['CHIP', 'FECHA', 'DIAGNOSTICO'],
    ['chip-1', '2026-09-04', 'Otitis'],
  ]));

  expect(result.mode).toBe('manual-mapping');
  expect(result.dataHeaderRowIndex).toBe(1);
  expect(result.sourceFields).toEqual(['CHIP', 'FECHA', 'DIAGNOSTICO']);
  expect(availableResearchSourceFields(result.sourceFields, [
    { serverField: 'subject_id', sourceField: 'CHIP' },
    { serverField: 'date', sourceField: 'FECHA' },
  ])).toEqual(['DIAGNOSTICO']);
});
