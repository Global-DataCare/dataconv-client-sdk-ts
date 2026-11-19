import { generateKeyPairSync, verify } from 'node:crypto';
import { DataConvResearchClient } from '../research-node.js';

const connection = { baseUrl: 'http://127.0.0.1:8080', jurisdiction: 'ES', sector: 'animal-research', tenantId: 'demo' };
const scope = { subject: 'did:web:example.org:employee:researcher', researchStudy: { reference: 'ResearchStudy/study' } };
const access = { ...scope, authorizationToken: 'scoped-token', mode: 'demo-ephemeral' as const };
const job = { thid: 'job', softwareId: 'workbook', reportId: 'report' };

it('signs a bounded Demo exchange and rejects a token issued for another study', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const credentials = { ...scope, issuer: 'demo-portal', audience: 'demo-service', privateJwk: JSON.stringify(privateKey.export({ format: 'jwk' })) };
  const response = { access_token: 'demo-token', token_type: 'Bearer', organization: 'demo',
    subject: scope.subject, study: scope.researchStudy.reference };
  const request = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(Response.json(response))
    .mockResolvedValueOnce(Response.json({ ...response, study: 'ResearchStudy/another' }));
  const client = new DataConvResearchClient({ ...connection, fetch: request });

  await expect(client.exchangeDemoStudyAccess(credentials)).resolves.toBe('demo-token');
  const [url, init] = request.mock.calls[0];
  expect(url).toBe('http://127.0.0.1:8080/publisher/cds-ES/v1/animal-research/demo/research/auth/_demo-exchange');
  expect(init).toMatchObject({ method: 'POST', redirect: 'error', cache: 'no-store' });
  const [header, claims, signature] = JSON.parse(String(init?.body)).assertion.split('.');
  const signedClaims = JSON.parse(Buffer.from(claims, 'base64url').toString());
  expect(signedClaims).toMatchObject({ iss: credentials.issuer, aud: credentials.audience, sub: scope.subject,
    study: scope.researchStudy.reference, tenant: 'demo', purpose: 'HRESCH', exp: signedClaims.iat + 60 });
  expect(verify('sha256', Buffer.from(`${header}.${claims}`), { key: publicKey, dsaEncoding: 'ieee-p1363' },
    Buffer.from(signature, 'base64url'))).toBe(true);
  await expect(client.exchangeDemoStudyAccess(credentials)).rejects.toMatchObject({
    code: 'demo_dataconv_exchange_response_invalid', status: 502,
  });
});

it('uploads and reviews standalone reports using the study scope and the report identifier', async () => {
  const entry = { resourceType: 'Observation', id: 'observation' };
  const request = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(new Response(null, { status: 202, headers: { Location: '/job' } }))
    .mockResolvedValueOnce(Response.json({ thid: job.thid, body: { data: [{
      resource: { resourceType: 'Composition', id: job.reportId, contained: [entry] },
    }] } }))
    .mockResolvedValueOnce(Response.json({ thid: job.thid, body: { reportId: 'another', proposalId: 'proposal', candidates: [] } }));
  const client = new DataConvResearchClient({ ...connection, fetch: request });
  await expect(client.uploadReportWorkbook(access, {
    ...job, fileName: 'report.xlsx', fileBytes: new Uint8Array([1, 2, 3]), headerRowIndex: 0, fieldMap: {},
  })).resolves.toEqual({ thid: job.thid, location: '/job' });
  const upload = request.mock.calls[0][1];
  expect(upload?.headers).toEqual({ Authorization: 'Bearer scoped-token' });
  const body = upload?.body as FormData;
  expect(JSON.parse(String(body.get('payload')))).toMatchObject({
    researchStudy: scope.researchStudy, thid: job.thid, mode: 'demo-ephemeral',
    inlineConfig: { runtimeDefaults: { dataUse: 'standalone-report' } },
  });
  await expect(client.reviewReport(access, { ...job, codingReviews: [] })).resolves.toEqual({
    resourceType: 'Bundle', type: 'collection', entry: [{ resource: entry }],
  });
  await expect(client.searchReportCandidates(access, job, {
    resourceType: 'Observation', resourceId: 'observation', proposalId: 'proposal',
    text: 'clinical term', language: 'en', sources: [],
  })).rejects.toMatchObject({ code: 'research_report_review_response_invalid', status: 502 });
});
