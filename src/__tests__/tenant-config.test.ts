// Flow contract: a controller can copy one saved tenant mapping into a new named version without mutating the source configuration.

import { cloneTenantConfig } from '../tenant-config';

it('clones an editable mapping and preserves unrelated conversion settings', () => {
  const source = {
    id: 'cfg-1',
    tenantId: 'clinic-a',
    softwareId: 'pinol-vepahi-v1',
    revision: '3',
    content: {
      mappingConfig: {
        headerRowIndex: 3,
        fieldMap: {
          concept: 'Anamnesis',
          'DiagnosticReport.code-text': 'Diagnostico',
          'procedure_code-display': 'tratamiento',
        },
      },
      runtimeDefaults: { dataUse: 'secondary' },
    },
  };

  const cloned = cloneTenantConfig(source, {
    softwareId: 'pinol-vepahi-condition',
    softwareVersion: 'v2',
    mappings: [
      { serverField: 'concept', sourceField: 'Anamnesis' },
      { serverField: 'Condition.code-text', sourceField: 'Diagnostico' },
      { serverField: 'Procedure.code-text', sourceField: 'tratamiento' },
    ],
  });

  expect(cloned).toEqual({
    softwareId: 'pinol-vepahi-condition',
    softwareVersion: 'v2',
    config: {
      mappingConfig: {
        headerRowIndex: 3,
        fieldMap: {
          concept: 'Anamnesis',
          'Condition.code-text': 'Diagnostico',
          'Procedure.code-text': 'tratamiento',
        },
      },
      runtimeDefaults: { dataUse: 'secondary' },
    },
  });
  expect(source.content.mappingConfig.fieldMap['DiagnosticReport.code-text']).toBe('Diagnostico');
});
