import { BIOS_DEFAULT_SAFETY_POSTURE, BIOS_DEFAULT_SANDBOX_BACKEND } from "../bios-runtime.js";

export function buildBiosProfileSaveInput(
  snapshot,
  { profileId = null, displayName = "BOSS Agent", makeActive = true } = {},
) {
  return {
    input: {
      profile_id: profileId,
      display_name: snapshot?.agentName || displayName,
      onboarding: {
        completed: Boolean(snapshot?.completed),
        agent_name: snapshot?.agentName || null,
        profile_root: snapshot?.profileRoot || null,
        identity_dir: snapshot?.identityDir || null,
        memory_dir: snapshot?.memoryDir || null,
        daily_memory_dir: snapshot?.dailyMemoryDir || null,
        runtime_dir: snapshot?.runtimeDir || null,
        imports_dir: snapshot?.importsDir || null,
        logs_dir: snapshot?.logsDir || null,
        skills_dir: snapshot?.skillsDir || null,
        memory_schema_path: snapshot?.memorySchemaPath || null,
        active_memory_path: snapshot?.activeMemoryPath || null,
        memory_event_log_path: snapshot?.memoryEventLogPath || null,
        synapses_path: snapshot?.synapsesPath || null,
        soul_path: snapshot?.soulPath || null,
        user_path: snapshot?.userPath || null,
        identity_path: snapshot?.identityPath || null,
        memory_path: snapshot?.memoryPath || null,
        imported_agent_source_dir: snapshot?.importedAgentSourceDir || null,
        imported_artifact_kinds: snapshot?.importedArtifactKinds || null,
        permission_mode: snapshot?.permissionMode || null,
        model_pref: snapshot?.modelPref || null,
        safety_posture_label: snapshot?.safetyPostureLabel || null,
        execution_mode: snapshot?.executionMode || null,
        sandbox_backend: snapshot?.sandboxBackend || null,
        tool_creation_policy: snapshot?.toolCreationPolicy || null,
        network_posture: snapshot?.networkPosture || null,
        host_access: snapshot?.hostAccess || null,
        promotion_policy: snapshot?.promotionPolicy || null,
        local_runtime_owner: snapshot?.localRuntimeOwner || null,
        local_runtime_engine: snapshot?.localRuntimeEngine || null,
        local_runtime_strategy: snapshot?.localRuntimeStrategy || null,
        preferred_local_backend: snapshot?.preferredLocalBackend || null,
        preferred_cloud_provider: snapshot?.preferredCloudProvider || null,
        local_worker_model_variant: snapshot?.localWorkerModelVariant || null,
        local_worker_model_path: snapshot?.localWorkerModelPath || null,
        bios_worker_roster: snapshot?.biosWorkerRoster || null,
        local_worker_download_status: snapshot?.localWorkerDownloadStatus || null,
        local_worker_storage_path: snapshot?.localWorkerStoragePath || null,
        git_identity: snapshot?.gitIdentity || null,
        local_models: snapshot?.localModels || null,
        ssh_key_types: snapshot?.sshKeyTypes || null,
        ai_tools: snapshot?.aiTools || null,
        api_keys: snapshot?.apiKeys || null,
        primary_key_index: snapshot?.primaryKeyIndex ?? null,
        boss_model_governance: snapshot?.bossModelGovernance || null,
        timestamp: snapshot?.timestamp || Date.now(),
      },
      make_active: makeActive,
    },
  };
}

