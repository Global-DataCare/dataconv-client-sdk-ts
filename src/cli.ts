#!/usr/bin/env node

import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { DataConvClient } from './DataConvClient.js';

type MappingConfigPayload = {
  headerRowIndex?: number;
  fieldMap?: Record<string, string>;
  [key: string]: unknown;
};

type CliState = {
  dataspaceName?: string;
  baseUrl: string;
  issuerDid: string;
  tenantId: string;
  jurisdiction: string;
  sector: string;
  softwareId: string;
  resourceType: string;
  idToken?: string;
  vpToken?: string;
  sessionToken?: string;
  sessionScope?: string;
  sessionExpiresAt?: number;
  subject?: string;
  organization?: string;
  organizationDid?: string;
  serviceId?: string;
  publisherTokenExchangeFallback?: string;
  publisherDatasetUpdateFallback?: string;
  publisherDatasetPatchFallback?: string;
  publisherDatasetBatchFallback?: string;
  publisherDatasetSearchFallback?: string;
  apiKey?: string;
};

type DataspaceProfile = Partial<Pick<
  CliState,
  'baseUrl' | 'issuerDid' | 'tenantId' | 'jurisdiction' | 'sector' | 'softwareId' | 'resourceType'
>>;

function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  return args[index + 1];
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function usage(): string {
  return [
    'Usage: dataconv <command> [options]',
    '',
    'Commands:',
    '  dataconv login --id-token <jwt> [--base-url <url>] [--tenant-id <id>] [--software-id <id>]',
    '  dataconv exchange --scope "dataconv.upload" [--vp-token <jwt>] [--client-assertion <jwt>]',
    '                    [--api-key <key>] [--organization <org>] [--organization-did <did:web:...>] ',
    '                    [--service-id <publisher-token-exchange|...>] [--operational-subject <did>]',
    '  dataconv upload <ruta.xlsx> [--scope "dataconv.upload"] [--mapping-json <path>] [--header-row-index <n>] [--output-json <path>]',
    '  dataconv search --resource-type <FHIRType> [--scope "dataconv.read"] [--params <json>] [--output-json <path>]',
    '  dataconv patch --thid <thid> [--resource-type <FHIRType>] [--scope "dataconv.patch"] [--output-json <path>]',
    '  dataconv batch --thid <thid> [--resource-type <FHIRType>] [--scope "dataconv.batch"] [--output-json <path>]',
    '  dataconv api-key-create --email <email> --target <endpointId> [--scope <scope1,scope2>] [--instrument <json>]',
    '  dataconv whoami',
    '',
    'Common options:',
    '  --dataspace-name <name>      Default: DATACONV_DATASPACE_NAME or GLOBAL-DATACARE',
    '  --base-url <url>             Default: DATACONV_BASE_URL or http://localhost:8080',
    '  --issuer-did <did>           Default: DATACONV_ISSUER_DID or did:web:globaldatacare.es:employee:loader',
    '  --tenant-id <tenant>         Default: DATACONV_TENANT_ID or tenant-a',
    '  --jurisdiction <code>        Default: DATACONV_JURISDICTION or es',
    '  --sector <sector>            Default: DATACONV_SECTOR or onehealth-research',
    '  --software-id <software>     Default: DATACONV_SOFTWARE_ID or qvet',
    '  --resource-type <type>       Default: DATACONV_RESOURCE_TYPE or Composition',
    '  --state-file <path>          Default: ~/.dataconv/state.json',
    '  --api-key <key>              Default: DATACONV_API_KEY',
    '  --help'
  ].join('\n');
}

