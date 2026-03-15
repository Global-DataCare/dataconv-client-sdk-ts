import axios from 'axios';
import { DataConvClient } from '../DataConvClient';
import type {
  ConvertedBundleResource,
  DataConvCrypto,
  DataConvDidCommResponse,
  TenantAdapterConfigResource
} from '../types';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const originalFetch = global.fetch;

function createMockResponse(status: number, headers: Headers = new Headers(), data: any = {}) {
  return {
    status,
    headers,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
    ok: status >= 200 && status < 300,
    statusText: '',
    type: 'basic',
    url: 'http://localhost:8080',
    redirected: false,
    clone: () => ({} as Response),
    body: null,
    bodyUsed: false,
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    blob: jest.fn().mockResolvedValue(new Blob([])),
    formData: jest.fn().mockResolvedValue(new FormData())
  } as unknown as Response;
}

describe('DataConvClient', () => {
  let client: DataConvClient;

  beforeEach(() => {
    mockedAxios.create.mockReturnValue(mockedAxios);
    if (!mockedAxios.request) {
      mockedAxios.request = jest.fn();
    }
    mockedAxios.request.mockReset();

    client = new DataConvClient({
      issuerDid: 'did:web:clinic.example:employee:it:loader',
      alternateName: 'clinic-demo',
      tenantId: 'clinic-demo',
      jurisdiction: 'ES',
      baseUrl: 'http://localhost:8080',
      retryTimes: 3,
      retryDelayMs: 1
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('creates tenant config requests', async () => {
    mockedAxios.request.mockResolvedValueOnce({
      status: 202,
      headers: { location: '/host/cds-ES/v1/onehealth-research/clinic-demo/qvet-v1.0/config/_create-response?thid=cfg-1' }
    });

    const result = await client.createConfig({
      entries: [
        {
          softwareId: 'qvet-v1.0',
          config: {
            mappingConfig: {
              headerRowIndex: 1,
              fieldMap: { section: 'SECCION', concept: 'CONCEPTO' }
            }
          }
        }
      ]
    });

    expect(result.thid).toMatch(UUID_V4_REGEX);
    expect(result.location).toContain('_create-response');
    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      url: '/host/cds-ES/v1/onehealth-research/clinic-demo/qvet-v1.0/config/_create',
      headers: { 'Content-Type': 'application/didcomm-plain+json' },
      data: expect.objectContaining({
        iss: 'did:web:clinic.example:employee:it:loader',
        thid: expect.any(String),
        jti: expect.any(String),
        data: [
          expect.objectContaining({ softwareId: 'qvet-v1.0' })
        ]
      })
    }));
  });

  it('prefers tenantId over alternateName for tenant config endpoints', async () => {
    const vatClient = new DataConvClient({
      issuerDid: 'did:web:clinic.example:employee:it:loader',
      alternateName: 'clinic-demo',
      tenantId: 'VATES-B00000000',
      jurisdiction: 'ES',
      baseUrl: 'http://localhost:8080',
      retryTimes: 3,
      retryDelayMs: 1
    });

    mockedAxios.request.mockResolvedValueOnce({
      status: 202,
      headers: { location: '/host/cds-ES/v1/onehealth-research/VATES-B00000000/qvet-v1.0/config/_create-response?thid=cfg-1' }
    });

    await vatClient.createConfig({
      entries: [{ softwareId: 'qvet-v1.0' }]
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({
      url: '/host/cds-ES/v1/onehealth-research/VATES-B00000000/qvet-v1.0/config/_create'
    }));
  });

  it('polls tenant config responses and stores successful resources', async () => {
    const payload: DataConvDidCommResponse<TenantAdapterConfigResource> = {
      thid: 'cfg-1',
      iss: 'did:web:globaldatacare.es:employee:preconversion',
      aud: 'did:web:clinic.example:employee:it:loader',
      type: 'https://didcomm.org/plaintext/2.0/message',
      iat: 1760000000,
      exp: 1760000300,
      body: {
        resourceType: 'Bundle',
        type: 'batch-response',
        total: 1,
        data: [
          {
            type: 'TenantAdapterConfig',
            response: { status: '200' },
            resource: {
              id: 'cfg-1',
              type: 'tenant-adapter-config',
              alternateName: 'clinic-demo',
              softwareId: 'qvet-v1.0',
              country: 'ES',
              facilityId: '',
              revision: '1',
              createdAt: '2026-03-12T06:55:50Z',
              updatedAt: '2026-03-12T07:11:23Z',
              audit: {},
              content: {}
            }
          }
        ]
      }
    };

    mockedAxios.request
      .mockResolvedValueOnce({ status: 202, headers: { 'retry-after': '0' } })
      .mockResolvedValueOnce({ status: 200, headers: {}, data: payload });

    const response = await client.pollConfig({ thid: 'cfg-1', softwareId: 'qvet-v1.0' });

    expect(response).toEqual(payload);
    expect(client.getLastTenantConfigResponse()).toEqual(payload);
    expect(client.getSuccessfulTenantConfigs()).toEqual([payload.body?.data?.[0]?.resource]);
  });

  it('uploads a spreadsheet by link as a DIDComm attachment', async () => {
    mockedAxios.request.mockResolvedValueOnce({
      status: 202,
      headers: { location: '/clinic-demo/cds-ES/v1/onehealth-research/digitaltwin/qvet-v1.0/Composition/_upload-response?thid=up-1' }
    });

    const result = await client.uploadWithLink('https://example.com/exampleQvetES.xlsx?dl=1', {
      softwareId: 'qvet-v1.0',
      fileName: 'exampleQvetES.xlsx'
    });

    expect(result.thid).toMatch(UUID_V4_REGEX);
    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      url: '/clinic-demo/cds-ES/v1/onehealth-research/digitaltwin/qvet-v1.0/Composition/_upload',
      headers: { 'Content-Type': 'application/didcomm-plain+json' },
      data: expect.objectContaining({
        sourceFormat: 'excel',
        attachments: [
          expect.objectContaining({
            filename: 'exampleQvetES.xlsx',
            data: { links: ['https://example.com/exampleQvetES.xlsx?dl=1'] }
          })
        ]
      })
    }));
  });

  it('uploads a spreadsheet by base64 and includes tokens', async () => {
    client.setIdToken('id-token-1');
    client.setVpToken('vp-token-1');
    mockedAxios.request.mockResolvedValueOnce({
      status: 202,
      headers: { location: '/dummy' }
    });

    await client.uploadSpreadsheet(new Uint8Array([1, 2, 3]), {
      softwareId: 'qvet-v1.0',
      fileName: 'exampleQvetES.xlsx'
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        id_token: 'id-token-1',
        vp_token: 'vp-token-1',
        sourceFormat: 'excel',
        attachments: [
          expect.objectContaining({
            data: { base64: Buffer.from([1, 2, 3]).toString('base64') }
          })
        ]
      })
    }));
  });

  it('builds multipart upload requests', async () => {
    mockedAxios.request.mockResolvedValueOnce({
      status: 202,
      headers: { location: '/dummy' }
    });

    await client.uploadWithFile({
      softwareId: 'qvet-v1.0',
      fileBytes: new Uint8Array([4, 5, 6]),
      fileName: 'exampleQvetES.xlsx'
    });

    const requestConfig = mockedAxios.request.mock.calls[0]?.[0];
    expect(requestConfig?.url).toBe('/clinic-demo/cds-ES/v1/onehealth-research/digitaltwin/qvet-v1.0/Composition/_upload');
    expect(requestConfig?.data).toBeInstanceOf(FormData);
    const payloadEntry = Array.from((requestConfig?.data as FormData).entries()).find(([key]) => key === 'payload');
    expect(payloadEntry?.[1]).toEqual(expect.any(String));
    const payloadJson = JSON.parse(String(payloadEntry?.[1]));
    expect(payloadJson.sourceFormat).toBe('excel');
  });

  it('polls conversion responses and extracts the converted bundle', async () => {
    const payload: DataConvDidCommResponse<ConvertedBundleResource> = {
      thid: 'up-1',
      iss: 'did:web:globaldatacare.es:employee:preconversion',
      aud: 'did:web:clinic.example:employee:it:loader',
      type: 'https://didcomm.org/plaintext/2.0/message',
      iat: 1760000000,
      exp: 1760000300,
      body: {
        resourceType: 'Bundle',
        type: 'batch-response',
        total: 1,
        data: [
          {
            type: 'ConversionResult',
            response: { status: '200' },
            resource: {
              resourceType: 'Bundle',
              type: 'batch',
              total: 1,
              data: [{ resource: { resourceType: 'Patient', id: 'patient-1' } }]
            }
          }
        ]
      }
    };

    mockedAxios.request
      .mockResolvedValueOnce({ status: 202, headers: { 'retry-after': '0' } })
      .mockResolvedValueOnce({ status: 200, headers: {}, data: payload });

    const response = await client.pollUploadResponse({
      thid: 'up-1',
      softwareId: 'qvet-v1.0'
    });

    expect(response).toEqual(payload);
    expect(client.getLastConversionResponse()).toEqual(payload);
    expect(client.getConversionEntry()?.response?.status).toBe('200');
    expect(client.getConvertedBundle()).toEqual(payload.body?.data?.[0]?.resource);
  });

  it('uses injected crypto for generated thread ids', async () => {
    const crypto: DataConvCrypto = {
      randomUUID: jest.fn(() => '11111111-2222-4333-8444-555555555555')
    };
    const injectedClient = new DataConvClient({
      issuerDid: 'did:web:clinic.example:employee:it:loader',
      alternateName: 'clinic-demo',
      tenantId: 'clinic-demo',
      jurisdiction: 'ES',
      crypto
    });

    mockedAxios.request.mockResolvedValueOnce({
      status: 202,
      headers: { location: '/dummy' }
    });

    const result = await injectedClient.createConfig({
      entries: [{ softwareId: 'qvet-v1.0' }]
    });

    expect(result.thid).toBe('11111111-2222-4333-8444-555555555555');
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it('uploads a spreadsheet using fetch when axios is not injected', async () => {
    mockedAxios.create.mockReset();
    mockedAxios.create.mockReturnValue(undefined as any);

    const mockFetch = jest.fn();
    global.fetch = mockFetch as typeof fetch;

    const fetchClient = new DataConvClient({
      issuerDid: 'did:web:clinic.example:employee:it:loader',
      alternateName: 'clinic-demo',
      tenantId: 'clinic-demo',
      jurisdiction: 'ES',
      baseUrl: 'http://localhost:8080',
      retryTimes: 2,
      retryDelayMs: 1,
      fetch: mockFetch as typeof fetch
    });

    mockFetch.mockResolvedValue(
      createMockResponse(202, new Headers({ location: '/clinic-demo/cds-ES/v1/onehealth-research/digitaltwin/qvet-v1.0/Composition/_upload-response?thid=up-1' }), {})
    );

    const result = await fetchClient.uploadWithLink('https://example.com/exampleQvetES.xlsx?dl=1', {
      softwareId: 'qvet-v1.0',
      fileName: 'exampleQvetES.xlsx'
    });

    expect(result.thid).toMatch(UUID_V4_REGEX);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/clinic-demo/cds-ES/v1/onehealth-research/digitaltwin/qvet-v1.0/Composition/_upload',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/didcomm-plain+json' },
        body: expect.any(String)
      })
    );

    const rawBody = mockFetch.mock.calls[0]?.[1]?.body;
    const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : undefined;
    expect(payload?.iss).toBe('did:web:clinic.example:employee:it:loader');
    expect(payload?.thid).toEqual(expect.any(String));
    expect(payload?.sourceFormat).toBe('excel');
    expect(payload?.attachments?.[0]?.data?.links).toEqual(['https://example.com/exampleQvetES.xlsx?dl=1']);
  });

  it('polls conversion responses using fetch', async () => {
    mockedAxios.create.mockReset();
    mockedAxios.create.mockReturnValue(undefined as any);

    const mockFetch = jest.fn();
    global.fetch = mockFetch as typeof fetch;

    const fetchClient = new DataConvClient({
      issuerDid: 'did:web:clinic.example:employee:it:loader',
      alternateName: 'clinic-demo',
      tenantId: 'clinic-demo',
      jurisdiction: 'ES',
      baseUrl: 'http://localhost:8080',
      retryTimes: 2,
      retryDelayMs: 1,
      fetch: mockFetch as typeof fetch
    });

    mockFetch
      .mockResolvedValueOnce(createMockResponse(202, new Headers({ 'retry-after': '0' }), {}))
      .mockResolvedValueOnce(createMockResponse(200, new Headers({ 'content-type': 'application/json' }), {
        thid: 'up-1',
        body: { data: [{ type: 'ConversionResult', response: { status: '200' }, resource: { resourceType: 'Bundle' } }] }
      }));

    const response = await fetchClient.pollUploadResponse({
      thid: 'up-1',
      softwareId: 'qvet-v1.0'
    });

    expect(response.thid).toBe('up-1');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(fetchClient.getConversionEntry(response)?.type).toBe('ConversionResult');
  });


  it('patches promoted conversion resources through the canonical digital twin endpoint', async () => {
    client.setIdToken('session-id-1');
    client.setVpToken('vp-token-1');
    mockedAxios.request.mockResolvedValueOnce({
      status: 200,
      headers: {},
      data: {
        type: 'https://didcomm.org/plaintext/2.0/message',
        thid: 'up-1',
        body: { status: 'success', promotedCount: 2 }
      }
    });

    const response = await client.patchConversion({
      thid: 'up-1',
      softwareId: 'qvet-v1.0'
    });

    expect(response.body?.status).toBe('success');
    expect(response.body?.promotedCount).toBe(2);
    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'PATCH',
      url: '/clinic-demo/cds-ES/v1/onehealth-research/digitaltwin/qvet-v1.0/Composition/_patch?thid=up-1',
      headers: { 'Content-Type': 'application/didcomm-plain+json' },
      data: expect.objectContaining({
        id_token: 'session-id-1',
        vp_token: 'vp-token-1',
        thid: 'up-1'
      })
    }));
  });

  it('searches research resources with FHIR-like parameters', async () => {
    client.setIdToken('session-id-1');
    mockedAxios.request.mockResolvedValueOnce({
      status: 200,
      headers: {},
      data: {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [
          {
            resource: {
              resourceType: 'DocumentReference',
              id: 'doc-1',
              meta: {
                claims: {
                  'DocumentReference.userSelected': 'false'
                }
              }
            }
          }
        ]
      }
    });

    const response = await client.searchResources({
      softwareId: 'qvet-v1.0',
      resourceType: 'DocumentReference',
      searchParams: {
        userSelected: 'false',
        date: 'ge2026-03-01'
      }
    });

    expect(response.total).toBe(1);
    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      url: '/clinic-demo/cds-ES/v1/onehealth-research/digitaltwin/qvet-v1.0/DocumentReference/_search',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer session-id-1'
      },
      data: {
        userSelected: 'false',
        date: 'ge2026-03-01'
      }
    }));
  });

  it('supports a mocked config, upload, poll, batch and search workflow', async () => {
    mockedAxios.request
      .mockResolvedValueOnce({
        status: 202,
        headers: { location: '/host/cds-ES/v1/onehealth-research/clinic-demo/qvet-v1.0/config/_create-response?thid=cfg-1' }
      })
      .mockResolvedValueOnce({ status: 202, headers: { 'retry-after': '0' } })
      .mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: {
          thid: 'cfg-1',
          body: {
            data: [
              {
                type: 'TenantAdapterConfig',
                response: { status: '200' },
                resource: { id: 'cfg-1', softwareId: 'qvet-v1.0' }
              }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        status: 202,
        headers: { location: '/clinic-demo/cds-ES/v1/onehealth-research/digitaltwin/qvet-v1.0/Composition/_upload-response?thid=up-1' }
      })
      .mockResolvedValueOnce({ status: 202, headers: { 'retry-after': '0' } })
      .mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: {
          thid: 'up-1',
          body: {
            data: [
              {
                type: 'ConversionResult',
                response: { status: '200' },
                resource: { resourceType: 'Bundle', total: 1 }
              }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: { body: { status: 'success', promotedCount: 2 } }
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 1,
          entry: [{ resource: { resourceType: 'Composition', id: 'comp-1' } }]
        }
      });

    const configResponse = await client.createTenantConfigAndWait({
      softwareId: 'qvet-v1.0',
      entries: [{ softwareId: 'qvet-v1.0' }]
    });
    const uploadResponse = await client.uploadSpreadsheetAndWait('https://example.com/exampleQvetES.xlsx?dl=1', {
      softwareId: 'qvet-v1.0',
      fileName: 'exampleQvetES.xlsx'
    });
    const patchResponse = await client.batchPromotion({
      thid: 'up-1',
      softwareId: 'qvet-v1.0'
    });
    const searchResponse = await client.searchResources({
      softwareId: 'qvet-v1.0',
      resourceType: 'Composition',
      searchParams: { 'relatesto-target': 'up-1' }
    });

    expect(configResponse.body?.data?.[0]?.resource?.softwareId).toBe('qvet-v1.0');
    expect(uploadResponse.thid).toBe('up-1');
    expect(patchResponse.body?.promotedCount).toBe(2);
    expect(searchResponse.total).toBe(1);
  });

  it('throws if neither axios nor fetch transport is available', async () => {
    mockedAxios.create.mockReset();
    mockedAxios.create.mockReturnValue(undefined as any);
    Reflect.set(globalThis as object, 'fetch', undefined);

    const clientNoTransport = new DataConvClient({
      issuerDid: 'did:web:clinic.example:employee:it:loader',
      alternateName: 'clinic-demo',
      tenantId: 'clinic-demo',
      jurisdiction: 'ES'
    });

    await expect(clientNoTransport.createConfig({
      entries: [{ softwareId: 'qvet-v1.0' }]
    })).rejects.toThrow(
      'No HTTP transport available: provide axios httpClient or fetch implementation'
    );
  });
});
