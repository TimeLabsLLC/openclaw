import {
  buildBiosDiagnosticsSnapshot,
  renderDiagnosticsActionList,
  renderDiagnosticsIssueGroups,
  renderDiagnosticsStillWorksList,
} from "../bios-diagnostics-ui.js";
import {
  buildBiosProfileDangerCopy,
  buildBiosProfileDeleteConfirmation,
  buildBiosProfileOverviewCopy,
  buildBiosProfileOverviewTitle,
  buildBiosProfileStatusLabel,
} from "../bios-profile-ui.js";
import {
  BIOS_DEFAULT_SAFETY_POSTURE,
  BIOS_DEFAULT_SANDBOX_BACKEND,
  formatSavedLocalBackend,
  formatBiosRuntimeEngineLabel,
  formatBiosRuntimeOwnerLabel,
  formatBiosRuntimeStrategyLabel,
  MANAGED_LOCAL_RUNTIME_PROVIDER,
} from "../bios-runtime.js";
import { buildBiosSettingsSnapshot } from "../bios-settings-ui.js";
import { buildSavedShellState } from "../bios-shell-state.js";
import {
  BIOS_WORKER_ROLE_BOSS,
  BIOS_WORKER_ROLE_MEDIUM,
  BIOS_WORKER_ROLE_SMALL,
  buildBossWorkerRosterAssignments,
} from "../boss-model-governor.js";
import {
  buildLocalWorkerOptions,
  chooseRecommendedLocalWorker,
  describeLocalMachineFit,
  formatLocalWorkerLabel,
} from "../onboarding-local-runtime.js";
import { buildWorkerDownloadProgressSnapshot } from "../onboarding-worker-ui.js";
import { buildLocalToolInventorySummary } from "../runtime-transport/local-capability-posture.js";

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.innerText = value;
  }
}

function setHtml(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.innerHTML = value;
  }
}

function escapeSettingsHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setSelectValue(id, value, fallback = "") {
  const el = document.getElementById(id);
  if (el) {
    el.value = value ?? fallback;
  }
}

function setDisabled(ids, disabled) {
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = disabled;
    }
  });
}

function settingsRuntimeDraftIsDirty(app) {
  return Boolean(app?._settingsRuntimeDraftDirty);
}

function markSettingsRuntimeDraftDirty(app) {
  if (app) {
    app._settingsRuntimeDraftDirty = true;
  }
}

function clearSettingsRuntimeDraft(app) {
  if (app) {
    app._settingsRuntimeDraftDirty = false;
  }
}

function settingsRuntimeDraftChanged({
  saved,
  routeValue,
  backendValue,
  bossVariant,
  mediumVariant,
  smallVariant,
  customWorkerPath,
}) {
  const savedBossVariant = getRosterVariant(
    saved,
    BIOS_WORKER_ROLE_BOSS,
    saved.localWorkerModelVariant || "",
  );
  const savedMediumVariant = getRosterVariant(saved, BIOS_WORKER_ROLE_MEDIUM, "");
  const savedSmallVariant = getRosterVariant(saved, BIOS_WORKER_ROLE_SMALL, "");
  return (
    (routeValue || "commercial") !== (saved.modelPref || "commercial") ||
    (backendValue || "") !== (saved.preferredLocalBackend || "") ||
    (bossVariant || "") !== (savedBossVariant || "") ||
    (mediumVariant || "") !== (savedMediumVariant || "") ||
    (smallVariant || "") !== (savedSmallVariant || "") ||
    (customWorkerPath || "") !== (saved.localWorkerModelPath || "")
  );
}

function findConnectorStatus(response, connectorName) {
  const normalizedName = String(connectorName || "")
    .trim()
    .toLowerCase();
  const connectors = Array.isArray(response?.connectors) ? response.connectors : [];
  return (
    connectors.find(
      (connector) =>
        String(connector?.connector || "")
          .trim()
          .toLowerCase() === normalizedName,
    ) || null
  );
}

export function buildWorkerSelectLabel(entry) {
  const status = entry.installed
    ? "installed"
    : entry.downloadSupported
      ? "available to install"
      : "custom";
  return `${entry.label} - ${entry.family} - ${status}`;
}

export function buildWorkerCatalogState(workerCatalog, currentVariant, routeValue = "local") {
  const workerOptions = buildLocalWorkerOptions(
    workerCatalog?.machine_profile || null,
    workerCatalog,
  );
  const installedVariants = new Set(
    workerOptions.filter((entry) => entry.installed).map((entry) => entry.variant),
  );
  const selectableVariants = new Set(workerOptions.map((entry) => entry.variant));
  const entryByVariant = new Map(workerOptions.map((entry) => [entry.variant, entry]));
  const recommendedVariant =
    routeValue === "hybrid"
      ? workerCatalog?.recommended_hybrid_variant || null
      : workerCatalog?.recommended_local_variant || null;
  const recommendedEntry =
    entryByVariant.get(recommendedVariant) ||
    chooseRecommendedLocalWorker(workerOptions, routeValue === "hybrid" ? "hybrid" : "local") ||
    null;
  return {
    workerOptions,
    installedVariants,
    selectableVariants,
    entryByVariant,
    recommendedEntry,
    machineFitSummary: describeLocalMachineFit(workerCatalog?.machine_profile || null),
    currentVariant: currentVariant || "",
  };
}

function buildWorkerInventorySummary(workerState) {
  const downloadable = workerState.workerOptions.filter((entry) => entry.downloadSupported);
  const installedDownloadable = downloadable.filter((entry) => entry.installed);
  const missingDownloadable = downloadable.filter((entry) => !entry.installed);
  if (!downloadable.length) {
    return "BIOS AI has no local model list loaded yet.";
  }
  if (!missingDownloadable.length) {
    return `Installed ${installedDownloadable.length} of ${downloadable.length} listed BIOS AI local models. All listed models are present.`;
  }
  const missingNames = missingDownloadable.map((entry) => entry.label).join(", ");
  return `Installed ${installedDownloadable.length} of ${downloadable.length} listed BIOS AI local models. Missing: ${missingNames}.`;
}

function populateWorkerSelect(selectEl, workerState, currentVariant = "", placeholderText = null) {
  if (!selectEl) {
    return;
  }
  selectEl.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.innerText =
    placeholderText ||
    (workerState.installedVariants.size
      ? "Choose an installed BIOS AI local model"
      : "No installed BIOS AI local models yet");
  selectEl.appendChild(placeholder);

  workerState.workerOptions.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.variant;
    option.innerText = buildWorkerSelectLabel(entry);
    if (entry.variant === currentVariant) {
      option.selected = true;
    }
    selectEl.appendChild(option);
  });

  if (currentVariant && workerState.selectableVariants.has(currentVariant)) {
    selectEl.value = currentVariant;
  }
}

function getRosterVariant(saved, role, fallback = "") {
  const roster = Array.isArray(saved?.biosWorkerRoster) ? saved.biosWorkerRoster : [];
  return roster.find((entry) => entry?.role === role)?.variant || fallback;
}

function formatModelGovernanceDecision(decision) {
  if (!decision?.action) {
    return "No BOSS model decision recorded yet";
  }
  const actionLabels = {
    keep_current: "Kept current worker route",
    recommend_roster_change: "Recommended worker roster change",
    apply_roster_change: "Applied worker roster change",
    recommend_install: "Recommended model install",
    blocked_by_route: "Blocked by route posture",
  };
  const role = decision.targetRole || decision.desiredRole || "";
  const variant = decision.targetVariant ? ` (${decision.targetVariant})` : "";
  return `${actionLabels[decision.action] || decision.action}${role ? ` for ${role}` : ""}${variant}`;
}

function formatModelGovernanceHistory(governance) {
  const history = Array.isArray(governance?.history) ? governance.history : [];
  if (!history.length) {
    return "No model-governance history yet. BIOS AI will record BOSS model and worker choices here when they matter.";
  }
  return history
    .slice(0, 5)
    .map((entry) => {
      const rationale = entry?.rationale || "No rationale recorded.";
      return `${formatModelGovernanceDecision(entry)} - ${rationale}`;
    })
    .join("\n");
}

