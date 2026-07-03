import { beforeEach, describe, expect, it, vi } from "vitest";
import { AetherApp } from "./app.js";
import { BIOS_ACTIVE_PROFILE_KEY, biosProfileSnapshotKey } from "./bios-runtime.js";
import { renderProfileSettingsSurface } from "./boss-profiles/profile-settings.js";

function createSettingsDom() {
  document.body.innerHTML = `
    <div id="settings-active-profile"></div>
    <div id="settings-active-profile-safety"></div>
    <div id="settings-runtime-owner"></div>
    <div id="settings-runtime-engine"></div>
    <div id="settings-runtime-strategy"></div>
    <div id="settings-overview-title"></div>
    <div id="settings-overview-copy"></div>
    <div id="settings-profile-list"></div>
    <div id="settings-profile-status"></div>
    <div id="settings-profile-danger-copy"></div>
    <input id="settings-profile-rename" />
    <button id="settings-rename-profile" type="button"></button>
    <button id="settings-delete-profile" type="button"></button>
    <button id="settings-create-profile" type="button"></button>
    <button id="settings-show-profile-picker" type="button"></button>
    <button id="settings-rerun-onboarding" type="button"></button>
    <div id="settings-posture"></div>
    <div id="settings-safety-posture"></div>
    <select id="settings-posture-select">
      <option value="not_allowed">Ask me first</option>
      <option value="allowed">Broad authority</option>
    </select>
    <div id="settings-execution-mode"></div>
    <div id="settings-sandbox-backend"></div>
    <div id="settings-tool-creation"></div>
    <div id="settings-network-posture"></div>
    <div id="settings-host-access"></div>
    <div id="settings-promotion-policy"></div>
    <div id="settings-safety-controls-status"></div>
    <button id="settings-save-safety-controls" type="button"></button>
    <div id="settings-boxed-lane-queue"></div>
    <div id="settings-promotion-record"></div>
    <div id="settings-boxed-lane-events"></div>
    <div id="settings-route-mode"></div>
    <select id="settings-route-mode-select">
      <option value="commercial">Cloud BOSS</option>
      <option value="local">Local only</option>
      <option value="hybrid">Hybrid</option>
    </select>
    <div id="settings-local-worker"></div>
    <select id="settings-local-backend-select">
      <option value="">No local lane selected</option>
      <option value="bios-managed">BIOS AI managed runtime</option>
      <option value="lmstudio">LM Studio</option>
      <option value="ollama">Ollama</option>
    </select>
    <select id="settings-local-worker-select">
      <option value="">No managed local model selected</option>
    </select>
    <select id="settings-medium-worker-select">
      <option value="">BIOS AI will auto-pick the medium worker</option>
    </select>
    <select id="settings-small-worker-select">
      <option value="">BIOS AI will auto-pick the small worker</option>
    </select>
    <div id="settings-local-worker-fit-note"></div>
    <div id="settings-local-worker-inventory"></div>
    <button id="settings-install-local-worker" type="button"></button>
    <button id="settings-install-all-local-workers" type="button"></button>
    <input id="settings-local-worker-custom-path" />
    <button id="settings-register-local-worker-path" type="button"></button>
    <div id="settings-telegram-connector-status"></div>
    <select id="settings-telegram-enabled-select">
      <option value="disabled">Disabled</option>
      <option value="enabled">Enabled</option>
    </select>
    <input id="settings-telegram-target-input" />
    <div id="settings-telegram-allowed-actions"></div>
    <div id="settings-telegram-connector-note"></div>
    <button id="settings-save-telegram-connector" type="button"></button>
    <div id="settings-route-readiness"></div>
    <div id="settings-runtime-note"></div>
    <div id="settings-runtime-controls-status"></div>
    <button id="settings-save-runtime-controls" type="button">Save settings</button>
    <div id="settings-local-capability-summary"></div>
    <div id="settings-local-capability-safe-read"></div>
    <div id="settings-local-capability-approval"></div>
    <div id="settings-local-capability-boxed"></div>
    <div id="settings-local-capability-connectors"></div>
    <div id="settings-local-capability-truth-rule"></div>
    <div id="settings-model-governance-last"></div>
    <div id="settings-model-governance-history"></div>
    <div id="settings-boxed-lane-queue-list"></div>
    <div id="settings-recovery-status"></div>
    <div id="settings-diagnostics-headline"></div>
    <div id="settings-diagnostics-summary"></div>
    <div id="settings-diagnostics-issues"></div>
    <div id="settings-agent-name"></div>
    <select id="settings-provider-select"></select>
    <input id="settings-model-input" />
    <select id="settings-new-provider">
      <option value="openai">openai</option>
      <option value="anthropic">anthropic</option>
    </select>
    <input id="settings-new-key" />
    <button id="btn-add-key" type="button">Add key</button>
    <div id="settings-provider-status"></div>
    <div id="st-agent-state"></div>
    <div id="st-gateway"></div>
    <div id="st-boss-profile"></div>
    <div id="st-safety-posture"></div>
    <div id="st-sandbox-backend"></div>
    <div id="st-model"></div>
    <div id="st-tokens"></div>
    <div id="st-cache"></div>
    <div id="st-compaction"></div>
    <div id="st-circadian"></div>
    <div id="st-workers"></div>
    <div id="st-forge"></div>
    <div id="rail-boss-name"></div>
    <div id="rail-boss-route"></div>
    <div id="rail-boss-worker"></div>
    <div id="viewport-idle"></div>
    <div id="viewport-idle-kicker"></div>
    <div id="viewport-idle-title"></div>
    <div id="viewport-idle-profile"></div>
    <div id="viewport-idle-route"></div>
    <div id="viewport-idle-safety"></div>
    <div id="viewport-idle-authority"></div>
    <div id="viewport-idle-note"></div>
    <div id="viewport-idle-readiness"></div>
    <div id="viewport-idle-worker"></div>
    <div id="viewport-idle-next-step"></div>
    <div id="viewport-idle-support"></div>
    <div id="viewport-idle-body"></div>
    <div id="viewport-idle-host-policy"></div>
    <div id="viewport-body-posture"></div>
    <div id="viewport-app-title"></div>
    <div id="chat-stream"></div>
  `;
}

