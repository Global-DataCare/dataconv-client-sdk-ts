import type {
  ConvertedBundleResource,
  DataConvCodingCandidate,
  DataConvCodingProposal,
  DataConvCodingProposalStatus,
  DataConvCodingReviewPage,
  DataConvCodingReviewPageOptions,
  DataConvCodingReviewRow,
  DataConvDidCommResponse,
  DataConvSearchBundle,
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
    ...(text(item.reviewedAt) ? { reviewedAt: text(item.reviewedAt) } : {}),
    ...(item.userSelected === true ? { userSelected: true } : {})
  };
}

function draftState(status: DataConvCodingProposalStatus): DataConvReviewDraftState {
  return status === 'proposed' ? 'draft' : 'promoted';
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
      draftState: draftState(entry.status)
    }));
}

/**
 * Builds an immutable, bounded client-side page over DataConv coding proposals.
 *
 * DataConv `_upload-response` returns every converted primary resource directly
 * at `body.data[].resource`. Coding proposals belong to each primary resource
 * or its `contained[]` resources at `meta.codingProposals[]`. This helper does
 * not send or claim a server cursor: it pages those returned proposals
 * deterministically for portal rendering.
 */
export function codingReviewPage(
  response: DataConvDidCommResponse<ConvertedBundleResource> | DataConvSearchBundle<ConvertedBundleResource> | undefined,
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

  const responseRecord = record(response);
  const body = record(responseRecord?.body);
  const primaryEntries = Array.isArray(body?.data)
    ? body.data
    : Array.isArray(responseRecord?.entry)
      ? responseRecord.entry
      : [];
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

  const reviewRows = options.includeReviewed ? rows : rows.filter(row => row.status === 'proposed');
  const total = reviewRows.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  return deepFreeze({
    items: reviewRows.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages,
    hasPreviousPage: page > 1 && total > 0,
    hasNextPage: page < totalPages
  });
}
