# DataConv Client SDK for TypeScript

TypeScript SDK for consuming the `adapter-ingestion-py` pre-conversion API.

It includes:

- tenant/software configuration creation and polling
- Excel/XLSX upload via DIDComm attachment or `multipart/form-data`
- `_upload-response` polling
- promotion through `Composition/_patch` and `Patient/_batch`
- tenant-scoped search under `/host/.../org.hl7.fhir.api/{resourceType}/_search`
- helpers to read the converted `Bundle` and keep the last received response

## Installation

```bash
npm install dataconv-client-sdk-ts
```

## Configuration

```bash
DATACONV_BASE_URL=http://localhost:8080
```

## Basic usage

Minimum end-to-end flow:

1. Initialize the client and tokens.
2. Create the tenant/software configuration.
3. Wait for `_create-response`.
4. Upload the Excel file.
5. Wait for `_upload-response`.
6. Review and promote with `_patch`.
7. Publish aggregated resources with `_batch` if needed.
8. Search promoted resources with `_search`.

```ts
import { DataConvClient } from 'dataconv-client-sdk-ts';

const client = new DataConvClient({
  issuerDid: 'did:web:clinic.example:employee:...',
  tenantId: 'VATES-B00000000',
  jurisdiction: 'ES',
  sector: 'onehealth-research',
  crypto: globalThis.crypto
});

client.setIdToken('<id_token>');
client.setVpToken('<vp_token>');

// 1. Discover frontend field descriptors from the API.
const apiConfig = await client.getWellKnownApiConfig();

// Example UI options:
const fieldOptions = apiConfig.fields;
// [
//   { code: 'section', display: 'Departamento o sección: ...' },
//   { code: 'family', display: 'Categoría de este registro...' },
//   ...
// ]

// 2. Create the tenant/software configuration using the current API field keys.
const createResult = await client.createConfig({
  entries: [
    {
      softwareId: 'api-config',
      config: {
        mappingConfig: {
          headerRowIndex: 3,
          fieldMap: {
            section: 'DEPARTAMENTO',
            family: 'CATEGORIA',
            subfamily: 'SUBCATEGORIA',
            concept: 'DESCRIPCION',
            subject_id: 'ID_INTERNO',
            subject_animal-species: 'ESPECIE',
            date: 'FECHA',
            observation_weight: 'PESO',
            coverage_insurer: 'ASEGURADORA'
          }
        }
      }
    }
  ]
});

// 3. Wait until the configuration job completes.
const configResponse = await client.pollConfig({
  thid: createResult.thid,
  softwareId: 'api-config'
});

// 4. Upload the Excel or XLSX file for pre-conversion.
const uploadResult = await client.uploadWithLink(
  'https://example.com/exampleQvetES.xlsx?dl=1',
  {
    softwareId: 'api-config',
    fileName: 'exampleQvetES.xlsx'
  }
);

// 5. Wait for the pre-conversion result.
const conversionResponse = await client.pollUploadResponse({
  thid: uploadResult.thid,
  softwareId: 'api-config'
});

const convertedBundle = client.getConvertedBundle(conversionResponse);
const mainDiagnostic = client.getMainDiagnosticInfoByResponse(conversionResponse);
const storedConfigs = client.getSuccessfulTenantConfigs(configResponse);

console.log(mainDiagnostic);

// 6. Confirm promotion of the reviewed thread.
const patchResponse = await client.patchConversion({
  thid: uploadResult.thid,
  softwareId: 'api-config'
});

// 7. Publish aggregated resources in batch if your flow needs it.
const publicationResponse = await client.batchPromotion({
  thid: uploadResult.thid,
  softwareId: 'api-config'
});

// 8. Search promoted resources using lowercase FHIR parameters.
const searchResponse = await client.searchResources({
  resourceType: 'DocumentReference',
  searchParams: {
    userselected: 'false',
    date: 'ge2026-01-01'
  }
});
```

## Multipart / local file upload

