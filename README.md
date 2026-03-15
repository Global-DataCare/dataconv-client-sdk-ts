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

// 1. Create the tenant/software configuration.
const createResult = await client.createConfig({
  entries: [
    {
      softwareId: 'qvet-v1.0',
      config: {
        mappingConfig: {
          headerRowIndex: 1,
          fieldMap: {
            section: 'SECCION',
            family: 'FAMILIA',
            subfamily: 'SUBFAMILIA',
            concept: 'CONCEPTO',
            subjectId: 'HISTORIA_ID',
            species: 'ESPECIE',
            date: 'FECHA',
            time: 'HORA'
          }
        }
      }
    }
  ]
});

// 2. Wait until the configuration job completes.
const configResponse = await client.pollConfig({
  thid: createResult.thid
});

// 3. Upload the Excel or XLSX file for pre-conversion.
const uploadResult = await client.uploadWithLink(
  'https://example.com/exampleQvetES.xlsx?dl=1',
  {
    softwareId: 'qvet-v1.0',
    fileName: 'exampleQvetES.xlsx'
  }
);

// 4. Wait for the pre-conversion result.
const conversionResponse = await client.pollUploadResponse({
  thid: uploadResult.thid,
  softwareId: 'qvet-v1.0'
});

const convertedBundle = client.getConvertedBundle(conversionResponse);
const storedConfigs = client.getSuccessfulTenantConfigs(configResponse);

// 5. Confirm promotion of the reviewed thread.
const patchResponse = await client.patchConversion({
  thid: uploadResult.thid,
  softwareId: 'qvet-v1.0'
});

// 6. Publish aggregated resources in batch if your flow needs it.
const publicationResponse = await client.batchPromotion({
  thid: uploadResult.thid,
  softwareId: 'qvet-v1.0'
});

// 7. Search promoted resources using lowercase FHIR parameters.
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