function renderSettingsLocalCapabilityInventory(toolRegistry = null, connectorStatus = null) {
  const inventory = buildLocalToolInventorySummary(toolRegistry, connectorStatus);
  setText(
    "settings-local-capability-summary",
    inventory.ready ? inventory.detail : "BIOS AI has not loaded local actions yet.",
  );
  setText(
    "settings-local-capability-safe-read",
    `${inventory.classCounts.safe_local_read || 0} safe-read action(s)`,
  );
  setText(
    "settings-local-capability-approval",
    `${inventory.classCounts.approval_required_host_action || 0} approval-required host action(s)`,
  );
  setText(
    "settings-local-capability-boxed",
    `${inventory.classCounts.boxed_first_risky_action || 0} protected-work action(s)`,
  );
  setText("settings-local-capability-connectors", inventory.connectorSummary);
  setText("settings-local-capability-truth-rule", inventory.truthRule);
}

function buildManagedRosterForSettings({
  workerCatalog,
  bossVariant,
  mediumVariant = null,
  smallVariant = null,
  customWorkerPath = null,
}) {
  const autoAssignments = buildBossWorkerRosterAssignments({
    workerCatalog,
    machineProfile: workerCatalog?.machine_profile || null,
    bossVariant: bossVariant || null,
    bossPath: customWorkerPath || null,
  });
  const autoMedium =
    autoAssignments.find((entry) => entry.role === BIOS_WORKER_ROLE_MEDIUM)?.variant || null;
  const autoSmall =
    autoAssignments.find((entry) => entry.role === BIOS_WORKER_ROLE_SMALL)?.variant || null;
  const assignments = [];
  if (bossVariant || customWorkerPath) {
    assignments.push({
      role: BIOS_WORKER_ROLE_BOSS,
      variant: bossVariant || null,
      path: customWorkerPath || null,
    });
  }
  if (mediumVariant || autoMedium) {
    assignments.push({
      role: BIOS_WORKER_ROLE_MEDIUM,
      variant: mediumVariant || autoMedium,
      path: null,
    });
  }
  if (smallVariant || autoSmall) {
    assignments.push({
      role: BIOS_WORKER_ROLE_SMALL,
      variant: smallVariant || autoSmall,
      path: null,
    });
  }
  return assignments;
}

