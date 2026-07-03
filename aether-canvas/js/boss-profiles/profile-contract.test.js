import { describe, expect, it } from "vitest";
import {
  alignProviderConfigToSavedRoute,
  buildBiosProfileSaveInput,
  buildSavedOnboardingSnapshotFromProfileDetail,
  mergeProviderConfigIntoSavedSnapshot,
} from "./profile-contract.js";

describe("bios profile contract", () => {
  it("maps sovereign biology paths into the native save payload", () => {
    const payload = buildBiosProfileSaveInput(
      {
        completed: true,
        agentName: "Claw",
        profileRoot: "E:/bios/profiles/claw",
        identityDir: "E:/bios/profiles/claw/identity",
        memoryDir: "E:/bios/profiles/claw/memory",
        dailyMemoryDir: "E:/bios/profiles/claw/memory/daily",
        runtimeDir: "E:/bios/profiles/claw/runtime",
        importsDir: "E:/bios/profiles/claw/imports",
        logsDir: "E:/bios/profiles/claw/logs",
        skillsDir: "E:/bios/profiles/claw/skills",
        memorySchemaPath: "E:/bios/profiles/claw/memory/schema/kernel-tags.json",
        activeMemoryPath: "E:/bios/profiles/claw/memory/active-state.json",
        memoryEventLogPath: "E:/bios/profiles/claw/memory/events.jsonl",
        synapsesPath: "E:/bios/profiles/claw/synapses/synapses.json",
        soulPath: "E:/bios/profiles/claw/identity/SOUL.md",
        userPath: "E:/bios/profiles/claw/identity/USER.md",
        identityPath: "E:/bios/profiles/claw/identity/IDENTITY.md",
        memoryPath: "E:/bios/profiles/claw/MEMORY.md",
        preferredCloudProvider: "openai",
        biosWorkerRoster: [
          { role: "boss_brain", selection: { variant: "qwen-3-14b" } },
          { role: "small_worker", selection: { variant: "gemma-3-4b" } },
        ],
        importedAgentSourceDir: "C:/legacy/agent",
        importedArtifactKinds: ["SOUL.md", "IDENTITY.md", "MEMORY.md"],
      },
      { profileId: "claw" },
    );

    expect(payload.input.onboarding.profile_root).toBe("E:/bios/profiles/claw");
    expect(payload.input.onboarding.identity_dir).toBe("E:/bios/profiles/claw/identity");
    expect(payload.input.onboarding.memory_dir).toBe("E:/bios/profiles/claw/memory");
    expect(payload.input.onboarding.daily_memory_dir).toBe("E:/bios/profiles/claw/memory/daily");
    expect(payload.input.onboarding.memory_schema_path).toBe(
      "E:/bios/profiles/claw/memory/schema/kernel-tags.json",
    );
    expect(payload.input.onboarding.active_memory_path).toBe(
      "E:/bios/profiles/claw/memory/active-state.json",
    );
    expect(payload.input.onboarding.memory_event_log_path).toBe(
      "E:/bios/profiles/claw/memory/events.jsonl",
    );
    expect(payload.input.onboarding.synapses_path).toBe(
      "E:/bios/profiles/claw/synapses/synapses.json",
    );
    expect(payload.input.onboarding.preferred_cloud_provider).toBe("openai");
    expect(payload.input.onboarding.bios_worker_roster).toEqual([
      { role: "boss_brain", selection: { variant: "qwen-3-14b" } },
      { role: "small_worker", selection: { variant: "gemma-3-4b" } },
    ]);
    expect(payload.input.onboarding.imported_agent_source_dir).toBe("C:/legacy/agent");
    expect(payload.input.onboarding.imported_artifact_kinds).toEqual([
      "SOUL.md",
      "IDENTITY.md",
      "MEMORY.md",
    ]);
  });

  it("restores sovereign biology paths from native profile detail", () => {
    const snapshot = buildSavedOnboardingSnapshotFromProfileDetail({
      profile: {
        display_name: "Claw",
      },
      onboarding: {
        completed: true,
        agent_name: "Claw",
        profile_root: "E:/bios/profiles/claw",
        identity_dir: "E:/bios/profiles/claw/identity",
        memory_dir: "E:/bios/profiles/claw/memory",
        daily_memory_dir: "E:/bios/profiles/claw/memory/daily",
        runtime_dir: "E:/bios/profiles/claw/runtime",
        imports_dir: "E:/bios/profiles/claw/imports",
        logs_dir: "E:/bios/profiles/claw/logs",
        skills_dir: "E:/bios/profiles/claw/skills",
        memory_schema_path: "E:/bios/profiles/claw/memory/schema/kernel-tags.json",
        active_memory_path: "E:/bios/profiles/claw/memory/active-state.json",
        memory_event_log_path: "E:/bios/profiles/claw/memory/events.jsonl",
        synapses_path: "E:/bios/profiles/claw/synapses/synapses.json",
        soul_path: "E:/bios/profiles/claw/identity/SOUL.md",
        user_path: "E:/bios/profiles/claw/identity/USER.md",
        identity_path: "E:/bios/profiles/claw/identity/IDENTITY.md",
        memory_path: "E:/bios/profiles/claw/MEMORY.md",
        bios_worker_roster: [
          { role: "boss_brain", selection: { variant: "qwen-3-14b" } },
          { role: "medium_worker", selection: { variant: "qwen-3-8b" } },
        ],
        imported_agent_source_dir: "C:/legacy/agent",
        imported_artifact_kinds: ["SOUL.md", "IDENTITY.md", "MEMORY.md"],
        preferred_cloud_provider: "openai",
      },
    });

    expect(snapshot.profileRoot).toBe("E:/bios/profiles/claw");
    expect(snapshot.identityDir).toBe("E:/bios/profiles/claw/identity");
    expect(snapshot.memoryDir).toBe("E:/bios/profiles/claw/memory");
    expect(snapshot.dailyMemoryDir).toBe("E:/bios/profiles/claw/memory/daily");
    expect(snapshot.memorySchemaPath).toBe("E:/bios/profiles/claw/memory/schema/kernel-tags.json");
    expect(snapshot.activeMemoryPath).toBe("E:/bios/profiles/claw/memory/active-state.json");
    expect(snapshot.memoryEventLogPath).toBe("E:/bios/profiles/claw/memory/events.jsonl");
    expect(snapshot.soulPath).toBe("E:/bios/profiles/claw/identity/SOUL.md");
    expect(snapshot.preferredCloudProvider).toBe("openai");
    expect(snapshot.biosWorkerRoster).toEqual([
      { role: "boss_brain", selection: { variant: "qwen-3-14b" } },
      { role: "medium_worker", selection: { variant: "qwen-3-8b" } },
    ]);
    expect(snapshot.importedAgentSourceDir).toBe("C:/legacy/agent");
    expect(snapshot.importedArtifactKinds).toEqual(["SOUL.md", "IDENTITY.md", "MEMORY.md"]);
  });

  it("merges provider config into the saved snapshot without losing non-LLM imports", () => {
    const snapshot = mergeProviderConfigIntoSavedSnapshot(
      {
        apiKeys: [
          { provider: "telegram", key: "tg-secret", source: "import" },
          { provider: "openai", key: "old-secret", source: "manual" },
        ],
        primaryKeyIndex: 1,
      },
      {
        active_provider: "anthropic",
        active_model: "claude-sonnet",
        keys: [
          { provider: "openai", key: "new-openai", source: "manual", label: "OpenAI" },
          { provider: "anthropic", key: "new-anthropic", source: "manual", label: "Anthropic" },
        ],
      },
    );

    expect(snapshot.apiKeys).toEqual([
      { provider: "telegram", key: "tg-secret", source: "import" },
      {
        provider: "openai",
        key: "new-openai",
        source: "manual",
        label: "OpenAI",
        env_var: null,
        key_id: null,
      },
      {
        provider: "anthropic",
        key: "new-anthropic",
        source: "manual",
        label: "Anthropic",
        env_var: null,
        key_id: null,
      },
    ]);
    expect(snapshot.preferredCloudProvider).toBe("anthropic");
    expect(snapshot.primaryKeyIndex).toBe(2);
  });

  it("keeps the local route owner active while preserving a preferred cloud provider", () => {
    const aligned = alignProviderConfigToSavedRoute(
      {
        modelPref: "local",
        permissionMode: "not_allowed",
        preferredLocalBackend: "bios-managed",
        preferredCloudProvider: "openai",
      },
      {
        active_provider: "openai",
        active_model: "gpt-5.5",
        keys: [{ provider: "openai", key: "sk-openai" }],
      },
    );

    expect(aligned.active_provider).toBe("bios-managed");
    expect(aligned.active_model).toBe("");
  });
});
