import { DIRECT_LOCAL_LLM_PROVIDERS, MANAGED_LOCAL_RUNTIME_PROVIDER } from "../bios-runtime.js";

function normalizeModelPref(modelPref) {
  const normalized = String(modelPref || "")
    .trim()
    .toLowerCase();
  if (normalized === "commercial") {
    return "cloud";
  }
  return normalized || "cloud";
}

function normalizePreferredLocalBackend(preferredLocalBackend) {
  const normalized = String(preferredLocalBackend || "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === MANAGED_LOCAL_RUNTIME_PROVIDER) {
    return MANAGED_LOCAL_RUNTIME_PROVIDER;
  }
  return DIRECT_LOCAL_LLM_PROVIDERS.has(normalized) ? normalized : null;
}

function buildCapabilityLaneLabel(localBackend) {
  if (localBackend === MANAGED_LOCAL_RUNTIME_PROVIDER) {
    return "the BIOS AI managed llama.cpp worker";
  }
  if (localBackend === "lmstudio") {
    return "LM Studio";
  }
  if (localBackend === "ollama") {
    return "Ollama";
  }
  return "the local BIOS lane";
}

function buildWorkerLaneSummary(runtimeStatus = null) {
  const lanes = Array.isArray(runtimeStatus?.worker_lanes) ? runtimeStatus.worker_lanes : [];
  const readyLanes = lanes.filter((lane) => lane?.ready);
  if (!readyLanes.length) {
    return null;
  }
  return readyLanes
    .map(
      (lane) =>
        `${lane.role_label || lane.role}: ${lane.selected_model_id || lane.selected_variant || "ready"}`,
    )
    .join(" | ");
}

function buildReflexSummary(reflex = null) {
  if (!reflex) {
    return null;
  }
  const candidateCount = reflex.skill_candidate_count ?? reflex.skillCandidateCount ?? 0;
  const hardenedCount = reflex.hardened_skill_count ?? reflex.hardenedSkillCount ?? 0;
  const synapseCount = reflex.synapse_event_count ?? reflex.synapseEventCount ?? 0;
  const topCandidate = reflex.top_skill_candidate || reflex.topSkillCandidate || "";
  const strongestHardened = reflex.strongest_hardened_skill || reflex.strongestHardenedSkill || "";
  const schemaSummary = reflex.schema_summary || reflex.schemaSummary || "";
  const topTagLabel = reflex.top_tag_label || reflex.topTagLabel || "";
  const topEvidenceLabel = reflex.top_evidence_label || reflex.topEvidenceLabel || "";
  const topStateLabel = reflex.top_state_label || reflex.topStateLabel || "";
  const ready = Boolean(reflex.ready || candidateCount || hardenedCount || synapseCount);
  const detailParts = [
    `${candidateCount} skill candidate${candidateCount === 1 ? "" : "s"}`,
    `${hardenedCount} hardened skill${hardenedCount === 1 ? "" : "s"}`,
    `${synapseCount} synapse event${synapseCount === 1 ? "" : "s"}`,
  ];
  return {
    ready,
    candidateCount,
    hardenedCount,
    synapseCount,
    topCandidate,
    strongestHardened,
    schemaSummary,
    topTagLabel,
    topEvidenceLabel,
    topStateLabel,
    label: ready ? "BIOS reflex context ready" : "BIOS reflex context cold",
    detail: ready
      ? `BIOS reflexes report ${detailParts.join(", ")}.`
      : "BIOS reflexes have not learned reusable action patterns yet.",
  };
}

const EXECUTION_CLASS_LABELS = new Map([
  ["safe_local_read", "safe reads"],
  ["approval_required_host_action", "approval-required host actions"],
  ["boxed_first_risky_action", "boxed-first risky actions"],
]);

