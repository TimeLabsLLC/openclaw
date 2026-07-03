import {
  BIOS_DEFAULT_SAFETY_POSTURE,
  BIOS_DEFAULT_SANDBOX_BACKEND,
  defaultSafetyPostureSnapshot,
  DIRECT_LOCAL_LLM_PROVIDERS,
  formatBiosRuntimeStrategyLabel,
  formatSavedLocalBackend,
  MANAGED_LOCAL_RUNTIME_PROVIDER,
} from "./bios-runtime.js";
import { formatLocalWorkerLabel } from "./onboarding-local-runtime.js";
import { buildLocalCapabilityPosture } from "./runtime-transport/local-capability-posture.js";

function buildLocalWorkerLabel(saved) {
  return (
    formatLocalWorkerLabel(saved.localWorkerModelVariant) ||
    (saved.localWorkerDownloadStatus === "skipped"
      ? "BOSS brain deferred"
      : saved.localWorkerDownloadStatus === "failed"
        ? "BOSS brain needs attention"
        : saved.localWorkerDownloadStatus === "installed-needs-verification"
          ? "BOSS brain verification pending"
          : "")
  );
}

function buildWorkerLaneSummary(runtimeStatus = null) {
  const lanes = Array.isArray(runtimeStatus?.worker_lanes) ? runtimeStatus.worker_lanes : [];
  const bossLane = lanes.find((lane) => lane?.role === "boss_brain");
  if (!bossLane?.ready) {
    return "";
  }
  return `BOSS brain: ${bossLane.selected_model_id || bossLane.selected_variant || "ready"}`;
}

function buildModelStatus(saved, localWorkerLabel) {
  const cloudProvider =
    saved.preferredCloudProvider || saved.apiKeys?.[saved.primaryKeyIndex || 0]?.provider;
  if (saved.modelPref === "hybrid") {
    return localWorkerLabel ? `Hybrid · ${localWorkerLabel}` : "Hybrid";
  }
  if (saved.modelPref === "local") {
    return localWorkerLabel || "Local only";
  }
  if (saved.modelPref === "commercial") {
    return cloudProvider ? `Cloud · ${cloudProvider}` : "Cloud BOSS";
  }
  return "Choose route";
}

function buildRouteReadiness(saved, localWorkerLabel) {
  const hasCloud = Boolean(saved.preferredCloudProvider) || saved.apiKeys?.length > 0;
  const localWorkerUsable =
    Boolean(localWorkerLabel) &&
    ["completed", "installed"].includes(saved.localWorkerDownloadStatus);
  if (saved.modelPref === "local") {
    return localWorkerUsable ? "Ready for local chat" : "Needs local worker";
  }
  if (saved.modelPref === "hybrid") {
    if (hasCloud && localWorkerUsable) {
      return "Cloud and local ready";
    }
    if (hasCloud) {
      return "Cloud ready · local worker optional";
    }
    return localWorkerUsable ? "Local ready · cloud key missing" : "Needs a key or local worker";
  }
  if (saved.modelPref === "commercial") {
    return hasCloud ? "Ready for cloud chat" : "Needs cloud key";
  }
  return "Choose BOSS route";
}
function readObservationValue(observation, snakeName, camelName, fallback = "") {
  if (!observation) {
    return fallback;
  }
  const raw = observation[snakeName] ?? observation[camelName];
  const text = String(raw ?? "").trim();
  return text || fallback;
}

