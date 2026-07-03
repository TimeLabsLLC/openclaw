import { describe, expect, it } from "vitest";
import { buildMissionControlSnapshot } from "./bios-mission-control-ui.js";

describe("buildMissionControlSnapshot", () => {
  it("builds continuity and approval labels for blocked missions", () => {
    const snapshot = buildMissionControlSnapshot({
      mission: {
        operatorRecord: {
          approval: {
            id: "approval-1",
            title: "browser sandbox patch",
          },
        },
      },
      continuity: {
        lifecycle: "waiting_for_approval",
        recoveryAction: "await_approval",
        summary: "Waiting for operator input.",
        blockedByApproval: true,
        health: "needs_review",
      },
      formatContinuityLabel: (value) => value.replaceAll("_", " "),
    });

    expect(snapshot.continuityLabel).toBe("waiting for approval");
    expect(snapshot.continuityRecovery).toBe("await approval");
    expect(snapshot.continuitySummary).toBe("Waiting for operator input.");
    expect(snapshot.pendingApproval).toEqual({
      id: "approval-1",
      title: "browser sandbox patch",
    });
    expect(snapshot.continuityTone).toBe("var(--warning)");
  });

  it("falls back safely when continuity is absent", () => {
    const snapshot = buildMissionControlSnapshot({
      mission: { operatorRecord: {} },
      continuity: null,
      formatContinuityLabel: (value) => value,
    });

    expect(snapshot.continuityLabel).toBe("unknown");
    expect(snapshot.continuityRecovery).toBe("none");
    expect(snapshot.continuitySummary).toBe("Continuity snapshot not loaded yet.");
    expect(snapshot.pendingApproval).toBeNull();
    expect(snapshot.continuityTone).toBe("var(--accent)");
  });
});
