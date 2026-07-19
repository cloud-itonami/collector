/**
 * collector kotoba — public network-intelligence registries + coverage.
 * AT PDS records (no RW). DNS observations / risk signals may FK-reference a
 * collector run. Only public OSINT data; leaked-content + abuse PII stay etzhayyim.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  ACTOR_COLLECTION,
  CHAINS,
  DNS_COLLECTION,
  DNS_TYPES,
  RUN_COLLECTION,
  SEVERITIES,
  SIGNAL_COLLECTION,
  SOURCES,
  SUBJECT_TYPES,
  actorDidFor,
  actorRkey,
  dnsDidFor,
  dnsRkey,
  isNonNegInt,
  runDidFor,
  runRkey,
  signalDidFor,
  signalRkey,
  type BlockchainActorRecord,
  type BlockchainActorView,
  type CoverageInput,
  type CoverageOutput,
  type DnsObservationRecord,
  type DnsObservationView,
  type FinishRunInput,
  type FinishRunOutput,
  type ListActorsInput,
  type ListActorsOutput,
  type ListDnsInput,
  type ListDnsOutput,
  type ListRunsInput,
  type ListRunsOutput,
  type ListSignalsInput,
  type ListSignalsOutput,
  type RecordActorInput,
  type RecordActorOutput,
  type RecordDnsInput,
  type RecordDnsOutput,
  type RecordSignalInput,
  type RecordSignalOutput,
  type RiskSignalRecord,
  type RiskSignalView,
  type RunRecord,
  type RunView,
  type StartRunInput,
  type StartRunOutput,
} from "./types.js";

const PAGE_LIMIT = 100;
const DEFAULT_MAX_SCAN = 10_000;

async function exists(e: Etzhayyim, collection: string, rkey: string): Promise<boolean> {
  const resp = await e.read({ collection, rkey }).catch(() => ({ records: [] }));
  return Boolean(resp.records[0]?.value);
}

// ─── Collector run ──────────────────────────────────────────────────

export async function startRun(e: Etzhayyim, input: StartRunInput): Promise<StartRunOutput> {
  if (!input.runId || !input.startedAt) return { status: "rejected", error: "missingRequiredFields" };
  if (!SOURCES.has(input.source)) return { status: "rejected", error: "invalidSource" };
  const rkey = runRkey(input.runId);
  const existing = await e.read<RunRecord>({ collection: RUN_COLLECTION, rkey }).catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { status: "alreadyExists", runUri: existing.records[0].uri, did: existing.records[0].value.did, runId: input.runId };
  }
  const did = runDidFor(input.runId);
  const record: RunRecord = {
    did,
    runId: input.runId,
    source: input.source,
    status: "running",
    startedAt: input.startedAt,
    itemsCollected: 0,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({ collection: RUN_COLLECTION, record: record as unknown as Record<string, unknown>, rkey });
  return { status: "started", runUri: receipt.uri, did, runId: input.runId };
}

export async function finishRun(e: Etzhayyim, input: FinishRunInput): Promise<FinishRunOutput> {
  if (!input.runId || !input.finishedAt) return { status: "rejected", error: "missingRequiredFields" };
  if (input.status !== "completed" && input.status !== "failed") return { status: "rejected", error: "invalidStatus" };
  if (input.itemsCollected != null && !isNonNegInt(input.itemsCollected)) return { status: "rejected", error: "itemsCollectedMustBeNonNegInt" };
  const rkey = runRkey(input.runId);
  const resp = await e.read<RunRecord>({ collection: RUN_COLLECTION, rkey }).catch(() => ({ records: [] }));
  const run = resp.records[0]?.value;
  if (!run) return { status: "notFound", error: "runNotFound" };
  if (run.status !== "running") return { status: "rejected", error: `runNotRunning:${run.status}` };
  await e.write({
    collection: RUN_COLLECTION,
    record: { ...run, status: input.status, finishedAt: input.finishedAt, itemsCollected: input.itemsCollected ?? run.itemsCollected } as unknown as Record<string, unknown>,
    rkey,
  });
  return { status: "finished", runId: input.runId, newStatus: input.status };
}

export async function listRuns(e: Etzhayyim, input: ListRunsInput = {}): Promise<ListRunsOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<RunRecord>({ collection: RUN_COLLECTION, cursor: input.cursor, limit });
  const items: RunView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.source && v.source !== input.source) return false;
      if (input.status && v.status !== input.status) return false;
      return true;
    })
    .map((r) => ({ ...r.value, runUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

// ─── DNS observation ────────────────────────────────────────────────

export async function recordDns(e: Etzhayyim, input: RecordDnsInput): Promise<RecordDnsOutput> {
  if (!input.observationId || !input.domain || !input.value || !input.observedAt) return { status: "rejected", error: "missingRequiredFields" };
  if (!DNS_TYPES.has(input.recordType)) return { status: "rejected", error: "invalidRecordType" };
  if (input.runId && !(await exists(e, RUN_COLLECTION, runRkey(input.runId)))) {
    return { status: "runNotFound", error: `runNotFound:${input.runId}` };
  }
  const rkey = dnsRkey(input.observationId);
  const existing = await e.read<DnsObservationRecord>({ collection: DNS_COLLECTION, rkey }).catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { status: "alreadyExists", observationUri: existing.records[0].uri, did: existing.records[0].value.did, observationId: input.observationId };
  }
  const did = dnsDidFor(input.observationId);
  const record: DnsObservationRecord = {
    did,
    observationId: input.observationId,
    domain: input.domain.toLowerCase(),
    recordType: input.recordType,
    value: input.value,
    runId: input.runId,
    observedAt: input.observedAt,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({ collection: DNS_COLLECTION, record: record as unknown as Record<string, unknown>, rkey });
  return { status: "recorded", observationUri: receipt.uri, did, observationId: input.observationId };
}

export async function listDns(e: Etzhayyim, input: ListDnsInput = {}): Promise<ListDnsOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<DnsObservationRecord>({ collection: DNS_COLLECTION, cursor: input.cursor, limit });
  const domain = input.domain?.toLowerCase();
  const items: DnsObservationView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (domain && v.domain !== domain) return false;
      if (input.recordType && v.recordType !== input.recordType) return false;
      if (input.runId && v.runId !== input.runId) return false;
      return true;
    })
    .map((r) => ({ ...r.value, observationUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

// ─── Blockchain actor ───────────────────────────────────────────────

export async function recordActor(e: Etzhayyim, input: RecordActorInput): Promise<RecordActorOutput> {
  if (!input.actorId || !input.address || !input.observedAt) return { status: "rejected", error: "missingRequiredFields" };
  if (!CHAINS.has(input.chain)) return { status: "rejected", error: "invalidChain" };
  const rkey = actorRkey(input.actorId);
  const existing = await e.read<BlockchainActorRecord>({ collection: ACTOR_COLLECTION, rkey }).catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { status: "alreadyExists", actorUri: existing.records[0].uri, did: existing.records[0].value.did, actorId: input.actorId };
  }
  const did = actorDidFor(input.actorId);
  const record: BlockchainActorRecord = {
    did,
    actorId: input.actorId,
    chain: input.chain,
    address: input.address,
    label: input.label,
    firstSeen: input.firstSeen,
    observedAt: input.observedAt,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({ collection: ACTOR_COLLECTION, record: record as unknown as Record<string, unknown>, rkey });
  return { status: "recorded", actorUri: receipt.uri, did, actorId: input.actorId };
}

export async function listActors(e: Etzhayyim, input: ListActorsInput = {}): Promise<ListActorsOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<BlockchainActorRecord>({ collection: ACTOR_COLLECTION, cursor: input.cursor, limit });
  const items: BlockchainActorView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.chain && v.chain !== input.chain) return false;
      if (input.address && v.address !== input.address) return false;
      return true;
    })
    .map((r) => ({ ...r.value, actorUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

// ─── Risk signal ────────────────────────────────────────────────────

export async function recordSignal(e: Etzhayyim, input: RecordSignalInput): Promise<RecordSignalOutput> {
  if (!input.signalId || !input.subject || !input.signalType || !input.observedAt) return { status: "rejected", error: "missingRequiredFields" };
  if (!SUBJECT_TYPES.has(input.subjectType)) return { status: "rejected", error: "invalidSubjectType" };
  if (!SEVERITIES.has(input.severity)) return { status: "rejected", error: "invalidSeverity" };
  if (input.runId && !(await exists(e, RUN_COLLECTION, runRkey(input.runId)))) {
    return { status: "runNotFound", error: `runNotFound:${input.runId}` };
  }
  const rkey = signalRkey(input.signalId);
  const existing = await e.read<RiskSignalRecord>({ collection: SIGNAL_COLLECTION, rkey }).catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { status: "alreadyExists", signalUri: existing.records[0].uri, did: existing.records[0].value.did, signalId: input.signalId };
  }
  const did = signalDidFor(input.signalId);
  const record: RiskSignalRecord = {
    did,
    signalId: input.signalId,
    subjectType: input.subjectType,
    subject: input.subject,
    signalType: input.signalType,
    severity: input.severity,
    runId: input.runId,
    observedAt: input.observedAt,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({ collection: SIGNAL_COLLECTION, record: record as unknown as Record<string, unknown>, rkey });
  return { status: "recorded", signalUri: receipt.uri, did, signalId: input.signalId };
}

export async function listSignals(e: Etzhayyim, input: ListSignalsInput = {}): Promise<ListSignalsOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<RiskSignalRecord>({ collection: SIGNAL_COLLECTION, cursor: input.cursor, limit });
  const items: RiskSignalView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.subjectType && v.subjectType !== input.subjectType) return false;
      if (input.subject && v.subject !== input.subject) return false;
      if (input.severity && v.severity !== input.severity) return false;
      if (input.signalType && v.signalType !== input.signalType) return false;
      return true;
    })
    .map((r) => ({ ...r.value, signalUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

// ─── Coverage ───────────────────────────────────────────────────────

async function countAll<T>(e: Etzhayyim, collection: string, maxScan: number, onRow: (v: T) => void): Promise<number> {
  let cursor: string | undefined;
  let scanned = 0;
  while (scanned < maxScan) {
    const page = await e.read<T>({ collection, cursor, limit: PAGE_LIMIT });
    for (const r of page.records) {
      if (scanned >= maxScan) break;
      onRow(r.value);
      scanned += 1;
    }
    if (scanned >= maxScan || !page.cursor || page.records.length < PAGE_LIMIT) break;
    cursor = page.cursor;
  }
  return scanned;
}

export async function coverage(e: Etzhayyim, input: CoverageInput = {}): Promise<CoverageOutput> {
  const maxScan = Math.min(input.maxScan ?? DEFAULT_MAX_SCAN, DEFAULT_MAX_SCAN);
  const runsBySource: Record<string, number> = {};
  const runCount = await countAll<RunRecord>(e, RUN_COLLECTION, maxScan, (v) => {
    runsBySource[v.source] = (runsBySource[v.source] ?? 0) + 1;
  });
  const dnsCount = await countAll<DnsObservationRecord>(e, DNS_COLLECTION, maxScan, () => {});
  const actorCount = await countAll<BlockchainActorRecord>(e, ACTOR_COLLECTION, maxScan, () => {});
  const signalsBySeverity: Record<string, number> = {};
  const signalCount = await countAll<RiskSignalRecord>(e, SIGNAL_COLLECTION, maxScan, (v) => {
    signalsBySeverity[v.severity] = (signalsBySeverity[v.severity] ?? 0) + 1;
  });
  return {
    runCount,
    dnsCount,
    actorCount,
    signalCount,
    runsBySource,
    signalsBySeverity,
    truncated: runCount >= maxScan || dnsCount >= maxScan || actorCount >= maxScan || signalCount >= maxScan,
  };
}
