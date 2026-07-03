import {
  appendBiosDebugLog,
  defaultSafetyPostureSnapshot,
  DIRECT_LOCAL_LLM_PROVIDERS,
  isUsableDirectLlmProvider,
  MANAGED_LOCAL_RUNTIME_PROVIDER,
} from "../bios-runtime.js";
import {
  buildBossWorkerRosterAssignments,
  buildBossModelGovernanceSnapshot,
  chooseBossChatRoute,
  chooseBossCloudKey,
} from "../boss-model-governor.js";
import { buildSavedOnboardingSnapshotFromProfileDetail } from "../boss-profiles/profile-contract.js";
import { importDiscoveredProviderKeysContract } from "../native-contracts/bios-shell-contract.js";
import {
  renderExternalWorkerSetupCard,
  renderManagedWorkerSetupCard,
  renderOnboardingReadbackCard,
  renderWorkerStorageCard,
} from "../onboarding-card-ui.js";
import { describeOnboardingKeyBadge, describeOnboardingTransition } from "../onboarding-flow.js";
import { escapeOnboardingHtml, formatStorageBytes } from "../onboarding-local-runtime.js";
import { buildOnboardingRouteChoiceSnapshot } from "../onboarding-route-copy.js";
import {
  assignExternalLocalRuntime,
  assignManagedLocalRuntime,
  formatLocalBackendLabel,
  listUsableCloudKeys,
  normalizeLocalBackend,
} from "../onboarding-route.js";
import {
  buildOnboardingReadbackSnapshot,
  buildOnboardingSummarySnapshot,
} from "../onboarding-summary.js";
import {
  loadOnboardingWorkerAssetsStatus,
  loadOnboardingWorkerModelCatalog,
  loadOnboardingWorkerStorageStatus,
  pollOnboardingWorkerDownload,
  probeOnboardingLocalRuntime,
  registerOnboardingExternalWorkerModel,
  saveOnboardingWorkerRuntimeSelection,
  saveOnboardingWorkerStorageLocation,
} from "../onboarding-transport.js";
import { buildWorkerInstallOutcomeSnapshot } from "../onboarding-worker-status.js";
import {
  buildManagedWorkerSetupSnapshot,
  buildWorkerDownloadProgressSnapshot,
  buildWorkerStorageSnapshot,
  formatWorkerLabel,
} from "../onboarding-worker-ui.js";

