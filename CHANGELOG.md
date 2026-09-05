# Changelog

## Unreleased

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
