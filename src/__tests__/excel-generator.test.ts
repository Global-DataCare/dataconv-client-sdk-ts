import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';
import { generateTemplateExcel, getExcelTemplateData } from '../client/excel-generator';
import { SubjectFieldKeys, ProductFieldKeys } from '../field-maps';

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
    const workbook = xlsx.readFile(outputPath);

    // Verificar las hojas
    expect(workbook.SheetNames).toContain('Subject');
    expect(workbook.SheetNames).toContain('Product');
    expect(workbook.SheetNames).toContain('Invoice');
    expect(workbook.SheetNames).toContain('Document');

    // Verificar el contenido de una de las hojas
    const subjectSheet = workbook.Sheets['Subject'];
    const subjectData = xlsx.utils.sheet_to_json(subjectSheet) as any[];

    expect(subjectData.length).toBe(SubjectFieldKeys.length);
    expect(subjectData[0]).toHaveProperty('Parámetro Técnico', 'subject-id');
    expect(subjectData[0]).toHaveProperty('Descripción');
    // xlsx retiene el string vacío si la generamos así
    expect(subjectData[0]['Mapeo Cliente (Ej. Excel origen)']).toBe('');

    const productSheet = workbook.Sheets['Product'];
    const productData = xlsx.utils.sheet_to_json(productSheet) as any[];
    expect(productData.length).toBe(ProductFieldKeys.length);
  });
});