async function hydrateEditableSettingsControls(app, saved) {
  if (settingsRuntimeDraftIsDirty(app)) {
    return;
  }
  const hydrateToken = Number(app?._settingsRuntimeHydrateToken || 0) + 1;
  if (app) {
    app._settingsRuntimeHydrateToken = hydrateToken;
  }
  const postureSelect = document.getElementById("settings-posture-select");
  const routeSelect = document.getElementById("settings-route-mode-select");
  const backendSelect = document.getElementById("settings-local-backend-select");
  const workerSelect = document.getElementById("settings-local-worker-select");
  const mediumWorkerSelect = document.getElementById("settings-medium-worker-select");
  const smallWorkerSelect = document.getElementById("settings-small-worker-select");
  const customWorkerPathInput = document.getElementById("settings-local-worker-custom-path");
  const registerCustomWorkerButton = document.getElementById("settings-register-local-worker-path");
  const installWorkerButton = document.getElementById("settings-install-local-worker");
  const installAllWorkersButton = document.getElementById("settings-install-all-local-workers");
  const saveSafetyButton = document.getElementById("settings-save-safety-controls");
  const saveRuntimeButton = document.getElementById("settings-save-runtime-controls");
  const safetyStatus = document.getElementById("settings-safety-controls-status");
  const runtimeStatus = document.getElementById("settings-runtime-controls-status");
  const runtimeFitNote = document.getElementById("settings-local-worker-fit-note");
  const runtimeInventory = document.getElementById("settings-local-worker-inventory");
  const telegramStatusEl = document.getElementById("settings-telegram-connector-status");
  const telegramEnabledSelect = document.getElementById("settings-telegram-enabled-select");
  const telegramTargetInput = document.getElementById("settings-telegram-target-input");
  const telegramAllowedActions = document.getElementById("settings-telegram-allowed-actions");
  const telegramNote = document.getElementById("settings-telegram-connector-note");
  const saveTelegramButton = document.getElementById("settings-save-telegram-connector");
  if (!postureSelect || !routeSelect || !backendSelect || !workerSelect) {
    return;
  }

  if (!settingsRuntimeDraftIsDirty(app)) {
    setSelectValue("settings-posture-select", saved.permissionMode || "not_allowed", "not_allowed");
    setSelectValue("settings-route-mode-select", saved.modelPref || "commercial", "commercial");
    setSelectValue("settings-local-backend-select", saved.preferredLocalBackend || "", "");
  }

  const workerCatalog = (await app.loadWorkerModelCatalog?.()) || null;
  if (
    settingsRuntimeDraftIsDirty(app) ||
    Number(app?._settingsRuntimeHydrateToken || 0) !== hydrateToken
  ) {
    return;
  }
  const savedBossVariant = getRosterVariant(
    saved,
    BIOS_WORKER_ROLE_BOSS,
    saved.localWorkerModelVariant || "",
  );
  const savedMediumVariant = getRosterVariant(saved, BIOS_WORKER_ROLE_MEDIUM, "");
  const savedSmallVariant = getRosterVariant(saved, BIOS_WORKER_ROLE_SMALL, "");
  let connectorStatusResponse = (await app.loadBiosLocalConnectorStatus?.()) || { connectors: [] };
  const localToolRegistry = (await app.loadBiosLocalToolRegistry?.()) || { tools: [] };
  let telegramStatus = findConnectorStatus(connectorStatusResponse, "telegram");
  renderSettingsLocalCapabilityInventory(localToolRegistry, connectorStatusResponse);
  let workerState = buildWorkerCatalogState(
    workerCatalog,
    savedBossVariant,
    saved.modelPref || "local",
  );
  const rebuildWorkerState = (
    nextCatalog = workerCatalog,
    nextVariant = workerSelect.value || "",
  ) => {
    workerState = buildWorkerCatalogState(
      nextCatalog,
      nextVariant,
      routeSelect.value || saved.modelPref || "local",
    );
    populateWorkerSelect(
      workerSelect,
      workerState,
      nextVariant,
      "Choose the installed BIOS AI model that should answer as this BOSS profile",
    );
    populateWorkerSelect(
      mediumWorkerSelect,
      workerState,
      mediumWorkerSelect?.value || savedMediumVariant,
      "Leave blank to let BIOS AI choose automatically",
    );
    populateWorkerSelect(
      smallWorkerSelect,
      workerState,
      smallWorkerSelect?.value || savedSmallVariant,
      "Leave blank to let BIOS AI choose automatically",
    );
  };
  populateWorkerSelect(
    workerSelect,
    workerState,
    savedBossVariant,
    "Choose the installed BIOS AI model that should answer as this BOSS profile",
  );
  populateWorkerSelect(
    mediumWorkerSelect,
    workerState,
    savedMediumVariant,
    "Leave blank to let BIOS AI choose automatically",
  );
  populateWorkerSelect(
    smallWorkerSelect,
    workerState,
    savedSmallVariant,
    "Leave blank to let BIOS AI choose automatically",
  );
  if (customWorkerPathInput) {
    customWorkerPathInput.value =
      saved.preferredLocalBackend === MANAGED_LOCAL_RUNTIME_PROVIDER &&
      saved.localWorkerModelPath &&
      !workerState.installedVariants.has(saved.localWorkerModelVariant || "")
        ? saved.localWorkerModelPath
        : "";
  }

  const refreshRuntimeControlState = () => {
    const routeValue = routeSelect.value || "commercial";
    const backendValue = backendSelect.value || "";
    const routeNeedsLocalLane = routeValue === "local" || routeValue === "hybrid";
    const draftChanged = settingsRuntimeDraftChanged({
      saved,
      routeValue,
      backendValue,
      bossVariant: workerSelect.value || "",
      mediumVariant: mediumWorkerSelect?.value || "",
      smallVariant: smallWorkerSelect?.value || "",
      customWorkerPath: customWorkerPathInput?.value?.trim() || "",
    });
    const setRuntimeStatus = (message) => {
      if (!runtimeStatus) {
        return;
      }
      runtimeStatus.innerText =
        settingsRuntimeDraftIsDirty(app) && draftChanged
          ? `Unsaved settings: click Save settings to apply. ${message}`
          : message;
    };
    if (saveRuntimeButton) {
      saveRuntimeButton.innerText = "Save settings";
    }
    backendSelect.disabled = !routeNeedsLocalLane;
    workerSelect.disabled = !routeNeedsLocalLane || backendValue !== MANAGED_LOCAL_RUNTIME_PROVIDER;
    if (mediumWorkerSelect) {
      mediumWorkerSelect.disabled =
        !routeNeedsLocalLane || backendValue !== MANAGED_LOCAL_RUNTIME_PROVIDER;
    }
    if (smallWorkerSelect) {
      smallWorkerSelect.disabled =
        !routeNeedsLocalLane || backendValue !== MANAGED_LOCAL_RUNTIME_PROVIDER;
    }
    if (customWorkerPathInput) {
      customWorkerPathInput.disabled =
        !routeNeedsLocalLane || backendValue !== MANAGED_LOCAL_RUNTIME_PROVIDER;
    }
    if (registerCustomWorkerButton) {
      registerCustomWorkerButton.disabled =
        !routeNeedsLocalLane || backendValue !== MANAGED_LOCAL_RUNTIME_PROVIDER;
    }
    if (installWorkerButton) {
      const selectedEntry = workerState.entryByVariant.get(workerSelect.value || "");
      installWorkerButton.disabled =
        !routeNeedsLocalLane ||
        backendValue !== MANAGED_LOCAL_RUNTIME_PROVIDER ||
        !selectedEntry ||
        selectedEntry.installed ||
        !selectedEntry.downloadSupported;
    }
    if (installAllWorkersButton) {
      const missingDownloadable = workerState.workerOptions.filter(
        (entry) => entry.downloadSupported && !entry.installed,
      );
      installAllWorkersButton.disabled =
        !routeNeedsLocalLane ||
        backendValue !== MANAGED_LOCAL_RUNTIME_PROVIDER ||
        missingDownloadable.length === 0;
      installAllWorkersButton.innerText = missingDownloadable.length
        ? `Download all listed BIOS AI models (${missingDownloadable.length} missing)`
        : "All listed BIOS AI models installed";
    }
    if (runtimeInventory) {
      runtimeInventory.innerText = buildWorkerInventorySummary(workerState);
    }

    if (!routeNeedsLocalLane) {
      setRuntimeStatus(
        "Cloud route is selected. Local model choices are available when you choose Local only or Hybrid.",
      );
      setHtml(
        "settings-local-worker-fit-note",
        "When you choose a local route, BIOS AI will show the best local model for this machine.",
      );
      return;
    }
    if (!backendValue) {
      setRuntimeStatus("Choose which local model source this BOSS profile should use.");
      setHtml(
        "settings-local-worker-fit-note",
        "Choose a local model source to see which local model BIOS AI recommends for this machine.",
      );
      return;
    }
    if (backendValue !== MANAGED_LOCAL_RUNTIME_PROVIDER) {
      setRuntimeStatus(
        `${formatSavedLocalBackend(backendValue)} stays in charge of its own local model inventory.`,
      );
      setHtml(
        "settings-local-worker-fit-note",
        "BIOS AI will use that app's installed local models.",
      );
      return;
    }
    const selectedEntry = workerState.entryByVariant.get(workerSelect.value || "");
    const recommendedEntry = workerState.recommendedEntry;
    const routeLabel = routeValue === "hybrid" ? "Hybrid" : "Local only";
    if (runtimeFitNote) {
      runtimeFitNote.innerHTML = recommendedEntry
        ? `<strong>${routeLabel} recommendation for this machine:</strong> ${recommendedEntry.label}. BIOS AI's machine check is ${workerState.machineFitSummary}. Background models can stay automatic.`
        : "BIOS AI could not rank a clear recommendation yet. You can still choose an installed local model.";
    }
    if (customWorkerPathInput?.value?.trim()) {
      setRuntimeStatus(
        "BIOS AI will use that exact local model file for this BOSS profile.",
      );
      return;
    }
    if (selectedEntry && !selectedEntry.installed && selectedEntry.downloadSupported) {
      const fitCopy =
        selectedEntry.fitConfidence === "partial"
          ? "is selectable, but BIOS AI has only partly verified the hardware fit"
          : "fits this machine";
      const fitNote = selectedEntry.reason ? ` ${selectedEntry.reason}` : "";
      setRuntimeStatus(
        `${selectedEntry.label} ${fitCopy}, and it is not installed yet.${fitNote} Install it here, then save it for this BOSS profile.`,
      );
      return;
    }
    if (!workerState.installedVariants.size) {
      setRuntimeStatus(
        "No BIOS AI local model is installed yet. Pick one here to install it, or paste the full path to your own model file below.",
      );
      return;
    }
    if (selectedEntry?.installed) {
      setRuntimeStatus(
        `${selectedEntry.label} is installed and ready to become this BOSS profile's main local model.`,
      );
      return;
    }
    setRuntimeStatus(
      "Choose an installed BIOS AI local model or paste the full path to your own model file for this BOSS profile.",
    );
  };

  const refreshConnectorControlState = () => {
    if (!telegramStatusEl || !telegramEnabledSelect || !telegramTargetInput || !telegramNote) {
      return;
    }
    const hasActiveProfile = Boolean(app.activeBiosProfileId);
    const enabledValue = telegramEnabledSelect.value === "enabled";
    const targetValue = telegramTargetInput.value.trim();
    telegramStatusEl.innerText = telegramStatus?.label || "Telegram waiting on profile";
    if (telegramAllowedActions) {
      const actions = Array.isArray(telegramStatus?.allowed_actions)
        ? telegramStatus.allowed_actions
        : ["send_message"];
      telegramAllowedActions.innerText = actions.join(", ");
    }
    telegramEnabledSelect.disabled = !hasActiveProfile;
    telegramTargetInput.disabled = !hasActiveProfile;
    if (saveTelegramButton) {
      saveTelegramButton.disabled = !hasActiveProfile;
    }
    if (!hasActiveProfile) {
      telegramNote.innerText =
        "Choose or create a BOSS profile before BIOS AI can connect Telegram.";
      return;
    }
    if (!telegramStatus?.has_key) {
      telegramNote.innerText =
        "BIOS AI cannot use Telegram here until you import a real Telegram bot key for this BOSS profile.";
      return;
    }
    if (!enabledValue) {
      telegramNote.innerText =
        "Telegram stays disconnected for this BOSS profile until you turn it on and save it.";
      return;
    }
    if (!targetValue) {
      telegramNote.innerText =
        "Telegram is keyed and enabled, but BIOS AI still needs the chat or target id before it can deliver anything.";
      return;
    }
    telegramNote.innerText =
      telegramStatus?.ready && telegramStatus?.target_id === targetValue
        ? telegramStatus.detail ||
          "Telegram is ready. BIOS AI can send messages for this BOSS profile."
        : "Telegram is ready to be saved for this BOSS profile.";
  };

  routeSelect.onchange = () => {
    markSettingsRuntimeDraftDirty(app);
    rebuildWorkerState(workerCatalog, workerSelect.value || workerState.currentVariant);
    refreshRuntimeControlState();
  };
  backendSelect.onchange = () => {
    markSettingsRuntimeDraftDirty(app);
    refreshRuntimeControlState();
  };
  customWorkerPathInput?.addEventListener("input", () => {
    markSettingsRuntimeDraftDirty(app);
    if (customWorkerPathInput.value.trim()) {
      workerSelect.value = "";
    }
    refreshRuntimeControlState();
  });
  workerSelect.addEventListener("change", () => {
    markSettingsRuntimeDraftDirty(app);
    if (workerSelect.value && customWorkerPathInput) {
      customWorkerPathInput.value = "";
    }
    refreshRuntimeControlState();
  });
  mediumWorkerSelect?.addEventListener("change", () => {
    markSettingsRuntimeDraftDirty(app);
    refreshRuntimeControlState();
  });
  smallWorkerSelect?.addEventListener("change", () => {
    markSettingsRuntimeDraftDirty(app);
    refreshRuntimeControlState();
  });
  refreshRuntimeControlState();

  if (telegramEnabledSelect) {
    telegramEnabledSelect.value = telegramStatus?.enabled ? "enabled" : "disabled";
    telegramEnabledSelect.addEventListener("change", refreshConnectorControlState);
  }
  if (telegramTargetInput) {
    telegramTargetInput.value = telegramStatus?.target_id || "";
    telegramTargetInput.addEventListener("input", refreshConnectorControlState);
  }
  refreshConnectorControlState();

  if (registerCustomWorkerButton && customWorkerPathInput) {
    registerCustomWorkerButton.onclick = async () => {
      const path = customWorkerPathInput.value.trim();
      if (!path) {
        runtimeStatus.innerText = "Paste the full local model file path before saving it.";
        return;
      }
      try {
        setDisabled(
          [
            "settings-route-mode-select",
            "settings-local-backend-select",
            "settings-local-worker-select",
            "settings-medium-worker-select",
            "settings-small-worker-select",
            "settings-local-worker-custom-path",
            "settings-register-local-worker-path",
            "settings-install-local-worker",
            "settings-install-all-local-workers",
            "settings-save-runtime-controls",
          ],
          true,
        );
        runtimeStatus.innerText = "Saving that local model file for this BOSS profile...";
        await app.saveBiosProfileRuntimePreferences?.({
          modelPref: routeSelect.value || "commercial",
          preferredLocalBackend: MANAGED_LOCAL_RUNTIME_PROVIDER,
          localWorkerModelVariant: null,
          localWorkerModelPath: path,
          biosWorkerRoster: buildManagedRosterForSettings({
            workerCatalog,
            bossVariant: null,
            mediumVariant: mediumWorkerSelect?.value || null,
            smallVariant: smallWorkerSelect?.value || null,
            customWorkerPath: path,
          }),
        });
        clearSettingsRuntimeDraft(app);
        runtimeStatus.innerText = "BIOS AI saved that local model file for this BOSS profile.";
      } catch (err) {
        runtimeStatus.innerText = err?.message || String(err);
      } finally {
        setDisabled(
          [
            "settings-route-mode-select",
            "settings-local-backend-select",
            "settings-local-worker-select",
            "settings-medium-worker-select",
            "settings-small-worker-select",
            "settings-local-worker-custom-path",
            "settings-register-local-worker-path",
            "settings-install-local-worker",
            "settings-install-all-local-workers",
            "settings-save-runtime-controls",
          ],
          false,
        );
        const refreshedCatalog = (await app.loadWorkerModelCatalog?.()) || null;
        const detail = await app.loadBiosProfileDetail?.(app.activeBiosProfileId);
        const refreshedSaved = detail?.onboarding || saved;
        workerState = buildWorkerCatalogState(
          refreshedCatalog,
          refreshedSaved.local_worker_model_variant || refreshedSaved.localWorkerModelVariant || "",
          refreshedSaved.model_pref || refreshedSaved.modelPref || routeSelect.value || "local",
        );
        populateWorkerSelect(
          workerSelect,
          workerState,
          refreshedSaved.local_worker_model_variant || refreshedSaved.localWorkerModelVariant || "",
          "Choose the installed BIOS AI model that should act as this BOSS profile's main brain",
        );
        if (
          customWorkerPathInput &&
          refreshedSaved?.local_worker_model_path &&
          !workerState.installedVariants.has(
            refreshedSaved.local_worker_model_variant ||
              refreshedSaved.localWorkerModelVariant ||
              "",
          )
        ) {
          customWorkerPathInput.value = refreshedSaved.local_worker_model_path;
        }
        refreshRuntimeControlState();
      }
    };
  }

  if (installWorkerButton) {
    installWorkerButton.onclick = async () => {
      const routeValue = routeSelect.value || "commercial";
      const routeNeedsLocalLane = routeValue === "local" || routeValue === "hybrid";
      const backendValue = routeNeedsLocalLane
        ? backendSelect.value || MANAGED_LOCAL_RUNTIME_PROVIDER
        : "";
      const selectedVariant = workerSelect.value || "";
      const selectedEntry = workerState.entryByVariant.get(selectedVariant);

      if (!routeNeedsLocalLane || backendValue !== MANAGED_LOCAL_RUNTIME_PROVIDER) {
        runtimeStatus.innerText =
          "Switch this BOSS profile back to Local only or Hybrid before installing a managed local brain.";
        return;
      }
      if (!selectedEntry) {
        runtimeStatus.innerText = "Choose the BIOS AI managed model you want to install first.";
        return;
      }
      if (selectedEntry.installed) {
        runtimeStatus.innerText = `${selectedEntry.label} is already installed and ready.`;
        refreshRuntimeControlState();
        return;
      }

      let installErrorMessage = "";
      try {
        setDisabled(
          [
            "settings-route-mode-select",
            "settings-local-backend-select",
            "settings-local-worker-select",
            "settings-medium-worker-select",
            "settings-small-worker-select",
            "settings-local-worker-custom-path",
            "settings-register-local-worker-path",
            "settings-install-local-worker",
            "settings-install-all-local-workers",
            "settings-save-runtime-controls",
          ],
          true,
        );
        runtimeStatus.innerText = `Installing ${selectedEntry.label} into the BIOS AI managed runtime...`;
        const result = await app.installManagedWorkerModel?.(selectedVariant, {
          onProgress(download) {
            if (!download) {
              return;
            }
            if (download.state === "downloading") {
              const progress = buildWorkerDownloadProgressSnapshot(download);
              runtimeStatus.innerText = `Installing ${selectedEntry.label}... ${progress.progressText}`;
              return;
            }
            if (download.state === "completed" || download.state === "installed") {
              runtimeStatus.innerText = `${selectedEntry.label} finished installing. BIOS AI is binding it to this BOSS profile now.`;
            }
          },
        });
        const finalDownload = result?.download || null;
        if (!finalDownload || finalDownload.state === "failed") {
          throw new Error(
            finalDownload?.error || `BIOS AI could not finish installing ${selectedEntry.label}.`,
          );
        }
        await app.saveBiosProfileRuntimePreferences?.({
          modelPref: routeValue,
          preferredLocalBackend: MANAGED_LOCAL_RUNTIME_PROVIDER,
          localWorkerModelVariant: selectedVariant,
          localWorkerModelPath: null,
          biosWorkerRoster: buildManagedRosterForSettings({
            workerCatalog,
            bossVariant: selectedVariant,
            mediumVariant: mediumWorkerSelect?.value || null,
            smallVariant: smallWorkerSelect?.value || null,
          }),
        });
        clearSettingsRuntimeDraft(app);
        runtimeStatus.innerText = `${selectedEntry.label} is installed, selected, and ready for this BOSS profile.`;
      } catch (err) {
        installErrorMessage = err?.message || String(err);
        runtimeStatus.innerText = installErrorMessage;
      } finally {
        setDisabled(
          [
            "settings-route-mode-select",
            "settings-local-backend-select",
            "settings-local-worker-select",
            "settings-medium-worker-select",
            "settings-small-worker-select",
            "settings-local-worker-custom-path",
            "settings-register-local-worker-path",
            "settings-install-local-worker",
            "settings-install-all-local-workers",
            "settings-save-runtime-controls",
          ],
          false,
        );
        const refreshedCatalog = (await app.loadWorkerModelCatalog?.()) || null;
        const detail = await app.loadBiosProfileDetail?.(app.activeBiosProfileId);
        const refreshedSaved = detail?.onboarding || saved;
        workerState = buildWorkerCatalogState(
          refreshedCatalog,
          refreshedSaved.local_worker_model_variant ||
            refreshedSaved.localWorkerModelVariant ||
            selectedVariant,
          refreshedSaved.model_pref || refreshedSaved.modelPref || routeSelect.value || "local",
        );
        populateWorkerSelect(
          workerSelect,
          workerState,
          refreshedSaved.local_worker_model_variant ||
            refreshedSaved.localWorkerModelVariant ||
            selectedVariant,
          "Choose the installed BIOS AI model that should act as this BOSS profile's main brain",
        );
        refreshRuntimeControlState();
        if (installErrorMessage) {
          runtimeStatus.innerText = installErrorMessage;
        }
      }
    };
  }

  if (installAllWorkersButton) {
    installAllWorkersButton.onclick = async () => {
      const routeValue = routeSelect.value || "commercial";
      const routeNeedsLocalLane = routeValue === "local" || routeValue === "hybrid";
      const backendValue = routeNeedsLocalLane
        ? backendSelect.value || MANAGED_LOCAL_RUNTIME_PROVIDER
        : "";
      if (!routeNeedsLocalLane || backendValue !== MANAGED_LOCAL_RUNTIME_PROVIDER) {
        runtimeStatus.innerText =
          "Switch this BOSS profile back to Local only or Hybrid before downloading managed local models.";
        return;
      }

      const missingDownloadable = workerState.workerOptions.filter(
        (entry) => entry.downloadSupported && !entry.installed,
      );
      if (!missingDownloadable.length) {
        runtimeStatus.innerText = "Every listed BIOS AI managed model is already installed.";
        refreshRuntimeControlState();
        return;
      }

      let installErrorMessage = "";
      let installSuccessMessage = "";
      try {
        setDisabled(
          [
            "settings-route-mode-select",
            "settings-local-backend-select",
            "settings-local-worker-select",
            "settings-medium-worker-select",
            "settings-small-worker-select",
            "settings-local-worker-custom-path",
            "settings-register-local-worker-path",
            "settings-install-local-worker",
            "settings-install-all-local-workers",
            "settings-save-runtime-controls",
          ],
          true,
        );
        if (typeof app.installAllManagedWorkerModels === "function") {
          runtimeStatus.innerText = `Starting background download for ${missingDownloadable.length} listed BIOS AI model(s)...`;
          const result = await app.installAllManagedWorkerModels({
            onProgress(downloadQueue, assetsStatus) {
              if (!downloadQueue) {
                return;
              }
              const activeEntry = workerState.entryByVariant.get(
                downloadQueue.active_variant || "",
              );
              const download = assetsStatus?.download || null;
              const progress =
                download?.state === "downloading"
                  ? buildWorkerDownloadProgressSnapshot(download).progressText
                  : "";
              const activeCopy = activeEntry?.label || downloadQueue.active_variant || "next model";
              runtimeStatus.innerText =
                downloadQueue.state === "running"
                  ? `Downloading ${downloadQueue.completed_count || 0} of ${downloadQueue.total_count || missingDownloadable.length}; active: ${activeCopy}${progress ? ` (${progress})` : ""}.`
                  : `Download queue ${downloadQueue.state}.`;
            },
          });
          const finalQueue = result?.downloadQueue || result?.assetsStatus?.download_queue || null;
          if (!finalQueue || finalQueue.state === "failed") {
            throw new Error(
              finalQueue?.error || "BIOS AI could not finish downloading the listed model catalog.",
            );
          }
          installSuccessMessage =
            finalQueue.state === "completed"
              ? `Downloaded all missing listed BIOS AI model(s). Choose which ones the BOSS should use, then save runtime choices.`
              : `BIOS AI started the background download queue for all missing listed models. You can leave Settings; progress stays in the runtime queue.`;
        } else {
          for (let index = 0; index < missingDownloadable.length; index += 1) {
            const entry = missingDownloadable[index];
            runtimeStatus.innerText = `Downloading ${index + 1} of ${missingDownloadable.length}: ${entry.label}...`;
            const result = await app.installManagedWorkerModel?.(entry.variant, {
              onProgress(download) {
                if (!download || download.state !== "downloading") {
                  return;
                }
                const progress = buildWorkerDownloadProgressSnapshot(download);
                runtimeStatus.innerText = `Downloading ${index + 1} of ${missingDownloadable.length}: ${entry.label}... ${progress.progressText}`;
              },
            });
            const finalDownload = result?.download || null;
            if (!finalDownload || finalDownload.state === "failed") {
              throw new Error(
                finalDownload?.error || `BIOS AI could not finish downloading ${entry.label}.`,
              );
            }
          }
          installSuccessMessage = `Downloaded ${missingDownloadable.length} listed BIOS AI model(s). Choose which ones the BOSS should use, then save runtime choices.`;
        }
        runtimeStatus.innerText = installSuccessMessage;
      } catch (err) {
        installErrorMessage = err?.message || String(err);
        runtimeStatus.innerText = installErrorMessage;
      } finally {
        setDisabled(
          [
            "settings-route-mode-select",
            "settings-local-backend-select",
            "settings-local-worker-select",
            "settings-medium-worker-select",
            "settings-small-worker-select",
            "settings-local-worker-custom-path",
            "settings-register-local-worker-path",
            "settings-install-local-worker",
            "settings-install-all-local-workers",
            "settings-save-runtime-controls",
          ],
          false,
        );
        const refreshedCatalog = (await app.loadWorkerModelCatalog?.()) || null;
        const detail = await app.loadBiosProfileDetail?.(app.activeBiosProfileId);
        const refreshedSaved = detail?.onboarding || saved;
        workerState = buildWorkerCatalogState(
          refreshedCatalog,
          refreshedSaved.local_worker_model_variant ||
            refreshedSaved.localWorkerModelVariant ||
            workerSelect.value ||
            "",
          refreshedSaved.model_pref || refreshedSaved.modelPref || routeSelect.value || "local",
        );
        populateWorkerSelect(
          workerSelect,
          workerState,
          refreshedSaved.local_worker_model_variant ||
            refreshedSaved.localWorkerModelVariant ||
            workerSelect.value ||
            "",
          "Choose the installed BIOS AI model that should act as this BOSS profile's main brain",
        );
        refreshRuntimeControlState();
        if (installErrorMessage) {
          runtimeStatus.innerText = `${installErrorMessage} ${buildWorkerInventorySummary(workerState)}`;
        } else if (installSuccessMessage) {
          runtimeStatus.innerText = `${installSuccessMessage} ${buildWorkerInventorySummary(workerState)}`;
        }
      }
    };
  }

  if (saveSafetyButton) {
    saveSafetyButton.onclick = async () => {
      try {
        setDisabled(["settings-posture-select", "settings-save-safety-controls"], true);
        if (safetyStatus) {
          safetyStatus.innerText = "Saving authority choice...";
        }
        await app.saveBiosProfileRuntimePreferences?.({
          permissionMode: postureSelect.value || "not_allowed",
        });
        if (safetyStatus) {
          safetyStatus.innerText = "Saved authority choice for this BOSS profile.";
        }
      } catch (err) {
        if (safetyStatus) {
          safetyStatus.innerText = err?.message || String(err);
        }
      } finally {
        setDisabled(["settings-posture-select", "settings-save-safety-controls"], false);
      }
    };
  }

  if (saveRuntimeButton) {
    saveRuntimeButton.onclick = async () => {
      const routeValue = routeSelect.value || "commercial";
      const routeNeedsLocalLane = routeValue === "local" || routeValue === "hybrid";
      const backendValue = routeNeedsLocalLane
        ? backendSelect.value || MANAGED_LOCAL_RUNTIME_PROVIDER
        : "";
      const workerValue = workerSelect.value || "";
      const mediumWorkerValue = mediumWorkerSelect?.value || "";
      const smallWorkerValue = smallWorkerSelect?.value || "";
      const customWorkerPath = customWorkerPathInput?.value?.trim() || "";

      if (routeNeedsLocalLane && !backendValue) {
        runtimeStatus.innerText = "Choose a local model source before saving this route.";
        return;
      }
      if (
        routeNeedsLocalLane &&
        backendValue === MANAGED_LOCAL_RUNTIME_PROVIDER &&
        !workerValue &&
        !customWorkerPath
      ) {
        runtimeStatus.innerText =
          "Choose an installed BIOS AI local model or paste the full path to your own model file before saving a local route.";
        return;
      }
      if (
        routeNeedsLocalLane &&
        backendValue === MANAGED_LOCAL_RUNTIME_PROVIDER &&
        workerValue &&
        !workerState.installedVariants.has(workerValue)
      ) {
        runtimeStatus.innerText =
          "That model is visible, but it is not installed yet. Install it here first, then save it for this BOSS profile.";
        return;
      }
      if (
        routeNeedsLocalLane &&
        backendValue === MANAGED_LOCAL_RUNTIME_PROVIDER &&
        mediumWorkerValue &&
        !workerState.installedVariants.has(mediumWorkerValue)
      ) {
        runtimeStatus.innerText =
          "The selected medium worker is visible, but it is not installed yet. Install it before saving it into this BOSS profile's roster.";
        return;
      }
      if (
        routeNeedsLocalLane &&
        backendValue === MANAGED_LOCAL_RUNTIME_PROVIDER &&
        smallWorkerValue &&
        !workerState.installedVariants.has(smallWorkerValue)
      ) {
        runtimeStatus.innerText =
          "The selected small worker is visible, but it is not installed yet. Install it before saving it into this BOSS profile's roster.";
        return;
      }

      try {
        setDisabled(
          [
            "settings-route-mode-select",
            "settings-local-backend-select",
            "settings-local-worker-select",
            "settings-medium-worker-select",
            "settings-small-worker-select",
            "settings-install-local-worker",
            "settings-install-all-local-workers",
            "settings-save-runtime-controls",
          ],
          true,
        );
        runtimeStatus.innerText = "Saving runtime choices...";
        await app.saveBiosProfileRuntimePreferences?.({
          modelPref: routeValue,
          preferredLocalBackend: backendValue || null,
          localWorkerModelVariant:
            backendValue === MANAGED_LOCAL_RUNTIME_PROVIDER && !customWorkerPath
              ? workerValue
              : null,
          localWorkerModelPath:
            backendValue === MANAGED_LOCAL_RUNTIME_PROVIDER && customWorkerPath
              ? customWorkerPath
              : null,
          biosWorkerRoster:
            backendValue === MANAGED_LOCAL_RUNTIME_PROVIDER
              ? buildManagedRosterForSettings({
                  workerCatalog,
                  bossVariant: customWorkerPath ? null : workerValue,
                  mediumVariant: mediumWorkerValue || null,
                  smallVariant: smallWorkerValue || null,
                  customWorkerPath: customWorkerPath || null,
                })
              : [],
        });
        clearSettingsRuntimeDraft(app);
        if (saveRuntimeButton) {
          saveRuntimeButton.innerText = "Save settings";
        }
        runtimeStatus.innerText = "Saved runtime choices for this BOSS profile.";
      } catch (err) {
        runtimeStatus.innerText = err?.message || String(err);
      } finally {
        setDisabled(
          [
            "settings-route-mode-select",
            "settings-local-backend-select",
            "settings-local-worker-select",
            "settings-medium-worker-select",
            "settings-small-worker-select",
            "settings-local-worker-custom-path",
            "settings-register-local-worker-path",
            "settings-install-local-worker",
            "settings-install-all-local-workers",
            "settings-save-runtime-controls",
          ],
          false,
        );
        refreshRuntimeControlState();
      }
    };
  }

  if (saveTelegramButton && telegramEnabledSelect && telegramTargetInput) {
    saveTelegramButton.onclick = async () => {
      try {
        setDisabled(
          [
            "settings-telegram-enabled-select",
            "settings-telegram-target-input",
            "settings-save-telegram-connector",
          ],
          true,
        );
        if (telegramNote) {
          telegramNote.innerText = "Saving Telegram connector settings...";
        }
        connectorStatusResponse = await app.saveBiosLocalConnectorBinding?.({
          connector: "telegram",
          enabled: telegramEnabledSelect.value === "enabled",
          targetId: telegramTargetInput.value.trim() || null,
          allowedActions: ["send_message"],
        });
        telegramStatus = findConnectorStatus(connectorStatusResponse, "telegram");
        renderSettingsLocalCapabilityInventory(localToolRegistry, connectorStatusResponse);
        if (telegramEnabledSelect) {
          telegramEnabledSelect.value = telegramStatus?.enabled ? "enabled" : "disabled";
        }
        if (telegramTargetInput) {
          telegramTargetInput.value = telegramStatus?.target_id || "";
        }
      } catch (err) {
        if (telegramNote) {
          telegramNote.innerText = err?.message || String(err);
        }
      } finally {
        setDisabled(
          [
            "settings-telegram-enabled-select",
            "settings-telegram-target-input",
            "settings-save-telegram-connector",
          ],
          false,
        );
        refreshConnectorControlState();
      }
    };
  }
}

