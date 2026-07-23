# DataConv CLI Reference

Quick reference for CLI commands, `serviceId` conventions, and fallback env vars.

---

## Quick start

```bash
cp .env.example .env.local
# fill in DATACONV_ID_TOKEN, tenantId, issuerDid, base URL
source .env.local

dataconv login --id-token "$DATACONV_ID_TOKEN"
dataconv exchange --scope "excel/_upload DocumentReference/_search"
dataconv upload ./data.xlsx --output-json ./artifacts/upload-response.json
dataconv search --resource-type DocumentReference --params '{"_count": 5}'
```

Use `dataconv help` or `dataconv <command> --help` at any time.

---

## Commands

### `login`

Store the OIDC `id_token` locally for subsequent commands.

```bash
dataconv login --id-token <jwt> [--vp-token <jwt>] [--base-url <url>] [--tenant-id <id>] [--software-id <id>]
```

### `exchange`

Exchange the stored `id_token` for a Bearer `access_token` via `/exchange`.

```bash
dataconv exchange --scope <scope> \
  [--vp-token <jwt>] \
  [--api-key <key>] \
  [--organization <org>] \
  [--organization-did <did:web:...>] \
  [--service-id <serviceId>] \
  [--operational-subject <did>]
```

- **`--organization-did`** and **`--service-id`** are CLI-side resolution metadata stored in state — they are **not** added to the `/exchange` request body.
- Canonical `serviceId`: `#identity:openid:token:_exchange`
- Fallback env var when no live DID document is reachable: `PUBLISHER_OPENID_EXCHANGE`

Route resolved: `/{tenantId}/cds-{jurisdiction}/v1/{sector}/identity/openid/Token/_exchange`

### `upload`

Upload a spreadsheet, wait for `_upload-response`, and save the full DIDComm response.

```bash
dataconv upload <ruta.xlsx> \
  [--scope <scope>] \
  [--mapping-json <path>] \
  [--header-row-index <n>] \
  [--output-json <path>]
```

- Canonical `serviceId`: `#dataset:{softwareId}:{resourceType}:_update`
- Fallback env var: `PUBLISHER_DATASET_UPDATE`
- Poll endpoint: taken from `Location` header (`publisher-dataset-update-response`).
- When `--mapping-json` is provided, CLI creates a tenant mapping config first and polls `config/_create-response`.

### `patch`

Confirm promotion of a reviewed upload thread via `Composition/_patch`.

```bash
dataconv patch --thid <thid> [--resource-type <FHIRType>] [--scope <scope>] [--output-json <path>]
```

- Canonical `serviceId`: `#dataset:{softwareId}:{resourceType}:_patch`
- Fallback env var: `PUBLISHER_DATASET_PATCH`

### `batch`

Publish aggregated resources via `Patient/_batch`.

```bash
dataconv batch --thid <thid> [--resource-type <FHIRType>] [--scope <scope>] [--output-json <path>]
```

- Canonical `serviceId`: `#dataset:{softwareId}:{resourceType}:_batch`
- Fallback env var: `PUBLISHER_DATASET_BATCH`

### `search`

Search promoted resources.

```bash
dataconv search --resource-type <FHIRType> \
  [--scope <scope>] \
  [--params <json>] \
  [--output-json <path>]
```

- Canonical `serviceId`: `#dataset:api:{resourceType}:_search` (`softwareId` fixed to `api`)
- Fallback env var: `PUBLISHER_DATASET_SEARCH`
- Route: `/publisher/cds-{jurisdiction}/v1/{sector}/{tenantId}/dataset/{resourceType}/_search`

### `api-key-create`

Create a constrained API key for a target endpoint path.

```bash
dataconv api-key-create --email <email> --target <endpointId> \
  [--scope <scope1,scope2>] \
  [--instrument <json>]
```

### `whoami`

Show current CLI state (stored identity, tokens, session, fallback URLs).

```bash
dataconv whoami
```

---

## `serviceId` conventions

| Command  | Canonical `serviceId`                                      | Fallback env var           |
|----------|------------------------------------------------------------|----------------------------|
| exchange | `#identity:openid:token:_exchange`                         | `PUBLISHER_OPENID_EXCHANGE` |
| upload   | `#dataset:{softwareId}:{resourceType}:_update`             | `PUBLISHER_DATASET_UPDATE`  |
| patch    | `#dataset:{softwareId}:{resourceType}:_patch`              | `PUBLISHER_DATASET_PATCH`   |
| batch    | `#dataset:{softwareId}:{resourceType}:_batch`              | `PUBLISHER_DATASET_BATCH`   |
| search   | `#dataset:api:{resourceType}:_search`                      | `PUBLISHER_DATASET_SEARCH`  |

