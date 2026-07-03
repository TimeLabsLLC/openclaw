function normalizeStatusText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function shortenStatus(text, maxLength = 88) {
  const normalized = normalizeStatusText(text);
  if (!normalized) return "";
  return normalized.length > maxLength
    ? `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
    : normalized;
}

function formatContinuityLabel(value) {
  return String(value || "unknown").replace(/_/g, " ");
}

const LOCAL_MODEL_PROVIDERS = new Set(["lmstudio", "ollama", "vllm"]);

function normalizeProviderId(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatKTokens(value) {
  return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`;
}

export function describeLatestRouteDecision(routeDecisionHistory = []) {
  const latestDecision = Array.isArray(routeDecisionHistory) ? routeDecisionHistory[0] : null;
  if (!latestDecision) {
    return "";
  }

  return `Latest route: ${latestDecision.summary} for ${latestDecision.taskLabel}.`;
}

export function describeRecentRouteAdoption(routeDecisionHistory = []) {
  if (!Array.isArray(routeDecisionHistory) || routeDecisionHistory.length === 0) {
    return "";
  }

  const totalRecent = routeDecisionHistory.length;
  const fastPathCount = routeDecisionHistory.filter((entry) => entry.system === 1).length;
  const toolPathCount = routeDecisionHistory.filter(
    (entry) => entry.usedPromotedTool === true,
  ).length;

  return ` Recent adoption: ${fastPathCount}/${totalRecent} cheap-path, ${toolPathCount}/${totalRecent} tool-path.`;
}

export function describeSkillTelemetry(skillTelemetry, routeDecisionHistory = []) {
  if (!skillTelemetry) {
    return "";
  }

  if ((skillTelemetry.totalSkillCount || 0) === 0) {
    return "Route telemetry is cold. No learned reflexes are ready yet.";
  }

  const backlogLead = skillTelemetry.validationBacklogCount
    ? `${skillTelemetry.validationBacklogCount} awaiting validation`
    : "no validation backlog";
  const toolLead = skillTelemetry.promotedToolCount
    ? ` ${skillTelemetry.promotedToolCount} tool-ready.`
    : "";
  const topLead = skillTelemetry.topRoutedSkillId
    ? ` Top reflex: ${skillTelemetry.topRoutedSkillId}.`
    : "";
  const savingsLead = skillTelemetry.tokenEconomySummary
    ? ` ${skillTelemetry.tokenEconomySummary}.`
    : "";
  const adoptionLead = describeRecentRouteAdoption(routeDecisionHistory);

  return `Route telemetry: ${skillTelemetry.readySkillCount} ready, ${backlogLead}, ${skillTelemetry.totalRouteHits} route hits recorded.${toolLead}${savingsLead}${adoptionLead}${topLead}`;
}

export function buildModelTelemetry({ models = [], authStatus = null } = {}) {
  const modelEntries = Array.isArray(models) ? models : [];
  const providers = Array.isArray(authStatus?.providers) ? authStatus.providers : [];
  const configuredModelCount = modelEntries.length;
  const localModelCount = modelEntries.filter((entry) =>
    LOCAL_MODEL_PROVIDERS.has(normalizeProviderId(entry?.provider)),
  ).length;
  const hostedModelCount = Math.max(0, configuredModelCount - localModelCount);
  const readyProviders = providers.filter((provider) =>
    ["ok", "static", "expiring"].includes(String(provider?.status || "")),
  );
  const blockedProviders = providers.filter((provider) =>
    ["expired", "missing"].includes(String(provider?.status || "")),
  );
  const oauthProviderCount = readyProviders.filter(
    (provider) =>
      Array.isArray(provider?.profiles) &&
      provider.profiles.some((profile) => profile?.type === "oauth"),
  ).length;
  const byokProviderCount = readyProviders.filter(
    (provider) =>
      Array.isArray(provider?.profiles) &&
      provider.profiles.some((profile) => profile?.type === "api_key" || profile?.type === "token"),
  ).length;

  if (configuredModelCount === 0 && providers.length === 0) {
    return null;
  }

  let summary = "Model posture: awaiting runtime catalog and auth status.";
  if (localModelCount > 0 && readyProviders.length > 0) {
    summary = `Hybrid model posture: ${pluralize(localModelCount, "local model")}, ${pluralize(readyProviders.length, "hosted provider")} ready.`;
  } else if (localModelCount > 0) {
    summary = `Local model posture: ${pluralize(localModelCount, "local model")} visible.`;
  } else if (readyProviders.length > 0) {
    summary = `Hosted model posture: ${pluralize(readyProviders.length, "provider")} ready, ${pluralize(byokProviderCount, "BYOK/token provider")}, ${pluralize(oauthProviderCount, "OAuth provider")}.`;
  } else if (blockedProviders.length > 0) {
    summary = `Hosted model posture blocked: ${pluralize(blockedProviders.length, "provider")} need auth attention.`;
  } else if (configuredModelCount > 0) {
    summary = `Model catalog visible: ${pluralize(configuredModelCount, "configured model")}.`;
  }

  return {
    configuredModelCount,
    localModelCount,
    hostedModelCount,
    readyProviderCount: readyProviders.length,
    blockedProviderCount: blockedProviders.length,
    oauthProviderCount,
    byokProviderCount,
    topReadyProviderLabel: readyProviders[0]?.displayName || readyProviders[0]?.provider || null,
    summary,
  };
}

