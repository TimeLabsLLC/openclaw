function normalizePreferredLocalBackend(value) {
  const backend = String(value || "")
    .trim()
    .toLowerCase();
  return backend || null;
}

function normalizeVisibleBodyStateLabel(value) {
  const label = String(value || "").trim();
  if (!label || /shell standing by/i.test(label)) {
    return "Workspace ready";
  }
  return label;
}

export async function loadBiosShellContract(tauriInvoke, profileId = null) {
  if (typeof tauriInvoke !== "function") {
    return null;
  }
  return tauriInvoke("bios_shell_contract", { profileId });
}

export async function runBiosBrainstemTick(tauriInvoke, { profileId, allowDream = true } = {}) {
  if (typeof tauriInvoke !== "function") {
    return null;
  }
  const normalizedProfileId = String(profileId || "").trim();
  if (!normalizedProfileId) {
    return null;
  }
  return tauriInvoke("run_bios_brainstem_tick", {
    input: {
      profile_id: normalizedProfileId,
      allow_dream: Boolean(allowDream),
    },
  });
}

export async function loadBiosSoulGovernanceContract(tauriInvoke, profileId) {
  if (typeof tauriInvoke !== "function") {
    return null;
  }
  const normalizedProfileId = String(profileId || "").trim();
  if (!normalizedProfileId) {
    return null;
  }
  const surface = await tauriInvoke("load_bios_soul_governance", {
    profileId: normalizedProfileId,
  });
  return normalizeBiosSoulGovernanceSurface(surface);
}

export async function applyBiosSoulDecisionContract(
  tauriInvoke,
  { profileId, changeId, decision, rationale = null, decidedBy = null } = {},
) {
  if (typeof tauriInvoke !== "function") {
    throw new Error("BIOS AI native runtime is required for soul governance decisions.");
  }
  const normalizedProfileId = String(profileId || "").trim();
  if (!normalizedProfileId) {
    throw new Error("BIOS AI needs an active BOSS profile before soul governance can respond.");
  }
  const normalizedChangeId = String(changeId || "").trim();
  if (!normalizedChangeId) {
    throw new Error("BIOS soul governance needs a real pending change id.");
  }
  const normalizedDecision = String(decision || "")
    .trim()
    .toLowerCase();
  if (!normalizedDecision) {
    throw new Error("BIOS soul governance needs an approve or reject decision.");
  }
  const response = await tauriInvoke("apply_bios_soul_decision", {
    profileId: normalizedProfileId,
    input: {
      change_id: normalizedChangeId,
      decision: normalizedDecision,
      rationale,
      decided_by: decidedBy,
    },
  });
  return {
    ...response,
    governance: normalizeBiosSoulGovernanceSurface(response?.governance || null),
    memory: normalizeBiosMemorySurface(response?.memory || null),
  };
}

export function readBiosRuntimeStatusFromContract(contract) {
  return contract?.runtime || null;
}

export function readBiosMemoryStatusFromContract(contract) {
  return contract?.memory || null;
}

export function readBiosSoulStatusFromContract(contract) {
  return contract?.soul || null;
}

export function readBiosDreamStatusFromContract(contract) {
  return contract?.dream || null;
}

export function readBiosBrainstemStatusFromContract(contract) {
  return contract?.brainstem || null;
}

function toDisplayText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeMemoryItem(item) {
  if (!item) {
    return null;
  }
  return {
    id: item.id || "",
    text: toDisplayText(item.summary, "Untitled memory"),
    detail: item.detail || "",
    tags: Array.isArray(item.tags) ? item.tags : [],
    importance: item.importance ?? null,
    confidence: item.confidence ?? null,
    source: item.source || "",
    firstSeenAt: item.first_seen_at || null,
    lastSeenAt: item.last_seen_at || null,
    eventCount: item.event_count ?? 0,
  };
}

function normalizePendingChange(item) {
  if (!item) {
    return null;
  }
  return {
    id: item.id || "",
    text: toDisplayText(item.summary, "Pending change"),
    detail: item.detail || "",
    tags: Array.isArray(item.tags) ? item.tags : [],
    area: item.area || "",
    targetSection: item.target_section || "",
    approvalTier: item.approval_tier || "",
    approvalReason: item.approval_reason || "",
    requiresExplanation: item.requires_explanation === true,
    source: item.source || "",
    createdAt: item.created_at || null,
    status: item.status || "",
  };
}

