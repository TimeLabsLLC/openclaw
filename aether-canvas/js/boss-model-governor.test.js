import { describe, expect, it } from "vitest";
import {
  appendBossModelGovernanceHistory,
  buildBossModelGovernanceDecision,
  buildBossLocalSupportPlan,
  buildBossWorkerRosterAssignments,
  chooseBossChatRoute,
  chooseBossCloudKey,
  chooseBossManagedWorkerVariant,
  chooseBossWorkerRoleForTurn,
} from "./boss-model-governor.js";

describe("boss-model-governor", () => {
  it("prefers the strongest ranked cloud provider when BIOS AI is allowed to choose freely", () => {
    const chosen = chooseBossCloudKey(
      [
        { provider: "openrouter", key: "or-key" },
        { provider: "anthropic", key: "an-key" },
      ],
      { permissionMode: "allowed" },
    );

    expect(chosen?.provider).toBe("anthropic");
  });

  it("keeps the current cloud provider when ask-first is active", () => {
    const chosen = chooseBossCloudKey(
      [
        { provider: "openai", key: "oa-key" },
        { provider: "anthropic", key: "an-key" },
      ],
      { currentProvider: "openai", permissionMode: "not_allowed" },
    );

    expect(chosen?.provider).toBe("openai");
  });

  it("keeps explicit boss-brain selection while marking support workers as ask-first", () => {
    const supportPlan = buildBossLocalSupportPlan({
      machineProfile: { logical_cores: 16, total_memory_gb: 32 },
      bossVariant: "gemma-3-4b",
      installedVariants: ["gemma-3-4b"],
      permissionMode: "not_allowed",
    });

    expect(supportPlan).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variant: "gemma-3-1b",
          status: "ask-first-before-adding",
        }),
        expect.objectContaining({
          variant: "gemma-3-12b",
          status: "ask-first-before-adding",
        }),
        expect.objectContaining({
          variant: "qwen-3-8b",
          status: "ask-first-before-adding",
        }),
        expect.objectContaining({
          variant: "qwen-3-14b",
          status: "ask-first-before-adding",
        }),
      ]),
    );
  });

  it("reuses an explicit installed boss-brain variant before making a recommendation", () => {
    const variant = chooseBossManagedWorkerVariant({
      selectedVariant: "gemma-3-1b",
      installedModels: [{ variant: "gemma-3-1b" }, { variant: "qwen-3-8b" }],
      machineProfile: { logical_cores: 16, total_memory_gb: 32 },
      modelPref: "local",
      hasCloudKey: false,
    });

    expect(variant).toBe("gemma-3-1b");
  });

  it("derives a boss-medium-small managed roster from the chosen boss brain", () => {
    const roster = buildBossWorkerRosterAssignments({
      machineProfile: { logical_cores: 16, total_memory_gb: 32, gpu_vram_gb: 16 },
      bossVariant: "qwen-3-14b",
    });

    expect(roster).toEqual([
      { role: "boss_brain", variant: "qwen-3-14b", path: null },
      { role: "medium_worker", variant: "qwen-3-8b", path: null },
      { role: "small_worker", variant: "gemma-3-1b", path: null },
    ]);
  });

  it("routes short formatting turns to the small worker when that lane is ready", () => {
    const route = chooseBossWorkerRoleForTurn({
      normalizedText: "Summarize this in bullets",
      runtimeStatus: {
        worker_ready: true,
        worker_lanes: [
          { role: "boss_brain", ready: true, selected_model_id: "qwen3-14b-instruct" },
          { role: "medium_worker", ready: true, selected_model_id: "qwen3-8b-instruct" },
          { role: "small_worker", ready: true, selected_model_id: "gemma-3-1b-it" },
        ],
      },
    });

    expect(route).toEqual({
      role: "small_worker",
      reason: "Short or formatting-heavy turn routed to the small worker.",
    });
  });

  it("keeps higher-context turns on the BOSS brain", () => {
    const route = chooseBossWorkerRoleForTurn({
      normalizedText:
        "Plan the BIOS AI runtime architecture and explain the worker-governance tradeoffs.",
      runtimeStatus: {
        worker_ready: true,
        worker_lanes: [
          { role: "boss_brain", ready: true, selected_model_id: "qwen3-14b-instruct" },
          { role: "medium_worker", ready: true, selected_model_id: "qwen3-8b-instruct" },
          { role: "small_worker", ready: true, selected_model_id: "gemma-3-1b-it" },
        ],
      },
    });

    expect(route.role).toBe("boss_brain");
  });

  it("keeps hybrid ask-first local by default and broad-authority hybrid cloud by default", () => {
    const askFirstRoute = chooseBossChatRoute({
      onboardingState: {
        modelPref: "hybrid",
        permissionMode: "not_allowed",
        preferredLocalBackend: "bios-managed",
      },
      providerConfig: {
        active_provider: "openai",
        keys: [{ provider: "openai", key: "oa-key" }],
      },
      runtimeStatus: {
        preferred_local_backend: "bios-managed",
        local_backend_reachable: true,
        worker_ready: true,
      },
    });
    const allowedRoute = chooseBossChatRoute({
      onboardingState: {
        modelPref: "hybrid",
        permissionMode: "allowed",
        preferredLocalBackend: "bios-managed",
      },
      providerConfig: {
        active_provider: "openai",
        keys: [{ provider: "openai", key: "oa-key" }],
      },
      runtimeStatus: {
        preferred_local_backend: "bios-managed",
        local_backend_reachable: true,
        worker_ready: true,
      },
    });

    expect(askFirstRoute.provider).toBe("bios-managed");
    expect(allowedRoute.provider).toBe("openai");
  });

  it("prefers the saved cloud choice instead of a local runtime provider when choosing a cloud lane", () => {
    const route = chooseBossChatRoute({
      onboardingState: {
        modelPref: "commercial",
        permissionMode: "allowed",
        preferredLocalBackend: "bios-managed",
        preferredCloudProvider: "anthropic",
      },
      providerConfig: {
        active_provider: "bios-managed",
        keys: [
          { provider: "openai", key: "oa-key" },
          { provider: "anthropic", key: "an-key" },
        ],
      },
      runtimeStatus: {
        preferred_local_backend: "bios-managed",
        local_backend_reachable: true,
        worker_ready: true,
      },
    });

    expect(route.provider).toBe("anthropic");
    expect(route.apiKey).toBe("an-key");
  });

  it("requires approval before adding an installed worker lane when ask-first authority is active", () => {
    const decision = buildBossModelGovernanceDecision({
      normalizedText: "Summarize this as bullets",
      onboardingState: {
        modelPref: "local",
        permissionMode: "not_allowed",
        localWorkerModelVariant: "qwen-3-14b",
      },
      runtimeStatus: {
        worker_ready: true,
        worker_lanes: [{ role: "boss_brain", ready: true }],
      },
      currentRoster: [{ role: "boss_brain", variant: "qwen-3-14b" }],
      workerCatalog: {
        machine_profile: { logical_cores: 20, total_memory_gb: 64, gpu_vram_gb: 16 },
        entries: [
          { variant: "qwen-3-14b", enabled: true, installed: true, managed: true },
          { variant: "qwen-3-8b", enabled: true, installed: true, managed: true },
          { variant: "gemma-3-1b", enabled: true, installed: true, managed: true },
        ],
      },
      now: 1000,
    });

    expect(decision.action).toBe("recommend_roster_change");
    expect(decision.requiresApproval).toBe(true);
    expect(decision.role).toBe("boss_brain");
    expect(decision.targetRole).toBe("small_worker");
    expect(decision.historyEvent).toEqual(
      expect.objectContaining({
        action: "recommend_roster_change",
        desiredRole: "small_worker",
        permissionBoundary: "not_allowed",
      }),
    );
  });

  it("applies an installed worker lane under broad authority without changing route law", () => {
    const decision = buildBossModelGovernanceDecision({
      normalizedText:
        "Draft three caption options for this release and compare which one is clearest for a first-time user",
      onboardingState: {
        modelPref: "hybrid",
        permissionMode: "allowed",
        localWorkerModelVariant: "qwen-3-14b",
      },
      runtimeStatus: {
        worker_ready: true,
        worker_lanes: [{ role: "boss_brain", ready: true }],
      },
      currentRoster: [{ role: "boss_brain", variant: "qwen-3-14b" }],
      workerCatalog: {
        machine_profile: { logical_cores: 20, total_memory_gb: 64, gpu_vram_gb: 16 },
        entries: [
          { variant: "qwen-3-14b", enabled: true, installed: true, managed: true },
          { variant: "qwen-3-8b", enabled: true, installed: true, managed: true },
          { variant: "gemma-3-1b", enabled: true, installed: true, managed: true },
        ],
      },
    });

    expect(decision.action).toBe("apply_roster_change");
    expect(decision.role).toBe("medium_worker");
    expect(decision.nextRoster).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "boss_brain", variant: "qwen-3-14b" }),
        expect.objectContaining({ role: "medium_worker", variant: "qwen-3-8b" }),
      ]),
    );
  });

  it("blocks local worker reassignment while the profile route is cloud-only", () => {
    const decision = buildBossModelGovernanceDecision({
      normalizedText: "Summarize this",
      onboardingState: {
        modelPref: "commercial",
        permissionMode: "allowed",
        localWorkerModelVariant: "qwen-3-14b",
      },
      runtimeStatus: {
        worker_ready: true,
        worker_lanes: [{ role: "boss_brain", ready: true }],
      },
    });

    expect(decision.action).toBe("blocked_by_route");
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("Cloud BOSS posture blocks");
  });

  it("persists compact model-governance history into the BOSS profile snapshot", () => {
    const snapshot = appendBossModelGovernanceHistory(
      { modelPref: "local", permissionMode: "allowed", bossModelGovernance: { history: [] } },
      {
        reason: "Broad authority lets BIOS AI add the installed worker lane now.",
        historyEvent: {
          timestamp: 2000,
          action: "apply_roster_change",
          desiredRole: "medium_worker",
          targetVariant: "qwen-3-8b",
          rationale: "Mid-weight synthesis turn fits the medium worker.",
        },
      },
    );

    expect(snapshot.bossModelGovernance.lastDecision.action).toBe("apply_roster_change");
    expect(snapshot.bossModelGovernance.history[0].targetVariant).toBe("qwen-3-8b");
    expect(snapshot.bossModelGovernance.routeBoundary).toBe("local");
  });
});
