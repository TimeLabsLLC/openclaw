import { describe, expect, it, vi } from "vitest";
import { runLocalRuntimeTurn } from "./local-runtime-turn.js";

function buildCapabilityPosture(overrides = {}) {
  return {
    summary:
      "Local chat is live with BIOS memory recall, BIOS shell observation, BIOS-owned local tools, and a real BIOS connector lane available.",
    reflexSurface: {
      ready: true,
      skill_candidate_count: 2,
      hardened_skill_count: 1,
      synapse_event_count: 5,
      top_skill_candidate: "Patch in sandbox first.",
      strongest_hardened_skill: "Validate before promotion.",
      schema_summary: "bios-shared-v1 reflex labels active",
      top_tag_label: "Skill candidate",
      top_evidence_label: "User approved",
      top_state_label: "Validating",
    },
    reflexSummary: {
      ready: true,
      candidateCount: 2,
      hardenedCount: 1,
      synapseCount: 5,
      topCandidate: "Patch in sandbox first.",
      strongestHardened: "Validate before promotion.",
      schemaSummary: "bios-shared-v1 reflex labels active",
      topTagLabel: "Skill candidate",
      topEvidenceLabel: "User approved",
      topStateLabel: "Validating",
    },
    connectorStatus: {
      connectors: [
        {
          connector: "telegram",
          ready: true,
          enabled: true,
          allowed_actions: ["send_message"],
          target_summary: "@nick",
          label: "Telegram",
          detail: "Telegram is ready.",
        },
      ],
    },
    ...overrides,
  };
}

