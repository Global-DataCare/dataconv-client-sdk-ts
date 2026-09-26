# Changelog

## 0.5.7 - 2026-09-25

- Search governed terminology sources for one existing study proposal and
  persist the server-returned candidates before a professional selects one.
- Keep proposal resource type and claim immutable so a review search cannot
  disguise an incorrectly mapped DiagnosticReport as a Condition.

## 0.5.6 - 2026-09-24

- List tenant mapping configurations available to an authorized importer and
  forward the caller's scoped bearer token when creating and polling a named copy.
- Clone a catalog configuration without retaining server-owned id, revision or
  audit fields, while replacing its field map with explicit UI choices.
- Inspect the first worksheet with its name and up to three non-empty samples
  per source column so portals can safely edit mappings before upload.
- Report `dataHeaderRowIndex` with DataConv's one-based worksheet convention,
  avoiding a saved copy that reads API-CONFIG mapping keys as source headers.

## 0.5.5 - 2026-09-23

- Add study-scoped durable coding-review preparation, lookup and submission
  methods that do not require an import thread or retained job result.
- Allow `getCodingReviewPage()` to project the same proposal rows from a FHIR
  searchset of stored ResearchSubject drafts.

## 0.5.4 - 2026-09-23

- Treat `meta.codingProposals[].status` as the only coding-review workflow
  state; return unresolved proposals by default and retain reviewed proposals
  only when explicitly requested for audit.
- Preserve per-proposal professional `userSelected` provenance and bounded
  OperationOutcome diagnostics for persisted job discovery failures.

- Bound every DataConv HTTP request to 20 seconds by default and expose the
  `requestTimeoutMs` client option for deployment-specific budgets. The bound
  applies equally to Axios and Fetch transports so a failed dependency cannot
  leave portal flows pending indefinitely.
- Added `getOrganizationTenantStatus()` so authenticated controller portals
  can distinguish a ready tenant from a retryable missing scoped record before
  starting research work.
- Read converted primary resources directly from `body.data[].resource` and
  coding proposals from `resource.contained[].meta.codingProposals[]`; reject
  the former nested `ConversionResult.resource.data[]` assumption.
- Add `getConversionEntries()` and `getSuccessfulConvertedResources()` as the
  canonical response helpers; retain the old result names only as deprecated
  source-compatibility aliases.
- Bound CLI upload-response polling to the same three-attempt default as the
  SDK client; `DATACONV_RETRY_TIMES` remains an explicit override.

## 0.5.0 - 2026-09-19

- Add `searchConversionJobs()` for the shared, study-scoped DataConv job
  history returned as flat-claim `Task` resources in a FHIR `searchset`
  `Bundle`.
- Reduce the default bounded polling budget from ten attempts to three. Jobs
  that remain asynchronous can be revisited through the shared search instead
  of keeping the importing screen blocked.
- Pin `gdc-common-utils-ts@2.9.21` for the canonical Task claim vocabulary.

## 0.4.8 - 2026-09-19

- Stop a bounded poll immediately after its final unsuccessful request instead
  of sleeping for `Retry-After` when no further attempt will be made. This
  keeps one-shot asynchronous job-status checks responsive without changing
  multi-attempt retry behavior.

## 0.4.7 - 2026-09-15

- Use the actor-neutral ResearchStudy RFC 8693 exchange route for both exact
  professional and organization-controller SMART profiles.
- Preserve one bounded safe DataConv diagnostic on failed SMART exchange or
  multipart upload without serializing tokens or request bodies.
- Document multipart workbook transport and the deployment-owned shared
  workbook-size boundary separately from future DICOM limits.

## 0.4.6 - 2026-09-06

- Pin `gdc-common-utils-ts@2.9.4` so ResearchStudy clients reuse the current
  claims and Consent contract instead of installing a legacy 1.x copy.

## 0.4.5 - 2026-09-06

- Added a typed RFC 8693 exchange for a GW-issued, ResearchStudy-scoped SMART
  access token. The dedicated profile never sends an ICA VP or client
  assertion, verifies the signed study returned by DataConv and returns the
  same stable FHIR ResearchStudy reference for upload, polling and review.
- Kept the existing OIDC exchange contract unchanged: it continues to require
  both controller VP and client assertion proofs.

## 0.4.4 - 2026-09-06

- Added a typed FHIR `ResearchStudy` reference to upload, upload-response poll,
  patch and batch options. The SDK carries the same reference through the
  conversion lifecycle as correlation context; it does not treat it as an
  authorization grant.
- Added the typed `body.codingReviews[]` contract to `patchConversion()` so a
  portal can submit explicit human candidate selections and optional reasons.
- Added deeply immutable, bounded local pagination for the coding proposals
  contained in the current single-Bundle `_upload-response`, including frozen
  rows, row context, candidate arrays and candidates. It preserves the actual
  proposal and `userSelected` states without claiming server pagination or a
  source row number that the API does not expose.
- Typed the promotion response OperationOutcome and updated-dataset entries.

## 0.4.3 - 2026-09-05

- Added a browser-conditioned package entry so workbook inspection and field
  mappings do not pull the Node-only Excel template writer into web bundles.

## 0.4.2 - 2026-09-04

- Replaced the vulnerable SheetJS npm runtime with a dependency-light XLSX
  codec for synchronous template generation and research workbook inspection.
- Updated Axios and removed unused React and React Native peer dependencies;
  the production dependency audit is now clean.

## 0.4.1 - 2026-09-04

- Added the high-level organization tenant activation call for portal OIDC and
  ICA controller proofs.
- Added browser/server workbook inspection for embedded `API-CONFIG` mappings
  and duplicate-safe manual research field mapping.
- Clarified this package as the DataConv TypeScript SDK.

- Expanded the DataConv SDK and CLI contracts, tests, developer use cases and
  roadmap documentation for current conversion workflows.