export function describeModelTelemetry(modelTelemetry) {
  return modelTelemetry?.summary || "";
}

export function buildModelChoiceGuidance({
  modelTelemetry = null,
  launchSupportTelemetry = null,
} = {}) {
  if (!modelTelemetry && !launchSupportTelemetry) {
    return null;
  }

  const configuredPosture = launchSupportTelemetry?.modelPosture || "unknown";
  const localModelCount = modelTelemetry?.localModelCount || 0;
  const hostedModelCount = modelTelemetry?.hostedModelCount || 0;
  const readyProviderCount = modelTelemetry?.readyProviderCount || 0;
  const byokProviderCount = modelTelemetry?.byokProviderCount || 0;
  const oauthProviderCount = modelTelemetry?.oauthProviderCount || 0;

  let mode = "unconfigured";
  let summary = "Model choice guidance unavailable.";

  if (localModelCount > 0 && hostedModelCount > 0) {
    mode = "hybrid";
    summary = `Hybrid model choice validated: ${localModelCount} local model${localModelCount === 1 ? "" : "s"} and ${readyProviderCount} hosted provider${readyProviderCount === 1 ? "" : "s"} are visible in BIOS AI-branded flows.`;
  } else if (localModelCount > 0) {
    mode = "local-only";
    summary = `Local-only model choice validated: ${localModelCount} local model${localModelCount === 1 ? "" : "s"} visible in BIOS AI-branded flows.`;
  } else if (hostedModelCount > 0 && readyProviderCount > 0) {
    mode = "hosted-only";
    summary = `Hosted model choice validated: ${readyProviderCount} provider${readyProviderCount === 1 ? "" : "s"} ready (${byokProviderCount} BYOK/token, ${oauthProviderCount} OAuth).`;
  } else if (configuredPosture === "unconfigured") {
    summary =
      "No configured model choice is validated yet. Configure a local provider or a hosted provider default for BIOS AI-branded flows.";
  } else if (
    configuredPosture === "hosted-only" ||
    configuredPosture === "local-only" ||
    configuredPosture === "hybrid"
  ) {
    mode = configuredPosture;
    summary = `Configured posture is ${configuredPosture}, but runtime readiness still needs validation in the BIOS shell.`;
  }

  return {
    mode,
    configuredPosture,
    summary,
  };
}

export function describeModelChoiceGuidance(modelChoiceGuidance) {
  return modelChoiceGuidance?.summary || "";
}

export function buildLaunchSupportTelemetry(payload = null) {
  if (!payload) {
    return null;
  }

  if (payload.available === false) {
    return {
      available: false,
      status: "missing",
      settingsConfigured: false,
      updateStrategy: "unknown",
      modelPosture: "unknown",
      summary: "Packaged launch support summary has not been captured yet.",
      path: payload.path || null,
      logPath: null,
    };
  }

  const launch = payload.launch || null;
  if (!launch) {
    return null;
  }

  const durationMs = typeof launch.durationMs === "number" ? launch.durationMs : 0;
  const durationSeconds = durationMs > 0 ? Math.max(1, Math.round(durationMs / 1000)) : 0;
  const updateStrategy = launch.support?.updates?.strategy || "unknown";
  const modelPosture = launch.support?.models?.posture || "unknown";
  const settingsConfigured = launch.support?.settings?.configExists === true;
  const status = String(launch.status || "unknown");

  let summary = "Launcher summary available.";
  if (status === "ok") {
    summary = `Last packaged launch succeeded in ${durationSeconds}s.`;
  } else if (status === "timeout") {
    const timeoutSeconds =
      typeof launch.timeoutSeconds === "number" ? launch.timeoutSeconds : durationSeconds;
    summary = `Last packaged launch timed out after ${timeoutSeconds}s.`;
  } else if (status === "already-running") {
    summary = "Launcher attached to an already-running local gateway.";
  }

  return {
    available: true,
    status,
    durationMs,
    durationSeconds,
    settingsConfigured,
    updateStrategy,
    modelPosture,
    openedBrowser: launch.openedBrowser === true,
    hasGatewayToken: launch.hasGatewayToken === true,
    logPath: launch.logPath || launch.support?.logs?.gatewayLogPath || null,
    summary,
  };
}

