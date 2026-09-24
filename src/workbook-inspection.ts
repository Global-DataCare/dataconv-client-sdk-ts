import { readXlsxWorkbook } from './xlsx-codec.js';
import type {
  DataConvResearchFieldMapping,
  DataConvResearchWorkbookInspection
} from './types.js';

function cells(row: unknown[] | undefined): string[] {
  return (row || []).map((value) => String(value ?? '').trim());
}

function sampleValues(
  rows: unknown[][],
  headerRowIndex: number,
  sourceFields: string[]
): Record<string, string[]> {
  return Object.fromEntries(sourceFields.flatMap((sourceField, columnIndex) => {
    if (!sourceField) return [];
    const values: string[] = [];
    for (const row of rows.slice(headerRowIndex + 1)) {
      const value = String(row?.[columnIndex] ?? '').trim();
      if (value) values.push(value);
      if (values.length === 3) break;
    }
    return [[sourceField, values] as const];
  }));
}

export function inspectResearchWorkbook(bytes: Uint8Array): DataConvResearchWorkbookInspection {
  const firstSheet = readXlsxWorkbook(bytes)[0];
  if (!firstSheet) throw new Error('Research workbook does not contain a worksheet');
  const rows = firstSheet.rows;
  const firstRow = cells(rows[0]);
  const apiConfig = firstRow[0] || '';
  if (apiConfig.toUpperCase().startsWith('API-CONFIG')) {
    const serverFields = cells(rows[1]);
    const sourceFields = cells(rows[2]);
    const mappings = serverFields.flatMap((serverField, index) => {
      const sourceField = sourceFields[index] || '';
      return serverField && sourceField ? [{ serverField, sourceField }] : [];
    });
    return {
      mode: 'embedded-api-config',
      apiConfig,
      sheetName: firstSheet.name,
      sourceFields: sourceFields.filter(Boolean),
      mappings,
      sampleValuesBySourceField: sampleValues(rows, 2, sourceFields),
      // DataConv's schemaConfig uses one-based worksheet row numbers.
      dataHeaderRowIndex: 3
    };
  }
  return {
    mode: 'manual-mapping',
    sheetName: firstSheet.name,
    sourceFields: firstRow.filter(Boolean),
    mappings: [],
    sampleValuesBySourceField: sampleValues(rows, 0, firstRow.filter(Boolean)),
    dataHeaderRowIndex: 1
  };
}

export function availableResearchSourceFields(
  sourceFields: string[],
  mappings: DataConvResearchFieldMapping[]
): string[] {
  const selected = new Set(mappings.map((mapping) => mapping.sourceField));
  return sourceFields.filter((field) => !selected.has(field));
}
