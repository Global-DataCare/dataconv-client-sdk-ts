import { createPrivateKey, sign } from 'node:crypto';
import type {
  DataConvCodingCandidate,
  DataConvCodingReview,
  DataConvFhirReference
} from './types.js';

export type DataConvReportTerminologyQuery = Readonly<{
  text: string;
  language: string;
  sources: readonly string[];
}>;
export type DataConvReportCodingReview = DataConvCodingReview & Readonly<{
  terminologyQuery?: DataConvReportTerminologyQuery;
}>;
export type DataConvReportCandidateSearch =
  Pick<DataConvCodingReview, 'resourceType' | 'resourceId' | 'proposalId'> & DataConvReportTerminologyQuery;

type ReportJob = Readonly<{ thid: string; softwareId: string; reportId: string }>;
type ScopedResearch = Readonly<{ subject: string; researchStudy: DataConvFhirReference }>;
type ReportAccess = ScopedResearch & Readonly<{
  authorizationToken: string;
  mode: 'demo-ephemeral' | 'study-report';
}>;
type ReportWorkbook = Readonly<{
  thid: string;
  softwareId: string;
  fileName: string;
  fileBytes: Uint8Array;
  headerRowIndex: number;
  fieldMap: Readonly<Record<string, string>>;
}>;
type ReportResponse = Readonly<{
  thid?: string;
  body?: Readonly<{
    data?: Array<{ resource?: { resourceType?: string; id?: string; contained?: unknown[] } }>;
    reportId?: string;
    proposalId?: string;
    candidates?: DataConvCodingCandidate[];
  }>;
}>;
type Connection = Readonly<{
  baseUrl: string;
  tenantId: string;
  jurisdiction: string;
  sector: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}>;
const REQUEST_POLICY = { cache: 'no-store', redirect: 'error' } as const;

export class DataConvResearchError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
    this.name = 'DataConvResearchError';
  }
}