describe("runLocalRuntimeTurn", () => {
  it("falls back to plain reply flow when no action planning is needed", async () => {
    const buildFallbackReply = vi.fn(async () => ({
      ok: true,
      responseText: "Plain local reply",
      conversationHistory: [
        { role: "user", text: "Hello there" },
        { role: "assistant", text: "Plain local reply" },
      ],
      actionResults: [],
      actionEvents: [],
    }));

    const result = await runLocalRuntimeTurn({
      tauriInvoke: vi.fn(),
      profileId: "claw",
      agentName: "Claw",
      normalizedText: "Hello there",
      conversationHistory: [],
      capabilityPosture: buildCapabilityPosture(),
      invokeReasoner: vi.fn(),
      buildFallbackReply,
    });

    expect(buildFallbackReply).toHaveBeenCalled();
    expect(result.responseText).toBe("Plain local reply");
    expect(result.actionResults).toEqual([]);
  });

  it("plans and runs a BIOS-owned local tool before synthesizing the answer", async () => {
    const tauriInvoke = vi.fn(async (command, payload) => {
      if (command === "record_bios_nervous_system_event") {
        expect(payload.input.signal).toBe("reflex.planning_context_loaded");
        expect(payload.input.source).toBe("reflex");
        expect(payload.input.state).toBe("validating");
        return { total_signals: 1 };
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
      if (command === "invoke_bios_local_tool") {
        expect(payload.input.name).toBe("machine.inspect");
        return {
          ok: true,
          tool_name: "machine.inspect",
          state: "completed",
          summary: "Loaded the real BIOS AI machine profile.",
          detail: "20 cores, 32 GB RAM, GPU: RTX 4080",
          data: { machine_profile: { logical_cores: 20 } },
        };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const invokeReasoner = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({
          mode: "act",
          reason: "The user asked for a real machine check.",
          actions: [{ kind: "tool", name: "machine.inspect", arguments: {} }],
        }),
      )
      .mockResolvedValueOnce(
        "I checked the real BIOS machine profile. This system has 20 logical cores.",
      );

    const result = await runLocalRuntimeTurn({
      tauriInvoke,
      profileId: "claw",
      agentName: "Claw",
      normalizedText: "Check my system specs",
      conversationHistory: [],
      capabilityPosture: buildCapabilityPosture(),
      invokeReasoner,
      buildFallbackReply: vi.fn(),
    });

    expect(result.responseText).toContain("20 logical cores");
    expect(tauriInvoke).toHaveBeenCalledWith("record_bios_nervous_system_event", {
      input: expect.objectContaining({
        profile_id: "claw",
        signal: "reflex.planning_context_loaded",
        tags: ["skill_candidate", "pattern_observed", "validating"],
      }),
    });
    expect(invokeReasoner.mock.calls[0][0].systemPrompt).toContain(
      "Learned BIOS reflexes and synapses",
    );
    expect(invokeReasoner.mock.calls[0][0].systemPrompt).toContain("Patch in sandbox first.");
    expect(invokeReasoner.mock.calls[0][0].systemPrompt).toContain("Validate before promotion.");
    expect(invokeReasoner.mock.calls[0][0].systemPrompt).toContain(
      "Use learned reflexes to prefer safer known patterns",
    );
    expect(invokeReasoner.mock.calls[1][0].systemPrompt).toContain(
      "Learned BIOS reflexes and synapses",
    );
    expect(result.actionResults).toHaveLength(1);
    expect(result.actionResults[0].displayName).toBe("Inspect machine profile");
    expect(result.actionEvents).toHaveLength(2);
  });

  it("returns BIOS approval truth when a guarded local action is queued", async () => {
    const tauriInvoke = vi.fn(async (command) => {
      if (command === "record_bios_nervous_system_event") {
        return { total_signals: 1 };
      }
      if (command === "bios_local_tool_registry") {
        return {
          tools: [
            {
              name: "runtime.model.select_managed",
              label: "Select BIOS managed model",
              summary: "Bind an installed BIOS AI managed local model to this BOSS profile.",
              approval_required: true,
              execution_class: "approval_required_host_action",
            },
          ],
        };
      }
      if (command === "invoke_bios_local_tool") {
        return {
          ok: false,
          tool_name: "runtime.model.select_managed",
          state: "pending_approval",
          summary: "Approval is required before BIOS AI can run Select BIOS managed model.",
          detail:
            "Bind an installed BIOS AI managed local model to this BOSS profile stays queued until you approve or reject it through BIOS-owned approval flow.",
          approval_required: true,
          approval_id: "approval-1",
          data: {},
        };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const invokeReasoner = vi.fn().mockResolvedValue(
      JSON.stringify({
        mode: "act",
        reason: "The user asked me to change the managed model.",
        actions: [
          {
            kind: "tool",
            name: "runtime.model.select_managed",
            arguments: { variant: "qwen-3-14b" },
          },
        ],
      }),
    );

    const result = await runLocalRuntimeTurn({
      tauriInvoke,
      profileId: "claw",
      agentName: "Claw",
      normalizedText: "Switch my BOSS brain to qwen 14b",
      conversationHistory: [],
      capabilityPosture: buildCapabilityPosture(),
      invokeReasoner,
      buildFallbackReply: vi.fn(),
    });

    expect(result.responseText).toContain("Approval is required");
    expect(result.actionResults[0].approvalRequired).toBe(true);
    expect(result.actionEvents[1].data.requiresApproval).toBe(true);
  });

  it("lets learned reflexes prefer safe validation before guarded host changes", async () => {
    const invokedTools = [];
    const tauriInvoke = vi.fn(async (command, payload) => {
      if (command === "record_bios_nervous_system_event") {
        return { total_signals: 1 };
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
            {
              name: "runtime.model.select_managed",
              label: "Select BIOS managed model",
              summary: "Bind an installed BIOS AI managed local model to this BOSS profile.",
              approval_required: true,
              execution_class: "approval_required_host_action",
            },
          ],
        };
      }
      if (command === "invoke_bios_local_tool") {
        invokedTools.push(payload.input.name);
        if (payload.input.name === "machine.inspect") {
          return {
            ok: true,
            tool_name: "machine.inspect",
            state: "completed",
            summary: "Loaded the real BIOS AI machine profile.",
            detail: "The selected model fits after validation.",
            data: { machine_profile: { logical_cores: 20 } },
          };
        }
        return {
          ok: false,
          tool_name: "runtime.model.select_managed",
          state: "pending_approval",
          summary: "Approval is required before BIOS AI can run Select BIOS managed model.",
          detail: "Model selection stays queued until you approve it.",
          approval_required: true,
          approval_id: "approval-2",
          data: {},
        };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const invokeReasoner = vi.fn().mockResolvedValue(
      JSON.stringify({
        mode: "act",
        reason:
          "The user asked to switch models, and the planner listed the guarded mutation first.",
        actions: [
          {
            kind: "tool",
            name: "runtime.model.select_managed",
            arguments: { variant: "qwen-3-14b" },
          },
          { kind: "tool", name: "machine.inspect", arguments: {} },
        ],
      }),
    );

    const result = await runLocalRuntimeTurn({
      tauriInvoke,
      profileId: "claw",
      agentName: "Claw",
      normalizedText: "Check whether qwen 14b fits and switch my BOSS brain if it does",
      conversationHistory: [],
      capabilityPosture: buildCapabilityPosture({
        reflexSummary: {
          ready: true,
          candidateCount: 2,
          hardenedCount: 1,
          synapseCount: 7,
          topCandidate: "Inspect machine fit before model promotion.",
          strongestHardened: "Validate before promotion.",
          schemaSummary: "bios-shared-v1 reflex labels active",
          topTagLabel: "Skill candidate",
          topEvidenceLabel: "User approved",
          topStateLabel: "Validating",
        },
      }),
      invokeReasoner,
      buildFallbackReply: vi.fn(),
    });

    expect(invokedTools).toEqual(["machine.inspect", "runtime.model.select_managed"]);
    expect(result.actionResults.map((item) => item.eventName)).toEqual([
      "machine.inspect",
      "runtime.model.select_managed",
    ]);
    expect(result.responseText).toContain("Approval is required");
  });

  it("can run a BIOS-owned local connector action through the same turn loop", async () => {
    const tauriInvoke = vi.fn(async (command, payload) => {
      if (command === "record_bios_nervous_system_event") {
        return { total_signals: 1 };
      }
      if (command === "bios_local_tool_registry") {
        return { tools: [] };
      }
      if (command === "invoke_bios_local_connector") {
        expect(payload.input.connector).toBe("telegram");
        expect(payload.input.action).toBe("send_message");
        return {
          ok: true,
          connector: "telegram",
          action: "send_message",
          state: "completed",
          summary: "Telegram message sent through BIOS AI.",
          detail: "Delivered to @nick.",
          approval_required: false,
          approval_id: null,
          data: { delivered: true },
        };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const invokeReasoner = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({
          mode: "act",
          reason: "The user asked to send a Telegram message.",
          actions: [
            {
              kind: "connector",
              connector: "telegram",
              action: "send_message",
              arguments: { text: "Build is green." },
            },
          ],
        }),
      )
      .mockResolvedValueOnce("I sent the Telegram message through the BIOS-owned connector lane.");

    const result = await runLocalRuntimeTurn({
      tauriInvoke,
      profileId: "claw",
      agentName: "Claw",
      normalizedText: "Send a Telegram message that the build is green",
      conversationHistory: [],
      capabilityPosture: buildCapabilityPosture(),
      invokeReasoner,
      buildFallbackReply: vi.fn(),
    });

    expect(result.responseText).toContain("Telegram");
    expect(result.actionResults[0].kind).toBe("connector");
    expect(result.actionEvents).toHaveLength(2);
  });

  it("blocks unregistered local action plans instead of falling back into fake capability chat", async () => {
    const buildFallbackReply = vi.fn();
    const tauriInvoke = vi.fn(async (command) => {
      if (command === "record_bios_nervous_system_event") {
        return { total_signals: 1 };
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
      throw new Error(`Unexpected command: ${command}`);
    });

    const invokeReasoner = vi.fn().mockResolvedValue(
      JSON.stringify({
        mode: "act",
        reason: "The user asked for an action I cannot really run.",
        actions: [
          {
            kind: "tool",
            name: "filesystem.delete_everything",
            arguments: { path: "C:/" },
          },
        ],
      }),
    );

    const result = await runLocalRuntimeTurn({
      tauriInvoke,
      profileId: "claw",
      agentName: "Claw",
      normalizedText: "Delete everything on my system",
      conversationHistory: [],
      capabilityPosture: buildCapabilityPosture({ connectorStatus: { connectors: [] } }),
      invokeReasoner,
      buildFallbackReply,
    });

    expect(buildFallbackReply).not.toHaveBeenCalled();
    expect(result.responseText).toContain("blocked an unregistered local action plan");
    expect(result.responseText).toContain("machine.inspect");
    expect(result.actionResults).toHaveLength(1);
    expect(result.actionResults[0].state).toBe("blocked");
    expect(result.actionEvents[1].data.isError).toBe(true);
  });
});
