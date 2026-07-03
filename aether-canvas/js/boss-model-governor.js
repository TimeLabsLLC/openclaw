import {
  DIRECT_LOCAL_LLM_PROVIDERS,
  isUsableDirectLlmProvider,
  MANAGED_LOCAL_RUNTIME_PROVIDER,
} from "./bios-runtime.js";
import { buildLocalWorkerOptions } from "./onboarding-local-runtime.js";

export const BIOS_WORKER_ROLE_BOSS = "boss_brain";
export const BIOS_WORKER_ROLE_MEDIUM = "medium_worker";
export const BIOS_WORKER_ROLE_SMALL = "small_worker";

const CLOUD_PROVIDER_PRIORITY = [
  "openai",
  "anthropic",
  "google",
  "groq",
  "deepseek",
  "openrouter",
  "custom",
];

function providerPriority(provider) {
  const normalized = String(provider || "")
    .trim()
    .toLowerCase();
  const index = CLOUD_PROVIDER_PRIORITY.indexOf(normalized);
  return index === -1 ? CLOUD_PROVIDER_PRIORITY.length + 1 : index;
}

function normalizeProviderKey(key) {
  if (!key || !isUsableDirectLlmProvider(key.provider)) {
    return null;
  }
  const provider = String(key.provider || "")
    .trim()
    .toLowerCase();
  if (DIRECT_LOCAL_LLM_PROVIDERS.has(provider)) {
    return null;
  }
  const secret = typeof key.key === "string" ? key.key.trim() : "";
  const keyId = String(key.key_id || key.keyId || "").trim();
  const masked = String(key.masked_value || key.masked || "").trim();
  if (!secret && !keyId && !masked) {
    return null;
  }
  return {
    ...key,
    provider,
    key: secret,
    keyId,
    masked,
  };
}

export function chooseBossCloudKey(
  apiKeys = [],
  { currentProvider = null, permissionMode = null } = {},
) {
  const usableKeys = apiKeys.map(normalizeProviderKey).filter(Boolean);
  if (usableKeys.length === 0) {
    return null;
  }

  const normalizedCurrent = String(currentProvider || "")
    .trim()
    .toLowerCase();
  if (normalizedCurrent) {
    const existing = usableKeys.find((entry) => entry.provider === normalizedCurrent);
    if (existing) {
      return existing;
    }
  }

  return [...usableKeys].sort((left, right) => {
    const delta = providerPriority(left.provider) - providerPriority(right.provider);
    if (delta !== 0) {
      return delta;
    }
    return left.provider.localeCompare(right.provider);
  })[0];
}

function chooseSupportWorkerCandidates(workerOptions, bossVariant) {
  const enabled = (workerOptions || []).filter((option) => option.enabled);
  const bossIndex = enabled.findIndex((option) => option.variant === bossVariant);
  const withoutBoss = enabled.filter((option) => option.variant !== bossVariant);
  if (!withoutBoss.length) {
    return {
      medium: null,
      small: null,
    };
  }

  const medium =
    (bossIndex > 0 ? enabled[bossIndex - 1] : null) ||
    withoutBoss.find((option) => option.recommendedForHybrid) ||
    withoutBoss[0] ||
    null;
  const small =
    withoutBoss.find(
      (option) => option.variant !== medium?.variant && option.variant !== bossVariant,
    ) || null;

  return {
    medium,
    small,
  };
}

function listReadyWorkerRoles(runtimeStatus = null) {
  const lanes = Array.isArray(runtimeStatus?.worker_lanes) ? runtimeStatus.worker_lanes : [];
  const ready = new Set(
    lanes
      .filter((lane) => lane?.ready && lane?.role)
      .map((lane) => String(lane.role).trim().toLowerCase()),
  );
  if (!ready.size && runtimeStatus?.worker_ready) {
    ready.add(BIOS_WORKER_ROLE_BOSS);
  }
  return ready;
}

