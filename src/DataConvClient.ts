import axios, { type AxiosInstance } from 'axios';
import { DEFAULT_SECTOR, DEFAULT_UPLOAD_BODY } from './client/constants.js';
import {
  buildUrl,
  createUuid,
  headerValue,
  headersToObject,
  isFormData,
  normalizeSearchParams,
  normalizeSourceFormat,
  requireText,
  resolveConfigSoftwareId,
  resolveConfigTenantId,
  resolveJurisdiction,
  resolveResourceType,
  resolveSector,
  resolveTenantId,
  sleep
} from './client/helpers.js';
import { buildAttachment, buildEnvelope, buildMultipartFormData, buildUploadExtra } from './client/message.js';
import type {
  DataConvBatchOptions,
  ConversionResultEntry,
  ConvertedBundleResource,
  CreateTenantConfigOptions,
  DataConvClientConfig,
  DataConvConversionPollOptions,
  DataConvCreateResult,
  DataConvCrypto,
  DataConvDidCommAttachment,
  DataConvDidCommResponse,
  DataConvMultipartUploadOptions,
  DataConvOperationOutcome,
  DataConvPatchOptions,
  DataConvPatchResponse,
  DataConvSearchBundle,
  DataConvSearchOptions,
  DataConvTenantConfigPollOptions,
  DataConvUploadDidCommOptions,
  DataConvUploadResult,
  DataConvSupportedField,
  DataConvWellKnownApiConfig,
  SourceFormat,
  TenantAdapterConfigEntry,
  TenantAdapterConfigResource
} from './types.js';

export class DataConvClient {
  private readonly httpClient?: AxiosInstance;
  private readonly fetchFn?: typeof fetch;
  private readonly cryptoApi?: DataConvCrypto;
  private readonly baseUrl: string;
  private readonly retryTimes: number;
  private readonly retryDelayMs: number;
  private readonly defaultExpSeconds: number;

  private idToken?: string;
  private vpToken?: string;
  private lastTenantConfigResponse?: DataConvDidCommResponse<TenantAdapterConfigResource>;
  private lastConversionResponse?: DataConvDidCommResponse<ConvertedBundleResource>;

  constructor(private readonly config: DataConvClientConfig) {
    this.baseUrl = config.baseUrl || process.env.DATACONV_BASE_URL || 'http://localhost:8080';
    this.fetchFn = config.fetch ?? (typeof fetch !== 'undefined' ? fetch : undefined);
    this.cryptoApi = config.crypto ?? (globalThis as typeof globalThis & { crypto?: DataConvCrypto }).crypto;
    this.httpClient = config.httpClient ?? (config.fetch ? undefined : axios.create({ baseURL: this.baseUrl }));
    this.retryTimes = config.retryTimes ?? 10;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
    this.defaultExpSeconds = config.defaultExpSeconds ?? 300;
    this.idToken = config.idToken;
    this.vpToken = config.vpToken;
  }

  setIdToken(idToken: string): void {
    this.idToken = idToken;
  }

  setVpToken(vpToken: string): void {
    this.vpToken = vpToken;
  }

  getLastTenantConfigResponse(): DataConvDidCommResponse<TenantAdapterConfigResource> | undefined {
    return this.lastTenantConfigResponse;
  }

  getLastConversionResponse(): DataConvDidCommResponse<ConvertedBundleResource> | undefined {
    return this.lastConversionResponse;
  }

  clearStoredResponses(): void {
    this.lastTenantConfigResponse = undefined;
    this.lastConversionResponse = undefined;
  }

  getTenantConfigEntries(
    response: DataConvDidCommResponse<TenantAdapterConfigResource> | undefined = this.lastTenantConfigResponse
  ): Array<TenantAdapterConfigEntry<TenantAdapterConfigResource>> {
    const entries = response?.body?.data;
    return Array.isArray(entries) ? entries : [];
  }

  getSuccessfulTenantConfigs(
    response: DataConvDidCommResponse<TenantAdapterConfigResource> | undefined = this.lastTenantConfigResponse
  ): TenantAdapterConfigResource[] {
    return this.getTenantConfigEntries(response)
      .filter((entry) => typeof entry.response?.status === 'string' && entry.response.status.startsWith('2'))
      .map((entry) => entry.resource)
      .filter((resource): resource is TenantAdapterConfigResource => !!resource && typeof resource === 'object');
  }

