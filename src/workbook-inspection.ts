import * as xlsx from 'xlsx';
import type {
  DataConvResearchFieldMapping,
  DataConvResearchWorkbookInspection
} from './types.js';

function cells(row: unknown[] | undefined): string[] {
  return (row || []).map((value) => String(value ?? '').trim());
}

export function inspectResearchWorkbook(bytes: Uint8Array): DataConvResearchWorkbookInspection {
  const workbook = xlsx.read(bytes, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('Research workbook does not contain a worksheet');
  const rows = xlsx.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheetName], {
    header: 1,
    raw: false,
    defval: ''
  });
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
      sourceFields: sourceFields.filter(Boolean),
      mappings,
      dataHeaderRowIndex: 2
    };
  }
  return {
    mode: 'manual-mapping',
    sourceFields: firstRow.filter(Boolean),
    mappings: [],
    dataHeaderRowIndex: 0
  };
}

export function availableResearchSourceFields(
  sourceFields: string[],
  mappings: DataConvResearchFieldMapping[]
): string[] {
  const selected = new Set(mappings.map((mapping) => mapping.sourceField));
  return sourceFields.filter((field) => !selected.has(field));
}