function commandHelp(command?: string): string {
  const common = [
    'Common options:',
    '  --dataspace-name <name>      Default: DATACONV_DATASPACE_NAME or GLOBAL-DATACARE',
    '  --base-url <url>             Default: DATACONV_BASE_URL or http://localhost:8080',
    '  --issuer-did <did>           Default: DATACONV_ISSUER_DID or did:web:globaldatacare.es:employee:loader',
    '  --tenant-id <tenant>         Default: DATACONV_TENANT_ID or tenant-a',
    '  --jurisdiction <code>        Default: DATACONV_JURISDICTION or es',
    '  --sector <sector>            Default: DATACONV_SECTOR or onehealth-research',
    '  --software-id <software>     Default: DATACONV_SOFTWARE_ID or qvet',
    '  --resource-type <type>       Default: DATACONV_RESOURCE_TYPE or Composition',
    '  --state-file <path>          Default: ~/.dataconv/state.json',
    '  --api-key <key>              Default: DATACONV_API_KEY',
  ].join('\n');

  const exchange = [
    'Command: exchange',
    '  dataconv exchange --scope <scope> [--organization <org>] [--organization-did <did:web:...>] [--service-id <id>] [--operational-subject <did>]',
    '',
    'Notes:',
    '  - serviceId recomendado: #identity:openid:token:_exchange',
    '  - Respeta contrato OpenAPI: el payload de /exchange NO se altera con service-id ni fallbacks.',
    '  - --organization-did y --service-id se guardan en estado CLI para resolución de endpoints fuera de payload.',
    '  - DID document objetivo para pruebas: <did-web>/.well-known/did.json',
    '',
    'Fallback env vars (localhost testing):',
    '  PUBLISHER_OPENID_EXCHANGE',
    '  PUBLISHER_DATASET_UPDATE',
    '  PUBLISHER_DATASET_PATCH',
    '  PUBLISHER_DATASET_BATCH',
    '  PUBLISHER_DATASET_SEARCH',
  ].join('\n');

  const upload = [
    'Command: upload',
    '  dataconv upload <ruta.xlsx> [--scope <scope>] [--mapping-json <path>] [--header-row-index <n>] [--output-json <path>]',
    '',
    'Expected serviceId: #dataset:{softwareId}:{resourceType}:_update',
    'Response endpoint: se toma del header Location (publisher-dataset-update-response).',
  ].join('\n');

  const patch = [
    'Command: patch',
    '  dataconv patch --thid <thid> [--resource-type <FHIRType>] [--scope <scope>] [--output-json <path>]',
    '',
    'Expected serviceId: #dataset:{softwareId}:{resourceType}:_patch',
  ].join('\n');

  const batch = [
    'Command: batch',
    '  dataconv batch --thid <thid> [--resource-type <FHIRType>] [--scope <scope>] [--output-json <path>]',
    '',
    'Expected serviceId: #dataset:{softwareId}:{resourceType}:_batch',
  ].join('\n');

  const search = [
    'Command: search',
    '  dataconv search --resource-type <FHIRType> [--scope <scope>] [--params <json>] [--output-json <path>]',
    '',
    'Expected serviceId: #dataset:api:{resourceType}:_search',
  ].join('\n');

  const login = [
    'Command: login',
    '  dataconv login --id-token <jwt> [--base-url <url>] [--tenant-id <id>] [--software-id <id>] [--vp-token <jwt>]',
  ].join('\n');

  const apiKeyCreate = [
    'Command: api-key-create',
    '  dataconv api-key-create --email <email> --target <endpointId> [--scope <scope1,scope2>] [--instrument <json>]',
  ].join('\n');

  const whoami = [
    'Command: whoami',
    '  dataconv whoami',
  ].join('\n');

  const byCommand: Record<string, string> = {
    login,
    exchange,
    upload,
    patch,
    batch,
    search,
    'api-key-create': apiKeyCreate,
    whoami,
  };

  const key = String(command || '').trim();
  if (!key) {
    return `${usage()}\n\n${common}\n\nUse: dataconv help <command>`;
  }
  return `${byCommand[key] || `Comando no soportado: ${key}`}\n\n${common}`;
}