function normalizeWorkerRole(role) {
  const normalized = String(role || "")
    .trim()
    .toLowerCase();
  if (
    normalized === BIOS_WORKER_ROLE_BOSS ||
    normalized === BIOS_WORKER_ROLE_MEDIUM ||
    normalized === BIOS_WORKER_ROLE_SMALL
  ) {
    return normalized;
  }
  return "";
}

function normalizeRosterEntry(entry) {
  const role = normalizeWorkerRole(entry?.role);
  const variant = String(entry?.variant || entry?.selection?.variant || "")
    .trim()
    .toLowerCase();
  const path = String(entry?.path || entry?.selection?.path || "").trim();
  if (!role || (!variant && !path)) {
    return null;
  }
  return {
    role,
    variant: variant || null,
    path: path || null,
  };
}

function normalizeRoster(roster = []) {
  const byRole = new Map();
  (Array.isArray(roster) ? roster : [])
    .map(normalizeRosterEntry)
    .filter(Boolean)
    .forEach((entry) => {
      byRole.set(entry.role, entry);
    });
  return [...byRole.values()].sort((left, right) => left.role.localeCompare(right.role));
}

function classifyWorkerRoleIntent({ normalizedText = "", conversationHistory = [] } = {}) {
  const text = String(normalizedText || "")
    .trim()
    .toLowerCase();
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

  const bossIntent =
    /\b(plan|architecture|architect|tradeoff|tradeoffs|debug|diagnose|design|build|implement|fix|repair|govern|runtime|system|strategy|why)\b/.test(
      text,
    ) || wordCount > 90;
  if (bossIntent) {
    return {
      role: BIOS_WORKER_ROLE_BOSS,
      reason: "Higher-context or system-governing turn stayed with the BOSS brain.",
    };
  }

  const smallIntent =
    /\b(summarize|summary|rewrite|rephrase|shorten|tighten|format|bullet|bullets|title|tag|extract|clean up|polish wording|proofread)\b/.test(
      text,
    ) || wordCount <= 14;
  if (smallIntent) {
    return {
      role: BIOS_WORKER_ROLE_SMALL,
      reason: "Short or formatting-heavy turn fits the small worker.",
    };
  }

  const mediumIntent =
    /\b(draft|caption|outline|categorize|organize|sort|compare|recap|brainstorm|ideas|list options|pros and cons)\b/.test(
      text,
    ) ||
    (wordCount > 14 && wordCount <= 90 && conversationHistory.length < 14);
  if (mediumIntent) {
    return {
      role: BIOS_WORKER_ROLE_MEDIUM,
      reason: "Mid-weight synthesis turn fits the medium worker.",
    };
  }

  return {
    role: BIOS_WORKER_ROLE_BOSS,
    reason: "Higher-context or unclassified turn stayed with the BOSS brain.",
  };
}

export function buildBossWorkerRosterAssignments({
  workerCatalog = null,
  machineProfile = null,
  bossVariant = null,
  bossPath = null,
} = {}) {
  if (!bossVariant && !bossPath) {
    return [];
  }

  const workerOptions = buildLocalWorkerOptions(machineProfile, workerCatalog);
  const supports = bossVariant
    ? chooseSupportWorkerCandidates(workerOptions, bossVariant)
    : { medium: null, small: null };
  const assignments = [
    {
      role: BIOS_WORKER_ROLE_BOSS,
      variant: bossVariant || null,
      path: bossPath || null,
    },
  ];

  if (supports.medium?.variant) {
    assignments.push({
      role: BIOS_WORKER_ROLE_MEDIUM,
      variant: supports.medium.variant,
      path: null,
    });
  }

  if (supports.small?.variant) {
    assignments.push({
      role: BIOS_WORKER_ROLE_SMALL,
      variant: supports.small.variant,
      path: null,
    });
  }

  return assignments;
}