  getConversionEntry(
    response: DataConvDidCommResponse<ConvertedBundleResource> | undefined = this.lastConversionResponse
  ): ConversionResultEntry | undefined {
    const entries = response?.body?.data;
    if (!Array.isArray(entries)) {
      return undefined;
    }
    return entries.find((entry) => entry?.type === 'ConversionResult') as ConversionResultEntry | undefined;
  }

  getConvertedBundle(
    response: DataConvDidCommResponse<ConvertedBundleResource> | undefined = this.lastConversionResponse
  ): ConvertedBundleResource | undefined {
    return this.getConversionEntry(response)?.resource;
  }

  getResponseIssues<TResource>(
    response: DataConvDidCommResponse<TResource> | undefined
  ): DataConvOperationOutcome | undefined {
    return response?.body?.issues;
  }

  async getWellKnownApiConfig(): Promise<DataConvWellKnownApiConfig> {
    const response = await this.request({
      method: 'GET',
      url: '/.well-known/api-config.json'
    });

    if (response.status !== 200 || !response.data || typeof response.data !== 'object') {
      throw new Error(`Unexpected api-config response status: ${response.status}`);
    }

    const raw = response.data as Record<string, unknown>;
    const supportedFields = Object.fromEntries(
      Object.entries(
        raw.supportedFields && typeof raw.supportedFields === 'object'
          ? raw.supportedFields as Record<string, unknown>
          : {}
      )
        .filter(([key, value]) => String(key || '').trim() && String(value || '').trim())
        .map(([key, value]) => [String(key).trim(), String(value).trim()])
    );
    const endpoints = Object.fromEntries(
      Object.entries(
        raw.endpoints && typeof raw.endpoints === 'object'
          ? raw.endpoints as Record<string, unknown>
          : {}
      )
        .filter(([key, value]) => String(key || '').trim() && String(value || '').trim())
        .map(([key, value]) => [String(key).trim(), String(value).trim()])
    );
    const fields: DataConvSupportedField[] = Object.entries(supportedFields).map(([code, display]) => ({
      code,
      display
    }));

    return {
      language: String(raw.language || '').trim(),
      supportedFields,
      endpoints,
      fields
    };
  }

  async getSupportedFields(): Promise<DataConvSupportedField[]> {
    const config = await this.getWellKnownApiConfig();
    return config.fields;
  }

  async createTenantConfig(options: CreateTenantConfigOptions): Promise<DataConvCreateResult> {
    return this.createConfig(options);
  }

  async createConfig(options: CreateTenantConfigOptions): Promise<DataConvCreateResult> {
    if (!Array.isArray(options.entries) || options.entries.length === 0) {
      throw new Error('entries is required and must contain at least one item');
    }

    const tenantId = resolveConfigTenantId(this.config, options.tenantId ?? options.alternateName);
    const jurisdiction = resolveJurisdiction(this.config, options.jurisdiction);
    const sector = resolveSector(this.config, options.sector);
    const softwareId = resolveConfigSoftwareId(options);
    const envelope = buildEnvelope({
      iss: options.iss,
      thid: options.thid,
      type: options.type,
      iat: options.iat,
      exp: options.exp,
      idToken: options.idToken,
      vpToken: options.vpToken,
      data: options.entries
    }, this.messageDeps());

    const response = await this.request({
      method: 'POST',
      url: `/host/cds-${jurisdiction}/v1/${sector}/${tenantId}/${softwareId}/config/_create`,
      headers: { 'Content-Type': 'application/didcomm-plain+json' },
      body: envelope
    });

    if (response.status !== 202) {
      throw new Error(`Unexpected createTenantConfig response status: ${response.status}`);
    }

    return {
      thid: envelope.thid,
      location: headerValue(response.headers, 'location')
    };
  }

  async pollTenantConfigResponse(
    options: DataConvTenantConfigPollOptions
  ): Promise<DataConvDidCommResponse<TenantAdapterConfigResource>> {
    return this.pollConfig(options);
  }

