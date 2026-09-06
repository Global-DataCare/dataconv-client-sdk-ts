// Flow contract: reuse shared test fixtures and canonical types; do not introduce duplicated literals.
// 1. The conversion response remains the server's single ConversionResult Bundle.
// 2. The browser derives bounded local pages from codingProposals without inventing a server cursor.
// 3. A human correction sends only the codingReviews shape accepted by DataConv.
// 4. Proposal and draft states remain explicit until the server confirms promotion.

import axios from 'axios';
import { DataConvClient } from '../DataConvClient';
import type {
  DataConvCodingReview,
  DataConvDidCommResponse,
  ConvertedBundleResource
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
        type: 'ConversionResult',
        response: { status: '200' },
        resource: {
          resourceType: 'Bundle',
          type: 'batch',
          total: 1,
          data: [{
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
      }]
    }
  };
}

describe('DataConv coding review contract', () => {
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
      total: 2,
      totalPages: 2,
      hasPreviousPage: false,
      hasNextPage: true
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
    expect(secondPage.items[0]).toMatchObject({
      resourceType: 'Procedure',
      proposalId: 'proposal-2',
      state: 'accepted',
      draftState: 'promoted'
    });

    firstPage.items[0].rowContext.species = 'mutated-in-ui';
    expect(client.getCodingReviewPage(sourceResponse).items[0].rowContext.species).toBe('canine');
  });

  it('rejects unsafe pagination inputs instead of allocating or silently truncating them', () => {
    const client = createClient();

    expect(() => client.getCodingReviewPage(conversionResponse(), { page: 0, pageSize: 25 }))
      .toThrow('page must be a positive safe integer');
    expect(() => client.getCodingReviewPage(conversionResponse(), { page: 1, pageSize: 101 }))
      .toThrow('pageSize must be between 1 and 100');
  });
});
