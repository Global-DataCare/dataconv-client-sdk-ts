# DataConv Client SDK for TypeScript

SDK para consumir la API de preconversión de `adapter-ingestion-py`.

Incluye:

- creación y polling de configuración tenant/software
- subida de Excel/XLSX por DIDComm attachment o `multipart/form-data`
- polling de `_upload-response`
- helpers para leer el `Bundle` convertido y almacenar la última respuesta recibida

## Instalación

```bash
npm install dataconv-client-sdk-ts
```

## Configuración

```bash
DATACONV_BASE_URL=http://localhost:8080
```

## Uso básico

```ts
import { DataConvClient } from 'dataconv-client-sdk-ts';

const client = new DataConvClient({
  issuerDid: 'did:web:clinic.example:employee:...',
  alternateName: 'clinic-demo',
  tenantId: 'VATES-B00000000',
  jurisdiction: 'ES',
  crypto: globalThis.crypto
});

client.setIdToken('<id_token>');
client.setVpToken('<vp_token>');

const createResult = await client.createTenantConfig({
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

const configResponse = await client.pollTenantConfigResponse({
  thid: createResult.thid
});

const uploadResult = await client.uploadSpreadsheet(
  'https://example.com/exampleQvetES.xlsx?dl=1',
  {
    softwareId: 'qvet-v1.0',
    fileName: 'exampleQvetES.xlsx'
  }
);

const conversionResponse = await client.pollConversionResponse({
  thid: uploadResult.thid,
  softwareId: 'qvet-v1.0'
});

const convertedBundle = client.getConvertedBundle(conversionResponse);
const storedConfigs = client.getSuccessfulTenantConfigs(configResponse);
```

## Multipart

```ts
await client.uploadSpreadsheetMultipart({
  softwareId: 'qvet-v1.0',
  fileBytes: new Uint8Array([...]),
  fileName: 'exampleQvetES.xlsx'
});
```

## Inicializacion desde backend

Si el backend crea el SDK despues de `Organization/_activate`, puede inyectar `axios` o `fetch` igual que `ica-client-sdk-ts`.

```ts
import axios from 'axios';
import { DataConvClient } from 'dataconv-client-sdk-ts';

const httpClient = axios.create({
  baseURL: process.env.DATACONV_BASE_URL
});

const client = new DataConvClient({
  issuerDid: activatedOrganizationDid,
  alternateName: tenantAlternateName,
  tenantId: tenantAlternateName,
  jurisdiction: 'ES',
  httpClient,
  crypto: globalThis.crypto
});

client.setVpToken(vpTokenFromActivation);
```

Tambien funciona con `fetch`:

```ts
const client = new DataConvClient({
  issuerDid: activatedOrganizationDid,
  alternateName: tenantAlternateName,
  tenantId: tenantAlternateName,
  jurisdiction: 'ES',
  fetch,
  crypto: globalThis.crypto
});
```

## Notas

- Para llamadas de configuración y conversión, el identificador operativo del tenant debería ser `tenantId` y puede ser el VAT/taxId de la organización. `alternateName` queda como compatibilidad o alias.
- Las rutas de tenant configuration y conversion usan el sector fijo `onehealth-research`; la especialización funcional se controla por `softwareId`, no por `sector`.
- El servicio de preconversión ya puede exigir presencia de `vp_token` y/o `id_token` según `PRECONV_AUTH_MODE`, aunque hoy no valida todavía la firma ni el intercambio completo de sesión en `adapter-ingestion-py`.
- El backend actual todavía rechaza `source_format=csv`; el SDK lo modela porque la ruta existe, pero hoy el soporte real es Excel/XLSX.
- `gdc-common-utils-ts` se consume desde npm; este SDK añade los tipos concretos de preconversión encima de esos helpers DIDComm.
- Las VCs ICA y la `controller.publicKeyJwk` pertenecen al flujo de onboarding/`_activate` del backend. `DataConvClient` se instancia despues, cuando ya existe el tenant activado y solo hace falta invocar preconversion.