  async pollConfig(
    options: DataConvTenantConfigPollOptions
  ): Promise<DataConvDidCommResponse<TenantAdapterConfigResource>> {
    const tenantId = resolveConfigTenantId(this.config, options.tenantId ?? options.alternateName);
    const jurisdiction = resolveJurisdiction(this.config, options.jurisdiction);
    const sector = resolveSector(this.config, options.sector);
    const softwareId = requireText(options.softwareId, 'softwareId');
    const thid = requireText(options.thid, 'thid');

    const response = await this.pollUntilComplete<DataConvDidCommResponse<TenantAdapterConfigResource>>(
      async () => this.request({
        method: 'POST',
        url: `/host/cds-${jurisdiction}/v1/${sector}/${tenantId}/${softwareId}/config/_create-response?thid=${encodeURIComponent(thid)}`,
        headers: { 'Content-Type': 'application/didcomm-plain+json' },
        body: buildEnvelope({
          iss: options.iss,
          thid,
          type: options.type,
          iat: options.iat,
          exp: options.exp,
          idToken: options.idToken,
          vpToken: options.vpToken
        }, this.messageDeps())
      }),
      `Failed polling tenant config response after ${this.retryTimes} attempts`
    );

    this.lastTenantConfigResponse = response;
    return response;
  }

  async createTenantConfigAndWait(
    options: CreateTenantConfigOptions
  ): Promise<DataConvDidCommResponse<TenantAdapterConfigResource>> {
    const { thid } = await this.createConfig(options);
    return this.pollConfig({
      alternateName: options.alternateName,
      tenantId: options.tenantId,
      jurisdiction: options.jurisdiction,
      sector: options.sector,
      softwareId: resolveConfigSoftwareId(options),
      thid,
      iss: options.iss,
      type: options.type,
      idToken: options.idToken,
      vpToken: options.vpToken
    });
  }

  async uploadSpreadsheet(
    source: string | Uint8Array,
    options: DataConvUploadDidCommOptions
  ): Promise<DataConvUploadResult> {
    if (typeof source === 'string') {
      return this.uploadWithLink(source, options);
    }
    return this.uploadWithBinary(source, options);
  }

  async uploadWithLink(
    source: string,
    options: DataConvUploadDidCommOptions
  ): Promise<DataConvUploadResult> {
    return this.uploadDidComm(source, options);
  }

  async uploadWithBinary(
    source: Uint8Array,
    options: DataConvUploadDidCommOptions
  ): Promise<DataConvUploadResult> {
    return this.uploadDidComm(source, options);
  }

  private async uploadDidComm(
    source: string | Uint8Array,
    options: DataConvUploadDidCommOptions
  ): Promise<DataConvUploadResult> {
    const tenantId = resolveTenantId(this.config, options.tenantId ?? options.alternateName);
    const jurisdiction = resolveJurisdiction(this.config, options.jurisdiction);
    const sector = resolveSector(this.config, options.sector);
    const softwareId = requireText(options.softwareId, 'softwareId');
    const resourceType = resolveResourceType(this.config, options.resourceType);
    const envelope = buildEnvelope({
      iss: options.iss,
      thid: options.thid,
      type: options.type,
      iat: options.iat,
      exp: options.exp,
      idToken: options.idToken,
      vpToken: options.vpToken,
      body: options.body ?? DEFAULT_UPLOAD_BODY,
      attachments: [buildAttachment(source, options, this.cryptoApi)],
      extra: buildUploadExtra(options, this.config)
    }, this.messageDeps());

    const response = await this.request({
      method: 'POST',
      url: `/${tenantId}/cds-${jurisdiction}/v1/${sector}/digitaltwin/${softwareId}/${resourceType}/_upload`,
      headers: { 'Content-Type': 'application/didcomm-plain+json' },
      body: envelope
    });

    if (response.status !== 202) {
      throw new Error(`Unexpected uploadSpreadsheet response status: ${response.status}`);
    }

    return {
      thid: envelope.thid,
      location: headerValue(response.headers, 'location')
    };
  }

  async uploadSpreadsheetMultipart(options: DataConvMultipartUploadOptions): Promise<DataConvUploadResult> {
    return this.uploadWithFile(options);
  }

