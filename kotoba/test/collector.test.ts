import { describe, it, expect, beforeEach } from "vitest";
import { MockEtzhayyim } from "@etzhayyim/sdk-mock";
import {
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
} from "../src/index.js";

describe("collector kotoba", () => {
  let e: any;
  beforeEach(() => {
    e = new MockEtzhayyim({ did: "did:web:collector.etzhayyim.com" });
  });

  describe("collector run lifecycle", () => {
    it("starts, finishes with item count, rejects bad source/double-finish", async () => {
      expect((await startRun(e, { runId: "R-1", source: "dns", startedAt: "2026-06-01T00:00:00Z" })).status).toBe("started");
      expect((await startRun(e, { runId: "R-2", source: "bogus" as any, startedAt: "x" })).status).toBe("rejected");
      expect((await finishRun(e, { runId: "R-1", status: "completed", finishedAt: "2026-06-01T01:00:00Z", itemsCollected: 42 })).newStatus).toBe("completed");
      expect((await finishRun(e, { runId: "R-1", status: "failed", finishedAt: "x" })).status).toBe("rejected"); // not running
      expect((await finishRun(e, { runId: "GHOST", status: "completed", finishedAt: "x" })).status).toBe("notFound");
      expect((await listRuns(e, { source: "dns", status: "completed" })).total).toBe(1);
    });
  });

  describe("observations FK to a run", () => {
    beforeEach(async () => {
      await startRun(e, { runId: "R-1", source: "dns", startedAt: "2026-06-01T00:00:00Z" });
    });
    it("records DNS (optional FK→run), rejects bad type + missing run", async () => {
      expect((await recordDns(e, { observationId: "O-1", domain: "Example.com", recordType: "A", value: "1.2.3.4", runId: "R-1", observedAt: "2026-06-01T00:10:00Z" })).status).toBe("recorded");
      expect((await recordDns(e, { observationId: "O-2", domain: "x.com", recordType: "ZZZ" as any, value: "y", observedAt: "x" })).status).toBe("rejected");
      expect((await recordDns(e, { observationId: "O-3", domain: "x.com", recordType: "A", value: "y", runId: "GHOST", observedAt: "x" })).status).toBe("runNotFound");
      // domain normalized to lowercase
      expect((await listDns(e, { domain: "example.com", recordType: "A" })).total).toBe(1);
    });
    it("records blockchain actors + risk signals; filters", async () => {
      expect((await recordActor(e, { actorId: "A-1", chain: "eth", address: "0xabc", label: "exchange", observedAt: "2026-06-01T00:00:00Z" })).status).toBe("recorded");
      expect((await recordActor(e, { actorId: "A-2", chain: "doge" as any, address: "x", observedAt: "x" })).status).toBe("rejected");
      expect((await listActors(e, { chain: "eth" })).total).toBe(1);
      expect((await recordSignal(e, { signalId: "S-1", subjectType: "address", subject: "0xabc", signalType: "mixer", severity: "high", runId: "R-1", observedAt: "2026-06-01T00:00:00Z" })).status).toBe("recorded");
      expect((await recordSignal(e, { signalId: "S-2", subjectType: "domain", subject: "evil.com", signalType: "phishing", severity: "critical", observedAt: "2026-06-01T00:00:00Z" })).status).toBe("recorded");
      expect((await listSignals(e, { severity: "critical" })).total).toBe(1);
      expect((await listSignals(e, { subjectType: "address" })).total).toBe(1);
    });
    it("coverage rolls up the four collections", async () => {
      await recordDns(e, { observationId: "O-1", domain: "x.com", recordType: "A", value: "1.2.3.4", runId: "R-1", observedAt: "2026-06-01T00:00:00Z" });
      await recordActor(e, { actorId: "A-1", chain: "btc", address: "bc1abc", observedAt: "2026-06-01T00:00:00Z" });
      await recordSignal(e, { signalId: "S-1", subjectType: "ip", subject: "1.2.3.4", signalType: "scanner", severity: "medium", observedAt: "2026-06-01T00:00:00Z" });
      const cov = await coverage(e);
      expect(cov.runCount).toBe(1);
      expect(cov.dnsCount).toBe(1);
      expect(cov.actorCount).toBe(1);
      expect(cov.signalCount).toBe(1);
      expect(cov.runsBySource?.dns).toBe(1);
      expect(cov.signalsBySeverity?.medium).toBe(1);
    });
  });
});
