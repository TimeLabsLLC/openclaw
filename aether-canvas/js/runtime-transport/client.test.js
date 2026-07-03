import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBiosRuntimeTransportClient } from "./client.js";

describe("BIOS runtime transport client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.__TAURI__ = {
      core: {
        invoke: vi.fn(async (command, payload) => {
          if (command === "append_debug_log") {
            return null;
          }
          if (command === "load_provider_config") {
            return {
              active_provider: "",
              active_model: "",
              keys: [],
              conversation_history: [
                { role: "user", text: "Remember the build doctrine." },
                { role: "assistant", text: "Truth first, capability second." },
              ],
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
                preferred_local_backend: "bios-managed",
              },
            };
          }
          if (command === "load_bios_profile") {
            return {
              profile: { id: payload?.profileId || "claw", display_name: "Claw", completed: true },
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
              total_events: 3,
              standing_orders: [{ id: "1", summary: "Never fake capability claims." }],
              user_preferences: [],
              mission_facts: [{ id: "2", summary: "BIOS is local-first." }],
              relationship_notes: [],
              identity_notes: [],
              skill_candidates: [],
              pending_approval_changes: [],
              promotion_queue: [],
              recent_events: [],
              consolidated_memory: [{ id: "3", summary: "Use sandbox before host promotion." }],
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
              strongest_skill: "Validate in sandbox before host promotion.",
              strongest_reinforcement: 2,
              artifacts: [
                {
                  id: "skill-1",
                  summary: "Validate in sandbox before host promotion.",
                  reinforcement_count: 2,
                },
              ],
            };
          }
          if (command === "load_bios_truth_spine_state") {
            return {
              ready: true,
              readiness: "ready",
              governance_state: "clear",
              summary: "BOSS operating truth has folded runtime truth.",
              record_count: 2,
              tiny_pack: {
                readiness: "ready",
                governance_state: "clear",
                compact_summary: "Use sandbox-first execution before host promotion.",
                body_inputs: ["memory: 3 event(s), 1 durable item(s)"],
                active_decisions: ["Use sandbox-first execution before host promotion."],
                dead_ends: [],
                next_actions: [],
                warnings: [],
              },
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
          if (command === "worker_model_catalog") {
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
              entries: [
                { variant: "qwen-3-14b", enabled: true, installed: true, managed: true },
                { variant: "qwen-3-8b", enabled: true, installed: true, managed: true },
                { variant: "gemma-3-1b", enabled: true, installed: true, managed: true },
              ],
            };
          }
          if (command === "load_bios_local_connector_status") {
            return {
              profile_id: payload?.profileId || "claw",
              connectors: [
                {
                  connector: "telegram",
                  configured: true,
                  ready: true,
                  enabled: true,
                  profile_bound: true,
                  has_key: true,
                  permission_mode: "allowed",
                  target_summary: "Bound to Telegram target 123456",
                  allowed_actions: ["send_message"],
                  label: "Telegram connector ready",
                  detail:
                    "BIOS AI can use Telegram through this profile-bound connector. Permission mode: broad authority.",
                },
              ],
            };
          }
          if (command === "invoke_bios_local_tool") {
            if (payload?.input?.name === "machine.inspect") {
              return {
                ok: true,
                tool_name: "machine.inspect",
                category: "machine_inspection",
                state: "completed",
                approval_required: false,
                approval_id: null,
                summary: "Loaded the real BIOS AI machine profile.",
                detail: "20 cores, 32 GB RAM, GPU: RTX 4080",
                data: {
                  machine_profile: {
                    os: "windows",
                    arch: "x86_64",
                  },
                },
              };
            }
            return {
              ok: false,
              tool_name: payload?.input?.name || "unknown",
              category: "profile_mutation",
              state: "pending_approval",
              approval_required: true,
              approval_id: "approval-1",
              summary: "Approval required.",
              detail: "Queued for BIOS approval.",
              data: {},
            };
          }
          if (command === "resolve_bios_local_approval") {
            return {
              ok: true,
              tool_name: "profile.runtime_preferences.update",
              category: "profile_mutation",
              state: "completed",
              approval_required: false,
              approval_id: payload?.input?.approval_id || "approval-1",
              summary: "Updated BIOS runtime preferences for this BOSS profile.",
              detail: "Authority: allowed | Route: hybrid | Local backend: bios-managed",
              data: {
                profile: {
                  onboarding: {
                    model_pref: "hybrid",
                  },
                },
              },
            };
          }
          if (command === "record_bios_truth_session_update") {
            expect(payload?.input?.profile_id).toBe("claw");
            expect(payload?.input?.source_ref).toBe("local_supervisor");
            expect(payload?.input?.events?.[0]?.type).toBe("done");
            return {
              ready: true,
              readiness: "ready",
              governance_state: "clear",
              summary: "BOSS operating truth recorded this turn.",
              record_count: 3,
              tiny_pack: {
                readiness: "ready",
                governance_state: "clear",
                compact_summary: "BOSS operating truth recorded this turn.",
              },
            };
          }
          if (command === "invoke_bios_local_connector") {
            return {
              ok: true,
              connector: "telegram",
              action: "send_message",
              state: "completed",
              approval_required: false,
              approval_id: null,
              summary: "Telegram connector delivered the message through BIOS AI.",
              detail: "Sent a Telegram message to target 123456.",
              data: {
                ok: true,
                result: {
                  message_id: 99,
                },
              },
            };
          }
          if (command === "chat_with_local_worker") {
            expect(typeof payload?.systemPrompt).toBe("string");
            expect(payload?.workerRole).toBe("boss_brain");
            return "Local BIOS reply";
          }
          throw new Error(`Unexpected command: ${command}`);
        }),
      },
    };
  });

  it("chooses the gateway transport when the gateway is connected", async () => {
    const gateway = {
      isConnected: true,
      request: vi.fn(async (method) => {
        if (method === "skills.route") {
          return { decision: null };
        }
        if (method === "chat.send") {
          return { ok: true };
        }
        throw new Error(`Unexpected method: ${method}`);
      }),
    };
    const client = createBiosRuntimeTransportClient({
      gateway,
      getTauriInvoke: () => window.__TAURI__.core.invoke,
    });

    expect(client.getActiveTransportKind()).toBe("gateway");

    const result = await client.sendChatMessage({
      normalizedText: "Ship the lane",
      sessionKey: "session-1",
      recordRouteDecision: vi.fn(),
    });

    expect(result).toEqual({
      ok: true,
      transport: "gateway",
      delivery: "queued",
    });
  });

  it("chooses the local supervisor transport when the gateway is offline", async () => {
    const client = createBiosRuntimeTransportClient({
      gateway: {
        isConnected: false,
        request: vi.fn(),
      },
      getTauriInvoke: () => window.__TAURI__.core.invoke,
    });

    expect(client.getActiveTransportKind()).toBe("local-supervisor");

    const result = await client.sendChatMessage({
      normalizedText: "Hello there",
      agentName: "BIOS AI",
      profileId: "claw",
      onboardingState: {
        localWorkerModelVariant: "qwen-3-8b",
        localWorkerDownloadStatus: "completed",
      },
      conversationHistory: [],
    });

    expect(result.transport).toBe("local-supervisor");
    expect(result.delivery).toBe("immediate");
    expect(result.responseText).toBe("Local BIOS reply");
    expect(result.workerRole).toBe("boss_brain");
    expect(result.conversationHistory).toEqual([
      { role: "user", text: "Hello there" },
      { role: "assistant", text: "Local BIOS reply" },
    ]);
    expect(result.capabilityPosture.summary).toContain("saved shell history attached");
    expect(result.capabilityPosture.summary).toContain("compact BOSS operating truth attached");
  });

  it("blocks stale saved route hints when the native runtime contract is not route-ready", async () => {
    const calls = [];
    window.__TAURI__.core.invoke = vi.fn(async (command, payload) => {
      calls.push(command);
      if (command === "load_provider_config") {
        return {
          active_provider: "lmstudio",
          active_model: "qwen-local",
          keys: [],
          conversation_history: [],
        };
      }
      if (command === "bios_shell_contract") {
        return {
          runtime: {
            route_ready: false,
            worker_ready: true,
            local_backend_reachable: true,
            preferred_local_backend: "lmstudio",
            next_step: "Verify the BOSS brain route before chat.",
          },
        };
      }
      if (command === "load_bios_profile") {
        return {
          profile: { id: payload?.profileId || "claw", display_name: "Claw", completed: true },
          onboarding: {
            agent_name: "Claw",
            completed: true,
            model_pref: "local",
            preferred_local_backend: "lmstudio",
            local_worker_model_variant: "qwen-3-8b",
            local_worker_download_status: "completed",
          },
        };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const client = createBiosRuntimeTransportClient({
      gateway: {
        isConnected: false,
        request: vi.fn(),
      },
      getTauriInvoke: () => window.__TAURI__.core.invoke,
    });

    await expect(
      client.sendChatMessage({
        normalizedText: "Use the saved local route",
        agentName: "Claw",
        profileId: "claw",
        onboardingState: {
          completed: true,
          agentName: "Claw",
          modelPref: "local",
          preferredLocalBackend: "lmstudio",
          localWorkerModelVariant: "qwen-3-8b",
          localWorkerDownloadStatus: "completed",
        },
        conversationHistory: [],
      }),
    ).rejects.toThrow("Verify the BOSS brain route before chat.");

    expect(calls).toEqual(["load_provider_config", "bios_shell_contract"]);
  });

  it("loads local history through the same client interface when offline", async () => {
    const client = createBiosRuntimeTransportClient({
      gateway: {
        isConnected: false,
        request: vi.fn(),
      },
      getTauriInvoke: () => window.__TAURI__.core.invoke,
    });

    const history = await client.loadChatHistory({
      conversationHistory: [
        { role: "user", text: "One" },
        { role: "assistant", text: "Two" },
      ],
    });

    expect(history).toEqual({
      transport: "local-supervisor",
      messages: [
        { role: "user", text: "One" },
        { role: "assistant", text: "Two" },
      ],
    });
  });

  it("loads saved local history from the provider config when request history is empty", async () => {
    const client = createBiosRuntimeTransportClient({
      gateway: {
        isConnected: false,
        request: vi.fn(),
      },
      getTauriInvoke: () => window.__TAURI__.core.invoke,
    });

    const history = await client.loadChatHistory({
      profileId: "claw",
      conversationHistory: [],
    });

    expect(history.messages).toEqual([
      { role: "user", text: "Remember the build doctrine." },
      { role: "assistant", text: "Truth first, capability second." },
    ]);
  });

  it("lets broad-authority BOSS governance add an installed worker lane during a local turn", async () => {
    const calls = [];
    window.__TAURI__.core.invoke = vi.fn(async (command, payload) => {
      calls.push({ command, payload });
      if (command === "append_debug_log" || command === "record_bios_proof_event") return null;
      if (command === "load_provider_config") {
        return { active_provider: "", active_model: "", keys: [], conversation_history: [] };
      }
      if (command === "bios_shell_contract") {
        return {
          runtime: {
            route_ready: true,
            worker_ready: true,
            worker_lanes: [{ role: "boss_brain", ready: true }],
            preferred_local_backend: "bios-managed",
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
            permission_mode: "allowed",
            preferred_local_backend: "bios-managed",
            local_worker_model_variant: "qwen-3-14b",
            bios_worker_roster: [{ role: "boss_brain", variant: "qwen-3-14b" }],
          },
        };
      }
      if (command === "load_bios_memory_surface") {
        return { standing_orders: [], consolidated_memory: [], recent_events: [] };
      }
      if (command === "load_bios_observation_state") {
        return { label: "BIOS Home", detail: "Ready", ghosting_protected: true };
      }
      if (command === "load_bios_skill_library") {
        return { hardened_skill_count: 0, artifacts: [] };
      }
      if (command === "load_bios_truth_spine_state") {
        return {
          ready: true,
          readiness: "ready",
          governance_state: "clear",
          summary: "BOSS operating truth folded prior build truth.",
          record_count: 1,
          tiny_pack: {
            readiness: "ready",
            governance_state: "clear",
            compact_summary: "BOSS should choose worker models from truth.",
            body_inputs: ["proof: 1 record(s)"],
            active_decisions: ["BOSS chooses worker models."],
            dead_ends: [],
            next_actions: [],
            warnings: [],
          },
        };
      }
      if (command === "system_discovery") {
        return {
          machine_profile: {
            os: "windows",
            logical_cores: 20,
            total_memory_gb: 64,
            gpu_vram_gb: 16,
          },
        };
      }
      if (command === "load_bios_local_connector_status") {
        return { connectors: [] };
      }
      if (command === "bios_local_tool_registry") {
        return { tools: [] };
      }
      if (command === "worker_model_catalog") {
        return {
          machine_profile: { logical_cores: 20, total_memory_gb: 64, gpu_vram_gb: 16 },
          entries: [
            { variant: "qwen-3-14b", enabled: true, installed: true, managed: true },
            { variant: "qwen-3-8b", enabled: true, installed: true, managed: true },
            { variant: "gemma-3-1b", enabled: true, installed: true, managed: true },
          ],
        };
      }
      if (command === "save_worker_runtime_roster") {
        expect(payload.assignments).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ role: "boss_brain", variant: "qwen-3-14b" }),
            expect.objectContaining({ role: "medium_worker", variant: "qwen-3-8b" }),
          ]),
        );
        return payload.assignments;
      }
      if (command === "save_bios_profile") {
        expect(payload.input.onboarding.boss_model_governance.history[0].action).toBe(
          "apply_roster_change",
        );
        return { profile: { id: "claw", display_name: "Claw", completed: true } };
      }
      if (command === "load_agent_identity") return "";
      if (command === "chat_with_local_worker") {
        expect(payload.systemPrompt).toContain("Compact BOSS operating truth");
        expect(payload.systemPrompt).toContain("BOSS should choose worker models from truth.");
        expect(payload.workerRole).toBe("boss_brain");
        return "Medium worker reply";
      }
      if (command === "record_bios_truth_event") {
        expect(payload.input.source).toBe("local_worker_chat");
        expect(payload.input.source_body_part).toBe("brainstem");
        expect(payload.input.tags).toContain("boss_turn");
        return {
          ready: true,
          readiness: "ready",
          governance_state: "clear",
          summary: "BOSS turn recorded.",
          record_count: 2,
          tiny_pack: { readiness: "ready", governance_state: "clear" },
        };
      }
      if (command === "save_provider_config") return null;
      throw new Error(`Unexpected command: ${command}`);
    });

    const client = createBiosRuntimeTransportClient({
      gateway: { isConnected: false, request: vi.fn() },
      getTauriInvoke: () => window.__TAURI__.core.invoke,
    });

    const result = await client.sendChatMessage({
      normalizedText:
        "Draft three caption options for launch and compare which one is clearest for a first-time user",
      agentName: "Claw",
      profileId: "claw",
      conversationHistory: [],
    });

    expect(result.workerRole).toBe("boss_brain");
    expect(result.modelGovernance.action).toBe("apply_roster_change");
    expect(calls.some((call) => call.command === "record_bios_proof_event")).toBe(true);
    expect(calls.some((call) => call.command === "record_bios_truth_session_update")).toBe(true);
  });

  it("exposes local capability posture through the shared client interface", async () => {
    const client = createBiosRuntimeTransportClient({
      gateway: {
        isConnected: false,
        request: vi.fn(),
      },
      getTauriInvoke: () => window.__TAURI__.core.invoke,
    });

    const posture = await client.getCapabilityPosture({
      profileId: "claw",
      onboardingState: {
        modelPref: "local",
      },
    });

    expect(posture.transport).toBe("local-supervisor");
    expect(posture.chat.ready).toBe(true);
    expect(posture.savedHistory.ready).toBe(true);
    expect(posture.biosMemory.ready).toBe(true);
    expect(posture.observation.ready).toBe(true);
    expect(posture.skills.ready).toBe(true);
    expect(posture.connectors.ready).toBe(true);
    expect(posture.truthSpine.ready).toBe(true);
  });

  it("loads local memory surface through the shared client interface when offline", async () => {
    const client = createBiosRuntimeTransportClient({
      gateway: {
        isConnected: false,
        request: vi.fn(),
      },
      getTauriInvoke: () => window.__TAURI__.core.invoke,
    });

    const result = await client.loadMemorySurface({
      profileId: "claw",
    });

    expect(result.transport).toBe("local-supervisor");
    expect(result.surface.standingOrders[0].text).toBe("Never fake capability claims.");
    expect(result.surface.consolidatedMemory[0].text).toBe("Use sandbox before host promotion.");
  });

  it("invokes BIOS-owned local tools through the shared client interface when offline", async () => {
    const client = createBiosRuntimeTransportClient({
      gateway: {
        isConnected: false,
        request: vi.fn(),
      },
      getTauriInvoke: () => window.__TAURI__.core.invoke,
    });

    const result = await client.invokeTool({
      profileId: "claw",
      name: "machine.inspect",
      arguments: {},
    });

    expect(result.transport).toBe("local-supervisor");
    expect(result.ok).toBe(true);
    expect(result.tool_name).toBe("machine.inspect");
    expect(result.data.machine_profile.os).toBe("windows");
  });

  it("loads local connector status through the shared client interface when offline", async () => {
    const client = createBiosRuntimeTransportClient({
      gateway: {
        isConnected: false,
        request: vi.fn(),
      },
      getTauriInvoke: () => window.__TAURI__.core.invoke,
    });

    const result = await client.loadConnectorStatus({
      profileId: "claw",
    });

    expect(result.transport).toBe("local-supervisor");
    expect(result.connectors[0].connector).toBe("telegram");
    expect(result.connectors[0].ready).toBe(true);
  });

  it("invokes BIOS-owned local connectors through the shared client interface when offline", async () => {
    const client = createBiosRuntimeTransportClient({
      gateway: {
        isConnected: false,
        request: vi.fn(),
      },
      getTauriInvoke: () => window.__TAURI__.core.invoke,
    });

    const result = await client.invokeConnector({
      profileId: "claw",
      connector: "telegram",
      action: "send_message",
      arguments: {
        text: "hello",
      },
    });

    expect(result.transport).toBe("local-supervisor");
    expect(result.ok).toBe(true);
    expect(result.connector).toBe("telegram");
    expect(result.action).toBe("send_message");
  });

  it("resolves BIOS-owned local approvals through the shared client interface when offline", async () => {
    const client = createBiosRuntimeTransportClient({
      gateway: {
        isConnected: false,
        request: vi.fn(),
      },
      getTauriInvoke: () => window.__TAURI__.core.invoke,
    });

    const result = await client.resolveApproval({
      profileId: "claw",
      approvalId: "approval-1",
      decision: "approved",
    });

    expect(result.transport).toBe("local-supervisor");
    expect(result.ok).toBe(true);
    expect(result.approval_id).toBe("approval-1");
    expect(result.data.profile.onboarding.model_pref).toBe("hybrid");
  });
});
