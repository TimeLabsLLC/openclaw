import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderSandboxLaneSurface } from "./controller.js";

describe("sandbox-lanes controller", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <strong id="st-sandbox-health"></strong>
      <strong id="st-workers"></strong>
      <strong id="st-promotion-gate"></strong>
      <strong id="settings-boxed-lane-state"></strong>
      <strong id="settings-boxed-lane-substrate"></strong>
      <strong id="settings-promotion-gate"></strong>
      <strong id="settings-boxed-lane-queue"></strong>
      <strong id="settings-promotion-record"></strong>
      <strong id="settings-boxed-lane-events"></strong>
      <p id="settings-safety-summary"></p>
      <p id="settings-boxed-lane-summary"></p>
      <button id="settings-prepare-boxed-lane"></button>
      <p id="settings-prepare-boxed-lane-status"></p>
      <div id="settings-boxed-lane-queue-list"></div>
      <strong id="status-overview-title"></strong>
      <p id="status-overview-copy"></p>
    `;
  });

  it("renders boxed-lane and promotion summaries from the BIOS shell contract", () => {
    const app = {
      agentName: "Claw",
      setStatusValue: vi.fn((id, value) => {
        const el = document.getElementById(id);
        if (el) {
          el.innerText = value;
        }
      }),
    };

    renderSandboxLaneSurface(app, {
      runtime: {
        route_mode_label: "Hybrid",
      },
      boxed_lane: {
        substrate_ready: false,
        worker_lane_ready: true,
        state_label: "Managed worker ready; boxed substrate still needs setup",
        substrate_label:
          "Windows boxed lane available; managed Linux substrate still needs provisioning",
        worker_status_label: "Managed worker ready",
        note: "The managed worker is ready, but the boxed execution substrate still needs to be provisioned before BIOS AI can treat sandboxing as a first-class lane.",
        safety_summary:
          "Native boxed-lane hardened | Managed worker ready; boxed substrate still needs setup | Promotion stays gated until BIOS AI proves work inside the boxed lane.",
      },
      promotion: {
        state_label: "Promotion gate waiting on boxed proof",
        summary:
          "Build and test in sandbox first | Promotion required before host writes | Provision the native boxed lane before host promotion.",
      },
      sandbox_state: {
        queue_summary: "2 queued boxed-lane artifacts | 1 blocked | 0 approved",
        latest_decision_label: "Generated tool | blocked",
        latest_event_label: "promotion_blocked | Validation failed",
        queue: [
          {
            label: "Generated tool",
            kind: "tool",
            state: "blocked",
            lifecycle_stage_label: "Blocked from host adoption",
            host_access_label: "Host adoption blocked",
            promotion_action_label: "Fix in box before retrying",
            detail: "Validation failed",
            evidence_count: 1,
            evidence_summary: "1 evidence item recorded",
          },
        ],
      },
    });

    expect(document.getElementById("st-sandbox-health").innerText).toBe(
      "Managed worker ready; boxed substrate still needs setup",
    );
    expect(document.getElementById("st-promotion-gate").innerText).toBe(
      "Promotion gate waiting on boxed proof",
    );
    expect(document.getElementById("settings-boxed-lane-substrate").innerText).toBe(
      "Windows boxed lane available; managed Linux substrate still needs provisioning",
    );
    expect(document.getElementById("settings-boxed-lane-queue").innerText).toContain(
      "queued boxed-lane artifacts",
    );
    expect(document.getElementById("settings-promotion-record").innerText).toBe(
      "Generated tool | blocked",
    );
    expect(document.getElementById("status-overview-copy").innerText).toContain(
      "Promotion gate waiting on boxed proof",
    );
    expect(document.getElementById("settings-boxed-lane-queue-list").textContent).toContain(
      "Blocked from host adoption",
    );
    expect(document.getElementById("settings-boxed-lane-queue-list").textContent).toContain(
      "Next: Fix in box before retrying",
    );
  });

  it("keeps boxed-lane setup actionable and renders grouped blocked records cleanly", () => {
    const app = {
      activeBiosProfileId: "claw",
      agentName: "Claw",
      setStatusValue: vi.fn((id, value) => {
        const el = document.getElementById(id);
        if (el) {
          el.innerText = value;
        }
      }),
    };

    renderSandboxLaneSurface(app, {
      runtime: {
        route_mode_label: "Local only",
      },
      boxed_lane: {
        substrate_ready: false,
        worker_lane_ready: true,
        state_label: "Managed worker ready; boxed substrate still needs setup",
        substrate_label:
          "Windows boxed lane available; BIOS-managed Linux substrate still needs provisioning",
        worker_status_label: "Managed worker ready",
        note: "The managed worker is ready, but the boxed execution substrate still needs provisioning.",
        safety_summary:
          "Sandbox-first profile policy saved, but boxed execution is not hardened yet | Managed worker ready; boxed substrate still needs setup | Host promotion remains blocked until provisioning proof passes.",
      },
      promotion: {
        state_label: "Promotion gate waiting on boxed proof",
        summary:
          "Build and test in sandbox first | Promotion required before host writes | Boxed lane setup required.",
      },
      sandbox_state: {
        queue_summary: "2 queued boxed-lane artifacts | 2 blocked | 0 approved",
        latest_decision_label: "Blocked boxed memory note (2 similar) | blocked",
        latest_event_label: "boxed_lane_blocked | The boxed execution substrate is not ready yet",
        queue: [
          {
            label: "Blocked boxed memory note (2 similar)",
            kind: "boxed_host_mutation",
            state: "blocked",
            lifecycle_stage_label: "Blocked from host adoption",
            host_access_label: "Host adoption blocked",
            promotion_action_label: "Fix in box before retrying",
            detail:
              "The boxed execution substrate is not ready yet. This summarizes 2 matching boxed-lane records.",
            evidence_count: 2,
            evidence_summary: "2 evidence items recorded",
          },
        ],
      },
    });

    expect(document.getElementById("settings-safety-summary").innerText).toContain(
      "Promotion required before host writes",
    );
    expect(document.getElementById("status-overview-copy").innerText).toContain(
      "boxed execution is not hardened yet",
    );
    expect(document.getElementById("settings-boxed-lane-queue-list").textContent).toContain(
      "Blocked boxed memory note (2 similar)",
    );
    expect(document.getElementById("settings-boxed-lane-queue-list").textContent).toContain(
      "2 evidence items recorded",
    );
    expect(document.getElementById("settings-prepare-boxed-lane").disabled).toBe(false);
    expect(document.getElementById("settings-prepare-boxed-lane").innerText).toBe(
      "Repair And Verify Boxed Lane",
    );
    expect(document.getElementById("settings-prepare-boxed-lane-status").innerText).toContain(
      "BIOS-managed Linux substrate still needs provisioning",
    );
  });

  it("does not present stale blocked queue records as current truth after boxed proof is ready", () => {
    const app = {
      activeBiosProfileId: "b-a-bs",
      agentName: "B.A.Bs",
      setStatusValue: vi.fn((id, value) => {
        const el = document.getElementById(id);
        if (el) {
          el.innerText = value;
        }
      }),
    };

    renderSandboxLaneSurface(app, {
      runtime: { route_mode_label: "Local only" },
      boxed_lane: {
        substrate_ready: true,
        worker_lane_ready: true,
        state_label: "Boxed lane ready",
        substrate_label: "Windows boxed lane ready",
        worker_status_label: "Managed worker ready",
        note: "Current boxed-lane proof is present.",
        safety_summary: "Native boxed-lane hardened.",
      },
      promotion: {
        state_label: "Promotion gate armed",
        summary: "Promotion required before host writes",
      },
      sandbox_state: {
        queue_summary: "2 queued boxed-lane artifacts | 2 blocked | 0 approved",
        latest_decision_label: "Blocked boxed memory note | blocked",
        latest_event_label: "boxed_lane_blocked | The boxed execution substrate is not ready yet",
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

    const queueText = document.getElementById("settings-boxed-lane-queue-list").textContent;
    expect(document.getElementById("status-overview-title").innerText).toBe(
      "BIOS AI boxed lane is ready for supervised work",
    );
    expect(queueText).toContain("Historical blocked record");
    expect(queueText).toContain("audit history");
    expect(queueText).not.toContain("substrate is not ready");
    expect(document.getElementById("settings-prepare-boxed-lane").innerText).toBe(
      "Boxed Lane Ready",
    );
  });

  it("explains background BOSS repair without changing OS features on startup", () => {
    const app = {
      activeBiosProfileId: "claw",
      agentName: "Claw",
      biosBoxedLaneAutoPrepareResult: {
        action_taken: "background_repair_queued",
        blocked_reason:
          "BOSS repair is queued in the background. BIOS AI will not change OS features until the user chooses Repair And Verify Boxed Lane.",
        status: {
          install_state: "needs_linux_distro",
          next_action: "Provision the BIOS-managed Linux boxed-lane distro.",
        },
      },
      setStatusValue: vi.fn((id, value) => {
        const el = document.getElementById(id);
        if (el) {
          el.innerText = value;
        }
      }),
    };

    renderSandboxLaneSurface(app, {
      runtime: { route_mode_label: "Local only" },
      boxed_lane: {
        substrate_ready: false,
        worker_lane_ready: true,
        state_label: "BOSS repair queued",
        substrate_label: "Windows boxed lane needs managed distro",
        worker_status_label: "Managed worker ready",
        note: "BOSS repair is queued.",
        safety_summary: "Native boxed-lane hardened.",
      },
      promotion: {
        state_label: "Promotion gate waiting on boxed proof",
        summary: "Promotion required before host writes",
      },
      sandbox_state: { queue: [] },
    });

    expect(document.getElementById("settings-prepare-boxed-lane-status").innerText).toContain(
      "BOSS repair is queued in the background",
    );
    expect(document.getElementById("settings-prepare-boxed-lane-status").innerText).toContain(
      "will not change OS features",
    );
  });

  it("keeps the manual repair result visible after runtime refresh rerenders settings", async () => {
    const contract = {
      runtime: { route_mode_label: "Local only" },
      boxed_lane: {
        substrate_ready: false,
        worker_lane_ready: true,
        state_label: "BOSS repair queued",
        substrate_label: "Windows boxed lane needs managed distro",
        worker_status_label: "Managed worker ready",
        note: "BOSS repair is queued.",
        safety_summary: "Native boxed-lane hardened.",
      },
      promotion: {
        state_label: "Promotion gate waiting on boxed proof",
        summary: "Promotion required before host writes",
      },
      sandbox_state: { queue: [] },
    };
    const repairResult = {
      action_taken: "os_setup_started",
      blocked_reason: null,
      command_preview: "wsl --install -d Ubuntu --no-launch",
      command_output: "Started boxed-lane setup process 1234.",
      status: {
        install_state: "needs_linux_distro",
        proof_state: "waiting_for_substrate",
        repair_state: "verifying_after_os_setup",
        requires_reboot: true,
        next_action:
          "Restart Windows if prompted, then reopen BIOS AI so it can finish boxed-lane verification.",
      },
    };
    const invoke = vi.fn(async (command) => {
      if (command === "append_debug_log") {
        return null;
      }
      if (command === "bios_prepare_boxed_lane") {
        return repairResult;
      }
      throw new Error(`Unexpected command ${command}`);
    });
    window.__TAURI__ = { core: { invoke } };
    const app = {
      activeBiosProfileId: "claw",
      agentName: "Claw",
      setStatusValue: vi.fn((id, value) => {
        const el = document.getElementById(id);
        if (el) {
          el.innerText = value;
        }
      }),
      loadBiosRuntimeStatus: vi.fn(async () => {
        renderSandboxLaneSurface(app, contract);
      }),
    };

    renderSandboxLaneSurface(app, contract);
    document.getElementById("settings-prepare-boxed-lane").click();
    await vi.waitFor(() => {
      expect(app.loadBiosRuntimeStatus).toHaveBeenCalled();
    });

    expect(invoke).toHaveBeenCalledWith("append_debug_log", {
      event: "boxed_lane.repair.clicked",
      details: JSON.stringify({
        profileId: "claw",
        source: "settings",
        allowOsChanges: true,
      }),
    });
    expect(invoke).toHaveBeenCalledWith("bios_prepare_boxed_lane", {
      input: {
        profile_id: "claw",
        allow_os_changes: true,
      },
    });
    expect(document.getElementById("settings-prepare-boxed-lane-status").innerText).toContain(
      "Latest repair attempt: Boxed-lane setup started",
    );
    expect(document.getElementById("settings-prepare-boxed-lane-status").innerText).toContain(
      "needs_linux_distro",
    );
    expect(document.getElementById("settings-prepare-boxed-lane").innerText).toBe(
      "Boxed Lane Verifying",
    );
    expect(document.getElementById("settings-prepare-boxed-lane").disabled).toBe(true);
  });
});
