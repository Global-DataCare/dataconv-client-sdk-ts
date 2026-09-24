// Flow contract: reuse shared test fixtures and canonical types; do not introduce duplicated literals.
// 1. Each converted primary resource remains directly at body.data[].resource.
// 2. The browser derives bounded local pages from resource.contained[].meta.codingProposals without inventing a server cursor.
// 3. A human correction sends only the codingReviews shape accepted by DataConv.
// 4. Pending state comes only from proposal status; userSelected is coding provenance, never workflow state.

import axios from 'axios';
import { DataConvClient } from '../DataConvClient';
import type {
  DataConvCodingReview,
  DataConvDidCommResponse,
  ConvertedBundleResource,
  DataConvSearchBundle
} from '../types';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

function createClient(): DataConvClient {
  mockedAxios.create.mockReturnValue(mockedAxios);
  if (!mockedAxios.request) mockedAxios.request = jest.fn();
  mockedAxios.request.mockReset();
  return new DataConvClient({
    issuerDid: 'did:web:reviewer.example',
    tenantId: 'tenant-review',
    jurisdiction: 'CA-BC',
    sector: 'animal-research',
    baseUrl: 'http://localhost:8080'
  });
}

const review: DataConvCodingReview = {
  resourceType: 'Condition',
  resourceId: 'condition-1',
  proposalId: 'proposal-1',
  selectedCandidateId: 'candidate-externa',
  reason: 'Otoscopy localized inflammation to the external canal'
};

function conversionResponse(): DataConvDidCommResponse<ConvertedBundleResource> {
  return {
    thid: 'conversion-1',
    body: {
      resourceType: 'Bundle',
      type: 'batch-response',
      total: 1,
      data: [{
        response: { status: '200' },
        resource: {
          resourceType: 'ResearchSubject',
          id: 'subject-1',
          meta: { claims: { 'ResearchSubject.userSelected': 'true' } },
          contained: [{
                resourceType: 'Condition',
                id: 'condition-1',
                meta: {
                  claims: { 'Condition.userSelected': 'true' },
                  codingProposals: [{
                    id: 'proposal-1',
                    status: 'proposed',
                    field: 'Condition.code',
                    inputText: 'otitis',
                    rowContext: { species: 'canine' },
                    candidates: [{
                      id: 'candidate-externa',
                      system: 'http://snomed.info/sct',
                      code: '129127001',
                      display: 'Otitis externa',
                      source: 'SNOMED_GPS',
                      recommendationPercent: 74
                    }]
                  }]
                }
              }, {
                resourceType: 'Procedure',
                id: 'procedure-1',
                meta: {
                  claims: { 'Procedure.userSelected': 'false' },
                  codingProposals: [{
                    id: 'proposal-2',
                    status: 'accepted',
                    userSelected: true,
                    selectedCandidateId: 'candidate-procedure',
                    field: 'Procedure.code',
                    inputText: 'ear cleaning',
                    rowContext: {},
                    candidates: []
                  }]
                }
              }]
        }
      }]
    }
  };
}

