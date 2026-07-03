import { beforeEach, describe, expect, it, vi } from "vitest";
import { AetherApp } from "./app.js";

function createTelemetryDom() {
  document.body.innerHTML = `
    <div id="hud-panel"></div>
    <ul id="memory-orders-list"></ul>
    <ul id="memory-prefs-list"></ul>
    <ul id="memory-facts-list"></ul>
    <ul id="memory-longterm-list"></ul>
    <strong id="st-agent-state">Idle</strong>
    <strong id="st-gateway">Connecting...</strong>
    <strong id="st-tokens">—</strong>
    <strong id="st-cache">—</strong>
    <strong id="st-compaction">—</strong>
    <strong id="st-circadian">—</strong>
    <strong id="st-workers">—</strong>
  `;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("AetherApp passive telemetry actions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    window.__TAURI__ = undefined;
  });

  it("shows memory placeholders while loading and renders the fetched memory surface", async () => {
    createTelemetryDom();
    let releaseMemory;
    const app = {
      telemetryLoadState: { memory: "idle" },
      gateway: {
        isConnected: true,
        request: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              releaseMemory = resolve;
            }),
        ),
      },
      escapeHtml: AetherApp.prototype.escapeHtml,
      renderMemorySurfacePanel: AetherApp.prototype.renderMemorySurfacePanel,
      setMemoryListPlaceholder: AetherApp.prototype.setMemoryListPlaceholder,
    };

    const memoryPromise = AetherApp.prototype.loadMemorySurface.call(app);
    await flushMicrotasks();

    expect(document.getElementById("memory-orders-list").textContent).toBe(
      "Loading Standing Orders...",
    );
    expect(document.getElementById("memory-longterm-list").textContent).toBe(
      "Loading Long-Term Memory...",
    );

    releaseMemory({
      surface: {
        standingOrders: [{ text: "Never publish without review" }],
        userPreferences: [],
        missionFacts: [{ text: "Primary lane is owned shell" }],
        consolidatedMemory: [],
      },
    });
    await memoryPromise;

    expect(document.getElementById("memory-orders-list").textContent).toContain(
      "Never publish without review",
    );
    expect(document.getElementById("memory-prefs-list").textContent).toBe(
      "No preferences learned yet.",
    );
  });

  it("loads the BIOS-native memory surface through the runtime transport when the gateway is offline", async () => {
    createTelemetryDom();
    window.__TAURI__ = {
      core: {
        invoke: vi.fn(async (command, args) => {
          if (command === "load_provider_config") {
            return {
              active_provider: "",
              active_model: "",
              keys: [],
              conversation_history: [],
            };
          }
          if (command === "bios_shell_contract") {
            return {
              runtime: {
                worker_ready: true,
                route_ready: true,
                preferred_local_backend: "bios-managed",
              },
            };
          }
          if (command === "load_bios_memory_surface" && args?.profileId === "claw") {
            return {
              total_events: 2,
              standing_orders: [{ summary: "Never publish without review" }],
              user_preferences: [],
              mission_facts: [{ summary: "Primary lane is owned shell" }],
              relationship_notes: [],
              identity_notes: [],
              skill_candidates: [],
              pending_approval_changes: [],
              promotion_queue: [],
              recent_events: [],
              consolidated_memory: [{ summary: "Use sandbox before host promotion." }],
            };
          }
          if (command === "load_bios_observation_state") {
            return {
              label: "BIOS Home",
              detail: "Visible local shell is standing by.",
              active_surface: "local_shell",
              body_mode: "shell_standby",
              body_summary: "BIOS AI is working from the visible local shell surface.",
              execution_lane: "local_shell",
              ghosting_protected: true,
            };
          }
          if (command === "load_bios_skill_library") {
            return {
              hardened_skill_count: 0,
              strongest_skill: null,
              strongest_reinforcement: 0,
              artifacts: [],
            };
          }
          throw new Error(`Unexpected command: ${command}`);
        }),
      },
    };

    const app = {
      activeBiosProfileId: "claw",
      gateway: {
        isConnected: false,
        request: vi.fn(),
      },
      telemetryLoadState: { memory: "idle" },
      escapeHtml: AetherApp.prototype.escapeHtml,
      renderMemorySurfacePanel: AetherApp.prototype.renderMemorySurfacePanel,
      setMemoryListPlaceholder: AetherApp.prototype.setMemoryListPlaceholder,
    };

    await AetherApp.prototype.loadMemorySurface.call(app);

    expect(document.getElementById("memory-orders-list").textContent).toContain(
      "Never publish without review",
    );
    expect(document.getElementById("memory-longterm-list").textContent).toContain(
      "Use sandbox before host promotion.",
    );
    expect(app.gateway.request).not.toHaveBeenCalled();
  });

  it("shows token-economy loading and error states honestly", async () => {
    createTelemetryDom();
    let rejectToken;
    const app = {
      telemetryLoadState: { tokenEconomy: "idle" },
      gateway: {
        request: vi.fn().mockImplementation(
          () =>
            new Promise((_, reject) => {
              rejectToken = reject;
            }),
        ),
      },
      setStatusValue: AetherApp.prototype.setStatusValue,
      renderTokenEconomyPanel: AetherApp.prototype.renderTokenEconomyPanel,
    };

    const tokenPromise = AetherApp.prototype.loadTokenEconomy.call(app);
    await flushMicrotasks();

    expect(document.getElementById("st-tokens").innerText).toBe("Loading Token Economy...");
    expect(document.getElementById("st-cache").innerText).toBe("Loading Cache Hit Rate...");

    rejectToken(new Error("gateway unavailable"));
    await tokenPromise;

    expect(document.getElementById("st-tokens").innerText).toBe(
      "Token Economy unavailable: gateway unavailable",
    );
    expect(document.getElementById("st-cache").innerText).toBe(
      "Cache Hit Rate unavailable: gateway unavailable",
    );
  });

  it("keeps the HUD alive when clipboard fetch fails and marks diagnostics unavailable honestly", async () => {
    createTelemetryDom();
    const app = {
      telemetryLoadState: {
        continuity: "idle",
        memory: "idle",
        tokenEconomy: "idle",
        restartRecovery: "idle",
        browserSandbox: "idle",
        circadian: "idle",
        compaction: "idle",
      },
      gateway: {
        isConnected: true,
        request: vi.fn(async (method) => {
          switch (method) {
            case "clipboard.list":
              throw new Error("clipboard unavailable");
            case "checkpointer.list":
              return { checkpoints: {} };
            case "skills.list":
              return { telemetry: {}, skills: [] };
            case "skills.tools":
              return { tools: [] };
            case "sessions.list":
              return { sessions: [] };
            case "models.list":
              return { models: [] };
            case "models.authStatus":
              return { providers: [] };
            case "launcher.status":
              return null;
            case "radix.status":
              throw new Error("radix unavailable");
            case "cpu.fallback.status":
              throw new Error("cpu unavailable");
            default:
              return {};
          }
        }),
      },
      activeSessionKey: "agent:main:main",
      routeDecisionHistory: [],
      skillTelemetry: null,
      promptEconomyTelemetry: null,
      modelTelemetry: null,
      modelChoiceGuidance: null,
      launchSupportTelemetry: null,
      describeModelTelemetry: () => "",
      describeModelChoiceGuidance: () => "",
      describeLaunchSupportTelemetry: () => "",
      describePromptEconomyTelemetry: () => "",
      describeSkillTelemetry: () => "",
      describeLatestRouteDecision: () => "",
      renderContinuityShellSurface: vi.fn(),
      formatContinuityLabel: (value) => String(value).replaceAll("_", " "),
      escapeHtml: AetherApp.prototype.escapeHtml,
    };

    await AetherApp.prototype.refreshHudData.call(app);

    const panelText = document.getElementById("hud-panel").textContent;
    expect(panelText).toContain("Sovereign Clipboard");
    expect(panelText).toContain("Sovereign Clipboard unavailable: clipboard unavailable");
    expect(panelText).toContain("Resumable Workflows");
    expect(panelText).toContain("No suspended checkpoints found.");
    expect(panelText).toContain("Radix SGLang Sidecar");
    expect(panelText).toContain("UNAVAILABLE");
  });

  it("loads circadian state from the BIOS-native shell contract when a profile is active", async () => {
    createTelemetryDom();
    window.__TAURI__ = {
      core: {
        invoke: vi.fn(async (command, args) => {
          if (command === "load_bios_circadian_state" && args?.profileId === "claw") {
            return {
              current_phase: "dreaming",
              phase_label: "Dreaming",
            };
          }
          throw new Error(`Unexpected command: ${command}`);
        }),
      },
    };
    const app = {
      telemetryLoadState: { circadian: "idle" },
      activeBiosProfileId: "claw",
      gateway: {
        request: vi.fn(),
      },
      setStatusValue: AetherApp.prototype.setStatusValue,
    };

    await AetherApp.prototype.loadCircadianState.call(app);

    expect(document.getElementById("st-circadian").innerText).toBe("Dreaming");
    expect(app.gateway.request).not.toHaveBeenCalled();
  });

  it("loads glymphatic cleanup status from the BIOS-native shell contract when a profile is active", async () => {
    createTelemetryDom();
    window.__TAURI__ = {
      core: {
        invoke: vi.fn(async (command, args) => {
          if (command === "load_bios_glymphatic_status" && args?.profileId === "claw") {
            return {
              total_compactions: 3,
              average_reduction_ratio: 0.67,
              cleanup_needed: false,
            };
          }
          throw new Error(`Unexpected command: ${command}`);
        }),
      },
    };
    const app = {
      telemetryLoadState: { compaction: "idle" },
      activeBiosProfileId: "claw",
      gateway: {
        request: vi.fn(),
      },
      setStatusValue: AetherApp.prototype.setStatusValue,
    };

    await AetherApp.prototype.loadCompactionHealth.call(app);

    expect(document.getElementById("st-compaction").innerText).toBe("3 (67% avg)");
    expect(app.gateway.request).not.toHaveBeenCalled();
  });
});