export function renderProfileSettingsSurface(app) {
  const nameEl = document.getElementById("settings-active-profile");
  const safetyEl = document.getElementById("settings-active-profile-safety");
  const runtimeOwnerEl = document.getElementById("settings-runtime-owner");
  const runtimeEngineEl = document.getElementById("settings-runtime-engine");
  const runtimeStrategyEl = document.getElementById("settings-runtime-strategy");
  const listEl = document.getElementById("settings-profile-list");
  const statusEl = document.getElementById("settings-profile-status");
  const deleteBtn = document.getElementById("settings-delete-profile");
  const profilePickerBtn = document.getElementById("settings-show-profile-picker");
  const rerunOnboardingBtn = document.getElementById("settings-rerun-onboarding");
  const dangerCopyEl = document.getElementById("settings-profile-danger-copy");
  const renameInput = document.getElementById("settings-profile-rename");
  const renameBtn = document.getElementById("settings-rename-profile");
  const overviewTitleEl = document.getElementById("settings-overview-title");
  const overviewCopyEl = document.getElementById("settings-overview-copy");
  const activeProfile = app.biosProfiles.find((profile) => profile.id === app.activeBiosProfileId);
  const setProfileStatus = (message) => {
    if (statusEl) {
      statusEl.innerText = message;
    }
  };

  if (nameEl) nameEl.innerText = activeProfile?.display_name || "No profile selected";
  if (safetyEl) safetyEl.innerText = activeProfile?.safety_posture_label || "Not set yet";
  if (runtimeOwnerEl)
    runtimeOwnerEl.innerText = formatBiosRuntimeOwnerLabel(activeProfile?.local_runtime_owner);
  if (runtimeEngineEl)
    runtimeEngineEl.innerText = formatBiosRuntimeEngineLabel(activeProfile?.local_runtime_engine);
  if (runtimeStrategyEl)
    runtimeStrategyEl.innerText = formatBiosRuntimeStrategyLabel(
      activeProfile?.local_runtime_strategy,
    );

  if (listEl) {
    listEl.innerHTML = app.biosProfiles.length
      ? app.biosProfiles
          .map(
            (profile) =>
              `<button type="button" class="settings-profile-chip${profile.id === app.activeBiosProfileId ? " is-active" : ""}" data-profile-id="${profile.id}">${app.escapeHtml(profile.display_name)}</button>`,
          )
          .join("")
      : '<span class="settings-provider-status">No BIOS profiles saved yet.</span>';
    listEl.querySelectorAll(".settings-profile-chip").forEach((button) => {
      button.addEventListener("click", async () => {
        const profileId = button.getAttribute("data-profile-id");
        const profile = app.biosProfiles.find((entry) => entry.id === profileId);
        setProfileStatus(`Loading ${profile?.display_name || "that"} BOSS profile...`);
        const routeReady = await app.activateExistingBiosProfile(profileId, { announce: false });
        app.renderProfileSettings();
        setProfileStatus(
          routeReady
            ? `${profile?.display_name || "That profile"} is active and ready.`
            : `${profile?.display_name || "That profile"} needs recovery, so BIOS AI reopened onboarding from its saved state.`,
        );
      });
    });
  }

  if (statusEl) statusEl.innerText = buildBiosProfileStatusLabel(app.biosProfiles, activeProfile);
  if (overviewTitleEl) overviewTitleEl.innerText = buildBiosProfileOverviewTitle(activeProfile);
  if (overviewCopyEl) overviewCopyEl.innerText = buildBiosProfileOverviewCopy(activeProfile);
  if (dangerCopyEl)
    dangerCopyEl.innerText = buildBiosProfileDangerCopy(activeProfile, app.biosProfiles.length);

  if (renameInput) {
    renameInput.value = activeProfile?.display_name || "";
    renameInput.disabled = !activeProfile;
  }
  if (renameBtn) {
    renameBtn.disabled = !activeProfile;
    renameBtn.onclick = async () => {
      if (!activeProfile || !renameInput) return;
      setProfileStatus(`Renaming ${activeProfile.display_name}...`);
      await app.renameActiveBiosProfile(renameInput.value);
      app.renderProfileSettings();
      setProfileStatus("Saved the new BOSS profile name.");
    };
  }

  if (deleteBtn) {
    deleteBtn.disabled = !app.activeBiosProfileId;
    deleteBtn.onclick = async () => {
      if (!app.activeBiosProfileId) return;
      const profileName = activeProfile?.display_name || "this BOSS profile";
      const confirmed = window.confirm(
        buildBiosProfileDeleteConfirmation(activeProfile, app.biosProfiles.length),
      );
      if (!confirmed) {
        setProfileStatus(`Deletion canceled. ${profileName} is still saved.`);
        return;
      }
      setProfileStatus(`Deleting ${profileName}...`);
      const response = await app.deleteBiosProfile(app.activeBiosProfileId);
      if (response?.active_profile_id) {
        app.renderProfileSettings();
        const nextProfile =
          app.biosProfiles.find((profile) => profile.id === response.active_profile_id) || null;
        setProfileStatus(
          `${profileName} was deleted. ${nextProfile?.display_name || "Another saved profile"} is now active.`,
        );
      } else {
        app.beginFreshBiosProfileOnboarding({ clearExistingProfileId: null });
      }
    };
  }

  const newBtn = document.getElementById("settings-create-profile");
  const startFreshOnboarding = () => {
    const profileName = activeProfile?.display_name || "this BOSS profile";
    setProfileStatus(
      `Starting setup for a new BOSS profile. ${profileName} stays saved unless you delete it from the Danger Area.`,
    );
    app.beginFreshBiosProfileOnboarding();
  };
  if (newBtn) {
    newBtn.onclick = startFreshOnboarding;
  }

  if (rerunOnboardingBtn) {
    rerunOnboardingBtn.onclick = startFreshOnboarding;
  }

  if (profilePickerBtn) {
    profilePickerBtn.disabled = !app.biosProfiles.length;
    profilePickerBtn.onclick = () => {
      setProfileStatus("Opening the BOSS profile picker.");
      app.applyShellSurface?.("chat");
      app.showProfilePicker?.();
    };
  }

  const saved = app.getSavedOnboardingSnapshot?.();
  if (saved) {
    void hydrateEditableSettingsControls(app, saved);
  }
}

