/**
 * collector kotoba — barrel.
 *
 * Per ADR-2606011400 (Consensys pattern) MIXED split. The public network-
 * intelligence layer on the etzhayyim substrate (AT PDS records; no RW).
 *
 *   run    : startRun / finishRun / listRuns
 *   dns    : recordDns (optional FK→run) / listDns
 *   actor  : recordActor / listActors
 *   signal : recordSignal (optional FK→run) / listSignals
 *   coverage
 *
 * Raw leaked-database content (leakEntity) + abuse-report PII stays etzhayyim infra.
 */

export * from "./types.js";
export {
  startRun,
  finishRun,
  listRuns,
  recordDns,
  listDns,
  recordActor,
  listActors,
  recordSignal,
  listSignals,
  coverage,
} from "./registry.js";
