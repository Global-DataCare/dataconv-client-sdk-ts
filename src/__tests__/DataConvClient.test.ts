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
      headers: { location: '/publisher/cds-ES/v1/onehealth-research/clinic-demo/qvet-v1.0/config/_create-response?thid=cfg-1' }
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
      url: '/publisher/cds-ES/v1/onehealth-research/clinic-demo/qvet-v1.0/config/_create',
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

  it('fetches the well-known api-config document and normalizes frontend fields', async () => {
    mockedAxios.request.mockResolvedValueOnce({
      status: 200,
      headers: {},
      data: {
        language: 'es',
        supportedFields: {
          section: 'Departamento o sección',
          coverage_insurer: 'Identificador o nombre de la aseguradora'
        },
        endpoints: {
          upload: '/host/.../_upload'
        },
        allowedJurisdictions: ['ES', 'PT'],
        allowedSectors: ['onehealth-research'],
        auth: {
          exchangeEndpoint: '/exchange',
          apiKeySupported: true
        }
      }
    });

    const result = await client.getWellKnownApiConfig();

    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      url: '/.well-known/api-config.json'
    }));
    expect(result.language).toBe('es');
    expect(result.fields).toEqual([
      { code: 'section', display: 'Departamento o sección' },
      { code: 'coverage_insurer', display: 'Identificador o nombre de la aseguradora' }
    ]);
    expect(result.endpoints.upload).toBe('/host/.../_upload');
    expect(result.allowedJurisdictions).toEqual(['ES', 'PT']);
    expect(result.allowedSectors).toEqual(['onehealth-research']);
    expect(result.auth?.exchangeEndpoint).toBe('/exchange');
  });

  it('returns supported fields as code/display pairs', async () => {
    mockedAxios.request.mockResolvedValueOnce({
      status: 200,
      headers: {},
      data: {
        language: 'es',
        supportedFields: {
          'procedure_code-display': 'Código de procedimiento realizado'
        },
        endpoints: {}
      }
    });

    const result = await client.getSupportedFields();

    expect(result).toEqual([
      { code: 'procedure_code-display', display: 'Código de procedimiento realizado' }
    ]);
  });

  it('tracks selected fields and avoids duplicates', () => {
    expect(client.getSelectedFieldCodes()).toEqual([]);
    expect(client.selectField('section')).toBe(true);
    expect(client.selectField('coverage_insurer')).toBe(true);
    expect(client.selectField('section')).toBe(false);
    expect(client.getSelectedFieldCodes().sort()).toEqual(['coverage_insurer', 'section']);
    expect(client.isFieldSelected('section')).toBe(true);
    expect(client.isFieldSelected('unknown')).toBe(false);
    expect(client.unselectField('section')).toBe(true);
    expect(client.isFieldSelected('section')).toBe(false);
    client.clearSelectedFields();
    expect(client.getSelectedFieldCodes()).toEqual([]);
  });

  it('tracks selected field mappings for conflict messaging', () => {
    expect(client.selectField('section', 'SECCION')).toBe(true);
    expect(client.selectField('coverage_insurer', 'ASEGURADORA')).toBe(true);

    expect(client.getSelectedFieldMappings()).toEqual({
      section: 'SECCION',
      coverage_insurer: 'ASEGURADORA'
    });
    expect(client.getSelectedMappingForField('section')).toBe('SECCION');
    expect(client.getSelectedMappingForField('unknown')).toBeUndefined();

    expect(client.selectField('section', 'OTRA_COLUMNA')).toBe(false);
    expect(client.getSelectedMappingForField('section')).toBe('SECCION');

    expect(client.unselectField('section')).toBe(true);
    expect(client.getSelectedMappingForField('section')).toBeUndefined();

    client.clearSelectedFields();
    expect(client.getSelectedFieldMappings()).toEqual({});
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
      headers: { location: '/publisher/cds-ES/v1/onehealth-research/VATES-B00000000/qvet-v1.0/config/_create-response?thid=cfg-1' }
    });

    await vatClient.createConfig({
      entries: [{ softwareId: 'qvet-v1.0' }]
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({
      url: '/publisher/cds-ES/v1/onehealth-research/VATES-B00000000/qvet-v1.0/config/_create'
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
      headers: { location: '/publisher/cds-ES/v1/onehealth-research/clinic-demo/dataset/qvet-v1.0/Composition/_upload-response?thid=up-1' }
    });

    const result = await client.uploadWithLink('https://example.com/exampleQvetES.xlsx?dl=1', {
      softwareId: 'qvet-v1.0',
      fileName: 'exampleQvetES.xlsx'
    });

    expect(result.thid).toMatch(UUID_V4_REGEX);
    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      url: '/publisher/cds-ES/v1/onehealth-research/clinic-demo/dataset/qvet-v1.0/Composition/_upload',
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
    expect(requestConfig?.url).toBe('/publisher/cds-ES/v1/onehealth-research/clinic-demo/dataset/qvet-v1.0/Composition/_upload');
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
        issues: {
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'information',
              code: 'informational',
              diagnostics: 'Job status: succeeded. Se han procesado 500 registros.'
            }
          ]
        },
        data: [
          {
            type: 'ConversionResult',
            response: {
              status: '200',
              outcome: {
                resourceType: 'OperationOutcome',
                issue: [
                  {
                    severity: 'information',
                    code: 'informational',
                    diagnostics: 'Job status: succeeded. Se han procesado 500 registros.'
                  }
                ]
              }
            },
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
    expect(client.getMainDiagnosticInfoByResponse(response)).toBe(
      'Job status: succeeded. Se han procesado 500 registros.'
    );
    expect(client.getMainDiagnosticInfo()).toBe(
      'Job status: succeeded. Se han procesado 500 registros.'
    );
  });

  it('falls back to entry outcome diagnostics when bundle issues are absent', () => {
    const payload: DataConvDidCommResponse<ConvertedBundleResource> = {
      body: {
        resourceType: 'Bundle',
        type: 'batch-response',
        total: 1,
        data: [
          {
            type: 'ConversionResult',
            response: {
              status: '500',
              outcome: {
                resourceType: 'OperationOutcome',
                issue: [
                  {
                    severity: 'error',
                    code: 'exception',
                    diagnostics: 'Job status: failed. Missing LOINC mapping.'
                  }
                ]
              }
            }
          }
        ]
      }
    };

    expect(client.getMainDiagnosticInfoByResponse(payload)).toBe(
      'Job status: failed. Missing LOINC mapping.'
    );
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
      createMockResponse(202, new Headers({ location: '/publisher/cds-ES/v1/onehealth-research/clinic-demo/dataset/qvet-v1.0/Composition/_upload-response?thid=up-1' }), {})
    );

    const result = await fetchClient.uploadWithLink('https://example.com/exampleQvetES.xlsx?dl=1', {
      softwareId: 'qvet-v1.0',
      fileName: 'exampleQvetES.xlsx'
    });

    expect(result.thid).toMatch(UUID_V4_REGEX);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/publisher/cds-ES/v1/onehealth-research/clinic-demo/dataset/qvet-v1.0/Composition/_upload',
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
      method: 'POST',
      url: '/publisher/cds-ES/v1/onehealth-research/clinic-demo/dataset/qvet-v1.0/Composition/_patch?thid=up-1',
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
      resourceType: 'DocumentReference',
      searchParams: {
        userselected: 'false',
        date: 'ge2026-01-01'
      }
    });

    expect(response.total).toBe(1);
    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      url: '/publisher/cds-ES/v1/onehealth-research/clinic-demo/dataset/DocumentReference/_search',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer session-id-1'
      },
      data: {
        userselected: 'false',
        date: 'ge2026-01-01'
      }
    }));
  });

  it('normalizes FHIR search parameter names to lowercase before sending the request', async () => {
    client.setIdToken('session-id-1');
    mockedAxios.request.mockResolvedValueOnce({
      status: 200,
      headers: {},
      data: {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 0,
        entry: []
      }
    });

    await client.searchResources({
      resourceType: 'DocumentReference',
      searchParams: {
        userSelected: 'false',
        date: 'ge2026-01-01'
      }
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      url: '/publisher/cds-ES/v1/onehealth-research/clinic-demo/dataset/DocumentReference/_search',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer session-id-1'
      },
      data: {
        userselected: 'false',
        date: 'ge2026-01-01'
      }
    }));
  });

  it('supports a mocked config, upload, poll, batch and search workflow', async () => {
    mockedAxios.request
      .mockResolvedValueOnce({
        status: 202,
        headers: { location: '/publisher/cds-ES/v1/onehealth-research/clinic-demo/qvet-v1.0/config/_create-response?thid=cfg-1' }
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
        headers: { location: '/publisher/cds-ES/v1/onehealth-research/clinic-demo/dataset/qvet-v1.0/Composition/_upload-response?thid=up-1' }
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
      resourceType: 'Composition',
      searchParams: { 'relatesto-target': 'up-1' }
    });

    expect(configResponse.body?.data?.[0]?.resource?.softwareId).toBe('qvet-v1.0');
    expect(uploadResponse.thid).toBe('up-1');
    expect(patchResponse.body?.promotedCount).toBe(2);
    expect(searchResponse.total).toBe(1);
  });

  it('calls exchange endpoint and returns access token payload', async () => {
    mockedAxios.request.mockResolvedValueOnce({
      status: 200,
      headers: {},
      data: {
        access_token: 'session-token-1',
        token_type: 'Bearer',
        expires_in: 900,
        scope: 'dataconv.upload'
      }
    });

    const result = await client.exchangeToken({
      subjectToken: 'id-token-1',
      vpToken: 'vp-token-1',
      clientAssertion: 'client-assertion-1',
      scope: 'dataconv.upload',
      apiKey: 'demo-api-key',
      organization: 'VATES-A00000001',
      operationalSubject: 'did:web:example:employee:controller'
    });

    expect(result.access_token).toBe('session-token-1');
    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      url: '/exchange',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      data: expect.objectContaining({
        subject_token: 'id-token-1',
        vp_token: 'vp-token-1',
        client_assertion: 'client-assertion-1',
        api_key: 'demo-api-key',
        organization: 'VATES-A00000001',
        operational_subject: 'did:web:example:employee:controller'
      })
    }));
    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({
      headers: expect.objectContaining({
        'X-API-Key': 'demo-api-key'
      })
    }));
  });

  it('creates tenant API key actions using schema action endpoint', async () => {
    mockedAxios.request.mockResolvedValueOnce({
      status: 200,
      headers: {},
      data: {
        data: [
          {
            identifier: 'api-key-uuid-1',
            actionStatus: 'active',
            agent: { sameAs: 'zMockedSameAsHash' },
            apiKey: 'dck_abc'
          }
        ]
      }
    });

    const result = await client.createTenantApiKeyActions({
      authorizationToken: 'session-manage-token',
      tenantId: 'VATES-A00000001',
      jurisdiction: 'ES',
      sector: 'animal-care',
      actions: [
        {
          '@context': 'https://schema.org',
          '@type': 'UpdateAction',
          agent: { email: 'alice@example.com' },
          target: 'publisher/cds-es/v1/animal-care/vates-a00000001/dataset/*/*/_update',
          scope: ['dataconv.upload'],
          instrument: { permission: [{ action: 'update' }] }
        }
      ]
    });

    expect(result.data?.[0]?.identifier).toBe('api-key-uuid-1');
    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      url: '/VATES-A00000001/cds-ES/v1/animal-care/api-key/org.schema/action/_create',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        Authorization: 'Bearer session-manage-token'
      }),
      data: expect.objectContaining({
        data: [
          expect.objectContaining({
            '@type': 'UpdateAction',
            target: 'publisher/cds-es/v1/animal-care/vates-a00000001/dataset/*/*/_update'
          })
        ]
      })
    }));
  });

  it('adds Authorization bearer header in multipart upload when authorizationToken is provided', async () => {
    mockedAxios.request.mockResolvedValueOnce({
      status: 202,
      headers: { location: '/dummy' }
    });

    await client.uploadWithFile({
      softwareId: 'qvet-v1.0',
      fileBytes: new Uint8Array([1, 2, 3]),
      authorizationToken: 'session-bearer-1'
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer session-bearer-1'
      })
    }));
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
