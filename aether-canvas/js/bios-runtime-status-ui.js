import { MANAGED_LOCAL_RUNTIME_PROVIDER } from "./bios-runtime.js";

function humanizeBrainstemLifecycle(value) {
  switch (
    String(value || "")
      .trim()
      .toLowerCase()
  ) {
    case "onboarding":
      return "Onboarding";
    case "waiting_for_approval":
      return "Waiting for approval";
    case "recovering":
      return "Recovering";
    case "consolidating":
      return "Consolidating";
    case "dreaming":
      return "Dreaming";
    case "idle":
      return "Idle";
    default:
      return "Needs setup";
  }
}

function describeBrainstemTitle(brainstem, routeReady) {
  switch (
    String(brainstem?.lifecycle || "")
      .trim()
      .toLowerCase()
  ) {
    case "waiting_for_approval":
      return "Approval needed before BIOS AI continues";
    case "recovering":
      return "BIOS AI is recovering its working route";
    case "consolidating":
      return "BIOS AI is consolidating memory";
    case "dreaming":
      return "BIOS AI is dreaming and reorganizing memory";
    case "idle":
      return routeReady ? "Local-first shell ready" : "Finish setup to activate BIOS AI";
    case "onboarding":
      return "Finish setup to activate BIOS AI";
    default:
      return routeReady ? "Local-first shell ready" : "Finish setup to activate BIOS AI";
  }
}

function describeBrainstemNextAction(brainstem, fallback) {
  switch (
    String(brainstem?.recovery_action || "")
      .trim()
      .toLowerCase()
  ) {
    case "finish_onboarding":
      return "Finish onboarding to wake the BOSS fully.";
    case "await_approval":
      return "Review the pending guarded identity changes before chat continues.";
    case "restore_local_route":
      return "Restore the selected local route so BIOS AI can reason again.";
    case "restore_runtime":
      return "Restore the runtime route before BIOS AI starts normal chat.";
    case "run_dream_cycle":
      return "Let BIOS AI finish its dream cycle and fold those memories into durable recall.";
    case "observe":
      return fallback || "You can start chatting now.";
    default:
      return fallback;
  }
}

function readObservationValue(observation, snakeName, camelName, fallback = "") {
  if (!observation) {
    return fallback;
  }
  const raw = observation[snakeName] ?? observation[camelName];
  const text = String(raw ?? "").trim();
  return text || fallback;
}

function buildRuntimeConsumerState(status) {
  const download = status?.download || null;
  const downloadState = String(download?.state || "").toLowerCase();
  const routeStatus = String(status?.route_status_label || "").toLowerCase();
  const routeDetail = String(status?.route_detail || "");
  const nextStep = String(status?.next_step || "");
  const workerLabel =
    status.preferred_local_backend === MANAGED_LOCAL_RUNTIME_PROVIDER
      ? status.worker_status_label
      : status.local_backend_detail;

  if (downloadState === "downloading") {
    const progress =
      Number.isFinite(download?.progress_percent) && download.progress_percent > 0
        ? ` ${Math.round(download.progress_percent)}% downloaded.`
        : "";
    return {
      agentStateLabel: "Downloading BOSS brain",
      routeReadinessLabel: "BOSS brain download in progress",
      runtimeNote: `BIOS AI is downloading the selected BOSS brain.${progress} Chat unlocks after the BOSS brain is installed and verified.`,
      title: "BOSS brain downloading",
      nextActionLabel: "Keep BIOS AI open while the BOSS brain download finishes.",
      workerLabel: workerLabel || "BOSS brain download in progress",
    };
  }

  if (downloadState === "failed") {
    const error = download?.error || "BOSS brain download failed.";
    if (download?.resumable) {
      const partial =
        Number.isFinite(download.downloaded_bytes) && download.downloaded_bytes > 0
          ? ` ${Math.floor(download.downloaded_bytes / (1024 * 1024))} MB is preserved.`
          : "";
      return {
        agentStateLabel: "Download resumable",
        routeReadinessLabel: "BOSS brain download can resume",
        runtimeNote: `${error}${partial} Retry the BOSS brain download and BIOS AI will continue from the partial file.`,
        title: "BOSS brain download can resume",
        nextActionLabel:
          "Retry the BOSS brain download; BIOS AI will continue from the saved partial file.",
        workerLabel: workerLabel || "BOSS brain download resumable",
      };
    }
    return {
      agentStateLabel: "Needs attention",
      routeReadinessLabel: "BOSS brain download failed",
      runtimeNote: `${error} Choose another BOSS brain, retry the download, or switch to an available external runtime.`,
      title: "BOSS brain setup needs attention",
      nextActionLabel: "Retry the BOSS brain download or switch to an available runtime.",
      workerLabel: workerLabel || "BOSS brain download failed",
    };
  }

  if (!status.route_ready) {
    const blocked = /blocked|missing|failed|unavailable|needs|not ready/i.test(
      `${status.route_status_label || ""} ${routeDetail} ${nextStep}`,
    );
    return {
      agentStateLabel: blocked ? "Runtime blocked" : "Needs setup",
      routeReadinessLabel: blocked ? "Runtime blocked" : status.route_status_label,
      runtimeNote: `${routeDetail} ${nextStep}`.trim(),
      title: blocked ? "Runtime blocked" : "Finish setup to activate BIOS AI",
      nextActionLabel: nextStep || "Finish runtime setup before the first chat.",
      workerLabel: workerLabel || "No BOSS runtime yet",
    };
  }

  if (status.worker_ready === false || /degraded|partial|fallback/i.test(routeStatus)) {
    return {
      agentStateLabel: "Route degraded",
      routeReadinessLabel: status.route_status_label || "Route degraded",
      runtimeNote:
        `${routeDetail} ${nextStep || "BIOS AI can keep working, but one runtime lane needs attention."}`.trim(),
      title: "Runtime route degraded",
      nextActionLabel: nextStep || "Review the runtime lane before starting long-running work.",
      workerLabel: workerLabel || "BOSS runtime needs attention",
    };
  }

  return {
    agentStateLabel: "Idle",
    routeReadinessLabel: status.route_status_label,
    runtimeNote: routeDetail,
    title: "Local-first shell ready",
    nextActionLabel: nextStep || "You can start chatting now.",
    workerLabel: workerLabel,
  };
}

