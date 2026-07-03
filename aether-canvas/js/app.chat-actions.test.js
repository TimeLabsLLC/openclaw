import { beforeEach, describe, expect, it, vi } from "vitest";
import { AetherApp } from "./app.js";

function createThinkingNode() {
  return document.createElement("div");
}

describe("AetherApp chat actions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    window.__TAURI__ = {
      core: {
        invoke: vi.fn(async (command) => {
          if (command === "append_debug_log") {
            return null;
          }
          throw new Error(`Unexpected command: ${command}`);
        }),
      },
    };
  });

  it("returns true and toggles busy state for gateway-backed sends", async () => {
    const app = {
      agentName: "BIOS AI",
      gateway: {
        isConnected: true,
        request: vi.fn(async (method) => {
          if (method === "skills.route") {
            return { decision: null };
          }
          if (method === "chat.send") {
            return { ok: true };
          }
          throw new Error(`Unexpected gateway method: ${method}`);
        }),
      },
      chat: {
        setBusy: vi.fn(),
        appendMessage: vi.fn(),
        scrollToBottom: vi.fn(),
      },
      subtitles: { update: vi.fn() },
      orb: { setState: vi.fn() },
      liveToolStatuses: new Map(),
      refreshHeroStatus: vi.fn(),
      normalizeStatusText: AetherApp.prototype.normalizeStatusText,
      shortenStatus: AetherApp.prototype.shortenStatus,
      summarizeUserIntent: AetherApp.prototype.summarizeUserIntent,
      getActiveBiosProfileId: AetherApp.prototype.getActiveBiosProfileId,
      getSavedOnboardingSnapshot: AetherApp.prototype.getSavedOnboardingSnapshot,
      recordRouteDecision: vi.fn(),
      currentRunStatus: "",
      pendingBackgroundStatus: "",
      runInProgress: false,
    };

    const result = await AetherApp.prototype.sendChatMessage.call(app, "Ship the deploy lane");

    expect(result).toBe(true);
    expect(app.chat.setBusy).toHaveBeenNthCalledWith(1, true, "Deploying intent to BIOS AI...");
    expect(app.chat.setBusy).toHaveBeenLastCalledWith(false);
    expect(app.subtitles.update).toHaveBeenCalledWith("Deploying intent to BIOS AI...");
    expect(app.subtitles.update).toHaveBeenLastCalledWith(
      "BIOS AI has your request and is working on it.",
    );
  });

  it("returns false and reopens activation when no real BOSS profile exists", async () => {
    const thinkingNode = createThinkingNode();
    window.__TAURI__.core.invoke.mockImplementation(async (command) => {
      if (command === "append_debug_log") {
        return null;
      }
      if (command === "load_bios_profile") {
        return null;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const app = {
      agentName: "BIOS AI",
      gateway: {
        isConnected: false,
        request: vi.fn(),
      },
      chat: {
        setBusy: vi.fn(),
        appendMessage: vi.fn(() => thinkingNode),
        scrollToBottom: vi.fn(),
      },
      subtitles: { update: vi.fn() },
      orb: { setState: vi.fn() },
      liveToolStatuses: new Map(),
      refreshHeroStatus: vi.fn(),
      normalizeStatusText: AetherApp.prototype.normalizeStatusText,
      shortenStatus: AetherApp.prototype.shortenStatus,
      summarizeUserIntent: AetherApp.prototype.summarizeUserIntent,
      getActiveBiosProfileId: AetherApp.prototype.getActiveBiosProfileId,
      getSavedOnboardingSnapshot: AetherApp.prototype.getSavedOnboardingSnapshot,
      showOfflineWelcome: vi.fn(),
      renderBiosRuntimeStatus: vi.fn(),
      activeBiosProfileId: "claw",
      currentRunStatus: "",
      pendingBackgroundStatus: "",
      runInProgress: false,
      _conversationHistory: [],
    };

    const result = await AetherApp.prototype.sendChatMessage.call(app, "Hello there");

    expect(result).toBe(false);
    expect(app.showOfflineWelcome).toHaveBeenCalled();
    expect(app.chat.setBusy).toHaveBeenCalledWith(false);
    expect(app.chat.appendMessage).toHaveBeenLastCalledWith(
      "assistant",
      expect.stringContaining("saved BOSS setup"),
    );
    expect(app.subtitles.update).toHaveBeenLastCalledWith(
      "Local response failed: missing_boss_profile_detail",
    );
  });

  it("returns false and reopens activation when no active BOSS profile is selected", async () => {
    const app = {
      agentName: "BIOS AI",
      gateway: {
        isConnected: false,
        request: vi.fn(),
      },
      chat: {
        setBusy: vi.fn(),
        appendMessage: vi.fn(),
        scrollToBottom: vi.fn(),
      },
      subtitles: { update: vi.fn() },
      orb: { setState: vi.fn() },
      liveToolStatuses: new Map(),
      refreshHeroStatus: vi.fn(),
      normalizeStatusText: AetherApp.prototype.normalizeStatusText,
      shortenStatus: AetherApp.prototype.shortenStatus,
      summarizeUserIntent: AetherApp.prototype.summarizeUserIntent,
      getActiveBiosProfileId: AetherApp.prototype.getActiveBiosProfileId,
      getSavedOnboardingSnapshot: AetherApp.prototype.getSavedOnboardingSnapshot,
      showOfflineWelcome: vi.fn(),
      currentRunStatus: "",
      pendingBackgroundStatus: "",
      runInProgress: false,
      activeBiosProfileId: null,
      _conversationHistory: [],
    };

    const result = await AetherApp.prototype.sendChatMessage.call(app, "Hello there");

    expect(result).toBe(false);
    expect(app.showOfflineWelcome).toHaveBeenCalled();
    expect(app.chat.appendMessage).toHaveBeenLastCalledWith(
      "assistant",
      expect.stringContaining("needs a BOSS profile"),
    );
    expect(app.subtitles.update).toHaveBeenLastCalledWith(
      "Local response failed: missing_boss_profile",
    );
  });

  it("uses the local worker when no API key is configured but a local model is ready", async () => {
    const thinkingNode = createThinkingNode();
    localStorage.setItem(
      "bios-ai-onboarding",
      JSON.stringify({
        localWorkerModelVariant: "qwen-3-8b",
        localWorkerDownloadStatus: "completed",
      }),
    );
    window.__TAURI__.core.invoke.mockImplementation(async (command, payload) => {
      if (command === "append_debug_log") {
        return null;
      }
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
            route_ready: true,
            worker_ready: true,
            worker_lanes: [
              {
                role: "boss_brain",
                ready: true,
                role_label: "BOSS brain",
                selected_model_id: "qwen3-14b-instruct",
              },
              {
                role: "medium_worker",
                ready: true,
                role_label: "Medium worker",
                selected_model_id: "qwen3-8b-instruct",
              },
              {
                role: "small_worker",
                ready: true,
                role_label: "Small worker",
                selected_model_id: "gemma-3-1b-it",
              },
            ],
            next_step: "You can start chatting now.",
          },
        };
      }
      if (command === "load_bios_profile") {
        return {
          profile: { id: "claw", display_name: "Claw", completed: true },
          onboarding: {
            agent_name: "Claw",
            completed: true,
            model_pref: "local",
            local_runtime_owner: "bios-managed",
            local_worker_model_variant: "qwen-3-8b",
          },
        };
      }
      if (command === "load_bios_memory_surface") {
        return {
          total_events: 2,
          standing_orders: [{ summary: "Never fake BIOS powers." }],
          user_preferences: [],
          mission_facts: [{ summary: "Local BIOS runtime is active." }],
          relationship_notes: [],
          identity_notes: [],
          skill_candidates: [],
          pending_approval_changes: [],
          promotion_queue: [],
          recent_events: [],
          consolidated_memory: [{ summary: "Use sandbox first." }],
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
          hardened_skill_count: 1,
          strongest_skill: "Use sandbox first.",
          strongest_reinforcement: 2,
          artifacts: [{ summary: "Use sandbox first." }],
        };
      }
      if (command === "system_discovery") {
        return {
          machine_profile: {
            os: "windows",
            arch: "x86_64",
            logical_cores: 20,
            total_memory_gb: 32,
            gpu_name: "RTX 4080",
            gpu_vendor: "NVIDIA",
            gpu_vram_gb: 16,
          },
        };
      }
      if (command === "chat_with_local_worker") {
        expect(payload.messages.at(-1)).toEqual({ role: "user", text: "Hello there" });
        expect(payload.workerRole).toBe("boss_brain");
        expect(payload.systemPrompt).toContain("Do not say you checked saved history");
        expect(payload.systemPrompt).toContain("Do not say you used Telegram");
        expect(payload.systemPrompt).toContain("Never fake BIOS powers.");
        expect(payload.systemPrompt).toContain("Logical cores: 20");
        return "Local BIOS AI reply";
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const app = {
      agentName: "BIOS AI",
      gateway: {
        isConnected: false,
        request: vi.fn(),
      },
      chat: {
        setBusy: vi.fn(),
        appendMessage: vi.fn(() => thinkingNode),
        scrollToBottom: vi.fn(),
      },
      subtitles: { update: vi.fn() },
      orb: { setState: vi.fn() },
      liveToolStatuses: new Map(),
      refreshHeroStatus: vi.fn(),
      normalizeStatusText: AetherApp.prototype.normalizeStatusText,
      shortenStatus: AetherApp.prototype.shortenStatus,
      summarizeUserIntent: AetherApp.prototype.summarizeUserIntent,
      getActiveBiosProfileId: AetherApp.prototype.getActiveBiosProfileId,
      getSavedOnboardingSnapshot: AetherApp.prototype.getSavedOnboardingSnapshot,
      renderBiosRuntimeStatus: vi.fn(),
      currentRunStatus: "",
      pendingBackgroundStatus: "",
      runInProgress: false,
      activeBiosProfileId: "claw",
      _conversationHistory: [],
    };

    const result = await AetherApp.prototype.sendChatMessage.call(app, "Hello there");

    expect(result).toBe(true);
    expect(thinkingNode.innerText).toBe("Local BIOS AI reply");
    expect(app.subtitles.update).toHaveBeenLastCalledWith("BIOS AI responded.");
  });

  it("turns heavyweight local BOSS warmup failures into actionable chat copy", async () => {
    const app = {
      formatChatFailureMessage: AetherApp.prototype.formatChatFailureMessage,
    };
    const message = AetherApp.prototype.formatChatFailureMessage.call(
      app,
      new Error(
        "BOSS brain model qwen3-14b-instruct is still warming up after about 90 seconds. Diagnostics are in the local worker log: C:/bios/logs/local-worker-sidecar-claw-boss_brain.log",
      ),
    );

    expect(message).toContain("BOSS brain is still loading the selected local model");
    expect(message).toContain("BIOS AI kept the GPU runtime running");
    expect(message).toContain("choose the recommended ready BOSS model");
    expect(message).not.toContain("C:/bios/logs");
  });

  it("uses a saved LM Studio route as the direct local BOSS provider without requiring an API key", async () => {
    const thinkingNode = createThinkingNode();
    localStorage.setItem(
      "bios-ai-onboarding",
      JSON.stringify({
        preferredLocalBackend: "lmstudio",
      }),
    );
    window.__TAURI__.core.invoke.mockImplementation(async (command, payload) => {
      if (command === "append_debug_log") {
        return null;
      }
      if (command === "load_provider_config") {
        return {
          active_provider: "lmstudio",
          active_model: "",
          keys: [],
          conversation_history: [],
        };
      }
      if (command === "load_bios_profile") {
        return {
          profile: { id: "claw", display_name: "Claw", completed: true },
          onboarding: {
            agent_name: "Claw",
            completed: true,
            model_pref: "local",
            preferred_local_backend: "lmstudio",
          },
        };
      }
      if (command === "bios_shell_contract") {
        return {
          runtime: {
            route_ready: true,
            worker_ready: true,
          },
        };
      }
      if (command === "load_agent_identity") {
        return "";
      }
      if (command === "load_bios_memory_surface") {
        return {
          total_events: 1,
          standing_orders: [{ summary: "Never fake BIOS powers." }],
          user_preferences: [],
          mission_facts: [],
          relationship_notes: [],
          identity_notes: [],
          skill_candidates: [],
          pending_approval_changes: [],
          promotion_queue: [],
          recent_events: [],
          consolidated_memory: [],
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
      if (command === "system_discovery") {
        return {
          machine_profile: {
            os: "windows",
            arch: "x86_64",
            logical_cores: 20,
            total_memory_gb: 32,
            gpu_name: "RTX 4080",
            gpu_vendor: "NVIDIA",
            gpu_vram_gb: 16,
          },
        };
      }
      if (command === "chat_with_llm") {
        expect(payload.provider).toBe("lmstudio");
        expect(payload.apiKey).toBe("");
        expect(payload.model).toBe("");
        expect(payload.messages.at(-1)).toEqual({ role: "user", text: "Hello there" });
        expect(payload.systemPrompt).toContain("Do not say you inspected the machine");
        expect(payload.systemPrompt).toContain("Never fake BIOS powers.");
        expect(payload.systemPrompt).toContain("Logical cores: 20");
        return "LM Studio BIOS AI reply";
      }
      if (command === "save_provider_config") {
        return null;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const app = {
      agentName: "BIOS AI",
      gateway: {
        isConnected: false,
        request: vi.fn(),
      },
      chat: {
        setBusy: vi.fn(),
        appendMessage: vi.fn(() => thinkingNode),
        scrollToBottom: vi.fn(),
      },
      subtitles: { update: vi.fn() },
      orb: { setState: vi.fn() },
      liveToolStatuses: new Map(),
      refreshHeroStatus: vi.fn(),
      normalizeStatusText: AetherApp.prototype.normalizeStatusText,
      shortenStatus: AetherApp.prototype.shortenStatus,
      summarizeUserIntent: AetherApp.prototype.summarizeUserIntent,
      getActiveBiosProfileId: AetherApp.prototype.getActiveBiosProfileId,
      getSavedOnboardingSnapshot: AetherApp.prototype.getSavedOnboardingSnapshot,
      currentRunStatus: "",
      pendingBackgroundStatus: "",
      runInProgress: false,
      activeBiosProfileId: "claw",
      _conversationHistory: [],
    };

    const result = await AetherApp.prototype.sendChatMessage.call(app, "Hello there");

    expect(result).toBe(true);
    expect(thinkingNode.innerText).toBe("LM Studio BIOS AI reply");
    expect(app.subtitles.update).toHaveBeenLastCalledWith("BIOS AI responded.");
  });

  it("renders BIOS-owned local tool events when the offline BOSS uses the local action lane", async () => {
    const thinkingNode = createThinkingNode();
    window.__TAURI__.core.invoke.mockImplementation(async (command, payload) => {
      if (command === "append_debug_log") {
        return null;
      }
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
            route_ready: true,
            worker_ready: true,
            worker_lanes: [
              {
                role: "small_worker",
                ready: true,
                role_label: "Small worker",
                selected_model_id: "gemma-3-1b-it",
              },
            ],
            next_step: "You can start chatting now.",
          },
        };
      }
      if (command === "load_bios_profile") {
        return {
          profile: { id: "claw", display_name: "Claw", completed: true },
          onboarding: {
            agent_name: "Claw",
            completed: true,
            model_pref: "local",
            local_runtime_owner: "bios-managed",
            local_worker_model_variant: "qwen-3-8b",
          },
        };
      }
      if (command === "load_bios_memory_surface") {
        return {
          totalEvents: 1,
          standingOrders: [{ text: "Never fake BIOS powers." }],
          userPreferences: [],
          missionFacts: [],
          consolidatedMemory: [],
          pending_approval_changes: [],
        };
      }
      if (command === "load_bios_observation_state") {
        return {
          label: "BIOS Home",
          bodySummary: "Visible local shell is standing by.",
        };
      }
      if (command === "load_bios_skill_library") {
        return {
          hardenedSkillCount: 0,
          artifacts: [],
        };
      }
      if (command === "load_bios_local_connector_status") {
        return { connectors: [] };
      }
      if (command === "bios_local_tool_registry") {
        return {
          tools: [
            {
              name: "machine.inspect",
              label: "Inspect machine profile",
              summary: "Read the real local machine profile BIOS AI discovered.",
              approval_required: false,
              execution_class: "safe_local_read",
            },
          ],
        };
      }
      if (command === "system_discovery") {
        return {
          machine_profile: {
            os: "windows",
            arch: "x86_64",
            logical_cores: 20,
            total_memory_gb: 32,
            gpu_name: "RTX 4080",
            gpu_vendor: "NVIDIA",
            gpu_vram_gb: 16,
          },
        };
      }
      if (command === "chat_with_local_worker") {
        const systemPrompt = payload.systemPrompt || "";
        if (systemPrompt.includes("local runtime turn planner")) {
          return JSON.stringify({
            mode: "act",
            reason: "The user asked for a real system check.",
            actions: [{ kind: "tool", name: "machine.inspect", arguments: {} }],
          });
        }
        if (systemPrompt.includes("Real BIOS action results")) {
          return "I checked the real BIOS machine profile. This system has 20 logical cores.";
        }
        return "Fallback local reply";
      }
      if (command === "invoke_bios_local_tool") {
        return {
          ok: true,
          tool_name: "machine.inspect",
          state: "completed",
          summary: "Loaded the real BIOS AI machine profile.",
          detail: "20 cores, 32 GB RAM, GPU: RTX 4080",
          data: { machine_profile: { logical_cores: 20 } },
        };
      }
      if (command === "save_provider_config") {
        return null;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const app = {
      agentName: "BIOS AI",
      gateway: {
        isConnected: false,
        request: vi.fn(),
      },
      chat: {
        setBusy: vi.fn(),
        appendMessage: vi.fn(() => thinkingNode),
        handleToolEvent: vi.fn(),
        scrollToBottom: vi.fn(),
      },
      subtitles: { update: vi.fn() },
      orb: { setState: vi.fn() },
      liveToolStatuses: new Map(),
      refreshHeroStatus: vi.fn(),
      normalizeStatusText: AetherApp.prototype.normalizeStatusText,
      shortenStatus: AetherApp.prototype.shortenStatus,
      summarizeUserIntent: AetherApp.prototype.summarizeUserIntent,
      getActiveBiosProfileId: AetherApp.prototype.getActiveBiosProfileId,
      getSavedOnboardingSnapshot: AetherApp.prototype.getSavedOnboardingSnapshot,
      getRuntimeTransportClient: AetherApp.prototype.getRuntimeTransportClient,
      activeBiosProfileId: "claw",
      runtimeTransport: null,
      currentRunStatus: "",
      pendingBackgroundStatus: "",
      runInProgress: false,
      _conversationHistory: [],
    };

    const result = await AetherApp.prototype.sendChatMessage.call(app, "Check my system specs");

    expect(result).toBe(true);
    expect(app.chat.handleToolEvent).toHaveBeenCalledTimes(2);
    expect(thinkingNode.innerText).toContain("20 logical cores");
  });
});
