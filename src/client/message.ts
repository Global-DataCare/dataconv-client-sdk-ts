import type {
  DataConvClientConfig,
  DataConvCrypto,
  DataConvDidCommAttachment,
  DataConvUploadDidCommOptions,
  SourceFormat
} from '../types.js';
import { DEFAULT_DIDCOMM_TYPE } from './constants.js';
import { createUuid, normalizeSourceFormat, resolveIssuerDid } from './helpers.js';

export function buildAttachment(
  source: string | Uint8Array,
  options: DataConvUploadDidCommOptions,
  cryptoApi: DataConvCrypto | undefined
): DataConvDidCommAttachment {
  const attachmentId = options.attachmentId || createUuid(cryptoApi);
  const mediaType = options.mediaType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const attachment: DataConvDidCommAttachment = {
    id: attachmentId,
    media_type: mediaType
  };

  if (options.fileName) {
    attachment.filename = options.fileName;
  }

  if (typeof source === 'string') {
    attachment.data = { links: [source] };
  } else {
    attachment.data = { base64: Buffer.from(source).toString('base64') };
  }

  return attachment;
}

export function buildUploadExtra(
  options: Pick<DataConvUploadDidCommOptions, 'mode' | 'send' | 'inlineConfig' | 'softwareVersion' | 'sourceFormat' | 'researchStudy'>,
  config: DataConvClientConfig
): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  if (typeof options.mode === 'string' && options.mode.trim()) {
    extra.mode = options.mode.trim();
  }
  if (typeof options.send === 'boolean') {
    extra.send = options.send;
  }
  if (typeof options.softwareVersion === 'string' && options.softwareVersion.trim()) {
    extra.softwareVersion = options.softwareVersion.trim();
  }
  const sourceFormat = normalizeSourceFormat(options.sourceFormat as SourceFormat | undefined, config);
  if (sourceFormat) {
    extra.sourceFormat = sourceFormat;
  }
  if (options.inlineConfig && typeof options.inlineConfig === 'object') {
    extra.inlineConfig = options.inlineConfig;
  }
  if (options.researchStudy) {
    extra.researchStudy = options.researchStudy;
  }
  return extra;
}

export function buildEnvelope(
  input: {
    iss?: string;
    thid?: string;
    type?: string;
    iat?: number;
    exp?: number;
    idToken?: string;
    vpToken?: string;
    data?: unknown[];
    body?: Record<string, unknown>;
    attachments?: DataConvDidCommAttachment[];
    extra?: Record<string, unknown>;
  },
  deps: {
    config: DataConvClientConfig;
    cryptoApi?: DataConvCrypto;
    defaultExpSeconds: number;
    currentIdToken?: string;
    currentVpToken?: string;
  }
): Record<string, unknown> & { thid: string; jti: string } {
  const thid = input.thid?.trim() || createUuid(deps.cryptoApi);
  const iat = input.iat ?? Math.floor(Date.now() / 1000);
  const exp = input.exp ?? (iat + deps.defaultExpSeconds);
  const envelope: Record<string, unknown> & { thid: string; jti: string } = {
    iss: resolveIssuerDid(deps.config, input.iss),
    thid,
    jti: thid,
    type: input.type || deps.config.defaultDidCommType || DEFAULT_DIDCOMM_TYPE,
    iat,
    exp
  };

  const idToken = input.idToken || deps.currentIdToken;
  const vpToken = input.vpToken || deps.currentVpToken;
  if (idToken) {
    envelope.id_token = idToken;
  }
  if (vpToken) {
    envelope.vp_token = vpToken;
  }
  if (Array.isArray(input.data)) {
    envelope.data = input.data;
  }
  if (input.body) {
    envelope.body = input.body;
  }
  if (Array.isArray(input.attachments) && input.attachments.length > 0) {
    envelope.attachments = input.attachments;
  }
  if (input.extra) {
    Object.entries(input.extra).forEach(([key, value]) => {
      if (value !== undefined) {
        envelope[key] = value;
      }
    });
  }

  return envelope;
}

export function buildMultipartFormData(
  fileBytes: Uint8Array,
  fileName: string,
  mediaType: string,
  envelope: Record<string, unknown>
): FormData {
  if (typeof FormData === 'undefined') {
    throw new Error('FormData is not available in this runtime');
  }

  const formData = new FormData();
  const payload = typeof Blob === 'undefined'
    ? Buffer.from(fileBytes)
    : new Blob([fileBytes], { type: mediaType });
  formData.append('file', payload as Blob, fileName);
  formData.append('payload', JSON.stringify(envelope));
  return formData;
}