function normalizeToolEntries(toolRegistry = null) {
  return Array.isArray(toolRegistry?.tools)
    ? toolRegistry.tools
        .map((tool) => ({
          name: String(tool?.name || "").trim(),
          label: String(tool?.label || tool?.name || "").trim(),
          category: String(tool?.category || "").trim(),
          executionClass: String(tool?.execution_class || tool?.executionClass || "").trim(),
          approvalRequired: Boolean(tool?.approval_required ?? tool?.approvalRequired),
          profileRequired: Boolean(tool?.profile_required ?? tool?.profileRequired),
          summary: String(tool?.summary || "").trim(),
        }))
        .filter((tool) => tool.name)
    : [];
}

export function buildLocalToolInventorySummary(toolRegistry = null, connectorStatus = null) {
  const toolEntries = normalizeToolEntries(toolRegistry);
  const classCounts = new Map();
  for (const tool of toolEntries) {
    const key = tool.executionClass || "unclassified";
    classCounts.set(key, (classCounts.get(key) || 0) + 1);
  }
  const classSummary = Array.from(EXECUTION_CLASS_LABELS.entries())
    .map(([key, label]) => `${classCounts.get(key) || 0} ${label}`)
    .join(" | ");
  const connectorEntries = Array.isArray(connectorStatus?.connectors)
    ? connectorStatus.connectors
    : [];
  const readyConnectors = connectorEntries.filter((entry) => entry?.ready);
  const connectorSummary = readyConnectors.length
    ? `${readyConnectors.length} connector${readyConnectors.length === 1 ? "" : "s"} ready`
    : "0 connectors ready";
  const registeredNames = toolEntries.map((tool) => tool.name).sort();
  return {
    ready: toolEntries.length > 0,
    toolCount: toolEntries.length,
    classCounts: Object.fromEntries(classCounts),
    classSummary,
    connectorCount: connectorEntries.length,
    readyConnectorCount: readyConnectors.length,
    connectorSummary,
    registeredNames,
    truthRule: "BIOS AI can only claim or run local actions after they are available.",
    detail: toolEntries.length
      ? `${toolEntries.length} BIOS-owned local tool contract(s): ${classSummary}. ${connectorSummary}.`
      : `No BIOS-owned local tool contracts are visible yet. ${connectorSummary}.`,
  };
}

