export { DataConvClient } from './DataConvClient.js';
export { DidCommMessage, DidCommAttachment } from 'gdc-common-utils-ts/utils/didcomm';
export type {
  ConversionResultEntry,
  ConvertedBundleResource,
  CreateTenantConfigEntry,
  CreateTenantConfigOptions,
  DataConvClientConfig,
  DataConvConversionPollOptions,
  DataConvCreateResult,
  DataConvCrypto,
  DataConvDidCommAttachment,
  DataConvDidCommAttachmentData,
  DataConvDidCommAttachmentPayload,
  DataConvDidCommRequest,
  DataConvDidCommResponse,
  DataConvMultipartUploadOptions,
  DataConvOperationOutcome,
  DataConvOperationOutcomeIssue,
  DataConvPatchOptions,
  DataConvPatchResponse,
  DataConvSearchBundle,
  DataConvSearchBundleEntry,
  DataConvSearchOptions,
  DataConvTenantConfigPollOptions,
  DataConvUploadDidCommOptions,
  DataConvUploadResult,
  SourceFormat,
  TenantAdapterConfigContent,
  TenantAdapterConfigEntry,
  TenantAdapterConfigResource
} from './types.js';
export {
  prepareDidCommRequest,
  includeVpTokenInMessage,
  includeFileInMessage,
  getThidFromMessage,
  getDataResults
} from 'gdc-common-utils-ts/utils/didcomm';