`serviceId` values are looked up in the DID Document (`did.json`) of the target organization. Fallback env vars are only used when no live DID document is reachable (localhost testing). They are never sent in request payloads.

---

## Env var reference

### Core identity and routing

| Env var                       | Default                                     | Description                                 |
|-------------------------------|---------------------------------------------|---------------------------------------------|
| `DATACONV_DATASPACE_NAME`     | `GLOBAL-DATACARE`                           | Human-readable dataspace selector            |
| `DATACONV_DATASPACE_PROFILES` | —                                           | JSON map of named profiles (see below)       |
| `DATACONV_BASE_URL`           | `http://localhost:8080`                     | Publisher API base URL                       |
| `DATACONV_ISSUER_DID`         | `did:web:globaldatacare.es:employee:loader` | `iss` DID for DIDComm messages               |
| `DATACONV_TENANT_ID`          | `tenant-a`                                  | Tenant identifier (format: `VATES-<NIF>`)    |
| `DATACONV_JURISDICTION`       | `es`                                        | Jurisdiction code                            |
| `DATACONV_SECTOR`             | `onehealth-research`                        | Sector path segment                          |
| `DATACONV_SOFTWARE_ID`        | `qvet`                                      | Software/config ID                           |
| `DATACONV_RESOURCE_TYPE`      | `Composition`                               | Default FHIR resource type                   |
| `DATACONV_API_KEY`            | —                                           | API key passed to `/exchange`                |
| `DATACONV_SERVICE_ID`         | —                                           | Default `--service-id` for CLI state         |

### Endpoint fallbacks (localhost testing)

| Env var                     | `serviceId` target                           |
|-----------------------------|----------------------------------------------|
| `PUBLISHER_OPENID_EXCHANGE` | `#identity:openid:token:_exchange`           |
| `PUBLISHER_DATASET_UPDATE`  | `#dataset:{softwareId}:{resourceType}:_update` |
| `PUBLISHER_DATASET_PATCH`   | `#dataset:{softwareId}:{resourceType}:_patch`  |
| `PUBLISHER_DATASET_BATCH`   | `#dataset:{softwareId}:{resourceType}:_batch`  |
| `PUBLISHER_DATASET_SEARCH`  | `#dataset:api:{resourceType}:_search`          |

Set these to `http://127.0.0.1:8080` (or your local port) when running against a local instance that has no live DID document.

### Profile map (`DATACONV_DATASPACE_PROFILES`)

Optionally define named profiles to avoid passing flags on every command:

```bash
export DATACONV_DATASPACE_PROFILES='{
  "GLOBAL-DATACARE": {
    "baseUrl": "http://127.0.0.1:8080",
    "issuerDid": "did:web:globaldatacare.es:employee:loader",
    "tenantId": "VATES-B12345678",
    "jurisdiction": "es",
    "sector": "onehealth-research",
    "softwareId": "api-config",
    "resourceType": "excel"
  }
}'
```

Select the active profile with `--dataspace-name <name>` or `DATACONV_DATASPACE_NAME`.

---

## DID document resolution model

When `--organization-did` is set, the CLI attempts to resolve the DID document at:

```
https://<domain>/<path...>/.well-known/did.json
```

It then looks for a matching `service[].id` in the document. If resolution fails or the DID document is not reachable (localhost), it falls back to the corresponding `PUBLISHER_*` env var. The resolved or fallback URL becomes the base for that command's endpoint — it is **not** included in the request payload.

---

## API contract rule

`--organization-did`, `--service-id`, and fallback env vars influence **where** the CLI sends the request. They never alter the `/exchange` request body, which always conforms to the OpenAPI spec of `adapter-ingestion-py`.

---

## One-shot evidence script

```bash
chmod +x ./scripts/evidencia-publicacion.sh
./scripts/evidencia-publicacion.sh

# with explicit mapping + batch promotion
DATACONV_PUBLICACION_MAPPING_JSON=./examples/mappings/qvet-v1.json \
DATACONV_PUBLICACION_HEADER_ROW_INDEX=1 \
DATACONV_PROMOTION_MODE=batch \
./scripts/evidencia-publicacion.sh
```

Output artifacts: `./artifacts/evidencia-publicacion/`

---

## DEMO_MODE token (no real IdP)

When the backend runs with `DEMO_MODE=true`:

```bash
export DATACONV_ID_TOKEN=$(node -e '
  const h = Buffer.from(JSON.stringify({alg:"none",typ:"JWT"})).toString("base64url");
  const p = Buffer.from(JSON.stringify({email:"admin@example.com"})).toString("base64url");
  console.log(`${h}.${p}.`);
')
dataconv login --id-token "$DATACONV_ID_TOKEN"
```