function parseObjectJson(value: string | undefined, fieldName: string): Record<string, unknown> | undefined {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    throw new Error('debe ser un objeto JSON');
  } catch (error) {
    throw new Error(`${fieldName} inválido: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function getDataspaceProfilesFromEnv(): Record<string, DataspaceProfile> {
  const raw = String(process.env.DATACONV_DATASPACE_PROFILES || '').trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, DataspaceProfile>;
  } catch {
    return {};
  }
}

function resolveDataspaceName(args: string[], currentState?: CliState): string {
  return (
    getArgValue(args, '--dataspace-name')
    || process.env.DATACONV_DATASPACE_NAME
    || currentState?.dataspaceName
    || 'GLOBAL-DATACARE'
  ).trim();
}

function resolveDataspaceProfile(args: string[], currentState?: CliState): { dataspaceName: string; profile: DataspaceProfile } {
  const dataspaceName = resolveDataspaceName(args, currentState);
  const profiles = getDataspaceProfilesFromEnv();
  const profile = profiles[dataspaceName] || {};
  return { dataspaceName, profile };
}

function nowStamp(): string {
  return new Date().toISOString();
}

function logInfo(message: string): void {
  console.log(`[${nowStamp()}] INFO  ${message}`);
}

function logSuccess(message: string): void {
  console.log(`[${nowStamp()}] INFO  ✔ ${message}`);
}

function parseHeaderRowIndex(value: string | undefined): number | undefined {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('--header-row-index debe ser un entero >= 1');
  }
  return parsed;
}

function toMappingConfigPayload(value: unknown): MappingConfigPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('mapping-json debe ser un objeto JSON');
  }

  const obj = value as Record<string, unknown>;
  if (obj.mappingConfig && typeof obj.mappingConfig === 'object' && !Array.isArray(obj.mappingConfig)) {
    return obj.mappingConfig as MappingConfigPayload;
  }

  if (obj.schemaConfig && typeof obj.schemaConfig === 'object' && !Array.isArray(obj.schemaConfig)) {
    return obj.schemaConfig as MappingConfigPayload;
  }

  if (obj.fieldMap && typeof obj.fieldMap === 'object' && !Array.isArray(obj.fieldMap)) {
    return {
      ...obj,
      fieldMap: obj.fieldMap as Record<string, string>
    };
  }

  return {
    fieldMap: obj as Record<string, string>
  };
}

async function loadMappingConfigFromFile(filePath: string, headerRowIndex?: number): Promise<MappingConfigPayload> {
  const absolutePath = path.resolve(filePath);
  const raw = await readFile(absolutePath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`No se pudo parsear mapping-json: ${error instanceof Error ? error.message : String(error)}`);
  }

  const mappingConfig = toMappingConfigPayload(parsed);
  if (headerRowIndex !== undefined) {
    mappingConfig.headerRowIndex = headerRowIndex;
  }

  if (!mappingConfig.fieldMap || typeof mappingConfig.fieldMap !== 'object' || Array.isArray(mappingConfig.fieldMap)) {
    throw new Error('mapping-json debe incluir fieldMap (objeto clave=campo API, valor=columna Excel)');
  }

  return mappingConfig;
}

function parseCsv(value: string | undefined): string[] {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaultStatePath(explicitPath?: string): string {
  const value = String(explicitPath || '').trim();
  if (value) return path.resolve(value);
  return path.join(homedir(), '.dataconv', 'state.json');
}

function parseCommonArgs(args: string[], base?: Partial<CliState>): CliState {
  const { dataspaceName, profile } = resolveDataspaceProfile(args, base as CliState | undefined);
  return {
    dataspaceName,
    baseUrl: getArgValue(args, '--base-url') || base?.baseUrl || String(profile.baseUrl || '').trim() || process.env.DATACONV_BASE_URL || 'http://localhost:8080',
    issuerDid: getArgValue(args, '--issuer-did') || base?.issuerDid || String(profile.issuerDid || '').trim() || process.env.DATACONV_ISSUER_DID || 'did:web:globaldatacare.es:employee:loader',
    tenantId: getArgValue(args, '--tenant-id') || base?.tenantId || String(profile.tenantId || '').trim() || process.env.DATACONV_TENANT_ID || 'tenant-a',
    jurisdiction: getArgValue(args, '--jurisdiction') || base?.jurisdiction || String(profile.jurisdiction || '').trim() || process.env.DATACONV_JURISDICTION || 'es',
    sector: getArgValue(args, '--sector') || base?.sector || String(profile.sector || '').trim() || process.env.DATACONV_SECTOR || 'onehealth-research',
    softwareId: getArgValue(args, '--software-id') || base?.softwareId || String(profile.softwareId || '').trim() || process.env.DATACONV_SOFTWARE_ID || 'qvet',
    resourceType: getArgValue(args, '--resource-type') || base?.resourceType || String(profile.resourceType || '').trim() || process.env.DATACONV_RESOURCE_TYPE || 'Composition',
    idToken: base?.idToken,
    vpToken: base?.vpToken,
    sessionToken: base?.sessionToken,
    sessionScope: base?.sessionScope,
    sessionExpiresAt: base?.sessionExpiresAt,
    subject: base?.subject,
    organization: base?.organization,
    organizationDid: base?.organizationDid,
    serviceId: getArgValue(args, '--service-id') || base?.serviceId || process.env.DATACONV_SERVICE_ID || undefined,
    publisherTokenExchangeFallback: base?.publisherTokenExchangeFallback || process.env.PUBLISHER_OPENID_EXCHANGE || undefined,
    publisherDatasetUpdateFallback: base?.publisherDatasetUpdateFallback || process.env.PUBLISHER_DATASET_UPDATE || undefined,
    publisherDatasetPatchFallback: base?.publisherDatasetPatchFallback || process.env.PUBLISHER_DATASET_PATCH || undefined,
    publisherDatasetBatchFallback: base?.publisherDatasetBatchFallback || process.env.PUBLISHER_DATASET_BATCH || undefined,
    publisherDatasetSearchFallback: base?.publisherDatasetSearchFallback || process.env.PUBLISHER_DATASET_SEARCH || undefined,
    apiKey: getArgValue(args, '--api-key') || base?.apiKey || process.env.DATACONV_API_KEY || undefined
  };
}



async function loadState(statePath: string): Promise<CliState | undefined> {
  try {
    const raw = await readFile(statePath, 'utf-8');
    const parsed = JSON.parse(raw) as CliState;
    return parsed;
  } catch {
    return undefined;
  }
}

async function saveState(statePath: string, state: CliState): Promise<void> {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return {};
  try {
    const padded = parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4);
    const json = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    return typeof parsed === 'object' && parsed ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function normalizeEmail(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function hashEmailSameAs(email: string): string {
  return createHash('sha256').update(normalizeEmail(email), 'utf-8').digest('hex').toLowerCase();
}

function jwtHs256(payload: Record<string, unknown>, secret: string, kid?: string): string {
  const header: Record<string, unknown> = { alg: 'HS256', typ: 'JWT' };
  if (kid) header.kid = kid;
  const headerRaw = Buffer.from(JSON.stringify(header), 'utf-8').toString('base64url');
  const payloadRaw = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const signingInput = `${headerRaw}.${payloadRaw}`;
  const signature = createHmac('sha256', secret).update(signingInput, 'utf-8').digest('base64url');
  return `${signingInput}.${signature}`;
}

function buildDevVpToken(idToken: string, holderDid: string): string {
  const idClaims = decodeJwtPayload(idToken);
  const email = String(idClaims.email || idClaims.preferred_username || idClaims.upn || '').trim();
  if (!email) {
    throw new Error('No email found in id_token; provide --vp-token manually or DATACONV_VP_TOKEN');
  }
  const now = Math.floor(Date.now() / 1000);
  const vc = {
    credentialSubject: {
      id: process.env.DATACONV_OPERATIONAL_SUBJECT_DID || holderDid,
      sameAs: hashEmailSameAs(email),
      organization: process.env.DATACONV_ORGANIZATION || '',
      scopes: ['dataconv.upload', 'dataconv.read']
    }
  };
  return jwtHs256(
    {
      iss: holderDid,
      sub: holderDid,
      jti: randomUUID(),
      iat: now,
      exp: now + 300,
      vp: {
        holder: holderDid,
        verifiableCredential: [vc]
      }
    },
    process.env.DATACONV_WALLET_SHARED_SECRET || 'dev-wallet-secret',
    process.env.DATACONV_WALLET_KID || 'wallet-key-1'
  );
}

function buildClientAssertion(baseUrl: string, holderDid: string, vpToken: string): string {
  const vpClaims = decodeJwtPayload(vpToken);
  const now = Math.floor(Date.now() / 1000);
  return jwtHs256(
    {
      iss: holderDid,
      sub: holderDid,
      aud: `${baseUrl.replace(/\/+$/, '')}/exchange`,
      iat: now,
      exp: now + 300,
      jti: randomUUID(),
      vp_jti: String(vpClaims.jti || '')
    },
    process.env.DATACONV_WALLET_SHARED_SECRET || 'dev-wallet-secret',
    process.env.DATACONV_WALLET_KID || 'wallet-key-1'
  );
}

function isSessionValid(state: CliState | undefined): boolean {
  if (!state?.sessionToken || !state.sessionExpiresAt) return false;
  return state.sessionExpiresAt > Date.now() + 5000;
}

async function cmdLogin(args: string[], statePath: string, currentState?: CliState): Promise<void> {
  const base = parseCommonArgs(args, currentState);
  const idToken = getArgValue(args, '--id-token') || process.env.DATACONV_ID_TOKEN || currentState?.idToken;
  if (!idToken) {
    throw new Error('login requiere --id-token o DATACONV_ID_TOKEN');
  }
  const vpToken = getArgValue(args, '--vp-token') || process.env.DATACONV_VP_TOKEN || currentState?.vpToken;
  const state: CliState = {
    ...base,
    idToken,
    vpToken,
    sessionToken: undefined,
    sessionScope: undefined,
    sessionExpiresAt: undefined,
    apiKey: base.apiKey,
  };
  await saveState(statePath, state);
  const claims = decodeJwtPayload(idToken);
  const email = String(claims.email || claims.preferred_username || claims.upn || '').trim();
  logInfo(`Identidad preparada para ${state.dataspaceName || 'GLOBAL-DATACARE'}`);
  if (email) {
    logSuccess(`Usuario autenticado localmente: ${email}`);
  }
  console.log(`Login guardado en ${statePath}`);
}

async function cmdExchange(args: string[], statePath: string, currentState?: CliState): Promise<void> {
  const state = parseCommonArgs(args, currentState);
  if (!state.idToken) {
    throw new Error('No hay id_token local. Ejecuta primero dataconv login.');
  }

  const scope = getArgValue(args, '--scope') || 'dataconv.upload';
  const holderDid = process.env.DATACONV_WALLET_DID || state.issuerDid;
  const vpToken = getArgValue(args, '--vp-token') || process.env.DATACONV_VP_TOKEN || state.vpToken || buildDevVpToken(state.idToken, holderDid);
  const clientAssertion = getArgValue(args, '--client-assertion') || process.env.DATACONV_CLIENT_ASSERTION || buildClientAssertion(state.baseUrl, holderDid, vpToken);
  const organization = getArgValue(args, '--organization') || process.env.DATACONV_ORGANIZATION || state.organization || '';
  const organizationDid = getArgValue(args, '--organization-did') || process.env.DATACONV_ORGANIZATION_DID || state.organizationDid || '';
  const serviceId = getArgValue(args, '--service-id') || process.env.DATACONV_SERVICE_ID || state.serviceId || '';
  const operationalSubject = getArgValue(args, '--operational-subject') || process.env.DATACONV_OPERATIONAL_SUBJECT_DID || state.subject || '';

  const client = new DataConvClient({
    issuerDid: state.issuerDid,
    alternateName: state.tenantId,
    tenantId: state.tenantId,
    jurisdiction: state.jurisdiction,
    sector: state.sector,
    baseUrl: state.baseUrl,
    idToken: state.idToken,
    vpToken
  });

  const exchanged = await client.exchangeToken({
    subjectToken: state.idToken,
    vpToken,
    clientAssertion,
    scope,
    apiKey: state.apiKey,
    organization,
    operationalSubject
  });

  const expiresAt = Date.now() + Number(exchanged.expires_in || 0) * 1000;
  const nextState: CliState = {
    ...state,
    vpToken,
    sessionToken: String(exchanged.access_token || ''),
    sessionScope: String(exchanged.scope || scope),
    sessionExpiresAt: expiresAt,
    subject: String(exchanged.subject || ''),
    organization: String(exchanged.organization || ''),
    organizationDid: organizationDid || undefined,
    serviceId: serviceId || undefined,
    publisherTokenExchangeFallback: state.publisherTokenExchangeFallback,
    publisherDatasetUpdateFallback: state.publisherDatasetUpdateFallback,
    publisherDatasetPatchFallback: state.publisherDatasetPatchFallback,
    publisherDatasetBatchFallback: state.publisherDatasetBatchFallback,
    publisherDatasetSearchFallback: state.publisherDatasetSearchFallback,
    apiKey: state.apiKey,
  };
  await saveState(statePath, nextState);
  logInfo(`Autenticando con ${state.dataspaceName || 'GLOBAL-DATACARE'} (OAuth 2.0)...`);
  if (organizationDid) {
    logInfo(`organizationDid=${organizationDid}`);
  }
  if (serviceId) {
    logInfo(`serviceId=${serviceId}`);
  }
  if (state.publisherTokenExchangeFallback) {
    logInfo(`fallback token-exchange=${state.publisherTokenExchangeFallback}`);
  }
  logSuccess(`Token de sesión obtenido. scope=${nextState.sessionScope} exp=${new Date(expiresAt).toISOString()}`);
}

async function cmdUpload(args: string[], statePath: string, currentState?: CliState): Promise<void> {
  const sourcePath = args[0];
  if (!sourcePath || sourcePath.startsWith('--')) {
    throw new Error('upload requiere ruta de archivo .xlsx');
  }

  let state = parseCommonArgs(args, currentState);
  const requestedScope = getArgValue(args, '--scope') || `${state.resourceType}/_upload`;
  if (!isSessionValid(state)) {
    const exchangeArgs = ['--scope', requestedScope];
    if (state.apiKey) {
      exchangeArgs.push('--api-key', state.apiKey);
    }
    await cmdExchange(exchangeArgs, statePath, state);
    state = (await loadState(statePath)) || state;
  }
  if (!state.sessionToken) {
    throw new Error('No hay session token válido para upload');
  }

  const outputJson = getArgValue(args, '--output-json') || './artifacts/dataconv-upload-response-cli.json';
  const mappingJsonPath = getArgValue(args, '--mapping-json');
  const headerRowIndex = parseHeaderRowIndex(getArgValue(args, '--header-row-index'));
  const fileBytes = new Uint8Array(await readFile(sourcePath));
  const fileName = path.basename(sourcePath);
  const fileSizeMb = (fileBytes.byteLength / (1024 * 1024)).toFixed(2);

  const client = new DataConvClient({
    issuerDid: state.issuerDid,
    alternateName: state.tenantId,
    tenantId: state.tenantId,
    jurisdiction: state.jurisdiction,
    sector: state.sector,
    baseUrl: state.baseUrl,
    idToken: state.idToken,
    vpToken: state.vpToken,
    retryTimes: Number(process.env.DATACONV_RETRY_TIMES || 60),
    retryDelayMs: Number(process.env.DATACONV_RETRY_DELAY_MS || 2000)
  });

  if (mappingJsonPath) {
    logInfo('Validando y aplicando mapping de configuración...');
    const mappingConfig = await loadMappingConfigFromFile(mappingJsonPath, headerRowIndex);
    const configResponse = await client.createTenantConfigAndWait({
      tenantId: state.tenantId,
      jurisdiction: state.jurisdiction,
      sector: state.sector,
      softwareId: state.softwareId,
      iss: state.issuerDid,
      idToken: state.idToken,
      vpToken: state.vpToken,
      entries: [
        {
          softwareId: state.softwareId,
          config: {
            mappingConfig,
          }
        }
      ]
    });
    const configSummaryIssue = client.getMainIssueDescriptionByResponse(configResponse)
      || client.getMainDiagnosticInfoByResponse(configResponse)
      || '';
    console.log(`Config mapping aplicada para softwareId=${state.softwareId}`);
    if (configSummaryIssue) {
      console.log(`Config summary: ${configSummaryIssue}`);
    }
  }

  logInfo(`Subiendo dataset a ${state.dataspaceName || 'GLOBAL-DATACARE'} (${fileName}, ${fileSizeMb} MB)...`);

  const uploadResult = await client.uploadWithFile({
    softwareId: state.softwareId,
    resourceType: state.resourceType,
    fileBytes,
    fileName,
    authorizationToken: state.sessionToken,
    idToken: state.idToken,
    vpToken: state.vpToken,
    iss: state.issuerDid,
  });

  logSuccess(`Upload aceptado. thid=${uploadResult.thid}`);
  logInfo('Esperando resultado de conversión (_upload-response)...');

  const response = await client.pollUploadResponse({
    softwareId: state.softwareId,
    resourceType: state.resourceType,
    thid: uploadResult.thid,
    authorizationToken: state.sessionToken,
    idToken: state.idToken,
    vpToken: state.vpToken,
    iss: state.issuerDid,
  });

  const outputPath = path.resolve(outputJson);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(response, null, 2), 'utf-8');

  const summaryIssue = client.getMainIssueDescriptionByResponse(response)
    || client.getMainDiagnosticInfoByResponse(response)
    || '';
  logSuccess('PUBLICACIÓN COMPLETADA — dataset procesado');
  console.log(`Upload thid=${uploadResult.thid}`);
  console.log(`Respuesta guardada en ${outputPath}`);
  console.log(`Resumen: ${summaryIssue}`);
}

async function cmdSearch(args: string[], statePath: string, currentState?: CliState): Promise<void> {
  let state = parseCommonArgs(args, currentState);
  const resourceType = getArgValue(args, '--resource-type') || state.resourceType || 'DocumentReference';
  const requestedScope = getArgValue(args, '--scope') || `${resourceType}/_search`;
  if (!isSessionValid(state)) {
    const exchangeArgs = ['--scope', requestedScope];
    if (state.apiKey) {
      exchangeArgs.push('--api-key', state.apiKey);
    }
    await cmdExchange(exchangeArgs, statePath, state);
    state = (await loadState(statePath)) || state;
  }
  if (!state.sessionToken) {
    throw new Error('No hay session token válido para search');
  }

  const params = parseObjectJson(getArgValue(args, '--params'), '--params') || {};
  const outputJson = getArgValue(args, '--output-json');

  const client = new DataConvClient({
    issuerDid: state.issuerDid,
    alternateName: state.tenantId,
    tenantId: state.tenantId,
    jurisdiction: state.jurisdiction,
    sector: state.sector,
    baseUrl: state.baseUrl,
    idToken: state.idToken,
    vpToken: state.vpToken,
  });

  logInfo(`Buscando ${resourceType} en ${state.dataspaceName || 'GLOBAL-DATACARE'}...`);
  const bundle = await client.searchResources({
    tenantId: state.tenantId,
    jurisdiction: state.jurisdiction,
    sector: state.sector,
    resourceType,
    authorizationToken: state.sessionToken,
    searchParams: params,
  });

  const total = Number((bundle as any)?.total || 0);
  const entries = Array.isArray((bundle as any)?.entry) ? (bundle as any).entry.length : 0;
  logSuccess(`Búsqueda completada. total=${total} entries=${entries}`);
  if (outputJson) {
    const outputPath = path.resolve(outputJson);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(bundle, null, 2), 'utf-8');
    console.log(`Resultado guardado en ${outputPath}`);
  } else {
    console.log(JSON.stringify({ resourceType, total, entries }, null, 2));
  }
}

async function cmdPatch(args: string[], statePath: string, currentState?: CliState): Promise<void> {
  let state = parseCommonArgs(args, currentState);
  const thid = getArgValue(args, '--thid');
  if (!thid) {
    throw new Error('patch requiere --thid (obtenido de la respuesta de upload)');
  }
  const resourceType = getArgValue(args, '--resource-type') || state.resourceType || 'excel';
  const requestedScope = getArgValue(args, '--scope') || `${resourceType}/_patch`;
  if (!isSessionValid(state)) {
    const exchangeArgs = ['--scope', requestedScope];
    if (state.apiKey) exchangeArgs.push('--api-key', state.apiKey);
    await cmdExchange(exchangeArgs, statePath, state);
    state = (await loadState(statePath)) || state;
  }
  if (!state.sessionToken) {
    throw new Error('No hay session token válido para patch');
  }

  const outputJson = getArgValue(args, '--output-json');

  const client = new DataConvClient({
    issuerDid: state.issuerDid,
    alternateName: state.tenantId,
    tenantId: state.tenantId,
    jurisdiction: state.jurisdiction,
    sector: state.sector,
    baseUrl: state.baseUrl,
    idToken: state.idToken,
    vpToken: state.vpToken,
  });

  logInfo(`Confirmando conversión (_patch) thid=${thid}...`);
  const response = await client.patchConversion({
    softwareId: state.softwareId,
    resourceType,
    thid,
    authorizationToken: state.sessionToken,
    idToken: state.idToken,
    vpToken: state.vpToken,
    iss: state.issuerDid,
  });

  const status = String((response as any)?.body?.status || '');
  const promoted = Number((response as any)?.body?.promotedCount ?? (response as any)?.body?.total ?? 0);
  logSuccess(`Patch completado. status=${status} promotedCount=${promoted}`);
  if (outputJson) {
    const outputPath = path.resolve(outputJson);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(response, null, 2), 'utf-8');
    console.log(`Resultado guardado en ${outputPath}`);
  }
}

async function cmdBatch(args: string[], statePath: string, currentState?: CliState): Promise<void> {
  let state = parseCommonArgs(args, currentState);
  const thid = getArgValue(args, '--thid');
  if (!thid) {
    throw new Error('batch requiere --thid (obtenido de la respuesta de upload)');
  }
  const resourceType = getArgValue(args, '--resource-type') || state.resourceType || 'excel';
  const requestedScope = getArgValue(args, '--scope') || `${resourceType}/_batch`;
  if (!isSessionValid(state)) {
    const exchangeArgs = ['--scope', requestedScope];
    if (state.apiKey) exchangeArgs.push('--api-key', state.apiKey);
    await cmdExchange(exchangeArgs, statePath, state);
    state = (await loadState(statePath)) || state;
  }
  if (!state.sessionToken) {
    throw new Error('No hay session token válido para batch');
  }

  const outputJson = getArgValue(args, '--output-json');

  const client = new DataConvClient({
    issuerDid: state.issuerDid,
    alternateName: state.tenantId,
    tenantId: state.tenantId,
    jurisdiction: state.jurisdiction,
    sector: state.sector,
    baseUrl: state.baseUrl,
    idToken: state.idToken,
    vpToken: state.vpToken,
  });

  logInfo(`Confirmando conversión (_batch) thid=${thid}...`);
  const response = await client.batchPromotion({
    softwareId: state.softwareId,
    resourceType,
    thid,
    authorizationToken: state.sessionToken,
    idToken: state.idToken,
    vpToken: state.vpToken,
    iss: state.issuerDid,
  });

  const status = String((response as any)?.body?.status || '');
  const promoted = Number((response as any)?.body?.promotedCount ?? (response as any)?.body?.total ?? 0);
  logSuccess(`Batch completado. status=${status} promotedCount=${promoted}`);
  if (outputJson) {
    const outputPath = path.resolve(outputJson);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(response, null, 2), 'utf-8');
    console.log(`Resultado guardado en ${outputPath}`);
  }
}

async function cmdWhoami(statePath: string, currentState?: CliState): Promise<void> {
  const state = currentState || await loadState(statePath);
  if (!state) {
    console.log('Sin estado local');
    return;
  }
  console.log(JSON.stringify({
    dataspaceName: state.dataspaceName || '',
    baseUrl: state.baseUrl,
    tenantId: state.tenantId,
    jurisdiction: state.jurisdiction,
    sector: state.sector,
    softwareId: state.softwareId,
    resourceType: state.resourceType,
    hasIdToken: Boolean(state.idToken),
    hasVpToken: Boolean(state.vpToken),
    hasSessionToken: Boolean(state.sessionToken),
    sessionScope: state.sessionScope || '',
    sessionExpiresAt: state.sessionExpiresAt ? new Date(state.sessionExpiresAt).toISOString() : '',
    subject: state.subject || '',
    organization: state.organization || ''
    ,
    organizationDid: state.organizationDid || '',
    serviceId: state.serviceId || '',
    entityOpenidExchangeFallback: state.publisherTokenExchangeFallback || '',
    publisherDatasetUpdateFallback: state.publisherDatasetUpdateFallback || '',
    publisherDatasetPatchFallback: state.publisherDatasetPatchFallback || '',
    publisherDatasetBatchFallback: state.publisherDatasetBatchFallback || '',
    publisherDatasetSearchFallback: state.publisherDatasetSearchFallback || '',
    hasApiKey: Boolean(state.apiKey)
  }, null, 2));
}

async function cmdApiKeyCreate(args: string[], statePath: string, currentState?: CliState): Promise<void> {
  let state = parseCommonArgs(args, currentState);
  const email = String(getArgValue(args, '--email') || '').trim();
  if (!email) {
    throw new Error('api-key-create requiere --email');
  }
  const target = String(getArgValue(args, '--target') || '').trim();
  if (!target) {
    throw new Error('api-key-create requiere --target (endpointId/patrón de endpoint)');
  }

  const explicitScopes = parseCsv(getArgValue(args, '--scope'));
  const scopes = explicitScopes.length > 0 ? explicitScopes : [target];
  const instrumentRaw = String(getArgValue(args, '--instrument') || '').trim();
  let instrument: Record<string, unknown> = {};
  if (instrumentRaw) {
    try {
      const parsed = JSON.parse(instrumentRaw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        instrument = parsed as Record<string, unknown>;
      } else {
        throw new Error('instrument debe ser JSON objeto');
      }
    } catch (error) {
      throw new Error(`instrument inválido: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!isSessionValid(state) || !state.sessionToken) {
    await cmdExchange(['--scope', 'dataconv.tenant.keys.manage'], statePath, state);
    state = (await loadState(statePath)) || state;
  }
  if (!state.sessionToken) {
    throw new Error('No hay session token válido para gestionar API keys');
  }

  const client = new DataConvClient({
    issuerDid: state.issuerDid,
    alternateName: state.tenantId,
    tenantId: state.tenantId,
    jurisdiction: state.jurisdiction,
    sector: state.sector,
    baseUrl: state.baseUrl,
    idToken: state.idToken,
    vpToken: state.vpToken,
  });

  const result = await client.createTenantApiKeyActions({
    tenantId: state.tenantId,
    jurisdiction: state.jurisdiction,
    sector: state.sector,
    authorizationToken: state.sessionToken,
    actions: [
      {
        '@context': 'https://schema.org',
        '@type': 'UpdateAction',
        agent: { email },
        target,
        scope: scopes,
        instrument,
        actionStatus: 'active',
      }
    ]
  });

  const first = Array.isArray(result.data) ? result.data[0] : undefined;
  const apiKey = String(first?.resource?.apiKey || '');
  if (!apiKey) {
    throw new Error('Respuesta sin apiKey');
  }

  const nextState: CliState = {
    ...state,
    apiKey,
  };
  await saveState(statePath, nextState);

  console.log(JSON.stringify({
    identifier: first?.identifier || '',
    actionStatus: first?.actionStatus || '',
    sameAs: (first as any)?.agent?.sameAs || '',
    target: first?.target || target,
    scope: first?.scope || scopes,
    apiKey,
  }, null, 2));
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (!argv.length) {
    console.log(commandHelp());
    process.exit(0);
  }

  const command = argv[0];
  const args = argv.slice(1);
  if (command === 'help') {
    console.log(commandHelp(args[0]));
    process.exit(0);
  }
  if (hasFlag(args, '--help')) {
    console.log(commandHelp(command));
    process.exit(0);
  }
  const statePath = defaultStatePath(getArgValue(argv, '--state-file'));
  const state = await loadState(statePath);

  if (command === 'login') {
    await cmdLogin(args, statePath, state);
    return;
  }
  if (command === 'exchange') {
    await cmdExchange(args, statePath, state);
    return;
  }
  if (command === 'upload') {
    await cmdUpload(args, statePath, state);
    return;
  }
  if (command === 'search') {
    await cmdSearch(args, statePath, state);
    return;
  }
  if (command === 'patch') {
    await cmdPatch(args, statePath, state);
    return;
  }
  if (command === 'batch') {
    await cmdBatch(args, statePath, state);
    return;
  }
  if (command === 'api-key-create') {
    await cmdApiKeyCreate(args, statePath, state);
    return;
  }
  if (command === 'whoami') {
    await cmdWhoami(statePath, state);
    return;
  }

  throw new Error(`Comando no soportado: ${command}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