export function buildSavedShellState({
  rawSaved,
  activeProfileName,
  runtimeStatus,
  gatewayConnected,
  memoryContract = null,
  observation = null,
  skillLibrary = null,
}) {
  const saved = {
    ...defaultSafetyPostureSnapshot(),
    ...rawSaved,
  };
  const localWorkerLabel = buildLocalWorkerLabel(saved);
  const localBackendLabel = formatSavedLocalBackend(saved.preferredLocalBackend);
  const hasDirectLocalBackend = DIRECT_LOCAL_LLM_PROVIDERS.has(saved.preferredLocalBackend);
  const modelStatus = buildModelStatus(saved, localWorkerLabel);
  const routeReadiness = buildRouteReadiness(saved, localWorkerLabel);

  const effectiveModelStatus =
    saved.modelPref === "hybrid"
      ? hasDirectLocalBackend && localBackendLabel
        ? `Hybrid · ${localBackendLabel}`
        : modelStatus
      : saved.modelPref === "local"
        ? (hasDirectLocalBackend ? localBackendLabel : "") || modelStatus
        : modelStatus;

  const effectiveRouteReadiness =
    saved.modelPref === "local"
      ? hasDirectLocalBackend && localBackendLabel
        ? `${localBackendLabel} ready`
        : routeReadiness
      : saved.modelPref === "hybrid" &&
          hasDirectLocalBackend &&
          localBackendLabel &&
          !saved.preferredCloudProvider &&
          !saved.apiKeys?.length
        ? "Local ready · cloud key missing"
        : saved.modelPref === "hybrid" &&
            hasDirectLocalBackend &&
            localBackendLabel &&
            (saved.preferredCloudProvider || saved.apiKeys?.length > 0)
          ? "Cloud and local ready"
          : routeReadiness;

  const routeModeLabel =
    saved.modelPref === "hybrid"
      ? "Hybrid"
      : saved.modelPref === "local"
        ? "Local only"
        : saved.modelPref === "commercial"
          ? "Cloud BOSS"
          : "Choose route";

  const settingsLocalWorker =
    (runtimeStatus?.preferred_local_backend === MANAGED_LOCAL_RUNTIME_PROVIDER
      ? runtimeStatus?.worker_status_label
      : runtimeStatus?.local_backend_detail) ||
    localBackendLabel ||
    localWorkerLabel ||
    "No BOSS runtime yet";
  const workerLaneSummary = buildWorkerLaneSummary(runtimeStatus);

  const savedRuntimeCheckNeeded = !runtimeStatus && saved.completed;
  const routeReadinessLabel =
    runtimeStatus?.route_status_label ||
    (savedRuntimeCheckNeeded ? "Runtime check needed" : effectiveRouteReadiness);
  const shellModelStatus = runtimeStatus?.route_mode_label || effectiveModelStatus;
  const workerShellLabel =
    workerLaneSummary ||
    (runtimeStatus?.preferred_local_backend === MANAGED_LOCAL_RUNTIME_PROVIDER
      ? runtimeStatus?.worker_status_label
      : runtimeStatus?.local_backend_detail) ||
    (localBackendLabel || localWorkerLabel
      ? `${localBackendLabel || localWorkerLabel} ready`
      : "No BOSS runtime");
  const localCapabilityPosture = buildLocalCapabilityPosture({
    runtimeStatus,
    onboardingState: saved,
    memorySurface: memoryContract
      ? {
          totalEvents: memoryContract.total_events || 0,
          standingOrders: [],
          userPreferences: [],
          missionFacts: [],
          consolidatedMemory:
            memoryContract.durable_memory_count > 0 ? [{ text: "Durable memory online" }] : [],
        }
      : null,
    observation,
    skillLibrary: skillLibrary
      ? {
          hardenedSkillCount: skillLibrary.hardened_skill_count || 0,
          strongestSkill: skillLibrary.strongest_skill || null,
          artifacts: Array.from({ length: skillLibrary.hardened_skill_count || 0 }).map(() => ({
            text: skillLibrary.strongest_skill || "Hardened skill",
          })),
        }
      : null,
  });

  const shellNote = runtimeStatus
    ? runtimeStatus.route_ready
      ? `${runtimeStatus.route_detail} ${localCapabilityPosture.summary}`
      : `${runtimeStatus.route_detail} ${runtimeStatus.next_step} ${localCapabilityPosture.summary}`
    : savedRuntimeCheckNeeded
      ? "Runtime check needed. Saved setup is loaded, but BIOS AI has not verified the active route yet."
      : saved.modelPref === "hybrid"
        ? `${localCapabilityPosture.summary} Hybrid keeps lighter work local when possible and leaves harder work available to a cloud model once a key is configured.`
        : saved.modelPref === "local"
          ? saved.preferredLocalBackend === MANAGED_LOCAL_RUNTIME_PROVIDER
            ? `${localCapabilityPosture.summary} Local only keeps model reasoning on this machine through the BIOS AI managed llama.cpp runtime.`
            : `${localCapabilityPosture.summary} Local only keeps model reasoning on this machine.`
          : saved.modelPref === "commercial"
            ? "Cloud BOSS uses a hosted model for main reasoning. Add a local worker later if you want hybrid fallback."
            : "Choose a BOSS route during onboarding before BIOS AI starts normal chat.";

  const viewportSnapshot = {
    kicker: gatewayConnected ? "BIOS Home" : "Offline shell",
    profileLabel: `BOSS: ${activeProfileName}`,
    routeLabel: runtimeStatus?.route_mode_label
      ? `Route: ${runtimeStatus.route_mode_label.toLowerCase()}`
      : saved.modelPref === "hybrid"
        ? "Route: hybrid"
        : saved.modelPref === "local"
          ? "Route: local only"
          : saved.modelPref === "commercial"
            ? "Route: cloud"
            : "Route: choose route",
    safetyLabel: `Safety: ${saved.safetyPostureLabel || BIOS_DEFAULT_SAFETY_POSTURE}`,
    authorityLabel:
      saved.permissionMode === "allowed" ? "Authority: broad" : "Authority: ask first",
    bodyStateLabel: `Body: ${readObservationValue(
      observation,
      "body_state_label",
      "bodyStateLabel",
      "Workspace ready",
    )}`,
    hostInterruptionPolicy: readObservationValue(
      observation,
      "host_interruption_policy",
      "hostInterruptionPolicy",
      "Computer changes stay paused until protected work is ready.",
    ),
    userControlLabel: readObservationValue(
      observation,
      "user_control_label",
      "userControlLabel",
      "Computer control is paused.",
    ),
    viewportTitle: readObservationValue(
      observation,
      "viewport_title",
      "viewportTitle",
      "BIOS Home",
    ),
    readinessLabel: routeReadinessLabel,
    workerLabel: settingsLocalWorker,
    nextActionLabel: runtimeStatus?.next_step
      ? runtimeStatus.next_step
      : savedRuntimeCheckNeeded
        ? "Wait for BIOS AI to verify the saved runtime route before chat."
        : effectiveRouteReadiness === "Needs local worker"
          ? "Install a BIOS AI managed local worker before the first chat."
          : effectiveRouteReadiness === "Needs cloud key"
            ? "Add a usable cloud key or switch this BOSS profile to local routing."
            : gatewayConnected
              ? "You can start chatting now."
              : "Reconnect the gateway or keep working in the local shell.",
    nextBodyAction: readObservationValue(
      observation,
      "next_body_action",
      "nextBodyAction",
      "Finish setup or send work to wake the BIOS body.",
    ),
    supportLabel: runtimeStatus?.debug_log_path
      ? `Runtime log: ${runtimeStatus.debug_log_path}`
      : gatewayConnected
        ? "Diagnostics and recovery details stay visible in Settings and Log."
        : "Gateway is offline. Diagnostics stay visible in Settings and Log.",
    note: runtimeStatus
      ? shellNote
      : savedRuntimeCheckNeeded
        ? "Runtime check needed. Saved setup is loaded, but BIOS AI has not verified the active route yet."
        : effectiveRouteReadiness === "Needs local worker" ||
            effectiveRouteReadiness === "Needs cloud key"
          ? `${effectiveRouteReadiness}. Finish setup on the left before the first chat.`
          : `${effectiveRouteReadiness}. ${saved.sandboxBackend || BIOS_DEFAULT_SANDBOX_BACKEND} stays primary and ${formatBiosRuntimeStrategyLabel(saved.localRuntimeStrategy)} remains active.`,
    title: runtimeStatus
      ? runtimeStatus.route_ready
        ? "Local-first shell ready"
        : "Finish setup to activate BIOS AI"
      : savedRuntimeCheckNeeded
        ? "Verifying BIOS AI runtime"
        : "Finish setup to activate BIOS AI",
  };

  return {
    saved,
    routeModeLabel,
    settingsLocalWorker,
    routeReadinessLabel,
    shellModelStatus,
    workerShellLabel,
    shellNote,
    activeProfileName,
    agentState: runtimeStatus
      ? runtimeStatus.route_ready
        ? "Idle"
        : "Needs setup"
      : savedRuntimeCheckNeeded
        ? "Checking runtime"
        : "Onboarding",
    viewportSnapshot,
    gatewayStatusLabel: gatewayConnected ? "Connected" : "Offline shell",
    forgeStatusLabel: gatewayConnected
      ? "Gateway feed pending; local Arena available"
      : "Local Arena available",
  };
}
