import { createUuid } from './client/helpers.js';
import type { DataConvCrypto } from './types.js';

export interface DidCommAttachment {
  id: string;
  media_type: string;
  data: { links?: string[]; base64?: string; json?: any };
}

function createMessageId(): string {
  const crypto = (globalThis as typeof globalThis & { crypto?: DataConvCrypto }).crypto;
  return crypto?.randomUUID || crypto?.getRandomValues ? createUuid(crypto) : Math.random().toString(36).slice(2, 11);
}

/** Plaintext message used by the SDK's existing DIDComm helpers. */
export class DidCommMessage {
  id = createMessageId();
  type = '';
  from?: string;
  to?: string[];
  thid?: string;
  pthid?: string;
  created_time?: number;
  expires_time?: number;
  body: Record<string, any> = {};
  attachments?: DidCommAttachment[];
}

export function prepareDidCommRequest(type: string, body: any = {}, attachments: DidCommAttachment[] = []): DidCommMessage {
  const message = new DidCommMessage();
  Object.assign(message, { type, body, attachments, thid: message.id });
  return message;
}

export function includeVpTokenInMessage(message: DidCommMessage, vpToken: string): void {
  message.body.vp_token = vpToken;
}

export function includeFileInMessage(message: DidCommMessage, fileBytes: Uint8Array, mediaType: string, id: string): void {
  let binary = '';
  for (const byte of fileBytes) binary += String.fromCharCode(byte);
  (message.attachments ??= []).push({ id, media_type: mediaType, data: { base64: btoa(binary) } });
}

export function getThidFromMessage(message: DidCommMessage): string {
  return message.thid || message.id;
}

export function getDataResults(response: DidCommMessage): any[] {
  return response.body?.data || [];
}
