import { beforeEach, describe, expect, it, vi } from "vitest";
import { AetherApp } from "./app.js";

function createBootstrapDom() {
  document.body.innerHTML = `
    <div id="connect-overlay"><p id="connect-status"></p></div>
  `;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("AetherApp bootstrap actions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
    window.__TAURI__ = {
      core: {
        invoke: vi.fn(async (command) => {
          if (command === "append_debug_log") {
            return null;
          }
          if (command === "bios_shell_contract") {
            return {
              runtime: {
                route_ready: true,
              },
            };
          }
          if (command === "probe_local_runtime") {
            return {
              provider: "ollama",
              reachable: true,
              resolved_model: "gemma4",
              endpoint: "http://127.0.0.1:11434/v1/chat/completions",
              detail: "Ollama is reachable.",
            };
          }
          throw new Error(`Unexpected command: ${command}`);
        }),
      },
    };
  });

  it("shows bootstrap step messaging and finishes with a ready status bar", async () => {
    createBootstrapDom();
    let releaseHistory;
    const app = {
      agentName: "BIOS AI",
      loadSessionHistory: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            releaseHistory = resolve;
          }),
      ),
      loadSessionMission: vi.fn().mockResolvedValue(undefined),
      refreshForgeArenaFeed: vi.fn().mockResolvedValue(undefined),
      loadOnboardingState: vi.fn().mockResolvedValue(undefined),
      tickBiosBrainstem: vi.fn().mockResolvedValue(undefined),
      loadBiosRuntimeStatus: vi.fn().mockResolvedValue(undefined),
      loadDebugLog: vi.fn().mockResolvedValue(undefined),
      loadContinuityHealth: vi.fn().mockResolvedValue(undefined),
      loadMemorySurface: vi.fn().mockResolvedValue(undefined),
      loadTokenEconomy: vi.fn().mockResolvedValue(undefined),
      loadRestartRecovery: vi.fn().mockResolvedValue(undefined),
      loadBrowserSandboxStatus: vi.fn().mockResolvedValue(undefined),
      loadCircadianState: vi.fn().mockResolvedValue(undefined),
      loadCompactionHealth: vi.fn().mockResolvedValue(undefined),
      setConnectOverlayMessage: AetherApp.prototype.setConnectOverlayMessage,
      showConnectionStatusBar: AetherApp.prototype.showConnectionStatusBar,
      hideConnectionStatusBar: AetherApp.prototype.hideConnectionStatusBar,
    };

    const bootstrapPromise = AetherApp.prototype.runInitialShellHydration.call(app);
    await flushMicrotasks();

    expect(document.getElementById("connect-status").innerText).toBe(
      "Loading conversation history...",
    );

    releaseHistory();
    await bootstrapPromise;

    expect(app.tickBiosBrainstem).toHaveBeenCalledTimes(1);
    expect(app.loadBiosRuntimeStatus).toHaveBeenCalledWith({ tickBrainstem: false });
    expect(document.getElementById("connect-overlay").classList.contains("hidden")).toBe(true);
    expect(document.getElementById("connection-status-bar").innerText).toBe(
      "BIOS AI is connected. Core surfaces are ready.",
    );
    expect(document.getElementById("connection-status-bar").getAttribute("role")).toBe("status");
    expect(document.getElementById("connection-status-bar").dataset.tone).toBe("success");
  });

  it("records the reconnect state without visible layout chrome", () => {
    document.body.innerHTML = "";
    const app = {
      showConnectionStatusBar: AetherApp.prototype.showConnectionStatusBar,
    };

    app.showConnectionStatusBar(
      "BIOS AI is keeping local work available while online services reconnect.",
      "warning",
    );

    const bar = document.getElementById("connection-status-bar");
    expect(bar.innerText).toBe(
      "BIOS AI is keeping local work available while online services reconnect.",
    );
    expect(bar.getAttribute("role")).toBe("status");
    expect(bar.getAttribute("aria-live")).toBe("polite");
    expect(bar.getAttribute("aria-label")).toBe(
      "BIOS AI is keeping local work available while online services reconnect.",
    );
    expect(bar.dataset.tone).toBe("warning");
    expect(bar.style.left).toBe("");
    expect(bar.style.width).toBe("1px");
    expect(bar.style.height).toBe("1px");
    expect(bar.style.opacity).toBe("0");
    expect(bar.style.pointerEvents).toBe("none");
    expect(bar.title).toBe(
      "BIOS AI keeps local work available while online services reconnect.",
    );
  });

  it("shows reconnect pending and success messages during background reconnect", async () => {
    const app = {
      agentName: "BIOS AI",
      gateway: {
        connect: vi.fn().mockResolvedValue(undefined),
      },
      showConnectionStatusBar: vi.fn(),
      hideConnectionStatusBar: vi.fn(),
      _reconnectTimer: null,
    };

    AetherApp.prototype.scheduleBackgroundReconnect.call(app);
    await vi.advanceTimersByTimeAsync(10000);

    expect(app.showConnectionStatusBar).toHaveBeenCalledWith(
      "BIOS AI is keeping local work available while online services reconnect.",
      "warning",
    );
    expect(app.showConnectionStatusBar).toHaveBeenCalledWith(
      "BIOS AI reconnected. Live surfaces are current again.",
      "success",
    );
  });

  it("keeps reconnect messaging human-friendly when the gateway throws a raw event", async () => {
    const app = {
      agentName: "BIOS AI",
      gateway: {
        connect: vi.fn().mockRejectedValue(new Event("error")),
      },
      showConnectionStatusBar: vi.fn(),
      hideConnectionStatusBar: vi.fn(),
      _reconnectTimer: null,
    };

    AetherApp.prototype.scheduleBackgroundReconnect.call(app);
    await vi.advanceTimersByTimeAsync(10000);

    expect(app.showConnectionStatusBar).toHaveBeenCalledWith(
      "BIOS AI is keeping local work available while online services reconnect.",
      "warning",
    );
    expect(app.showConnectionStatusBar).toHaveBeenCalledWith(
      "Local work stays available while online services reconnect.",
      "warning",
    );
  });

  it("clears legacy saved onboarding when no BIOS profiles exist and returns to onboarding", async () => {
    createBootstrapDom();
    localStorage.setItem(
      "bios-ai-onboarding",
      JSON.stringify({
        completed: true,
        agentName: "Claw",
        modelPref: "local",
        preferredLocalBackend: "ollama",
      }),
    );

    const app = {
      agentName: "BIOS AI",
      gateway: {
        isConnected: false,
        connect: vi.fn().mockRejectedValue(new Error("offline")),
      },
      bindDomEvents: vi.fn(),
      setupGatewayListeners: vi.fn(),
      setConnectOverlayMessage: AetherApp.prototype.setConnectOverlayMessage,
      updateAgentNameDOM: vi.fn(),
      syncSavedOnboardingSnapshot: vi.fn(),
      clearSavedOnboardingSnapshot: AetherApp.prototype.clearSavedOnboardingSnapshot,
      getActiveBiosProfileId: AetherApp.prototype.getActiveBiosProfileId,
      showOfflineWelcome: vi.fn(),
      showProfilePicker: vi.fn(),
      showConnectionStatusBar: vi.fn(),
      scheduleBackgroundReconnect: vi.fn(),
      hasCalibratedAgentName: false,
      loadBiosProfiles: vi.fn().mockResolvedValue([]),
      activeBiosProfileId: null,
    };

    await AetherApp.prototype.init.call(app);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(300);

    expect(app.hasCalibratedAgentName).toBe(false);
    expect(localStorage.getItem("bios-ai-onboarding")).toBeNull();
    expect(localStorage.getItem("bios-ai-active-profile")).toBeNull();
    expect(app.showOfflineWelcome).toHaveBeenCalled();
    expect(app.syncSavedOnboardingSnapshot).not.toHaveBeenCalled();
  });

  it("does not skip onboarding when saved local worker setup is marked complete but no worker is installed", async () => {
    createBootstrapDom();
    localStorage.setItem(
      "bios-ai-onboarding",
      JSON.stringify({
        completed: true,
        agentName: "Claw",
        modelPref: "local",
        localWorkerModelVariant: "gemma-3-4b",
        localWorkerDownloadStatus: "completed",
      }),
    );

    window.__TAURI__.core.invoke.mockImplementation(async (command) => {
      if (command === "append_debug_log") {
        return null;
      }
      if (command === "bios_shell_contract") {
        return {
          runtime: {
            route_ready: false,
          },
        };
      }
      if (command === "worker_assets_status") {
        return {
          installed_models: [],
          bundled_sidecar_available: true,
          bundled_sidecar_path: "C:/bios/resources/bin/llama-server.exe",
          selected_model: null,
          models_dir: "C:/Users/test/.bios-ai/models",
          download: {
            state: "idle",
            variant: null,
            file_name: null,
            downloaded_bytes: 0,
            total_bytes: null,
            progress_percent: null,
            target_path: null,
            error: null,
          },
        };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const app = {
      agentName: "BIOS AI",
      gateway: {
        isConnected: false,
        connect: vi.fn().mockRejectedValue(new Error("offline")),
      },
      bindDomEvents: vi.fn(),
      setupGatewayListeners: vi.fn(),
      setConnectOverlayMessage: AetherApp.prototype.setConnectOverlayMessage,
      updateAgentNameDOM: vi.fn(),
      syncSavedOnboardingSnapshot: vi.fn(),
      clearSavedOnboardingSnapshot: AetherApp.prototype.clearSavedOnboardingSnapshot,
      getActiveBiosProfileId: AetherApp.prototype.getActiveBiosProfileId,
      showOfflineWelcome: vi.fn(),
      showProfilePicker: vi.fn(),
      showConnectionStatusBar: vi.fn(),
      scheduleBackgroundReconnect: vi.fn(),
      hasCalibratedAgentName: false,
      loadBiosProfiles: vi.fn().mockResolvedValue([]),
      activeBiosProfileId: null,
    };

    await AetherApp.prototype.init.call(app);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(300);

    expect(app.agentName).toBe("BIOS AI");
    expect(app.hasCalibratedAgentName).toBe(false);
    expect(app.syncSavedOnboardingSnapshot).not.toHaveBeenCalled();
    expect(app.showOfflineWelcome).toHaveBeenCalled();
  });

  it("shows the profile picker instead of rerunning onboarding when BIOS profiles already exist", async () => {
    createBootstrapDom();

    const app = {
      agentName: "BIOS AI",
      gateway: {
        isConnected: false,
        connect: vi.fn().mockRejectedValue(new Error("offline")),
      },
      bindDomEvents: vi.fn(),
      setupGatewayListeners: vi.fn(),
      setConnectOverlayMessage: AetherApp.prototype.setConnectOverlayMessage,
      updateAgentNameDOM: vi.fn(),
      syncSavedOnboardingSnapshot: vi.fn(),
      clearSavedOnboardingSnapshot: AetherApp.prototype.clearSavedOnboardingSnapshot,
      getActiveBiosProfileId: AetherApp.prototype.getActiveBiosProfileId,
      showOfflineWelcome: vi.fn(),
      showProfilePicker: vi.fn(),
      showConnectionStatusBar: vi.fn(),
      scheduleBackgroundReconnect: vi.fn(),
      hasCalibratedAgentName: false,
      activeBiosProfileId: "claw",
      loadBiosProfiles: vi.fn().mockResolvedValue([
        { id: "claw", display_name: "Claw", completed: true },
        { id: "forge", display_name: "Forge", completed: false },
      ]),
    };

    await AetherApp.prototype.init.call(app);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(300);

    expect(app.showProfilePicker).toHaveBeenCalled();
    expect(app.showOfflineWelcome).not.toHaveBeenCalled();
  });

  it("shows the profile picker on connected startup before full shell hydration when BIOS profiles already exist", async () => {
    const gatewayHandlers = new Map();
    const app = {
      gateway: {
        on: vi.fn((event, handler) => {
          gatewayHandlers.set(event, handler);
        }),
        request: vi.fn(async (event) => {
          if (event === "user.profile.get") {
            return { profile: "Agent name: BIOS AI" };
          }
          return {};
        }),
      },
      parseAgentName: vi.fn(() => "BIOS AI"),
      promptForAgentName: vi.fn(),
      hideConnectionStatusBar: vi.fn(),
      subtitles: { update: vi.fn() },
      orb: { setState: vi.fn() },
      renderSessionTabs: vi.fn(),
      loadBiosProfiles: vi
        .fn()
        .mockResolvedValue([{ id: "claw", display_name: "Claw", completed: true }]),
      showProfilePicker: vi.fn(),
      runInitialShellHydration: vi.fn(),
      refreshHudData: vi.fn(),
      updateAgentNameDOM: vi.fn(),
      pendingNewBiosProfile: false,
      connectTimeout: null,
      disconnectTimeout: null,
      agentName: "BIOS AI",
    };

    AetherApp.prototype.setupGatewayListeners.call(app);
    await gatewayHandlers.get("connect")?.({});

    expect(app.loadBiosProfiles).toHaveBeenCalled();
    expect(app.showProfilePicker).toHaveBeenCalled();
    expect(app.runInitialShellHydration).not.toHaveBeenCalled();
  });
});
