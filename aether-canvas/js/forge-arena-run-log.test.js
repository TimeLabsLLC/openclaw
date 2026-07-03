import { describe, expect, it } from "vitest";
import { summarizeForgeArenaOvernightLog } from "./forge-arena-run-log.js";

function logLine(event, details, ts, hash = `hash-${ts}`) {
  return JSON.stringify({
    version: "bios-debug-log-v1",
    ts,
    event,
    details: JSON.stringify(details),
    record_hash: hash,
  });
}

describe("summarizeForgeArenaOvernightLog", () => {
  it("reports no field run when the debug log has no overnight records", () => {
    const summary = summarizeForgeArenaOvernightLog("");

    expect(summary.state).toBe("empty");
    expect(summary.progressLabel).toBe("0/50 scenarios");
  });

  it("treats a later blocked record after progress as a partial run", () => {
    const logText = [
      logLine(
        "major_boss_overnight.progress",
        {
          runId: "major-boss-overnight-b-a-bs-1",
          batchIndex: 10,
          completedScenarios: 30,
          totalScenarios: 50,
          status: "cooldown",
        },
        100,
        "progress-hash",
      ),
      logLine(
        "major_boss_overnight.blocked",
        {
          profileId: "b-a-bs",
          detail: "OpenAI API error: request exceeds context size",
        },
        120,
        "blocked-hash",
      ),
    ].join("\n");

    const summary = summarizeForgeArenaOvernightLog(logText);

    expect(summary.state).toBe("partial");
    expect(summary.runId).toBe("major-boss-overnight-b-a-bs-1");
    expect(summary.progressLabel).toBe("30/50 scenarios");
    expect(summary.progressPercent).toBe(60);
    expect(summary.detail).toContain("context size");
    expect(summary.recordHash).toBe("blocked-hash");
  });

  it("reports an interrupted latest progress run when no completed or blocked record follows", () => {
    const logText = logLine(
      "major_boss_overnight.progress",
      {
        runId: "major-boss-overnight-b-a-bs-2",
        batchIndex: 1,
        completedScenarios: 3,
        totalScenarios: 50,
        status: "cooldown",
      },
      200,
      "cooldown-hash",
    );

    const summary = summarizeForgeArenaOvernightLog(logText);

    expect(summary.state).toBe("running-or-interrupted");
    expect(summary.progressLabel).toBe("3/50 scenarios");
    expect(summary.progressPercent).toBe(6);
    expect(summary.detail).toContain("interrupted partial run");
  });

  it("reports completed runs with packaged proof detail", () => {
    const logText = logLine(
      "major_boss_overnight.completed",
      {
        runId: "major-boss-overnight-b-a-bs-3",
        status: "passed_overnight_major_boss_contract",
        scenarioCount: 50,
        batchCount: 17,
        judgedArtifacts: 50,
        contextSleepCount: 2,
        thermalSampleCount: 18,
      },
      300,
      "complete-hash",
    );

    const summary = summarizeForgeArenaOvernightLog(logText);

    expect(summary.state).toBe("complete");
    expect(summary.progressPercent).toBe(100);
    expect(summary.detail).toContain("50 judged artifact");
    expect(summary.detail).toContain("2 context sleep");
  });
});