function normalizeSoulRevision(item) {
  if (!item) {
    return null;
  }
  return {
    revisionId: item.revision_id || "",
    changeId: item.change_id || "",
    area: item.area || "",
    targetSection: item.target_section || "",
    approvalTier: item.approval_tier || "",
    approvalReason: item.approval_reason || "",
    requiredExplanation: item.required_explanation === true,
    decision: item.decision || "",
    text: toDisplayText(item.summary, "Soul revision"),
    detail: item.detail || "",
    tags: Array.isArray(item.tags) ? item.tags : [],
    source: item.source || "",
    decidedAt: item.decided_at || null,
    decidedBy: item.decided_by || "",
    rationale: item.rationale || "",
    targetFiles: Array.isArray(item.target_files) ? item.target_files : [],
  };
}

export function normalizeBiosSoulGovernanceSurface(surface) {
  if (!surface) {
    return null;
  }
  return {
    pendingChanges: Array.isArray(surface.pending_changes)
      ? surface.pending_changes.map(normalizePendingChange).filter(Boolean)
      : [],
    recentRevisions: Array.isArray(surface.recent_revisions)
      ? surface.recent_revisions.map(normalizeSoulRevision).filter(Boolean)
      : [],
    revisionLogPath: surface.revision_log_path || null,
    soulPath: surface.soul_path || null,
    userPath: surface.user_path || null,
    identityPath: surface.identity_path || null,
    lastRevisionAt: surface.last_revision_at || null,
    summary: surface.summary || "",
  };
}

function normalizePromotionCandidate(item) {
  if (!item) {
    return null;
  }
  return {
    id: item.id || "",
    text: toDisplayText(item.summary, "Queued memory candidate"),
    detail: item.detail || "",
    tags: Array.isArray(item.tags) ? item.tags : [],
    lane: item.lane || "",
    queuedAt: item.queued_at || null,
    source: item.source || "",
    importance: item.importance ?? null,
    confidence: item.confidence ?? null,
    repetitionCount: item.repetition_count ?? 0,
    sourceCount: item.source_count ?? 0,
  };
}

function normalizeDurableMemory(item) {
  if (!item) {
    return null;
  }
  return {
    id: item.id || "",
    text: toDisplayText(item.summary, "Durable memory"),
    detail: item.detail || "",
    tags: Array.isArray(item.tags) ? item.tags : [],
    lane: item.lane || "",
    source: item.source || "",
    firstPromotedAt: item.first_promoted_at || null,
    lastPromotedAt: item.last_promoted_at || null,
    promotionCount: item.promotion_count ?? 0,
    repetitionCount: item.repetition_count ?? 0,
    sourceCount: item.source_count ?? 0,
    importance: item.importance ?? null,
    confidence: item.confidence ?? null,
    dailyNotes: Array.isArray(item.daily_notes) ? item.daily_notes : [],
  };
}

function normalizeEventRecord(item) {
  if (!item) {
    return null;
  }
  return {
    id: item.id || "",
    text: toDisplayText(item.summary, "Memory event"),
    detail: item.detail || "",
    tags: Array.isArray(item.tags) ? item.tags : [],
    timestamp: item.timestamp || null,
    lane: item.lane || "",
    source: item.source || "",
    importance: item.importance ?? null,
    confidence: item.confidence ?? null,
    approvalRequired: Boolean(item.approval_required),
    queuedForPromotion: Boolean(item.queued_for_promotion),
  };
}

function normalizeSkillArtifact(item) {
  if (!item) {
    return null;
  }
  return {
    id: item.id || "",
    text: toDisplayText(item.summary, "Hardened skill"),
    detail: item.detail || "",
    status: item.status || "",
    sourceLane: item.source_lane || "",
    reinforcementCount: item.reinforcement_count ?? 0,
    sourceCount: item.source_count ?? 0,
    confidence: item.confidence ?? null,
    importance: item.importance ?? null,
    evidenceTags: Array.isArray(item.evidence_tags) ? item.evidence_tags : [],
    dailyNotes: Array.isArray(item.daily_notes) ? item.daily_notes : [],
  };
}

