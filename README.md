# DataConv Client SDK for TypeScript

DataConv TypeScript SDK for consuming the `adapter-ingestion-py`
pre-conversion API. It is distinct from the GDC, VetChain and GW SDKs and does
not depend on React or React Native.

## Table of contents

- [DataConv Client SDK for TypeScript](#dataconv-client-sdk-for-typescript)
  - [Table of contents](#table-of-contents)
  - [Features](#features)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Discover form fields](#discover-form-fields)
    - [Field selection tracking (UI dedup)](#field-selection-tracking-ui-dedup)
    - [React example: multi-dropdown dedup](#react-example-multi-dropdown-dedup)
  - [End-to-end flow](#end-to-end-flow)
  - [Human coding review in a portal](#human-coding-review-in-a-portal)
  - [Multipart / local file upload](#multipart--local-file-upload)
  - [Backend initialization](#backend-initialization)
  - [CLI](#cli)
    - [Recommended local setup (no IP/DID flags in commands)](#recommended-local-setup-no-ipdid-flags-in-commands)
    - [Command helper and endpoint-resolution conventions](#command-helper-and-endpoint-resolution-conventions)
    - [One-shot evidence script](#one-shot-evidence-script)
  - [Notes](#notes)

---

## Features

- Discover frontend field descriptors from `/.well-known/api-config.json`
- Track which fields have already been selected across UI dropdowns
- Tenant/software configuration creation and polling
- Excel/XLSX upload via DIDComm attachment or `multipart/form-data`
- `_upload-response` polling
- Promotion through `Composition/_patch` and `Patient/_batch`
- Tenant-scoped dataset search under `/publisher/.../dataset/{resourceType}/_search`
- Helpers to read the converted `Bundle` and keep the last received response

---

## Installation

```bash
npm install dataconv-client-sdk-ts
```

## Configuration

```bash
DATACONV_BASE_URL=http://localhost:8080
```

---

## Discover form fields

The client reads the API discovery document published by the server and returns frontend-ready field descriptors.

```ts
import { DataConvClient } from 'dataconv-client-sdk-ts';

const client = new DataConvClient({
  issuerDid: 'did:web:clinic.example:employee:loader',
  tenantId: 'VATES-B00000000',
  jurisdiction: 'ES',
  crypto: globalThis.crypto
});

const apiConfig = await client.getWellKnownApiConfig();

console.log(apiConfig.language); // "es"
console.log(apiConfig.fields);
// [
//   { code: 'section', display: 'Departamento o sección: ...' },
//   { code: 'coverage_insurer', display: 'Identificador o nombre de la aseguradora' }
// ]
```

The returned object includes:

| Property | Type | Description |
|---|---|---|
| `language` | `string` | Language code of the API config (`"es"`, ...) |
| `fields` | `{ code, display }[]` | Ready-to-use options for dropdowns |
| `supportedFields` | `Record<string, string>` | Raw `code → display` map |
| `endpoints` | `Record<string, string>` | Endpoint paths for `create`, `upload`, etc. |

The recommended frontend flow is:

1. Read `fields` from `getWellKnownApiConfig()`.
2. Let the user map spreadsheet columns to those field codes.
3. Submit `mappingConfig.fieldMap` using those same codes.

---

### Field selection tracking (UI dedup)

The SDK keeps a per-session set of already-selected field codes so the UI can prevent a user from assigning the same field to two different dropdowns.

| Method | Returns | Description |
|---|---|---|
| `selectField(code, mappedTo?)` | `boolean` | `true` if added, `false` if already selected |
| `unselectField(code)` | `boolean` | `true` if removed, `false` if not present |
| `isFieldSelected(code)` | `boolean` | Whether the code is currently selected |
| `getSelectedFieldCodes()` | `string[]` | All currently selected codes |
| `getSelectedFieldMappings()` | `Record<string, string>` | Map of selected field code → mapped source column |
| `getSelectedMappingForField(code)` | `string \| undefined` | Source column currently associated to the selected code |
| `clearSelectedFields()` | `void` | Reset selection state |

```ts
client.selectField('section');          // true
client.selectField('section');          // false → already selected
client.selectField('concept', 'CONCEPTO');
client.getSelectedMappingForField('concept'); // 'CONCEPTO'
client.isFieldSelected('section');      // true
client.unselectField('section');        // true
client.getSelectedFieldCodes();         // []
```

---

### React example: multi-dropdown dedup

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

    if (newCode && !client.selectField(newCode, columnKey)) {
      const mappedTo = client.getSelectedMappingForField(newCode);
      if (previousCode) {
        client.selectField(previousCode);
      }
      alert(`El campo ${newCode} ya ha sido seleccionado${mappedTo ? ` en ${mappedTo}` : ''}.`);
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

---

## End-to-end flow

Minimum steps to go from field discovery to promoted resources:

1. Discover fields and initialize the client.
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

For DIDComm polling responses, the SDK also exposes:

- `getMainDiagnosticInfoByResponse(response)` — reads `OperationOutcome.issue[0].diagnostics` from a response.
- `getMainDiagnosticInfo()` — reads it from the last stored config/conversion response.

---

## Human coding review in a portal

The current DataConv `_upload-response` returns one `ConversionResult` whose
`resource` is the complete generated Bundle. It does not expose a server page
or cursor. `getCodingReviewPage()` therefore creates a bounded (maximum 100
items), one-based local page from the `meta.codingProposals[]` entries already
present in that response. It does not modify the response object.

Each returned UI row identifies the subject, generated resource and proposal.
Its `state` is the server proposal state (`proposed` or `accepted`), while
`draftState` is derived from the resource's `<Resource>.userSelected` claim
(`draft`, `promoted` or `unknown`). No spreadsheet row number is exposed by the
current API, so the SDK does not manufacture one.

```ts
const page = client.getCodingReviewPage(conversionResponse, {
  page: 1,
  pageSize: 25
});

const selected = page.items[0];
const patchResponse = await client.patchConversion({
  thid: uploadResult.thid,
  softwareId: 'api-config',
  authorizationToken: '<review-token>',
  body: {
    codingReviews: [{
      resourceType: selected.resourceType,
      resourceId: selected.resourceId,
      proposalId: selected.proposalId,
      selectedCandidateId: selected.candidates[0].id,
      reason: 'Confirmed after reviewing the clinical row context'
    }]
  }
});
```

Only `body.codingReviews[]` is currently accepted for terminology corrections:
each decision selects one candidate already belonging to the proposal. The
server rejects unknown resources, proposals or candidates, materializes only
the selected code and English display, and then returns the promotion result
with `promotedCount`, `issues` and updated dataset entries.

---

## Multipart / local file upload

```ts
await client.uploadSpreadsheetMultipart({
  softwareId: 'qvet-v1.0',
  fileBytes: new Uint8Array([...]),
  fileName: 'exampleQvetES.xlsx'
});
```

---

## Backend initialization

If the backend instantiates the SDK after `Organization/_activate`, it can inject `axios` or `fetch`:

```ts
import axios from 'axios';
import { DataConvClient } from 'dataconv-client-sdk-ts';

const client = new DataConvClient({
  issuerDid: activatedOrganizationDid,
  tenantId: tenantAlternateName,
  jurisdiction: 'ES',
  httpClient: axios.create({ baseURL: process.env.DATACONV_BASE_URL }),
  crypto: globalThis.crypto
});

client.setVpToken(vpTokenFromActivation);
```

Also works with `fetch`:

```ts
const client = new DataConvClient({
  issuerDid: activatedOrganizationDid,
  tenantId: tenantAlternateName,
  jurisdiction: 'ES',
  fetch,
  crypto: globalThis.crypto
});
```

---

## CLI

The package exposes a CLI that can first create mapping config, then upload a file, wait for `_upload-response`, save the full DIDComm response to JSON, and print the main outcome summary.

### Local setup

Copy `.env.example` to `.env.local`, fill in your values, and source it before running commands:

```bash
cp .env.example .env.local
# edit .env.local: tenantId, issuerDid, base URL, DATACONV_ID_TOKEN
source .env.local
```

The helper script `scripts/evidencia-publicacion.sh` loads `.env.local` automatically (falls back to `.env.example`).

For advanced DID document-based endpoint resolution and full command reference, see [docs/cli-reference.md](docs/cli-reference.md).

```bash
# 1) login against your IdP (store OIDC id_token locally)
dataconv login --id-token "$DATACONV_ID_TOKEN"

# 2) exchange Bearer access token
dataconv exchange --scope "excel/_upload Subject/_search ChargeItem/_search DocumentReference/_search"

# 3) optional tenant-admin step: create a constrained API key
dataconv api-key-create --email ops@example.com --target "publisher/cds-es/v1/animal-care/vates-a00000001/dataset/*/*/_upload"

# 4) upload + automatic polling
dataconv upload ./examples/example-api-config.xlsx \
  --output-json ./artifacts/upload-response.json

# 5) optional: patch/batch after review, then search with Bearer token
dataconv search --resource-type DocumentReference --params '{"_count": 5}'

# optional alternative to patch
dataconv batch --thid "<thid-obtenido-de-upload>"
```

Output includes:

- exact public upload URL used
- Excel path and size in KB
- `Location` header from `_upload`
- `thid`
- exact polling URL used
- output JSON file path
- main `OperationOutcome.issue[0].description` when available (fallback: `diagnostics`)

When `--mapping-json` is provided to `upload`, CLI creates tenant mapping config first and polls `config/_create-response` before submitting the spreadsheet.

The CLI prints evidence-style process logs, for example:

- authentication/exchange against configured dataspace name
- upload accepted with `thid`
- automatic `_upload-response` polling
- final summary and JSON artifact path

### Command helper and endpoint-resolution conventions

Use per-command help to see expected conventions:

```bash
dataconv help exchange
dataconv help upload
dataconv search --help
```

Service IDs used as CLI resolution metadata:

- `exchange`: `#identity:openid:token:_exchange`
- `upload` (update): `#dataset:{softwareId}:{resourceType}:_upload`
- `patch` (publish): `#dataset:{softwareId}:{resourceType}:_patch`
- `batch` (publish): `#dataset:{softwareId}:{resourceType}:_batch`
- `search`: `#dataset:api:{resourceType}:_search`

Fallback env vars for localhost testing:

- `PUBLISHER_OPENID_EXCHANGE`
- `PUBLISHER_DATASET_UPDATE`
- `PUBLISHER_DATASET_PATCH`
- `PUBLISHER_DATASET_BATCH`
- `PUBLISHER_DATASET_SEARCH`

Important contract note:

- `--organization-did` and `--service-id` are stored as CLI-side endpoint-resolution context.
- The `/exchange` request body remains OpenAPI-compatible (no extra payload fields derived from service-id/fallback metadata).

### One-shot evidence script

Use the included helper to run login/exchange/upload/search in one shot:

```bash
chmod +x ./scripts/publish-dataset.sh
./scripts/evidencia-publicacion.sh

# opcional: forzar mapping JSON externo + promoción por batch
DATACONV_PUBLICACION_MAPPING_JSON=./examples/mappings/qvet-v1.json \
DATACONV_PUBLICACION_HEADER_ROW_INDEX=1 \
DATACONV_PROMOTION_MODE=batch \
./scripts/evidencia-publicacion.sh
```

Generated files:

- `./artifacts/datasets/upload-response.json`
- `./artifacts/datasets/search-subject.json`
- `./artifacts/datasets/search-documentreference.json`
- `./artifacts/datasets/dcat-files.json`

Notes on scope model and flow:

- You can request endpoint-action scopes (recommended for evaluator logs), e.g. `excel/_upload` or `DocumentReference/_search`.
- Backend accepts these action scopes as equivalent to coarse scopes (`dataconv.upload` / `dataconv.read`).
- `tenantId`, `jurisdiction`, `sector`, and `softwareId` are taken from env/profile defaults (recommended tenant format: `VATES-<NIF>`).
- API keys do **not** mint `id_token`s. The `id_token` always comes from the external IdP/login step.
- API keys are used at `/exchange` time to constrain or delegate scopes. The resulting Bearer `access_token` is what you use for config, upload, patch/batch, and search.
- For explicit exceptional non-confidential mode, send `api_key_profile=api-key-exception.v1` in `/exchange` payload (server must allow it).
- Recommended API key authorization model is atomic:
  - one rule entry (`data[].resource`) = one consent-like authorization rule = one ODRL policy object.
  - include `scope` (mandatory), and preferably `target` + `instrument` (ODRL).

When `--service-did` is used, resolve it locally with either `--resolved-base-url` or the `DATACONV_SERVICE_DID_MAP` env variable:

```bash
export DATACONV_SERVICE_DID_MAP='{"did:web:dataconv-api.example.org":"http://127.0.0.1:8080"}'
```

> **DEMO_MODE** — If the backend runs with `DEMO_MODE=true`, generate a test `id_token` without a real IdP:
>
> ```bash
> # genera un id_token demo (alg:none, solo requiere campo email en el payload)
> export DATACONV_ID_TOKEN=$(node -e '
> const h = Buffer.from(JSON.stringify({alg:"none",typ:"JWT"})).toString("base64url");
> const p = Buffer.from(JSON.stringify({email:"admin@example.com"})).toString("base64url");
> console.log(`${h}.${p}.`);
> ')
> # eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIn0.
> ```
>
> Use the token with `--authorization-bearer "$DATACONV_ID_TOKEN"`. No signature verification is performed in demo mode; only the `email` claim is required.

---

## Notes

- `tenantId` is the operational tenant identifier, typically the organization's VAT/taxId.
- `sector` is part of the public route for publisher config, dataset publication, and dataset search.
- `patchConversion()` defaults to `Composition/_patch`.
- `batchPromotion()` defaults to `Patient/_batch`.
- `searchResources()` resolves to `/publisher/cds-{jurisdiction}/v1/{sector}/{tenantId}/dataset/{resourceType}/_search`.
- Search parameter names are normalized to lowercase (`userSelected` → `userselected`).
- Search comparators are prefixed in the value: `ge2026-01-01`, `gt...`, `le...`, `lt...`.
- The backend may require `vp_token` and/or `id_token` depending on `PRECONV_AUTH_MODE`.
- CSV upload is modeled in the SDK but the current backend only accepts Excel/XLSX.
- `gdc-common-utils-ts` is an npm dependency; this SDK adds concrete pre-conversion types on top of those DIDComm helpers.
- ICA VCs and `controller.publicKeyJwk` belong to the `_activate` onboarding flow. `DataConvClient` is used afterwards, once the tenant is already activated.

## Roadmap and Briefing
- `BRIEFING_DATASPACE_EN.md`
- `TODO_ROADMAP.md`
