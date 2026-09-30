import { buildXlsxWorkbook, readXlsxWorkbook, type XlsxSheet } from './xlsx-codec.js';
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

function inspectSheet(sheet: XlsxSheet): DataConvResearchWorkbookInspection {
  const rows = sheet.rows;
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
      sheetName: sheet.name,
      sourceFields: sourceFields.filter(Boolean),
      mappings,
      sampleValuesBySourceField: sampleValues(rows, 2, sourceFields),
      // DataConv's schemaConfig uses one-based worksheet row numbers.
      dataHeaderRowIndex: 3
    };
  }
  return {
    mode: 'manual-mapping',
    sheetName: sheet.name,
    sourceFields: firstRow.filter(Boolean),
    mappings: [],
    sampleValuesBySourceField: sampleValues(rows, 0, firstRow.filter(Boolean)),
    dataHeaderRowIndex: 1
  };
}

/** Inspects every worksheet independently so callers can bind one sheet to one ResearchStudy. */
export function inspectResearchWorkbookSheets(bytes: Uint8Array): DataConvResearchWorkbookInspection[] {
  const sheets = readXlsxWorkbook(bytes);
  if (sheets.length === 0) throw new Error('Research workbook does not contain a worksheet');
  return sheets.map(inspectSheet);
}

/** Backward-compatible first-sheet inspection for single-study workbooks. */
export function inspectResearchWorkbook(bytes: Uint8Array): DataConvResearchWorkbookInspection {
  return inspectResearchWorkbookSheets(bytes)[0]!;
}

/** Produces a one-sheet XLSX so DataConv cannot ingest rows belonging to another ResearchStudy. */
export function extractResearchWorkbookSheet(bytes: Uint8Array, sheetName: string): Uint8Array {
  const requested = sheetName.trim();
  const sheet = readXlsxWorkbook(bytes).find((candidate) => candidate.name === requested);
  if (!sheet) throw new Error(`Research workbook does not contain worksheet: ${requested}`);
  return buildXlsxWorkbook([sheet]);
}

export function availableResearchSourceFields(
  sourceFields: string[],
  mappings: DataConvResearchFieldMapping[]
): string[] {
  const selected = new Set(mappings.map((mapping) => mapping.sourceField));
  return sourceFields.filter((field) => !selected.has(field));
}
