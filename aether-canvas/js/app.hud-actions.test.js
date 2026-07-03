import { beforeEach, describe, expect, it, vi } from "vitest";
import { AetherApp } from "./app.js";

function createHudDom() {
  document.body.innerHTML = `<div id="hud-panel"></div>`;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

function createHudApp() {
  const app = {
    activeSessionKey: "agent:main:main",
    gateway: {
      isConnected: true,
      request: vi.fn(),
    },
    subtitles: { update: vi.fn() },
    hudActionState: {
      skills: new Map(),
      checkpoints: new Map(),
    },
    skillTelemetry: null,
    routeDecisionHistory: [],
    launchSupportTelemetry: null,
    modelChoiceGuidance: null,
    modelTelemetry: null,
    promptEconomyTelemetry: null,
    describeModelTelemetry: () => "",
    describeModelChoiceGuidance: () => "",
    describeLaunchSupportTelemetry: () => "",
    describePromptEconomyTelemetry: () => "",
    describeSkillTelemetry: () => "",
    describeLatestRouteDecision: () => "",
    renderContinuityShellSurface: vi.fn(),
    formatContinuityLabel: (value) => String(value).replaceAll("_", " "),
    sendChatMessage: vi.fn(),
    switchSession: vi.fn().mockResolvedValue(true),
  };
  app.refreshHudData = AetherApp.prototype.refreshHudData.bind(app);
  app.resumeWorkflowCheckpoint = AetherApp.prototype.resumeWorkflowCheckpoint.bind(app);
  return app;
}

describe("AetherApp HUD actions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    vi.stubGlobal("alert", vi.fn());
  });

  it("shows pending and success status on an observed skill validation card", async () => {
    createHudDom();
    const app = createHudApp();
    let releaseValidate;
    let validated = false;
    app.gateway.request.mockImplementation((method) => {
      switch (method) {
        case "clipboard.list":
          return Promise.resolve({ variables: {} });
        case "checkpointer.list":
          return Promise.resolve({ checkpoints: {} });
        case "skills.list":
          return Promise.resolve({
            telemetry: {},
            skills: [
              {
                id: "skill-browser-open",
                description: "Open browser",
                fastPathReady: false,
                needsValidation: !validated,
                validationTarget: "browser-open",
                successCount: 2,
                routeHits: 2,
                toolReady: validated,
                promotedTool: validated
                  ? { toolName: "skill_browser-open", invocation: "skill_browser-open" }
                  : null,
              },
            ],
          });
        case "skills.tools":
          return Promise.resolve({ tools: [] });
        case "sessions.list":
          return Promise.resolve({ sessions: [] });
        case "models.list":
          return Promise.resolve({ models: [] });
        case "models.authStatus":
          return Promise.resolve({ providers: [] });
        case "launcher.status":
          return Promise.resolve(null);
        case "radix.status":
          return Promise.resolve({ status: { status: "running" } });
        case "cpu.fallback.status":
          return Promise.resolve({ running: false });
        case "skills.validate":
          return new Promise((resolve) => {
            releaseValidate = () => {
              validated = true;
              resolve({ ok: true });
            };
          });
        default:
          return Promise.resolve({});
      }
    });

    await app.refreshHudData();

    const skillButton = Array.from(document.querySelectorAll(".hud-card")).find((node) =>
      node.textContent?.includes("Open browser"),
    );
    expect(skillButton).toBeTruthy();

    skillButton.click();
    await flushMicrotasks();

    expect(app.subtitles.update).toHaveBeenCalledWith(
      "Validating observed skill: skill-browser-open...",
    );
    expect(app.hudActionState.skills.get("skill-browser-open")?.pending).toBe(true);

    releaseValidate();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(app.subtitles.update).toHaveBeenLastCalledWith(
      "Validated observed skill: skill-browser-open.",
    );
    expect(app.hudActionState.skills.get("skill-browser-open")?.message).toBe(
      "Validated observed skill: skill-browser-open.",
    );
  });

  it("shows pending and success status on a resumable checkpoint card", async () => {
    createHudDom();
    const app = createHudApp();
    let releaseResume;
    app.gateway.request.mockImplementation((method) => {
      switch (method) {
        case "clipboard.list":
          return Promise.resolve({ variables: {} });
        case "checkpointer.list":
          return Promise.resolve({
            checkpoints: {
              one: {
                sessionKey: "agent:checkpoint:1",
                timestamp: Date.now(),
                stepIndex: 4,
                continuity: {
                  lifecycle: "waiting_for_approval",
                  summary: "Waiting for approval",
                },
              },
            },
          });
        case "skills.list":
          return Promise.resolve({ telemetry: {}, skills: [] });
        case "skills.tools":
          return Promise.resolve({ tools: [] });
        case "sessions.list":
          return Promise.resolve({ sessions: [] });
        case "models.list":
          return Promise.resolve({ models: [] });
        case "models.authStatus":
          return Promise.resolve({ providers: [] });
        case "launcher.status":
          return Promise.resolve(null);
        case "radix.status":
          return Promise.resolve({ status: { status: "running" } });
        case "cpu.fallback.status":
          return Promise.resolve({ running: false });
        case "checkpointer.resume":
          return new Promise((resolve) => {
            releaseResume = () =>
              resolve({
                checkpoint: {
                  stepIndex: 4,
                  continuity: { lifecycle: "waiting_for_approval" },
                },
                continuity: { lifecycle: "waiting_for_approval" },
              });
          });
        default:
          return Promise.resolve({});
      }
    });

    await app.refreshHudData();

    const checkpointCard = Array.from(document.querySelectorAll(".hud-card")).find((node) =>
      node.textContent?.includes("agent:checkpoint:1"),
    );
    expect(checkpointCard).toBeTruthy();

    checkpointCard.click();
    await flushMicrotasks();

    expect(app.subtitles.update).toHaveBeenNthCalledWith(
      1,
      "Resuming workflow checkpoint for: agent:checkpoint:1...",
    );
    expect(app.hudActionState.checkpoints.get("agent:checkpoint:1")?.pending).toBe(true);

    releaseResume();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(app.subtitles.update).toHaveBeenLastCalledWith(
      "Workflow resumed at step 4. waiting for approval continuity recovered.",
    );
    expect(app.hudActionState.checkpoints.get("agent:checkpoint:1")?.message).toBe(
      "Workflow resumed at step 4. waiting for approval continuity recovered.",
    );
    expect(app.switchSession).toHaveBeenCalledWith("agent:checkpoint:1");
  });
});