export function chooseBossWorkerRoleForTurn({
  normalizedText = "",
  conversationHistory = [],
  runtimeStatus = null,
} = {}) {
  const readyRoles = listReadyWorkerRoles(runtimeStatus);
  const intent = classifyWorkerRoleIntent({ normalizedText, conversationHistory });
  const hasMedium = readyRoles.has(BIOS_WORKER_ROLE_MEDIUM);
  const hasSmall = readyRoles.has(BIOS_WORKER_ROLE_SMALL);

  if (intent.role === BIOS_WORKER_ROLE_BOSS) {
    return {
      role: BIOS_WORKER_ROLE_BOSS,
      reason: "Higher-context or system-governing turn stayed with the BOSS brain.",
    };
  }

  if (intent.role === BIOS_WORKER_ROLE_SMALL && hasSmall) {
    return {
      role: BIOS_WORKER_ROLE_SMALL,
      reason: "Short or formatting-heavy turn routed to the small worker.",
    };
  }

  if (intent.role === BIOS_WORKER_ROLE_MEDIUM && hasMedium) {
    return {
      role: BIOS_WORKER_ROLE_MEDIUM,
      reason: "Mid-weight synthesis turn routed to the medium worker.",
    };
  }

  return {
    role: BIOS_WORKER_ROLE_BOSS,
    reason: "Higher-context or unclassified turn stayed with the BOSS brain.",
  };
}

export function buildBossModelGovernanceDecision({
  normalizedText = "",
  conversationHistory = [],
  runtimeStatus = null,
  onboardingState = null,
  workerCatalog = null,
  machineProfile = null,
  currentRoster = null,
  trigger = "chat_turn",
  now = Date.now(),
} = {}) {
  const routeBoundary = onboardingState?.modelPref || "commercial";
  const permissionBoundary = onboardingState?.permissionMode || "not_allowed";
  const bossVariant =
    onboardingState?.localWorkerModelVariant ||
    normalizeRoster(currentRoster || onboardingState?.biosWorkerRoster).find(
      (entry) => entry.role === BIOS_WORKER_ROLE_BOSS,
    )?.variant ||
    null;
  const roster = normalizeRoster(currentRoster || onboardingState?.biosWorkerRoster);
  const readyRoles = listReadyWorkerRoles(runtimeStatus);
  const intent = classifyWorkerRoleIntent({ normalizedText, conversationHistory });
  const existingTarget = roster.find((entry) => entry.role === intent.role) || null;
  const candidateRoster = normalizeRoster(
    buildBossWorkerRosterAssignments({
      workerCatalog,
      machineProfile: machineProfile || workerCatalog?.machine_profile || null,
      bossVariant,
      bossPath: onboardingState?.localWorkerModelPath || null,
    }),
  );
  const candidateTarget = candidateRoster.find((entry) => entry.role === intent.role) || null;
  const installedVariants = new Set(
    buildLocalWorkerOptions(machineProfile || workerCatalog?.machine_profile || null, workerCatalog)
      .filter((option) => option.installed)
      .map((option) => option.variant),
  );
  const selectedTarget = existingTarget || candidateTarget;
  const historyEvent = {
    timestamp: now,
    trigger,
    desiredRole: intent.role,
    permissionBoundary,
    routeBoundary,
    rationale: intent.reason,
  };

  if (routeBoundary === "commercial") {
    return {
      action: "blocked_by_route",
      allowed: false,
      requiresApproval: false,
      role: BIOS_WORKER_ROLE_BOSS,
      reason:
        "Cloud BOSS posture blocks local worker reassignment until the route is switched to Local only or Hybrid.",
      historyEvent: {
        ...historyEvent,
        action: "blocked_by_route",
      },
    };
  }

  if (intent.role === BIOS_WORKER_ROLE_BOSS || readyRoles.has(intent.role)) {
    return {
      action: "keep_current",
      allowed: true,
      requiresApproval: false,
      role: intent.role,
      reason: intent.reason,
      historyEvent: {
        ...historyEvent,
        action: "keep_current",
        targetVariant: selectedTarget?.variant || null,
      },
    };
  }

  if (!selectedTarget?.variant || !installedVariants.has(selectedTarget.variant)) {
    return {
      action: "recommend_install",
      allowed: false,
      requiresApproval: permissionBoundary !== "allowed",
      role: BIOS_WORKER_ROLE_BOSS,
      reason: `${intent.reason} BIOS AI can recommend that worker lane, but the needed model is not installed for this BOSS profile yet.`,
      historyEvent: {
        ...historyEvent,
        action: "recommend_install",
        targetVariant: selectedTarget?.variant || null,
      },
    };
  }

  const nextRoster = normalizeRoster([...roster, selectedTarget]);
  if (permissionBoundary !== "allowed") {
    return {
      action: "recommend_roster_change",
      allowed: false,
      requiresApproval: true,
      role: BIOS_WORKER_ROLE_BOSS,
      targetRole: intent.role,
      targetVariant: selectedTarget.variant,
      nextRoster,
      reason: `${intent.reason} Ask-first authority requires approval before BIOS AI changes the worker roster.`,
      historyEvent: {
        ...historyEvent,
        action: "recommend_roster_change",
        targetVariant: selectedTarget.variant,
      },
    };
  }

  return {
    action: "apply_roster_change",
    allowed: true,
    requiresApproval: false,
    role: intent.role,
    targetRole: intent.role,
    targetVariant: selectedTarget.variant,
    nextRoster,
    reason: `${intent.reason} Broad authority lets BIOS AI add the installed worker lane now.`,
    historyEvent: {
      ...historyEvent,
      action: "apply_roster_change",
      targetVariant: selectedTarget.variant,
    },
  };
}

