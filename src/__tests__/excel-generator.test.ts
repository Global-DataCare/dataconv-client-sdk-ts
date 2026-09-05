// Flow contract: generated XLSX templates remain interoperable and preserve every canonical mapping field without vulnerable SheetJS runtime code.

import * as fs from 'fs';
import * as path from 'path';
import { generateTemplateExcel, getExcelTemplateData } from '../client/excel-generator';
import { SubjectFieldKeys, ProductFieldKeys } from '../field-maps';
import { readXlsxWorkbook } from '../xlsx-codec';

describe('Excel Template Generator', () => {
  const outputDir = path.join(__dirname, '..', '..', 'tmp');
  const outputPath = path.join(outputDir, 'test-template.xlsx');

  beforeAll(() => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Limpieza (opcional)
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
  });

  it('generates an array of data correctly with spanish descriptions', () => {
    const data = getExcelTemplateData(SubjectFieldKeys, 'es');
    
    expect(data.length).toBe(SubjectFieldKeys.length);
    expect(data[0]['Parámetro Técnico']).toBe('subject-id');
    expect(data[0]['Mapeo Cliente (Ej. Excel origen)']).toBe('');
    expect(data[0]['Descripción']).toContain('Identificador único');
  });

  it('generates a physical Excel file with the expected sheets and rows', () => {
    // Generar el archivo
    generateTemplateExcel(outputPath, 'es');

    // Verificar que el archivo existe
    expect(fs.existsSync(outputPath)).toBe(true);

    // Leer el archivo generado y comprobar su estructura
    const workbook = readXlsxWorkbook(new Uint8Array(fs.readFileSync(outputPath)));

    // Verificar las hojas
    expect(workbook.map((sheet) => sheet.name)).toEqual(['Subject', 'Product', 'Invoice', 'Document']);

    // Verificar el contenido de una de las hojas
    const subjectData = workbook.find((sheet) => sheet.name === 'Subject')!.rows;

    expect(subjectData.length).toBe(SubjectFieldKeys.length + 1);
    expect(subjectData[0]).toEqual(['Parámetro Técnico', 'Mapeo Cliente (Ej. Excel origen)', 'Descripción']);
    expect(subjectData[1][0]).toBe('subject-id');
    expect(subjectData[1][1]).toBe('');
    expect(subjectData[1][2]).toBeTruthy();

    const productData = workbook.find((sheet) => sheet.name === 'Product')!.rows;
    expect(productData.length).toBe(ProductFieldKeys.length + 1);
  });
});