export function normalizeBiosMemorySurface(surface) {
  if (!surface) {
    return null;
  }
  return {
    schema: surface.schema || null,
    totalEvents: surface.total_events ?? 0,
    lastEventAt: surface.last_event_at || null,
    liveLearningCount: surface.live_learning_count ?? 0,
    liveLearningSummary: surface.live_learning_summary || "",
    latestLiveLearning: surface.latest_live_learning || null,
    immediateLearningReady: surface.immediate_learning_ready === true,
    standingOrders: Array.isArray(surface.standing_orders)
      ? surface.standing_orders.map(normalizeMemoryItem).filter(Boolean)
      : [],
    userPreferences: Array.isArray(surface.user_preferences)
      ? surface.user_preferences.map(normalizeMemoryItem).filter(Boolean)
      : [],
    missionFacts: Array.isArray(surface.mission_facts)
      ? surface.mission_facts.map(normalizeMemoryItem).filter(Boolean)
      : [],
    relationshipNotes: Array.isArray(surface.relationship_notes)
      ? surface.relationship_notes.map(normalizeMemoryItem).filter(Boolean)
      : [],
    identityNotes: Array.isArray(surface.identity_notes)
      ? surface.identity_notes.map(normalizeMemoryItem).filter(Boolean)
      : [],
    skillCandidates: Array.isArray(surface.skill_candidates)
      ? surface.skill_candidates.map(normalizeMemoryItem).filter(Boolean)
      : [],
    pendingApprovalChanges: Array.isArray(surface.pending_approval_changes)
      ? surface.pending_approval_changes.map(normalizePendingChange).filter(Boolean)
      : [],
    promotionQueue: Array.isArray(surface.promotion_queue)
      ? surface.promotion_queue.map(normalizePromotionCandidate).filter(Boolean)
      : [],
    recentEvents: Array.isArray(surface.recent_events)
      ? surface.recent_events.map(normalizeEventRecord).filter(Boolean)
      : [],
    metrics: surface.metrics || {},
    activeStatePath: surface.active_state_path || null,
    eventLogPath: surface.event_log_path || null,
    schemaPath: surface.schema_path || null,
    todayMemoryPath: surface.today_memory_path || null,
    consolidatedMemoryPath: surface.consolidated_memory_path || null,
    dreamHistoryPath: surface.dream_history_path || null,
    consolidatedMemory: Array.isArray(surface.consolidated_memory)
      ? surface.consolidated_memory.map(normalizeDurableMemory).filter(Boolean)
      : [],
    lastDreamAt: surface.last_dream_at || null,
  };
}

export function normalizeBiosObservationState(state) {
  if (!state) {
    return null;
  }
  return {
    profileId: state.profile_id || null,
    state: state.state || "idle",
    stateLabel: state.state_label || state.state || "Idle",
    label: state.label || "BIOS Home",
    detail: state.detail || "",
    activeSurface: state.active_surface || "local_shell",
    bodyState: state.body_state || "shell_standby",
    bodyStateLabel: normalizeVisibleBodyStateLabel(state.body_state_label),
    bodyMode: state.body_mode || "shell_standby",
    bodySummary: state.body_summary || "",
    executionLane: state.execution_lane || "local_shell",
    hostInterruptionPolicy:
      state.host_interruption_policy || "Computer changes stay paused until protected work is ready.",
    userControlLabel: state.user_control_label || "Computer control is paused",
    viewportTitle: state.viewport_title || state.label || "BIOS Home",
    nextBodyAction: state.next_body_action || "Finish setup or send work to wake the BIOS body.",
    targetUrl: state.target_url || null,
    ghostingProtected: state.ghosting_protected !== false,
    lastObservedAt: state.last_observed_at || null,
  };
}

export function normalizeBiosSkillLibrarySurface(surface) {
  if (!surface) {
    return null;
  }
  return {
    profileId: surface.profile_id || null,
    hardenedSkillCount: surface.hardened_skill_count ?? 0,
    strongestSkill: surface.strongest_skill || null,
    strongestReinforcement: surface.strongest_reinforcement ?? 0,
    skillsDir: surface.skills_dir || null,
    artifacts: Array.isArray(surface.artifacts)
      ? surface.artifacts.map(normalizeSkillArtifact).filter(Boolean)
      : [],
  };
}

export function normalizeSystemMachineProfile(machineProfile) {
  if (!machineProfile) {
    return null;
  }
  return {
    os: machineProfile.os || "",
    arch: machineProfile.arch || "",
    logicalCores: machineProfile.logical_cores ?? null,
    totalMemoryGb: machineProfile.total_memory_gb ?? null,
    gpuName: machineProfile.gpu_name || null,
    gpuVendor: machineProfile.gpu_vendor || null,
    gpuVramGb: machineProfile.gpu_vram_gb ?? null,
    truthNotes: Array.isArray(machineProfile.truth_notes) ? machineProfile.truth_notes : [],
  };
}