/** Server-side Demo authorization and standalone report operations for an initialized DataConv tenant. */
export class DataConvResearchClient {
  private readonly request: typeof fetch;
  private readonly publisher: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: Connection) {
    const baseUrl = config.baseUrl.trim().replace(/\/+$/u, '');
    let url: URL;
    try {
      url = new URL(baseUrl);
    } catch {
      throw new DataConvResearchError('demo_dataconv_url_invalid', 503);
    }
    const loopback = url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !loopback)) {
      throw new DataConvResearchError('demo_dataconv_url_invalid', 503);
    }
    const segments = [config.jurisdiction, config.sector, config.tenantId];
    if (segments.some(value => !value.trim() || value === '.' || value === '..')) {
      throw new DataConvResearchError('dataconv_research_scope_invalid', 503);
    }
    this.request = config.fetch ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 25_000;
    const [jurisdiction, sector, tenantId] = segments.map(encodeURIComponent);
    this.publisher = `${url.href.replace(/\/+$/u, '')}/publisher/cds-${jurisdiction}/v1/${sector}/${tenantId}`;
  }

  async exchangeDemoStudyAccess(input: ScopedResearch & Readonly<{
    issuer: string;
    audience: string;
    privateJwk: string;
  }>): Promise<string> {
    const { issuer, audience, privateJwk, subject, researchStudy } = input;
    const { tenantId, jurisdiction, sector } = this.config;
    if (!/^[A-Za-z0-9._-]{1,128}$/u.test(tenantId) || tenantId === '.' || tenantId === '..'
      || !/^[A-Z]{2}(?:-[A-Z0-9]{1,3})?$/u.test(jurisdiction)
      || (sector !== 'animal-research' && sector !== 'onehealth-research')) {
      throw new DataConvResearchError('demo_dataconv_not_configured', 503);
    }
    if (!/^did:web:[A-Za-z0-9.%:_-]+:employee:[A-Za-z0-9._-]+$/u.test(subject)) {
      throw new DataConvResearchError('demo_dataconv_employee_did_invalid', 403);
    }
    const now = Math.floor(Date.now() / 1000);
    const claims = { iss: issuer, aud: audience, sub: subject, tenant: tenantId, jurisdiction, sector,
      study: researchStudy.reference, purpose: 'HRESCH', iat: now, nbf: now, exp: now + 60 };
    let assertion: string;
    try {
      const key = createPrivateKey({ key: JSON.parse(privateJwk), format: 'jwk' });
      if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
        throw new Error('Expected a P-256 key');
      }
      const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const unsigned = `${encode({ alg: 'ES256', typ: 'JWT' })}.${encode(claims)}`;
      assertion = `${unsigned}.${sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
    } catch {
      throw new DataConvResearchError('demo_dataconv_assertion_key_invalid', 503);
    }
    const response = await this.request(`${this.publisher}/research/auth/_demo-exchange`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assertion }),
      signal: AbortSignal.timeout(10_000), ...REQUEST_POLICY,
    }).catch(() => { throw new DataConvResearchError('demo_dataconv_exchange_unavailable', 503); });
    if (!response.ok) throw new DataConvResearchError('demo_dataconv_exchange_failed', 503);
    const result = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!result || result.organization !== tenantId || result.subject !== subject || result.study !== researchStudy.reference
      || typeof result.access_token !== 'string' || !result.access_token || result.token_type !== 'Bearer') {
      throw new DataConvResearchError('demo_dataconv_exchange_response_invalid', 502);
    }
    return result.access_token;
  }

  async uploadReportWorkbook(access: ReportAccess, input: ReportWorkbook) {
    const body = new FormData();
    body.set('payload', JSON.stringify({
      ...this.envelope(access, input.thid), sourceFormat: 'xlsx', mode: access.mode, send: false,
      inlineConfig: {
        schemaConfig: { headerRowIndex: input.headerRowIndex, fieldMap: input.fieldMap },
        runtimeDefaults: { dataUse: 'standalone-report' },
      },
    }));
    body.set('file', new Blob([new Uint8Array(input.fileBytes)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }), input.fileName);
    const response = await this.submit(access, `${this.dataset(input.softwareId)}/_upload`, 202, body);
    return { thid: input.thid, location: response.headers.get('Location') ?? undefined };
  }

  async reviewReport(access: ReportAccess, input: ReportJob & Readonly<{ codingReviews: readonly DataConvReportCodingReview[] }>) {
    const payload = await this.reportOperation(access, input, {
      reportReview: { reportId: input.reportId, codingReviews: input.codingReviews },
    });
    const rows = payload.body?.data;
    const resource = Array.isArray(rows) && rows.length === 1 ? rows[0]?.resource : undefined;
    if (resource?.resourceType !== 'Composition' || resource.id !== input.reportId || !Array.isArray(resource.contained)) {
      throw new DataConvResearchError('research_report_review_response_invalid', 502);
    }
    return { resourceType: 'Bundle' as const, type: 'collection' as const,
      entry: resource.contained.map((item: unknown) => ({ resource: item })) };
  }

  async searchReportCandidates(access: ReportAccess, input: ReportJob, query: DataConvReportCandidateSearch): Promise<readonly DataConvCodingCandidate[]> {
    const { body } = await this.reportOperation(access, input, {
      reportCandidateSearch: { ...query, reportId: input.reportId },
    });
    if (body?.reportId !== input.reportId || body.proposalId !== query.proposalId || !Array.isArray(body.candidates)) {
      throw new DataConvResearchError('research_report_review_response_invalid', 502);
    }
    return body.candidates;
  }

  private dataset(softwareId: string): string {
    if (!/^[A-Za-z0-9._-]{1,128}$/u.test(softwareId) || softwareId === '.' || softwareId === '..') {
      throw new DataConvResearchError('research_import_software_invalid', 400);
    }
    return `${this.publisher}/dataset/${softwareId}/Bundle`;
  }

  private envelope(access: ScopedResearch, thid: string) {
    if (!thid || thid.length > 200) throw new DataConvResearchError('research_import_thread_invalid', 400);
    const iat = Math.floor(Date.now() / 1000);
    return { thid, iss: access.subject, type: 'https://didcomm.org/plaintext/2.0/message',
      iat, exp: iat + 60, researchStudy: access.researchStudy };
  }

  private async reportOperation(access: ReportAccess, input: ReportJob,
    operation: { reportReview: { reportId: string; codingReviews: readonly DataConvReportCodingReview[] } }
      | { reportCandidateSearch: DataConvReportCandidateSearch & { reportId: string } }) {
    const thid = input.thid.trim();
    const response = await this.submit(access, `${this.dataset(input.softwareId.trim())}/_upload-response`, 200,
      JSON.stringify({ ...this.envelope(access, thid), ...operation }));
    const payload = await response.json().catch(() => null) as ReportResponse | null;
    if (payload?.thid !== thid) throw new DataConvResearchError('research_report_review_response_invalid', 502);
    return payload;
  }

  private async submit(access: ReportAccess, url: string, expectedStatus: number, body: FormData | string): Promise<Response> {
    const response = await this.request(url, {
      method: 'POST', headers: { Authorization: `Bearer ${access.authorizationToken}`,
        ...(typeof body === 'string' ? { 'Content-Type': 'application/didcomm-plain+json' } : {}) },
      body, signal: AbortSignal.timeout(this.timeoutMs), ...REQUEST_POLICY,
    }).catch(() => { throw new DataConvResearchError('research_report_operation_unavailable', 503); });
    if (response.status !== expectedStatus) {
      const status = [400, 401, 403, 404, 409, 413].includes(response.status) ? response.status : 502;
      throw new DataConvResearchError('research_report_operation_failed', status);
    }
    return response;
  }
}