export async function runConversationalOnboardingController(app, chatStream) {
  await appendBiosDebugLog("onboarding.start", {
    existingAgentName: app.agentName,
  });
  const result = {
    agentName: null,
    permissionMode: "not_allowed",
    modelPref: "commercial",
    ...defaultSafetyPostureSnapshot(),
    apiKeys: [],
    importedDiscoveryKeyIds: [],
    gitIdentity: null,
    localModels: [],
    preferredLocalBackend: null,
    localRuntimeOwner: null,
    localRuntimeEngine: null,
    localRuntimeStrategy: null,
    sshKeyTypes: [],
    aiTools: [],
    localWorkerModelVariant: null,
    localWorkerModelPath: null,
    biosWorkerRoster: [],
    localWorkerDownloadStatus: "not-needed",
    bossModelGovernance: null,
  };
  const cardStyle = `padding: 14px; border-radius: 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); margin: 4px 0 12px;`;
  const btnStyle = `padding: 8px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; font-family: 'Inter', sans-serif;`;
  const primaryBtn = `${btnStyle} background: var(--accent, hsl(160,100%,50%)); color: #080a10;`;
  const ghostBtn = `${btnStyle} background: transparent; color: #a0aec0; border: 1px solid #2d3748;`;
  const checkStyle = `width: 16px; height: 16px; accent-color: hsl(160,100%,50%); cursor: pointer;`;
  const WORKER_VERIFICATION_PENDING_STATUS = "installed-needs-verification";
  const escapeTooltip = (value) =>
    String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  const managedLocalReady = () =>
    Boolean(result.localWorkerModelVariant) &&
    ["completed", "installed"].includes(result.localWorkerDownloadStatus);
  const localRouteReady = () =>
    result.localRuntimeOwner === "BIOS AI"
      ? managedLocalReady()
      : Boolean(result.preferredLocalBackend || result.localRuntimeEngine);
  const cloudRouteReady = () =>
    result.apiKeys.some(
      (key) =>
        isUsableDirectLlmProvider(key?.provider) && !DIRECT_LOCAL_LLM_PROVIDERS.has(key?.provider),
    );
  const addBubble = (html, className = "agent") => {
    const wrapper = document.createElement("div");
    wrapper.className = `onboard-conv chat-bubble chat-bubble-${className}`;
    wrapper.style.cssText = `animation: fadeIn 0.3s ease; margin-bottom: 8px;`;
    wrapper.innerHTML = html;
    chatStream.appendChild(wrapper);
    chatStream.scrollTop = chatStream.scrollHeight;
    return wrapper;
  };

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitForClick = (container, selector) =>
    new Promise((resolve) => {
      container.querySelectorAll(selector).forEach((btn) => {
        btn.addEventListener("click", () => resolve(btn.dataset.value || btn.innerText));
      });
    });
  const waitForExternalGgufChoice = (container) =>
    new Promise((resolve) => {
      const input = container.querySelector("#external-gguf-path-input");
      const status = container.querySelector("#external-gguf-path-status");
      const saveButton = container.querySelector('button[data-value="save-external-gguf"]');
      const submit = async () => {
        const nextPath = String(input?.value || "").trim();
        if (!nextPath) {
          if (status) {
            status.textContent = "Paste the full GGUF file path first.";
            status.style.color = "#feb2b2";
          }
          return;
        }
        if (saveButton) {
          saveButton.disabled = true;
          saveButton.textContent = "Checking GGUF...";
        }
        try {
          const selection = await registerExternalWorkerModel(nextPath);
          resolve({ mode: "external", selection, path: nextPath });
        } catch (err) {
          if (status) {
            status.textContent = err?.message || String(err);
            status.style.color = "#feb2b2";
          }
          if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = "Use this GGUF";
          }
        }
      };
      saveButton?.addEventListener("click", () => {
        void submit();
      });
      input?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void submit();
        }
      });
    });
  const workerLabelFromResult = () =>
    result.localWorkerModelVariant
      ? formatWorkerLabel(result.localWorkerModelVariant)
      : result.modelPref === "local" || result.modelPref === "hybrid"
        ? "Local BOSS brain still needs to be prepared"
        : "Cloud BOSS";
  const hydrateResultFromSavedDetail = (detail) => {
    if (!detail?.onboarding) {
      return null;
    }
    const hydrated = buildSavedOnboardingSnapshotFromProfileDetail(detail, result.agentName);
    Object.assign(result, hydrated);
    return hydrated;
  };

  // Typing indicator for between-step transitions
  const typingDots = `<div class="onboard-typing" style="display: flex; gap: 4px; padding: 8px 0;">
      <span style="width: 6px; height: 6px; border-radius: 50%; background: hsl(160,100%,50%); animation: typingDot 1s ease-in-out infinite;"></span>
      <span style="width: 6px; height: 6px; border-radius: 50%; background: hsl(160,100%,50%); animation: typingDot 1s ease-in-out infinite 0.2s;"></span>
      <span style="width: 6px; height: 6px; border-radius: 50%; background: hsl(160,100%,50%); animation: typingDot 1s ease-in-out infinite 0.4s;"></span>
    </div>`;

  // Inject typing animation if not already present
  if (!document.getElementById("onboard-typing-style")) {
    const style = document.createElement("style");
    style.id = "onboard-typing-style";
    style.textContent = `@keyframes typingDot { 0%,60%,100% { opacity: 0.3; transform: scale(0.8); } 30% { opacity: 1; transform: scale(1.2); } }`;
    document.head.appendChild(style);
  }

  const showTyping = () => {
    const el = document.createElement("div");
    el.className = "onboard-conv onboard-typing-wrap";
    el.innerHTML = typingDots;
    chatStream.appendChild(el);
    chatStream.scrollTop = chatStream.scrollHeight;
    return el;
  };
  const hideTyping = (el) => {
    if (el) el.remove();
  };
  const applyCardTransitionState = (card, choice, transition) => {
    const button = card?.querySelector(`button[data-value="${choice}"]`);
    if (button && transition?.pendingLabel) {
      button.textContent = transition.pendingLabel;
      button.disabled = true;
    }
    const body = card?.querySelector("div");
    if (body) {
      body.style.opacity = "0.5";
      body.style.pointerEvents = "none";
    }
    if (transition?.progressNote) {
      addBubble(
        `<p style="font-size: 12px; color: #4a5568; margin: 0;">${transition.progressNote}</p>`,
      );
    }
  };
  const lockCardActions = (card, selectedValue, selectedLabel = "Locked") => {
    card?.querySelectorAll("button").forEach((button) => {
      if (button.dataset.value === selectedValue) {
        button.textContent = selectedLabel;
      }
      button.disabled = true;
    });
    const body = card?.querySelector("div");
    if (body) {
      body.style.opacity = "0.5";
      body.style.pointerEvents = "none";
    }
  };
  const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
  const currentProfileId = () => app.activeBiosProfileId || null;
  const loadWorkerAssetsStatus = async () => {
    return loadOnboardingWorkerAssetsStatus(tauriInvoke, currentProfileId());
  };
  const loadWorkerModelCatalog = async () => {
    return loadOnboardingWorkerModelCatalog(tauriInvoke, currentProfileId());
  };
  const saveWorkerRuntimeSelection = async (variant) => {
    return saveOnboardingWorkerRuntimeSelection(tauriInvoke, variant, currentProfileId());
  };
  const registerExternalWorkerModel = async (path) => {
    return registerOnboardingExternalWorkerModel(tauriInvoke, path, currentProfileId());
  };
  const loadWorkerStorageStatus = async () => {
    return loadOnboardingWorkerStorageStatus(tauriInvoke, currentProfileId());
  };
  const saveWorkerStorageLocation = async (path) => {
    return saveOnboardingWorkerStorageLocation(tauriInvoke, path, currentProfileId());
  };
  const probeLocalRuntime = async (provider, model = "") => {
    return probeOnboardingLocalRuntime(tauriInvoke, provider, model, currentProfileId());
  };
  const pollWorkerDownload = async () => {
    return pollOnboardingWorkerDownload({
      delay,
      loadWorkerAssetsStatus,
    });
  };
  const pollWorkerDownloadBriefly = async () => {
    return pollOnboardingWorkerDownload({
      delay,
      loadWorkerAssetsStatus,
      maxAttempts: 4,
      timeoutState: "downloading",
      timeoutError:
        "BIOS AI moved this model download to background setup. Progress remains visible in Settings and recovery surfaces.",
    });
  };
  const savePendingWorkerDownloadSnapshot = async () => {
    const pendingSnapshot = {
      completed: false,
      agentName: result.agentName,
      profileRoot: result.profileRoot,
      identityDir: result.identityDir,
      memoryDir: result.memoryDir,
      dailyMemoryDir: result.dailyMemoryDir,
      runtimeDir: result.runtimeDir,
      importsDir: result.importsDir,
      logsDir: result.logsDir,
      skillsDir: result.skillsDir,
      synapsesPath: result.synapsesPath,
      soulPath: result.soulPath,
      userPath: result.userPath,
      identityPath: result.identityPath,
      memoryPath: result.memoryPath,
      importedAgentSourceDir: result.importedAgentSourceDir,
      importedArtifactKinds: result.importedArtifactKinds,
      permissionMode: result.permissionMode,
      modelPref: result.modelPref,
      safetyPostureLabel: result.safetyPostureLabel,
      executionMode: result.executionMode,
      sandboxBackend: result.sandboxBackend,
      toolCreationPolicy: result.toolCreationPolicy,
      networkPosture: result.networkPosture,
      hostAccess: result.hostAccess,
      promotionPolicy: result.promotionPolicy,
      localRuntimeOwner: result.localRuntimeOwner,
      localRuntimeEngine: result.localRuntimeEngine,
      localRuntimeStrategy: result.localRuntimeStrategy,
      gitIdentity: result.gitIdentity,
      localModels: result.localModels,
      preferredLocalBackend: result.preferredLocalBackend,
      localWorkerModelVariant: result.localWorkerModelVariant,
      localWorkerModelPath: result.localWorkerModelPath,
      biosWorkerRoster: result.biosWorkerRoster,
      localWorkerStoragePath: result.localWorkerStoragePath,
      localWorkerDownloadStatus: result.localWorkerDownloadStatus,
      sshKeyTypes: result.sshKeyTypes,
      aiTools: result.aiTools,
      apiKeys: result.apiKeys.map((key) => ({
        provider: key.provider,
        keyId: key.key_id || null,
        masked: key.masked_value,
        source: key.source,
      })),
      primaryKeyIndex: result.primaryKeyIndex ?? 0,
      bossModelGovernance: result.bossModelGovernance,
      timestamp: Date.now(),
    };
    const savedDetail = await app.saveBiosProfileSnapshot?.(
      pendingSnapshot,
      app.activeBiosProfileId,
      true,
    );
    app.saveSavedOnboardingSnapshot?.(pendingSnapshot, app.activeBiosProfileId);
    return savedDetail;
  };
  const stopForWorkerVerification = async ({
    variant,
    detail,
    workerLabel = "the selected local worker",
    progressFill = null,
    progressText = null,
  }) => {
    result.localWorkerDownloadStatus = WORKER_VERIFICATION_PENDING_STATUS;
    await appendBiosDebugLog("onboarding.local_worker.verification_pending", {
      variant: variant || result.localWorkerModelVariant || null,
      detail,
    });
    if (progressFill) {
      progressFill.style.width = "100%";
      progressFill.style.background = "#f6d365";
    }
    if (progressText) {
      progressText.textContent =
        "Model installed. BIOS AI is still verifying the local worker route.";
    }
    await savePendingWorkerDownloadSnapshot();
    addBubble(
      `<p style="font-size: 12px; color: #f6d365; margin: 0;">BIOS AI installed <strong>${escapeOnboardingHtml(
        workerLabel,
      )}</strong>, but the managed llama.cpp route is still starting or needs attention. Setup is saved and chat stays locked until that local route verifies. Detail: ${escapeOnboardingHtml(
        detail || "local worker verification is still pending",
      )}</p>`,
    );
    if (typeof app.loadBiosRuntimeStatus === "function") {
      await app.loadBiosRuntimeStatus({ tickBrainstem: false });
    }
    return true;
  };
  // ── Step 0: System Discovery ─────────────────────────
  let discovery = null;
  try {
    // Tauri invoke — only works inside the Tauri webview
    if (window.__TAURI__?.core?.invoke) {
      discovery = await window.__TAURI__.core.invoke("system_discovery");
    } else if (window.__TAURI__?.invoke) {
      discovery = await window.__TAURI__.invoke("system_discovery");
    }
  } catch (err) {
    console.warn("[Onboarding] Discovery scan unavailable:", err);
    await appendBiosDebugLog("onboarding.discovery.error", {
      detail: err?.message || String(err),
    });
  }

  const hasKeys = discovery?.api_keys?.length > 0;
  const hasGit = discovery?.git_identity?.name || discovery?.git_identity?.email;
  const hasModels = discovery?.local_models?.length > 0;
  const hasSsh = discovery?.ssh_key_types?.length > 0;
  const hasTools = discovery?.ai_tools?.length > 0;
  const hasAgent = discovery?.agent_identity?.name;
  const hasAnything = hasKeys || hasGit || hasModels || hasSsh || hasTools || hasAgent;
  const workerModelCatalog = await loadWorkerModelCatalog();
  let resumeFromRuntimeSetup = false;
  if (app.activeBiosProfileId && typeof app.loadBiosProfileDetail === "function") {
    const existingDetail = await app
      .loadBiosProfileDetail(app.activeBiosProfileId)
      .catch(() => null);
    const existingSnapshot = hydrateResultFromSavedDetail(existingDetail);
    resumeFromRuntimeSetup = Boolean(
      existingSnapshot &&
      !existingSnapshot.completed &&
      ["local", "hybrid"].includes(existingSnapshot.modelPref) &&
      (existingSnapshot.preferredLocalBackend === MANAGED_LOCAL_RUNTIME_PROVIDER ||
        existingSnapshot.localRuntimeOwner === "BIOS AI" ||
        !existingSnapshot.preferredLocalBackend),
    );
    if (resumeFromRuntimeSetup) {
      assignManagedLocalRuntime(result);
      result.modelPref = existingSnapshot.modelPref;
      result.agentName =
        result.agentName || existingSnapshot.agentName || app.agentName || "BIOS AI";
      await appendBiosDebugLog("onboarding.resume.local_runtime_setup", {
        profileId: currentProfileId(),
        modelPref: result.modelPref,
        localWorkerDownloadStatus: result.localWorkerDownloadStatus || null,
      });
    }
  }
  await appendBiosDebugLog("onboarding.discovery.summary", {
    hasKeys,
    keyCount: discovery?.api_keys?.length || 0,
    hasGit,
    hasModels,
    localModelCount: discovery?.local_models?.length || 0,
    hasSsh,
    hasTools,
    hasAgent,
    hasAnything,
  });
  let discoveredLocalModels = result.localModels;
  let hasSelectedLocalModels = discoveredLocalModels.length > 0;
  let discoveredLocalBackends = Array.from(
    new Set(
      discoveredLocalModels.map((model) => normalizeLocalBackend(model.source)).filter(Boolean),
    ),
  );
  let initialWorkerAssets = null;
  let installedWorkerModels = [];
  let hasInstalledWorkerModels = false;
  let managedRuntimeAvailable = false;
  let hasCloudKey = listUsableCloudKeys(result.apiKeys).length > 0;
  let modelChoice = result.modelPref;
  let typing = null;

  if (resumeFromRuntimeSetup) {
    initialWorkerAssets = await loadWorkerAssetsStatus();
    installedWorkerModels = initialWorkerAssets?.installed_models || [];
    hasInstalledWorkerModels = installedWorkerModels.length > 0;
    managedRuntimeAvailable = Boolean(initialWorkerAssets?.bundled_sidecar_available);
    addBubble(`
        <div style="${cardStyle}">
          <p style="font-size: 13px; color: #e2e8f0; margin: 0 0 8px; line-height: 1.6;">
            Welcome back. <strong style="color: hsl(160,100%,70%);">${escapeOnboardingHtml(result.agentName)}</strong> already has a BOSS profile, but the local brain setup was not finished.
          </p>
          <p style="font-size: 12px; color: #a0aec0; margin: 0; line-height: 1.6;">
            I’m taking you straight back to the managed local runtime step so BIOS AI can install, verify, and activate the selected BOSS model before chat unlocks.
          </p>
        </div>
      `);
  }

  if (!resumeFromRuntimeSetup) {
    // ── Step 1: Greeting (context-aware) ─────────────────
    typing = showTyping();
    await delay(300);
    hideTyping(typing);

    if (hasAnything) {
      const scanTime = discovery?.scan_duration_ms || 0;
      addBubble(`
        <p style="font-size: 13px; color: #e2e8f0; line-height: 1.7; margin: 0;">
          Hey — I'm your <strong style="color: hsl(160,100%,70%);">BIOS AI</strong> agent. I scanned your system
          and found some things I can use. Let me show you what I found — we'll get set up through conversation, no forms.
        </p>
        <p style="font-size: 11px; color: #4a5568; margin: 6px 0 0;">Scan completed in ${scanTime}ms</p>
      `);
    } else {
      addBubble(`
        <p style="font-size: 13px; color: #e2e8f0; line-height: 1.7; margin: 0;">
          Hey — I'm your <strong style="color: hsl(160,100%,70%);">BIOS AI</strong> agent. Before I can start helping you,
          I need to know a few things. We'll do this through conversation — no forms to fill out.
        </p>
      `);
    }

    // ── Step 1b: Discovery confirmation card ─────────────
    if (hasAnything) {
      typing = showTyping();
      await delay(400);
      hideTyping(typing);
      let discoveryItems = "";

      if (hasKeys) {
        discoveryItems += `<div style="margin-bottom: 8px;"><strong style="color: hsl(160,100%,70%); font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">API Keys</strong></div>`;
        discovery.api_keys.forEach((key, i) => {
          discoveryItems += `
            <label style="display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer; font-size: 12px; color: #a0aec0;">
              <input type="checkbox" checked class="disc-check" data-type="key" data-index="${i}" style="${checkStyle}" />
              <span><strong>${key.provider}</strong>: ${key.masked_value} <span style="color: #4a5568;">(from ${key.source}${key.file_path ? ": " + key.file_path.split(/[/\\]/).pop() : ""})</span></span>
            </label>`;
        });
      }

      if (hasGit) {
        discoveryItems += `<div style="margin: 8px 0 4px;"><strong style="color: hsl(160,100%,70%); font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Git Identity</strong></div>`;
        discoveryItems += `
          <label style="display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer; font-size: 12px; color: #a0aec0;">
            <input type="checkbox" checked class="disc-check" data-type="git" style="${checkStyle}" />
            <span>${discovery.git_identity.name}${discovery.git_identity.email ? " &lt;" + discovery.git_identity.email + "&gt;" : ""}</span>
          </label>`;
      }

      if (hasModels) {
        discoveryItems += `<div style="margin: 8px 0 4px;"><strong style="color: hsl(160,100%,70%); font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Local Models</strong></div>`;
        discovery.local_models.forEach((m, i) => {
          discoveryItems += `
            <label style="display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer; font-size: 12px; color: #a0aec0;">
              <input type="checkbox" checked class="disc-check" data-type="model" data-index="${i}" style="${checkStyle}" />
              <span><strong>${m.model_id}</strong> <span style="color: #4a5568;">(${m.source})</span></span>
            </label>`;
        });
      }

      if (hasSsh) {
        discoveryItems += `
          <label style="display: flex; align-items: center; gap: 8px; margin: 8px 0 4px; cursor: pointer; font-size: 12px; color: #a0aec0;">
            <input type="checkbox" checked class="disc-check" data-type="ssh" style="${checkStyle}" />
            <span>🔑 SSH keys found: <strong>${discovery.ssh_key_types.join(", ")}</strong> — git operations ready</span>
          </label>`;
      }

      if (hasTools) {
        discoveryItems += `<div style="margin: 8px 0 4px;"><strong style="color: hsl(160,100%,70%); font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">AI Tools Detected</strong></div>`;
        discovery.ai_tools.forEach((t, i) => {
          discoveryItems += `
            <label style="display: flex; align-items: center; gap: 8px; padding: 2px 0; cursor: pointer; font-size: 12px; color: #4a5568;">
              <input type="checkbox" checked class="disc-check" data-type="tool" data-index="${i}" style="${checkStyle}" />
              <span>${t.tool}${t.summary ? `<span style="color: #718096;"> — ${t.summary}</span>` : ""}</span>
            </label>`;
        });
      }

      const discCard = addBubble(`
        <div style="${cardStyle}">
          <p style="font-size: 13px; color: #e2e8f0; margin: 0 0 12px; line-height: 1.6;">
            Here's what I found on your system. Confirm what you'd like to import:
          </p>
          ${discoveryItems}
          <div style="display: flex; gap: 8px; margin-top: 12px;">
            <button data-value="confirm" class="conv-action" style="${primaryBtn}">Import Selected</button>
            <button data-value="skip" class="conv-action" style="${ghostBtn}">Skip All</button>
          </div>
        </div>
      `);

      const discChoice = await waitForClick(discCard, ".conv-action");
      applyCardTransitionState(
        discCard,
        discChoice,
        describeOnboardingTransition("discovery", discChoice),
      );

      if (discChoice === "confirm") {
        // Gather checked items
        const checkedKeys = discCard.querySelectorAll('.disc-check[data-type="key"]:checked');
        checkedKeys.forEach((cb) => {
          const idx = parseInt(cb.dataset.index, 10);
          if (discovery.api_keys[idx]) {
            result.apiKeys.push(discovery.api_keys[idx]);
            if (discovery.api_keys[idx].key_id) {
              result.importedDiscoveryKeyIds.push(discovery.api_keys[idx].key_id);
            }
          }
        });

        const gitChecked = discCard.querySelector('.disc-check[data-type="git"]:checked');
        if (gitChecked && discovery?.git_identity) {
          result.gitIdentity = discovery.git_identity;
        }

        const checkedModels = discCard.querySelectorAll('.disc-check[data-type="model"]:checked');
        checkedModels.forEach((cb) => {
          const idx = parseInt(cb.dataset.index, 10);
          if (discovery.local_models[idx]) {
            result.localModels.push(discovery.local_models[idx]);
          }
        });

        if (
          discCard.querySelector('.disc-check[data-type="ssh"]:checked') &&
          discovery?.ssh_key_types
        ) {
          result.sshKeyTypes = [...discovery.ssh_key_types];
        }

        const checkedTools = discCard.querySelectorAll('.disc-check[data-type="tool"]:checked');
        checkedTools.forEach((cb) => {
          const idx = parseInt(cb.dataset.index, 10);
          if (discovery.ai_tools[idx]) {
            result.aiTools.push(discovery.ai_tools[idx]);
          }
        });

        const importedCount =
          result.apiKeys.length +
          (result.gitIdentity ? 1 : 0) +
          result.localModels.length +
          (result.sshKeyTypes.length > 0 ? 1 : 0) +
          result.aiTools.length;
        addBubble(
          `<p style="font-size: 13px; color: #e2e8f0; margin: 0;">Imported ${importedCount} item${importedCount !== 1 ? "s" : ""}</p>`,
          "user",
        );
      } else {
        addBubble(`<p style="font-size: 13px; color: #e2e8f0; margin: 0;">Skipped</p>`, "user");
      }

      // ── Step 1b-2: Choose primary key ──────────────────────
      const discoveredLocalBackends = [
        ...new Set(
          result.localModels.map((model) => normalizeLocalBackend(model.source)).filter(Boolean),
        ),
      ];
      const primaryWorkerAssets = await loadWorkerAssetsStatus();
      const primaryInstalledWorkerModels = primaryWorkerAssets?.installed_models || [];
      const managedRuntimeReady = primaryInstalledWorkerModels.length > 0;
      const managedRuntimeAvailable = Boolean(primaryWorkerAssets?.bundled_sidecar_available);
      const selectableCloudKeys = result.apiKeys
        .map((key, index) => ({ key, index }))
        .filter(
          ({ key }) =>
            isUsableDirectLlmProvider(key?.provider) &&
            !DIRECT_LOCAL_LLM_PROVIDERS.has(key?.provider),
        );
      if (selectableCloudKeys.length > 0) {
        const chosenCloudKey = chooseBossCloudKey(
          selectableCloudKeys.map(({ key }) => key),
          {
            permissionMode: result.permissionMode,
          },
        );
        const chosenCloudIndex = selectableCloudKeys.find(
          ({ key }) => key?.provider === chosenCloudKey?.provider,
        )?.index;
        result.primaryKeyIndex =
          Number.isInteger(chosenCloudIndex) && chosenCloudIndex >= 0 ? chosenCloudIndex : 0;
        typing = showTyping();
        await delay(250);
        hideTyping(typing);
        addBubble(`
          <div style="${cardStyle}">
            <p style="font-size: 13px; color: #a0aec0; margin: 0 0 8px; line-height: 1.6;">
              BIOS AI found usable cloud model keys and will choose the best one for this BOSS profile inside the route you set later.
            </p>
            <p style="font-size: 11px; color: #4a5568; margin: 0; line-height: 1.6;">
              Right now the leading cloud candidate is <strong>${escapeOnboardingHtml(chosenCloudKey?.provider || selectableCloudKeys[0]?.key?.provider || "a saved provider")}</strong>. If you choose Local only or Hybrid next, BIOS AI will still keep local routes valid and decide when to use them.
            </p>
          </div>
        `);
      }
    }

    // ── Step 1c: Manual API key entry (if no keys found or skipped) ──
    if (listUsableCloudKeys(result.apiKeys).length === 0) {
      typing = showTyping();
      await delay(300);
      hideTyping(typing);
      const keyCard = addBubble(`
        <div style="${cardStyle}">
          <p style="font-size: 13px; color: #a0aec0; margin: 0 0 12px; line-height: 1.6;">
            ${hasAnything ? "No API keys imported." : "I didn't find any existing API keys on your system."}
            Add one now if you want a cloud route available. If you skip, BIOS AI can still continue into local setup next.
          </p>
          <select id="conv-provider-select" style="width: 100%; background: #141820; border: 1px solid #1e2a3a; border-radius: 6px;
              padding: 8px 12px; color: #e2e8f0; font-size: 13px; font-family: 'Inter', sans-serif; outline: none; margin-bottom: 8px;">
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google / Gemini</option>
              <option value="groq">Groq</option>
              <option value="deepseek">DeepSeek</option>
              <option value="openrouter">OpenRouter</option>
              <option value="custom">Custom</option>
            </select>
            <input type="password" id="conv-api-key-input" placeholder="Paste your API key here"
              style="width: 100%; box-sizing: border-box; background: #141820; border: 1px solid #1e2a3a; border-radius: 6px;
              padding: 8px 12px; color: #e2e8f0; font-size: 13px; font-family: 'Inter', sans-serif; outline: none; margin-bottom: 8px;" />
            <div style="display: flex; gap: 8px;">
              <button data-value="save-key" class="conv-action" style="${primaryBtn}">Save Key</button>
              <button data-value="skip-key" class="conv-action" style="${ghostBtn}">Skip for Now</button>
            </div>
        </div>
      `);

      const keyChoice = await waitForClick(keyCard, ".conv-action");
      if (keyChoice === "save-key") {
        const keyInput = document.getElementById("conv-api-key-input");
        const providerSelect = document.getElementById("conv-provider-select");
        const apiKey = (keyInput?.value || "").trim();
        const provider = providerSelect?.value || "openai";
        applyCardTransitionState(
          keyCard,
          keyChoice,
          describeOnboardingTransition("manual-key", keyChoice, { provider }),
        );
        if (apiKey.length >= 8) {
          result.apiKeys.push({
            provider,
            key: apiKey,
            masked_value: apiKey.slice(0, 4) + "..." + apiKey.slice(-4),
            source: "manual",
          });
          const chosenCloudKey = chooseBossCloudKey(result.apiKeys, {
            permissionMode: result.permissionMode,
          });
          const chosenCloudIndex = result.apiKeys.findIndex(
            (entry) => entry?.provider === chosenCloudKey?.provider,
          );
          result.primaryKeyIndex =
            Number.isInteger(chosenCloudIndex) && chosenCloudIndex >= 0 ? chosenCloudIndex : 0;
          addBubble(
            `<p style="font-size: 13px; color: #e2e8f0; margin: 0;">Saved ${provider} key</p>`,
            "user",
          );
        } else {
          addBubble(
            `<p style="font-size: 13px; color: #e2e8f0; margin: 0;">Skipped — no valid key entered</p>`,
            "user",
          );
        }
      } else {
        applyCardTransitionState(
          keyCard,
          keyChoice,
          describeOnboardingTransition("manual-key", keyChoice),
        );
        addBubble(
          `<p style="font-size: 13px; color: #e2e8f0; margin: 0;">Skipped — I'll set up later</p>`,
          "user",
        );
      }
    }

    // ── Step 2: Agent Identity (existing agent or new name) ─
    typing = showTyping();
    await delay(300);
    hideTyping(typing);
    const agent = discovery?.agent_identity;

    if (hasAgent) {
      // ── Existing agent found — welcome back card ──
      const agentEmoji = agent.emoji || "🤖";
      const agentVibe = agent.vibe || "";
      const agentDesc = agent.description || "";
      const userPrefName = agent.user_preferred_name || "";
      const fileBadges = [
        agent.has_identity ? "IDENTITY" : null,
        agent.has_soul ? "SOUL" : null,
        agent.has_memory ? "MEMORY" : null,
      ]
        .filter(Boolean)
        .map(
          (f) =>
            `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: rgba(0,255,170,0.08); border: 1px solid rgba(0,255,170,0.15); font-size: 10px; color: hsl(160,100%,60%); font-weight: 600; letter-spacing: 0.5px;">${f}</span>`,
        )
        .join(" ");

      const agentCard = addBubble(`
        <div style="${cardStyle}">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <span style="font-size: 28px;">${agentEmoji}</span>
            <div>
              <p style="font-size: 16px; color: #e2e8f0; margin: 0; font-weight: 700;">
                ${agent.name}
              </p>
              ${agentDesc ? `<p style="font-size: 11px; color: #4a5568; margin: 2px 0 0;">${agentDesc}</p>` : ""}
            </div>
          </div>
          ${agentVibe ? `<p style="font-size: 12px; color: #a0aec0; margin: 0 0 8px;">Vibe: <em>${agentVibe}</em></p>` : ""}
          <div style="margin-bottom: 10px;">${fileBadges}</div>
          ${userPrefName ? `<p style="font-size: 11px; color: #4a5568; margin: 0 0 10px;">You're registered as <strong style="color: #a0aec0;">${userPrefName}</strong></p>` : ""}
          <p style="font-size: 13px; color: #e2e8f0; margin: 0 0 12px; line-height: 1.6;">
            I found your existing agent. Want to bring <strong style="color: hsl(160,100%,70%);">${agent.name}</strong> back?
          </p>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button data-value="restore" class="conv-action" style="${primaryBtn}">Yes — bring ${agent.name} back</button>
            <button data-value="new" class="conv-action" style="${ghostBtn}">Start fresh with a new name</button>
          </div>
        </div>
      `);

      const agentChoice = await waitForClick(agentCard, ".conv-action");
      applyCardTransitionState(
        agentCard,
        agentChoice,
        describeOnboardingTransition("agent-identity", agentChoice, {
          agentName: agent.name,
        }),
      );

      if (agentChoice === "restore") {
        result.agentName = agent.name;
        result.importedAgentSourceDir = agent.source_dir || null;
        result.importedArtifactKinds = [
          agent.has_identity ? "IDENTITY.md" : null,
          agent.has_soul ? "SOUL.md" : null,
          agent.has_memory ? "MEMORY.md" : null,
          agent.user_preferred_name ? "USER.md" : null,
        ].filter(Boolean);
        addBubble(
          `<p style="font-size: 13px; color: #e2e8f0; margin: 0;">${agentEmoji} ${agent.name} is back</p>`,
          "user",
        );
      } else {
        addBubble(
          `<p style="font-size: 13px; color: #e2e8f0; margin: 0;">Starting fresh</p>`,
          "user",
        );
      }
    }

    // ── New name input (if no agent found or user chose fresh) ──
    if (!result.agentName) {
      typing = showTyping();
      await delay(300);
      hideTyping(typing);
      const suggestedName = result.gitIdentity?.name ? result.gitIdentity.name.split(" ")[0] : "";
      const nameCard = addBubble(`
        <div style="${cardStyle}">
          <p style="font-size: 13px; color: #a0aec0; margin: 0 0 12px; line-height: 1.6;">
            Give me a name. This is how I'll identify myself in our conversations.
          </p>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="text" id="conv-name-input" placeholder="e.g., Atlas, Aegis, Nova, Claw"
              value="${suggestedName}"
              style="flex: 1; background: #141820; border: 1px solid #1e2a3a; border-radius: 6px;
              padding: 8px 12px; color: #e2e8f0; font-size: 13px; font-family: 'Inter', sans-serif; outline: none;" />
            <button data-value="confirm" class="conv-action" style="${primaryBtn}">Confirm</button>
          </div>
        </div>
      `);

      await waitForClick(nameCard, ".conv-action");
      const nameInput = document.getElementById("conv-name-input");
      result.agentName = (nameInput?.value || "").trim() || "Atlas";
      applyCardTransitionState(
        nameCard,
        "confirm",
        describeOnboardingTransition("agent-name", "confirm", {
          agentName: result.agentName,
        }),
      );
      addBubble(
        `<p style="font-size: 13px; color: #e2e8f0; margin: 0;">${result.agentName}</p>`,
        "user",
      );
    }

    // ── Step 3: Model selection (informed by discovery) ───
    typing = showTyping();
    await delay(300);
    hideTyping(typing);
    discoveredLocalModels = result.localModels;
    hasSelectedLocalModels = discoveredLocalModels.length > 0;
    discoveredLocalBackends = Array.from(
      new Set(
        discoveredLocalModels.map((model) => normalizeLocalBackend(model.source)).filter(Boolean),
      ),
    );
    if (!app.activeBiosProfileId) {
      const draftSnapshot = {
        completed: false,
        agentName: result.agentName,
        importedAgentSourceDir: result.importedAgentSourceDir,
        importedArtifactKinds: result.importedArtifactKinds,
        permissionMode: result.permissionMode,
        modelPref: result.modelPref,
        safetyPostureLabel: result.safetyPostureLabel,
        executionMode: result.executionMode,
        sandboxBackend: result.sandboxBackend,
        toolCreationPolicy: result.toolCreationPolicy,
        networkPosture: result.networkPosture,
        hostAccess: result.hostAccess,
        promotionPolicy: result.promotionPolicy,
        localRuntimeOwner: result.localRuntimeOwner,
        localRuntimeEngine: result.localRuntimeEngine,
        localRuntimeStrategy: result.localRuntimeStrategy,
        timestamp: Date.now(),
      };
      const preservedDraftState = {
        apiKeys: result.apiKeys,
        importedDiscoveryKeyIds: result.importedDiscoveryKeyIds,
        gitIdentity: result.gitIdentity,
        localModels: result.localModels,
        sshKeyTypes: result.sshKeyTypes,
        aiTools: result.aiTools,
      };
      const draftDetail = await app.saveBiosProfileSnapshot?.(draftSnapshot, null, true);
      hydrateResultFromSavedDetail(draftDetail);
      Object.assign(result, preservedDraftState);
      await appendBiosDebugLog("onboarding.profile.materialized", {
        profileId: currentProfileId(),
        agentName: result.agentName,
      });
    }

    initialWorkerAssets = await loadWorkerAssetsStatus();
    installedWorkerModels = initialWorkerAssets?.installed_models || [];
    hasInstalledWorkerModels = installedWorkerModels.length > 0;
    managedRuntimeAvailable = Boolean(initialWorkerAssets?.bundled_sidecar_available);
    hasCloudKey = listUsableCloudKeys(result.apiKeys).length > 0;
    const hasAnyLocalRoute = hasSelectedLocalModels || hasInstalledWorkerModels;
    const defaultModel = result.preferredLocalBackend
      ? "local"
      : hasAnyLocalRoute
        ? hasCloudKey
          ? "hybrid"
          : "local"
        : hasCloudKey
          ? "commercial"
          : "local";
    const disabledBtn =
      "opacity: 0.45; cursor: not-allowed; border-color: rgba(255,255,255,0.08); color: #718096;";
    const chosenCloudProvider = chooseBossCloudKey(result.apiKeys, {
      permissionMode: result.permissionMode,
    })?.provider;
    const routeChoiceSnapshot = buildOnboardingRouteChoiceSnapshot({
      machineProfile: discovery?.machine_profile || null,
      hasCloudKey,
      cloudProvider: chosenCloudProvider,
      hasSelectedLocalModels,
      hasInstalledWorkerModels,
      preferredLocalBackend: result.preferredLocalBackend,
      defaultModel,
      workerCatalog: workerModelCatalog,
    });
    const modelCard = addBubble(`
      <div style="${cardStyle}">
        <p style="font-size: 13px; color: #a0aec0; margin: 0 0 4px; line-height: 1.6;">
          How should <strong style="color: hsl(160,100%,70%);">${result.agentName}</strong> run?
        </p>
        <p style="font-size: 11px; color: #4a5568; margin: 0 0 8px; line-height: 1.6;">
          ${routeChoiceSnapshot.intro}
        </p>
        <p style="font-size: 11px; color: #4a5568; margin: 0 0 10px; line-height: 1.6;">
          ${routeChoiceSnapshot.helper}
        </p>
        ${routeChoiceSnapshot.notices
          .map(
            (notice) =>
              `<p style="font-size: 11px; color: ${
                notice.includes("locked") ? "#f6ad55" : "hsl(160,100%,50%)"
              }; margin: 0 0 8px;">${notice}</p>`,
          )
          .join("")}
        ${
          hasSelectedLocalModels
            ? `<p style="font-size: 11px; color: #4a5568; margin: 0 0 8px;">Detected local inventory: ${discoveredLocalModels.map((m) => m.model_id).join(", ")}</p>`
            : ""
        }
        <p style="font-size: 11px; color: #4a5568; margin: 0 0 12px;">
          Your desktop video stream is never sent to the cloud regardless of which option you choose.
        </p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${routeChoiceSnapshot.options
            .map((option) => {
              const selectedStyle = option.recommended ? primaryBtn : ghostBtn;
              return `
                <div style="border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 10px;">
                  <div style="display: flex; gap: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
                    <button data-value="${option.value}" class="conv-action" ${option.enabled ? "" : "disabled"} style="${selectedStyle} ${option.enabled ? "" : disabledBtn}">${option.label}${option.recommended ? " (recommended)" : ""}</button>
                  </div>
                  <p style="font-size: 11px; color: #a0aec0; margin: 8px 0 0; line-height: 1.5;">${option.description}</p>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `);

    modelChoice = await waitForClick(modelCard, ".conv-action");
    result.modelPref = modelChoice;
    await appendBiosDebugLog("onboarding.model_choice", {
      modelChoice,
      preferredLocalBackend: result.preferredLocalBackend,
      discoveredLocalBackends,
      hasInstalledWorkerModels,
      hasCloudKey,
    });
    applyCardTransitionState(
      modelCard,
      modelChoice,
      describeOnboardingTransition("model-choice", modelChoice),
    );

    const onboardingSummary = buildOnboardingSummarySnapshot({
      modelChoice,
      permissionChoice: null,
      apiKeys: result.apiKeys,
    });
    const modelEcho = onboardingSummary.modelEcho;
    addBubble(`<p style="font-size: 13px; color: #e2e8f0; margin: 0;">${modelEcho}</p>`, "user");
  }

  let needsManagedWorkerRoute =
    (modelChoice === "hybrid" || modelChoice === "local") &&
    (!result.preferredLocalBackend ||
      result.preferredLocalBackend === MANAGED_LOCAL_RUNTIME_PROVIDER);

  if (
    needsManagedWorkerRoute &&
    typeof tauriInvoke === "function" &&
    discoveredLocalBackends.length > 0 &&
    !hasInstalledWorkerModels
  ) {
    const backendChoice = managedRuntimeAvailable
      ? MANAGED_LOCAL_RUNTIME_PROVIDER
      : discoveredLocalBackends.includes("lmstudio")
        ? "lmstudio"
        : discoveredLocalBackends[0];
    await appendBiosDebugLog("onboarding.local_route_choice", {
      backendChoice,
      discoveredLocalBackends,
      chooser: "boss-governed",
    });
    if (backendChoice === MANAGED_LOCAL_RUNTIME_PROVIDER || backendChoice === "bios-worker") {
      assignManagedLocalRuntime(result);
      needsManagedWorkerRoute = true;
      addBubble(`
          <div style="${cardStyle}">
            <p style="font-size: 13px; color: #a0aec0; margin: 0; line-height: 1.6;">
              BIOS AI is keeping the local lane on the owned managed runtime so the BOSS can choose and verify its own local brain.
            </p>
          </div>
        `);
      addBubble(
        `<p style="font-size: 13px; color: #e2e8f0; margin: 0;">Use the <strong>BIOS AI Managed Runtime (llama.cpp)</strong></p>`,
        "user",
      );
    } else {
      assignExternalLocalRuntime(result, backendChoice);
      needsManagedWorkerRoute = false;
      addBubble(
        `<p style="font-size: 13px; color: #e2e8f0; margin: 0;">Use ${formatLocalBackendLabel(backendChoice)} for local routing</p>`,
        "user",
      );
    }
  }

  if (
    !needsManagedWorkerRoute &&
    (modelChoice === "hybrid" || modelChoice === "local") &&
    result.preferredLocalBackend &&
    typeof tauriInvoke === "function"
  ) {
    const routeRequiresLocalProof = modelChoice === "local" || !hasCloudKey;
    const verificationBubble = addBubble(`
        <div style="${cardStyle}">
          <p style="font-size: 12px; color: #a0aec0; margin: 0 0 8px;">Checking ${formatLocalBackendLabel(result.preferredLocalBackend)} before setup continues...</p>
          <p id="external-local-runtime-status" style="font-size: 11px; color: #4a5568; margin: 0;">Making sure the local runtime responds and already has a usable model.</p>
        </div>
      `);
    const verificationStatus = verificationBubble.querySelector("#external-local-runtime-status");
    try {
      const probe = await probeLocalRuntime(result.preferredLocalBackend);
      if (verificationStatus) {
        verificationStatus.textContent =
          probe?.detail || `${formatLocalBackendLabel(result.preferredLocalBackend)} is reachable.`;
      }
      await appendBiosDebugLog("onboarding.external_local_runtime.probe_success", {
        provider: result.preferredLocalBackend,
        resolvedModel: probe?.resolved_model || null,
      });
    } catch (err) {
      const detail = err?.message || String(err);
      if (verificationStatus) {
        verificationStatus.textContent = detail;
        verificationStatus.style.color = "#feb2b2";
      }
      result.localWorkerDownloadStatus = "failed";
      await appendBiosDebugLog("onboarding.external_local_runtime.probe_failed", {
        provider: result.preferredLocalBackend,
        detail,
      });
      if (routeRequiresLocalProof) {
        addBubble(
          `<p style="font-size: 12px; color: #feb2b2; margin: 0;">${formatLocalBackendLabel(result.preferredLocalBackend)} is not ready yet, so BIOS AI cannot finish setup on a required local route.</p>`,
        );
      }
    }
  }

  if (
    needsManagedWorkerRoute &&
    (modelChoice === "hybrid" || modelChoice === "local") &&
    typeof tauriInvoke === "function"
  ) {
    const workerSetupSnapshot = buildManagedWorkerSetupSnapshot({
      machineProfile: discovery?.machine_profile,
      modelChoice,
      hasCloudKey,
      workerCatalog: workerModelCatalog,
    });
    const installedOptions = workerSetupSnapshot.workerOptions
      .filter((option) => installedWorkerModels.some((model) => model.variant === option.variant))
      .map((option) => ({
        ...option,
        sizeLabel: "Already installed",
      }));
    if (installedOptions.length > 0) {
      assignManagedLocalRuntime(result);
      const recommendedInstalledWorker =
        installedOptions.find(
          (option) => option.variant === workerSetupSnapshot.recommendedWorker.variant,
        ) || installedOptions[0];
      const installedChoiceCard = addBubble(
        renderManagedWorkerSetupCard({
          agentName: result.agentName,
          cardStyle,
          ghostBtn,
          primaryBtn,
          recommendedWorker: recommendedInstalledWorker,
          workerOptions: installedOptions,
          mustFinishWithLocalWorker: true,
          modelChoice,
          escapeTooltip,
          installedMode: true,
          machineFitSummary: workerSetupSnapshot.machineFitSummary,
          showBringYourOwnOption: false,
        }),
      );

      const installedChoice = await waitForClick(installedChoiceCard, ".conv-action");
      applyCardTransitionState(
        installedChoiceCard,
        installedChoice,
        describeOnboardingTransition("worker-download", installedChoice),
      );
      const selectedInstalledWorker =
        installedWorkerModels.find((model) => model.variant === installedChoice) ||
        installedWorkerModels.find(
          (model) => model.variant === recommendedInstalledWorker.variant,
        ) ||
        installedWorkerModels[0];
      result.localWorkerModelVariant = selectedInstalledWorker?.variant || null;
      result.localWorkerModelPath = selectedInstalledWorker?.path || null;
      result.localWorkerDownloadStatus = "installed";
      await tauriInvoke("save_worker_runtime_selection", {
        variant: result.localWorkerModelVariant,
        profileId: currentProfileId(),
      });
      await appendBiosDebugLog("onboarding.local_worker.reuse_installed", {
        variant: result.localWorkerModelVariant,
        modelChoice,
      });
      addBubble(
        `<p style="font-size: 13px; color: #e2e8f0; margin: 0;">Start BIOS AI with <strong>${formatWorkerLabel(result.localWorkerModelVariant)}</strong></p>`,
        "user",
      );
      addBubble(
        `<p style="font-size: 12px; color: hsl(160,100%,60%); margin: 0 0 4px;">BIOS AI will start with <strong>${selectedInstalledWorker?.model_id || selectedInstalledWorker?.variant}</strong>. Those files are already installed, so no new download is needed.</p>`,
      );
      try {
        const probe = await probeLocalRuntime(MANAGED_LOCAL_RUNTIME_PROVIDER);
        await appendBiosDebugLog("onboarding.local_worker.probe_success", {
          variant: result.localWorkerModelVariant,
          resolvedModel: probe?.resolved_model || null,
        });
      } catch (err) {
        await appendBiosDebugLog("onboarding.local_worker.probe_failed", {
          variant: result.localWorkerModelVariant,
          detail: err?.message || String(err),
        });
        await stopForWorkerVerification({
          variant: result.localWorkerModelVariant,
          detail: err?.message || String(err),
          workerLabel: formatWorkerLabel(result.localWorkerModelVariant),
        });
        return;
      }
    } else {
      typing = showTyping();
      await delay(300);
      hideTyping(typing);
      const { workerOptions, recommendedWorker, mustFinishWithLocalWorker } = workerSetupSnapshot;

      const localSetupCard = addBubble(
        renderManagedWorkerSetupCard({
          agentName: result.agentName,
          cardStyle,
          ghostBtn,
          primaryBtn,
          recommendedWorker,
          workerOptions,
          mustFinishWithLocalWorker,
          modelChoice,
          escapeTooltip,
          machineFitSummary: workerSetupSnapshot.machineFitSummary,
        }),
      );

      const downloadChoice = await waitForClick(localSetupCard, ".conv-action");
      applyCardTransitionState(
        localSetupCard,
        downloadChoice,
        describeOnboardingTransition("worker-download", downloadChoice),
      );

      if (downloadChoice === "skip-download") {
        result.localWorkerDownloadStatus = "skipped";
        await appendBiosDebugLog("onboarding.local_worker.skipped", {
          modelChoice,
        });
        addBubble(
          `<p style="font-size: 13px; color: #e2e8f0; margin: 0;">Skipping local worker download for now</p>`,
          "user",
        );
      } else if (downloadChoice === "use-own-gguf") {
        assignManagedLocalRuntime(result);
        addBubble(
          `<p style="font-size: 13px; color: #e2e8f0; margin: 0;">Use my own llama.cpp GGUF</p>`,
          "user",
        );

        const externalCard = addBubble(
          renderExternalWorkerSetupCard({
            cardStyle,
            primaryBtn,
          }),
        );
        const externalChoice = await waitForExternalGgufChoice(externalCard);
        result.localWorkerModelVariant = externalChoice?.selection?.variant || null;
        result.localWorkerModelPath = externalChoice?.selection?.path || null;
        result.localWorkerDownloadStatus = "installed";
        result.localRuntimeStrategy = "BIOS-managed custom GGUF runtime";
        await appendBiosDebugLog("onboarding.local_worker.external_registered", {
          variant: result.localWorkerModelVariant,
          path: result.localWorkerModelPath,
          modelChoice,
        });
        try {
          const probe = await probeLocalRuntime(MANAGED_LOCAL_RUNTIME_PROVIDER);
          await appendBiosDebugLog("onboarding.local_worker.probe_success", {
            variant: result.localWorkerModelVariant,
            resolvedModel: probe?.resolved_model || null,
          });
          addBubble(
            `<p style="font-size: 12px; color: hsl(160,100%,60%); margin: 0;">BIOS AI bound <strong>${escapeOnboardingHtml(
              externalChoice?.selection?.model_id || result.localWorkerModelVariant || "your GGUF",
            )}</strong> to this BOSS profile and verified the managed llama.cpp lane can answer with it.</p>`,
          );
        } catch (err) {
          await appendBiosDebugLog("onboarding.local_worker.probe_failed", {
            variant: result.localWorkerModelVariant,
            detail: err?.message || String(err),
          });
          await stopForWorkerVerification({
            variant: result.localWorkerModelVariant,
            detail: err?.message || String(err),
            workerLabel:
              externalChoice?.selection?.model_id || result.localWorkerModelVariant || "your GGUF",
          });
          return;
        }
      } else {
        assignManagedLocalRuntime(result);
        result.localWorkerModelVariant = downloadChoice;
        result.localWorkerDownloadStatus = "pending";
        const selectedWorkerOption =
          workerOptions.find((option) => option.variant === downloadChoice) || recommendedWorker;
        const workerLabel = formatWorkerLabel(downloadChoice);

        const storageStatus = await loadWorkerStorageStatus();
        const {
          storageOptions,
          recommendedStorage,
          selectedStoragePath: initialStoragePath,
          selectedStorageLabel: initialStorageLabel,
        } = buildWorkerStorageSnapshot(storageStatus);
        let selectedStoragePath = initialStoragePath;
        let selectedStorageLabel = initialStorageLabel;

        if (storageOptions.length > 0) {
          typing = showTyping();
          await delay(250);
          hideTyping(typing);
          const storageCard = addBubble(
            renderWorkerStorageCard({
              cardStyle,
              escapeOnboardingHtml,
              formatStorageBytes,
              ghostBtn,
              primaryBtn,
              recommendedStorage,
              selectedWorkerLabel: selectedWorkerOption.label,
              storageOptions,
            }),
          );
          const storageChoice = await waitForClick(storageCard, ".conv-action");
          lockCardActions(storageCard, storageChoice, "Storage locked");
          addBubble(
            `<p style="font-size: 12px; color: #4a5568; margin: 0;">Storage location locked for this install. BIOS AI is starting the model download now...</p>`,
          );
          const savedStorageStatus = await saveWorkerStorageLocation(storageChoice);
          const chosenStorage =
            storageOptions.find((option) => option.path === storageChoice) || recommendedStorage;
          selectedStoragePath =
            savedStorageStatus?.effective_path || chosenStorage.path || selectedStoragePath;
          selectedStorageLabel = chosenStorage.label;
          addBubble(
            `<p style="font-size: 13px; color: #e2e8f0; margin: 0;">Store local model files on <strong>${selectedStorageLabel}</strong></p>`,
            "user",
          );
          await appendBiosDebugLog("onboarding.local_worker.storage_selected", {
            variant: downloadChoice,
            storagePath: selectedStoragePath,
            storageLabel: selectedStorageLabel,
          });
        }

        await appendBiosDebugLog("onboarding.local_worker.download_requested", {
          variant: downloadChoice,
          modelChoice,
          storagePath: selectedStoragePath,
          workerRole: selectedWorkerOption.role,
        });
        result.localWorkerStoragePath = selectedStoragePath;
        addBubble(
          `<p style="font-size: 13px; color: #e2e8f0; margin: 0;">Install ${workerLabel}</p>`,
          "user",
        );

        const progressBubble = addBubble(`
            <div style="${cardStyle}">
              <p style="font-size: 12px; color: #a0aec0; margin: 0 0 8px;">Preparing ${workerLabel} for ${selectedWorkerOption.role}</p>
              <p style="font-size: 10px; color: #4a5568; margin: 0 0 8px; line-height: 1.5;">Target location: ${escapeOnboardingHtml(selectedStoragePath || "Loading target path...")}</p>
              <div id="worker-download-progress" style="height: 8px; border-radius: 999px; background: rgba(255,255,255,0.06); overflow: hidden;">
                <div id="worker-download-progress-fill" style="width: 0%; height: 100%; background: hsl(160,100%,50%); transition: width 0.3s ease;"></div>
              </div>
              <p id="worker-download-progress-text" style="font-size: 11px; color: #4a5568; margin: 8px 0 0;">Starting install...</p>
            </div>
          `);
        const progressFill = progressBubble.querySelector("#worker-download-progress-fill");
        const progressText = progressBubble.querySelector("#worker-download-progress-text");

        await tauriInvoke("start_worker_model_download", {
          variant: downloadChoice,
          profileId: currentProfileId(),
        });
        const updateProgressUi = async () => {
          const status = await loadWorkerAssetsStatus();
          const download = status?.download;
          if (download?.state === "downloading") {
            const progressSnapshot = buildWorkerDownloadProgressSnapshot(download);
            if (progressFill) {
              progressFill.style.width = `${progressSnapshot.percent}%`;
            }
            if (progressText) {
              progressText.textContent = progressSnapshot.progressText;
            }
          }
        };

        const progressInterval = setInterval(() => {
          void updateProgressUi();
        }, 1200);

        const finalDownload = await pollWorkerDownloadBriefly();
        await updateProgressUi();

        if (finalDownload.state === "downloading") {
          clearInterval(progressInterval);
          result.localWorkerDownloadStatus = "pending";
          const latestStatus = await loadWorkerAssetsStatus();
          const latestDownload = latestStatus?.download || finalDownload;
          const progressSnapshot = buildWorkerDownloadProgressSnapshot(latestDownload);
          if (progressFill) {
            progressFill.style.width = `${progressSnapshot.percent}%`;
          }
          if (progressText) {
            progressText.textContent = `${progressSnapshot.progressText} | continuing in background`;
          }
          await appendBiosDebugLog("onboarding.local_worker.download_backgrounded", {
            variant: downloadChoice,
            storagePath: selectedStoragePath,
            downloadedBytes: latestDownload?.downloaded_bytes || 0,
            totalBytes: latestDownload?.total_bytes || null,
            resumable: Boolean(latestDownload?.resumable),
          });
          await savePendingWorkerDownloadSnapshot();
          addBubble(
            `<p style="font-size: 12px; color: #f6d365; margin: 0;">BIOS AI is downloading <strong>${escapeOnboardingHtml(
              workerLabel,
            )}</strong> in the background. Setup is saved; do not delete the partial file. You can reopen this BOSS profile or Settings to watch progress, and retry will resume from the saved bytes.</p>`,
          );
          if (typeof app.loadBiosRuntimeStatus === "function") {
            await app.loadBiosRuntimeStatus({ tickBrainstem: false });
          }
          return;
        }

        clearInterval(progressInterval);
        await updateProgressUi();

        if (finalDownload.state === "completed") {
          const refreshedStatus = await loadWorkerAssetsStatus();
          const installed = refreshedStatus?.installed_models?.find(
            (model) => model.variant === downloadChoice,
          );
          result.localWorkerModelPath = installed?.path || finalDownload.target_path || null;
          result.localWorkerDownloadStatus = "completed";
          await appendBiosDebugLog("onboarding.local_worker.download_completed", {
            variant: downloadChoice,
            path: result.localWorkerModelPath,
          });
          await saveWorkerRuntimeSelection(downloadChoice);
          try {
            const probe = await probeLocalRuntime(MANAGED_LOCAL_RUNTIME_PROVIDER);
            await appendBiosDebugLog("onboarding.local_worker.probe_success", {
              variant: downloadChoice,
              resolvedModel: probe?.resolved_model || null,
            });
            const outcomeSnapshot = buildWorkerInstallOutcomeSnapshot({
              finalDownload,
              selectedStorageLabel: escapeOnboardingHtml(selectedStorageLabel),
              workerLabel,
              probeError: null,
            });
            if (progressFill) {
              progressFill.style.width = "100%";
            }
            if (progressText) {
              progressText.textContent = outcomeSnapshot.progressText;
            }
            addBubble(outcomeSnapshot.bubbleHtml);
          } catch (err) {
            await appendBiosDebugLog("onboarding.local_worker.probe_failed", {
              variant: downloadChoice,
              detail: err?.message || String(err),
            });
            await stopForWorkerVerification({
              variant: downloadChoice,
              detail: err?.message || String(err),
              workerLabel,
              progressFill,
              progressText,
            });
            return;
          }
        } else {
          result.localWorkerDownloadStatus = "failed";
          await appendBiosDebugLog("onboarding.local_worker.download_failed", {
            variant: downloadChoice,
            error: finalDownload.error || "unknown error",
          });
          const outcomeSnapshot = buildWorkerInstallOutcomeSnapshot({
            finalDownload: {
              ...finalDownload,
              error: escapeOnboardingHtml(finalDownload.error || "unknown error"),
            },
            selectedStorageLabel: escapeOnboardingHtml(selectedStorageLabel),
            workerLabel,
            probeError: null,
          });
          if (progressFill) {
            progressFill.style.width = "100%";
            progressFill.style.background = "hsl(0, 78%, 63%)";
          }
          if (progressText) {
            progressText.textContent = outcomeSnapshot.progressText;
          }
          addBubble(outcomeSnapshot.bubbleHtml);
        }
      }
    }
  }

  // ── Step 4: Autonomy calibration ─────────────────────
  typing = showTyping();
  await delay(300);
  hideTyping(typing);

  const permCard = addBubble(`
      <div style="${cardStyle}">
        <p style="font-size: 13px; color: #a0aec0; margin: 0 0 4px; line-height: 1.6;">
          Last question - how much system authority should ${result.agentName} have?
        </p>
        <p style="font-size: 11px; color: #4a5568; margin: 0 0 12px;">
          This controls whether BIOS AI asks before commands, file changes, app control, and web actions that affect your system.
        </p>
        <p style="font-size: 11px; color: #4a5568; margin: 0 0 12px;">
          Kernel hard stops, sandboxing, and secret protection stay active either way.
        </p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button data-value="allowed" class="conv-action" style="${primaryBtn}">Broad authority</button>
          <button data-value="not_allowed" class="conv-action" style="${ghostBtn}">Ask me first</button>
        </div>
      </div>
    `);

  const permChoice = await waitForClick(permCard, ".conv-action");
  result.permissionMode = permChoice;
  applyCardTransitionState(
    permCard,
    permChoice,
    describeOnboardingTransition("permission-choice", permChoice),
  );

  addBubble(
    `<p style="font-size: 13px; color: #e2e8f0; margin: 0;">${permChoice === "allowed" ? "Broad authority" : "Ask me first"}</p>`,
    "user",
  );

  // ── Step 5: Readback + confirmation ──────────────────
  typing = showTyping();
  await delay(300);
  hideTyping(typing);

  const finalOnboardingSummary = buildOnboardingReadbackSnapshot(result, permChoice);
  addBubble(
    renderOnboardingReadbackCard({
      agentName: result.agentName,
      cardStyle,
      keysSummary: finalOnboardingSummary.keysSummary,
      localRuntimeLabel: finalOnboardingSummary.localRuntimeLabel,
      localWorkerLabel: finalOnboardingSummary.localWorkerLabel,
      modeLabel: finalOnboardingSummary.modeLabel,
      modelLabel: finalOnboardingSummary.modelLabel,
      modelPref: result.modelPref,
      primaryBtn,
      promotionPolicy: result.promotionPolicy,
      routeReadinessDetail: finalOnboardingSummary.routeReadinessDetail,
      routeReadinessHeadline: finalOnboardingSummary.routeReadinessHeadline,
      safetyPostureLabel: result.safetyPostureLabel,
    }),
  );

  const readbackCard = chatStream.lastElementChild;
  await waitForClick(readbackCard, ".conv-action");
  const readbackButton = readbackCard?.querySelector('button[data-value="done"]');
  if (readbackButton) {
    readbackButton.textContent = "Preparing BIOS AI...";
    readbackButton.disabled = true;
  }
  const saveStatus = document.createElement("p");
  saveStatus.style.cssText = "font-size: 11px; color: #4a5568; margin: 10px 0 0;";
  saveStatus.textContent =
    listUsableCloudKeys(result.apiKeys).length > 0
      ? "Saving your setup and importing selected connections into the desktop shell..."
      : "Saving your setup and preparing the shell...";
  readbackCard?.querySelector("div")?.appendChild(saveStatus);
  readbackCard.querySelector("div").style.opacity = "0.5";
  readbackCard.querySelector("div").style.pointerEvents = "none";
  // Save & apply
  try {
    if (result.modelPref === "local") {
      if (
        result.preferredLocalBackend === MANAGED_LOCAL_RUNTIME_PROVIDER ||
        result.localRuntimeOwner === "BIOS AI"
      ) {
        if (!managedLocalReady()) {
          throw new Error(
            "Local only was selected, but the BIOS AI managed local BOSS brain is not installed and verified yet.",
          );
        }
        await probeLocalRuntime(MANAGED_LOCAL_RUNTIME_PROVIDER);
      } else if (result.preferredLocalBackend) {
        await probeLocalRuntime(result.preferredLocalBackend);
      } else {
        throw new Error(
          "Local only was selected, but no verified local runtime is wired for this BOSS profile yet.",
        );
      }
    } else if (result.modelPref === "hybrid") {
      const hasCloudRoute = cloudRouteReady();
      if (
        result.preferredLocalBackend === MANAGED_LOCAL_RUNTIME_PROVIDER ||
        result.localRuntimeOwner === "BIOS AI"
      ) {
        if (!managedLocalReady()) {
          throw new Error(
            "Hybrid was selected, but the BIOS AI managed local BOSS brain is not installed and verified yet.",
          );
        }
        await probeLocalRuntime(MANAGED_LOCAL_RUNTIME_PROVIDER);
      } else if (result.preferredLocalBackend) {
        await probeLocalRuntime(result.preferredLocalBackend);
      } else if (!hasCloudRoute) {
        throw new Error(
          "Hybrid was selected, but BIOS AI could not verify either a local route or a cloud route for this BOSS profile.",
        );
      }
    } else if (result.modelPref === "commercial") {
      const hasCloudRoute = cloudRouteReady();
      if (!hasCloudRoute) {
        throw new Error(
          "Cloud BOSS was selected, but BIOS AI could not verify a usable cloud model key for this BOSS profile.",
        );
      }
    }
  } catch (err) {
    const detail = err?.message || String(err);
    await appendBiosDebugLog("onboarding.final_route_validation_failed", {
      modelPref: result.modelPref,
      preferredLocalBackend: result.preferredLocalBackend || null,
      detail,
    });
    saveStatus.textContent = detail;
    saveStatus.style.color = "#feb2b2";
    readbackCard.querySelector("div").style.opacity = "1";
    readbackCard.querySelector("div").style.pointerEvents = "auto";
    if (readbackButton) {
      readbackButton.textContent = "Start Working ->";
      readbackButton.disabled = false;
    }
    return;
  }

  const installedWorkerVariants =
    (await loadWorkerAssetsStatus())?.installed_models?.map((model) => model?.variant) || [];
  const chosenCloudKey = chooseBossCloudKey(result.apiKeys, {
    permissionMode: result.permissionMode,
  });
  const chosenCloudIndex = result.apiKeys.findIndex(
    (entry) => entry?.provider === chosenCloudKey?.provider,
  );
  result.primaryKeyIndex =
    Number.isInteger(chosenCloudIndex) && chosenCloudIndex >= 0 ? chosenCloudIndex : 0;
  result.biosWorkerRoster =
    result.preferredLocalBackend === MANAGED_LOCAL_RUNTIME_PROVIDER
      ? buildBossWorkerRosterAssignments({
          workerCatalog: workerModelCatalog,
          machineProfile: discovery?.machine_profile || null,
          bossVariant: result.localWorkerModelVariant,
          bossPath: result.localWorkerModelPath,
        })
      : [];
  result.bossModelGovernance = buildBossModelGovernanceSnapshot({
    machineProfile: discovery?.machine_profile || null,
    modelPref: result.modelPref,
    permissionMode: result.permissionMode,
    preferredLocalBackend: result.preferredLocalBackend,
    bossVariant: result.localWorkerModelVariant,
    installedVariants: installedWorkerVariants,
    apiKeys: result.apiKeys,
    workerCatalog: workerModelCatalog,
  });

  const requiresCloudProviderImport =
    result.modelPref === "commercial" || (result.modelPref === "hybrid" && !localRouteReady());
  let onboardingSnapshot = {
    completed: !requiresCloudProviderImport,
    agentName: result.agentName,
    profileRoot: result.profileRoot,
    identityDir: result.identityDir,
    memoryDir: result.memoryDir,
    dailyMemoryDir: result.dailyMemoryDir,
    runtimeDir: result.runtimeDir,
    importsDir: result.importsDir,
    logsDir: result.logsDir,
    skillsDir: result.skillsDir,
    synapsesPath: result.synapsesPath,
    soulPath: result.soulPath,
    userPath: result.userPath,
    identityPath: result.identityPath,
    memoryPath: result.memoryPath,
    importedAgentSourceDir: result.importedAgentSourceDir,
    importedArtifactKinds: result.importedArtifactKinds,
    permissionMode: result.permissionMode,
    modelPref: result.modelPref,
    safetyPostureLabel: result.safetyPostureLabel,
    executionMode: result.executionMode,
    sandboxBackend: result.sandboxBackend,
    toolCreationPolicy: result.toolCreationPolicy,
    networkPosture: result.networkPosture,
    hostAccess: result.hostAccess,
    promotionPolicy: result.promotionPolicy,
    localRuntimeOwner: result.localRuntimeOwner,
    localRuntimeEngine: result.localRuntimeEngine,
    localRuntimeStrategy: result.localRuntimeStrategy,
    gitIdentity: result.gitIdentity,
    localModels: result.localModels,
    preferredLocalBackend: result.preferredLocalBackend,
    localWorkerModelVariant: result.localWorkerModelVariant,
    localWorkerModelPath: result.localWorkerModelPath,
    biosWorkerRoster: result.biosWorkerRoster,
    localWorkerStoragePath: result.localWorkerStoragePath,
    localWorkerDownloadStatus: result.localWorkerDownloadStatus,
    sshKeyTypes: result.sshKeyTypes,
    aiTools: result.aiTools,
    apiKeys: result.apiKeys.map((k) => ({
      provider: k.provider,
      keyId: k.key_id || null,
      masked: k.masked_value,
      source: k.source,
    })),
    primaryKeyIndex: result.primaryKeyIndex ?? 0,
    bossModelGovernance: result.bossModelGovernance,
    timestamp: Date.now(),
  };

  let providerImportStatus = result.apiKeys.length > 0 ? "pending" : "not-needed";
  let providerImportMessage = "";
  let providerImportBlocking = false;

  try {
    const discoveryKeyIds = [...new Set(result.importedDiscoveryKeyIds.filter(Boolean))];
    const chosenRoute = chooseBossChatRoute({
      onboardingState: onboardingSnapshot,
      providerConfig: {
        active_provider: "",
        active_model: "",
        keys: result.apiKeys
          .filter((key) => key?.key)
          .map((key) => ({
            provider: key.provider,
            key: key.key,
            source: key.source || "manual",
            label: key.env_var || key.provider,
          })),
      },
      runtimeStatus: {
        preferred_local_backend: result.preferredLocalBackend || null,
        local_backend_reachable:
          result.localWorkerDownloadStatus === "completed" ||
          result.localWorkerDownloadStatus === "installed",
        worker_ready:
          result.localWorkerDownloadStatus === "completed" ||
          result.localWorkerDownloadStatus === "installed",
      },
    });
    const primaryKey =
      chosenRoute.apiKey && chosenRoute.provider
        ? result.apiKeys.find((key) => key?.provider === chosenRoute.provider && key?.key)
        : null;
    const discoveryPrimaryKeyId =
      result.apiKeys.find(
        (key) => key?.provider === chosenRoute.provider && key?.source !== "manual" && key?.key_id,
      )?.key_id ||
      discoveryKeyIds[0] ||
      null;

    if (discoveryKeyIds.length > 0 && typeof tauriInvoke === "function") {
      await importDiscoveredProviderKeysContract(tauriInvoke, {
        profileId: currentProfileId(),
        keyIds: discoveryKeyIds,
        primaryKeyId: discoveryPrimaryKeyId,
        preferredLocalBackend: result.preferredLocalBackend || null,
      });
      providerImportStatus = "saved";
      await appendBiosDebugLog("onboarding.provider_import.saved", {
        activeProvider: chosenRoute.provider || result.preferredLocalBackend || null,
        manualKeyCount: 0,
        discoveryKeyCount: discoveryKeyIds.length,
        chooser: "discovery-import",
      });
    }

    if (!primaryKey && result.preferredLocalBackend && typeof tauriInvoke === "function") {
      await tauriInvoke("save_provider_config", {
        config: {
          active_provider: chosenRoute.provider || result.preferredLocalBackend,
          active_model: "",
          keys: [],
          conversation_history: [],
        },
        profileId: currentProfileId(),
      });
      providerImportStatus = "saved";
      await appendBiosDebugLog("onboarding.provider_import.saved", {
        activeProvider: result.preferredLocalBackend,
        manualKeyCount: 0,
        discoveryKeyCount: discoveryKeyIds.length,
      });
    }

    if (primaryKey) {
      if (typeof tauriInvoke === "function") {
        const manualKeys = result.apiKeys.filter((key) => key.source === "manual" && key.key);
        if (manualKeys.length > 0) {
          await tauriInvoke("save_provider_config", {
            config: {
              active_provider:
                chosenRoute.provider || result.preferredLocalBackend || primaryKey.provider,
              active_model: "",
              keys: manualKeys.map((key) => ({
                provider: key.provider,
                key: key.key,
                source: key.source || "manual",
                label: key.env_var || key.provider,
              })),
              conversation_history: [],
            },
            profileId: currentProfileId(),
          });
        }

        providerImportStatus = "saved";
        await appendBiosDebugLog("onboarding.provider_import.saved", {
          activeProvider:
            chosenRoute.provider || result.preferredLocalBackend || primaryKey.provider,
          manualKeyCount: manualKeys.length,
          discoveryKeyCount: discoveryKeyIds.length,
          chooser: "boss-governed",
        });
      } else {
        providerImportStatus = "skipped";
        providerImportMessage =
          "Desktop credential import is unavailable in this surface. Your setup summary is saved locally, and you can import keys once the Tauri shell is running.";
        await appendBiosDebugLog("onboarding.provider_import.skipped", {
          reason: "tauri_invoke_unavailable",
        });
      }
    }

    if (
      providerImportStatus === "pending" &&
      !primaryKey &&
      !result.preferredLocalBackend &&
      result.apiKeys.length > 0
    ) {
      providerImportStatus = "failed";
      providerImportMessage =
        "BIOS AI could not determine which provider should own this BOSS profile yet.";
      providerImportBlocking = requiresCloudProviderImport;
    }
  } catch (error) {
    providerImportStatus = "failed";
    providerImportMessage = error?.message || String(error);
    providerImportBlocking = requiresCloudProviderImport;
    await appendBiosDebugLog("onboarding.provider_import.failed", {
      detail: providerImportMessage,
      blocking: providerImportBlocking,
    });
  }

  if (requiresCloudProviderImport && providerImportStatus !== "saved") {
    providerImportBlocking = true;
    if (!providerImportMessage) {
      providerImportMessage =
        "BIOS AI still needs a working cloud provider import before this BOSS profile can start.";
    }
  }

  onboardingSnapshot = {
    ...onboardingSnapshot,
    completed: !providerImportBlocking,
  };

  try {
    if (
      typeof tauriInvoke === "function" &&
      result.localWorkerModelVariant &&
      (result.localWorkerDownloadStatus === "completed" ||
        result.localWorkerDownloadStatus === "installed")
    ) {
      if (result.biosWorkerRoster?.length) {
        await tauriInvoke("save_worker_runtime_roster", {
          assignments: result.biosWorkerRoster,
          profileId: currentProfileId(),
        });
      } else {
        await saveWorkerRuntimeSelection(result.localWorkerModelVariant);
      }
    }
    const savedDetail = await app.saveBiosProfileSnapshot(
      onboardingSnapshot,
      app.activeBiosProfileId,
      true,
    );
    const hydratedSavedSnapshot = hydrateResultFromSavedDetail(savedDetail);
    if (hydratedSavedSnapshot) {
      onboardingSnapshot = {
        ...onboardingSnapshot,
        ...hydratedSavedSnapshot,
        completed: !providerImportBlocking,
      };
      app.saveSavedOnboardingSnapshot?.(onboardingSnapshot, app.activeBiosProfileId);
    }
    if (typeof app.tickBiosBrainstem === "function") {
      await app.tickBiosBrainstem({ allowDream: false });
    }
    if (typeof app.loadBiosRuntimeStatus === "function") {
      await app.loadBiosRuntimeStatus({ tickBrainstem: false });
    }
    if (typeof app.persistViewportObservation === "function") {
      await app.persistViewportObservation({
        state: providerImportBlocking ? "attention" : "idle",
        label: providerImportBlocking ? "Finish setup" : "BIOS Home",
        detail: providerImportBlocking
          ? providerImportMessage || `${result.agentName} still needs setup attention.`
          : `${result.agentName} is awake and ready for first work.`,
        activeSurface: "local_shell",
        bodyMode: providerImportBlocking ? "shell_attention" : "shell_standby",
        targetUrl: null,
      });
    }
    app.syncSavedOnboardingSnapshot();
    await appendBiosDebugLog("onboarding.snapshot.saved", {
      agentName: result.agentName,
      profileId: app.activeBiosProfileId || null,
      modelPref: result.modelPref,
      preferredLocalBackend: result.preferredLocalBackend,
      localWorkerModelVariant: result.localWorkerModelVariant,
      localWorkerDownloadStatus: result.localWorkerDownloadStatus,
      apiKeyCount: result.apiKeys.length,
      completed: onboardingSnapshot.completed,
    });
  } catch {
    /* localStorage not available */
  }

  app.agentName = result.agentName;
  app.updateAgentNameDOM();

  if (providerImportBlocking) {
    saveStatus.textContent = providerImportMessage;
    saveStatus.style.color = "#feb2b2";
    readbackCard.querySelector("div").style.opacity = "1";
    readbackCard.querySelector("div").style.pointerEvents = "auto";
    if (readbackButton) {
      readbackButton.textContent = "Retry finish setup ->";
      readbackButton.disabled = false;
    }
    return;
  }

  // Hide the modal if it was somehow visible
  const modal = document.getElementById("naming-modal");
  if (modal) modal.classList.add("hidden");

  // ── Post-onboarding transition ───────────────────────
  // Clear all the onboarding bubbles so the compose bar is visible
  chatStream.innerHTML = "";

  // Hide the empty-state placeholder
  const emptyEl = document.getElementById("chat-empty");
  if (emptyEl) emptyEl.style.display = "none";

  // Show a clean welcome message
  const welcomeDiv = document.createElement("div");
  welcomeDiv.style.cssText = "padding: 20px 0; text-align: center;";
  welcomeDiv.innerHTML = `
      <div style="font-size: 32px; margin-bottom: 8px;">${hasAgent ? agent?.emoji || "🤖" : "🤖"}</div>
      <p style="font-size: 16px; font-weight: 700; color: #e2e8f0; margin: 0 0 4px;">
        ${result.agentName} is ready
      </p>
      <p style="font-size: 12px; color: #4a5568; margin: 0 0 16px;">
        BIOS is awake. Type a message below to begin.
      </p>
      <div style="display: flex; flex-direction: column; gap: 10px; align-items: center; padding: 0 12px;">
        <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
          <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; background: rgba(0,255,170,0.06); border: 1px solid rgba(0,255,170,0.12); font-size: 11px; color: hsl(160,100%,60%);">
            🔑 ${describeOnboardingKeyBadge(result.apiKeys.length, providerImportStatus)}
          </span>
          <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; background: rgba(0,255,170,0.06); border: 1px solid rgba(0,255,170,0.12); font-size: 11px; color: hsl(160,100%,60%);">
            🧠 ${result.modelPref === "hybrid" ? "Hybrid lane" : result.modelPref === "local" ? "Local-only lane" : "Cloud lane"}
          </span>
          <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; background: rgba(0,255,170,0.06); border: 1px solid rgba(0,255,170,0.12); font-size: 11px; color: hsl(160,100%,60%);">
            🔐 ${result.permissionMode === "allowed" ? "Broad authority" : "Ask me first"}
          </span>
        </div>
        <div style="max-width: 520px; width: 100%; padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); text-align: left;">
          <p style="font-size: 11px; color: #4a5568; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.08em;">Starting BOSS Brain</p>
          <p style="font-size: 14px; color: #e2e8f0; margin: 0 0 6px;"><strong>${workerLabelFromResult()}</strong></p>
          <p style="font-size: 11px; color: #a0aec0; margin: 0;">${result.modelPref === "commercial" ? "BIOS AI will begin on the strongest cloud route that fits this profile." : "BIOS AI will begin on the local brain you selected and keep the owned managed runtime in charge of that lane."}</p>
        </div>
      </div>
      ${
        providerImportStatus === "saved"
          ? `<p style="font-size: 11px; color: hsl(160,100%,60%); margin: 14px 0 0;">Provider connections are saved and ready.</p>`
          : providerImportStatus === "failed"
            ? providerImportBlocking
              ? `<div style="margin-top: 14px; padding: 10px 12px; border-radius: 10px; background: rgba(245, 101, 101, 0.08); border: 1px solid rgba(245, 101, 101, 0.2); text-align: left;"><strong style="display: block; color: #feb2b2; font-size: 11px; margin-bottom: 4px;">BIOS AI still needs setup attention before this route can start.</strong><span style="font-size: 11px; color: #f7fafc; line-height: 1.5;">${escapeOnboardingHtml(providerImportMessage || "Finish provider setup to continue.")}</span></div>`
              : `<div style="margin-top: 14px; padding: 10px 12px; border-radius: 10px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); text-align: left;"><strong style="display: block; color: #e2e8f0; font-size: 11px; margin-bottom: 4px;">Local BIOS AI is ready. Cloud key import can be revisited later.</strong><span style="font-size: 11px; color: #a0aec0; line-height: 1.5;">${escapeOnboardingHtml(providerImportMessage || "The local BOSS lane is healthy. Open Settings if you want to retry imported cloud keys later.")}</span></div>`
            : providerImportStatus === "skipped"
              ? `<div style="margin-top: 14px; padding: 10px 12px; border-radius: 10px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); text-align: left;"><strong style="display: block; color: #e2e8f0; font-size: 11px; margin-bottom: 4px;">Desktop credential import was skipped here.</strong><span style="font-size: 11px; color: #a0aec0; line-height: 1.5;">${providerImportMessage}</span></div>`
              : ""
      }
    `;
  chatStream.appendChild(welcomeDiv);

  // Focus the chat input and make it prominent
  const chatInput = document.getElementById("chat-input");
  if (chatInput) {
    chatInput.placeholder = `Message ${result.agentName}...`;
    chatInput.focus();
    chatInput.style.transition = "box-shadow 0.3s ease, border-color 0.3s ease";
    chatInput.style.boxShadow = "0 0 0 2px hsl(160,100%,50%,0.3)";
    chatInput.style.borderColor = "hsl(160, 60%, 40%)";
    setTimeout(() => {
      chatInput.style.boxShadow = "";
      chatInput.style.borderColor = "";
    }, 3000);
  }

  // Ensure compose bar is visible
  const composeBar = document.querySelector(".chat-compose");
  if (composeBar) composeBar.scrollIntoView({ behavior: "smooth", block: "end" });
}
