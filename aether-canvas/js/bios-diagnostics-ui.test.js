import { describe, expect, it } from "vitest";
import {
  buildBiosDiagnosticsSnapshot,
  renderDiagnosticsActionList,
  renderDiagnosticsIssueGroups,
  renderDiagnosticsStillWorksList,
} from "./bios-diagnostics-ui.js";

describe("bios-diagnostics-ui", () => {
  const escapeHtml = (value) =>
    String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

  it("surfaces resume guidance for an incomplete profile", () => {
    const snapshot = buildBiosDiagnosticsSnapshot({
      activeProfile: { display_name: "Claw" },
      onboarding: { completed: false, agentName: "Claw", modelPref: "local" },
      runtimeStatus: {
        route_ready: false,
        route_status_label: "Needs local worker",
        worker_ready: false,
        worker_status_label: "Local worker pending",
        boxed_lane_ready: false,
      },
      diagnostics: {
        debug_log_path: "C:/bios/debug.log",
        boxed_lane_ready: false,
      },
    });

    expect(snapshot.headline).toBe("Claw setup needs to resume");
    expect(snapshot.recoveryLabel).toContain("Resume onboarding");
    expect(snapshot.issues).toContain("Setup is still in progress for Claw.");
    expect(snapshot.issues).toContain("Local worker pending");
    expect(snapshot.issueGroups.map((issue) => issue.group)).toContain("profile");
    expect(snapshot.issueGroups.map((issue) => issue.group)).toContain("model");
    expect(snapshot.recoveryActions).toContain("Resume onboarding from the saved profile state.");
    expect(snapshot.supportSummary).toContain("worker not ready");
  });

  it("summarizes a ready profile without fake recovery work", () => {
    const snapshot = buildBiosDiagnosticsSnapshot({
      activeProfile: { display_name: "Claw" },
      onboarding: { completed: true, agentName: "Claw", modelPref: "local" },
      runtimeStatus: {
        route_ready: true,
        worker_ready: true,
        boxed_lane_ready: true,
      },
      diagnostics: {
        debug_log_path: "C:/bios/debug.log",
        boxed_lane_ready: true,
      },
    });

    expect(snapshot.headline).toBe("Claw is ready");
    expect(snapshot.recoveryLabel).toBe("No recovery work needed.");
    expect(snapshot.issues).toEqual([]);
    expect(snapshot.issueGroups).toEqual([]);
    expect(snapshot.whatStillWorks).toContain("The main chat route is available.");
  });

  it("surfaces guarded soul approval as the primary recovery posture", () => {
    const snapshot = buildBiosDiagnosticsSnapshot({
      activeProfile: { display_name: "Claw" },
      onboarding: { completed: true, agentName: "Claw", modelPref: "local" },
      runtimeStatus: {
        route_ready: true,
        worker_ready: true,
        boxed_lane_ready: true,
      },
      diagnostics: {
        debug_log_path: "C:/bios/debug.log",
        boxed_lane_ready: true,
      },
      brainstem: {
        lifecycle: "waiting_for_approval",
        summary:
          "BIOS is holding 2 guarded soul change(s) until the operator decides what identity truth should become canonical.",
      },
    });

    expect(snapshot.headline).toBe("Claw is waiting for approval");
    expect(snapshot.recoveryLabel).toBe("Review the pending guarded identity changes.");
    expect(snapshot.summary).toContain("guarded soul change");
    expect(snapshot.issues).toContain(
      "Guarded identity changes are waiting for approval before BIOS AI continues.",
    );
    expect(snapshot.recoveryActions).toContain("Review the pending guarded identity changes.");
  });

  it("renders grouped diagnostics and recovery actions for settings", () => {
    const issueGroups = [
      {
        group: "model",
        title: "Local model",
        message: "Worker <missing>",
        action: "Choose a model.",
      },
    ];

    expect(renderDiagnosticsIssueGroups(issueGroups, escapeHtml)).toContain(
      "Worker &lt;missing&gt;",
    );
    expect(renderDiagnosticsActionList(["Choose a model."], escapeHtml)).toContain(
      "Choose a model.",
    );
    expect(renderDiagnosticsStillWorksList(["Setup guidance"], escapeHtml)).toContain(
      "Setup guidance",
    );
    expect(renderDiagnosticsIssueGroups([], escapeHtml)).toContain("No active BIOS AI");
  });
});