export function describeLaunchSupportTelemetry(launchSupportTelemetry) {
  return launchSupportTelemetry?.summary || "";
}

export function buildPromptEconomyTelemetry(session = null) {
  if (!session || typeof session !== "object") {
    return null;
  }

  const inputTokens = Number.isFinite(session.inputTokens) ? Math.max(0, session.inputTokens) : 0;
  const outputTokens = Number.isFinite(session.outputTokens)
    ? Math.max(0, session.outputTokens)
    : 0;
  const cacheRead = Number.isFinite(session.cacheRead) ? Math.max(0, session.cacheRead) : 0;
  const cacheWrite = Number.isFinite(session.cacheWrite) ? Math.max(0, session.cacheWrite) : 0;
  const totalTokens = Number.isFinite(session.totalTokens)
    ? Math.max(0, session.totalTokens)
    : inputTokens + outputTokens + cacheRead + cacheWrite;
  const contextTokens = Number.isFinite(session.contextTokens)
    ? Math.max(0, session.contextTokens)
    : 0;
  const percentUsed = Number.isFinite(session.percentUsed)
    ? Math.max(0, session.percentUsed)
    : contextTokens > 0
      ? Math.round((totalTokens / contextTokens) * 100)
      : null;
  const promptTokens = inputTokens + cacheRead + cacheWrite;
  const cacheHitRate = promptTokens > 0 ? Math.round((cacheRead / promptTokens) * 100) : 0;

  let summary = "Prompt economy is still warming up.";
  if (totalTokens > 0 && contextTokens > 0) {
    summary = `Prompt economy: ${formatKTokens(totalTokens)}/${formatKTokens(contextTokens)} used (${percentUsed ?? "?"}%).`;
  } else if (totalTokens > 0) {
    summary = `Prompt economy: ${formatKTokens(totalTokens)} used.`;
  }

  if (cacheRead > 0 || cacheWrite > 0) {
    summary += ` Cache hit ${cacheHitRate}%.`;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    totalTokensFresh: session.totalTokensFresh !== false,
    contextTokens,
    percentUsed,
    cacheRead,
    cacheWrite,
    cacheHitRate,
    model: session.model || null,
    modelProvider: session.modelProvider || null,
    summary,
  };
}

export function describePromptEconomyTelemetry(promptEconomyTelemetry) {
  return promptEconomyTelemetry?.summary || "";
}

export function describeShellLaneSnapshot({
  gatewayConnected = false,
  agentName = "BIOS AI",
  hasCalibratedAgentName = false,
  autonomousMode = false,
  modelTelemetry = null,
  launchSupportTelemetry = null,
} = {}) {
  const shellName = agentName || "BIOS AI";
  const autonomyLead = autonomousMode ? "Autonomous mode enabled." : "Autonomous mode off.";
  const namingLead = hasCalibratedAgentName
    ? `Persona calibrated as ${shellName}.`
    : "Preferred agent name still needs calibration.";
  const modelLead = modelTelemetry?.summary ? ` ${modelTelemetry.summary}` : "";
  const launchLead = launchSupportTelemetry?.summary ? ` ${launchSupportTelemetry.summary}` : "";

  return {
    state: gatewayConnected ? "Shell synced" : "Shell offline",
    chatState: hasCalibratedAgentName ? `Persona: ${shellName}` : "Onboarding pending",
    tag: gatewayConnected
      ? autonomousMode
        ? "Autonomy on"
        : "Observe mode"
      : "Reconnect required",
    copy: `${gatewayConnected ? "Gateway link active." : "Gateway link offline."} ${namingLead} ${autonomyLead}${modelLead}${launchLead}`,
  };
}