export function buildSavedOnboardingSnapshotFromProfileDetail(
  detail,
  fallbackAgentName = "BOSS Agent",
) {
  const onboarding = detail?.onboarding || {};
  const profile = detail?.profile || {};
  const pick = (snakeKey, camelKey, fallback = null) =>
    onboarding[snakeKey] ?? onboarding[camelKey] ?? fallback;
  return {
    completed: Boolean(onboarding.completed),
    agentName: pick("agent_name", "agentName", profile.display_name || fallbackAgentName),
    profileRoot: pick("profile_root", "profileRoot"),
    identityDir: pick("identity_dir", "identityDir"),
    memoryDir: pick("memory_dir", "memoryDir"),
    dailyMemoryDir: pick("daily_memory_dir", "dailyMemoryDir"),
    runtimeDir: pick("runtime_dir", "runtimeDir"),
    importsDir: pick("imports_dir", "importsDir"),
    logsDir: pick("logs_dir", "logsDir"),
    skillsDir: pick("skills_dir", "skillsDir"),
    memorySchemaPath: pick("memory_schema_path", "memorySchemaPath"),
    activeMemoryPath: pick("active_memory_path", "activeMemoryPath"),
    memoryEventLogPath: pick("memory_event_log_path", "memoryEventLogPath"),
    synapsesPath: pick("synapses_path", "synapsesPath"),
    soulPath: pick("soul_path", "soulPath"),
    userPath: pick("user_path", "userPath"),
    identityPath: pick("identity_path", "identityPath"),
    memoryPath: pick("memory_path", "memoryPath"),
    importedAgentSourceDir: pick("imported_agent_source_dir", "importedAgentSourceDir"),
    importedArtifactKinds: pick("imported_artifact_kinds", "importedArtifactKinds", []),
    permissionMode: pick("permission_mode", "permissionMode", "not_allowed"),
    modelPref: pick("model_pref", "modelPref", "commercial"),
    safetyPostureLabel:
      pick("safety_posture_label", "safetyPostureLabel") ||
      profile.safety_posture_label ||
      BIOS_DEFAULT_SAFETY_POSTURE,
    executionMode: pick(
      "execution_mode",
      "executionMode",
      profile.execution_mode || "Protected first",
    ),
    sandboxBackend: pick(
      "sandbox_backend",
      "sandboxBackend",
      profile.sandbox_backend || BIOS_DEFAULT_SANDBOX_BACKEND,
    ),
    toolCreationPolicy: pick(
      "tool_creation_policy",
      "toolCreationPolicy",
      "Check new tools before using them",
    ),
    networkPosture: pick(
      "network_posture",
      "networkPosture",
      "Limit internet for unknown work",
    ),
    hostAccess: pick("host_access", "hostAccess", "Ask before changing this computer"),
    promotionPolicy:
      pick("promotion_policy", "promotionPolicy") ||
      profile.promotion_policy ||
      "Review and confirm before applying changes",
    localRuntimeOwner:
      pick("local_runtime_owner", "localRuntimeOwner") || profile.local_runtime_owner || null,
    localRuntimeEngine:
      pick("local_runtime_engine", "localRuntimeEngine") || profile.local_runtime_engine || null,
    localRuntimeStrategy:
      pick("local_runtime_strategy", "localRuntimeStrategy") ||
      profile.local_runtime_strategy ||
      null,
    preferredLocalBackend: pick("preferred_local_backend", "preferredLocalBackend"),
    preferredCloudProvider: pick("preferred_cloud_provider", "preferredCloudProvider"),
    localWorkerModelVariant: pick("local_worker_model_variant", "localWorkerModelVariant"),
    localWorkerModelPath: pick("local_worker_model_path", "localWorkerModelPath"),
    biosWorkerRoster: pick("bios_worker_roster", "biosWorkerRoster", []),
    localWorkerDownloadStatus: pick("local_worker_download_status", "localWorkerDownloadStatus"),
    localWorkerStoragePath: pick("local_worker_storage_path", "localWorkerStoragePath"),
    gitIdentity: pick("git_identity", "gitIdentity"),
    localModels: pick("local_models", "localModels", []),
    sshKeyTypes: pick("ssh_key_types", "sshKeyTypes", []),
    aiTools: pick("ai_tools", "aiTools", []),
    apiKeys: pick("api_keys", "apiKeys", []),
    primaryKeyIndex: pick("primary_key_index", "primaryKeyIndex", 0),
    bossModelGovernance: pick("boss_model_governance", "bossModelGovernance"),
    timestamp: onboarding.timestamp || Date.now(),
  };
}