export function appendBossModelGovernanceHistory(snapshot = {}, decision = null, limit = 20) {
  const prior = snapshot?.bossModelGovernance || {};
  const history = Array.isArray(prior.history) ? prior.history : [];
  const nextEvent = decision?.historyEvent || {
    timestamp: Date.now(),
    action: "unknown",
    rationale: decision?.reason || "No BOSS model-governance decision was available.",
  };
  return {
    ...snapshot,
    bossModelGovernance: {
      mode: "boss-governed",
      routeBoundary: snapshot?.modelPref || prior.routeBoundary || null,
      permissionBoundary: snapshot?.permissionMode || prior.permissionBoundary || null,
      lastDecision: nextEvent,
      history: [nextEvent, ...history].slice(0, limit),
    },
  };
}

export function buildBossLocalSupportPlan({
  machineProfile = null,
  bossVariant = null,
  installedVariants = [],
  permissionMode = "not_allowed",
  workerCatalog = null,
} = {}) {
  const options = buildLocalWorkerOptions(machineProfile, workerCatalog).filter(
    (option) => option.enabled,
  );
  const installed = new Set(installedVariants.filter(Boolean));
  const supportAssignments = buildBossWorkerRosterAssignments({
    workerCatalog,
    machineProfile,
    bossVariant,
  });
  const supportByVariant = new Map(
    supportAssignments
      .filter((entry) => entry.role !== BIOS_WORKER_ROLE_BOSS)
      .map((entry) => [entry.variant, entry.role]),
  );
  return options
    .filter((option) => option.variant !== bossVariant)
    .map((option) => ({
      variant: option.variant,
      label: option.label,
      role: supportByVariant.get(option.variant) || option.role,
      status: installed.has(option.variant)
        ? "ready"
        : permissionMode === "allowed"
          ? "boss-can-add-later"
          : "ask-first-before-adding",
    }));
}

export function buildBossModelGovernanceSnapshot({
  machineProfile = null,
  modelPref = "commercial",
  permissionMode = "not_allowed",
  preferredLocalBackend = null,
  bossVariant = null,
  installedVariants = [],
  apiKeys = [],
  workerCatalog = null,
} = {}) {
  const selectedCloud = chooseBossCloudKey(apiKeys, { permissionMode });
  return {
    chooser: "boss-governed",
    routeBoundary: modelPref,
    permissionBoundary: permissionMode,
    preferredCloudProvider: selectedCloud?.provider || null,
    preferredLocalBackend: preferredLocalBackend || null,
    bossBrainVariant: bossVariant || null,
    supportingWorkers: buildBossLocalSupportPlan({
      machineProfile,
      bossVariant,
      installedVariants,
      permissionMode,
      workerCatalog,
    }),
  };
}

