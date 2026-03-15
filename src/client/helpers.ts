import type { CreateTenantConfigOptions, DataConvClientConfig, DataConvCrypto, SourceFormat } from '../types.js';
import { DEFAULT_SECTOR } from './constants.js';

export function normalizeSourceFormat(sourceFormat: SourceFormat | undefined, config: DataConvClientConfig): 'excel' | 'csv' {
  const raw = String(sourceFormat || config.defaultSourceFormat || 'excel').trim().toLowerCase();
  if (raw === 'xlsx') {
    return 'excel';
  }
  if (raw !== 'excel' && raw !== 'csv') {
    throw new Error(`Unsupported sourceFormat '${raw}'`);
  }
  return raw;
}

export function requireText(value: string | undefined, fieldName: string): string {
  const text = String(value || '').trim();
  if (!text) {
    throw new Error(`${fieldName} is required`);
  }
  return text;
}

export function resolveIssuerDid(config: DataConvClientConfig, override?: string): string {
  return requireText(override || config.issuerDid, 'issuerDid');
}

export function resolveSector(config: DataConvClientConfig, override?: string): string {
  return requireText(override || config.sector || DEFAULT_SECTOR, 'sector');
}

export function resolveResourceType(config: DataConvClientConfig, override?: string): string {
  return requireText(override || config.defaultResourceType || 'Composition', 'resourceType');
}

export function resolveConfigTenantId(config: DataConvClientConfig, override?: string): string {
  return requireText(override || config.tenantId || config.alternateName, 'tenantId');
}

export function resolveConfigSoftwareId(options: CreateTenantConfigOptions): string {
  const direct = String(options.softwareId || '').trim();
  if (direct) {
    return direct;
  }
  const fromFirstEntry = String(options.entries[0]?.softwareId || '').trim();
  return requireText(fromFirstEntry, 'softwareId');
}

export function resolveTenantId(config: DataConvClientConfig, override?: string): string {
  return requireText(override || config.tenantId || config.alternateName, 'tenantId');
}

export function resolveJurisdiction(config: DataConvClientConfig, override?: string): string {
  return requireText(override || config.jurisdiction || 'ES', 'jurisdiction');
}

export function createUuid(cryptoApi: DataConvCrypto | undefined): string {
  const uuidFactory = cryptoApi?.randomUUID;
  if (typeof uuidFactory === 'function') {
    return uuidFactory.call(cryptoApi);
  }

  const getRandomValues = cryptoApi?.getRandomValues?.bind(cryptoApi);
  if (typeof getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  throw new Error(
    'Secure random UUID generation is not available in this runtime. ' +
    'Provide DataConvClientConfig.crypto or ensure globalThis.crypto is available.'
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildUrl(baseUrl: string, url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

export function headerValue(headers: Record<string, string> | undefined, key: string): string | undefined {
  if (!headers) {
    return undefined;
  }
  const expectedKey = key.toLowerCase();
  const match = Object.entries(headers).find(([headerKey]) => headerKey.toLowerCase() === expectedKey);
  return match?.[1];
}

export function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
}

export function isFormData(body: unknown): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}
