/**
 * collector kotoba — public network-intelligence record types.
 *
 * Per ADR-2606011400 (Consensys pattern) — MIXED split. collector is a unified
 * OSINT / network-intelligence collector. This package migrates its PUBLIC layer:
 *   - collectorRun    — collection job runs (orchestration metadata)
 *   - dnsObservation  — public DNS records observed
 *   - blockchainActor — public on-chain addresses / actors (BTC/ETH)
 *   - riskSignal      — derived risk signals (metadata)
 * Registry on AT PDS records (replaces RW). ADR-2605172000 kotoba.
 *
 * SPLIT NOTE (Custody axis, ADR-2605172400): the sensitive collections —
 * `leakEntity` (raw leaked-database content) and `abuseReport` (victim / reporter
 * PII) — STAY etzhayyim infra, consumed via consent-capability. Only public
 * observations + signal metadata go on-substrate; raw breach PII MUST NOT be
 * written to these public records.
 *
 * AT-Lexicon: no float. Counts are integers.
 *
 * Identity hierarchy:
 *   did:web:collector.etzhayyim.com                          — controller
 *   did:web:collector.etzhayyim.com:run:{runId}              — a collection run
 *   did:web:collector.etzhayyim.com:dns:{observationId}      — a DNS observation
 *   did:web:collector.etzhayyim.com:actor:{actorId}          — a blockchain actor
 *   did:web:collector.etzhayyim.com:signal:{signalId}        — a risk signal
 */

export const COLLECTOR_DID_PREFIX = "did:web:collector.etzhayyim.com:" as const;

export const RUN_COLLECTION = "com.etzhayyim.apps.collector.collectorRun";
export const DNS_COLLECTION = "com.etzhayyim.apps.collector.dnsObservation";
export const ACTOR_COLLECTION = "com.etzhayyim.apps.collector.blockchainActor";
export const SIGNAL_COLLECTION = "com.etzhayyim.apps.collector.riskSignal";

// ─── Collector run ──────────────────────────────────────────────────

export type CollectorSource = "rdap" | "dns" | "blockchain" | "commonCrawl" | "portScan" | "internetArchive";
export type RunStatus = "running" | "completed" | "failed";

export interface RunRecord {
  did: string;
  runId: string;
  source: CollectorSource;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  /** Items collected, integer. */
  itemsCollected: number;
  createdAt: string;
}
export interface RunView extends RunRecord {
  runUri: string;
}
export interface StartRunInput {
  runId: string;
  source: CollectorSource;
  startedAt: string;
}
export interface StartRunOutput {
  status: "started" | "alreadyExists" | "rejected";
  runUri?: string;
  did?: string;
  runId?: string;
  error?: string;
}
export interface FinishRunInput {
  runId: string;
  status: "completed" | "failed";
  finishedAt: string;
  itemsCollected?: number;
}
export interface FinishRunOutput {
  status: "finished" | "notFound" | "rejected";
  runId?: string;
  newStatus?: RunStatus;
  error?: string;
}
export interface ListRunsInput {
  source?: CollectorSource;
  status?: RunStatus;
  limit?: number;
  cursor?: string;
}
export interface ListRunsOutput {
  items: RunView[];
  cursor?: string;
  total: number;
}

// ─── DNS observation ────────────────────────────────────────────────

export type DnsRecordType = "A" | "AAAA" | "MX" | "NS" | "TXT" | "CNAME" | "SOA" | "PTR";

export interface DnsObservationRecord {
  did: string;
  observationId: string;
  domain: string;
  recordType: DnsRecordType;
  value: string;
  /** Optional FK → collector run. */
  runId?: string;
  observedAt: string;
  createdAt: string;
}
export interface DnsObservationView extends DnsObservationRecord {
  observationUri: string;
}
export interface RecordDnsInput {
  observationId: string;
  domain: string;
  recordType: DnsRecordType;
  value: string;
  runId?: string;
  observedAt: string;
}
export interface RecordDnsOutput {
  status: "recorded" | "alreadyExists" | "rejected" | "runNotFound";
  observationUri?: string;
  did?: string;
  observationId?: string;
  error?: string;
}
export interface ListDnsInput {
  domain?: string;
  recordType?: DnsRecordType;
  runId?: string;
  limit?: number;
  cursor?: string;
}
export interface ListDnsOutput {
  items: DnsObservationView[];
  cursor?: string;
  total: number;
}