export function chooseBossManagedWorkerVariant({
  selectedVariant = null,
  installedModels = [],
  machineProfile = null,
  modelPref = "local",
  hasCloudKey = false,
  workerCatalog = null,
} = {}) {
  const installedVariants = new Set(
    (installedModels || []).map((model) => model?.variant).filter(Boolean),
  );
  if (selectedVariant && installedVariants.has(selectedVariant)) {
    return selectedVariant;
  }

  const workerOptions = buildLocalWorkerOptions(machineProfile, workerCatalog).filter(
    (option) => option.enabled && installedVariants.has(option.variant),
  );
  if (workerOptions.length === 0) {
    return null;
  }

  if (modelPref === "local") {
    return (
      workerOptions.find((option) => option.recommendedForLocal)?.variant ||
      workerOptions.at(-1)?.variant ||
      workerOptions[0]?.variant ||
      null
    );
  }
  if (modelPref === "hybrid" && hasCloudKey) {
    return (
      workerOptions.find((option) => option.recommendedForHybrid)?.variant ||
      workerOptions[0]?.variant ||
      null
    );
  }
  return workerOptions[0]?.variant || null;
}

export function chooseBossChatRoute({
  onboardingState = null,
  providerConfig = null,
  runtimeStatus = null,
} = {}) {
  const modelPref = onboardingState?.modelPref || "commercial";
  const permissionMode = onboardingState?.permissionMode || "not_allowed";
  const preferredLocalBackend =
    runtimeStatus?.preferred_local_backend ||
    onboardingState?.preferredLocalBackend ||
    providerConfig?.active_provider ||
    null;
  const localReady = Boolean(runtimeStatus?.local_backend_reachable || runtimeStatus?.worker_ready);
  const cloudKey = chooseBossCloudKey(providerConfig?.keys || [], {
    currentProvider:
      onboardingState?.preferredCloudProvider || providerConfig?.active_provider || null,
    permissionMode,
  });
  const hasCloud = Boolean(cloudKey?.key);

  if (modelPref === "local") {
    return {
      provider: preferredLocalBackend || MANAGED_LOCAL_RUNTIME_PROVIDER,
      model: "",
      apiKey: "",
      reason: "Local-only boundary forces BIOS AI to stay on the local lane.",
    };
  }

  if (modelPref === "hybrid") {
    if (permissionMode === "allowed" && hasCloud) {
      return {
        provider: cloudKey.provider,
        model: "",
        apiKey: cloudKey.key,
        reason: "Hybrid with broad authority lets BIOS AI lead with the strongest cloud route.",
      };
    }
    if (localReady) {
      return {
        provider: preferredLocalBackend || MANAGED_LOCAL_RUNTIME_PROVIDER,
        model: "",
        apiKey: "",
        reason: "Hybrid with ask-first stays local by default and keeps cloud as a fallback lane.",
      };
    }
    if (hasCloud) {
      return {
        provider: cloudKey.provider,
        model: "",
        apiKey: cloudKey.key,
        reason:
          "Hybrid is falling back to the cloud route because the local lane is not ready yet.",
      };
    }
    return {
      provider: preferredLocalBackend || MANAGED_LOCAL_RUNTIME_PROVIDER,
      model: "",
      apiKey: "",
      reason: "Hybrid still expects a local lane once BIOS AI finishes preparing it.",
    };
  }

  return {
    provider: cloudKey?.provider || "",
    model: "",
    apiKey: cloudKey?.key || "",
    reason: cloudKey
      ? "Cloud BOSS lets BIOS AI choose the best imported cloud provider."
      : "Cloud BOSS still needs a usable cloud provider key.",
  };
}
