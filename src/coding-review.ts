import type {
  ConvertedBundleResource,
  DataConvCodingCandidate,
  DataConvCodingProposal,
  DataConvCodingProposalStatus,
  DataConvCodingReviewPage,
  DataConvCodingReviewPageOptions,
  DataConvCodingReviewRow,
  DataConvDidCommResponse,
  DataConvReviewDraftState
} from './types.js';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/** Deep-freezes only SDK-owned projections; callers' conversion response is never traversed here. */
function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== 'object') return value;
  const objectValue = value as object;
  if (seen.has(objectValue)) return value;
  seen.add(objectValue);
  for (const child of Object.values(objectValue)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function proposalStatus(value: unknown): DataConvCodingProposalStatus | undefined {
  return value === 'proposed' || value === 'accepted' ? value : undefined;
}

function candidate(value: unknown): DataConvCodingCandidate | undefined {
  const item = record(value);
  if (!item) return undefined;
  const id = text(item.id);
  const system = text(item.system);
  const code = text(item.code);
  const display = text(item.display);
  if (!id || !system || !code || !display) return undefined;
  return {
    id,
    system,
    code,
    display,
    ...(text(item.source) ? { source: text(item.source) } : {}),
    ...(typeof item.recommendationPercent === 'number' && Number.isFinite(item.recommendationPercent)
      ? { recommendationPercent: item.recommendationPercent }
      : {}),
    ...(text(item.evidence) ? { evidence: text(item.evidence) } : {})
  };
}

function codingProposal(value: unknown): DataConvCodingProposal | undefined {
  const item = record(value);
  if (!item) return undefined;
  const id = text(item.id);
  const status = proposalStatus(item.status);
  const field = text(item.field);
  if (!id || !status || !field) return undefined;
  const rowContext = record(item.rowContext) ?? {};
  return {
    id,
    status,
    field,
    inputText: text(item.inputText),
    rowContext: Object.fromEntries(
      Object.entries(rowContext)
        .filter(([, entry]) => typeof entry === 'string')
        .map(([key, entry]) => [key, String(entry)])
    ),
    candidates: Array.isArray(item.candidates)
      ? item.candidates.map(candidate).filter((entry): entry is DataConvCodingCandidate => !!entry)
      : [],
    ...(text(item.selectedCandidateId) ? { selectedCandidateId: text(item.selectedCandidateId) } : {}),
    ...(text(item.reviewedAt) ? { reviewedAt: text(item.reviewedAt) } : {})
  };
}

function draftState(resource: Record<string, unknown>, resourceType: string): DataConvReviewDraftState {
  const meta = record(resource.meta);
  const claims = record(meta?.claims);
  const selected = text(claims?.[`${resourceType}.userSelected`]).toLowerCase();
  if (selected === 'true') return 'draft';
  if (selected === 'false') return 'promoted';
  return 'unknown';
}

function reviewRowsForResource(
  resource: Record<string, unknown>,
  subjectResourceType: string,
  subjectId: string
): DataConvCodingReviewRow[] {
  const resourceType = text(resource.resourceType);
  const resourceId = text(resource.id);
  if (!resourceType || !resourceId) return [];
  const meta = record(resource.meta);
  const proposals = Array.isArray(meta?.codingProposals) ? meta.codingProposals : [];
  return proposals
    .map(codingProposal)
    .filter((entry): entry is DataConvCodingProposal => !!entry)
    .map((entry) => ({
      ...entry,
      subjectResourceType,
      subjectId,
      resourceType,
      resourceId,
      proposalId: entry.id,
      state: entry.status,
      draftState: draftState(resource, resourceType)
    }));
}

/**
 * Builds an immutable, bounded client-side page over DataConv coding proposals.
 *
 * The current Python `_upload-response` wire contract returns one
 * `ConversionResult` containing the complete generated Bundle. Consequently
 * this helper does not send or claim a server cursor: it pages the returned
 * `meta.codingProposals[]` entries deterministically for portal rendering.
 */
export function codingReviewPage(
  response: DataConvDidCommResponse<ConvertedBundleResource> | undefined,
  options: DataConvCodingReviewPageOptions = {}
): DataConvCodingReviewPage {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error('page must be a positive safe integer');
  }
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new Error(`pageSize must be between 1 and ${MAX_PAGE_SIZE}`);
  }

  const conversionEntry = Array.isArray(response?.body?.data)
    ? response.body.data.find((entry) => entry?.type === 'ConversionResult')
    : undefined;
  const bundle = record(conversionEntry?.resource);
  const primaryEntries = Array.isArray(bundle?.data) ? bundle.data : [];
  const rows: DataConvCodingReviewRow[] = [];

  for (const primaryEntry of primaryEntries) {
    const subject = record(record(primaryEntry)?.resource);
    if (!subject) continue;
    const subjectResourceType = text(subject.resourceType);
    const subjectId = text(subject.id);
    rows.push(...reviewRowsForResource(subject, subjectResourceType, subjectId));
    if (Array.isArray(subject.contained)) {
      for (const contained of subject.contained) {
        const resource = record(contained);
        if (resource) rows.push(...reviewRowsForResource(resource, subjectResourceType, subjectId));
      }
    }
  }

  const total = rows.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  return deepFreeze({
    items: rows.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages,
    hasPreviousPage: page > 1 && total > 0,
    hasNextPage: page < totalPages
  });
}