// ─── Blockchain actor ───────────────────────────────────────────────

export type Chain = "btc" | "eth";

export interface BlockchainActorRecord {
  did: string;
  actorId: string;
  chain: Chain;
  address: string;
  label?: string;
  firstSeen?: string;
  observedAt: string;
  createdAt: string;
}
export interface BlockchainActorView extends BlockchainActorRecord {
  actorUri: string;
}
export interface RecordActorInput {
  actorId: string;
  chain: Chain;
  address: string;
  label?: string;
  firstSeen?: string;
  observedAt: string;
}
export interface RecordActorOutput {
  status: "recorded" | "alreadyExists" | "rejected";
  actorUri?: string;
  did?: string;
  actorId?: string;
  error?: string;
}
export interface ListActorsInput {
  chain?: Chain;
  address?: string;
  limit?: number;
  cursor?: string;
}
export interface ListActorsOutput {
  items: BlockchainActorView[];
  cursor?: string;
  total: number;
}

// ─── Risk signal ────────────────────────────────────────────────────

export type SubjectType = "domain" | "address" | "ip" | "asn";
export type Severity = "low" | "medium" | "high" | "critical";

export interface RiskSignalRecord {
  did: string;
  signalId: string;
  subjectType: SubjectType;
  subject: string;
  signalType: string;
  severity: Severity;
  /** Optional FK → collector run. */
  runId?: string;
  observedAt: string;
  createdAt: string;
}
export interface RiskSignalView extends RiskSignalRecord {
  signalUri: string;
}
export interface RecordSignalInput {
  signalId: string;
  subjectType: SubjectType;
  subject: string;
  signalType: string;
  severity: Severity;
  runId?: string;
  observedAt: string;
}
export interface RecordSignalOutput {
  status: "recorded" | "alreadyExists" | "rejected" | "runNotFound";
  signalUri?: string;
  did?: string;
  signalId?: string;
  error?: string;
}
export interface ListSignalsInput {
  subjectType?: SubjectType;
  subject?: string;
  severity?: Severity;
  signalType?: string;
  limit?: number;
  cursor?: string;
}
export interface ListSignalsOutput {
  items: RiskSignalView[];
  cursor?: string;
  total: number;
}

// ─── Coverage ───────────────────────────────────────────────────────

export interface CoverageInput {
  maxScan?: number;
}
export interface CoverageOutput {
  runCount?: number;
  dnsCount?: number;
  actorCount?: number;
  signalCount?: number;
  runsBySource?: Record<string, number>;
  signalsBySeverity?: Record<string, number>;
  truncated?: boolean;
  error?: string;
}

// ─── Validation + helpers ───────────────────────────────────────────

export const SOURCES: ReadonlySet<string> = new Set(["rdap", "dns", "blockchain", "commonCrawl", "portScan", "internetArchive"]);
export const DNS_TYPES: ReadonlySet<string> = new Set(["A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA", "PTR"]);
export const CHAINS: ReadonlySet<string> = new Set(["btc", "eth"]);
export const SUBJECT_TYPES: ReadonlySet<string> = new Set(["domain", "address", "ip", "asn"]);
export const SEVERITIES: ReadonlySet<string> = new Set(["low", "medium", "high", "critical"]);

export function isNonNegInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0;
}

export function runDidFor(id: string): string {
  return `${COLLECTOR_DID_PREFIX}run:${id.toLowerCase()}`;
}
export function runRkey(id: string): string {
  return `run-${id.toLowerCase()}`;
}
export function dnsDidFor(id: string): string {
  return `${COLLECTOR_DID_PREFIX}dns:${id.toLowerCase()}`;
}
export function dnsRkey(id: string): string {
  return `dns-${id.toLowerCase()}`;
}
export function actorDidFor(id: string): string {
  return `${COLLECTOR_DID_PREFIX}actor:${id.toLowerCase()}`;
}
export function actorRkey(id: string): string {
  return `actor-${id.toLowerCase()}`;
}
export function signalDidFor(id: string): string {
  return `${COLLECTOR_DID_PREFIX}signal:${id.toLowerCase()}`;
}
export function signalRkey(id: string): string {
  return `signal-${id.toLowerCase()}`;
}
