import {
  buildDebugLogMetaLabel,
  buildDebugLogSupportSummary,
  renderDebugLogStream,
} from "../bios-debug-log-ui.js";
import {
  buildBiosDiagnosticsSnapshot,
  renderDiagnosticsActionList,
  renderDiagnosticsIssueGroups,
  renderDiagnosticsStillWorksList,
} from "../bios-diagnostics-ui.js";
import { buildBiosRuntimeStatusRenderSnapshot } from "../bios-runtime-status-ui.js";
import {
  loadBiosShellContract,
  readBiosBrainstemStatusFromContract,
  readBiosDreamStatusFromContract,
  readBiosMemoryStatusFromContract,
  readBiosOnboardingFromContract,
  readBiosRuntimeStatusFromContract,
  readBiosSoulStatusFromContract,
} from "../native-contracts/bios-shell-contract.js";
import { renderSandboxLaneSurface } from "../sandbox-lanes/controller.js";

async function hydrateBiosShellContract(app) {
  const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
  const contract = await loadBiosShellContract(tauriInvoke, app.activeBiosProfileId || null);
  if (!contract) {
    return null;
  }
  app.biosShellContract = contract;
  app.biosDiagnostics = contract.diagnostics || null;
  app.biosBoxedLane = contract.boxed_lane || null;
  app.biosPromotion = contract.promotion || null;
  app.biosMemoryContract = readBiosMemoryStatusFromContract(contract);
  app.biosSoulContract = readBiosSoulStatusFromContract(contract);
  app.biosDreamContract = readBiosDreamStatusFromContract(contract);
  app.biosBrainstem = readBiosBrainstemStatusFromContract(contract);
  app.circadianState = contract.circadian || null;
  app.compactionHealth = contract.glymphatic || null;
  app.biosReflex = contract.reflex || null;
  app.biosObservation = contract.observation || null;
  const runtime = readBiosRuntimeStatusFromContract(contract);
  if (runtime) {
    app.biosRuntimeStatus = runtime;
  }
  const onboarding = readBiosOnboardingFromContract(contract);
  if (onboarding) {
    app.onboardingState = onboarding;
  }
  return contract;
}

function boxedLaneNeedsAutomaticSetup(contract) {
  const provisioning = contract?.boxed_lane?.provisioning || null;
  if (!provisioning || provisioning.safe_to_run_untrusted_work) {
    return false;
  }
  return ["needs_os_feature", "needs_linux_distro"].includes(provisioning.install_state);
}

async function maybeAutoPrepareBoxedLane(app, contract) {
  if (!app.activeBiosProfileId || !boxedLaneNeedsAutomaticSetup(contract)) {
    return null;
  }
  const profileId = app.activeBiosProfileId;
  app._biosBoxedLaneAutoPrepareStarted ||= new Set();
  if (app._biosBoxedLaneAutoPrepareStarted.has(profileId)) {
    return null;
  }
  app._biosBoxedLaneAutoPrepareStarted.add(profileId);
  const result = {
    action_taken: "background_repair_queued",
    message:
      "BOSS repair is queued in the background. BIOS AI will not change OS features until the user chooses Repair And Verify Boxed Lane.",
    command_preview: "boxed-lane OS setup waiting for explicit repair action",
    last_repair_summary: null,
  };
  app.biosBoxedLaneAutoPrepareResult = result;
  return result;
}

export async function loadOnboardingStateSurface(app) {
  try {
    const contract = await hydrateBiosShellContract(app);
    const onboarding = readBiosOnboardingFromContract(contract);
    if (onboarding) {
      if (!onboarding.completed) {
        app.showOnboardingModal();
      } else if (onboarding.agentName) {
        app.agentName = onboarding.agentName;
        app.updateAgentNameDOM();
      }
      app.syncSavedOnboardingSnapshot();
      return onboarding;
    }
  } catch (err) {
    console.error("[AetherApp] Failed to load onboarding state:", err);
  }
  app.syncSavedOnboardingSnapshot();
  return null;
}

export async function loadBiosRuntimeStatusSurface(app, options = {}) {
  try {
    const shouldTickBrainstem = options.tickBrainstem !== false;
    if (shouldTickBrainstem && typeof app.tickBiosBrainstem === "function") {
      await app.tickBiosBrainstem({ allowDream: options.allowDream !== false });
    }
    const contract = await hydrateBiosShellContract(app);
    try {
      await maybeAutoPrepareBoxedLane(app, contract);
    } catch (err) {
      app.biosBoxedLaneAutoPrepareError = err?.message || String(err);
    }
    const status = readBiosRuntimeStatusFromContract(contract);
    app.renderBiosRuntimeStatus(status);
    return status;
  } catch (err) {
    console.error("[AetherApp] Failed to load BIOS runtime status:", err);
    app.setStatusValue("st-sandbox-health", "Runtime audit unavailable");
    const doctorSummary = document.getElementById("settings-doctor-summary");
    if (doctorSummary) {
      doctorSummary.innerText = err?.message || String(err);
    }
    return null;
  }
}

