import type { AxiosInstance } from 'axios';

export type SourceFormat = 'excel' | 'xlsx' | 'csv';

export interface DataConvOperationOutcomeIssue {
  severity?: string;
  code?: string;
  description?: string;
  diagnostics?: string;
  [key: string]: unknown;
}

export interface DataConvOperationOutcome {
  resourceType?: string;
  issue?: DataConvOperationOutcomeIssue[];
  [key: string]: unknown;
}

export interface DataConvDidCommAttachmentPayload {
  format?: string;
  jwt?: string;
  [key: string]: unknown;
}

export interface DataConvDidCommAttachmentData {
  json?: DataConvDidCommAttachmentPayload;
  links?: string[];
  base64?: string;
  [key: string]: unknown;
}

export interface DataConvDidCommAttachment {
  id?: string;
  format?: string;
  media_type?: string;
  filename?: string;
  data?: DataConvDidCommAttachmentData;
  [key: string]: unknown;
}

export interface DataConvDidCommRequest {
  jti: string;
  thid: string;
  iss: string;
  type: string;
  iat: number;
  exp: number;
  body?: Record<string, unknown>;
  data?: unknown[];
  attachments?: DataConvDidCommAttachment[];
  id_token?: string;
  vp_token?: string;
  [key: string]: unknown;
}

export interface DataConvCrypto {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
}

import type { FieldsGenericCare } from './field-maps.js';

export interface DataConvMappingConfig<TFieldMap = FieldsGenericCare> {
  headerRowIndex?: number;
  fieldMap?: TFieldMap;
  [key: string]: unknown;
}