export function describeTaskLaneSnapshot(activeMission) {
  if (!activeMission) {
    return {
      state: "Tasks active",
      chatState: "Tasks lane quiet",
      tag: "Task lane",
      copy: "This dock will summarize active missions, detached work, and current checklist progress.",
    };
  }

  const checklist = Array.isArray(activeMission.checklist) ? activeMission.checklist : [];
  const completedCount = checklist.filter((item) => item.status === "completed").length;
  const activeCount = checklist.filter((item) => item.status === "progress").length;
  const pendingCount = checklist.filter((item) => item.status === "pending").length;
  const nextItem = checklist.find((item) => item.status !== "completed");
  const focusText = nextItem ? shortenStatus(nextItem.text, 72) : "All checklist items complete.";

  return {
    state:
      activeCount > 0
        ? "Tasks in progress"
        : pendingCount > 0
          ? "Task queue staged"
          : "Tasks complete",
    chatState: nextItem ? `Next task: ${focusText}` : "Checklist complete",
    tag:
      activeCount > 0
        ? `${activeCount} active`
        : pendingCount > 0
          ? `${pendingCount} pending`
          : "Queue clear",
    copy: `${activeMission.title}. ${completedCount} completed, ${activeCount} active, ${pendingCount} pending. ${nextItem ? `Focus: ${focusText}.` : "Everything on the current plan is complete."}`,
  };
}

export function describeActivitySnapshot({
  activeMission = null,
  runInProgress = false,
  currentRunStatus = "",
  pendingBackgroundStatus = "",
  liveToolStatuses = [],
} = {}) {
  if (activeMission) {
    const label = shortenStatus(activeMission.title || "Mission active", 34);
    return {
      activityLabel: label.toUpperCase(),
      taskActivityLabel: label.toUpperCase(),
      state: "mission",
      copy: activeMission.title || "Mission active",
    };
  }

  const latestToolStatus = Array.from(liveToolStatuses || []).at(-1) || "";
  const activeStatus = shortenStatus(
    pendingBackgroundStatus || latestToolStatus || currentRunStatus,
    46,
  );

  if (pendingBackgroundStatus) {
    return {
      activityLabel: "BACKGROUND",
      taskActivityLabel: activeStatus || "BACKGROUND WORK",
      state: "background",
      copy: activeStatus || "Waiting on background work.",
    };
  }

  if (runInProgress || latestToolStatus) {
    return {
      activityLabel: "WORKING",
      taskActivityLabel: activeStatus || "WORKING ON REQUEST",
      state: "active",
      copy: activeStatus || "Working on your request.",
    };
  }

  return {
    activityLabel: "READY",
    taskActivityLabel: "READY",
    state: "idle",
    copy: "Ready for the next task.",
  };
}

export function describeApprovalLaneSnapshot({
  activeMission = null,
  activeContinuity = null,
} = {}) {
  const reviewQueue = Array.isArray(activeMission?.reviewQueue) ? activeMission.reviewQueue : [];
  const approval = activeMission?.operatorRecord?.approval || null;
  const blockedByApproval = activeContinuity?.blockedByApproval === true;
  const summaryLead = shortenStatus(
    approval?.summary ||
      approval?.warningText ||
      approval?.title ||
      reviewQueue[0] ||
      "No pending approvals.",
    96,
  );

  return {
    state: blockedByApproval
      ? "Approval blocked"
      : reviewQueue.length > 0
        ? "Review queue active"
        : approval
          ? "Approval record synced"
          : "Approval lane clear",
    chatState: blockedByApproval
      ? `Pending approval: ${shortenStatus(approval?.title || "operator gate", 42)}`
      : reviewQueue.length > 0
        ? `${reviewQueue.length} review item${reviewQueue.length === 1 ? "" : "s"} queued`
        : approval
          ? `Approval scope: ${approval.approvalScope || approval.kind}`
          : "No pending approvals",
    tag: blockedByApproval
      ? "Blocked"
      : reviewQueue.length > 0
        ? `${reviewQueue.length} queued`
        : approval
          ? "Record live"
          : "Queue clear",
    copy: blockedByApproval
      ? `${summaryLead} Operator approval is required before the current lane can continue.`
      : reviewQueue.length > 0
        ? `${reviewQueue.length} queued review item${reviewQueue.length === 1 ? "" : "s"}. Latest: ${summaryLead}`
        : approval
          ? `${summaryLead} Boundary: ${approval.boundaryClass || approval.kind}.`
          : "No pending approvals or review items in the current mission.",
  };
}