export function syncSavedOnboardingSnapshotSurface(app) {
  if (app.profilePickerActive) {
    app.setStatusValue("st-boss-profile", "Choose profile");
    app.setStatusValue("st-safety-posture", "Waiting on profile choice");
    app.setStatusValue("st-sandbox-backend", "Waiting on profile choice");
    app.setStatusValue("st-model", "Waiting on profile choice");
    app.setStatusValue("st-workers", "Worker loads after choice");
    app.renderProfilePickerViewport?.();
    app.renderRailBossStatus({
      profileLabel: "Choose profile",
      routeLabel: "Route waiting",
      workerLabel: "Worker after choice",
    });
    return;
  }
  const rawSaved = app.getSavedOnboardingSnapshot();
  if (!rawSaved) {
    app.setStatusValue("st-boss-profile", "No profile selected");
    app.setStatusValue("st-safety-posture", "Waiting on onboarding");
    app.setStatusValue("st-sandbox-backend", "Waiting on onboarding");
    app.setStatusValue("st-sandbox-health", "Waiting on setup check");
    app.setStatusValue("st-promotion-gate", "Waiting on setup check");
    app.setStatusValue("st-model", "Not configured");
    app.setStatusValue("st-workers", "Waiting on onboarding");
    app.setStatusValue(
      "st-forge",
      app.gateway?.isConnected ? "Waiting on gateway" : "Offline shell",
    );
    app.setStatusValue("st-gateway", app.gateway?.isConnected ? "Connected" : "Offline shell");
    app.setStatusValue("st-tokens", "Waiting on gateway");
    app.setStatusValue("st-cache", "Waiting on gateway");
    app.setStatusValue("st-compaction", "Waiting on gateway");
    app.setStatusValue("st-circadian", "Waiting on gateway");
    app.renderViewportIdleCompanion(null);
    app.renderRailBossStatus({
      profileLabel: "Waiting",
      routeLabel: "Route waiting",
      workerLabel: "Worker waiting",
    });
    [
      ["settings-promotion-gate", "Waiting on setup check"],
      ["settings-boxed-lane-queue", "Waiting on setup check"],
      ["settings-promotion-record", "Waiting on setup check"],
      ["settings-boxed-lane-events", "Waiting on setup check"],
      ["settings-boxed-lane-state", "Waiting on setup check"],
      ["settings-boxed-lane-substrate", "Waiting on setup check"],
      ["settings-recovery-status", "No profile selected yet."],
      ["settings-diagnostics-headline", "BIOS AI diagnostics will appear here."],
      ["settings-diagnostics-summary", "Choose or create a BOSS profile to hydrate diagnostics."],
      ["settings-diagnostics-issues", "No active issues yet."],
      ["settings-telegram-connector-status", "Telegram waiting on profile"],
      ["settings-telegram-allowed-actions", "send_message"],
      [
        "settings-safety-summary",
        "BIOS AI checks new tools in a protected workspace before using them on your computer.",
      ],
      [
        "settings-telegram-connector-note",
        "Choose or create a BOSS profile before BIOS AI can connect Telegram.",
      ],
      [
        "settings-boxed-lane-summary",
        "BIOS AI will show protected workspace readiness here.",
      ],
      ["settings-model-governance-last", "No BOSS model decision recorded yet"],
      [
        "settings-model-governance-history",
        "Choose or create a BOSS profile before BIOS AI can record model choices.",
      ],
      [
        "settings-local-capability-summary",
        "Choose or create a BOSS profile before BIOS AI can load local actions.",
      ],
      ["settings-local-capability-safe-read", "0 safe-read action(s)"],
      ["settings-local-capability-approval", "0 approval-required host action(s)"],
      ["settings-local-capability-boxed", "0 protected-work action(s)"],
      ["settings-local-capability-connectors", "0 connectors ready"],
      [
        "settings-local-capability-truth-rule",
        "BIOS AI can only use local actions after they are available.",
      ],
    ].forEach(([id, value]) => {
      setText(id, value);
    });
    setHtml(
      "settings-diagnostics-groups",
      renderDiagnosticsIssueGroups(
        [
          {
            group: "profile",
            title: "BOSS profile",
            message: "No BOSS profile is active yet.",
            action: "Create a new BOSS profile or choose an existing one.",
          },
        ],
        escapeSettingsHtml,
      ),
    );
    setHtml(
      "settings-diagnostics-actions",
      renderDiagnosticsActionList(
        ["Create a new BOSS profile or choose an existing one."],
        escapeSettingsHtml,
      ),
    );
    setHtml(
      "settings-diagnostics-still-works",
      renderDiagnosticsStillWorksList(
        ["BIOS AI can still guide setup and show recovery steps."],
        escapeSettingsHtml,
      ),
    );
    setText(
      "settings-diagnostics-support-summary",
      "No BOSS profile is active; diagnostics are waiting on profile setup.",
    );
    setSelectValue("settings-posture-select", "not_allowed", "not_allowed");
    setSelectValue("settings-route-mode-select", "commercial", "commercial");
    setSelectValue("settings-local-backend-select", "", "");
    setSelectValue("settings-local-worker-select", "", "");
    setSelectValue("settings-telegram-enabled-select", "disabled", "disabled");
    const telegramTargetInput = document.getElementById("settings-telegram-target-input");
    if (telegramTargetInput) {
      telegramTargetInput.value = "";
    }
    return;
  }

  const activeProfile =
    app.biosProfiles.find((profile) => profile.id === app.activeBiosProfileId) || null;
  const activeProfileName =
    activeProfile?.display_name || rawSaved?.agentName || "No profile selected";
  const shellState = buildSavedShellState({
    rawSaved,
    activeProfileName,
    runtimeStatus: app.biosRuntimeStatus,
    gatewayConnected: app.gateway?.isConnected,
    memoryContract: app.biosMemoryContract,
    observation: app.biosObservation,
    skillLibrary: app.biosShellContract?.skill_library || null,
  });
  const diagnosticsSnapshot = buildBiosDiagnosticsSnapshot({
    activeProfile,
    diagnostics: app.biosDiagnostics,
    onboarding: rawSaved,
    runtimeStatus: app.biosRuntimeStatus,
  });
  const { saved } = shellState;
  const settingsSnapshot = buildBiosSettingsSnapshot({ saved, activeProfile });

  if (saved.agentName) {
    app.agentName = saved.agentName;
    app.updateAgentNameDOM();
  }

  const textMap = [
    ["settings-posture", settingsSnapshot.postureLabel],
    ["settings-safety-posture", settingsSnapshot.safetyPostureLabel],
    ["settings-execution-mode", settingsSnapshot.executionModeLabel],
    ["settings-sandbox-backend", settingsSnapshot.sandboxBackendLabel],
    ["settings-tool-creation", settingsSnapshot.toolCreationLabel],
    ["settings-network-posture", settingsSnapshot.networkPostureLabel],
    ["settings-host-access", settingsSnapshot.hostAccessLabel],
    ["settings-promotion-policy", settingsSnapshot.promotionPolicyLabel],
    ["settings-active-profile-safety", settingsSnapshot.activeProfileSafetyLabel],
    ["settings-runtime-owner", settingsSnapshot.runtimeOwnerLabel],
    ["settings-runtime-engine", settingsSnapshot.runtimeEngineLabel],
    ["settings-runtime-strategy", settingsSnapshot.runtimeStrategyLabel],
    ["settings-route-mode", shellState.routeModeLabel],
    [
      "settings-local-worker",
      formatLocalWorkerLabel(saved.localWorkerModelVariant) ||
        shellState.settingsLocalWorker ||
        "No local model yet",
    ],
    ["settings-route-readiness", shellState.routeReadinessLabel],
    ["settings-runtime-note", shellState.shellNote],
    [
      "settings-model-governance-last",
      formatModelGovernanceDecision(saved.bossModelGovernance?.lastDecision),
    ],
    ["settings-model-governance-history", formatModelGovernanceHistory(saved.bossModelGovernance)],
  ];

  textMap.forEach(([id, value]) => {
    setText(id, value);
  });

  [
    ["settings-promotion-gate", "Waiting on setup check"],
    ["settings-boxed-lane-queue", "Waiting on setup check"],
    ["settings-promotion-record", "Waiting on setup check"],
    ["settings-boxed-lane-events", "Waiting on setup check"],
    [
      "settings-boxed-lane-state",
      `${saved.sandboxBackend || BIOS_DEFAULT_SANDBOX_BACKEND} waiting on setup check`,
    ],
    [
      "settings-boxed-lane-substrate",
      `${saved.sandboxBackend || BIOS_DEFAULT_SANDBOX_BACKEND} setup waiting on check`,
    ],
    ["settings-recovery-status", diagnosticsSnapshot.recoveryLabel],
    ["settings-diagnostics-headline", diagnosticsSnapshot.headline],
    ["settings-diagnostics-summary", diagnosticsSnapshot.summary],
    [
      "settings-diagnostics-issues",
      diagnosticsSnapshot.issues.length
        ? diagnosticsSnapshot.issues.join(" ")
        : "No active BIOS AI recovery issues.",
    ],
    [
      "settings-safety-summary",
      `${settingsSnapshot.toolCreationLabel}. ${settingsSnapshot.promotionPolicyLabel}.`,
    ],
    [
      "settings-boxed-lane-summary",
      "BIOS AI will confirm protected workspace and local model readiness after setup check.",
    ],
    [
      "settings-local-capability-summary",
      "Loading BIOS AI local actions...",
    ],
    ["settings-local-capability-safe-read", "Loading safe-read actions..."],
    ["settings-local-capability-approval", "Loading actions that need approval..."],
    ["settings-local-capability-boxed", "Loading protected-work actions..."],
    ["settings-local-capability-connectors", "Loading connector actions..."],
    [
      "settings-local-capability-truth-rule",
      "BIOS AI will only use local actions after they are available.",
    ],
  ].forEach(([id, value]) => {
    setText(id, value);
  });
  setHtml(
    "settings-diagnostics-groups",
    renderDiagnosticsIssueGroups(diagnosticsSnapshot.issueGroups, escapeSettingsHtml),
  );
  setHtml(
    "settings-diagnostics-actions",
    renderDiagnosticsActionList(diagnosticsSnapshot.recoveryActions, escapeSettingsHtml),
  );
  setHtml(
    "settings-diagnostics-still-works",
    renderDiagnosticsStillWorksList(diagnosticsSnapshot.whatStillWorks, escapeSettingsHtml),
  );
  setText("settings-diagnostics-support-summary", diagnosticsSnapshot.supportSummary);

  if (!settingsRuntimeDraftIsDirty(app)) {
    setSelectValue("settings-posture-select", saved.permissionMode || "not_allowed", "not_allowed");
    setSelectValue("settings-route-mode-select", saved.modelPref || "commercial", "commercial");
    setSelectValue("settings-local-backend-select", saved.preferredLocalBackend || "", "");
  }

  app.setStatusValue("st-model", shellState.shellModelStatus);
  app.setStatusValue("st-boss-profile", shellState.activeProfileName);
  app.setStatusValue("st-safety-posture", saved.safetyPostureLabel || BIOS_DEFAULT_SAFETY_POSTURE);
  app.setStatusValue("st-sandbox-backend", saved.sandboxBackend || BIOS_DEFAULT_SANDBOX_BACKEND);
  app.setStatusValue("st-promotion-gate", "Waiting on setup check");
  app.setStatusValue("st-workers", shellState.workerShellLabel);
  app.setStatusValue("st-forge", shellState.forgeStatusLabel);
  app.setStatusValue("st-gateway", shellState.gatewayStatusLabel);
  if (!app.continuityHealth) {
    app.setStatusValue("st-agent-state", shellState.agentState);
  }
  app.renderViewportIdleCompanion(shellState.viewportSnapshot);
  app.renderRailBossStatus({
    profileLabel: shellState.activeProfileName,
    routeLabel: shellState.routeModeLabel,
    workerLabel: shellState.workerShellLabel,
  });

  if (!settingsRuntimeDraftIsDirty(app)) {
    void hydrateEditableSettingsControls(app, saved);
  }
}