export interface TenantAdapterConfigContent<TFieldMap = FieldsGenericCare> {
  mappingConfig?: DataConvMappingConfig<TFieldMap>;
  speciesFhir?: Record<string, unknown>;
  speciesLocalToFhirCode?: Record<string, string>;
  runtimeDefaults?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CreateTenantConfigEntry<TFieldMap = FieldsGenericCare> {
  softwareId: string;
  softwareVersion?: string;
  updatedBy?: string;
  config?: TenantAdapterConfigContent<TFieldMap>;
  [key: string]: unknown;
}

export interface TenantAdapterConfigResource<TFieldMap = FieldsGenericCare> {
  id?: string;
  type?: string;
  tenantId?: string;
  alternateName?: string;
  softwareId?: string;
  country?: string;
  facilityId?: string;
  revision?: string;
  createdAt?: string;
  updatedAt?: string;
  audit?: Record<string, unknown>;
  content?: TenantAdapterConfigContent<TFieldMap>;
  [key: string]: unknown;
}

export interface TenantAdapterConfigEntry<TResource = unknown> {
  type?: string;
  response?: {
    status?: string;
    outcome?: DataConvOperationOutcome;
    [key: string]: unknown;
  };
  resource?: TResource;
  [key: string]: unknown;
}

export interface DataConvBundleResponseBody<TResource = unknown> {
  resourceType?: string;
  type?: string;
  total?: number;
  issues?: DataConvOperationOutcome;
  data?: Array<TenantAdapterConfigEntry<TResource>>;
  [key: string]: unknown;
}

export interface DataConvDidCommResponse<TResource = unknown> {
  jti?: string;
  iss?: string;
  aud?: string;
  thid?: string;
  type?: string;
  iat?: number;
  exp?: number;
  attachments?: DataConvDidCommAttachment[];
  body?: DataConvBundleResponseBody<TResource>;
  [key: string]: unknown;
}

export interface ConvertedBundleResource {
  resourceType?: string;
  type?: string;
  total?: number;
  data?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export type ConversionResultEntry = TenantAdapterConfigEntry<ConvertedBundleResource>;

export interface DataConvClientConfig {
  issuerDid: string;
  alternateName?: string;
  tenantId?: string;
  jurisdiction?: string;
  sector?: string;
  baseUrl?: string;
  retryTimes?: number;
  retryDelayMs?: number;
  defaultExpSeconds?: number;
  defaultDidCommType?: string;
  defaultSourceFormat?: SourceFormat;
  defaultResourceType?: string;
  idToken?: string;
  vpToken?: string;
  httpClient?: AxiosInstance;
  fetch?: typeof fetch;
  crypto?: DataConvCrypto;
}

export interface CreateTenantConfigOptions<TFieldMap = FieldsGenericCare> {
  alternateName?: string;
  tenantId?: string;
  jurisdiction?: string;
   sector?: string;
  softwareId?: string;
  thid?: string;
  iss?: string;
  type?: string;
  iat?: number;
  exp?: number;
  idToken?: string;
  vpToken?: string;
  entries: CreateTenantConfigEntry<TFieldMap>[];
}

export interface DataConvTenantConfigPollOptions {
  alternateName?: string;
  tenantId?: string;
  jurisdiction?: string;
  sector?: string;
  softwareId: string;
  thid: string;
  iss?: string;
  type?: string;
  iat?: number;
  exp?: number;
  idToken?: string;
  vpToken?: string;
}

export interface DataConvUploadBaseOptions {
  alternateName?: string;
  tenantId?: string;
  jurisdiction?: string;
  sector?: string;
  softwareId: string;
  resourceType?: string;
  softwareVersion?: string;
  sourceFormat?: SourceFormat;
  thid?: string;
  iss?: string;
  type?: string;
  iat?: number;
  exp?: number;
  idToken?: string;
  vpToken?: string;
  authorizationToken?: string;
  mode?: string;
  send?: boolean;
  inlineConfig?: Record<string, unknown>;
}

export interface DataConvUploadDidCommOptions extends DataConvUploadBaseOptions {
  attachmentId?: string;
  fileName?: string;
  mediaType?: string;
  body?: Record<string, unknown>;
}

export interface DataConvMultipartUploadOptions extends DataConvUploadBaseOptions {
  fileBytes: Uint8Array;
  fileName?: string;
  mediaType?: string;
}

export interface DataConvConversionPollOptions {
  alternateName?: string;
  tenantId?: string;
  jurisdiction?: string;
  sector?: string;
  softwareId: string;
  resourceType?: string;
  thid: string;
  iss?: string;
  type?: string;
  iat?: number;
  exp?: number;
  idToken?: string;
  vpToken?: string;
  authorizationToken?: string;
}

export interface DataConvExchangeTokenOptions {
  subjectToken: string;
  subjectTokenType?: string;
  vpToken: string;
  clientAssertion: string;
  clientAssertionType?: string;
  scope?: string;
  apiKey?: string;
  organization?: string;
  operationalSubject?: string;
  endpointPath?: '/exchange' | '/oauth/token';
}

export interface DataConvExchangeTokenResult {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  subject?: string;
  organization?: string;
  [key: string]: unknown;
}

export interface DataConvApiKeyActionAgent {
  email?: string;
  sameAs?: string;
  [key: string]: unknown;
}

export interface DataConvApiKeyAction {
  '@context'?: string;
  '@type'?: string;
  identifier?: string;
  actionStatus?: string;
  target?: string;
  scope?: string | string[];
  agent?: DataConvApiKeyActionAgent;
  instrument?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DataConvApiKeyActionEntry {
  resource: DataConvApiKeyAction;
}

export interface DataConvApiKeyResource extends Record<string, unknown> {
  '@context'?: string;
  '@type'?: string;
  identifier?: string;
  actionStatus?: string;
  target?: string;
  scope?: string[];
  agent?: DataConvApiKeyActionAgent;
  instrument?: Record<string, unknown>;
  apiKey?: string;
  tenantId?: string;
  expiresAt?: string;
  removed?: boolean;
}

export interface DataConvApiKeyResponseEntry {
  resource?: DataConvApiKeyResource;
  [key: string]: unknown;
}

export interface DataConvApiKeyCreateActionsOptions {
  tenantId?: string;
  alternateName?: string;
  jurisdiction?: string;
  sector?: string;
  authorizationToken: string;
  actions: DataConvApiKeyAction[];
}

export interface DataConvApiKeyLifecycleOptions extends DataConvApiKeyCreateActionsOptions {}

export interface DataConvApiKeyCreateActionsResult {
  data?: DataConvApiKeyResponseEntry[];
  [key: string]: unknown;
}

export interface DataConvApiKeyLifecycleResult extends DataConvApiKeyCreateActionsResult {}

export interface DataConvPatchOptions {
  alternateName?: string;
  tenantId?: string;
  jurisdiction?: string;
  sector?: string;
  softwareId: string;
  resourceType?: string;
  thid: string;
  iss?: string;
  type?: string;
  iat?: number;
  exp?: number;
  idToken?: string;
  vpToken?: string;
  authorizationToken?: string;
}

export interface DataConvPatchResponseBody {
  status?: string;
  promotedCount?: number;
  message?: string;
  [key: string]: unknown;
}

export interface DataConvPatchResponse {
  type?: string;
  thid?: string;
  body?: DataConvPatchResponseBody;
  [key: string]: unknown;
}

export interface DataConvSearchBundleEntry<TResource = Record<string, unknown>> {
  fullUrl?: string;
  resource?: TResource;
  [key: string]: unknown;
}

export interface DataConvSearchBundle<TResource = Record<string, unknown>> {
  resourceType?: string;
  type?: string;
  total?: number;
  entry?: Array<DataConvSearchBundleEntry<TResource>>;
  [key: string]: unknown;
}

export interface DataConvSearchOptions {
  alternateName?: string;
  tenantId?: string;
  jurisdiction?: string;
  sector?: string;
  softwareId?: string;
  resourceType: string;
  searchParams?: Record<string, unknown>;
  authorizationToken?: string;
  idToken?: string;
}

export interface DataConvBatchOptions extends DataConvPatchOptions {}

export interface DataConvCreateResult {
  thid: string;
  location?: string;
}

export interface DataConvUploadResult {
  thid: string;
  location?: string;
}

export interface DataConvSupportedField {
  code: string;
  display: string;
}

export interface DataConvWellKnownApiConfig {
  language: string;
  supportedFields: Record<string, string>;
  endpoints: Record<string, string>;
  allowedJurisdictions?: string[];
  allowedSectors?: string[];
  auth?: Record<string, unknown>;
  fields: DataConvSupportedField[];
}