describe('DataConv coding review contract', () => {
  it('carries the same FHIR ResearchStudy reference through upload polling and human promotion', async () => {
    const client = createClient();
    const researchStudy = { reference: 'ResearchStudy/study-one' };
    mockedAxios.request
      .mockResolvedValueOnce({ status: 202, headers: { location: '/upload-response' }, data: {} })
      .mockResolvedValueOnce({ status: 200, headers: {}, data: conversionResponse() })
      .mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: { thid: 'conversion-1', body: { status: 'success', promotedCount: 1 } }
      });

    await client.uploadSpreadsheet(new Uint8Array([1, 2, 3]), {
      softwareId: 'source-v1.0',
      thid: 'conversion-1',
      researchStudy
    });
    await client.pollUploadResponse({
      softwareId: 'source-v1.0',
      thid: 'conversion-1',
      researchStudy
    });
    await client.patchConversion({
      softwareId: 'source-v1.0',
      thid: 'conversion-1',
      researchStudy,
      body: { codingReviews: [review] }
    });

    const requests = mockedAxios.request.mock.calls.map(([request]) => request);
    expect(requests[0]?.data).toMatchObject({ body: { researchStudy } });
    expect(requests[1]?.data).toMatchObject({ researchStudy });
    expect(requests[2]?.data).toMatchObject({ body: { researchStudy, codingReviews: [review] } });
  });

  it('transports typed coding reviews inside the DIDComm body used by the Python API', async () => {
    const client = createClient();
    mockedAxios.request.mockResolvedValueOnce({
      status: 200,
      headers: {},
      data: { thid: 'conversion-1', body: { status: 'success', promotedCount: 2 } }
    });

    await client.patchConversion({
      softwareId: 'source-v1.0',
      thid: 'conversion-1',
      authorizationToken: 'review-token',
      body: { codingReviews: [review] }
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      data: expect.objectContaining({ body: { codingReviews: [review] } })
    }));
  });

  it('builds bounded, stable local pages from the coding proposals actually returned by upload-response', () => {
    const client = createClient();
    const sourceResponse = conversionResponse();

    const firstPage = client.getCodingReviewPage(sourceResponse, { page: 1, pageSize: 1 });
    const secondPage = client.getCodingReviewPage(sourceResponse, { page: 2, pageSize: 1 });

    expect(firstPage).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 1,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false
    });
    expect(firstPage.items[0]).toMatchObject({
      subjectResourceType: 'ResearchSubject',
      subjectId: 'subject-1',
      resourceType: 'Condition',
      resourceId: 'condition-1',
      proposalId: 'proposal-1',
      state: 'proposed',
      draftState: 'draft'
    });
    expect(secondPage.items).toEqual([]);

    expect(Object.isFrozen(firstPage)).toBe(true);
    expect(Object.isFrozen(firstPage.items)).toBe(true);
    expect(Object.isFrozen(firstPage.items[0])).toBe(true);
    expect(Object.isFrozen(firstPage.items[0].rowContext)).toBe(true);
    expect(Object.isFrozen(firstPage.items[0].candidates)).toBe(true);
    expect(Object.isFrozen(firstPage.items[0].candidates[0])).toBe(true);
    expect(() => {
      (firstPage.items[0].rowContext as Record<string, string>).species = 'mutated-in-ui';
    }).toThrow(TypeError);
    expect(client.getCodingReviewPage(sourceResponse).items[0].rowContext.species).toBe('canine');
  });

  it('builds the same review page from durable ResearchSubject search results', () => {
    const client = createClient();
    const direct = conversionResponse().body?.data?.[0]?.resource;
    const durable: DataConvSearchBundle<ConvertedBundleResource> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 1,
      entry: [{ resource: direct }],
    };

    const page = client.getCodingReviewPage(durable, { page: 1, pageSize: 25 });

    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      subjectId: 'subject-1',
      resourceId: 'condition-1',
      proposalId: 'proposal-1',
    });
  });

  it('can include reviewed proposals without deriving workflow from userSelected', () => {
    const client = createClient();
    const page = client.getCodingReviewPage(conversionResponse(), { includeReviewed: true });

    expect(page.items).toHaveLength(2);
    expect(page.items[0]).toMatchObject({ proposalId: 'proposal-1', draftState: 'draft' });
    expect(page.items[1]).toMatchObject({ proposalId: 'proposal-2', draftState: 'promoted' });
    expect(page.items[1].userSelected).toBe(true);
  });

  it('rejects unsafe pagination inputs instead of allocating or silently truncating them', () => {
    const client = createClient();

    expect(() => client.getCodingReviewPage(conversionResponse(), { page: 0, pageSize: 25 }))
      .toThrow('page must be a positive safe integer');
    expect(() => client.getCodingReviewPage(conversionResponse(), { page: 1, pageSize: 101 }))
      .toThrow('pageSize must be between 1 and 100');
  });
});
