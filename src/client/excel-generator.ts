import { writeFileSync } from 'node:fs';
import { esDescriptions } from '../i18n/es.js';
import {
  SubjectFieldKeys,
  ProductFieldKeys,
  InvoiceFieldKeys,
  DocumentReferenceFieldKeys
} from '../field-maps.js';
import { buildXlsxWorkbook } from '../xlsx-codec.js';

export function getExcelTemplateData(
  keys: readonly string[],
  language: 'es' = 'es'
): Array<{ 'Parámetro Técnico': string; 'Mapeo Cliente (Ej. Excel origen)': string; 'Descripción': string }> {
  const descriptions = language === 'es' ? esDescriptions : esDescriptions;

  return keys.map((key) => ({
    'Parámetro Técnico': key,
    'Mapeo Cliente (Ej. Excel origen)': '',
    'Descripción': descriptions[key as keyof typeof descriptions] || 'Sin descripción disponible.'
  }));
}

export function generateTemplateExcel(outputPath: string, language: 'es' = 'es'): void {
  const blocks = [
    { name: 'Subject', keys: SubjectFieldKeys },
    { name: 'Product', keys: ProductFieldKeys },
    { name: 'Invoice', keys: InvoiceFieldKeys },
    { name: 'Document', keys: DocumentReferenceFieldKeys },
  ];

  const sheets = blocks.map((block) => {
    const data = getExcelTemplateData(block.keys, language);
    return {
      name: block.name,
      rows: [
        ['Parámetro Técnico', 'Mapeo Cliente (Ej. Excel origen)', 'Descripción'],
        ...data.map((entry) => [
          entry['Parámetro Técnico'],
          entry['Mapeo Cliente (Ej. Excel origen)'],
          entry['Descripción']
        ])
      ]
    };
  });
  writeFileSync(outputPath, buildXlsxWorkbook(sheets));
}