const GAP_OR_DONE_PATTERN =
  /\b(gap|gaps|what'?s left|remaining|missing|blocked|done|complete|completion|ready|readiness|ship|release|proof|proved|verified|package|packaged)\b/i;
const PRIOR_TRUTH_PATTERN =
  /\b(previous|previously|prior|already decided|we decided|locked|old plan|current truth|what'?s next|next step|hard rule|definition of done)\b/i;
const PRODUCT_DIRECTION_PATTERN =
  /\b(bios ai|boss|forge arena|forge arcade|arena|roadmap|strategy|product direction|pricing|license|source visibility|monetize)\b/i;
const ABSOLUTE_COMPLETION_PATTERN =
  /\b(100%|fully done|all done|nothing left|complete|perfect|no gaps|no blockers)\b/i;

function compactLines(values = [], limit = 4) {
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function buildBiosAnswerGuard({ prompt = "", truthSpine = null } = {}) {
  const text = String(prompt || "");
  const truthPack = truthSpine?.tiny_pack || truthSpine?.tinyPack || null;
  const matchedAreas = [];
  if (GAP_OR_DONE_PATTERN.test(text)) matchedAreas.push("readiness-gap-proof");
  if (PRIOR_TRUTH_PATTERN.test(text)) matchedAreas.push("prior-operating-truth");
  if (PRODUCT_DIRECTION_PATTERN.test(text)) matchedAreas.push("product-direction");
  if (ABSOLUTE_COMPLETION_PATTERN.test(text)) matchedAreas.push("completion-claim");

  const readinessGaps = compactLines(truthPack?.readiness_gaps || truthPack?.readinessGaps);
  const nudges = compactLines(truthPack?.truth_nudges || truthPack?.truthNudges);
  const advisorySignals = compactLines(truthPack?.advisory_signals || truthPack?.advisorySignals);
  const proofMoments = compactLines(truthPack?.proof_moments || truthPack?.proofMoments);
  const staticRules = compactLines(truthPack?.answer_guard || truthPack?.answerGuard);
  const requiresTruthCheck =
    matchedAreas.length > 0 ||
    readinessGaps.length > 0 ||
    Boolean(
      truthSpine?.governance_state === "review_required" ||
      truthSpine?.governanceState === "review_required",
    );
  const riskLevel =
    matchedAreas.includes("completion-claim") ||
    readinessGaps.length > 0 ||
    advisorySignals.some((line) => /contradiction|needs_proof/i.test(line))
      ? "high"
      : matchedAreas.length > 0 || nudges.length > 0
        ? "medium"
        : "low";

  return {
    requiresTruthCheck,
    riskLevel,
    matchedAreas,
    staticRules,
    nudges,
    readinessGaps,
    advisorySignals,
    proofMoments,
    instruction: requiresTruthCheck
      ? "Use BOSS operating truth before answering. If proof or readiness is missing, say that plainly before giving a plan."
      : "No special operating-truth guard is required beyond the normal compact truth pack.",
  };
}

export function buildLocalCapabilityPosture({
  runtimeStatus = null,
  onboardingState = null,
  providerConfig = null,
  memorySurface = null,
  observation = null,
  skillLibrary = null,
  machineProfile = null,
  connectorStatus = null,
  toolRegistry = null,
  truthSpine = null,
  reflex = null,
} = {}) {
  const modelPref = normalizeModelPref(onboardingState?.modelPref || runtimeStatus?.model_pref);
  const localBackend = normalizePreferredLocalBackend(
    runtimeStatus?.preferred_local_backend ||
      providerConfig?.active_provider ||
      onboardingState?.preferredLocalBackend,
  );
  const chatReady = Boolean(runtimeStatus?.route_ready);
  const laneLabel = buildCapabilityLaneLabel(localBackend);
  const workerLaneSummary = buildWorkerLaneSummary(runtimeStatus);
  const savedHistoryReady = Array.isArray(providerConfig?.conversation_history)
    ? providerConfig.conversation_history.some(
        (entry) =>
          (entry?.role === "user" || entry?.role === "assistant") &&
          String(entry?.text || "").trim(),
      )
    : false;
  const nextStep =
    runtimeStatus?.next_step ||
    "Finish local runtime setup before BIOS AI can claim anything beyond chat.";

  const memoryReady = Boolean(
    memorySurface &&
    (memorySurface.totalEvents > 0 ||
      memorySurface.standingOrders?.length ||
      memorySurface.userPreferences?.length ||
      memorySurface.missionFacts?.length ||
      memorySurface.consolidatedMemory?.length),
  );
  const observationReady = Boolean(
    observation?.label || observation?.bodySummary || observation?.detail,
  );
  const skillLibraryReady = Boolean(
    skillLibrary && (skillLibrary.hardenedSkillCount > 0 || skillLibrary.artifacts?.length),
  );
  const toolEntries = normalizeToolEntries(toolRegistry);
  const toolsReady = toolEntries.length > 0;
  const toolInventory = buildLocalToolInventorySummary(toolRegistry, connectorStatus);
  const truthPack = truthSpine?.tiny_pack || truthSpine?.tinyPack || null;
  const truthReady = Boolean(truthSpine?.ready || truthPack?.readiness === "ready");
  const readinessGapCount = Number(
    truthSpine?.readiness_gap_count ?? truthSpine?.readinessGapCount ?? 0,
  );
  const advisorySignalCount = Number(
    truthSpine?.advisory_signal_count ?? truthSpine?.advisorySignalCount ?? 0,
  );
  const reflexSummary = buildReflexSummary(reflex);
  const reflexReady = Boolean(reflexSummary?.ready);
  const connectorEntries = Array.isArray(connectorStatus?.connectors)
    ? connectorStatus.connectors
    : [];
  const readyConnectors = connectorEntries.filter((entry) => entry?.ready);
  const connectorReady = readyConnectors.length > 0;
  const connectorLabel = connectorReady
    ? `${readyConnectors.length} local connector${readyConnectors.length === 1 ? "" : "s"} ready`
    : "External connectors not wired";
  const connectorDetail = connectorReady
    ? readyConnectors.map((entry) => entry.label || entry.connector).join(" | ")
    : connectorEntries[0]?.detail ||
      "Telegram and other connectors stay unavailable until the local connector runtime lands.";

  const summary = chatReady
    ? `Local chat is live through ${laneLabel}${workerLaneSummary ? ` with worker lanes ${workerLaneSummary}` : ""}, ${truthReady ? "with compact BOSS operating truth attached" : "without folded BOSS operating truth yet"}${readinessGapCount ? ` and ${readinessGapCount} readiness gap${readinessGapCount === 1 ? "" : "s"} visible` : ""}${advisorySignalCount ? ` plus ${advisorySignalCount} advisory signal${advisorySignalCount === 1 ? "" : "s"}` : ""}, ${savedHistoryReady ? "with saved shell history attached" : "without saved shell history yet"}, ${memoryReady ? "with BIOS memory recall attached" : "without BIOS memory recall yet"}, ${observationReady ? "with BIOS shell observation attached" : "without a live BIOS observation snapshot"}, ${toolsReady ? `with ${toolEntries.length} BIOS-owned local tool${toolEntries.length === 1 ? "" : "s"} available` : "without BIOS-owned local tool execution yet"}, ${skillLibraryReady ? "with hardened BIOS skills visible" : "without hardened skill context yet"}, ${reflexReady ? "with learned BIOS reflexes visible to planning" : "without learned reflex context yet"}, and ${connectorReady ? "with a real BIOS connector lane available" : "without a live BIOS connector lane yet"}.`
    : "Local chat is not ready yet. BIOS AI must finish local runtime setup before it can truthfully claim chat, memory, system inspection, tool use, or connector access.";

  return {
    transport: "local-supervisor",
    routeBoundary: modelPref,
    localBackend,
    chat: {
      ready: chatReady,
      label: chatReady ? "Local chat ready" : "Local chat not ready",
      detail: chatReady ? `BIOS AI can answer through ${laneLabel}.` : nextStep,
    },
    savedHistory: {
      ready: savedHistoryReady,
      label: savedHistoryReady ? "Saved history ready" : "Saved history not wired",
      detail: savedHistoryReady
        ? `Local chat can read ${providerConfig.conversation_history.length} saved shell turn(s) for this profile.`
        : "Local chat only sees the conversation turns supplied in this request.",
    },
    biosMemory: {
      ready: memoryReady,
      label: memoryReady ? "BIOS memory recall ready" : "BIOS memory recall not wired",
      detail: memoryReady
        ? `Local chat can see ${memorySurface.totalEvents || 0} recorded BIOS memory event(s) and ${memorySurface.consolidatedMemory?.length || 0} durable memory item(s).`
        : "Structured BIOS memory is not yet attached to local chat retrieval.",
    },
    observation: {
      ready: observationReady,
      label: observationReady ? "BIOS shell observation ready" : "System inspection not wired",
      detail: observationReady
        ? observation.bodySummary || observation.detail || "Local shell observation is available."
        : "Local chat cannot claim it inspected the machine unless a later observation contract returns real data.",
    },
    tools: {
      ready: toolsReady,
      label: toolsReady ? "BIOS-owned local tools ready" : "Tool execution not wired",
      detail: toolsReady
        ? toolInventory.detail
        : "Local chat cannot act on the host through BIOS-owned tools in this phase.",
      inventory: toolInventory,
    },
    skills: {
      ready: skillLibraryReady,
      label: skillLibraryReady
        ? "Hardened skill context ready"
        : "Hardened skill context not wired",
      detail: skillLibraryReady
        ? `Local chat can see ${skillLibrary.hardenedSkillCount || 0} hardened BIOS skill artifact(s).`
        : "Local chat cannot yet retrieve hardened BIOS skill context.",
    },
    reflexes: {
      ready: reflexReady,
      label: reflexSummary?.label || "BIOS reflex context not wired",
      detail: reflexSummary?.detail || "Local chat cannot yet use learned reflex context.",
      summary: reflexSummary,
    },
    connectors: {
      ready: connectorReady,
      label: connectorLabel,
      detail: connectorDetail,
    },
    allowedKnowledgeSources: [
      "the user's current message",
      "the conversation turns supplied in this request",
      "loaded BIOS identity text, if present",
      ...(savedHistoryReady ? ["saved shell history returned for this profile"] : []),
      ...(memoryReady ? ["the live BIOS memory surface returned for this profile"] : []),
      ...(truthPack ? ["the compact BOSS operating truth pack returned for this profile"] : []),
      ...(reflexReady
        ? ["the live BIOS reflex and synapse surface returned for this profile"]
        : []),
      ...(observationReady ? ["the live BIOS observation snapshot returned for this profile"] : []),
      ...(skillLibraryReady ? ["the hardened BIOS skill library returned for this profile"] : []),
      ...(machineProfile ? ["the current BIOS machine profile returned by local discovery"] : []),
    ],
    memorySurface,
    truthSpine,
    truthPack,
    reflexSurface: reflex,
    reflexSummary,
    observationSnapshot: observation,
    skillLibrarySurface: skillLibrary,
    machineProfile,
    connectorStatus,
    toolRegistry,
    toolInventory,
    summary,
    nextStep,
  };
}

export function buildLocalCapabilitySupportLabel(posture) {
  return posture?.summary || "Local capability posture is still being determined.";
}

export function buildLocalCapabilitySystemPrompt({
  agentName,
  capabilityPosture,
  identityText = "",
  currentUserPrompt = "",
}) {
  const allowedKnowledgeSources = Array.isArray(capabilityPosture?.allowedKnowledgeSources)
    ? capabilityPosture.allowedKnowledgeSources
    : [];
  const allowedList = allowedKnowledgeSources.length
    ? allowedKnowledgeSources.map((item) => `- ${item}`).join("\n")
    : "- the user's current message";
  const routeBoundary = capabilityPosture?.routeBoundary || "cloud";
  const summary =
    capabilityPosture?.summary ||
    "Local chat is active, but BIOS AI must stay honest about missing runtime capabilities.";

  const memorySurface = capabilityPosture?.memorySurface || null;
  const truthSpine = capabilityPosture?.truthSpine || null;
  const truthPack =
    capabilityPosture?.truthPack || truthSpine?.tiny_pack || truthSpine?.tinyPack || null;
  const truthUsage = truthSpine?.latest_usage || truthSpine?.latestUsage || null;
  const answerGuard = buildBiosAnswerGuard({
    prompt: currentUserPrompt,
    truthSpine,
  });
  const observation = capabilityPosture?.observationSnapshot || null;
  const skillLibrary = capabilityPosture?.skillLibrarySurface || null;
  const reflex = capabilityPosture?.reflexSurface || null;
  const reflexSummary = capabilityPosture?.reflexSummary || buildReflexSummary(reflex);
  const machineProfile = capabilityPosture?.machineProfile || null;
  const toolInventory = capabilityPosture?.toolInventory || capabilityPosture?.tools?.inventory;

  const memorySection = memorySurface
    ? `\nLive BIOS memory surface for this profile:\n` +
      `- Standing orders: ${
        (memorySurface.standingOrders || [])
          .slice(0, 3)
          .map((item) => item.text)
          .join(" | ") || "none"
      }\n` +
      `- Preferences: ${
        (memorySurface.userPreferences || [])
          .slice(0, 3)
          .map((item) => item.text)
          .join(" | ") || "none"
      }\n` +
      `- Mission facts: ${
        (memorySurface.missionFacts || [])
          .slice(0, 3)
          .map((item) => item.text)
          .join(" | ") || "none"
      }\n` +
      `- Durable memory: ${
        (memorySurface.consolidatedMemory || [])
          .slice(0, 3)
          .map((item) => item.text)
          .join(" | ") || "none"
      }\n`
    : "";

  const truthSection = truthPack
    ? `\nCompact BOSS operating truth for this profile:\n` +
      `- Readiness: ${truthPack.readiness || "unknown"}\n` +
      `- Governance: ${truthPack.governance_state || truthPack.governanceState || "unknown"}\n` +
      `- Summary: ${truthPack.compact_summary || truthPack.compactSummary || "none"}\n` +
      `- Body inputs: ${
        (truthPack.body_inputs || truthPack.bodyInputs || []).slice(0, 4).join(" | ") || "none"
      }\n` +
      `- Active decisions: ${
        (truthPack.active_decisions || truthPack.activeDecisions || []).slice(0, 4).join(" | ") ||
        "none"
      }\n` +
      `- Dead ends to avoid: ${
        (truthPack.dead_ends || truthPack.deadEnds || []).slice(0, 4).join(" | ") || "none"
      }\n` +
      `- Next actions: ${
        (truthPack.next_actions || truthPack.nextActions || []).slice(0, 4).join(" | ") || "none"
      }\n` +
      `- Candidate/question/exploration truth: ${
        (truthPack.brainstorm || []).slice(0, 4).join(" | ") || "none"
      }\n` +
      `- Answer guard rules: ${
        compactLines(truthPack.answer_guard || truthPack.answerGuard).join(" | ") || "none"
      }\n` +
      `- Truth nudges: ${
        compactLines(truthPack.truth_nudges || truthPack.truthNudges).join(" | ") || "none"
      }\n` +
      `- Readiness gaps: ${
        compactLines(truthPack.readiness_gaps || truthPack.readinessGaps).join(" | ") || "none"
      }\n` +
      `- Proof moments: ${
        compactLines(truthPack.proof_moments || truthPack.proofMoments).join(" | ") || "none"
      }\n` +
      `- Advisory signals: ${
        compactLines(truthPack.advisory_signals || truthPack.advisorySignals).join(" | ") || "none"
      }\n` +
      `- Stale action suppression: ${
        truthSpine?.stale_action_count ?? truthSpine?.staleActionCount ?? 0
      } stale item(s) hidden from the action pack\n` +
      (truthUsage
        ? `- Usage baseline: ${truthUsage.context_profile || truthUsage.contextProfile || "unknown"} context, ${
            truthUsage.baseline_tokens ?? truthUsage.baselineTokens ?? "unknown"
          } baseline tokens to ${
            truthUsage.truthspine_context_tokens ?? truthUsage.truthspineContextTokens ?? "unknown"
          } compact truth tokens, ${
            truthUsage.token_savings_percent ?? truthUsage.tokenSavingsPercent ?? "unknown"
          }% savings, ${
            truthUsage.savings_confidence || truthUsage.savingsConfidence || "unknown"
          } confidence\n`
        : "") +
      `- Warnings: ${(truthPack.warnings || []).slice(0, 4).join(" | ") || "none"}\n`
    : "";

  const answerGuardSection = answerGuard.requiresTruthCheck
    ? `\nBOSS pre-answer operating-truth guard for the current user prompt:\n` +
      `- Risk: ${answerGuard.riskLevel}\n` +
      `- Matched areas: ${answerGuard.matchedAreas.join(" | ") || "operating-truth"}\n` +
      `- Instruction: ${answerGuard.instruction}\n` +
      `- Guard rules: ${answerGuard.staticRules.join(" | ") || "none"}\n` +
      `- Nudges: ${answerGuard.nudges.join(" | ") || "none"}\n` +
      `- Readiness gaps: ${answerGuard.readinessGaps.join(" | ") || "none"}\n` +
      `- Recent proof moments: ${answerGuard.proofMoments.join(" | ") || "none"}\n` +
      `- Advisory signals: ${answerGuard.advisorySignals.join(" | ") || "none"}\n`
    : "";

  const observationSection = observation
    ? `\nLive BIOS observation snapshot for this profile:\n` +
      `- Surface: ${observation.activeSurface || "local_shell"}\n` +
      `- Label: ${observation.label || "BIOS Home"}\n` +
      `- Body summary: ${observation.bodySummary || observation.detail || "none"}\n`
    : "";

  const skillSection = skillLibrary
    ? `\nLive BIOS hardened skill context for this profile:\n` +
      `- Hardened skills: ${skillLibrary.hardenedSkillCount || 0}\n` +
      `- Strongest skill: ${skillLibrary.strongestSkill || "none"}\n` +
      `- Top artifacts: ${
        (skillLibrary.artifacts || [])
          .slice(0, 3)
          .map((item) => item.text)
          .join(" | ") || "none"
      }\n`
    : "";

  const reflexSection = reflexSummary
    ? `\nLive BIOS reflex and synapse context for this profile:\n` +
      `- Reflex status: ${reflexSummary.label}\n` +
      `- Skill candidates: ${reflexSummary.candidateCount}\n` +
      `- Hardened skills: ${reflexSummary.hardenedCount}\n` +
      `- Synapse events: ${reflexSummary.synapseCount}\n` +
      `- Top reflex candidate: ${reflexSummary.topCandidate || "none"}\n` +
      `- Strongest hardened skill: ${reflexSummary.strongestHardened || "none"}\n` +
      `- Schema: ${reflexSummary.schemaSummary || "unknown"}\n` +
      `- Dominant labels: ${
        [reflexSummary.topTagLabel, reflexSummary.topEvidenceLabel, reflexSummary.topStateLabel]
          .filter(Boolean)
          .join(" | ") || "none"
      }\n`
    : "";

  const machineProfileSection = machineProfile
    ? `\nLive BIOS machine profile for this system:\n` +
      `- OS: ${machineProfile.os || "unknown"}\n` +
      `- Arch: ${machineProfile.arch || "unknown"}\n` +
      `- Logical cores: ${machineProfile.logicalCores ?? "unknown"}\n` +
      `- Total memory: ${machineProfile.totalMemoryGb ?? "unknown"} GB\n` +
      `- GPU: ${machineProfile.gpuName || machineProfile.gpuVendor || "unknown"}\n` +
      `- GPU VRAM: ${machineProfile.gpuVramGb ?? "unknown"} GB\n` +
      (Array.isArray(machineProfile.truthNotes) && machineProfile.truthNotes.length
        ? `- Hardware truth notes: ${machineProfile.truthNotes.join(" ")}\n`
        : "")
    : "";

  const toolInventorySection = toolInventory
    ? `\nLive BIOS local action inventory:\n` +
      `- Registered tools: ${toolInventory.toolCount || 0}\n` +
      `- Execution classes: ${toolInventory.classSummary || "none"}\n` +
      `- Ready connectors: ${toolInventory.readyConnectorCount || 0}\n` +
      `- Truth rule: ${toolInventory.truthRule}\n`
    : "";

  const identitySection = identityText
    ? `\nLoaded BIOS identity context follows. Treat it as owned profile context, not as proof that you just inspected anything.\n\n${identityText}`
    : "";

  return (
    `You are ${agentName}, the BOSS agent running inside BIOS AI in local supervisor mode.\n` +
    `This lane is governed by a hard capability contract. Be exact and never roleplay missing system powers.\n\n` +
    `Active route boundary: ${routeBoundary}.\n` +
    `Current local posture: ${summary}\n\n` +
    `You currently have access only to:\n${allowedList}\n\n` +
    `Non-negotiable truth rules:\n` +
    `- Do not say you checked saved history unless BIOS AI explicitly returned a real saved-history result in this turn.\n` +
    `- Do not say you checked BIOS memory unless BIOS AI explicitly returned a real memory-surface result in this turn.\n` +
    `- Do not say you inspected the machine, files, browser, or operating system unless BIOS AI explicitly returned a real observation or tool result in this turn.\n` +
    `- Do not say you used Telegram or any other connector unless BIOS AI explicitly returned a real connector result in this turn.\n` +
    `- If the user asks for an unavailable capability, say that the local lane is not wired for it yet and give the next truthful step.\n` +
    `- Prefer clear honesty over improvised capability claims.\n` +
    memorySection +
    truthSection +
    answerGuardSection +
    observationSection +
    skillSection +
    reflexSection +
    machineProfileSection +
    toolInventorySection +
    identitySection
  );
}
