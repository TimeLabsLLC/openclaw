import { describe, expect, it } from "vitest";
import { buildBoxedLaneRenderSnapshot } from "./boxed-lane-ui.js";

describe("boxed-lane-ui", () => {
  it("builds a ready boxed-lane summary from the BIOS shell contract", () => {
    const snapshot = buildBoxedLaneRenderSnapshot({
      profile: {
        display_name: "Claw",
      },
      runtime: {
        route_mode_label: "Local only",
      },
      boxed_lane: {
        substrate_ready: true,
        worker_lane_ready: true,
        state_label: "Boxed lane ready for managed work",
        substrate_label: "BIOS AI Boxed Lane native Linux adapter ready",
        worker_status_label: "Managed worker ready",
        note: "Sandbox-first execution, managed worker proof, and promotion gates are all active.",
        safety_summary:
          "Native boxed-lane hardened | Boxed lane ready for managed work | Promotion stays gated until BIOS AI proves work inside the boxed lane.",
      },
      promotion: {
        state_label: "Promotion gate armed",
        summary:
          "Build and test in sandbox first | Approval and validation before host adoption | Host access remains gated until operator approval.",
      },
      sandbox_state: {
        queue_summary: "1 queued boxed-lane artifact | 0 blocked | 1 approved",
        latest_decision_label: "Build artifact | approved",
        latest_event_label: "promotion_approved | Validation passed",
        queue: [
          {
            label: "Build artifact",
            kind: "code",
            state: "approved",
            lifecycle_stage_label: "Approved for host adoption",
            host_access_label: "Host adoption allowed after boxed proof",
            promotion_action_label: "Promotion complete",
            detail: "Validation passed",
            evidence_count: 2,
            evidence_summary: "2 evidence items recorded",
          },
        ],
      },
    });

    expect(snapshot.sandboxHealthLabel).toBe("Boxed lane ready for managed work");
    expect(snapshot.promotionGateLabel).toBe("Promotion gate armed");
    expect(snapshot.queueSummaryLabel).toContain("queued boxed-lane artifact");
    expect(snapshot.latestDecisionLabel).toBe("Build artifact | approved");
    expect(snapshot.queueLifecycleSummary).toContain("1 recent boxed artifact");
    expect(snapshot.statusOverviewTitle).toBe("BIOS AI boxed lane is ready for supervised work");
    expect(snapshot.statusOverviewCopy).toContain("Claw");
  });

  it("returns waiting copy when the shell contract is unavailable", () => {
    const snapshot = buildBoxedLaneRenderSnapshot(null);

    expect(snapshot.sandboxHealthLabel).toBe("Waiting on BIOS runtime audit");
    expect(snapshot.promotionGateLabel).toBe("Waiting on BIOS runtime audit");
  });

  it("relabels old blocked records as history when boxed lane is currently ready", () => {
    const snapshot = buildBoxedLaneRenderSnapshot({
      profile: { display_name: "B.A.Bs" },
      runtime: { route_mode_label: "Local only" },
      boxed_lane: {
        substrate_ready: true,
        worker_lane_ready: true,
        state_label: "Boxed lane ready",
        substrate_label: "Windows boxed lane ready",
        worker_status_label: "Managed worker ready",
        note: "Current proof is ready.",
        safety_summary: "Native boxed-lane hardened.",
      },
      promotion: {
        state_label: "Promotion gate armed",
        summary: "Promotion required before host writes",
      },
      sandbox_state: {
        queue_summary: "2 queued boxed-lane artifacts | 2 blocked | 0 approved",
        queue: [
          {
            label: "Blocked boxed memory note",
            kind: "boxed_host_mutation",
            state: "blocked",
            lifecycle_stage_label: "Blocked from host adoption",
            host_access_label: "Host adoption blocked",
            promotion_action_label: "Fix in box before retrying",
            detail: "The boxed execution substrate is not ready yet.",
            evidence_count: 1,
          },
        ],
      },
    });

    expect(snapshot.statusOverviewTitle).toBe("BIOS AI boxed lane is ready for supervised work");
    expect(snapshot.queueItems[0].state).toBe("historical_blocked");
    expect(snapshot.queueItems[0].host_access_label).toContain("audit history");
    expect(snapshot.queueItems[0].detail).not.toContain("substrate is not ready");
    expect(snapshot.queueLifecycleSummary).toContain("0 currently blocked");
    expect(snapshot.queueLifecycleSummary).toContain("1 historical blocked");
  });
});