function createApprovalDom() {
  document.body.innerHTML = `<div id="chat-outline-sidebar"></div>`;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("AetherApp shell actions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    window.__TAURI__ = {
      core: {
        invoke: vi.fn(),
      },
    };
  });

  it("stores new BOSS onboarding snapshots under the native profile id returned by save", async () => {
    const snapshot = {
      agentName: "Claw",
      completed: true,
      modelPref: "local",
      localRuntime: "bios-managed",
      selectedLocalWorkerModel: "qwen-3-8b",
    };
    const app = {
      activeBiosProfileId: null,
      agentName: "Claw",
      saveSavedOnboardingSnapshot: AetherApp.prototype.saveSavedOnboardingSnapshot,
      getActiveBiosProfileId: AetherApp.prototype.getActiveBiosProfileId,
      updateAgentNameDOM: vi.fn(),
      loadBiosProfiles: vi.fn().mockResolvedValue([]),
      loadForgeArenaProfile: vi.fn().mockResolvedValue(null),
    };

    window.__TAURI__.core.invoke.mockImplementation(async (command) => {
      if (command === "save_bios_profile") {
        return {
          profile: {
            id: "claw",
            display_name: "Claw",
            completed: true,
          },
        };
      }
      if (command === "record_bios_proof_event") {
        return {
          record_hash: "proof-hash",
        };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const detail = await AetherApp.prototype.saveBiosProfileSnapshot.call(
      app,
      snapshot,
      null,
      true,
    );

    expect(detail.profile.id).toBe("claw");
    expect(app.activeBiosProfileId).toBe("claw");
    expect(localStorage.getItem(BIOS_ACTIVE_PROFILE_KEY)).toBe("claw");
    expect(JSON.parse(localStorage.getItem(biosProfileSnapshotKey("claw")))).toEqual(snapshot);
    expect(localStorage.getItem(biosProfileSnapshotKey("null"))).toBeNull();
    expect(localStorage.getItem(biosProfileSnapshotKey("undefined"))).toBeNull();
    expect(window.__TAURI__.core.invoke).toHaveBeenCalledWith("record_bios_proof_event", {
      input: expect.objectContaining({
        profile_id: "claw",
        event_type: "boss_profile_created",
        source: "bios_profile.save",
      }),
    });
  });

  it("keeps visible activity labels aligned with active and background work", () => {
    document.body.innerHTML = `
      <div id="activity-label"></div>
      <div id="tasks-activity-label"></div>
      <div id="viewport-status-text"></div>
    `;
    const app = {
      activeMission: null,
      runInProgress: true,
      currentRunStatus: "",
      pendingBackgroundStatus: "",
      liveToolStatuses: new Map(),
      normalizeStatusText: AetherApp.prototype.normalizeStatusText,
      shortenStatus: AetherApp.prototype.shortenStatus,
      describeActivitySnapshot: AetherApp.prototype.describeActivitySnapshot,
      renderActivityLabels: AetherApp.prototype.renderActivityLabels,
      setHeroStatus: AetherApp.prototype.setHeroStatus,
    };

    AetherApp.prototype.setHeroStatus.call(app, "Working on: prepare package proof");

    expect(document.getElementById("activity-label").innerText).toBe("WORKING");
    expect(document.getElementById("tasks-activity-label").innerText).toBe(
      "Working on: prepare package proof",
    );
    expect(document.getElementById("activity-label").title).toBe(
      "Working on: prepare package proof",
    );

    app.runInProgress = false;
    app.pendingBackgroundStatus = "Waiting on background command: pnpm build";
    AetherApp.prototype.renderActivityLabels.call(app);

    expect(document.getElementById("activity-label").innerText).toBe("BACKGROUND");
    expect(document.getElementById("tasks-activity-label").innerText).toBe(
      "Waiting on background command: pnpm build",
    );
  });

  it("hydrates profile settings when the Settings rail surface is opened", () => {
    document.body.innerHTML = `
      <div id="aether-root"></div>
      <div class="rail-page-group" data-page="home">
        <button class="rail-btn" data-surface="chat"></button>
        <button class="rail-btn" data-surface="settings"></button>
      </div>
      <section class="ctx-surface" data-surface="chat"></section>
      <section class="ctx-surface" data-surface="settings"></section>
    `;
    const app = {
      activePage: "home",
      activeShellSurface: "chat",
      loadBiosRuntimeStatus: vi.fn().mockResolvedValue(null),
      renderProfileSettings: vi.fn(),
    };

    AetherApp.prototype.setupBiosShellSeed.call(app);
    document.querySelector('[data-surface="settings"]').click();

    expect(app.renderProfileSettings).toHaveBeenCalled();
    expect(app.loadBiosRuntimeStatus).toHaveBeenCalled();
  });

  it("shows pending and success feedback while switching providers in Settings", async () => {
    createSettingsDom();
    const invoke = window.__TAURI__.core.invoke;
    invoke.mockResolvedValueOnce({
      active_provider: "openai",
      active_model: "gpt-5.4",
      keys: [
        { provider: "openai", key: "sk-openai", label: "OpenAI", source: "import" },
        { provider: "anthropic", key: "sk-anthropic", label: "Anthropic", source: "import" },
      ],
      conversation_history: [],
    });

    let releaseSave;
    invoke.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseSave = resolve;
        }),
    );

    const app = {
      activeBiosProfileId: "claw",
      agentName: "Claw",
      _conversationHistory: ["existing thread"],
      initSettingsProviderPanel: vi.fn(),
      loadBiosProfileDetail: vi.fn().mockResolvedValue({
        profile: {
          display_name: "Claw",
        },
        onboarding: {
          completed: true,
          agent_name: "Claw",
          model_pref: "commercial",
          preferred_local_backend: null,
          api_keys: [],
        },
      }),
      saveBiosProfileSnapshot: vi.fn().mockResolvedValue(null),
      syncSavedOnboardingSnapshot: vi.fn(),
      loadBiosRuntimeStatus: vi.fn().mockResolvedValue(null),
      renderProfileSettings: vi.fn(),
    };

    await AetherApp.prototype.initSettingsProviderPanel.call(app);

    const providerSelect = document.getElementById("settings-provider-select");
    const modelInput = document.getElementById("settings-model-input");
    const addKeyButton = document.getElementById("btn-add-key");
    const status = document.getElementById("settings-provider-status");

    expect(status.textContent).toBe("Active: openai");

    providerSelect.value = "anthropic";
    providerSelect.dispatchEvent(new Event("change"));
    await flushMicrotasks();

    expect(status.textContent).toBe("Switching BIOS AI to anthropic...");
    expect(providerSelect.disabled).toBe(true);
    expect(modelInput.disabled).toBe(true);
    expect(addKeyButton.disabled).toBe(true);

    releaseSave();
    await vi.waitFor(() => {
      expect(status.textContent).toBe("Switched to anthropic. New messages will use it.");
    });
    expect(providerSelect.disabled).toBe(false);
    expect(modelInput.disabled).toBe(false);
    expect(addKeyButton.disabled).toBe(false);
    expect(app._conversationHistory).toEqual([]);
  });

  it("shows pending and refresh feedback while adding a provider key", async () => {
    createSettingsDom();
    const invoke = window.__TAURI__.core.invoke;
    invoke.mockResolvedValueOnce({
      active_provider: "",
      active_model: "",
      keys: [],
      conversation_history: [],
    });
    invoke.mockResolvedValueOnce(null);

    const refreshStub = vi.fn();
    const app = {
      activeBiosProfileId: "claw",
      agentName: "Claw",
      _conversationHistory: [],
      initSettingsProviderPanel: refreshStub,
      loadBiosProfileDetail: vi.fn().mockResolvedValue({
        profile: {
          display_name: "Claw",
        },
        onboarding: {
          completed: true,
          agent_name: "Claw",
          model_pref: "commercial",
          preferred_local_backend: null,
          api_keys: [],
        },
      }),
      saveBiosProfileSnapshot: vi.fn().mockResolvedValue(null),
      syncSavedOnboardingSnapshot: vi.fn(),
      loadBiosRuntimeStatus: vi.fn().mockResolvedValue(null),
      renderProfileSettings: vi.fn(),
    };

    await AetherApp.prototype.initSettingsProviderPanel.call(app);

    const newProvider = document.getElementById("settings-new-provider");
    const newKey = document.getElementById("settings-new-key");
    const addKeyButton = document.getElementById("btn-add-key");
    const status = document.getElementById("settings-provider-status");

    newProvider.value = "openai";
    newKey.value = "sk-test-1234567890abcdef";
    addKeyButton.click();
    await vi.waitFor(() => {
      expect(status.textContent).toBe("Added openai key and made it active.");
    });
    expect(newKey.value).toBe("");
    expect(refreshStub).toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith("save_provider_config", {
      profileId: "claw",
      config: expect.objectContaining({
        active_provider: "openai",
        keys: [
          expect.objectContaining({
            provider: "openai",
            source: "manual",
          }),
        ],
      }),
    });
    expect(invoke).toHaveBeenCalledWith("record_bios_proof_event", {
      input: expect.objectContaining({
        profile_id: "claw",
        event_type: "settings_changed",
        source: "settings.provider_config",
      }),
    });
  });

  it("keeps the local route owner active while saving a preferred cloud provider for the profile", async () => {
    createSettingsDom();
    const invoke = window.__TAURI__.core.invoke;
    invoke.mockResolvedValue(null);

    const app = {
      activeBiosProfileId: "claw",
      agentName: "Claw",
      loadBiosProfileDetail: vi.fn().mockResolvedValue({
        profile: {
          display_name: "Claw",
        },
        onboarding: {
          completed: true,
          agent_name: "Claw",
          model_pref: "local",
          preferred_local_backend: "bios-managed",
          api_keys: [{ provider: "telegram", key: "tg-secret", source: "import" }],
        },
      }),
      saveBiosProfileSnapshot: vi.fn().mockResolvedValue(null),
      syncSavedOnboardingSnapshot: vi.fn(),
      loadBiosRuntimeStatus: vi.fn().mockResolvedValue(null),
      renderProfileSettings: vi.fn(),
    };

    const result = await AetherApp.prototype.saveBiosProfileProviderConfig.call(
      app,
      {
        active_provider: "openai",
        active_model: "gpt-5.5",
        keys: [{ provider: "openai", key: "sk-openai", source: "manual", label: "OpenAI" }],
        conversation_history: [],
      },
      { preferredCloudProvider: "openai" },
    );

    expect(result.active_provider).toBe("bios-managed");
    expect(result.active_model).toBe("");
    expect(invoke).toHaveBeenCalledWith("save_provider_config", {
      profileId: "claw",
      config: expect.objectContaining({
        active_provider: "bios-managed",
        active_model: "",
      }),
    });
    expect(app.saveBiosProfileSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredCloudProvider: "openai",
        apiKeys: expect.arrayContaining([
          expect.objectContaining({ provider: "telegram" }),
          expect.objectContaining({ provider: "openai", key: "sk-openai" }),
        ]),
      }),
      "claw",
      true,
    );
  });

  it("aligns provider config to the route owner when runtime settings switch back to local", async () => {
    createSettingsDom();
    const invoke = window.__TAURI__.core.invoke;
    invoke.mockImplementation(async (command) => {
      if (command === "save_provider_config") {
        return null;
      }
      if (command === "record_bios_proof_event") {
        return { record_hash: "proof-hash" };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const app = {
      activeBiosProfileId: "claw",
      agentName: "Claw",
      loadBiosProfileDetail: vi.fn().mockResolvedValue({
        profile: {
          display_name: "Claw",
        },
        onboarding: {
          completed: true,
          agent_name: "Claw",
          permission_mode: "not_allowed",
          model_pref: "hybrid",
          preferred_local_backend: "lmstudio",
          preferred_cloud_provider: "openai",
          api_keys: [{ provider: "openai", key: "sk-openai", source: "manual" }],
        },
      }),
      loadWorkerModelCatalog: vi.fn().mockResolvedValue({ machine_profile: null, entries: [] }),
      saveBiosProfileSnapshot: vi.fn().mockResolvedValue(null),
      syncSavedOnboardingSnapshot: vi.fn(),
      loadBiosRuntimeStatus: vi.fn().mockResolvedValue(null),
      renderProfileSettings: vi.fn(),
      loadBiosProviderConfig: vi.fn().mockResolvedValue({
        active_provider: "openai",
        active_model: "gpt-5.5",
        keys: [{ provider: "openai", key: "sk-openai", source: "manual" }],
        conversation_history: [],
      }),
    };

    await AetherApp.prototype.saveBiosProfileRuntimePreferences.call(app, {
      modelPref: "local",
      preferredLocalBackend: "lmstudio",
    });

    expect(invoke).toHaveBeenCalledWith("save_provider_config", {
      profileId: "claw",
      config: expect.objectContaining({
        active_provider: "lmstudio",
        active_model: "",
      }),
    });
  });

  it("filters uninstalled support workers from native roster saves and refreshes profile truth", async () => {
    createSettingsDom();
    const invoke = window.__TAURI__.core.invoke;
    invoke.mockImplementation(async (command, payload) => {
      if (command === "save_worker_runtime_selection") {
        expect(payload).toEqual({
          variant: "qwen-3-8b",
          profileId: "claw",
        });
        return {
          variant: "qwen-3-8b",
          path: "E:/BIOS AI/models/Qwen3-8B-Q4_K_M.gguf",
        };
      }
      if (command === "save_worker_runtime_roster") {
        expect(payload).toEqual({
          profileId: "claw",
          assignments: [
            {
              role: "boss_brain",
              variant: "qwen-3-8b",
            },
          ],
        });
        return [];
      }
      if (command === "save_provider_config") {
        return null;
      }
      if (command === "record_bios_proof_event") {
        return { record_hash: "proof-hash" };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const saveSavedOnboardingSnapshot = vi.fn();
    const app = {
      activeBiosProfileId: "claw",
      agentName: "Claw",
      loadBiosProfileDetail: vi
        .fn()
        .mockResolvedValueOnce({
          profile: {
            display_name: "Claw",
          },
          onboarding: {
            completed: true,
            agent_name: "Claw",
            model_pref: "local",
            preferred_local_backend: "bios-managed",
            local_worker_model_variant: "gemma-3-4b",
          },
        })
        .mockResolvedValueOnce({
          profile: {
            display_name: "Claw",
          },
          onboarding: {
            completed: true,
            agent_name: "Claw",
            model_pref: "local",
            preferred_local_backend: "bios-managed",
            local_worker_model_variant: "qwen-3-8b",
            local_worker_model_path: "E:/BIOS AI/models/Qwen3-8B-Q4_K_M.gguf",
          },
        }),
      loadWorkerModelCatalog: vi.fn().mockResolvedValue({
        machine_profile: null,
        entries: [
          {
            variant: "qwen-3-8b",
            installed: true,
          },
          {
            variant: "qwen-3-14b",
            installed: false,
          },
        ],
      }),
      saveBiosProfileSnapshot: vi.fn().mockResolvedValue(null),
      saveSavedOnboardingSnapshot,
      syncSavedOnboardingSnapshot: vi.fn(),
      loadBiosRuntimeStatus: vi.fn().mockResolvedValue(null),
      renderProfileSettings: vi.fn(),
      loadBiosProviderConfig: vi.fn().mockResolvedValue({
        active_provider: "bios-managed",
        active_model: "",
        keys: [],
        conversation_history: [],
      }),
    };

    await AetherApp.prototype.saveBiosProfileRuntimePreferences.call(app, {
      modelPref: "local",
      preferredLocalBackend: "bios-managed",
      localWorkerModelVariant: "qwen-3-8b",
      localWorkerModelPath: null,
      biosWorkerRoster: [
        {
          role: "boss_brain",
          variant: "qwen-3-8b",
          path: null,
        },
        {
          role: "medium_worker",
          variant: "qwen-3-14b",
          path: null,
        },
      ],
    });

    expect(invoke).toHaveBeenCalledWith("save_worker_runtime_roster", {
      profileId: "claw",
      assignments: [
        {
          role: "boss_brain",
          variant: "qwen-3-8b",
        },
      ],
    });
    expect(saveSavedOnboardingSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        localWorkerModelVariant: "qwen-3-8b",
        localWorkerModelPath: "E:/BIOS AI/models/Qwen3-8B-Q4_K_M.gguf",
      }),
      "claw",
    );
  });

  it("renders BIOS profile runtime, posture, and local capability summaries into Settings", async () => {
    createSettingsDom();
    const app = {
      biosProfiles: [
        {
          id: "claw",
          display_name: "Claw",
          completed: true,
          model_pref: "local",
          safety_posture_label: "LXC-first hardened",
          sandbox_backend: "LXC",
          local_runtime_owner: "BIOS AI",
          local_runtime_engine: "llama.cpp",
          local_runtime_strategy: "BIOS-managed local runtime",
        },
      ],
      activeBiosProfileId: "claw",
      gateway: { isConnected: false },
      continuityHealth: null,
      biosDiagnostics: { debug_log_path: "C:/bios/debug.log", boxed_lane_ready: true },
      biosRuntimeStatus: {
        route_ready: true,
        worker_ready: true,
        boxed_lane_ready: true,
        route_status_label: "Local route ready",
        worker_status_label: "Managed worker ready",
        route_mode_label: "Local only",
        route_detail: "Local route is ready.",
        next_step: "Chat is unlocked.",
        preferred_local_backend: "bios-managed",
      },
      biosObservation: {
        body_state_label: "Private body standing by",
        host_interruption_policy: "User desktop interruption blocked by default",
        viewport_title: "BIOS private desktop",
        next_body_action:
          "Send work to BIOS AI; private desktop actions will appear in this viewport.",
      },
      updateAgentNameDOM: vi.fn(),
      escapeHtml: (value) => value,
      renderViewportIdleCompanion: AetherApp.prototype.renderViewportIdleCompanion,
      renderRailBossStatus: AetherApp.prototype.renderRailBossStatus,
      setStatusValue: AetherApp.prototype.setStatusValue,
      loadBiosLocalToolRegistry: vi.fn().mockResolvedValue({
        tools: [
          {
            name: "capability.inventory.read",
            label: "Read BIOS capability inventory",
            execution_class: "safe_local_read",
          },
          {
            name: "machine.inspect",
            label: "Inspect machine profile",
            execution_class: "safe_local_read",
          },
          {
            name: "runtime.model.select_managed",
            label: "Select BIOS managed model",
            execution_class: "approval_required_host_action",
          },
          {
            name: "profile.memory.append_note",
            label: "Append BIOS memory note",
            execution_class: "boxed_first_risky_action",
          },
        ],
      }),
      loadBiosLocalConnectorStatus: vi.fn().mockResolvedValue({
        profile_id: "claw",
        connectors: [
          {
            connector: "telegram",
            ready: true,
            enabled: true,
            allowed_actions: ["send_message"],
            label: "Telegram connector ready",
          },
        ],
      }),
      getSavedOnboardingSnapshot() {
        return {
          completed: true,
          agentName: "Claw",
          permissionMode: "ask",
          modelPref: "local",
          safetyPostureLabel: "LXC-first hardened",
          executionMode: "Sandbox-first",
          sandboxBackend: "LXC",
          toolCreationPolicy: "Build and test in sandbox first",
          networkPosture: "Prefer sandbox-only network for untrusted work",
          hostAccess: "Promotion required before host writes",
          promotionPolicy: "Approval and validation before host adoption",
          localRuntimeOwner: "BIOS AI",
          localRuntimeEngine: "llama.cpp",
          localRuntimeStrategy: "BIOS-managed local runtime",
          preferredLocalBackend: "bios-managed",
          localWorkerDownloadStatus: "completed",
          bossModelGovernance: {
            lastDecision: {
              action: "apply_roster_change",
              desiredRole: "medium_worker",
              targetVariant: "qwen-3-8b",
              rationale: "Mid-weight synthesis turn fits the medium worker.",
            },
            history: [
              {
                action: "apply_roster_change",
                desiredRole: "medium_worker",
                targetVariant: "qwen-3-8b",
                rationale: "Mid-weight synthesis turn fits the medium worker.",
              },
            ],
          },
          primaryKeyIndex: 0,
          apiKeys: [],
        };
      },
    };

    AetherApp.prototype.renderProfileSettings.call(app);
    AetherApp.prototype.syncSavedOnboardingSnapshot.call(app);

    expect(document.getElementById("settings-active-profile").innerText).toBe("Claw");
    expect(document.getElementById("settings-active-profile-safety").innerText).toBe(
      "LXC-first hardened",
    );
    expect(document.getElementById("settings-runtime-owner").innerText).toBe("BIOS AI");
    expect(document.getElementById("settings-runtime-engine").innerText).toBe("llama.cpp");
    expect(document.getElementById("settings-runtime-strategy").innerText).toBe(
      "BIOS-managed local runtime",
    );
    expect(document.getElementById("settings-diagnostics-headline").innerText).toBe(
      "Claw is ready",
    );
    expect(document.getElementById("settings-diagnostics-issues").innerText).toBe(
      "No active BIOS AI recovery issues.",
    );
    expect(document.getElementById("settings-route-mode").innerText).toBe("Local only");
    expect(document.getElementById("settings-local-worker").innerText).toBe("Managed worker ready");
    expect(document.getElementById("st-boss-profile").innerText).toBe("Claw");
    expect(document.getElementById("rail-boss-name").innerText).toBe("Claw");
    expect(document.getElementById("rail-boss-route").innerText).toBe("Local only");
    expect(document.getElementById("st-safety-posture").innerText).toBe("LXC-first hardened");
    expect(document.getElementById("st-sandbox-backend").innerText).toBe("LXC");
    expect(document.getElementById("settings-model-governance-last").innerText).toContain(
      "Applied worker roster change",
    );
    expect(document.getElementById("settings-model-governance-history").innerText).toContain(
      "Mid-weight synthesis turn fits the medium worker.",
    );
    expect(document.getElementById("viewport-idle-kicker").innerText).toBe("Offline shell");
    expect(document.getElementById("viewport-idle-title").innerText).toBe(
      "Local-first shell ready",
    );
    expect(document.getElementById("viewport-idle-readiness").innerText).toBe("Local route ready");
    expect(document.getElementById("viewport-idle-worker").innerText).toBe("Managed worker ready");
    expect(document.getElementById("viewport-idle-next-step").innerText).toBe("Chat is unlocked.");
    expect(document.getElementById("viewport-idle-support").innerText).toBe(
      "Gateway is offline. Diagnostics stay visible in Settings and Log.",
    );
    expect(document.getElementById("viewport-idle-body").innerText).toBe(
      "Body: Private body standing by",
    );
    expect(document.getElementById("viewport-idle-host-policy").innerText).toBe(
      "User desktop interruption blocked by default",
    );
    expect(document.getElementById("viewport-body-posture").innerText).toBe(
      "Body: Private body standing by",
    );
    expect(document.getElementById("viewport-app-title").innerText).toBe("BIOS private desktop");
    await vi.waitFor(() => {
      expect(document.getElementById("settings-local-capability-summary").innerText).toContain(
        "4 BIOS-owned local tool contract",
      );
    });
    expect(document.getElementById("settings-local-capability-safe-read").innerText).toBe(
      "2 safe-read action(s)",
    );
    expect(document.getElementById("settings-local-capability-approval").innerText).toBe(
      "1 approval-required host action(s)",
    );
    expect(document.getElementById("settings-local-capability-boxed").innerText).toBe(
      "1 boxed-first risky action(s)",
    );
    expect(document.getElementById("settings-local-capability-connectors").innerText).toBe(
      "1 connector ready",
    );
  });

  it("renames the active BIOS profile through Settings and keeps the profile active", async () => {
    createSettingsDom();
    const renameActiveBiosProfile = vi.fn().mockResolvedValue(null);
    const renderProfileSettings = vi.fn();
    const app = {
      biosProfiles: [
        {
          id: "claw",
          display_name: "Claw",
          completed: true,
        },
      ],
      activeBiosProfileId: "claw",
      escapeHtml: (value) => value,
      renameActiveBiosProfile,
      renderProfileSettings,
      gateway: { isConnected: false },
      showOfflineWelcome: vi.fn(),
      updateAgentNameDOM: vi.fn(),
    };

    AetherApp.prototype.renderProfileSettings.call(app);

    const renameInput = document.getElementById("settings-profile-rename");
    const renameButton = document.getElementById("settings-rename-profile");
    renameInput.value = "Forge Boss";
    renameButton.click();
    await flushMicrotasks();

    expect(renameActiveBiosProfile).toHaveBeenCalledWith("Forge Boss");
    expect(renderProfileSettings).toHaveBeenCalled();
  });

  it("saves editable runtime settings from the Settings surface", async () => {
    createSettingsDom();
    const saveBiosProfileRuntimePreferences = vi.fn().mockResolvedValue(null);
    const app = {
      biosProfiles: [
        {
          id: "claw",
          display_name: "Claw",
          completed: true,
        },
      ],
      activeBiosProfileId: "claw",
      gateway: { isConnected: false },
      biosRuntimeStatus: null,
      escapeHtml: (value) => value,
      getSavedOnboardingSnapshot() {
        return {
          completed: true,
          agentName: "Claw",
          permissionMode: "not_allowed",
          modelPref: "local",
          preferredLocalBackend: "bios-managed",
          localWorkerModelVariant: "gemma-3-4b",
        };
      },
      loadWorkerModelCatalog: vi.fn().mockResolvedValue({
        entries: [
          {
            variant: "gemma-3-4b",
            label: "Gemma 3 4B",
            managed: true,
            installed: true,
            enabled: true,
            role: "Balanced",
            summary: "Balanced local BOSS.",
            size_label: "~3.0 GB download",
          },
          {
            variant: "qwen-3-8b",
            label: "Qwen3 8B",
            managed: true,
            installed: false,
            enabled: true,
            role: "Reasoning",
            summary: "Stronger reasoning.",
            size_label: "~5.2 GB download",
          },
        ],
      }),
      saveBiosProfileRuntimePreferences,
      renameActiveBiosProfile: vi.fn(),
      beginFreshBiosProfileOnboarding: vi.fn(),
      deleteBiosProfile: vi.fn(),
    };

    AetherApp.prototype.renderProfileSettings.call(app);
    await flushMicrotasks();

    document.getElementById("settings-route-mode-select").value = "hybrid";
    document.getElementById("settings-local-backend-select").value = "lmstudio";
    document.getElementById("settings-save-runtime-controls").click();
    await flushMicrotasks();

    expect(saveBiosProfileRuntimePreferences).toHaveBeenCalledWith({
      modelPref: "hybrid",
      preferredLocalBackend: "lmstudio",
      localWorkerModelVariant: null,
      localWorkerModelPath: null,
      biosWorkerRoster: [],
    });
    expect(document.getElementById("settings-runtime-controls-status").innerText).toContain(
      "LM Studio",
    );
    expect(document.getElementById("settings-local-worker-fit-note").textContent).toContain(
      "external lane manages its own installed local models",
    );
  });

  it("blocks saving an uninstalled support worker from Settings with truthful feedback", async () => {
    createSettingsDom();
    const saveBiosProfileRuntimePreferences = vi.fn().mockResolvedValue(null);
    const app = {
      biosProfiles: [
        {
          id: "claw",
          display_name: "Claw",
          completed: true,
        },
      ],
      activeBiosProfileId: "claw",
      gateway: { isConnected: false },
      biosRuntimeStatus: null,
      escapeHtml: (value) => value,
      getSavedOnboardingSnapshot() {
        return {
          completed: true,
          agentName: "Claw",
          permissionMode: "not_allowed",
          modelPref: "local",
          preferredLocalBackend: "bios-managed",
          localWorkerModelVariant: "qwen-3-8b",
        };
      },
      loadWorkerModelCatalog: vi.fn().mockResolvedValue({
        entries: [
          {
            variant: "qwen-3-8b",
            label: "Qwen3 8B",
            family: "Qwen",
            managed: true,
            installed: true,
            enabled: true,
            download_supported: true,
            role: "Reasoning",
            summary: "Reasoning local BOSS.",
            size_label: "~5.2 GB download",
          },
          {
            variant: "qwen-3-14b",
            label: "Qwen3 14B",
            family: "Qwen",
            managed: true,
            installed: false,
            enabled: true,
            download_supported: true,
            role: "Deep reasoning",
            summary: "Deep reasoning local BOSS.",
            size_label: "~9.0 GB download",
          },
        ],
      }),
      saveBiosProfileRuntimePreferences,
      renameActiveBiosProfile: vi.fn(),
      beginFreshBiosProfileOnboarding: vi.fn(),
      deleteBiosProfile: vi.fn(),
    };

    AetherApp.prototype.renderProfileSettings.call(app);
    await flushMicrotasks();

    document.getElementById("settings-medium-worker-select").value = "qwen-3-14b";
    document.getElementById("settings-save-runtime-controls").click();
    await flushMicrotasks();

    expect(saveBiosProfileRuntimePreferences).not.toHaveBeenCalled();
    expect(document.getElementById("settings-runtime-controls-status").innerText).toContain(
      "selected medium worker is visible, but it is not installed yet",
    );
  });

  it("keeps edited BOSS model selections from snapping back during background Settings refresh", async () => {
    createSettingsDom();
    const app = {
      biosProfiles: [
        {
          id: "claw",
          display_name: "Claw",
          completed: true,
          model_pref: "local",
          local_runtime_owner: "BIOS AI",
          local_runtime_engine: "llama.cpp",
          local_runtime_strategy: "BIOS-managed local runtime",
        },
      ],
      activeBiosProfileId: "claw",
      gateway: { isConnected: false },
      continuityHealth: null,
      biosRuntimeStatus: {
        route_ready: true,
        worker_ready: true,
        route_mode_label: "Local only",
        route_status_label: "Local route ready",
        worker_status_label: "Managed worker ready",
        preferred_local_backend: "bios-managed",
      },
      updateAgentNameDOM: vi.fn(),
      escapeHtml: (value) => value,
      renderViewportIdleCompanion: AetherApp.prototype.renderViewportIdleCompanion,
      renderRailBossStatus: AetherApp.prototype.renderRailBossStatus,
      setStatusValue: AetherApp.prototype.setStatusValue,
      getSavedOnboardingSnapshot() {
        return {
          completed: true,
          agentName: "Claw",
          permissionMode: "not_allowed",
          modelPref: "local",
          preferredLocalBackend: "bios-managed",
          localWorkerModelVariant: "gemma-3-4b",
          localWorkerDownloadStatus: "installed",
          localRuntimeOwner: "BIOS AI",
          localRuntimeEngine: "llama.cpp",
          localRuntimeStrategy: "BIOS-managed local runtime",
        };
      },
      loadBiosLocalToolRegistry: vi.fn().mockResolvedValue({ tools: [] }),
      loadBiosLocalConnectorStatus: vi.fn().mockResolvedValue({ connectors: [] }),
      loadWorkerModelCatalog: vi.fn().mockResolvedValue({
        entries: [
          {
            variant: "gemma-3-4b",
            label: "Gemma 3 4B",
            family: "Gemma",
            managed: true,
            installed: true,
            enabled: true,
            download_supported: true,
            role: "Balanced",
            summary: "Balanced local BOSS.",
            size_label: "~3.0 GB download",
          },
          {
            variant: "qwen-3-8b",
            label: "Qwen3 8B",
            family: "Qwen",
            managed: true,
            installed: true,
            enabled: true,
            download_supported: true,
            role: "Reasoning",
            summary: "Reasoning local BOSS.",
            size_label: "~5.2 GB download",
          },
        ],
      }),
      saveBiosProfileRuntimePreferences: vi.fn(),
      renameActiveBiosProfile: vi.fn(),
      beginFreshBiosProfileOnboarding: vi.fn(),
      deleteBiosProfile: vi.fn(),
    };

    AetherApp.prototype.renderProfileSettings.call(app);
    await flushMicrotasks();

    const workerSelect = document.getElementById("settings-local-worker-select");
    const routeSelect = document.getElementById("settings-route-mode-select");
    const backendSelect = document.getElementById("settings-local-backend-select");
    routeSelect.value = "hybrid";
    routeSelect.dispatchEvent(new Event("change"));
    backendSelect.value = "lmstudio";
    backendSelect.dispatchEvent(new Event("change"));
    workerSelect.value = "qwen-3-8b";
    workerSelect.dispatchEvent(new Event("change"));

    AetherApp.prototype.syncSavedOnboardingSnapshot.call(app);

    expect(app._settingsRuntimeDraftDirty).toBe(true);
    expect(document.getElementById("settings-route-mode-select").value).toBe("hybrid");
    expect(document.getElementById("settings-local-backend-select").value).toBe("lmstudio");
    expect(document.getElementById("settings-local-worker-select").value).toBe("qwen-3-8b");
    expect(document.getElementById("settings-save-runtime-controls").textContent).toContain(
      "Save settings",
    );
    expect(document.getElementById("settings-runtime-controls-status").innerText).toContain(
      "Unsaved settings: click Save settings to apply.",
    );
  });

  it("installs an available BIOS-managed model directly from Settings", async () => {
    createSettingsDom();
    const saveBiosProfileRuntimePreferences = vi.fn().mockResolvedValue(null);
    const installManagedWorkerModel = vi.fn().mockResolvedValue({
      download: {
        state: "completed",
        variant: "qwen-3-14b",
      },
      assetsStatus: {
        installed_models: [
          {
            variant: "qwen-3-14b",
            path: "C:/Users/Nick/.bios-ai/models/Qwen3-14B-Q4_K_M.gguf",
          },
        ],
      },
    });
    const app = {
      biosProfiles: [
        {
          id: "claw",
          display_name: "Claw",
          completed: true,
        },
      ],
      activeBiosProfileId: "claw",
      gateway: { isConnected: false },
      biosRuntimeStatus: null,
      escapeHtml: (value) => value,
      getSavedOnboardingSnapshot() {
        return {
          completed: true,
          agentName: "Claw",
          permissionMode: "not_allowed",
          modelPref: "local",
          preferredLocalBackend: "bios-managed",
          localWorkerModelVariant: "",
        };
      },
      loadWorkerModelCatalog: vi
        .fn()
        .mockResolvedValueOnce({
          machine_profile: {
            logical_cores: 16,
            total_memory_gb: 32,
            gpu_vram_gb: 16,
            gpu_name: "RTX 4080",
          },
          recommended_local_variant: "qwen-3-14b",
          entries: [
            {
              variant: "gemma-3-4b",
              label: "Gemma 3 4B",
              family: "Gemma",
              managed: true,
              installed: true,
              enabled: true,
              download_supported: true,
              recommended_for_hybrid: true,
              role: "Balanced",
              summary: "Balanced medium worker.",
              size_label: "~3.0 GB download",
            },
            {
              variant: "qwen-3-14b",
              label: "Qwen3 14B",
              family: "Qwen",
              managed: true,
              installed: false,
              enabled: true,
              download_supported: true,
              recommended_for_local: true,
              role: "Deep reasoning",
              summary: "Deep reasoning local BOSS.",
              size_label: "~9.0 GB download",
            },
          ],
        })
        .mockResolvedValueOnce({
          machine_profile: {
            logical_cores: 16,
            total_memory_gb: 32,
            gpu_vram_gb: 16,
            gpu_name: "RTX 4080",
          },
          recommended_local_variant: "qwen-3-14b",
          entries: [
            {
              variant: "gemma-3-4b",
              label: "Gemma 3 4B",
              family: "Gemma",
              managed: true,
              installed: true,
              enabled: true,
              download_supported: true,
              recommended_for_hybrid: true,
              role: "Balanced",
              summary: "Balanced medium worker.",
              size_label: "~3.0 GB download",
            },
            {
              variant: "qwen-3-14b",
              label: "Qwen3 14B",
              family: "Qwen",
              managed: true,
              installed: true,
              enabled: true,
              download_supported: true,
              recommended_for_local: true,
              role: "Deep reasoning",
              summary: "Deep reasoning local BOSS.",
              size_label: "~9.0 GB download",
            },
          ],
        }),
      loadBiosProfileDetail: vi.fn().mockResolvedValue({
        onboarding: {
          local_worker_model_variant: "qwen-3-14b",
          model_pref: "local",
        },
      }),
      installManagedWorkerModel,
      saveBiosProfileRuntimePreferences,
      renameActiveBiosProfile: vi.fn(),
      beginFreshBiosProfileOnboarding: vi.fn(),
      deleteBiosProfile: vi.fn(),
    };

    AetherApp.prototype.renderProfileSettings.call(app);
    await flushMicrotasks();

    document.getElementById("settings-local-worker-select").value = "qwen-3-14b";
    document.getElementById("settings-medium-worker-select").value = "";
    document.getElementById("settings-small-worker-select").value = "";
    document.getElementById("settings-local-worker-select").dispatchEvent(new Event("change"));
    document.getElementById("settings-install-local-worker").click();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(installManagedWorkerModel).toHaveBeenCalledWith("qwen-3-14b", {
      onProgress: expect.any(Function),
    });
    expect(saveBiosProfileRuntimePreferences).toHaveBeenCalledWith({
      modelPref: "local",
      preferredLocalBackend: "bios-managed",
      localWorkerModelVariant: "qwen-3-14b",
      localWorkerModelPath: null,
      biosWorkerRoster: [
        {
          role: "boss_brain",
          variant: "qwen-3-14b",
          path: null,
        },
        {
          role: "medium_worker",
          variant: "gemma-3-4b",
          path: null,
        },
      ],
    });
    expect(document.getElementById("settings-runtime-controls-status").innerText).toContain(
      "installed and ready to become this BOSS profile's managed brain",
    );
  });

  it("downloads every listed missing BIOS-managed model from Settings", async () => {
    createSettingsDom();
    const installManagedWorkerModel = vi.fn().mockResolvedValue({
      download: {
        state: "completed",
      },
      assetsStatus: {
        installed_models: [],
      },
    });
    const app = {
      biosProfiles: [
        {
          id: "claw",
          display_name: "Claw",
          completed: true,
        },
      ],
      activeBiosProfileId: "claw",
      gateway: { isConnected: false },
      biosRuntimeStatus: null,
      escapeHtml: (value) => value,
      getSavedOnboardingSnapshot() {
        return {
          completed: true,
          agentName: "Claw",
          permissionMode: "not_allowed",
          modelPref: "local",
          preferredLocalBackend: "bios-managed",
          localWorkerModelVariant: "",
        };
      },
      loadWorkerModelCatalog: vi
        .fn()
        .mockResolvedValueOnce({
          machine_profile: {
            logical_cores: 28,
            total_memory_gb: 31,
            gpu_vram_gb: 16,
            gpu_name: "RTX 5070 Ti",
          },
          recommended_local_variant: "qwen-3-14b",
          entries: [
            {
              variant: "gemma-3-4b",
              label: "Gemma 3 4B",
              family: "Gemma",
              managed: true,
              installed: true,
              enabled: true,
              download_supported: true,
              role: "Balanced",
              summary: "Balanced local worker.",
              size_label: "~3.0 GB download",
            },
            {
              variant: "qwen-3-8b",
              label: "Qwen3 8B",
              family: "Qwen",
              managed: true,
              installed: false,
              enabled: true,
              download_supported: true,
              role: "Reasoning",
              summary: "Reasoning local worker.",
              size_label: "~5.2 GB download",
            },
            {
              variant: "qwen-3-14b",
              label: "Qwen3 14B",
              family: "Qwen",
              managed: true,
              installed: false,
              enabled: true,
              download_supported: true,
              role: "Deep reasoning",
              summary: "Deep reasoning local BOSS.",
              size_label: "~9.0 GB download",
            },
          ],
        })
        .mockResolvedValue({
          machine_profile: {
            logical_cores: 28,
            total_memory_gb: 31,
            gpu_vram_gb: 16,
            gpu_name: "RTX 5070 Ti",
          },
          recommended_local_variant: "qwen-3-14b",
          entries: [
            {
              variant: "gemma-3-4b",
              label: "Gemma 3 4B",
              family: "Gemma",
              managed: true,
              installed: true,
              enabled: true,
              download_supported: true,
              role: "Balanced",
              summary: "Balanced local worker.",
              size_label: "~3.0 GB download",
            },
            {
              variant: "qwen-3-8b",
              label: "Qwen3 8B",
              family: "Qwen",
              managed: true,
              installed: true,
              enabled: true,
              download_supported: true,
              role: "Reasoning",
              summary: "Reasoning local worker.",
              size_label: "~5.2 GB download",
            },
            {
              variant: "qwen-3-14b",
              label: "Qwen3 14B",
              family: "Qwen",
              managed: true,
              installed: true,
              enabled: true,
              download_supported: true,
              role: "Deep reasoning",
              summary: "Deep reasoning local BOSS.",
              size_label: "~9.0 GB download",
            },
          ],
        }),
      loadBiosProfileDetail: vi.fn().mockResolvedValue({
        onboarding: {
          local_worker_model_variant: "",
          model_pref: "local",
        },
      }),
      installManagedWorkerModel,
      saveBiosProfileRuntimePreferences: vi.fn(),
      renameActiveBiosProfile: vi.fn(),
      beginFreshBiosProfileOnboarding: vi.fn(),
      deleteBiosProfile: vi.fn(),
    };

    AetherApp.prototype.renderProfileSettings.call(app);
    await flushMicrotasks();

    const downloadAllButton = document.getElementById("settings-install-all-local-workers");
    expect(downloadAllButton.disabled).toBe(false);
    expect(downloadAllButton.innerText).toBe("Download all listed BIOS AI models (2 missing)");
    expect(document.getElementById("settings-local-worker-inventory").innerText).toContain(
      "Installed 1 of 3 listed BIOS AI managed models",
    );
    expect(document.getElementById("settings-local-worker-inventory").innerText).toContain(
      "Missing: Qwen3 8B, Qwen3 14B.",
    );
    downloadAllButton.click();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(installManagedWorkerModel).toHaveBeenNthCalledWith(1, "qwen-3-8b", {
      onProgress: expect.any(Function),
    });
    expect(installManagedWorkerModel).toHaveBeenNthCalledWith(2, "qwen-3-14b", {
      onProgress: expect.any(Function),
    });
    expect(installManagedWorkerModel).toHaveBeenCalledTimes(2);
    expect(app.saveBiosProfileRuntimePreferences).not.toHaveBeenCalled();
    expect(document.getElementById("settings-runtime-controls-status").innerText).toContain(
      "Downloaded 2 listed BIOS AI model(s)",
    );
    expect(document.getElementById("settings-runtime-controls-status").innerText).toContain(
      "Installed 3 of 3 listed BIOS AI managed models",
    );
    expect(document.getElementById("settings-install-all-local-workers").innerText).toBe(
      "All listed BIOS AI models installed",
    );
  });

  it("uses the native persisted queue when downloading all listed BIOS-managed models", async () => {
    createSettingsDom();
    const installAllManagedWorkerModels = vi.fn().mockResolvedValue({
      downloadQueue: {
        state: "completed",
        requested_variants: ["qwen-3-8b", "qwen-3-14b"],
        completed_count: 2,
        total_count: 2,
      },
      assetsStatus: {
        download_queue: {
          state: "completed",
          requested_variants: ["qwen-3-8b", "qwen-3-14b"],
          completed_count: 2,
          total_count: 2,
        },
      },
    });
    const app = {
      biosProfiles: [
        {
          id: "claw",
          display_name: "Claw",
          completed: true,
        },
      ],
      activeBiosProfileId: "claw",
      gateway: { isConnected: false },
      biosRuntimeStatus: null,
      escapeHtml: (value) => value,
      getSavedOnboardingSnapshot() {
        return {
          completed: true,
          agentName: "Claw",
          permissionMode: "not_allowed",
          modelPref: "local",
          preferredLocalBackend: "bios-managed",
          localWorkerModelVariant: "",
        };
      },
      loadWorkerModelCatalog: vi
        .fn()
        .mockResolvedValueOnce({
          machine_profile: {
            logical_cores: 28,
            total_memory_gb: 31,
            gpu_vram_gb: 16,
            gpu_name: "RTX 5070 Ti",
          },
          recommended_local_variant: "qwen-3-14b",
          entries: [
            {
              variant: "gemma-3-4b",
              label: "Gemma 3 4B",
              family: "Gemma",
              managed: true,
              installed: true,
              enabled: true,
              download_supported: true,
              role: "Balanced",
              summary: "Balanced local worker.",
              size_label: "~3.0 GB download",
            },
            {
              variant: "qwen-3-8b",
              label: "Qwen3 8B",
              family: "Qwen",
              managed: true,
              installed: false,
              enabled: true,
              download_supported: true,
              role: "Reasoning",
              summary: "Reasoning local worker.",
              size_label: "~5.2 GB download",
            },
            {
              variant: "qwen-3-14b",
              label: "Qwen3 14B",
              family: "Qwen",
              managed: true,
              installed: false,
              enabled: true,
              download_supported: true,
              role: "Deep reasoning",
              summary: "Deep reasoning local BOSS.",
              size_label: "~9.0 GB download",
            },
          ],
        })
        .mockResolvedValue({
          machine_profile: {
            logical_cores: 28,
            total_memory_gb: 31,
            gpu_vram_gb: 16,
            gpu_name: "RTX 5070 Ti",
          },
          recommended_local_variant: "qwen-3-14b",
          entries: [
            {
              variant: "gemma-3-4b",
              label: "Gemma 3 4B",
              family: "Gemma",
              managed: true,
              installed: true,
              enabled: true,
              download_supported: true,
              role: "Balanced",
              summary: "Balanced local worker.",
              size_label: "~3.0 GB download",
            },
            {
              variant: "qwen-3-8b",
              label: "Qwen3 8B",
              family: "Qwen",
              managed: true,
              installed: true,
              enabled: true,
              download_supported: true,
              role: "Reasoning",
              summary: "Reasoning local worker.",
              size_label: "~5.2 GB download",
            },
            {
              variant: "qwen-3-14b",
              label: "Qwen3 14B",
              family: "Qwen",
              managed: true,
              installed: true,
              enabled: true,
              download_supported: true,
              role: "Deep reasoning",
              summary: "Deep reasoning local BOSS.",
              size_label: "~9.0 GB download",
            },
          ],
        }),
      loadBiosProfileDetail: vi.fn().mockResolvedValue({
        onboarding: {
          local_worker_model_variant: "",
          model_pref: "local",
        },
      }),
      installAllManagedWorkerModels,
      installManagedWorkerModel: vi.fn(),
      saveBiosProfileRuntimePreferences: vi.fn(),
      renameActiveBiosProfile: vi.fn(),
      beginFreshBiosProfileOnboarding: vi.fn(),
      deleteBiosProfile: vi.fn(),
    };

    AetherApp.prototype.renderProfileSettings.call(app);
    await flushMicrotasks();

    document.getElementById("settings-install-all-local-workers").click();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(installAllManagedWorkerModels).toHaveBeenCalledWith({
      onProgress: expect.any(Function),
    });
    expect(app.installManagedWorkerModel).not.toHaveBeenCalled();
    expect(document.getElementById("settings-runtime-controls-status").innerText).toContain(
      "Downloaded all missing listed BIOS AI model(s)",
    );
    expect(document.getElementById("settings-runtime-controls-status").innerText).toContain(
      "Installed 3 of 3 listed BIOS AI managed models",
    );
  });

  it("does not save a failed BIOS-managed model install from Settings", async () => {
    createSettingsDom();
    const saveBiosProfileRuntimePreferences = vi.fn().mockResolvedValue(null);
    const installManagedWorkerModel = vi.fn().mockResolvedValue({
      download: {
        state: "failed",
        variant: "qwen-3-14b",
        error: "Model download failed: 404",
      },
      assetsStatus: {
        installed_models: [],
      },
    });
    const app = {
      biosProfiles: [
        {
          id: "claw",
          display_name: "Claw",
          completed: true,
        },
      ],
      activeBiosProfileId: "claw",
      gateway: { isConnected: false },
      biosRuntimeStatus: null,
      escapeHtml: (value) => value,
      getSavedOnboardingSnapshot() {
        return {
          completed: true,
          agentName: "Claw",
          permissionMode: "not_allowed",
          modelPref: "local",
          preferredLocalBackend: "bios-managed",
          localWorkerModelVariant: "",
        };
      },
      loadWorkerModelCatalog: vi.fn().mockResolvedValue({
        machine_profile: {
          logical_cores: 16,
          total_memory_gb: 32,
          gpu_vram_gb: 16,
          gpu_name: "RTX 4080",
        },
        recommended_local_variant: "qwen-3-14b",
        entries: [
          {
            variant: "qwen-3-14b",
            label: "Qwen3 14B",
            family: "Qwen",
            managed: true,
            installed: false,
            enabled: true,
            download_supported: true,
            recommended_for_local: true,
            role: "Deep reasoning",
            summary: "Deep reasoning local BOSS.",
            size_label: "~9.0 GB download",
          },
        ],
      }),
      loadBiosProfileDetail: vi.fn().mockResolvedValue({
        onboarding: {
          local_worker_model_variant: "",
          model_pref: "local",
        },
      }),
      installManagedWorkerModel,
      saveBiosProfileRuntimePreferences,
      renameActiveBiosProfile: vi.fn(),
      beginFreshBiosProfileOnboarding: vi.fn(),
      deleteBiosProfile: vi.fn(),
    };

    AetherApp.prototype.renderProfileSettings.call(app);
    await flushMicrotasks();

    document.getElementById("settings-local-worker-select").value = "qwen-3-14b";
    document.getElementById("settings-local-worker-select").dispatchEvent(new Event("change"));
    document.getElementById("settings-install-local-worker").click();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(installManagedWorkerModel).toHaveBeenCalledWith("qwen-3-14b", {
      onProgress: expect.any(Function),
    });
    expect(saveBiosProfileRuntimePreferences).not.toHaveBeenCalled();
    expect(document.getElementById("settings-runtime-controls-status").innerText).toContain(
      "Model download failed: 404",
    );
  });

  it("saves authority changes from the Settings surface", async () => {
    createSettingsDom();
    const saveBiosProfileRuntimePreferences = vi.fn().mockResolvedValue(null);
    const app = {
      biosProfiles: [
        {
          id: "claw",
          display_name: "Claw",
          completed: true,
        },
      ],
      activeBiosProfileId: "claw",
      gateway: { isConnected: false },
      biosRuntimeStatus: null,
      escapeHtml: (value) => value,
      getSavedOnboardingSnapshot() {
        return {
          completed: true,
          agentName: "Claw",
          permissionMode: "not_allowed",
          modelPref: "commercial",
        };
      },
      loadWorkerModelCatalog: vi.fn().mockResolvedValue({
        entries: [
          {
            variant: "gemma-3-1b",
            label: "Gemma 3 1B",
            family: "Gemma",
            managed: true,
            installed: true,
            enabled: true,
            download_supported: true,
            role: "Fast small worker",
            summary: "Small worker.",
            size_label: "~0.8 GB download",
          },
          {
            variant: "qwen-3-8b",
            label: "Qwen3 8B",
            family: "Qwen",
            managed: true,
            installed: true,
            enabled: true,
            download_supported: true,
            role: "Reasoning medium worker",
            summary: "Medium worker.",
            size_label: "~5.2 GB download",
          },
        ],
      }),
      saveBiosProfileRuntimePreferences,
      renameActiveBiosProfile: vi.fn(),
      beginFreshBiosProfileOnboarding: vi.fn(),
      deleteBiosProfile: vi.fn(),
    };

    AetherApp.prototype.renderProfileSettings.call(app);
    await flushMicrotasks();

    document.getElementById("settings-posture-select").value = "allowed";
    document.getElementById("settings-save-safety-controls").click();
    await flushMicrotasks();

    expect(saveBiosProfileRuntimePreferences).toHaveBeenCalledWith({
      permissionMode: "allowed",
    });
    expect(document.getElementById("settings-safety-controls-status").innerText).toContain(
      "Saved authority choice",
    );
  });

  it("registers an external GGUF path from Settings for the managed BIOS AI lane", async () => {
    createSettingsDom();
    const saveBiosProfileRuntimePreferences = vi.fn().mockResolvedValue(null);
    const app = {
      biosProfiles: [
        {
          id: "claw",
          display_name: "Claw",
          completed: true,
        },
      ],
      activeBiosProfileId: "claw",
      gateway: { isConnected: false },
      biosRuntimeStatus: null,
      escapeHtml: (value) => value,
      getSavedOnboardingSnapshot() {
        return {
          completed: true,
          agentName: "Claw",
          permissionMode: "not_allowed",
          modelPref: "local",
          preferredLocalBackend: "bios-managed",
          localWorkerModelVariant: null,
          localWorkerModelPath: null,
        };
      },
      loadWorkerModelCatalog: vi.fn().mockResolvedValue({ entries: [] }),
      loadBiosProfileDetail: vi.fn().mockResolvedValue({
        onboarding: {
          localWorkerModelVariant: "custom-qwen3-14b-q4-k-m",
          localWorkerModelPath: "E:/Models/Qwen3-14B-Q4_K_M.gguf",
        },
      }),
      saveBiosProfileRuntimePreferences,
      renameActiveBiosProfile: vi.fn(),
      beginFreshBiosProfileOnboarding: vi.fn(),
      deleteBiosProfile: vi.fn(),
    };

    AetherApp.prototype.renderProfileSettings.call(app);
    await flushMicrotasks();

    document.getElementById("settings-local-worker-custom-path").value =
      "E:/Models/Qwen3-14B-Q4_K_M.gguf";
    document.getElementById("settings-medium-worker-select").value = "qwen-3-8b";
    document.getElementById("settings-small-worker-select").value = "gemma-3-1b";
    document.getElementById("settings-register-local-worker-path").click();
    await flushMicrotasks();

    expect(saveBiosProfileRuntimePreferences).toHaveBeenCalledWith({
      modelPref: "local",
      preferredLocalBackend: "bios-managed",
      localWorkerModelVariant: null,
      localWorkerModelPath: "E:/Models/Qwen3-14B-Q4_K_M.gguf",
      biosWorkerRoster: [
        {
          role: "boss_brain",
          variant: null,
          path: "E:/Models/Qwen3-14B-Q4_K_M.gguf",
        },
        {
          role: "medium_worker",
          variant: "qwen-3-8b",
          path: null,
        },
        {
          role: "small_worker",
          variant: "gemma-3-1b",
          path: null,
        },
      ],
    });
  });

  it("reopens onboarding when an activated profile still needs recovery", async () => {
    document.body.innerHTML = `
      <div id="chat-empty"></div>
      <div id="chat-stream"></div>
    `;
    const app = {
      activeBiosProfileId: "forge",
      loadBiosProfileDetail: vi.fn().mockResolvedValue({
        profile: {
          id: "forge",
          display_name: "Forge",
          completed: false,
        },
        onboarding: {
          completed: false,
          agent_name: "Forge",
          model_pref: "local",
        },
      }),
      setActiveBiosProfile: vi.fn().mockResolvedValue(undefined),
      saveSavedOnboardingSnapshot: vi.fn(),
      updateAgentNameDOM: vi.fn(),
      syncSavedOnboardingSnapshot: vi.fn(),
      tickBiosBrainstem: vi.fn().mockResolvedValue(undefined),
      loadBiosRuntimeStatus: vi.fn().mockResolvedValue(undefined),
      initSettingsProviderPanel: vi.fn(),
      showOfflineWelcome: vi.fn(),
      escapeHtml: (value) => value,
    };

    window.__TAURI__.core.invoke.mockImplementation(async (command) => {
      if (command === "bios_shell_contract") {
        return {
          runtime: {
            route_ready: false,
          },
        };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const ready = await AetherApp.prototype.activateExistingBiosProfile.call(app, "forge");

    expect(ready).toBe(false);
    expect(app.showOfflineWelcome).toHaveBeenCalled();
    expect(document.getElementById("chat-stream").textContent).toContain("chat is still locked");
  });

  it("persists sovereign observation state when the viewport body changes", async () => {
    document.body.innerHTML = `
      <iframe id="viewport-iframe"></iframe>
      <div id="viewport-idle"></div>
      <div id="agent-badge" class="hidden"></div>
      <div id="viewport-dot"></div>
      <div id="viewport-status-text"></div>
      <div id="viewport-mode"></div>
      <div id="viewport-app-title"></div>
    `;
    const invoke = vi.fn(async (command, payload) => {
      if (command === "update_bios_observation_state") {
        return {
          profile_id: "claw",
          state: payload.input.state,
          label: payload.input.label,
          detail: payload.input.detail,
          active_surface: payload.input.active_surface,
          body_mode: payload.input.body_mode,
          body_summary: "Private virtual desktop is active on https://example.com/workbench.",
          execution_lane: "private_desktop",
          target_url: payload.input.target_url,
          ghosting_protected: true,
          last_observed_at: "123",
        };
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    window.__TAURI__.core.invoke = invoke;

    const app = {
      activeBiosProfileId: "claw",
      browserSandboxStatus: {
        active: true,
        url: "https://example.com/workbench",
      },
      runInProgress: false,
      currentRunStatus: "",
      autonomousMode: false,
      orb: { state: "idle" },
      renderViewportStatus: AetherApp.prototype.renderViewportStatus,
      persistViewportObservation: AetherApp.prototype.persistViewportObservation,
    };

    AetherApp.prototype.updateObservationPlane.call(
      app,
      "acting",
      "Browser active",
      "https://example.com/workbench",
    );
    await flushMicrotasks();

    expect(invoke).toHaveBeenCalledWith("update_bios_observation_state", {
      input: {
        profile_id: "claw",
        state: "acting",
        label: "Browser active",
        detail: "https://example.com/workbench",
        active_surface: "virtual_desktop",
        body_mode: "private_desktop_active",
        target_url: "https://example.com/workbench",
      },
    });
  });

  it("deletes the active BIOS profile and resets shell identity when no profiles remain", async () => {
    createSettingsDom();
    const app = {
      activeBiosProfileId: "claw",
      clearSavedOnboardingSnapshot: vi.fn(),
      loadBiosProfiles: vi.fn().mockResolvedValue([]),
      updateAgentNameDOM: vi.fn(),
      syncSavedOnboardingSnapshot: vi.fn(),
      agentName: "Claw",
    };

    window.__TAURI__.core.invoke.mockImplementation(async (command, payload) => {
      if (command === "delete_bios_profile") {
        expect(payload).toEqual({ profileId: "claw" });
        return {
          deleted_profile_id: "claw",
          active_profile_id: null,
          remaining_profiles: 0,
        };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const response = await AetherApp.prototype.deleteBiosProfile.call(app, "claw");

    expect(response.remaining_profiles).toBe(0);
    expect(app.activeBiosProfileId).toBeNull();
    expect(app.agentName).toBe("BIOS AI");
    expect(app.updateAgentNameDOM).toHaveBeenCalled();
    expect(app.syncSavedOnboardingSnapshot).toHaveBeenCalled();
  });

  it("uses explicit delete confirmation copy and tells Settings when the last profile is gone", async () => {
    createSettingsDom();
    const app = {
      biosProfiles: [
        {
          id: "claw",
          display_name: "Claw",
          completed: true,
          model_pref: "local",
          safety_posture_label: "LXC-first hardened",
        },
      ],
      activeBiosProfileId: "claw",
      gateway: { isConnected: false },
      continuityHealth: null,
      biosDiagnostics: null,
      biosRuntimeStatus: null,
      updateAgentNameDOM: vi.fn(),
      escapeHtml: (value) => value,
      renderViewportIdleCompanion: vi.fn(),
      renderRailBossStatus: vi.fn(),
      setStatusValue: vi.fn(),
      getSavedOnboardingSnapshot: vi.fn(() => null),
      beginFreshBiosProfileOnboarding: vi.fn(),
      deleteBiosProfile: vi.fn(async () => ({
        deleted_profile_id: "claw",
        active_profile_id: null,
        remaining_profiles: 0,
      })),
      renderProfileSettings: AetherApp.prototype.renderProfileSettings,
    };

    AetherApp.prototype.renderProfileSettings.call(app);
    document.getElementById("settings-delete-profile").click();
    await flushMicrotasks();

    expect(window.confirm).toHaveBeenCalledWith(
      "Delete Claw? This permanently removes only its BIOS-owned profile workspace, saved setup, routing choices, provider wiring, local worker selection, and runtime state. It does not delete unrelated soul, memory, or user files outside this BIOS profile. BIOS AI will reopen fresh onboarding.",
    );
    expect(document.getElementById("settings-profile-danger-copy").innerText).toContain(
      "It does not delete unrelated soul, memory, or user files outside this BIOS profile.",
    );
    expect(app.beginFreshBiosProfileOnboarding).toHaveBeenCalledWith({
      clearExistingProfileId: null,
    });
  });

  it("uses the fresh-start helper from Settings without replacing the current profile", () => {
    createSettingsDom();
    const app = {
      biosProfiles: [
        {
          id: "claw",
          display_name: "Claw",
          completed: true,
          model_pref: "local",
          safety_posture_label: "LXC-first hardened",
        },
      ],
      activeBiosProfileId: "claw",
      gateway: { isConnected: false },
      continuityHealth: null,
      biosDiagnostics: null,
      biosRuntimeStatus: null,
      updateAgentNameDOM: vi.fn(),
      escapeHtml: (value) => value,
      renderViewportIdleCompanion: vi.fn(),
      renderRailBossStatus: vi.fn(),
      setStatusValue: vi.fn(),
      getSavedOnboardingSnapshot: vi.fn(() => null),
      getActiveBiosProfileId: vi.fn(() => "claw"),
      beginFreshBiosProfileOnboarding: vi.fn(),
    };

    AetherApp.prototype.renderProfileSettings.call(app);
    document.getElementById("settings-create-profile").click();

    expect(document.getElementById("settings-profile-status").innerText).toContain(
      "Starting setup for a new BOSS profile.",
    );
    expect(app.beginFreshBiosProfileOnboarding).toHaveBeenCalledWith();
  });

  it("surfaces profile picker and rerun setup actions in diagnostics recovery", () => {
    createSettingsDom();
    const app = {
      biosProfiles: [{ id: "claw", display_name: "Claw" }],
      activeBiosProfileId: "claw",
      gateway: { isConnected: false },
      continuityHealth: null,
      biosDiagnostics: null,
      biosRuntimeStatus: null,
      updateAgentNameDOM: vi.fn(),
      escapeHtml: (value) => value,
      renderViewportIdleCompanion: vi.fn(),
      renderRailBossStatus: vi.fn(),
      setStatusValue: vi.fn(),
      getSavedOnboardingSnapshot: vi.fn(() => null),
      beginFreshBiosProfileOnboarding: vi.fn(),
      showProfilePicker: vi.fn(),
      applyShellSurface: vi.fn(),
    };

    AetherApp.prototype.renderProfileSettings.call(app);
    document.getElementById("settings-show-profile-picker").click();
    document.getElementById("settings-rerun-onboarding").click();

    expect(app.applyShellSurface).toHaveBeenCalledWith("chat");
    expect(app.showProfilePicker).toHaveBeenCalled();
    expect(app.beginFreshBiosProfileOnboarding).toHaveBeenCalledWith();
  });

  it("keeps the returning-user profile picker from showing stale active runtime truth", () => {
    createSettingsDom();
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div id="chat-empty"></div><div id="chat-stream"></div>`,
    );
    const app = {
      biosProfiles: [
        {
          id: "claw",
          display_name: "Claw",
          model_pref: "local",
          local_worker_ready: true,
          safety_posture_label: "LXC-first hardened",
        },
      ],
      activeBiosProfileId: "claw",
      profilePickerActive: false,
      runInProgress: false,
      orb: { state: "idle" },
      browserSandboxStatus: null,
      autonomousMode: false,
      escapeHtml: (value) => String(value ?? ""),
      renderViewportIdleCompanion: AetherApp.prototype.renderViewportIdleCompanion,
      renderProfilePickerViewport: AetherApp.prototype.renderProfilePickerViewport,
      renderRailBossStatus: vi.fn(),
      activateExistingBiosProfile: vi.fn(),
      beginFreshBiosProfileOnboarding: vi.fn(),
    };

    AetherApp.prototype.showProfilePicker.call(app);

    expect(app.profilePickerActive).toBe(true);
    expect(document.getElementById("viewport-idle").classList.contains("hidden")).toBe(true);
    expect(document.getElementById("viewport-app-title").innerText).toBe("Choose BOSS profile");
    expect(document.getElementById("viewport-body-posture").innerText).toBe(
      "Waiting for profile choice",
    );
    expect(document.getElementById("viewport-idle-title").textContent || "").toBe("");
    expect(document.getElementById("viewport-idle-title").textContent || "").not.toContain(
      "Verifying",
    );
    AetherApp.prototype.renderViewportStatus.call(app);
    expect(document.getElementById("viewport-idle").classList.contains("hidden")).toBe(true);
    expect(document.getElementById("viewport-app-title").innerText).toBe("Choose BOSS profile");
    expect(document.querySelector(".bios-profile-picker").getAttribute("style")).not.toContain(
      "rgba(0,255,170,0.08)",
    );

    AetherApp.prototype.renderViewportIdleCompanion.call(app, {
      title: "Local-first shell ready",
      viewportTitle: "BIOS Home",
    });
    expect(document.getElementById("viewport-idle").classList.contains("hidden")).toBe(true);
    expect(document.getElementById("viewport-idle-title").innerText).toBe(
      "Local-first shell ready",
    );
  });

  it("starts a fresh BOSS onboarding run without deleting the current saved profile", () => {
    document.body.innerHTML = `<div id="chat-stream"><div>old</div></div>`;
    localStorage.setItem("bios-ai-active-profile", "claw");
    localStorage.setItem(
      "bios-ai-onboarding:claw",
      JSON.stringify({ completed: true, agentName: "Claw" }),
    );
    localStorage.setItem(
      "bios-ai-onboarding",
      JSON.stringify({ completed: true, agentName: "Claw" }),
    );

    const app = {
      pendingNewBiosProfile: false,
      activeBiosProfileId: "claw",
      hasCalibratedAgentName: true,
      biosRuntimeStatus: { route_ready: true },
      biosBrainstem: { lifecycle: "awake" },
      biosReflex: { summary: "ready" },
      biosObservation: { detail: "watching" },
      biosMemoryContract: { summary: "memory" },
      biosSoulContract: { summary: "soul" },
      biosDreamContract: { summary: "dream" },
      forgeArenaProfile: { ready: true },
      forgeArenaProfileFormSignature: "claw:ready",
      agentName: "Claw",
      clearSavedOnboardingSnapshot: AetherApp.prototype.clearSavedOnboardingSnapshot,
      getActiveBiosProfileId: AetherApp.prototype.getActiveBiosProfileId,
      updateAgentNameDOM: vi.fn(),
      syncSavedOnboardingSnapshot: vi.fn(),
      showOfflineWelcome: vi.fn(),
    };

    window.__TAURI__.core.invoke.mockResolvedValue({
      profiles: [],
      active_profile_id: null,
    });

    AetherApp.prototype.beginFreshBiosProfileOnboarding.call(app);

    expect(localStorage.getItem("bios-ai-onboarding:claw")).toContain("Claw");
    expect(localStorage.getItem("bios-ai-onboarding")).toBeNull();
    expect(localStorage.getItem("bios-ai-active-profile")).toBeNull();
    expect(app.pendingNewBiosProfile).toBe(true);
    expect(app.activeBiosProfileId).toBeNull();
    expect(app.agentName).toBe("BIOS AI");
    expect(app.hasCalibratedAgentName).toBe(false);
    expect(app.biosRuntimeStatus).toBeNull();
    expect(app.biosBrainstem).toBeNull();
    expect(app.forgeArenaProfile).toBeNull();
    expect(app.forgeArenaProfileFormSignature).toBe("");
    expect(document.getElementById("chat-stream").innerHTML).toBe("");
    expect(window.__TAURI__.core.invoke).toHaveBeenCalledWith("clear_active_bios_profile");
    expect(app.showOfflineWelcome).toHaveBeenCalled();
  });

  it("keeps an explicit destructive reset path for callers that clear a profile snapshot", () => {
    document.body.innerHTML = `<div id="chat-stream"><div>old</div></div>`;
    localStorage.setItem("bios-ai-active-profile", "claw");
    localStorage.setItem(
      "bios-ai-onboarding:claw",
      JSON.stringify({ completed: true, agentName: "Claw" }),
    );

    const app = {
      pendingNewBiosProfile: false,
      activeBiosProfileId: "claw",
      hasCalibratedAgentName: true,
      biosRuntimeStatus: { route_ready: true },
      biosBrainstem: { lifecycle: "awake" },
      biosReflex: { summary: "ready" },
      biosObservation: { detail: "watching" },
      biosMemoryContract: { summary: "memory" },
      biosSoulContract: { summary: "soul" },
      biosDreamContract: { summary: "dream" },
      forgeArenaProfile: { ready: true },
      forgeArenaProfileFormSignature: "claw:ready",
      agentName: "Claw",
      clearSavedOnboardingSnapshot: AetherApp.prototype.clearSavedOnboardingSnapshot,
      getActiveBiosProfileId: AetherApp.prototype.getActiveBiosProfileId,
      updateAgentNameDOM: vi.fn(),
      syncSavedOnboardingSnapshot: vi.fn(),
      showOfflineWelcome: vi.fn(),
    };
    window.__TAURI__.core.invoke.mockResolvedValue(null);

    AetherApp.prototype.beginFreshBiosProfileOnboarding.call(app, {
      clearExistingProfileId: "claw",
    });

    expect(localStorage.getItem("bios-ai-onboarding:claw")).toBeNull();
    expect(localStorage.getItem("bios-ai-active-profile")).toBeNull();
    expect(app.pendingNewBiosProfile).toBe(true);
    expect(app.activeBiosProfileId).toBeNull();
    expect(app.showOfflineWelcome).toHaveBeenCalled();
  });

  it("does not silently reactivate the first BIOS profile when native active truth is empty", async () => {
    createSettingsDom();
    localStorage.setItem("bios-ai-active-profile", "claw");
    const app = {
      biosProfiles: [],
      activeBiosProfileId: "claw",
      renderProfileSettings: vi.fn(),
      loadForgeArenaProfile: vi.fn(),
      getActiveBiosProfileId: AetherApp.prototype.getActiveBiosProfileId,
    };

    window.__TAURI__.core.invoke.mockResolvedValue({
      profiles: [
        { id: "claw", display_name: "Claw" },
        { id: "ember", display_name: "Ember" },
      ],
      active_profile_id: null,
    });

    const profiles = await AetherApp.prototype.loadBiosProfiles.call(app);

    expect(profiles).toHaveLength(2);
    expect(app.activeBiosProfileId).toBeNull();
    expect(localStorage.getItem("bios-ai-active-profile")).toBeNull();
    expect(app.renderProfileSettings).toHaveBeenCalled();
    expect(app.loadForgeArenaProfile).toHaveBeenCalledWith(null);
  });

  it("shows approval pending state, final success text, and keeps controls disabled on success", async () => {
    createApprovalDom();
    let releaseApproval;
    const resolveMissionApproval = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseApproval = resolve;
        }),
    );
    const app = {
      activeMission: {
        title: "Recover BIOS continuity",
        description: "Keep the recovery lane visible.",
        checklist: [{ text: "Review gate", status: "progress" }],
        evidence: [],
        operatorRecord: {
          approval: {
            id: "approval-1",
            title: "browser sandbox patch",
            summary: "Patch the sandbox boundary.",
            kind: "exec",
            boundaryClass: "external_mutation",
          },
        },
      },
      activeContinuity: {
        blockedByApproval: true,
        lifecycle: "waiting_for_approval",
        recoveryAction: "await_approval",
        summary: "Waiting for operator input.",
        health: "needs_review",
        stale: false,
      },
      chat: { activeMessageText: "", updateOutlineMap: vi.fn() },
      formatContinuityLabel: (value) => value,
      resolveMissionApproval,
    };

    AetherApp.prototype.renderMissionControl.call(app);

    const approveButton = document.querySelector('[data-approval-action="approve"]');
    const rejectButton = document.querySelector('[data-approval-action="reject"]');
    const status = document.getElementById("mission-approval-status");

    approveButton.click();
    await flushMicrotasks();

    expect(status.innerText).toBe("Approving browser sandbox patch...");
    expect(approveButton.disabled).toBe(true);
    expect(rejectButton.disabled).toBe(true);

    releaseApproval({
      ok: true,
      statusMessage: "browser sandbox patch approved. Mission work can continue.",
    });
    await flushMicrotasks();

    expect(status.innerText).toBe("browser sandbox patch approved. Mission work can continue.");
    expect(approveButton.disabled).toBe(true);
    expect(rejectButton.disabled).toBe(true);
    expect(resolveMissionApproval).toHaveBeenCalledWith("approval-1", true);
  });

  it("restores approval controls after a rejection failure", async () => {
    createApprovalDom();
    const resolveMissionApproval = vi.fn().mockResolvedValue({
      ok: false,
      statusMessage: "Rejection failed: gateway unavailable",
    });
    const app = {
      activeMission: {
        title: "Recover BIOS continuity",
        description: "Keep the recovery lane visible.",
        checklist: [{ text: "Review gate", status: "progress" }],
        evidence: [],
        operatorRecord: {
          approval: {
            id: "approval-1",
            title: "browser sandbox patch",
            summary: "Patch the sandbox boundary.",
            kind: "exec",
            boundaryClass: "external_mutation",
          },
        },
      },
      activeContinuity: {
        blockedByApproval: true,
        lifecycle: "waiting_for_approval",
        recoveryAction: "await_approval",
        summary: "Waiting for operator input.",
        health: "needs_review",
        stale: false,
      },
      chat: { activeMessageText: "", updateOutlineMap: vi.fn() },
      formatContinuityLabel: (value) => value,
      resolveMissionApproval,
    };

    AetherApp.prototype.renderMissionControl.call(app);

    const approveButton = document.querySelector('[data-approval-action="approve"]');
    const rejectButton = document.querySelector('[data-approval-action="reject"]');
    const status = document.getElementById("mission-approval-status");

    rejectButton.click();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(status.innerText).toBe("Rejection failed: gateway unavailable");
    expect(approveButton.disabled).toBe(false);
    expect(rejectButton.disabled).toBe(false);
    expect(resolveMissionApproval).toHaveBeenCalledWith("approval-1", false);
  });

  it("saves Telegram connector controls through the real settings surface", async () => {
    createSettingsDom();
    const saved = {
      completed: true,
      agentName: "Claw",
      modelPref: "local",
      preferredLocalBackend: "bios-managed",
      permissionMode: "not_allowed",
      localWorkerModelVariant: "qwen-3-8b",
      biosWorkerRoster: [{ role: "boss_brain", variant: "qwen-3-8b", path: null }],
    };
    const app = {
      biosProfiles: [
        {
          id: "claw",
          display_name: "Claw",
          safety_posture_label: "LXC-first hardened",
          local_runtime_owner: "BIOS AI",
          local_runtime_engine: "llama.cpp",
          local_runtime_strategy: "BIOS-managed local runtime",
        },
      ],
      activeBiosProfileId: "claw",
      agentName: "Claw",
      escapeHtml: (value) => value,
      getSavedOnboardingSnapshot: vi.fn(() => saved),
      loadWorkerModelCatalog: vi.fn().mockResolvedValue({
        machine_profile: { total_memory_gb: 32, logical_cores: 20 },
        entries: [
          {
            variant: "qwen-3-8b",
            label: "Qwen3 8B",
            family: "Qwen",
            role: "Serious local BOSS lane",
            summary: "Managed reasoning model",
            size_label: "~5.2 GB download",
            enabled: true,
            managed: true,
            installed: true,
            source: "bios-managed",
            downloadSupported: true,
          },
        ],
        recommended_local_variant: "qwen-3-8b",
      }),
      loadBiosLocalConnectorStatus: vi.fn().mockResolvedValue({
        profile_id: "claw",
        connectors: [
          {
            connector: "telegram",
            configured: true,
            ready: false,
            enabled: false,
            profile_bound: false,
            has_key: true,
            permission_mode: "not_allowed",
            target_id: null,
            target_summary: "No Telegram target bound yet",
            allowed_actions: ["send_message"],
            label: "Telegram key found, connector disabled",
            detail: "Telegram is configured but disabled for this BOSS profile.",
          },
        ],
      }),
      saveBiosLocalConnectorBinding: vi.fn().mockResolvedValue({
        profile_id: "claw",
        connectors: [
          {
            connector: "telegram",
            configured: true,
            ready: true,
            enabled: true,
            profile_bound: true,
            has_key: true,
            permission_mode: "not_allowed",
            target_id: "123456",
            target_summary: "Bound to Telegram target 123456",
            allowed_actions: ["send_message"],
            label: "Telegram connector ready",
            detail:
              "BIOS AI can use Telegram through this profile-bound connector. Permission mode: ask first.",
          },
        ],
      }),
      activateExistingBiosProfile: vi.fn().mockResolvedValue(true),
      renameActiveBiosProfile: vi.fn(),
      beginFreshBiosProfileOnboarding: vi.fn(),
      deleteBiosProfile: vi.fn(),
      renderProfileSettings: vi.fn(() => renderProfileSettingsSurface(app)),
      setStatusValue: vi.fn(),
      renderViewportIdleCompanion: vi.fn(),
      renderRailBossStatus: vi.fn(),
      gateway: { isConnected: false },
      biosRuntimeStatus: null,
      biosMemoryContract: null,
      biosObservation: null,
      biosShellContract: null,
      biosDiagnostics: null,
      continuityHealth: null,
      updateAgentNameDOM: vi.fn(),
    };

    renderProfileSettingsSurface(app);
    await vi.waitFor(() => {
      expect(document.getElementById("settings-telegram-connector-status").innerText).toContain(
        "Telegram key found, connector disabled",
      );
    });

    document.getElementById("settings-telegram-enabled-select").value = "enabled";
    document.getElementById("settings-telegram-target-input").value = "123456";
    document.getElementById("settings-save-telegram-connector").click();

    await vi.waitFor(() => {
      expect(app.saveBiosLocalConnectorBinding).toHaveBeenCalledWith({
        connector: "telegram",
        enabled: true,
        targetId: "123456",
        allowedActions: ["send_message"],
      });
    });
    await vi.waitFor(() => {
      expect(document.getElementById("settings-telegram-connector-status").innerText).toContain(
        "Telegram connector ready",
      );
    });
    expect(document.getElementById("settings-telegram-target-input").value).toBe("123456");
  });
});