export function buildBiosRuntimeStatusRenderSnapshot(status, options = {}) {
  const safetyLabel = options.safetyLabel || "waiting";
  const authorityMode = options.authorityMode === "broad" ? "broad" : "ask first";
  const agentName = options.agentName || "waiting";
  const brainstem = options.brainstem || null;
  const reflex = options.reflex || null;
  const observation = options.observation || null;
  const consumerState = buildRuntimeConsumerState(status);
  const workerLabel = consumerState.workerLabel;
  const routeNote = brainstem?.summary ? brainstem.summary : consumerState.runtimeNote;
  const agentStateLabel = brainstem
    ? humanizeBrainstemLifecycle(brainstem.lifecycle)
    : consumerState.agentStateLabel;
  const nextActionLabel = describeBrainstemNextAction(brainstem, consumerState.nextActionLabel);
  const bodySummary = readObservationValue(observation, "body_summary", "bodySummary");
  const bodyStateLabel = readObservationValue(
    observation,
    "body_state_label",
    "bodyStateLabel",
    "Workspace ready",
  );
  const hostInterruptionPolicy = readObservationValue(
    observation,
    "host_interruption_policy",
    "hostInterruptionPolicy",
    "Computer changes stay paused until protected work is ready.",
  );
  const userControlLabel = readObservationValue(
    observation,
    "user_control_label",
    "userControlLabel",
    "Computer control is paused.",
  );
  const viewportTitle = readObservationValue(
    observation,
    "viewport_title",
    "viewportTitle",
    "BIOS Home",
  );
  const nextBodyAction = readObservationValue(
    observation,
    "next_body_action",
    "nextBodyAction",
    "Finish setup or send work to wake the BIOS body.",
  );
  const boxedLaneProvisioning = status.boxed_lane_provisioning || {};
  const boxedLaneProductLabel =
    boxedLaneProvisioning.backend || status.sandbox_backend || "BIOS AI Boxed Lane";
  const boxedLaneAdapterLabel =
    boxedLaneProvisioning.adapter_label || boxedLaneProvisioning.substrate_label || "";
  const boxedLaneDetailLabel =
    boxedLaneProvisioning.next_action ||
    (status.lxc_available ? status.lxc_detail : status.wsl_detail || status.lxc_detail);
  const boxedLaneSafetyLabel = boxedLaneProvisioning.safe_to_run_untrusted_work
    ? "Untrusted work can run in the boxed lane"
    : "Untrusted tool, skill, dependency, and connection work is blocked from host execution";

  const supportLead = bodySummary
    ? `Body: ${bodySummary}`
    : readObservationValue(observation, "detail", "detail")
        ? `Body: ${readObservationValue(observation, "detail", "detail")}`
        : reflex?.summary
          ? `Reflex growth: ${reflex.summary}`
        : status.debug_log_path
          ? "Diagnostics are available in the Log surface."
          : "Diagnostics will appear in the Log surface once BIOS AI writes support events.";

  return {
    sandboxHealthLabel: status.boxed_lane_ready ? "Boxed lane ready" : "Boxed lane needs substrate",
    lxcStatusLabel: [boxedLaneProductLabel, boxedLaneAdapterLabel, boxedLaneDetailLabel]
      .filter(Boolean)
      .join(": "),
    boxedLaneSafetyLabel,
    boxedLaneInstallStateLabel: boxedLaneProvisioning.install_state || "unknown",
    managedRuntimeHealthLabel: status.managed_runtime_detail,
    settingsLocalWorkerLabel: workerLabel,
    settingsRouteReadinessLabel: consumerState.routeReadinessLabel,
    settingsRuntimeNote: routeNote,
    debugLogPathLabel: status.debug_log_path
      ? "Available in the Log surface"
      : "Log details will appear after BIOS AI writes support events",
    doctorSummaryLabel: `${status.doctor_summary} Build: ${
      status.packaged_build ? "packaged app" : "dev shell"
    } | Installer: ${status.installer_mode}.`,
    shellModelStatus: status.route_mode_label || "Not configured",
    workerShellLabel: workerLabel,
    agentStateLabel,
    viewportSnapshot: {
      kicker: status.packaged_build ? "BIOS Home" : "Dev shell",
      title: brainstem
        ? describeBrainstemTitle(brainstem, status.route_ready)
        : consumerState.title,
      profileLabel: `BOSS: ${agentName}`,
      routeLabel: `Route: ${(status.route_mode_label || "waiting").toLowerCase()}`,
      safetyLabel: `Safety: ${safetyLabel}`,
      authorityLabel: `Authority: ${authorityMode}`,
      bodyStateLabel: `Body: ${bodyStateLabel}`,
      hostInterruptionPolicy,
      userControlLabel,
      viewportTitle,
      readinessLabel: consumerState.routeReadinessLabel || "Waiting for route",
      workerLabel: workerLabel || "No BOSS runtime yet",
      nextActionLabel: nextActionLabel || "Finish setup on the left before the first chat.",
      nextBodyAction,
      supportLabel: supportLead,
      note: routeNote,
    },
  };
}
