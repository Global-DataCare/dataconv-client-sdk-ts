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
  softwareVersion?: string;
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

/** One primary resource returned directly in `body.data[].resource`. */
export interface DataConvConvertedResource {
  resourceType?: string;
  [key: string]: unknown;
}

export type DataConvConversionEntry = TenantAdapterConfigEntry<DataConvConvertedResource>;

/** @deprecated Use `DataConvConvertedResource`; conversion results are not nested Bundles. */
export type ConvertedBundleResource = DataConvConvertedResource;

/** @deprecated Use `DataConvConversionEntry`; there is no `ConversionResult` wrapper. */
export type ConversionResultEntry = DataConvConversionEntry;

export interface DataConvClientConfig {
  issuerDid: string;
  alternateName?: string;
  tenantId?: string;
  jurisdiction?: string;
  sector?: string;
  baseUrl?: string;
  retryTimes?: number;
  retryDelayMs?: number;
  /** Maximum wall-clock time for one HTTP request. Defaults to 20 seconds. */
  requestTimeoutMs?: number;
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

export interface DataConvOrganizationTenantActivationOptions {
  tenantId?: string;
  alternateName?: string;
  jurisdiction?: string;
  sector?: string;
  idToken: string;
  vpToken: string;
}

export interface DataConvOrganizationTenantActivationResult {
  active: boolean;
  tenantId: string;
  networkKind: string;
  jurisdiction: string;
  sector: string;
  controller?: string;
  credentialIds?: string[];
  revision?: number;
}

export interface DataConvOrganizationTenantStatusResult {
  active: boolean;
  status: 'ready' | 'not-configured';
  tenantId: string;
  networkKind: string;
  jurisdiction: string;
  sector: string;
}

export interface DataConvResearchFieldMapping {
  serverField: string;
  sourceField: string;
}

export interface DataConvResearchWorkbookInspection {
  mode: 'embedded-api-config' | 'manual-mapping';
  apiConfig?: string;
  sheetName: string;
  sourceFields: string[];
  mappings: DataConvResearchFieldMapping[];
  /** Up to three non-empty cells per source column, in workbook order. */
  sampleValuesBySourceField: Record<string, string[]>;
  /** One-based worksheet row containing the source-column headers. */
  dataHeaderRowIndex: number;
}

export interface DataConvTenantConfigCloneOptions {
  softwareId: string;
  softwareVersion?: string;
  updatedBy?: string;
  mappings: DataConvResearchFieldMapping[];
}

export interface DataConvTenantConfigSearchOptions {
  alternateName?: string;
  tenantId?: string;
  jurisdiction?: string;
  sector?: string;
  authorizationToken: string;
  softwareId?: string;
  count?: number;
  offset?: number;
}

export interface DataConvTenantConfigCatalog<TFieldMap = FieldsGenericCare> {
  total: number;
  data: TenantAdapterConfigResource<TFieldMap>[];
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
  authorizationToken?: string;
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
  authorizationToken?: string;
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
  /** Stable FHIR ResearchStudy context; correlation only, never authorization. */
  researchStudy?: DataConvFhirReference;
}

export interface DataConvFhirReference {
  readonly reference: string;
}

export interface DataConvUploadDidCommOptions extends DataConvUploadBaseOptions {
  attachmentId?: string;
  fileName?: string;
  mediaType?: string;
  body?: Record<string, unknown>;
}

export interface DataConvMultipartUploadOptions extends DataConvUploadBaseOptions {
  /** XLSX bytes; callers enforce their deployment's workbook byte limit. */
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
  /** Must match the ResearchStudy supplied when the research upload was created. */
  researchStudy?: DataConvFhirReference;
}

export interface DataConvExchangeTokenOptions {
  subjectToken: string;
  subjectTokenType?: string;
  vpToken: string;
  clientAssertion: string;
  clientAssertionType?: string;
  scope?: string;
  apiKey?: string;
  apiKeyProfile?: string;
  organization?: string;
  operationalSubject?: string;
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

/**
 * RFC 8693 token type used when the subject token is a GW-issued SMART access token.
 * @see https://www.rfc-editor.org/rfc/rfc8693.html#section-3
 */
export type DataConvAccessTokenType = 'urn:ietf:params:oauth:token-type:access_token';

/**
 * Study-scoped SMART exchange input.
 *
 * The ResearchStudy reference is correlation context for the subsequent
 * upload/review calls. DataConv validates it against the signed `study` claim
 * in the GW token; it is deliberately not sent as a second authority claim.
 * @see https://www.rfc-editor.org/rfc/rfc8693.html
 */
export interface DataConvResearchStudySmartExchangeOptions {
  tenantId?: string;
  alternateName?: string;
  jurisdiction?: string;
  sector?: string;
  subjectToken: string;
  subjectTokenType?: DataConvAccessTokenType;
  researchStudy: DataConvFhirReference;
}

/** DataConv token bound to the exact ResearchStudy from the GW SMART grant. */
export interface DataConvResearchStudySmartExchangeResult extends DataConvExchangeTokenResult {
  issued_token_type: DataConvAccessTokenType;
  study: string;
  /** The same stable reference object supplied to the exchange call. */
  researchStudy: DataConvFhirReference;
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

export interface DataConvApiKeyAuthorizationRule {
  agentEmail: string;
  scopes: string[];
  target?: string;
  odrlPolicy?: Record<string, unknown>;
  expiresInSeconds?: number;
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
  /** Must match the ResearchStudy supplied when the research upload was created. */
  researchStudy?: DataConvFhirReference;
  /**
   * Human coding decisions accepted by DataConv's promotion endpoint.
   * Unconfirmed AI candidates remain outside authoritative flat claims.
   */
  body?: DataConvPromotionBody;
}

export interface DataConvCodingCandidate {
  readonly id: string;
  readonly system: string;
  readonly code: string;
  readonly display: string;
  readonly source?: string;
  readonly recommendationPercent?: number;
  readonly evidence?: string;
}

export type DataConvCodingProposalStatus = 'proposed' | 'accepted';

export interface DataConvCodingProposal {
  readonly id: string;
  readonly status: DataConvCodingProposalStatus;
  readonly field: string;
  readonly inputText: string;
  readonly rowContext: Readonly<Record<string, string>>;
  readonly candidates: readonly DataConvCodingCandidate[];
  readonly selectedCandidateId?: string;
  readonly reviewedAt?: string;
  /** True only after an authorized professional explicitly selects this proposal's code. */
  readonly userSelected?: boolean;
}

/** Exact human-selection shape consumed by `body.codingReviews[]`. */
export interface DataConvCodingReview {
  resourceType: string;
  resourceId: string;
  proposalId: string;
  selectedCandidateId: string;
  reason?: string;
}

export interface DataConvPromotionBody extends Record<string, unknown> {
  codingReviews?: DataConvCodingReview[];
}

export type DataConvReviewDraftState = 'draft' | 'promoted' | 'unknown';

/** One UI review row derived from one server `meta.codingProposals[]` item. */
export interface DataConvCodingReviewRow extends DataConvCodingProposal {
  readonly subjectResourceType: string;
  readonly subjectId: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly proposalId: string;
  readonly state: DataConvCodingProposalStatus;
  readonly draftState: DataConvReviewDraftState;
}

export interface DataConvCodingReviewPageOptions {
  /** One-based page number. */
  page?: number;
  /** Bounded to 1..100 because upload-response currently returns one full Bundle. */
  pageSize?: number;
  /** Include accepted proposals for audit/history. Defaults to unresolved proposals only. */
  includeReviewed?: boolean;
}

export interface DataConvCodingReviewPage {
  readonly items: readonly DataConvCodingReviewRow[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasPreviousPage: boolean;
  readonly hasNextPage: boolean;
}

export interface DataConvPatchResponseBody {
  status?: string;
  promotedCount?: number;
  message?: string;
  issues?: DataConvOperationOutcome;
  data?: Array<TenantAdapterConfigEntry<Record<string, unknown>>>;
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

/** One DataConv conversion job projected through canonical flat Task claims. */
export interface DataConvTaskResource {
  resourceType: 'Task';
  id: string;
  meta: {
    claims: Record<string, unknown>;
  };
}

export interface DataConvJobSearchOptions {
  alternateName?: string;
  tenantId?: string;
  jurisdiction?: string;
  sector?: string;
  researchStudy: DataConvFhirReference;
  /** Page size, bounded by DataConv to 1..100. */
  count?: number;
  /** Zero-based result offset. */
  offset?: number;
  authorizationToken?: string;
  idToken?: string;
}

/** Study-scoped lookup of durable ResearchSubject drafts awaiting coding review. */
export interface DataConvPendingCodingReviewSearchOptions extends DataConvJobSearchOptions {}

export interface DataConvPrepareCodingReviewOptions {
  alternateName?: string;
  tenantId?: string;
  jurisdiction?: string;
  sector?: string;
  researchStudy: DataConvFhirReference;
  authorizationToken?: string;
  idToken?: string;
}

export interface DataConvPrepareCodingReviewResult {
  preparedSubjectCount: number;
  proposalCount: number;
  candidateCount: number;
}

/** Explicit human decisions applied to durable drafts independently of job retention. */
export interface DataConvStudyCodingReviewOptions {
  alternateName?: string;
  tenantId?: string;
  jurisdiction?: string;
  sector?: string;
  researchStudy: DataConvFhirReference;
  authorizationToken?: string;
  idToken?: string;
  codingReviews: DataConvCodingReview[];
}

export interface DataConvStudyCodingReviewResult {
  status: 'pending-review' | 'success';
  reviewedProposalCount: number;
  promotedSubjectCount: number;
  pendingSubjectCount: number;
  [key: string]: unknown;
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
