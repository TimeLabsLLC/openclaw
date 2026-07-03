import { describe, expect, it, vi } from "vitest";
import {
  applyBiosSoulDecisionContract,
  buildProviderImportContractSelection,
  importDiscoveredProviderKeysContract,
  loadBiosSoulGovernanceContract,
  normalizeBiosMemorySurface,
  normalizeBiosSoulGovernanceSurface,
  normalizeBiosObservationState,
  normalizeBiosSkillLibrarySurface,
  normalizeSystemMachineProfile,
  readBiosBrainstemStatusFromContract,
  readBiosDreamStatusFromContract,
  readBiosMemoryStatusFromContract,
  readBiosOnboardingFromContract,
  readBiosSoulStatusFromContract,
  runBiosBrainstemTick,
} from "./bios-shell-contract.js";

describe("bios-shell-contract", () => {
  it("normalizes onboarding state from the native contract payload", () => {
    const onboarding = readBiosOnboardingFromContract({
      profile: {
        display_name: "Claw",
      },
      onboarding: {
        completed: true,
        agent_name: "",
        permission_mode: "ask",
        model_pref: "local",
        preferred_local_backend: "OLLAMA",
        bios_worker_roster: [{ role: "boss_brain", selection: { variant: "qwen-3-14b" } }],
        local_worker_download_status: "completed",
        ssh_key_types: ["ed25519"],
      },
    });

    expect(onboarding.agentName).toBe("Claw");
    expect(onboarding.preferredLocalBackend).toBe("ollama");
    expect(onboarding.biosWorkerRoster).toEqual([
      { role: "boss_brain", selection: { variant: "qwen-3-14b" } },
    ]);
    expect(onboarding.localWorkerDownloadStatus).toBe("completed");
    expect(onboarding.sshKeyTypes).toEqual(["ed25519"]);
  });

  it("builds a provider import payload with validated key ids", () => {
    expect(
      buildProviderImportContractSelection({
        profileId: "claw",
        keyIds: ["disc-openai-1", "", "disc-openai-2"],
        primaryKeyId: "disc-openai-2",
        preferredLocalBackend: "bios-managed",
      }),
    ).toEqual({
      profile_id: "claw",
      key_ids: ["disc-openai-1", "disc-openai-2"],
      primary_key_id: "disc-openai-2",
      preferred_local_backend: "bios-managed",
    });
  });

  it("rejects empty provider import selections", () => {
    expect(() => buildProviderImportContractSelection({})).toThrow(
      "Provider import selection needs a real BIOS profile first.",
    );
  });

  it("rejects provider import selections without a BIOS profile id", () => {
    expect(() =>
      buildProviderImportContractSelection({
        keyIds: ["disc-openai-1"],
      }),
    ).toThrow("Provider import selection needs a real BIOS profile first.");
  });

  it("rejects profile-scoped provider imports with no keys and no local backend", () => {
    expect(() =>
      buildProviderImportContractSelection({
        profileId: "claw",
      }),
    ).toThrow("Provider import selection needs imported keys or a local runtime choice.");
  });

  it("wraps provider import selection under the tauri command argument name", async () => {
    const tauriInvoke = vi.fn(async () => ({ imported_key_count: 1, active_provider: "openai" }));

    await importDiscoveredProviderKeysContract(tauriInvoke, {
      profileId: "claw",
      keyIds: ["disc-openai-1"],
      primaryKeyId: "disc-openai-1",
      preferredLocalBackend: "bios-managed",
    });

    expect(tauriInvoke).toHaveBeenCalledWith("import_discovered_provider_keys", {
      selection: {
        profile_id: "claw",
        key_ids: ["disc-openai-1"],
        primary_key_id: "disc-openai-1",
        preferred_local_backend: "bios-managed",
      },
    });
  });

  it("wraps brainstem ticks under the tauri command input contract", async () => {
    const tauriInvoke = vi.fn(async () => ({ lifecycle: "idle", health: "healthy" }));

    await runBiosBrainstemTick(tauriInvoke, {
      profileId: "claw",
      allowDream: false,
    });

    expect(tauriInvoke).toHaveBeenCalledWith("run_bios_brainstem_tick", {
      input: {
        profile_id: "claw",
        allow_dream: false,
      },
    });
  });

  it("reads the bios memory status contract when present", () => {
    expect(
      readBiosMemoryStatusFromContract({
        memory: {
          state: "active",
          total_events: 4,
          immediate_learning_ready: true,
          live_learning_count: 2,
          live_learning_summary: "2 live learning item(s) are usable now.",
          latest_live_learning: "User prefers concise updates.",
        },
      }),
    ).toEqual({
      state: "active",
      total_events: 4,
      immediate_learning_ready: true,
      live_learning_count: 2,
      live_learning_summary: "2 live learning item(s) are usable now.",
      latest_live_learning: "User prefers concise updates.",
    });
  });

  it("normalizes BIOS memory surfaces into the UI-facing camel shape", () => {
    expect(
      normalizeBiosMemorySurface({
        total_events: 2,
        immediate_learning_ready: true,
        live_learning_count: 2,
        live_learning_summary: "2 live learning item(s) are usable now.",
        latest_live_learning: "Local BIOS runtime is active.",
        standing_orders: [{ id: "1", summary: "Never fake BIOS powers." }],
        user_preferences: [],
        mission_facts: [{ id: "2", summary: "Local BIOS runtime is active." }],
        relationship_notes: [],
        identity_notes: [],
        skill_candidates: [],
        pending_approval_changes: [],
        promotion_queue: [],
        recent_events: [],
        consolidated_memory: [{ id: "3", summary: "Use sandbox first." }],
      }),
    ).toMatchObject({
      totalEvents: 2,
      immediateLearningReady: true,
      liveLearningCount: 2,
      liveLearningSummary: "2 live learning item(s) are usable now.",
      latestLiveLearning: "Local BIOS runtime is active.",
      standingOrders: [{ text: "Never fake BIOS powers." }],
      missionFacts: [{ text: "Local BIOS runtime is active." }],
      consolidatedMemory: [{ text: "Use sandbox first." }],
    });
  });

  it("normalizes BIOS soul governance surfaces into the UI-facing camel shape", () => {
    expect(
      normalizeBiosSoulGovernanceSurface({
        pending_changes: [
          {
            id: "chg-1",
            summary: "Tighten standing orders.",
            area: "standing_orders",
            target_section: "Standing Orders",
            approval_tier: "standing_order_review",
            approval_reason: "Standing orders change durable operating instructions.",
            requires_explanation: true,
          },
        ],
        recent_revisions: [
          {
            revision_id: "rev-1",
            change_id: "chg-0",
            area: "core_identity",
            target_section: "Core Identity",
            approval_tier: "kernel_locked",
            approval_reason: "Core identity changes alter who the BOSS is.",
            required_explanation: true,
            decision: "approved",
            summary: "Clarified the BOSS identity statement.",
            detail: "Stable and user-approved.",
            tags: ["identity"],
            source: "user",
            decided_at: "1710000000",
            decided_by: "nick",
            rationale: "This belongs in durable identity truth.",
            target_files: ["identity/SOUL.md"],
          },
        ],
        revision_log_path: "identity/revisions/soul-history.jsonl",
        soul_path: "identity/SOUL.md",
        user_path: "identity/USER.md",
        identity_path: "identity/IDENTITY.md",
        last_revision_at: "1710000000",
        summary: "Soul governance is clear.",
      }),
    ).toMatchObject({
      pendingChanges: [
        {
          text: "Tighten standing orders.",
          area: "standing_orders",
          targetSection: "Standing Orders",
          approvalTier: "standing_order_review",
          approvalReason: "Standing orders change durable operating instructions.",
          requiresExplanation: true,
        },
      ],
      recentRevisions: [
        {
          revisionId: "rev-1",
          decision: "approved",
          text: "Clarified the BOSS identity statement.",
          targetSection: "Core Identity",
          approvalTier: "kernel_locked",
          approvalReason: "Core identity changes alter who the BOSS is.",
          requiredExplanation: true,
          targetFiles: ["identity/SOUL.md"],
        },
      ],
      revisionLogPath: "identity/revisions/soul-history.jsonl",
    });
  });

  it("loads BIOS soul governance through the native contract", async () => {
    const tauriInvoke = vi.fn(async () => ({
      pending_changes: [{ id: "chg-1", summary: "Tighten standing orders." }],
      recent_revisions: [],
      summary: "One guarded change is waiting.",
    }));

    const governance = await loadBiosSoulGovernanceContract(tauriInvoke, "claw");

    expect(tauriInvoke).toHaveBeenCalledWith("load_bios_soul_governance", {
      profileId: "claw",
    });
    expect(governance.pendingChanges).toHaveLength(1);
  });

  it("wraps BIOS soul decisions under the tauri command contract", async () => {
    const tauriInvoke = vi.fn(async () => ({
      governance: {
        pending_changes: [],
        recent_revisions: [],
        summary: "Soul governance clear.",
      },
      memory: {
        standing_orders: [],
        user_preferences: [],
        mission_facts: [],
        relationship_notes: [],
        identity_notes: [],
        skill_candidates: [],
        pending_approval_changes: [],
        promotion_queue: [],
        recent_events: [],
        consolidated_memory: [],
      },
      revision: { revision_id: "rev-1" },
    }));

    await applyBiosSoulDecisionContract(tauriInvoke, {
      profileId: "claw",
      changeId: "chg-1",
      decision: "approved",
      rationale: "Looks stable.",
      decidedBy: "nick",
    });

    expect(tauriInvoke).toHaveBeenCalledWith("apply_bios_soul_decision", {
      profileId: "claw",
      input: {
        change_id: "chg-1",
        decision: "approved",
        rationale: "Looks stable.",
        decided_by: "nick",
      },
    });
  });

  it("normalizes BIOS observation and skill surfaces into the UI-facing camel shape", () => {
    expect(
      normalizeBiosObservationState({
        profile_id: "claw",
        label: "BIOS Home",
        detail: "Visible local shell is standing by.",
        active_surface: "local_shell",
        body_state: "shell_standby",
        body_state_label: "Shell standing by",
        body_mode: "shell_standby",
        body_summary: "BIOS AI is working from the visible local shell surface.",
        execution_lane: "local_shell",
        host_interruption_policy: "Host desktop action blocked until a body lane is selected",
        user_control_label: "No private desktop control is active",
        viewport_title: "BIOS Home",
        next_body_action: "Finish setup or send work to wake the BIOS body.",
        ghosting_protected: true,
      }),
    ).toMatchObject({
      profileId: "claw",
      activeSurface: "local_shell",
      bodyState: "shell_standby",
      bodyStateLabel: "Workspace ready",
      bodySummary: "BIOS AI is working from the visible local shell surface.",
      hostInterruptionPolicy: "Host desktop action blocked until a body lane is selected",
      viewportTitle: "BIOS Home",
      nextBodyAction: "Finish setup or send work to wake the BIOS body.",
    });

    expect(
      normalizeBiosSkillLibrarySurface({
        profile_id: "claw",
        hardened_skill_count: 1,
        strongest_skill: "Use sandbox first.",
        strongest_reinforcement: 2,
        artifacts: [{ id: "skill-1", summary: "Use sandbox first." }],
      }),
    ).toMatchObject({
      profileId: "claw",
      hardenedSkillCount: 1,
      strongestSkill: "Use sandbox first.",
      artifacts: [{ text: "Use sandbox first." }],
    });
  });

  it("normalizes the system machine profile into the UI-facing camel shape", () => {
    expect(
      normalizeSystemMachineProfile({
        os: "windows",
        arch: "x86_64",
        logical_cores: 20,
        total_memory_gb: 32,
        gpu_name: "RTX 4080",
        gpu_vendor: "NVIDIA",
        gpu_vram_gb: 16,
        truth_notes: ["BIOS AI verified dedicated GPU VRAM."],
      }),
    ).toEqual({
      os: "windows",
      arch: "x86_64",
      logicalCores: 20,
      totalMemoryGb: 32,
      gpuName: "RTX 4080",
      gpuVendor: "NVIDIA",
      gpuVramGb: 16,
      truthNotes: ["BIOS AI verified dedicated GPU VRAM."],
    });
  });

  it("reads the bios soul status contract when present", () => {
    expect(
      readBiosSoulStatusFromContract({
        soul: {
          state: "pending_approval",
          pending_changes: 2,
        },
      }),
    ).toEqual({
      state: "pending_approval",
      pending_changes: 2,
    });
  });

  it("reads the bios dream status contract when present", () => {
    expect(
      readBiosDreamStatusFromContract({
        dream: {
          state: "queued",
          queued_candidates: 3,
        },
      }),
    ).toEqual({
      state: "queued",
      queued_candidates: 3,
    });
  });

  it("reads the bios brainstem status contract when present", () => {
    expect(
      readBiosBrainstemStatusFromContract({
        brainstem: {
          lifecycle: "idle",
          health: "healthy",
        },
      }),
    ).toEqual({
      lifecycle: "idle",
      health: "healthy",
    });
  });
});