export function renderBiosRuntimeStatusSurface(app, status) {
  if (!status) return;
  if (app.profilePickerActive) {
    app.renderProfilePickerViewport?.();
    return;
  }
  const escapeHtml = (value) =>
    typeof app.escapeHtml === "function"
      ? app.escapeHtml(value)
      : String(value ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");
  renderSandboxLaneSurface(app, app.biosShellContract || null);
  if (typeof app.renderBiosSurfacePanel === "function") {
    app.renderBiosSurfacePanel();
  }
  const activeProfile =
    app.biosProfiles?.find((profile) => profile.id === app.activeBiosProfileId) || null;
  const diagnosticsSnapshot = buildBiosDiagnosticsSnapshot({
    activeProfile,
    diagnostics: app.biosDiagnostics,
    onboarding: app.getSavedOnboardingSnapshot?.() || null,
    runtimeStatus: status,
    brainstem: app.biosBrainstem || null,
  });
  const runtimeUi = buildBiosRuntimeStatusRenderSnapshot(status, {
    safetyLabel: document.getElementById("st-safety-posture")?.innerText || "waiting",
    authorityMode:
      document.getElementById("settings-posture")?.innerText === "Broad authority"
        ? "broad"
        : "ask first",
    agentName: app.agentName || "waiting",
    brainstem: app.biosBrainstem || null,
    reflex: app.biosReflex || null,
    observation: app.biosObservation || null,
  });

  const textMap = [
    ["settings-sandbox-health", runtimeUi.sandboxHealthLabel],
    ["settings-lxc-status", runtimeUi.lxcStatusLabel],
    ["settings-managed-runtime-health", runtimeUi.managedRuntimeHealthLabel],
    ["settings-local-worker", runtimeUi.settingsLocalWorkerLabel],
    ["settings-route-readiness", runtimeUi.settingsRouteReadinessLabel],
    ["settings-runtime-note", runtimeUi.settingsRuntimeNote],
    ["settings-debug-log-path", runtimeUi.debugLogPathLabel],
    ["settings-doctor-summary", runtimeUi.doctorSummaryLabel],
    ["settings-recovery-status", diagnosticsSnapshot.recoveryLabel],
    ["settings-diagnostics-headline", diagnosticsSnapshot.headline],
    ["settings-diagnostics-summary", diagnosticsSnapshot.summary],
    [
      "settings-diagnostics-issues",
      diagnosticsSnapshot.issues.length
        ? diagnosticsSnapshot.issues.join(" ")
        : "No active BIOS AI recovery issues.",
    ],
  ];
  textMap.forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
  });

  const htmlMap = [
    [
      "settings-diagnostics-groups",
      renderDiagnosticsIssueGroups(diagnosticsSnapshot.issueGroups, escapeHtml),
    ],
    [
      "settings-diagnostics-actions",
      renderDiagnosticsActionList(diagnosticsSnapshot.recoveryActions, escapeHtml),
    ],
    [
      "settings-diagnostics-still-works",
      renderDiagnosticsStillWorksList(diagnosticsSnapshot.whatStillWorks, escapeHtml),
    ],
  ];
  htmlMap.forEach(([id, html]) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
  const supportSummary = document.getElementById("settings-diagnostics-support-summary");
  if (supportSummary) {
    supportSummary.innerText = diagnosticsSnapshot.supportSummary;
  }

  app.setStatusValue("st-model", runtimeUi.shellModelStatus);
  if (!app.continuityHealth) {
    app.setStatusValue("st-agent-state", runtimeUi.agentStateLabel);
  }
  app.renderViewportIdleCompanion(runtimeUi.viewportSnapshot);
}

export async function loadDebugLogSurface(app) {
  const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
  const stream = document.getElementById("log-stream");
  if (!stream) return;
  if (typeof tauriInvoke !== "function") {
    stream.innerHTML =
      '<p class="ctx-empty">BIOS debug logging is unavailable in this surface.</p>';
    return;
  }
  try {
    const contract = app.biosShellContract || (await hydrateBiosShellContract(app));
    const contractRuntimeStatus = readBiosRuntimeStatusFromContract(contract);
    const [logText, runtimeStatus] = await Promise.all([
      tauriInvoke("read_debug_log"),
      Promise.resolve(contractRuntimeStatus || app.biosRuntimeStatus || null),
    ]);
    if (!app.biosRuntimeStatus && runtimeStatus) {
      app.biosRuntimeStatus = runtimeStatus;
      app.renderBiosRuntimeStatus(runtimeStatus);
    }
    const meta = document.getElementById("log-meta");
    if (meta) {
      meta.innerText = `${buildDebugLogMetaLabel(runtimeStatus)} ${buildDebugLogSupportSummary(logText, runtimeStatus)}`;
    }
    stream.innerHTML = renderDebugLogStream(logText, (value) => app.escapeHtml(value));
  } catch (err) {
    stream.innerHTML = `<p class="ctx-empty">${app.escapeHtml(err?.message || String(err))}</p>`;
  }
}