function normalizeProviderName(provider) {
  return String(provider || "")
    .trim()
    .toLowerCase();
}

function isLocalRuntimeProvider(provider) {
  return ["bios-managed", "lmstudio", "ollama"].includes(normalizeProviderName(provider));
}

function isNonLlmProvider(provider) {
  return ["github-copilot", "github", "telegram", "unknown"].includes(
    normalizeProviderName(provider),
  );
}

function normalizeProviderKeyRecord(key) {
  const provider = normalizeProviderName(key?.provider);
  const value = String(key?.key || "").trim();
  if (!provider || !value) {
    return null;
  }
  return {
    provider,
    key: value,
    source: key?.source || "manual",
    label: key?.label || provider,
    env_var: key?.env_var || null,
    key_id: key?.key_id || null,
  };
}

export function choosePreferredCloudProvider(snapshot = {}, config = null) {
  const configuredKeys = Array.isArray(config?.keys)
    ? config.keys.map(normalizeProviderKeyRecord).filter(Boolean)
    : [];
  const savedKeys = Array.isArray(snapshot?.apiKeys)
    ? snapshot.apiKeys.map(normalizeProviderKeyRecord).filter(Boolean)
    : [];
  const candidateProviders = [
    snapshot?.preferredCloudProvider,
    config?.active_provider,
    savedKeys[snapshot?.primaryKeyIndex ?? 0]?.provider,
    configuredKeys[0]?.provider,
    savedKeys[0]?.provider,
  ]
    .map(normalizeProviderName)
    .filter(Boolean)
    .filter((provider) => !isLocalRuntimeProvider(provider) && !isNonLlmProvider(provider));
  return candidateProviders[0] || null;
}

export function mergeProviderConfigIntoSavedSnapshot(snapshot = {}, config = null) {
  const normalizedConfigKeys = Array.isArray(config?.keys)
    ? config.keys.map(normalizeProviderKeyRecord).filter(Boolean)
    : [];
  const preservedKeys = Array.isArray(snapshot?.apiKeys)
    ? snapshot.apiKeys.filter((key) => {
        const provider = normalizeProviderName(key?.provider);
        return provider && (isNonLlmProvider(provider) || !String(key?.key || "").trim());
      })
    : [];
  const mergedApiKeys = [...preservedKeys, ...normalizedConfigKeys];
  const preferredCloudProvider = choosePreferredCloudProvider(snapshot, config);
  const primaryKeyIndex = mergedApiKeys.findIndex(
    (key) => normalizeProviderName(key?.provider) === normalizeProviderName(preferredCloudProvider),
  );
  return {
    ...snapshot,
    apiKeys: mergedApiKeys,
    preferredCloudProvider,
    primaryKeyIndex: primaryKeyIndex >= 0 ? primaryKeyIndex : 0,
  };
}

export function alignProviderConfigToSavedRoute(snapshot = {}, config = null) {
  const nextConfig = {
    active_provider: "",
    active_model: "",
    keys: [],
    conversation_history: [],
    ...(config || {}),
  };
  const preferredCloudProvider = choosePreferredCloudProvider(snapshot, nextConfig);
  const preferredLocalBackend = normalizeProviderName(snapshot?.preferredLocalBackend);
  const modelPref = snapshot?.modelPref || "commercial";
  const permissionMode = snapshot?.permissionMode || "not_allowed";

  if (modelPref === "local") {
    nextConfig.active_provider = preferredLocalBackend || "bios-managed";
    nextConfig.active_model = "";
    return nextConfig;
  }

  if (modelPref === "hybrid") {
    if (permissionMode === "allowed" && preferredCloudProvider) {
      nextConfig.active_provider = preferredCloudProvider;
      return nextConfig;
    }
    nextConfig.active_provider = preferredLocalBackend || preferredCloudProvider || "";
    if (isLocalRuntimeProvider(nextConfig.active_provider)) {
      nextConfig.active_model = "";
    }
    return nextConfig;
  }

  nextConfig.active_provider = preferredCloudProvider || "";
  return nextConfig;
}
