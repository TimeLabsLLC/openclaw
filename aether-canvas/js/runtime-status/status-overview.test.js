import { describe, expect, it } from "vitest";
import { renderStatusOverviewCard } from "./status-overview.js";

function createDom() {
  document.body.innerHTML = `
    <strong id="status-overview-title"></strong>
    <p id="status-overview-copy"></p>
    <div id="st-gateway"></div>
    <div id="st-boss-profile"></div>
    <div id="st-sandbox-health"></div>
    <div id="st-model"></div>
  `;
}

describe("renderStatusOverviewCard", () => {
  it("renders the boxed-lane contract summary when native contract truth is present", () => {
    createDom();

    renderStatusOverviewCard({
      agentName: "Claw",
      biosShellContract: {
        boxed_lane: {
          substrate_ready: true,
          worker_lane_ready: true,
          safety_summary: "LXC-first hardened | Boxed lane ready",
        },
        promotion: {
          state_label: "Promotion gated",
        },
        runtime: {
          route_mode_label: "Local only",
        },
      },
    });

    expect(document.getElementById("status-overview-title").innerText).toBe(
      "BIOS AI protected workspace is ready",
    );
    expect(document.getElementById("status-overview-copy").innerText).toContain(
      "LXC-first hardened | protected workspace ready",
    );
    expect(document.getElementById("status-overview-copy").innerText).toContain(
      "BOSS: Claw. Route: Local only. Status: status gated.",
    );
  });

  it("falls back to shell telemetry labels when no contract truth is loaded yet", () => {
    createDom();
    document.getElementById("st-gateway").innerText = "Offline shell";
    document.getElementById("st-boss-profile").innerText = "Waiting on onboarding";
    document.getElementById("st-sandbox-health").innerText = "Waiting on BIOS runtime audit";
    document.getElementById("st-model").innerText = "Not configured";

    renderStatusOverviewCard({
      agentName: "BIOS AI",
      biosShellContract: null,
    });

    expect(document.getElementById("status-overview-title").innerText).toBe(
      "BIOS AI still needs setup",
    );
    expect(document.getElementById("status-overview-copy").innerText).toBe(
      "Online services: offline. BOSS: Waiting on onboarding. Protected workspace: Waiting on BIOS setup check. Model route: Not configured.",
    );
  });
});