```ts
await client.uploadSpreadsheetMultipart({
  softwareId: 'qvet-v1.0',
  fileBytes: new Uint8Array([...]),
  fileName: 'exampleQvetES.xlsx'
});
```

## CLI evidence for real upload + polling

The package also exposes a CLI that performs a real upload call, waits for `_upload-response`, saves the full DIDComm response to JSON, and prints the main diagnostic summary.

```bash
dataconv-client \
  --service-did did:web:dataconv-api.example.org \
  --resolved-base-url http://127.0.0.1:8080 \
  --tenant-id demo-tenant \
  --software-id api-config \
  --resource-type Composition \
  --file ./examples/example-api-config.xlsx \
  --issuer-did did:web:organization.example.org:employee:loader \
  --authorization-bearer <token> \
  --output-json ./artifacts/appmypets-upload-response.json
```

The CLI prints:

- the exact public upload URL used
- the Excel path and size in KB
- the `Location` header returned by `_upload`
- the `thid`
- the exact polling URL used
- the output JSON file path
- the main diagnostic text from the final DIDComm response

This is useful when you need a reproducible console trace for a justification dossier without pasting the whole JSON response into the report.

When `--service-did` is used, the CLI can resolve it locally by either:

- passing `--resolved-base-url <url>`
- or defining `DATACONV_SERVICE_DID_MAP` as a JSON object, for example:

```bash
export DATACONV_SERVICE_DID_MAP='{"did:web:dataconv-api.example.org":"http://127.0.0.1:8080"}'
```

This keeps public examples neutral while still allowing local or temporary endpoint resolution outside the repository.

## Discover form fields from `/.well-known/api-config.json`

The client can read the API discovery document published by the server and return frontend-ready field descriptors.

```ts
const apiConfig = await client.getWellKnownApiConfig();

console.log(apiConfig.language); // "es"
console.log(apiConfig.fields);
// [
//   { code: 'section', display: 'Departamento o sección: ...' },
//   { code: 'coverage_insurer', display: 'Identificador o nombre de la aseguradora' }
// ]

const supportedFields = await client.getSupportedFields();

// Optional: track selection state for UI dropdown dedup checks.
if (!client.selectField('section')) {
  alert('Campo "section" ya seleccionado en otro dropdown');
}
if (!client.selectField('section')) {
  alert('No puedes seleccionar el mismo campo dos veces');
}

const uploadResponse = await client.uploadSpreadsheetAndWait(
  'https://example.com/AppMyPets-api-config.xlsx?dl=1',
  {
    softwareId: 'api-config',
    resourceType: 'Composition',
    fileName: 'AppMyPets-api-config.xlsx'
  }
);

const summaryText = client.getMainDiagnosticInfoByResponse(uploadResponse);
console.log(summaryText);
```

The returned object includes:

- `language`
- `supportedFields` as raw `code -> display`
- `fields` as `{ code, display }[]`
- `endpoints` for `create`, `createResponse`, `upload`, and `uploadResponse`

For DIDComm polling responses, the SDK also exposes:

- `getMainDiagnosticInfoByResponse(response)` to read the main `OperationOutcome.issue[0].diagnostics`
- `getMainDiagnosticInfo()` to read it from the last stored config/conversion response

The recommended frontend flow is:

1. Read `fields` from `/.well-known/api-config.json`.
2. Let the user map spreadsheet columns to those field codes.
3. Submit `mappingConfig.fieldMap` using those same codes.

### React example: avoid duplicate field selection across dropdowns

