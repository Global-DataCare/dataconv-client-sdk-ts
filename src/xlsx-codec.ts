import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export interface XlsxSheet {
  name: string;
  rows: unknown[][];
}

function xmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xmlDecode(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function columnName(index: number): string {
  let result = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  }
  return result;
}

function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0].toUpperCase() || 'A';
  return [...letters].reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0) - 1;
}

function worksheetXml(rows: unknown[][]): string {
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndexValue) => {
      const reference = `${columnName(columnIndexValue)}${rowIndex + 1}`;
      if (typeof value === 'number' && Number.isFinite(value)) {
        return `<c r="${reference}"><v>${value}</v></c>`;
      }
      const text = xmlEscape(value);
      return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

export function buildXlsxWorkbook(sheets: XlsxSheet[]): Uint8Array {
  if (sheets.length === 0) throw new Error('XLSX workbook requires at least one worksheet');
  const workbookSheets = sheets.map((sheet, index) =>
    `<sheet name="${xmlEscape(sheet.name.slice(0, 31))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  ).join('');
  const relationships = sheets.map((_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  ).join('');
  const overrides = sheets.map((_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('');
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`)
  };
  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheetXml(sheet.rows));
  });
  return zipSync(files, { level: 6 });
}

function attribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`(?:^|\\s)${name.replace(':', '\\:')}="([^"]*)"`));
  return match ? xmlDecode(match[1]) : undefined;
}

function textNodes(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => xmlDecode(match[1])).join('');
}

export function readXlsxWorkbook(bytes: Uint8Array): XlsxSheet[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('Research workbook is not a valid XLSX archive');
  }
  const workbookFile = files['xl/workbook.xml'];
  const relationshipFile = files['xl/_rels/workbook.xml.rels'];
  if (!workbookFile || !relationshipFile) throw new Error('Research workbook does not contain a workbook definition');
  const workbookXml = strFromU8(workbookFile);
  const relationshipXml = strFromU8(relationshipFile);
  const targets = new Map<string, string>();
  for (const match of relationshipXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attribute(match[0], 'Id');
    const target = attribute(match[0], 'Target');
    if (id && target) targets.set(id, target.replace(/^\//, '').replace(/^xl\//, ''));
  }
  const sharedStrings = files['xl/sharedStrings.xml']
    ? [...strFromU8(files['xl/sharedStrings.xml']).matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((match) => textNodes(match[1]))
    : [];
  const sheets: XlsxSheet[] = [];
  for (const match of workbookXml.matchAll(/<sheet\b[^>]*>/g)) {
    const name = attribute(match[0], 'name') || 'Sheet';
    const relationshipId = attribute(match[0], 'r:id');
    const target = relationshipId ? targets.get(relationshipId) : undefined;
    const sheetFile = target ? files[`xl/${target}`] : undefined;
    if (!sheetFile) continue;
    const rows: unknown[][] = [];
    const sheetXml = strFromU8(sheetFile);
    for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const row: unknown[] = [];
      for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const cellTag = `<c ${cellMatch[1]}>`;
        const index = columnIndex(attribute(cellTag, 'r') || 'A1');
        const type = attribute(cellTag, 't');
        const rawValue = cellMatch[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] || '';
        const value = type === 'inlineStr'
          ? textNodes(cellMatch[2])
          : type === 's'
            ? sharedStrings[Number.parseInt(rawValue, 10)] || ''
            : type === 'b'
              ? rawValue === '1'
              : rawValue === '' ? '' : Number.isNaN(Number(rawValue)) ? xmlDecode(rawValue) : Number(rawValue);
        while (row.length < index) row.push('');
        row[index] = value;
      }
      rows.push(row);
    }
    sheets.push({ name, rows });
  }
  return sheets;
}