  async uploadWithFile(options: DataConvMultipartUploadOptions): Promise<DataConvUploadResult> {
    const tenantId = resolveTenantId(this.config, options.tenantId ?? options.alternateName);
    const jurisdiction = resolveJurisdiction(this.config, options.jurisdiction);
    const sector = resolveSector(this.config, options.sector);
    const softwareId = requireText(options.softwareId, 'softwareId');
    const resourceType = resolveResourceType(this.config, options.resourceType);
    const sourceFormat = normalizeSourceFormat(options.sourceFormat, this.config);
    const envelope = buildEnvelope({
      iss: options.iss,
      thid: options.thid,
      type: options.type,
      iat: options.iat,
      exp: options.exp,
      idToken: options.idToken,
      vpToken: options.vpToken,
      extra: buildUploadExtra(options, this.config)
    }, this.messageDeps());

    const formData = buildMultipartFormData(
      options.fileBytes,
      options.fileName || (sourceFormat === 'csv' ? 'input.csv' : 'input.xlsx'),
      options.mediaType || (sourceFormat === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      envelope
    );

    const response = await this.request({
      method: 'POST',
      url: `/${tenantId}/cds-${jurisdiction}/v1/${sector}/digitaltwin/${softwareId}/${resourceType}/_upload`,
      body: formData
    });

    if (response.status !== 202) {
      throw new Error(`Unexpected uploadSpreadsheetMultipart response status: ${response.status}`);
    }

    return {
      thid: envelope.thid,
      location: headerValue(response.headers, 'location')
    };
  }

  async pollConversionResponse(
    options: DataConvConversionPollOptions
  ): Promise<DataConvDidCommResponse<ConvertedBundleResource>> {
    return this.pollUploadResponse(options);
  }

  async pollUploadResponse(
    options: DataConvConversionPollOptions
  ): Promise<DataConvDidCommResponse<ConvertedBundleResource>> {
    const tenantId = resolveTenantId(this.config, options.tenantId ?? options.alternateName);
    const jurisdiction = resolveJurisdiction(this.config, options.jurisdiction);
    const sector = resolveSector(this.config, options.sector);
    const softwareId = requireText(options.softwareId, 'softwareId');
    const resourceType = resolveResourceType(this.config, options.resourceType);
    const thid = requireText(options.thid, 'thid');

    const response = await this.pollUntilComplete<DataConvDidCommResponse<ConvertedBundleResource>>(
      async () => this.request({
        method: 'POST',
        url: `/${tenantId}/cds-${jurisdiction}/v1/${sector}/digitaltwin/${softwareId}/${resourceType}/_upload-response?thid=${encodeURIComponent(thid)}`,
        headers: { 'Content-Type': 'application/didcomm-plain+json' },
        body: buildEnvelope({
          iss: options.iss,
          thid,
          type: options.type,
          iat: options.iat,
          exp: options.exp,
          idToken: options.idToken,
          vpToken: options.vpToken
        }, this.messageDeps())
      }),
      `Failed polling conversion response after ${this.retryTimes} attempts`
    );

    this.lastConversionResponse = response;
    return response;
  }

  async uploadSpreadsheetAndWait(
    source: string | Uint8Array,
    options: DataConvUploadDidCommOptions
  ): Promise<DataConvDidCommResponse<ConvertedBundleResource>> {
    const { thid } = await this.uploadSpreadsheet(source, options);
    return this.pollUploadResponse({
      alternateName: options.alternateName,
      tenantId: options.tenantId,
      jurisdiction: options.jurisdiction,
      sector: options.sector,
      softwareId: options.softwareId,
      resourceType: options.resourceType,
      thid,
      iss: options.iss,
      type: options.type,
      idToken: options.idToken,
      vpToken: options.vpToken
    });
  }

  async patchConversion(options: DataConvPatchOptions): Promise<DataConvPatchResponse> {
    const tenantId = resolveTenantId(this.config, options.tenantId ?? options.alternateName);
    const jurisdiction = resolveJurisdiction(this.config, options.jurisdiction);
    const sector = resolveSector(this.config, options.sector);
    const softwareId = requireText(options.softwareId, 'softwareId');
    const resourceType = requireText(options.resourceType || 'Composition', 'resourceType');
    const thid = requireText(options.thid, 'thid');

    const response = await this.request({
      method: 'POST',
      url: `/${tenantId}/cds-${jurisdiction}/v1/${sector}/digitaltwin/${softwareId}/${resourceType}/_patch?thid=${encodeURIComponent(thid)}`,
      headers: { 'Content-Type': 'application/didcomm-plain+json' },
      body: buildEnvelope({
        iss: options.iss,
        thid,
        type: options.type,
        iat: options.iat,
        exp: options.exp,
        idToken: options.idToken,
        vpToken: options.vpToken
      }, this.messageDeps())
    });

    if (response.status !== 200) {
      throw new Error(`Unexpected patchConversion response status: ${response.status}`);
    }

    return response.data as DataConvPatchResponse;
  }

  async batchPromotion(options: DataConvBatchOptions): Promise<DataConvPatchResponse> {
    const tenantId = resolveTenantId(this.config, options.tenantId ?? options.alternateName);
    const jurisdiction = resolveJurisdiction(this.config, options.jurisdiction);
    const sector = resolveSector(this.config, options.sector);
    const softwareId = requireText(options.softwareId, 'softwareId');
    const resourceType = requireText(options.resourceType || 'Patient', 'resourceType');
    const thid = requireText(options.thid, 'thid');

    const response = await this.request({
      method: 'POST',
      url: `/${tenantId}/cds-${jurisdiction}/v1/${sector}/digitaltwin/${softwareId}/${resourceType}/_batch?thid=${encodeURIComponent(thid)}`,
      headers: { 'Content-Type': 'application/didcomm-plain+json' },
      body: buildEnvelope({
        iss: options.iss,
        thid,
        type: options.type,
        iat: options.iat,
        exp: options.exp,
        idToken: options.idToken,
        vpToken: options.vpToken
      }, this.messageDeps())
    });

    if (response.status !== 200) {
      throw new Error(`Unexpected batchPromotion response status: ${response.status}`);
    }

    return response.data as DataConvPatchResponse;
  }

  async searchResources<TResource = Record<string, unknown>>(
    options: DataConvSearchOptions
  ): Promise<DataConvSearchBundle<TResource>> {
    const tenantId = resolveTenantId(this.config, options.tenantId ?? options.alternateName);
    const jurisdiction = resolveJurisdiction(this.config, options.jurisdiction);
    const sector = resolveSector(this.config, options.sector);
    const resourceType = requireText(options.resourceType, 'resourceType');
    const searchParams = normalizeSearchParams(
      options.searchParams && typeof options.searchParams === 'object'
        ? options.searchParams as Record<string, unknown>
        : undefined
    );
    const authToken = String(options.authorizationToken || options.idToken || this.idToken || '').trim();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await this.request({
      method: 'POST',
      url: `/host/cds-${jurisdiction}/v1/${sector}/${tenantId}/org.hl7.fhir.api/${resourceType}/_search`,
      headers,
      body: searchParams
    });

    if (response.status !== 200) {
      throw new Error(`Unexpected searchResources response status: ${response.status}`);
    }

    return response.data as DataConvSearchBundle<TResource>;
  }

  private async pollUntilComplete<T>(
    requestFactory: () => Promise<{ status: number; headers: Record<string, string>; data: unknown }>,
    errorMessage: string
  ): Promise<T> {
    for (let attempt = 0; attempt < this.retryTimes; attempt += 1) {
      const response = await requestFactory();
      if (response.status === 200) {
        return response.data as T;
      }

      const retryAfter = headerValue(response.headers, 'retry-after');
      const retrySeconds = retryAfter ? Number(retryAfter) : undefined;
      const delayMs = retrySeconds !== undefined && !Number.isNaN(retrySeconds)
        ? retrySeconds * 1000
        : this.retryDelayMs;
      await sleep(delayMs);
    }

    throw new Error(errorMessage);
  }

  private async request(options: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
  }): Promise<{ status: number; headers: Record<string, string>; data: unknown }> {
    const headers = options.headers ?? {};

    if (this.httpClient) {
      const response = await this.httpClient.request({
        method: options.method,
        url: options.url,
        data: options.body,
        headers,
        validateStatus: () => true
      });

      return {
        status: response.status,
        headers: (response.headers || {}) as Record<string, string>,
        data: response.data
      };
    }

    if (!this.fetchFn) {
      throw new Error('No HTTP transport available: provide axios httpClient or fetch implementation');
    }

    const response = await this.fetchFn(buildUrl(this.baseUrl, options.url), {
      method: options.method,
      headers,
      body: options.body === undefined
        ? undefined
        : isFormData(options.body)
          ? options.body
          : typeof options.body === 'string'
            ? options.body
              : JSON.stringify(options.body)
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('json') ? await response.json() : await response.text();
    return {
      status: response.status,
      headers: headersToObject(response.headers),
      data
    };
  }

  private messageDeps() {
    return {
      config: this.config,
      cryptoApi: this.cryptoApi,
      defaultExpSeconds: this.defaultExpSeconds,
      currentIdToken: this.idToken,
      currentVpToken: this.vpToken
    };
  }
}