```tsx
import { useEffect, useMemo, useState } from 'react';
import { DataConvClient } from 'dataconv-client-sdk-ts';

const client = new DataConvClient({
  issuerDid: 'did:web:clinic.example:employee:loader',
  tenantId: 'VATES-B00000000',
  jurisdiction: 'ES',
  crypto: globalThis.crypto
});

type FieldOption = { code: string; display: string };

export function FieldMappingForm() {
  const [options, setOptions] = useState<FieldOption[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({
    colA: '',
    colB: '',
    colC: ''
  });

  useEffect(() => {
    let mounted = true;
    client.getSupportedFields().then((fields) => {
      if (mounted) setOptions(fields);
    });
    return () => {
      mounted = false;
      client.clearSelectedFields();
    };
  }, []);

  const selectedSet = useMemo(() => new Set(client.getSelectedFieldCodes()), [mapping]);

  const onChangeField = (columnKey: string, newCode: string) => {
    const previousCode = mapping[columnKey];
    if (previousCode) {
      client.unselectField(previousCode);
    }

    if (newCode && !client.selectField(newCode)) {
      if (previousCode) {
        client.selectField(previousCode);
      }
      alert(`El campo ${newCode} ya ha sido seleccionado anteriormente.`);
      return;
    }

    setMapping((current) => ({ ...current, [columnKey]: newCode }));
  };

  return (
    <>
      {Object.keys(mapping).map((columnKey) => (
        <select
          key={columnKey}
          value={mapping[columnKey]}
          onChange={(event) => onChangeField(columnKey, event.target.value)}
        >
          <option value="">Selecciona un campo</option>
          {options.map((field) => {
            const selectedInAnotherDropdown =
              selectedSet.has(field.code) && mapping[columnKey] !== field.code;
            return (
              <option key={field.code} value={field.code} disabled={selectedInAnotherDropdown}>
                {field.display}
              </option>
            );
          })}
        </select>
      ))}
    </>
  );
}
```

In this pattern:

- `selectField(code)` returns `false` when the code was already used.
- `unselectField(code)` frees a code when a dropdown changes value.
- `getSelectedFieldCodes()` helps disable options already selected elsewhere.

## Backend initialization

If the backend instantiates the SDK after `Organization/_activate`, it can inject `axios` or `fetch` just like `ica-client-sdk-ts`.

```ts
import axios from 'axios';
import { DataConvClient } from 'dataconv-client-sdk-ts';

const httpClient = axios.create({
  baseURL: process.env.DATACONV_BASE_URL
});

const client = new DataConvClient({
  issuerDid: activatedOrganizationDid,
  tenantId: tenantAlternateName,
  jurisdiction: 'ES',
  httpClient,
  crypto: globalThis.crypto
});

client.setVpToken(vpTokenFromActivation);
```

It also works with `fetch`:

```ts
const client = new DataConvClient({
  issuerDid: activatedOrganizationDid,
  tenantId: tenantAlternateName,
  jurisdiction: 'ES',
  fetch,
  crypto: globalThis.crypto
});
```

## Notes

- For configuration and conversion calls, the operational tenant identifier should be `tenantId`, typically the organization's VAT/taxId.
- `sector` is variable and is part of the public route for config, digital twin, and search.
- `patchConversion()` defaults to `Composition/_patch`.
- `batchPromotion()` defaults to `Patient/_batch`.
- `searchResources()` resolves to `/host/cds-{jurisdiction}/v1/{sector}/{tenantId}/org.hl7.fhir.api/{resourceType}/_search`.
- Parameter names sent by `searchResources()` are lowercase. Example: `userselected`, `date`.
- Even if the caller passes `userSelected`, the SDK normalizes it to `userselected` before sending the body.
- In `_search`, the current comparators are prefixed in the value: `ge2026-01-01`, `gt...`, `le...`, `lt...`.
- The pre-conversion service can already require `vp_token` and/or `id_token` depending on `PRECONV_AUTH_MODE`, although it does not yet validate signatures or the full session exchange in `adapter-ingestion-py`.
- The current backend still rejects `source_format=csv`; the SDK models it because the route exists, but real support today is Excel/XLSX.
- `gdc-common-utils-ts` is consumed from npm; this SDK adds the concrete pre-conversion types on top of those DIDComm helpers.
- ICA VCs and `controller.publicKeyJwk` belong to the backend onboarding/`_activate` flow. `DataConvClient` is instantiated afterwards, once the tenant is already activated and only pre-conversion calls are needed.
