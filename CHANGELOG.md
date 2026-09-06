# Changelog

## Unreleased

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
