import * as xlsx from 'xlsx';
import { esDescriptions } from '../i18n/es.js';
import {
  SubjectFieldKeys,
  ProductFieldKeys,
  InvoiceFieldKeys,
  DocumentReferenceFieldKeys
} from '../field-maps.js';

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
  const workbook = xlsx.utils.book_new();

  const blocks = [
    { name: 'Subject', keys: SubjectFieldKeys },
    { name: 'Product', keys: ProductFieldKeys },
    { name: 'Invoice', keys: InvoiceFieldKeys },
    { name: 'Document', keys: DocumentReferenceFieldKeys },
  ];

  for (const block of blocks) {
    const data = getExcelTemplateData(block.keys, language);
    const worksheet = xlsx.utils.json_to_sheet(data);
    
    // Auto-ajustar el ancho de las columnas para que se vea bien
    const columnWidths = [
      { wch: 35 }, // Parámetro Técnico
      { wch: 35 }, // Mapeo Cliente
      { wch: 80 }  // Descripción
    ];
    worksheet['!cols'] = columnWidths;

    xlsx.utils.book_append_sheet(workbook, worksheet, block.name);
  }

  xlsx.writeFile(workbook, outputPath);
}