export async function loadBiosMemorySurfaceContract(tauriInvoke, profileId) {
  if (typeof tauriInvoke !== "function" || !String(profileId || "").trim()) {
    return null;
  }
  const surface = await tauriInvoke("load_bios_memory_surface", { profileId });
  return normalizeBiosMemorySurface(surface);
}

export async function loadBiosObservationStateContract(tauriInvoke, profileId) {
  if (typeof tauriInvoke !== "function" || !String(profileId || "").trim()) {
    return null;
  }
  const state = await tauriInvoke("load_bios_observation_state", { profileId });
  return normalizeBiosObservationState(state);
}

export async function loadBiosSkillLibraryContract(tauriInvoke, profileId) {
  if (typeof tauriInvoke !== "function" || !String(profileId || "").trim()) {
    return null;
  }
  const surface = await tauriInvoke("load_bios_skill_library", { profileId });
  return normalizeBiosSkillLibrarySurface(surface);
}

export async function loadSystemMachineProfileContract(tauriInvoke) {
  if (typeof tauriInvoke !== "function") {
    return null;
  }
  const discovery = await tauriInvoke("system_discovery");
  return normalizeSystemMachineProfile(discovery?.machine_profile || null);
}

export function readBiosOnboardingFromContract(contract) {
  const onboarding = contract?.onboarding || null;
  if (!onboarding) {
    return null;
  }
  return {
    completed: Boolean(onboarding.completed),
    agentName: onboarding.agent_name || contract?.profile?.display_name || null,
    permissionMode: onboarding.permission_mode || null,
    modelPref: onboarding.model_pref || null,
    safetyPostureLabel: onboarding.safety_posture_label || null,
    executionMode: onboarding.execution_mode || null,
    sandboxBackend: onboarding.sandbox_backend || null,
    toolCreationPolicy: onboarding.tool_creation_policy || null,
    networkPosture: onboarding.network_posture || null,
    hostAccess: onboarding.host_access || null,
    promotionPolicy: onboarding.promotion_policy || null,
    localRuntimeOwner: onboarding.local_runtime_owner || null,
    localRuntimeEngine: onboarding.local_runtime_engine || null,
    localRuntimeStrategy: onboarding.local_runtime_strategy || null,
    preferredLocalBackend: normalizePreferredLocalBackend(onboarding.preferred_local_backend),
    preferredCloudProvider: onboarding.preferred_cloud_provider || null,
    localWorkerModelVariant: onboarding.local_worker_model_variant || null,
    localWorkerModelPath: onboarding.local_worker_model_path || null,
    biosWorkerRoster: onboarding.bios_worker_roster || [],
    localWorkerDownloadStatus: onboarding.local_worker_download_status || null,
    localWorkerStoragePath: onboarding.local_worker_storage_path || null,
    gitIdentity: onboarding.git_identity || null,
    localModels: onboarding.local_models || [],
    sshKeyTypes: onboarding.ssh_key_types || [],
    aiTools: onboarding.ai_tools || [],
    apiKeys: onboarding.api_keys || [],
    primaryKeyIndex: onboarding.primary_key_index ?? 0,
    bossModelGovernance: onboarding.boss_model_governance || null,
    timestamp: onboarding.timestamp || null,
  };
}

export function buildProviderImportContractSelection(selection = {}) {
  const keyIds = Array.isArray(selection.keyIds)
    ? selection.keyIds.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const profileId = String(selection.profileId || "").trim() || null;
  const preferredLocalBackend = normalizePreferredLocalBackend(selection.preferredLocalBackend);
  if (!profileId) {
    throw new Error("Provider import selection needs a real BIOS profile first.");
  }
  if (!keyIds.length && !preferredLocalBackend) {
    throw new Error("Provider import selection needs imported keys or a local runtime choice.");
  }
  const primaryKeyId = keyIds.includes(selection.primaryKeyId)
    ? selection.primaryKeyId
    : keyIds[0] || null;
  return {
    profile_id: profileId,
    key_ids: keyIds,
    primary_key_id: primaryKeyId,
    preferred_local_backend: preferredLocalBackend,
  };
}

export async function importDiscoveredProviderKeysContract(tauriInvoke, selection = {}) {
  if (typeof tauriInvoke !== "function") {
    throw new Error("Provider import contract is unavailable in this surface.");
  }
  const payload = buildProviderImportContractSelection(selection);
  return tauriInvoke("import_discovered_provider_keys", { selection: payload });
}