export function describeLogLaneSnapshot({ activeMission = null, routeDecisionHistory = [] } = {}) {
  const operatorEvidence = Array.isArray(activeMission?.operatorRecord?.evidence)
    ? activeMission.operatorRecord.evidence
    : [];
  const missionEvidence = Array.isArray(activeMission?.evidence) ? activeMission.evidence : [];
  const evidence = Array.from(new Set([...missionEvidence, ...operatorEvidence]));
  const latestEvidence = evidence.at(-1) || "";
  const latestRoute = describeLatestRouteDecision(routeDecisionHistory);
  const summary = shortenStatus(latestEvidence || activeMission?.operatorRecord?.summary || "", 96);

  return {
    state: evidence.length > 0 ? "Log active" : latestRoute ? "Route history live" : "Log standby",
    chatState:
      evidence.length > 0
        ? `${evidence.length} evidence line${evidence.length === 1 ? "" : "s"}`
        : latestRoute
          ? "Latest route recorded"
          : "Log lane quiet",
    tag: evidence.length > 0 ? "Evidence live" : latestRoute ? "Route live" : "Log lane",
    copy:
      latestRoute && summary
        ? `${latestRoute} Latest evidence: ${summary}.`
        : latestRoute
          ? latestRoute
          : summary
            ? `Latest evidence: ${summary}.`
            : "This dock will become the chronological event stream for actions, warnings, approvals, and completions.",
  };
}

export function describeContinuitySnapshot({
  activeMission = null,
  activeContinuity = null,
  gatewayConnected = false,
  skillTelemetry = null,
  modelTelemetry = null,
  routeDecisionHistory = [],
} = {}) {
  const routeTelemetry = describeSkillTelemetry(skillTelemetry, routeDecisionHistory);
  const gatewayLead = gatewayConnected ? "Online services connected." : "Online services offline.";
  const topToolLead = skillTelemetry?.topPromotedToolName
    ? ` Lead tool: ${skillTelemetry.topPromotedToolName}.`
    : "";
  const modelLead = modelTelemetry?.summary ? ` ${modelTelemetry.summary}` : "";

  if (!activeContinuity) {
    return {
      memoryState: "Memory active",
      memoryChatState: "Continuity lane",
      memoryTag: "Memory lane",
      memoryCopy:
        "This dock will hold standing orders, mission context, resumable work, and learned preferences.",
      statusState: gatewayConnected ? "Status synced" : "Online services offline",
      statusChatState: skillTelemetry?.topPromotedToolName
        ? `Lead tool: ${skillTelemetry.topPromotedToolName}`
        : "Status telemetry",
      statusTag: skillTelemetry?.promotedToolCount
        ? `${skillTelemetry.promotedToolCount} tool-ready`
        : "Status lane",
      statusCopy: routeTelemetry
        ? `This dock will summarize BIOS AI health, continuity posture, gateway state, and worker telemetry. ${gatewayLead} ${routeTelemetry}${topToolLead}${modelLead}`
        : `This dock will summarize BIOS AI health, continuity posture, gateway state, and worker telemetry. ${gatewayLead}${modelLead}`,
    };
  }

  const lifecycle = formatContinuityLabel(activeContinuity.lifecycle);
  const recovery = formatContinuityLabel(activeContinuity.recoveryAction);
  const health = formatContinuityLabel(activeContinuity.health);
  const missionLead = activeMission?.title ? `${activeMission.title}. ` : "";
  const gatingLead = activeContinuity.blockedByApproval
    ? "Blocked on operator approval. "
    : activeContinuity.stale
      ? "Marked stale and needs operator review. "
      : "";

  return {
    memoryState: activeContinuity.blockedByApproval ? "Memory blocked" : "Memory synced",
    memoryChatState: activeContinuity.blockedByApproval
      ? "Approval context retained"
      : activeContinuity.stale
        ? "Stale continuity"
        : "Continuity lane",
    memoryTag: activeContinuity.blockedByApproval
      ? "Approval blocked"
      : activeContinuity.stale
        ? "Stale continuity"
        : "Continuity live",
    memoryCopy: `${missionLead}${gatingLead}${lifecycle} lifecycle with ${recovery} recovery posture.`,
    statusState: gatewayConnected ? "Status synced" : "Online services offline",
    statusChatState: activeContinuity.blockedByApproval
      ? "Approval gate active"
      : skillTelemetry?.topPromotedToolName
        ? `Lead tool: ${skillTelemetry.topPromotedToolName}`
        : `Recovery: ${recovery}`,
    statusTag: activeContinuity.blockedByApproval
      ? "Approval blocked"
      : skillTelemetry?.promotedToolCount
        ? `${skillTelemetry.promotedToolCount} tool-ready`
        : activeContinuity.stale
          ? "Needs review"
          : "Status live",
    statusCopy: routeTelemetry
      ? `Continuity is ${health}. Recovery posture: ${recovery}. ${gatewayLead} ${routeTelemetry}${topToolLead}${modelLead}`
      : `Continuity is ${health}. Recovery posture: ${recovery}. ${gatewayLead}${modelLead}`,
  };
}
