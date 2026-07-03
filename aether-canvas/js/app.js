import { AlignmentConsole } from "./alignment-console.js";
import {
  describeApprovalAction,
  describeBootstrapAction,
  describeChatAction,
  describeForgeArenaAction,
  describeSessionAction,
  describeSettingsProviderAction,
  describeSkillAction,
  describeTelemetryLoad,
  describeWorkflowAction,
} from "./app-action-feedback.js";
import { buildMissionControlSnapshot } from "./bios-mission-control-ui.js";
import {
  buildBiosProfilePickerMetaLines,
  buildBiosProfilePickerSummary,
} from "./bios-profile-ui.js";
import {
  appendBiosDebugLog,
  BIOS_ACTIVE_PROFILE_KEY,
  defaultSafetyPostureSnapshot,
  formatBiosProfileReadiness,
  formatBiosProfileRouteLabel,
  formatBiosRuntimeEngineLabel,
  formatBiosRuntimeOwnerLabel,
  formatBiosRuntimeStrategyLabel,
  formatSavedLocalBackend,
  hasSavedCloudRoute,
  installAllManagedWorkerModelsSafe,
  installManagedWorkerModelSafe,
  LOCAL_RUNTIME_PROVIDERS,
  loadWorkerModelCatalogSafe,
  loadWorkerAssetsStatusSafe,
  MANAGED_LOCAL_RUNTIME_ENGINE,
  MANAGED_LOCAL_RUNTIME_PROVIDER,
  NON_LLM_PROVIDERS,
  recordBiosProofEventSafe,
  savedDirectLocalBackendIsReachable,
  savedOnboardingRouteIsRunnable,
  savedWorkerRouteIsInstalled,
} from "./bios-runtime.js";
import { buildBiosSurfaceSnapshot } from "./bios-surface-ui.js";
import { buildViewportIdleSnapshot } from "./bios-viewport-ui.js";
import { buildBossWorkerRosterAssignments } from "./boss-model-governor.js";
import {
  alignProviderConfigToSavedRoute,
  buildBiosProfileSaveInput,
  buildSavedOnboardingSnapshotFromProfileDetail,
  mergeProviderConfigIntoSavedSnapshot,
} from "./boss-profiles/profile-contract.js";
import {
  renderProfileSettingsSurface,
  syncSavedOnboardingSnapshotSurface,
} from "./boss-profiles/profile-settings.js";
import {
  clearSavedOnboardingSnapshot as clearSavedOnboardingSnapshotStorage,
  getActiveBiosProfileId as getActiveBiosProfileIdFromStorage,
  getSavedOnboardingSnapshot as getSavedOnboardingSnapshotFromStorage,
  saveSavedOnboardingSnapshot as saveSavedOnboardingSnapshotStorage,
} from "./boss-profiles/profile-storage.js";
import { AetherChatRenderer } from "./chat.js";
import { CognitiveSubtitles } from "./cognitive-subtitles.js";
import {
  FORGE_ARCADE_TEMPLATES,
  buildForgeGameSpecFromPrompt,
  createForgeGameCardFromSpec,
  loadForgeArcadeState,
  saveForgeArcadeState,
  summarizeForgeGameSpec,
  validateForgeGameSpec,
} from "./forge-arcade.js";
import { buildForgeArenaHubModel } from "./forge-arena-hub.js";
import { renderArenaRunReviewDetail, renderArenaRunReviewList } from "./forge-arena-review.js";
import { summarizeForgeArenaOvernightLog } from "./forge-arena-run-log.js";
import { ForgeArenaService } from "./forge-arena-service.js";
import { ForgeDrawer } from "./forge-drawer.js";
import { AetherGatewayClient } from "./gateway-client.js";
import { runMajorBossOvernightArenaRun, runMajorBossSystemTest } from "./major-boss-system-test.js";
import { renderMissionOperatorWorkSection } from "./mission-control-render.js";
import {
  applyBiosSoulDecisionContract,
  loadBiosSoulGovernanceContract,
  runBiosBrainstemTick,
} from "./native-contracts/bios-shell-contract.js";
import { describeOnboardingKeyBadge, describeOnboardingTransition } from "./onboarding-flow.js";
import { runConversationalOnboardingController } from "./onboarding/controller.js";
import { BiosStatusOrb } from "./orb.js";
import {
  loadBiosRuntimeStatusSurface,
  loadDebugLogSurface,
  loadOnboardingStateSurface,
  renderBiosRuntimeStatusSurface,
} from "./runtime-status/controller.js";
import { renderStatusOverviewCard } from "./runtime-status/status-overview.js";
import { createBiosRuntimeTransportClient } from "./runtime-transport/client.js";
import { runInitialShellHydrationSequence } from "./shell-app/startup-sequence.js";
import {
  buildModelTelemetry,
  buildModelChoiceGuidance,
  buildLaunchSupportTelemetry,
  buildPromptEconomyTelemetry,
  describeActivitySnapshot as computeActivitySnapshot,
  describeApprovalLaneSnapshot as computeApprovalLaneSnapshot,
  describeModelChoiceGuidance as computeModelChoiceGuidanceSummary,
  describeContinuitySnapshot as computeContinuitySnapshot,
  describeLaunchSupportTelemetry as computeLaunchSupportSummary,
  describeLatestRouteDecision as describeLatestRouteDecisionFromHistory,
  describeLogLaneSnapshot as computeLogLaneSnapshot,
  describeModelTelemetry as computeModelTelemetrySummary,
  describePromptEconomyTelemetry as computePromptEconomySummary,
  describeRecentRouteAdoption as describeRecentRouteAdoptionFromHistory,
  describeShellLaneSnapshot as computeShellLaneSnapshot,
  describeSkillTelemetry as computeSkillTelemetrySummary,
  describeTaskLaneSnapshot as computeTaskLaneSnapshot,
} from "./shell-summary.js";

export class AetherApp {
  constructor() {
    this.agentName = "BIOS AI";
    this.gateway = new AetherGatewayClient();
    this.runtimeTransport = createBiosRuntimeTransportClient({
      gateway: this.gateway,
      getTauriInvoke: () => window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke || null,
    });
    this.orb = new BiosStatusOrb(this);
    this.subtitles = new CognitiveSubtitles();
    this.alignment = new AlignmentConsole(this);
    this.forge = new ForgeDrawer(this);
    this.forgeArena = new ForgeArenaService(this.gateway, {
      getTauriInvoke: () => window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke || null,
    });
    this.chat = new AetherChatRenderer(this);

    this.viewMode = "full"; // 'full' or 'minimized'
    this.autonomousMode = false;
    this.runInProgress = false;
    this.currentRunStatus = "";
    this.pendingBackgroundStatus = "";
    this.liveToolStatuses = new Map();
    this.hudActionState = {
      skills: new Map(),
      checkpoints: new Map(),
    };
    this.forgeArenaActionState = {
      createStatus: "Ready to create a new challenge.",
      featureStatus: "Ready to feature the active run.",
      judgeStatus: "Select a challenge before judging.",
      pairStatus: "Select a challenge and a visible run to pair them.",
      profileStatus: "Forge Arena setup stays profile-bound and can be revised later.",
      localStatus: "Local proving ground is ready when a BIOS profile is active.",
      majorBossStatus: "Major BOSS system test is ready when a route-ready BOSS profile is active.",
      overnightStatus: "Overnight Arena run is ready when a route-ready BOSS profile is active.",
      participationStatus: "Local participation loop is ready.",
      reviewCategory: "breakthrough",
      editingChallengeId: null,
      selectedChallengeId: null,
      selectedEntryPath: "play-tonight",
      challengeFilter: "all",
      selectedRunId: "",
    };
    this.forgeArenaRunLogSummary = summarizeForgeArenaOvernightLog("");
    this.forgeArenaFeed = {
      status: "Local Arena preparing",
      eventBus: "Local feed preparing",
      agentAccess: "Available from Forge Arena",
      currentSeason: {
        title: "Season Zero - Foundry Dawn",
        status: "waiting",
        summary: "Forge Arena season details will appear here when the local Arena is ready.",
        titleLabel: "Foundry Dawn",
        sideTracks: [],
      },
      seasonHistory: [],
      hallOfFame: [],
      items: [
        {
          title: "Forge Arena standby",
          meta: "Local preview",
          detail:
            "Weekly events, agent-rated loops, and leaderboard energy will appear here as Arena runs start.",
        },
      ],
      leaderboard: [],
      standingsHistory: [],
      runs: [],
      sourceSummary: "Forge Arena will show local runs first, then connected Arena data when available.",
      featuredRun: {
        title: "No live run selected",
        status: "Standby",
        summary: "Start or select an Arena run to see activity here.",
        detail: "Waiting for Arena activity",
      },
      executionNote:
        "Forge Arena starts with local proof runs and can expand into connected seasons later.",
    };
    this.forgeArenaProfile = null;
    this.forgeArenaProfileFormSignature = "";
    this.forgeArcadeState = loadForgeArcadeState();
    this.forgeArcadeRuntime = null;
    this.forgeArcadeKeys = new Set();
    this.majorBossSystemTestReport = null;
    this.majorBossOvernightReport = null;

    this.sessions = [];
    this.activeSessionKey = "agent:main:main";
    this.biosProfiles = [];
    this.activeBiosProfileId = null;
    this.pendingNewBiosProfile = false;
    this.profilePickerActive = false;
    this.activeMission = null;
    this.activeContinuity = null;
    this.biosRuntimeStatus = null;
    this.biosShellContract = null;
    this.biosBoxedLane = null;
    this.biosPromotion = null;
    this.biosBrainstem = null;
    this.biosReflex = null;
    this.biosObservation = null;
    this.biosMemoryContract = null;
    this.biosSoulContract = null;
    this.biosSoulGovernance = null;
    this.pendingSoulDecisionId = null;
    this.biosDreamContract = null;
    this.hasCalibratedAgentName = false;
    this.launchSupportTelemetry = null;
    this.modelChoiceGuidance = null;
    this.modelTelemetry = null;
    this.promptEconomyTelemetry = null;
    this.skillTelemetry = null;
    this.routeDecisionHistory = [];
    this.activeShellSurface = "chat";
    this.shellSurfaceMeta = null;
    this.applyShellSurface = null;
    this.sessionActionPending = false;
    this.telemetryLoadState = {
      continuity: "idle",
      memory: "idle",
      tokenEconomy: "idle",
      restartRecovery: "idle",
      browserSandbox: "idle",
      circadian: "idle",
      compaction: "idle",
    };
    this.loadSessionsFromStore();

    this.init();
  }

  async init() {
    await appendBiosDebugLog("app.init.start", { agentName: this.agentName });
    this.bindDomEvents();
    this.setupGatewayListeners();

    const overlay = document.getElementById("connect-overlay");
    const connectStatus = document.getElementById("connect-status");

    if (connectStatus) {
      connectStatus.innerText = describeBootstrapAction("start", { agentName: this.agentName });
    }

    // ── Defensive offline handler ─────────────────────────
    // This timer fires regardless of whether the WebSocket error event fires.
    // In some WebView contexts (Tauri/WebView2), onerror may never trigger
    // for connection refused, so we CANNOT rely on the catch block alone.
    this._offlineTimer = setTimeout(async () => {
      if (this.gateway?.isConnected) return; // Connected in time — nothing to do.

      // Dismiss the overlay
      this.setConnectOverlayMessage(
        describeBootstrapAction("offline-local", { agentName: this.agentName }),
      );
      if (overlay && !overlay.classList.contains("hidden")) {
        overlay.classList.add("hidden");
      }

      let shouldShowProfilePicker = false;

      // Native BIOS profiles are the only authority for a ready shell.
      try {
        const profiles = await this.loadBiosProfiles();
        if (profiles.length > 0) {
          shouldShowProfilePicker = true;
          this.hasCalibratedAgentName = false;
          void appendBiosDebugLog("bootstrap.offline.profile_picker_ready", {
            profileCount: profiles.length,
            activeProfileId: this.activeBiosProfileId,
          });
        } else {
          this.activeBiosProfileId = null;
          this.clearSavedOnboardingSnapshot(this.getActiveBiosProfileId());
          this.hasCalibratedAgentName = false;
          this.agentName = "BIOS AI";
          this.updateAgentNameDOM();
          void appendBiosDebugLog("bootstrap.offline.block_legacy_ready_shell", {
            reason: "no_native_bios_profiles",
          });
        }
      } catch {
        /* localStorage not available */
      }

      // Launch conversational onboarding if first-time user
      if (shouldShowProfilePicker) {
        setTimeout(() => this.showProfilePicker(), 300);
      } else if (!this.hasCalibratedAgentName) {
        void appendBiosDebugLog("bootstrap.offline.show_onboarding", {
          reason: "no_saved_completed_onboarding",
        });
        setTimeout(() => this.showOfflineWelcome(), 300);
      }

      // Start silent background reconnection
      this.showConnectionStatusBar(
        describeBootstrapAction("reconnect-pending", { agentName: this.agentName }),
        "warning",
      );
      this.scheduleBackgroundReconnect();
    }, 2000);

    // ── Attempt gateway connection ─────────────────────────
    // This may resolve, reject, or hang indefinitely.
    // The timer above handles the hang case.
    try {
      await this.gateway.connect();
      await appendBiosDebugLog("gateway.connect.success", { mode: "startup" });
      // Connected successfully — cancel offline timer
      clearTimeout(this._offlineTimer);
      if (overlay) overlay.classList.add("hidden");
    } catch (err) {
      // WebSocket error fired — the timer will still handle the UI.
      console.warn("[AetherApp] Gateway not available:", err?.message || err);
      await appendBiosDebugLog("gateway.connect.error", {
        mode: "startup",
        detail: err?.message || String(err),
      });
    }
  }

  /** Silently retry gateway connection every 10s without blocking the UI. */
  scheduleBackgroundReconnect() {
    if (this._reconnectTimer) return;
    this._reconnectTimer = setInterval(async () => {
      try {
        this.showConnectionStatusBar(
          describeBootstrapAction("reconnect-pending", { agentName: this.agentName }),
          "warning",
        );
        await this.gateway.connect();
        // Success — stop retrying
        clearInterval(this._reconnectTimer);
        this._reconnectTimer = null;
        this.showConnectionStatusBar(
          describeBootstrapAction("reconnect-success", { agentName: this.agentName }),
          "success",
        );
        setTimeout(() => this.hideConnectionStatusBar(), 2500);
        console.log("[AetherApp] Gateway reconnected in background.");
      } catch (err) {
        // Still offline — keep retrying silently
        const reconnectDetail =
          typeof err?.message === "string" && err.message.trim() && err.message !== "[object Event]"
            ? err.message
            : "";
        this.showConnectionStatusBar(
          describeBootstrapAction("reconnect-error", {
            agentName: this.agentName,
            detail: reconnectDetail,
          }),
          "warning",
        );
      }
    }, 10000);
  }

  bindDomEvents() {
    const btnMin = document.getElementById("btn-minimize");
    const btnMax = document.getElementById("btn-maximize");
    const btnClose = document.getElementById("btn-close");
    const btnTitleToggle = document.getElementById("btn-title-toggle-auto");
    const btnMinToggle = document.getElementById("btn-toggle-auto");
    const btnRestore = document.getElementById("btn-restore");
    const btnCreateSession = document.getElementById("btn-create-session");
    const btnSend = document.getElementById("btn-send");
    const btnLogRefresh = document.getElementById("btn-log-refresh");
    const btnLogClear = document.getElementById("btn-log-clear");
    const chatInput = document.getElementById("chat-input");

    if (btnMin) {
      btnMin.addEventListener("click", () => {
        if (window.electronAPI) window.electronAPI.minimizeWindow();
      });
    }
    if (btnMax) {
      btnMax.addEventListener("click", () => {
        if (window.electronAPI) window.electronAPI.maximizeWindow();
      });
    }
    if (btnClose) {
      btnClose.addEventListener("click", () => {
        if (window.electronAPI) window.electronAPI.closeWindow();
      });
    }

    // Chat input and send button are handled by AetherChatRenderer (chat.js).
    // Only sync the textarea auto-resize here for initial state.
    if (chatInput) {
      const syncHeight = () => {
        chatInput.style.height = "auto";
        chatInput.style.height = `${Math.min(chatInput.scrollHeight, 240)}px`;
      };
      chatInput.addEventListener("input", syncHeight);
    }

    if (btnRestore) {
      btnRestore.addEventListener("click", () => this.setViewMode("full"));
    }

    if (btnCreateSession) {
      btnCreateSession.addEventListener("click", () => this.createSession());
    }
    if (btnLogRefresh) {
      btnLogRefresh.addEventListener("click", () => {
        void this.loadDebugLog();
        void this.loadBiosRuntimeStatus();
      });
    }
    if (btnLogClear) {
      btnLogClear.addEventListener("click", () => void this.clearDebugLog());
    }

    const toggleAutonomous = () => {
      this.autonomousMode = !this.autonomousMode;
      this.orb.setAutonomousMode(this.autonomousMode);

      this.gateway
        .request("chat.configure", {
          sessionKey: this.activeSessionKey,
          options: { autonomous: this.autonomousMode },
        })
        .catch((err) => console.error("Failed to configure autonomous state on core:", err));

      const label = this.autonomousMode ? "Autonomous: ON" : "Autonomous: OFF";
      if (btnTitleToggle) {
        btnTitleToggle.innerText = label;
        btnTitleToggle.style.color = this.autonomousMode ? "var(--warning)" : "var(--text-muted)";
        btnTitleToggle.style.borderColor = this.autonomousMode
          ? "var(--warning-glow)"
          : "rgba(255,255,255,0.06)";
      }
      if (btnMinToggle) {
        btnMinToggle.innerText = label;
        btnMinToggle.style.color = this.autonomousMode ? "var(--warning)" : "var(--text-muted)";
        btnMinToggle.style.borderColor = this.autonomousMode
          ? "var(--warning-glow)"
          : "rgba(255,255,255,0.06)";
      }

      this.renderContinuityShellSurface();
    };

    if (btnTitleToggle) btnTitleToggle.addEventListener("click", toggleAutonomous);
    if (btnMinToggle) btnMinToggle.addEventListener("click", toggleAutonomous);

    this.setupBiosShellSeed();
    this.setupForgeArenaActions();
    this.setupForgeArcadeActions();
    this.setupWorkflowActions();
    this.setupPipDraggable();
    this.syncSavedOnboardingSnapshot();
  }

  setupWorkflowActions() {
    const configureWorkflowCard = (cardId, options) => {
      const card = document.getElementById(cardId);
      if (!card) return;

      let statusNode = card.querySelector(".workflow-card-status");
      if (!statusNode) {
        statusNode = document.createElement("p");
        statusNode.className = "workflow-card-status";
        statusNode.style.cssText =
          "font-size: 11px; color: #6b7280; line-height: 1.5; margin: 10px 0 0;";
        card.appendChild(statusNode);
      }

      const button = card.querySelector(".workflow-run-btn");
      const badge = card.querySelector(".badge");

      const applyState = ({ badgeText, buttonText, disabled, statusText }) => {
        if (badge && badgeText) badge.innerText = badgeText;
        if (button && buttonText) button.innerText = buttonText;
        if (button) {
          if (disabled) {
            button.setAttribute("disabled", "disabled");
          } else {
            button.removeAttribute("disabled");
          }
        }
        if (statusNode && statusText) statusNode.innerText = statusText;
      };

      applyState({
        badgeText: options.initialBadge,
        buttonText: options.idleButtonText,
        disabled: false,
        statusText: describeWorkflowAction(options.readyAction),
      });

      if (!button) return;
      button.addEventListener("click", async () => {
        applyState({
          badgeText: options.pendingBadge,
          buttonText: options.pendingButtonText,
          disabled: true,
          statusText: describeWorkflowAction(options.pendingAction, { title: options.title }),
        });

        try {
          const result = await options.run();
          if (
            options.successAction === "discovery-success" &&
            result &&
            typeof result === "object"
          ) {
            applyState({
              badgeText: options.successBadge,
              buttonText: options.idleButtonText,
              disabled: false,
              statusText: describeWorkflowAction(options.successAction, result),
            });
            return;
          }

          const ok = result !== false;
          applyState({
            badgeText: ok ? options.successBadge : options.errorBadge,
            buttonText: options.idleButtonText,
            disabled: false,
            statusText: describeWorkflowAction(ok ? options.successAction : options.errorAction, {
              title: options.title,
              detail: ok ? "" : `${options.title} could not be queued right now.`,
            }),
          });
        } catch (err) {
          applyState({
            badgeText: options.errorBadge,
            buttonText: options.idleButtonText,
            disabled: false,
            statusText: describeWorkflowAction(options.errorAction, {
              title: options.title,
              detail: err?.message || String(err),
            }),
          });
        }
      });
    };

    configureWorkflowCard("wf-deploy-pipeline", {
      title: "Deploy Pipeline",
      initialBadge: "Ready",
      pendingBadge: "Queued",
      successBadge: "Queued",
      errorBadge: "Retry",
      idleButtonText: "Run",
      pendingButtonText: "Queuing...",
      readyAction: "deploy-ready",
      pendingAction: "deploy-pending",
      successAction: "deploy-success",
      errorAction: "deploy-error",
      run: async () => {
        if (typeof this.applyShellSurface === "function") this.applyShellSurface("tasks");
        return await this.sendChatMessage(
          "Run the Deploy Pipeline workflow now: build, test, stop at approvals, then prepare deploy execution with explicit evidence.",
        );
      },
    });

    configureWorkflowCard("wf-nightly-cleanup", {
      title: "Nightly Cleanup",
      initialBadge: "Scheduled",
      pendingBadge: "Queued",
      successBadge: "Queued",
      errorBadge: "Retry",
      idleButtonText: "Run Now",
      pendingButtonText: "Queuing...",
      readyAction: "cleanup-ready",
      pendingAction: "cleanup-pending",
      successAction: "cleanup-success",
      errorAction: "cleanup-error",
      run: async () => {
        if (typeof this.applyShellSurface === "function") this.applyShellSurface("status");
        return await this.sendChatMessage(
          "Run the Nightly Cleanup workflow now: glymphatic cleanup, stale session pruning, and memory compaction with visible evidence.",
        );
      },
    });

    configureWorkflowCard("wf-first-run-discovery", {
      title: "First-Run Discovery",
      initialBadge: "On Boot",
      pendingBadge: "Scanning",
      successBadge: "Scanned",
      errorBadge: "Retry",
      idleButtonText: "Re-scan",
      pendingButtonText: "Scanning...",
      readyAction: "discovery-ready",
      pendingAction: "discovery-pending",
      successAction: "discovery-success",
      errorAction: "discovery-error",
      run: async () => {
        let discovery = null;
        if (window.__TAURI__?.core?.invoke) {
          discovery = await window.__TAURI__.core.invoke("system_discovery");
        } else if (window.__TAURI__?.invoke) {
          discovery = await window.__TAURI__.invoke("system_discovery");
        } else {
          throw new Error("Desktop discovery is unavailable in this surface.");
        }
        return {
          keyCount: discovery?.api_keys?.length || 0,
          modelCount: discovery?.local_models?.length || 0,
          toolCount: discovery?.ai_tools?.length || 0,
          agentFound: Boolean(discovery?.agent_identity?.name),
        };
      },
    });
  }

  setupBiosShellSeed() {
    const allRailBtns = Array.from(document.querySelectorAll(".rail-btn[data-surface]"));
    const allSurfaces = Array.from(document.querySelectorAll(".ctx-surface[data-surface]"));
    const pageGroups = Array.from(document.querySelectorAll(".rail-page-group[data-page]"));
    const pageSwitchBtns = Array.from(
      document.querySelectorAll(".rail-page-switch[data-page-target]"),
    );

    const applySurface = (surface) => {
      this.activeShellSurface = surface;
      const root = document.getElementById("aether-root");
      if (root) {
        root.dataset.activeSurface = surface;
      }
      // Only toggle active on buttons within the current page group
      const activePage = this.activePage || "home";
      const activeGroup = document.querySelector(`.rail-page-group[data-page="${activePage}"]`);
      const groupBtns = activeGroup
        ? Array.from(activeGroup.querySelectorAll(".rail-btn[data-surface]"))
        : allRailBtns;
      groupBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.surface === surface));
      allSurfaces.forEach((s) => s.classList.toggle("active", s.dataset.surface === surface));
      if (surface === "log") {
        void this.loadDebugLog();
      }
      if (surface === "status" || surface === "settings") {
        void this.loadBiosRuntimeStatus();
      }
      if (surface === "settings") {
        this.renderProfileSettings();
      }
    };

    this.applyShellSurface = applySurface;

    // Surface icon clicks
    allRailBtns.forEach((btn) => {
      btn.addEventListener("click", () => applySurface(btn.dataset.surface));
    });

    // Page switch clicks (FA ↔ Home)
    pageSwitchBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.pageTarget;
        this.switchPage(target);
      });
    });

    this.activePage = "home";
    applySurface("chat");
  }

  switchPage(page) {
    const root = document.getElementById("aether-root");
    const pageGroups = Array.from(document.querySelectorAll(".rail-page-group[data-page]"));
    const forgePage = document.getElementById("forge-page");

    this.activePage = page;

    // Toggle rail icon groups
    pageGroups.forEach((g) => {
      g.classList.toggle("hidden", g.dataset.page !== page);
    });

    // Set the data-active-page for CSS theme switching
    if (root) root.dataset.activePage = page === "forge" ? "forge" : "bios";
    if (forgePage) forgePage.classList.toggle("hidden", page !== "forge");

    // Switch to the default surface for the new page
    if (page === "forge") {
      this.applyShellSurface("fa-feed");
    } else {
      this.applyShellSurface("chat");
    }
  }

  formatContinuityLabel(value) {
    return String(value || "unknown").replace(/_/g, " ");
  }

  describeSkillTelemetry() {
    return computeSkillTelemetrySummary(this.skillTelemetry, this.routeDecisionHistory);
  }

  describeModelTelemetry() {
    return computeModelTelemetrySummary(this.modelTelemetry);
  }

  describeModelChoiceGuidance() {
    return computeModelChoiceGuidanceSummary(this.modelChoiceGuidance);
  }

  describeLaunchSupportTelemetry() {
    return computeLaunchSupportSummary(this.launchSupportTelemetry);
  }

  describePromptEconomyTelemetry() {
    return computePromptEconomySummary(this.promptEconomyTelemetry);
  }

  describeShellLaneSnapshot() {
    return computeShellLaneSnapshot({
      gatewayConnected: this.gateway?.isConnected === true,
      agentName: this.agentName,
      hasCalibratedAgentName: this.hasCalibratedAgentName,
      autonomousMode: this.autonomousMode,
      modelTelemetry: this.modelTelemetry,
      launchSupportTelemetry: this.launchSupportTelemetry,
    });
  }

  describeRecentRouteAdoption() {
    return describeRecentRouteAdoptionFromHistory(this.routeDecisionHistory);
  }

  describeTaskLaneSnapshot() {
    return computeTaskLaneSnapshot(this.activeMission);
  }

  describeActivitySnapshot() {
    return computeActivitySnapshot({
      activeMission: this.activeMission,
      runInProgress: this.runInProgress,
      currentRunStatus: this.currentRunStatus,
      pendingBackgroundStatus: this.pendingBackgroundStatus,
      liveToolStatuses: this.liveToolStatuses?.values?.() || [],
    });
  }

  describeApprovalLaneSnapshot() {
    return computeApprovalLaneSnapshot({
      activeMission: this.activeMission,
      activeContinuity: this.activeContinuity,
    });
  }

  describeLogLaneSnapshot() {
    return computeLogLaneSnapshot({
      activeMission: this.activeMission,
      routeDecisionHistory: this.routeDecisionHistory,
    });
  }

  describeLatestRouteDecision() {
    return describeLatestRouteDecisionFromHistory(this.routeDecisionHistory);
  }

  recordRouteDecision(taskDescription, decision) {
    if (!decision) {
      return;
    }

    const topLocalEvidencePath = Array.isArray(decision.localEvidencePaths)
      ? decision.localEvidencePaths[0]
      : "";
    const topLocalEvidenceFile = topLocalEvidencePath
      ? topLocalEvidencePath.split(/[\\/]/).filter(Boolean).pop()
      : "";

    const summary =
      decision.system === 1 && decision.promotedTool?.toolName
        ? `SYSTEM 1 -> tool ${decision.promotedTool.toolName}`
        : decision.system === 1 && decision.hardenedSkill?.id
          ? `SYSTEM 1 -> ${decision.hardenedSkill.id}`
          : decision.gapReason === "candidate_needs_validation" && decision.candidateSkill?.id
            ? `SYSTEM 2 -> validate ${decision.candidateSkill.id}`
            : decision.gapReason === "local_evidence_available"
              ? `SYSTEM 2 -> local evidence${topLocalEvidenceFile ? ` ${topLocalEvidenceFile}` : ""}`
              : `SYSTEM 2 -> ${decision.gapReason || "no_local_match"}`;

    this.routeDecisionHistory = [
      {
        summary,
        taskLabel: this.shortenStatus(taskDescription, 36) || "recent task",
        system: decision.system,
        usedPromotedTool: Boolean(decision.promotedTool?.toolName),
        timestamp: Date.now(),
      },
      ...this.routeDecisionHistory,
    ].slice(0, 5);
  }

  describeContinuitySnapshot() {
    return computeContinuitySnapshot({
      activeMission: this.activeMission,
      activeContinuity: this.activeContinuity,
      gatewayConnected: this.gateway?.isConnected === true,
      skillTelemetry: this.skillTelemetry,
      modelTelemetry: this.modelTelemetry,
      routeDecisionHistory: this.routeDecisionHistory,
    });
  }

  syncShellSurfaceCard(surface, snapshot) {
    // No-op: the new minimal UI does not have switch cards.
    // Individual surfaces update their own content directly.
  }

  renderContinuityShellSurface() {
    const summary = this.describeContinuitySnapshot();
    this.renderActivityLabels();

    // Update activity label in task header
    // Render task checklist
    this.renderTaskChecklist();

    // Update viewport status
    this.renderViewportStatus();
    this.syncShellSurfaceCard("shell", this.describeShellLaneSnapshot());
    this.syncShellSurfaceCard("tasks", this.describeTaskLaneSnapshot());
    this.syncShellSurfaceCard("approvals", this.describeApprovalLaneSnapshot());
    this.syncShellSurfaceCard("memory", {
      state: summary.memoryState,
      chatState: summary.memoryChatState,
      tag: summary.memoryTag,
      copy: summary.memoryCopy,
    });
    this.syncShellSurfaceCard("status", {
      state: summary.statusState,
      chatState: summary.statusChatState,
      tag: summary.statusTag,
      copy: summary.statusCopy,
    });
    this.syncShellSurfaceCard("log", this.describeLogLaneSnapshot());

    if (typeof this.applyShellSurface === "function") {
      this.applyShellSurface(this.activeShellSurface || "chat");
    }
  }

  applyTopLevelPage(page) {
    this.switchPage(page === "forge" ? "forge" : "home");
  }

  async refreshForgeArenaFeed({ connected }) {
    await this.refreshForgeArenaRunLogSummary();
    if (!connected) {
      try {
        this.forgeArenaFeed = await this.forgeArena.getLocalSnapshot({
          profileId: this.activeBiosProfileId,
        });
        this.renderForgeArenaFeed();
        return;
      } catch {
        // Fall through to the local preview state when native local Arena is unavailable.
      }
      this.forgeArenaFeed = {
        status: "Local Arena preparing",
        eventBus: "Local feed preparing",
        agentAccess: "Available from Forge Arena",
        currentSeason: {
          title: "Season Zero - Foundry Dawn",
          status: "waiting",
          summary: "Arena season details will appear here when the local Arena is ready.",
          titleLabel: "Foundry Dawn",
          sideTracks: [],
        },
        seasonHistory: [],
        hallOfFame: [],
        items: [
          {
            title: "Forge Arena preview",
            meta: "Local preview",
            detail:
              "Local challenge details appear here first. Connected Arena updates can join later.",
          },
        ],
        leaderboard: [],
        standingsHistory: [],
        runs: [],
        sourceSummary:
          "Forge Arena stays a first-class page even before the full arena service comes online.",
        featuredRun: {
          title: "No live run selected",
          status: "Standby",
          summary: "Start or select an Arena run to see activity here.",
          detail: "Waiting for Arena activity",
        },
        executionNote:
          "Forge Arena stays a first-class page even before the full arena service comes online.",
      };
      this.renderForgeArenaFeed();
      return;
    }

    try {
      this.forgeArenaFeed = await this.forgeArena.getSnapshot({
        activeSessionKey: this.activeSessionKey,
        profileId: this.activeBiosProfileId,
      });
    } catch (err) {
      console.error("[AetherApp] Failed to hydrate Forge Arena feed:", err);
      this.forgeArenaFeed = {
        status: "Online services connected",
        eventBus: "Arena refresh needed",
        agentAccess: "Available from Forge Arena",
        currentSeason: {
          title: "Season Zero - Foundry Dawn",
          status: "retrying",
          summary: "Arena details are refreshing before official season results appear.",
          titleLabel: "Foundry Dawn",
          sideTracks: [],
        },
        seasonHistory: [],
        hallOfFame: [],
        items: [
          {
            title: "Arena feed retry needed",
            meta: "Refresh needed",
            detail:
              "Arena activity could not refresh this cycle. Forge Arena will try again on the next refresh.",
          },
        ],
        leaderboard: [],
        standingsHistory: [],
        runs: [],
        sourceSummary:
          "Online services are available, but Forge Arena needs another refresh.",
        featuredRun: {
          title: "Arena sync pending",
          status: "Retrying",
          summary: "Forge Arena could not refresh live activity this cycle.",
          detail: err?.message || "Unknown Arena refresh error",
        },
        executionNote:
          "Forge Arena will keep local proof runs visible while connected activity refreshes.",
      };
    }

    this.renderForgeArenaFeed();
  }

  renderForgeArenaFeed() {
    const statusNode = document.getElementById("forge-arena-status");
    const eventBusNode = document.getElementById("forge-arena-event-bus");
    const accessNode = document.getElementById("forge-arena-agent-access");
    const executionNoteNode = document.getElementById("forge-arena-execution-note");
    const heroStatusNode = document.getElementById("forge-arena-hero-status");
    const profileShellStatusNode = document.getElementById("forge-arena-profile-shell-status");
    const profileSummaryTitleNode = document.getElementById("forge-arena-profile-summary-title");
    const profileSummaryCopyNode = document.getElementById("forge-arena-profile-summary-copy");
    const profilePublicNameNode = document.getElementById("forge-arena-profile-public-name");
    const profileBossNameNode = document.getElementById("forge-arena-profile-boss-name");
    const profileModeNode = document.getElementById("forge-arena-profile-mode");
    const profileRankNode = document.getElementById("forge-arena-profile-rank");
    const profileClassNode = document.getElementById("forge-arena-profile-class");
    const profileTaglineNode = document.getElementById("forge-arena-profile-tagline");
    const profileNarrativeNode = document.getElementById("forge-arena-profile-narrative");
    const profileEntryRoleNode = document.getElementById("forge-arena-profile-entry-role");
    const profileFirstPathNode = document.getElementById("forge-arena-profile-first-path");
    const profileBadgeListNode = document.getElementById("forge-arena-profile-badge-list");
    const profileReadinessNode = document.getElementById("forge-arena-profile-readiness");
    const profileFeatureTitleNode = document.getElementById("forge-arena-profile-feature-title");
    const profileFeatureSummaryNode = document.getElementById(
      "forge-arena-profile-feature-summary",
    );
    const profileReputationNode = document.getElementById("forge-arena-profile-reputation");
    const profileCapabilitySummaryNode = document.getElementById(
      "forge-arena-profile-capability-summary",
    );
    const profileHistorySummaryNode = document.getElementById(
      "forge-arena-profile-history-summary",
    );
    const connectedIdentityIdNode = document.getElementById("forge-arena-connected-identity-id");
    const connectedBackendStatusNode = document.getElementById(
      "forge-arena-connected-backend-status",
    );
    const publicVisibilityNode = document.getElementById("forge-arena-public-visibility");
    const publicScopeNode = document.getElementById("forge-arena-public-scope");
    const privateBoundaryNode = document.getElementById("forge-arena-private-boundary");
    const profileFeedbackNode = document.getElementById("forge-arena-profile-feedback");
    const profilePublicInput = document.getElementById("forge-arena-profile-public-input");
    const profileBossInput = document.getElementById("forge-arena-profile-boss-input");
    const profileModeInput = document.getElementById("forge-arena-profile-mode-select");
    const profileRoleInput = document.getElementById("forge-arena-profile-role-select");
    const profilePathInput = document.getElementById("forge-arena-profile-path-select");
    const profileTaglineInput = document.getElementById("forge-arena-profile-tagline-input");
    const entryPathsNode = document.getElementById("forge-arena-entry-paths");
    const returnTitleNode = document.getElementById("forge-arena-return-title");
    const returnCopyNode = document.getElementById("forge-arena-return-copy");
    const returnTraceNode = document.getElementById("forge-arena-return-trace");
    const returnNextNode = document.getElementById("forge-arena-return-next");
    const listNode = document.getElementById("forge-arena-live-list");
    const sourceSummaryNode = document.getElementById("forge-arena-source-summary");
    const featuredTitleNode = document.getElementById("forge-arena-featured-title");
    const featuredStatusNode = document.getElementById("forge-arena-featured-status");
    const featuredSummaryNode = document.getElementById("forge-arena-featured-summary");
    const featuredDetailNode = document.getElementById("forge-arena-featured-detail");
    const seasonTitleNode = document.getElementById("forge-arena-season-title");
    const seasonStatusNode = document.getElementById("forge-arena-season-status");
    const seasonSummaryNode = document.getElementById("forge-arena-season-summary");
    const seasonTracksNode = document.getElementById("forge-arena-season-tracks");
    const leaderTitleNode = document.getElementById("forge-arena-leader-title");
    const standingsSummaryNode = document.getElementById("forge-arena-standings-history-summary");
    const leaderboardNode = document.getElementById("forge-arena-leaderboard");
    const historyNode = document.getElementById("forge-arena-standings-history");
    const hallOfFameNode = document.getElementById("forge-arena-hall-of-fame");
    const railNode = document.getElementById("forge-arena-challenges-rail");
    const challengeStandingsSummaryNode = document.getElementById(
      "forge-arena-challenge-standings-summary",
    );
    const challengeStandingsNode = document.getElementById("forge-arena-challenge-standings");
    const runReviewNode = document.getElementById("forge-arena-run-review-list");
    const runReviewDetailSummaryNode = document.getElementById(
      "forge-arena-run-review-detail-summary",
    );
    const runReviewDetailNode = document.getElementById("forge-arena-run-review-detail");
    const challengesNode = document.getElementById("forge-arena-challenges");
    const challengeHistoryNode = document.getElementById("forge-arena-challenge-history");
    const activeRunContextNode = document.getElementById("forge-arena-active-run-context");
    const workshopTitleNode = document.getElementById("forge-arena-workshop-title");
    const workshopSummaryNode = document.getElementById("forge-arena-workshop-summary");
    const workshopProgressLabelNode = document.getElementById(
      "forge-arena-workshop-progress-label",
    );
    const workshopProgressBarNode = document.getElementById("forge-arena-workshop-progress-bar");
    const builderRowNode = document.getElementById("forge-arena-builder-row");
    const agentRowNode = document.getElementById("forge-arena-agent-row");
    const activeZonesNode = document.getElementById("forge-arena-active-zones");
    const createFeedbackNode = document.getElementById("forge-arena-create-feedback");
    const featureFeedbackNode = document.getElementById("forge-arena-feature-action-status");
    const localProofStatusNode = document.getElementById("forge-arena-local-proof-status");
    const majorBossStatusNode = document.getElementById("forge-arena-major-boss-status");
    const overnightBossStatusNode = document.getElementById("forge-arena-overnight-boss-status");
    const runMonitorStateNode = document.getElementById("forge-arena-run-monitor-state");
    const runMonitorProgressNode = document.getElementById("forge-arena-run-monitor-progress");
    const runMonitorBarNode = document.getElementById("forge-arena-run-monitor-bar");
    const runMonitorDetailNode = document.getElementById("forge-arena-run-monitor-detail");
    const runMonitorHashNode = document.getElementById("forge-arena-run-monitor-hash");
    const localParticipationStatusNode = document.getElementById(
      "forge-arena-local-participation-status",
    );
    const pairRunSelectNode = document.getElementById("forge-arena-pair-run-select");
    const selectedChallengeStatusNode = document.getElementById(
      "forge-arena-selected-challenge-status",
    );
    const selectedChallengeCopyNode = document.getElementById(
      "forge-arena-selected-challenge-copy",
    );
    const judgeFeedbackNode = document.getElementById("forge-arena-judge-feedback");
    const editorModeNode = document.getElementById("forge-arena-editor-mode");
    const submitLabelNode = document.getElementById("forge-arena-create-submit-label");
    const cancelEditButton = document.getElementById("forge-arena-cancel-edit");
    const runsForWorkshop = Array.isArray(this.forgeArenaFeed.runs) ? this.forgeArenaFeed.runs : [];
    const challengesForRail = Array.isArray(this.forgeArenaFeed.challenges)
      ? this.forgeArenaFeed.challenges
      : [];
    const currentFeaturedRun = this.forgeArenaFeed.featuredRun || {};
    const activeProfileSummary =
      this.biosProfiles?.find((profile) => profile.id === this.activeBiosProfileId) || null;
    const currentArenaProfile =
      this.forgeArenaProfile?.bios_profile_id === this.activeBiosProfileId
        ? this.forgeArenaProfile
        : null;
    const arenaIdentityModel = buildForgeArenaHubModel({
      forgeArenaFeed: this.forgeArenaFeed,
      forgeArcadeState: this.forgeArcadeState,
      profile: currentArenaProfile || this.forgeArenaProfile,
      agentName: this.agentName,
    });
    const arenaIdentityCards = Array.isArray(arenaIdentityModel.playerCards)
      ? arenaIdentityModel.playerCards
      : [];

    const makeInitials = (value, fallback = "FA") => {
      const text = String(value || "").trim();
      if (!text) return fallback;
      const tokens = text
        .split(/[\s:/_-]+/)
        .map((part) => part.trim())
        .filter(Boolean);
      if (!tokens.length) return fallback;
      return tokens
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
    };
    const matchArenaIdentityCard = (label = "") => {
      const text = String(label || "").toLowerCase();
      return (
        arenaIdentityCards.find((card) => text.includes(String(card.name || "").toLowerCase())) ||
        arenaIdentityCards.find((card) => card.type === "official-bot" && text.includes(card.id)) ||
        (text.includes("babs") || text.includes("b.a.b.s")
          ? arenaIdentityCards.find((card) => card.type === "arena-boss")
          : null) ||
        (text.includes("boss")
          ? arenaIdentityCards.find((card) => card.type === "boss")
          : null) ||
        arenaIdentityCards.find((card) => card.type === "user") ||
        null
      );
    };
    const appendArenaIdentityChip = (container, card, fallbackLabel = "Arena Player") => {
      const identity = document.createElement("div");
      identity.className = "forge-list-identity";
      const avatar = document.createElement("span");
      avatar.className = "forge-list-avatar";
      if (card?.avatarAsset) {
        avatar.style.setProperty("--forge-list-avatar", `url("../${card.avatarAsset}")`);
      }
      avatar.innerText = card?.avatarAsset ? "" : makeInitials(card?.name || fallbackLabel, "FA");
      const body = document.createElement("span");
      const name = document.createElement("strong");
      name.innerText = card?.name || fallbackLabel;
      const meta = document.createElement("em");
      meta.innerText = card
        ? `${card.rank} - Lv ${card.level} - ${card.arenaClass}`
        : "Unranked - Lv 1 - Arena";
      body.appendChild(name);
      body.appendChild(meta);
      identity.appendChild(avatar);
      identity.appendChild(body);
      container.appendChild(identity);
    };

    if (statusNode) statusNode.innerText = this.forgeArenaFeed.status;
    if (eventBusNode) eventBusNode.innerText = this.forgeArenaFeed.eventBus;
    if (accessNode) accessNode.innerText = this.forgeArenaFeed.agentAccess;
    if (executionNoteNode) executionNoteNode.innerText = this.forgeArenaFeed.executionNote;
    if (heroStatusNode) {
      heroStatusNode.innerText = currentFeaturedRun.status
        ? `Featured run · ${currentFeaturedRun.status}`
        : this.forgeArenaFeed.status;
    }
    if (sourceSummaryNode) sourceSummaryNode.innerText = this.forgeArenaFeed.sourceSummary || "";
    if (featuredTitleNode)
      featuredTitleNode.innerText =
        this.forgeArenaFeed.featuredRun?.title || "No live run selected";
    if (featuredStatusNode)
      featuredStatusNode.innerText = this.forgeArenaFeed.featuredRun?.status || "Standby";
    if (featuredSummaryNode)
      featuredSummaryNode.innerText = this.forgeArenaFeed.featuredRun?.summary || "";
    if (featuredDetailNode)
      featuredDetailNode.innerText = this.forgeArenaFeed.featuredRun?.detail || "";
    if (seasonTitleNode) {
      seasonTitleNode.innerText = this.forgeArenaFeed.currentSeason?.title || "Season Zero";
    }
    if (seasonStatusNode) {
      seasonStatusNode.innerText = String(
        this.forgeArenaFeed.currentSeason?.status || "waiting",
      ).replace(/-/g, " ");
    }
    if (seasonSummaryNode) {
      seasonSummaryNode.innerText =
        this.forgeArenaFeed.currentSeason?.summary ||
        "Official season truth will render here once Forge Arena hydrates.";
    }
    if (seasonTracksNode) {
      seasonTracksNode.innerHTML = "";
      const tracks = Array.isArray(this.forgeArenaFeed.currentSeason?.sideTracks)
        ? this.forgeArenaFeed.currentSeason.sideTracks
        : [];
      if (!tracks.length) {
        const chip = document.createElement("span");
        chip.className = "forge-hero-chip";
        chip.innerText = "Tracks loading";
        seasonTracksNode.appendChild(chip);
      } else {
        tracks.slice(0, 4).forEach((track) => {
          const chip = document.createElement("span");
          chip.className = "forge-hero-chip";
          chip.innerText = track.title || "Arena track";
          seasonTracksNode.appendChild(chip);
        });
      }
    }
    if (leaderTitleNode) {
      leaderTitleNode.innerText = this.forgeArenaFeed.leaderboard?.[0]?.label || "Legends Rise";
    }
    if (standingsSummaryNode) {
      standingsSummaryNode.innerText =
        this.forgeArenaFeed.standingsHistory?.[0]?.summary ||
        currentFeaturedRun.summary ||
        "Standings history and leader movement will appear here.";
    }
    if (activeRunContextNode) {
      activeRunContextNode.innerText = this.activeSessionKey
        ? `Active BIOS AI session: ${this.activeSessionKey}`
        : "No active BIOS AI session selected.";
    }
    if (createFeedbackNode) createFeedbackNode.innerText = this.forgeArenaActionState.createStatus;
    if (featureFeedbackNode)
      featureFeedbackNode.innerText = this.forgeArenaActionState.featureStatus;
    if (localProofStatusNode)
      localProofStatusNode.innerText = this.forgeArenaActionState.localStatus || "";
    if (majorBossStatusNode) {
      const report = this.majorBossSystemTestReport;
      const reportSummary = report
        ? ` Last run ${report.run_id}: ${report.status}; ${report.scenario_count} scenario(s), ${report.final_measurement_history_count} measurement(s), runtime ${report.runtime_mode}.`
        : "";
      majorBossStatusNode.innerText = `${this.forgeArenaActionState.majorBossStatus || ""}${reportSummary}`;
    }
    if (overnightBossStatusNode) {
      const report = this.majorBossOvernightReport;
      const reportSummary = report
        ? ` Last overnight run ${report.run_id}: ${report.status}; ${report.scenario_count} scenario(s), ${report.batch_count} batch(es), ${Math.round((report.cooldown_ms || 0) / 60000)} minute cooldown, ${report.reconciliation?.judged_artifacts ?? "unknown"} judged artifact(s), ${report.reconciliation?.context_sleep_count ?? 0} context sleep(s).`
        : "";
      overnightBossStatusNode.innerText = `${this.forgeArenaActionState.overnightStatus || ""}${reportSummary}`;
    }
    if (runMonitorStateNode) {
      const summary = this.forgeArenaRunLogSummary || summarizeForgeArenaOvernightLog("");
      runMonitorStateNode.dataset.state = summary.state || "empty";
      runMonitorStateNode.innerText = summary.title || "No overnight field run recorded yet";
      if (runMonitorProgressNode) {
        runMonitorProgressNode.innerText = summary.progressLabel || "0/50 scenarios";
      }
      if (runMonitorBarNode) {
        runMonitorBarNode.style.width = `${Number(summary.progressPercent || 0)}%`;
      }
      if (runMonitorDetailNode) {
        const runId = summary.runId ? `Run ${summary.runId}. ` : "";
        runMonitorDetailNode.innerText = `${runId}${summary.detail || ""}`;
      }
      if (runMonitorHashNode) {
        const hash = summary.recordHash ? summary.recordHash.slice(0, 16) : "no record hash yet";
        runMonitorHashNode.innerText = `Latest proof hash: ${hash}`;
      }
    }
    if (localParticipationStatusNode)
      localParticipationStatusNode.innerText = this.forgeArenaActionState.participationStatus || "";
    if (judgeFeedbackNode) judgeFeedbackNode.innerText = this.forgeArenaActionState.judgeStatus;
    if (profileFeedbackNode)
      profileFeedbackNode.innerText = this.forgeArenaActionState.profileStatus;

    const publicDisplayName =
      currentArenaProfile?.public_display_name ||
      activeProfileSummary?.display_name ||
      "Not set yet";
    const bossDisplayName =
      currentArenaProfile?.boss_display_name || this.agentName || "Not set yet";
    const presentationMode = currentArenaProfile?.presentation_mode === "studio" ? "Studio" : "Duo";
    const entryRoleLabels = {
      builder: "Builder",
      competitor: "Competitor",
      collaborator: "Collaborator",
      watcher: "Watcher",
    };
    const firstPathLabels = {
      "watch-live": "Watch Live",
      "play-tonight": "Play Tonight",
      "join-weekly-build": "Join The Weekly Build",
      "start-co-build": "Start A Co-Build",
    };
    const entryRole = entryRoleLabels[currentArenaProfile?.entry_role_preference] || "Not chosen";
    const firstPath = firstPathLabels[currentArenaProfile?.first_path_preference] || "Not chosen";
    const profileSummaryTitle = currentArenaProfile?.ready
      ? currentArenaProfile.presentation_mode === "studio"
        ? publicDisplayName
        : `${publicDisplayName} + ${bossDisplayName}`
      : "Enter Forge Arena";
    const profileSummaryCopy = currentArenaProfile?.ready
      ? "This BIOS profile now has a connected public Arena face without giving up local sovereignty."
      : "Choose how this BIOS profile should appear in the shared Arena world.";
    const profileTagline =
      currentArenaProfile?.tagline ||
      "This profile has not stepped into connected Forge Arena yet.";
    const profileShellStatus = currentArenaProfile?.ready
      ? "Public Arena identity is ready."
      : "Forge Arena identity not set up yet.";
    const profileNarrative =
      currentArenaProfile?.public_narrative ||
      "Forge Arena will explain how this profile appears in the shared world.";
    const profileReadiness = currentArenaProfile?.first_entry_completed
      ? "Arena entry is complete. Public profile truth is now live for this BIOS profile."
      : "No public Arena history yet.";
    const profileFeatureTitle =
      currentArenaProfile?.featured_work_title || "First Arena mark pending";
    const profileFeatureSummary =
      currentArenaProfile?.featured_work_summary ||
      "Judged runs, accepted co-builds, tools, skills, and playable builds will begin appearing here.";
    const profileReputation = currentArenaProfile?.reputation_label || "Unranked founder";
    const profileCapabilitySummary =
      currentArenaProfile?.capability_summary ||
      currentArenaProfile?.capability_class ||
      "Arena contender";
    const profileHistorySummary =
      currentArenaProfile?.history_summary ||
      "No public Arena history yet. The first accepted action will start the visible record.";
    const visibilityLabels = {
      local_private: "Local private",
      public_preview: "Public preview",
      connected_public: "Connected public",
    };
    const backendStatusLabels = {
      local_contract_ready_backend_not_attached:
        "Local contract ready; connected backend not attached.",
      connected_backend_ready: "Connected backend ready.",
    };
    const connectedIdentityId = currentArenaProfile?.arena_identity_id || "Not issued yet";
    const publicVisibility =
      visibilityLabels[currentArenaProfile?.public_visibility] || "Local private";
    const connectedBackendStatus =
      backendStatusLabels[currentArenaProfile?.connected_backend_status] ||
      "Connected backend not attached.";
    const publicScope = Array.isArray(currentArenaProfile?.public_identity_scope)
      ? currentArenaProfile.public_identity_scope
          .map((item) => String(item || "").replace(/_/g, " "))
          .filter(Boolean)
          .join(", ")
      : "";
    const privateBoundary =
      currentArenaProfile?.private_truth_boundary ||
      "Private BIOS memory, keys, prompts, and unsubmitted artifacts stay local.";

    if (profileShellStatusNode) profileShellStatusNode.innerText = profileShellStatus;
    if (profileSummaryTitleNode) profileSummaryTitleNode.innerText = profileSummaryTitle;
    if (profileSummaryCopyNode) profileSummaryCopyNode.innerText = profileSummaryCopy;
    if (profilePublicNameNode) profilePublicNameNode.innerText = publicDisplayName;
    if (profileBossNameNode) profileBossNameNode.innerText = bossDisplayName;
    if (profileModeNode) profileModeNode.innerText = presentationMode;
    if (profileRankNode) profileRankNode.innerText = currentArenaProfile?.rank_class || "Rookie";
    if (profileClassNode)
      profileClassNode.innerText = currentArenaProfile?.capability_class || "Arena contender";
    if (profileTaglineNode) profileTaglineNode.innerText = profileTagline;
    if (profileNarrativeNode) profileNarrativeNode.innerText = profileNarrative;
    if (profileEntryRoleNode) profileEntryRoleNode.innerText = entryRole;
    if (profileFirstPathNode) profileFirstPathNode.innerText = firstPath;
    if (profileReadinessNode) profileReadinessNode.innerText = profileReadiness;
    if (profileFeatureTitleNode) profileFeatureTitleNode.innerText = profileFeatureTitle;
    if (profileFeatureSummaryNode) profileFeatureSummaryNode.innerText = profileFeatureSummary;
    if (profileReputationNode) profileReputationNode.innerText = profileReputation;
    if (profileCapabilitySummaryNode)
      profileCapabilitySummaryNode.innerText = profileCapabilitySummary;
    if (profileHistorySummaryNode) profileHistorySummaryNode.innerText = profileHistorySummary;
    if (connectedIdentityIdNode) connectedIdentityIdNode.innerText = connectedIdentityId;
    if (connectedBackendStatusNode) connectedBackendStatusNode.innerText = connectedBackendStatus;
    if (publicVisibilityNode) publicVisibilityNode.innerText = publicVisibility;
    if (publicScopeNode)
      publicScopeNode.innerText = publicScope
        ? `Public scope: ${publicScope}.`
        : "Public fields will appear after first Arena entry.";
    if (privateBoundaryNode) privateBoundaryNode.innerText = privateBoundary;
    if (profileBadgeListNode) {
      profileBadgeListNode.innerHTML = "";
      const badges =
        Array.isArray(currentArenaProfile?.badges) && currentArenaProfile.badges.length
          ? currentArenaProfile.badges
          : ["Season Zero Founder"];
      badges.forEach((badge) => {
        const chip = document.createElement("span");
        chip.className = "forge-hero-chip";
        chip.innerText = badge;
        profileBadgeListNode.appendChild(chip);
      });
    }

    const profileFormSignature = `${this.activeBiosProfileId || "none"}:${currentArenaProfile?.updated_at || 0}`;
    if (this.forgeArenaProfileFormSignature !== profileFormSignature) {
      if (profilePublicInput) {
        profilePublicInput.value =
          currentArenaProfile?.public_display_name || activeProfileSummary?.display_name || "";
      }
      if (profileBossInput) {
        profileBossInput.value = currentArenaProfile?.boss_display_name || this.agentName || "";
      }
      if (profileModeInput) {
        profileModeInput.value = currentArenaProfile?.presentation_mode || "duo";
      }
      if (profileRoleInput) {
        profileRoleInput.value = currentArenaProfile?.entry_role_preference || "";
      }
      if (profilePathInput) {
        profilePathInput.value = currentArenaProfile?.first_path_preference || "";
      }
      if (profileTaglineInput) {
        profileTaglineInput.value = currentArenaProfile?.tagline || "";
      }
      this.forgeArenaProfileFormSignature = profileFormSignature;
    }

    const allRuns = runsForWorkshop;
    if (!this.forgeArenaActionState.selectedRunId && allRuns[0]?.id) {
      this.forgeArenaActionState.selectedRunId = allRuns[0].id;
    }
    if (pairRunSelectNode) {
      pairRunSelectNode.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.innerText = allRuns.length ? "Select visible run" : "No visible runs yet";
      pairRunSelectNode.appendChild(placeholder);
      allRuns.forEach((run) => {
        const option = document.createElement("option");
        option.value = run.id;
        option.innerText = `${run.title} · ${run.status} · ${run.score}`;
        if (run.id === this.forgeArenaActionState.selectedRunId) {
          option.selected = true;
        }
        pairRunSelectNode.appendChild(option);
      });
    }

    const allChallenges = challengesForRail;
    const editingChallenge = allChallenges.find(
      (challenge) => challenge.id === this.forgeArenaActionState.editingChallengeId,
    );
    const selectedChallenge =
      allChallenges.find(
        (challenge) => challenge.id === this.forgeArenaActionState.selectedChallengeId,
      ) ||
      editingChallenge ||
      allChallenges[0] ||
      null;
    const selectedRun =
      allRuns.find((run) => run.id === this.forgeArenaActionState.selectedRunId) ||
      allRuns[0] ||
      null;
    const entryPaths = this.buildForgeArenaEntryPaths({
      allChallenges,
      allRuns,
      currentFeaturedRun,
      selectedChallenge,
    });
    const activeEntryPath =
      entryPaths.find((entry) => entry.id === this.forgeArenaActionState.selectedEntryPath) ||
      entryPaths[0] ||
      null;
    const returnLoop = this.buildForgeArenaReturnLoop({
      selectedChallenge,
      selectedRun,
      entryPath: activeEntryPath,
    });

    if (editorModeNode) {
      editorModeNode.innerText = editingChallenge
        ? `Editing ${editingChallenge.title}`
        : "Create a new server-backed challenge";
    }
    if (submitLabelNode) {
      submitLabelNode.innerText = editingChallenge ? "Save challenge" : "Create challenge";
    }
    if (cancelEditButton) {
      if (editingChallenge) {
        cancelEditButton.removeAttribute("hidden");
      } else {
        cancelEditButton.setAttribute("hidden", "hidden");
      }
    }
    if (selectedChallengeStatusNode) {
      selectedChallengeStatusNode.innerText = selectedChallenge
        ? `${String(selectedChallenge.status || "open").toUpperCase()} · ${String(selectedChallenge.scoringRule || "balanced").toUpperCase()} · +${Number(selectedChallenge.scoreBonus || 0)}${selectedChallenge.pairedRunId ? ` · paired ${selectedChallenge.pairedRunId}` : ""}`
        : "Select a challenge to inspect or judge it.";
    }
    if (selectedChallengeCopyNode) {
      selectedChallengeCopyNode.innerText = selectedChallenge
        ? `${selectedChallenge.title} ${selectedChallenge.ownerSessionKey ? `· owner ${selectedChallenge.ownerSessionKey}` : "· unassigned"}`
        : "Select a challenge to inspect lifecycle entries and result visibility.";
    }
    if (challengeStandingsSummaryNode) {
      challengeStandingsSummaryNode.innerText = selectedChallenge
        ? selectedChallenge.standingsSummary ||
          selectedChallenge.leaderSummary ||
          "No reviewed runs yet for this challenge."
        : "Select a challenge to compare reviewed runs and deltas from the current leader.";
    }

    if (workshopTitleNode) {
      workshopTitleNode.innerText =
        selectedChallenge?.title ||
        allRuns[0]?.pairedChallengeTitle ||
        allRuns[0]?.challengeTitle ||
        "Skyward Sanctuary";
    }
    if (workshopSummaryNode) {
      workshopSummaryNode.innerText =
        selectedChallenge?.summary ||
        allRuns[0]?.comparisonSummary ||
        allRuns[0]?.reviewSummary ||
        "Collaborative build telemetry will appear here as Forge Arena runs hydrate.";
    }
    const progressSeed =
      Number(selectedChallenge?.leaderScore || 0) +
      Number(allRuns[0]?.score || 0) +
      Number(this.forgeArenaFeed.leaderboard?.[0]?.score || 0);
    const workshopProgress = Math.max(
      8,
      Math.min(96, progressSeed ? 28 + (progressSeed % 61) : 24),
    );
    if (workshopProgressLabelNode) {
      workshopProgressLabelNode.innerText = `${workshopProgress}%`;
    }
    if (workshopProgressBarNode) {
      workshopProgressBarNode.style.width = `${workshopProgress}%`;
    }
    if (builderRowNode) {
      builderRowNode.innerHTML = "";
      const builders = (
        selectedChallenge
          ? [selectedChallenge.ownerSessionKey, ...allRuns.map((run) => run.sessionKey)]
          : allRuns.map((run) => run.sessionKey)
      )
        .filter(Boolean)
        .filter((value, index, source) => source.indexOf(value) === index)
        .slice(0, 5);
      if (!builders.length) {
        const pill = document.createElement("span");
        pill.className = "forge-avatar-pill";
        pill.innerHTML = '<span class="forge-avatar-mark">FA</span><span>Awaiting builders</span>';
        builderRowNode.appendChild(pill);
      } else {
        builders.forEach((builder) => {
          const pill = document.createElement("span");
          pill.className = "forge-avatar-pill";
          pill.innerHTML = `<span class="forge-avatar-mark">${makeInitials(builder, "BI")}</span><span>${builder}</span>`;
          builderRowNode.appendChild(pill);
        });
      }
    }
    if (agentRowNode) {
      agentRowNode.innerHTML = "";
      const agents = allRuns.slice(0, 4);
      if (!agents.length) {
        const pill = document.createElement("span");
        pill.className = "forge-avatar-pill";
        pill.innerHTML =
          '<span class="forge-avatar-mark">AI</span><span>No active arena agents yet</span>';
        agentRowNode.appendChild(pill);
      } else {
        agents.forEach((run) => {
          const pill = document.createElement("span");
          pill.className = "forge-avatar-pill";
          pill.innerHTML = `<span class="forge-avatar-mark">${makeInitials(run.title, "AI")}</span><span>${run.title}</span>`;
          agentRowNode.appendChild(pill);
        });
      }
    }
    if (activeZonesNode) {
      activeZonesNode.innerHTML = "";
      const zones = [
        selectedChallenge?.title,
        ...allChallenges.slice(0, 3).map((challenge) => challenge.title),
      ]
        .filter(Boolean)
        .filter((value, index, source) => source.indexOf(value) === index)
        .slice(0, 4);
      if (!zones.length) {
        const empty = document.createElement("li");
        empty.innerText = "Active build zones will appear as arena challenges go live.";
        activeZonesNode.appendChild(empty);
      } else {
        zones.forEach((zone, index) => {
          const item = document.createElement("li");
          item.innerHTML = `<strong>${zone}</strong><span class="forge-arena-list-meta">${Math.max(2, Math.min(18, (allRuns[index]?.resultCount || 0) + index + 3))} builders</span>`;
          activeZonesNode.appendChild(item);
        });
      }
    }

    if (entryPathsNode) {
      entryPathsNode.innerHTML = "";
      entryPaths.forEach((entry) => {
        const card = document.createElement("article");
        card.className = `forge-entry-card${entry.id === this.forgeArenaActionState.selectedEntryPath ? " forge-entry-card--active" : ""}`;
        card.dataset.entryArt = entry.id;
        const metaHtml = Array.isArray(entry.meta)
          ? entry.meta
              .filter(Boolean)
              .map((item) => `<span>${item}</span>`)
              .join("")
          : "";
        card.innerHTML = `
          <span class="forge-entry-card-kicker">${entry.kicker}</span>
          <h3 class="forge-entry-card-title">${entry.title}</h3>
          <p class="forge-entry-card-copy">${entry.copy}</p>
          <p class="forge-entry-card-result">${entry.result}</p>
          <div class="forge-entry-card-meta">${metaHtml}</div>
          <button type="button" class="forge-cta-secondary forge-entry-card-action" data-forge-entry-path="${entry.id}">${entry.cta}</button>
        `;
        entryPathsNode.appendChild(card);
      });
    }
    if (returnTitleNode) returnTitleNode.innerText = returnLoop.title;
    if (returnCopyNode) returnCopyNode.innerText = returnLoop.copy;
    if (returnTraceNode) returnTraceNode.innerText = returnLoop.trace;
    if (returnNextNode) returnNextNode.innerText = returnLoop.next;

    if (listNode) {
      listNode.innerHTML = "";
      this.forgeArenaFeed.items.forEach((item) => {
        const li = document.createElement("li");
        if (item && typeof item === "object") {
          const title = document.createElement("strong");
          title.innerText = item.title || "Arena item";
          const meta = document.createElement("span");
          meta.className = "forge-arena-list-meta";
          meta.innerText = item.meta || "";
          const detail = document.createElement("p");
          detail.className = "forge-arena-list-detail";
          detail.innerText = item.detail || "";
          li.appendChild(title);
          if (meta.innerText) li.appendChild(meta);
          if (detail.innerText) li.appendChild(detail);
        } else {
          li.innerText = String(item || "");
        }
        listNode.appendChild(li);
      });
    }

    if (railNode) {
      railNode.innerHTML = "";
      const challengeCards = allChallenges.length
        ? allChallenges.slice(0, 4)
        : [
            {
              title: "One Button Survival Jam",
              status: "open",
              summary: "Daily challenge posters will appear once the arena backend hydrates.",
              scoringRule: "balanced",
            },
          ];
      challengeCards.forEach((challenge, index) => {
        const card = document.createElement("article");
        card.className = "forge-poster-card";
        card.dataset.posterArt =
          index === 0
            ? "survival"
            : index === 1
              ? "skyward"
              : index === 2
                ? "hackathon"
                : "clash";
        if (challenge.id && challenge.id === this.forgeArenaActionState.selectedChallengeId) {
          card.classList.add("is-selected");
        }
        const chip = document.createElement("span");
        chip.className = "forge-poster-chip";
        chip.innerText =
          index === 0
            ? "Agent Game Jam"
            : index === 1
              ? "Co-Build Event"
              : index === 2
                ? "Hackathon"
                : "Live Leaderboard";
        const title = document.createElement("h3");
        title.innerText = challenge.title || `Arena Event ${index + 1}`;
        const detail = document.createElement("p");
        detail.innerText =
          challenge.summary ||
          challenge.resultSummary ||
          "Official Forge Arena event prompt is standing by.";
        const meta = document.createElement("div");
        meta.className = "forge-poster-meta";
        meta.innerHTML = `<span>${String(challenge.status || "open").toUpperCase()}</span><span>${challenge.eventCategoryLabel || String(challenge.scoringRule || "balanced").toUpperCase()}</span><span>${challenge.divisionLabel || "Open Class"}</span>`;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "forge-cta-secondary";
        button.innerText =
          index === 3
            ? "Watch Live"
            : index === 1
              ? "Join Build"
              : index === 2
                ? "Join Hack"
                : "Enter Jam";
        button.addEventListener("click", () => {
          this.forgeArenaActionState.selectedChallengeId =
            challenge.id || this.forgeArenaActionState.selectedChallengeId;
          this.forgeArenaActionState.featureStatus = challenge.title
            ? `Selected ${challenge.title} from the events rail.`
            : "Selected featured arena event.";
          this.renderForgeArenaFeed();
        });
        card.appendChild(chip);
        card.appendChild(title);
        card.appendChild(detail);
        card.appendChild(meta);
        if (challenge.rewardTitle || challenge.spotlightLabel) {
          const reward = document.createElement("p");
          reward.className = "forge-arena-list-detail";
          reward.innerText = `${challenge.rewardTitle || "Official Arena reward"}${challenge.spotlightLabel ? ` · ${challenge.spotlightLabel}` : ""}`;
          card.appendChild(reward);
        }
        card.appendChild(button);
        railNode.appendChild(card);
      });
    }

    if (leaderboardNode) {
      leaderboardNode.innerHTML = "";
      const leaderboard = Array.isArray(this.forgeArenaFeed.leaderboard)
        ? this.forgeArenaFeed.leaderboard
        : [];
      if (!leaderboard.length) {
        const empty = document.createElement("li");
        empty.innerText = "Leaderboard will populate from live arena telemetry.";
        leaderboardNode.appendChild(empty);
      } else {
        leaderboard.forEach((entry) => {
          const trend = String(entry.trend || "steady").toUpperCase();
          const li = document.createElement("li");
          li.className = "forge-list-ranked-row";
          const rank = document.createElement("span");
          rank.className = "forge-arena-rank";
          rank.innerText = `#${entry.rank}`;
          const body = document.createElement("div");
          appendArenaIdentityChip(body, matchArenaIdentityCard(entry.label), entry.label);
          const title = document.createElement("strong");
          title.innerText = entry.label;
          const detail = document.createElement("span");
          detail.className = "forge-arena-list-meta";
          detail.innerText = entry.detail || "";
          const division = document.createElement("span");
          division.className = "forge-arena-list-meta";
          division.innerText = `${entry.division || "Arena division"} - ${entry.rankClass || "Rookie"} - ${entry.seasonalTitle || "Season entrant"}`;
          const rating = document.createElement("span");
          rating.className = "forge-arena-list-meta";
          rating.innerText = `RATING ${entry.rating || 0} - ${trend}`;
          body.appendChild(title);
          if (detail.innerText) body.appendChild(detail);
          body.appendChild(division);
          body.appendChild(rating);
          const score = document.createElement("span");
          score.className = "forge-arena-score";
          score.innerText = entry.score;
          li.appendChild(rank);
          li.appendChild(body);
          li.appendChild(score);
          leaderboardNode.appendChild(li);
        });
      }
    }

    if (historyNode) {
      historyNode.innerHTML = "";
      const history = Array.isArray(this.forgeArenaFeed.standingsHistory)
        ? this.forgeArenaFeed.standingsHistory
        : [];
      if (!history.length) {
        const empty = document.createElement("li");
        empty.innerText = "Standings history will appear as Arena leaders change.";
        historyNode.appendChild(empty);
      } else {
        history.forEach((entry) => {
          const li = document.createElement("li");
          li.innerHTML = `<span class="forge-arena-rank">${entry.leaderScore}</span><div><strong>${entry.leaderLabel}</strong><span class="forge-arena-list-meta">${new Date(entry.recordedAt || 0).toLocaleString()}</span><p class="forge-arena-list-detail">${entry.summary || "Standings update recorded."}</p></div>`;
          historyNode.appendChild(li);
        });
      }
    }

    if (hallOfFameNode) {
      hallOfFameNode.innerHTML = "";
      const hall = Array.isArray(this.forgeArenaFeed.hallOfFame)
        ? this.forgeArenaFeed.hallOfFame
        : [];
      if (!hall.length) {
        const empty = document.createElement("li");
        empty.innerText =
          "Hall of Fame entries will appear after the first official judged results.";
        hallOfFameNode.appendChild(empty);
      } else {
        hall.forEach((entry) => {
          const li = document.createElement("li");
          li.innerHTML = `<span class="forge-arena-rank">${String(entry.kind || "moment").toUpperCase()}</span><div><strong>${entry.title}</strong><span class="forge-arena-list-meta">${entry.seasonLabel || "Season Zero"} · ${entry.honor || "Arena honor"}</span><p class="forge-arena-list-detail">${entry.summary || "Legend entry recorded."}</p></div>`;
          hallOfFameNode.appendChild(li);
        });
      }
    }

    if (runReviewDetailSummaryNode) {
      runReviewDetailSummaryNode.innerText = selectedRun
        ? selectedRun.comparisonSummary ||
          selectedRun.reviewSummary ||
          `Inspecting ${selectedRun.title}.`
        : "Select a visible run to inspect pairing context, leader summaries, standings, and recent judged results.";
    }

    renderArenaRunReviewList(runReviewNode, {
      runs: allRuns,
      selectedRunId: this.forgeArenaActionState.selectedRunId,
      onSelectRun: (runId) => {
        this.forgeArenaActionState.selectedRunId = runId;
        if (pairRunSelectNode) {
          pairRunSelectNode.value = runId;
        }
        this.forgeArenaActionState.featureStatus = `Selected ${runId} for pairing or review.`;
        this.renderForgeArenaFeed();
      },
      onInspectChallenge: (challengeId) => {
        this.forgeArenaActionState.selectedChallengeId = challengeId;
        this.renderForgeArenaFeed();
      },
    });

    renderArenaRunReviewDetail(runReviewDetailNode, {
      run: selectedRun,
      challenges: allChallenges,
      onSelectRun: (runId) => {
        this.forgeArenaActionState.selectedRunId = runId;
        if (pairRunSelectNode) {
          pairRunSelectNode.value = runId;
        }
        this.forgeArenaActionState.featureStatus = `Selected ${runId} for pairing or review.`;
        this.renderForgeArenaFeed();
      },
      onInspectChallenge: (challengeId) => {
        this.forgeArenaActionState.selectedChallengeId = challengeId;
        this.renderForgeArenaFeed();
      },
    });

    if (challengesNode) {
      challengesNode.innerHTML = "";
      const challenges = allChallenges.filter((challenge) => {
        if (this.forgeArenaActionState.challengeFilter === "active") {
          return (
            challenge.status === "open" ||
            challenge.status === "live" ||
            challenge.status === "judging"
          );
        }
        if (this.forgeArenaActionState.challengeFilter === "closed") {
          return challenge.status === "closed";
        }
        return true;
      });
      if (!challenges.length) {
        const empty = document.createElement("li");
        empty.innerText = "Challenges will populate from the Forge Arena backend.";
        challengesNode.appendChild(empty);
      } else {
        challenges.forEach((challenge) => {
          const li = document.createElement("li");
          if (challenge.id && challenge.id === this.forgeArenaActionState.selectedChallengeId) {
            li.classList.add("is-selected");
          }
          const title = document.createElement("strong");
          title.innerText = challenge.title || "Forge Arena challenge";
          const status = document.createElement("span");
          status.className = "forge-arena-challenge-status";
          status.innerText = String(challenge.status || "open").toUpperCase();
          const detail = document.createElement("p");
          detail.className = "forge-arena-list-detail";
          const ownerLabel = challenge.ownerSessionKey
            ? `Owner ${challenge.ownerSessionKey}`
            : "Unassigned";
          const pairLabel = challenge.pairedRunId ? ` · Paired ${challenge.pairedRunId}` : "";
          const latestResult = Array.isArray(challenge.resultHistory)
            ? challenge.resultHistory[0]
            : null;
          const leaderLabel = challenge.leaderLabel
            ? ` · Leader: ${challenge.leaderLabel} ${Number(challenge.leaderScore || 0)} pts`
            : "";
          const resultLabel = latestResult
            ? ` · Latest: ${latestResult.runTitle} ${String(latestResult.verdict || "hold").toUpperCase()} ${Number(latestResult.scoreDelta || 0) > 0 ? "+" : ""}${Number(latestResult.scoreDelta || 0)} (${String(latestResult.reviewCategory || "breakthrough").toUpperCase()})`
            : challenge.resultSummary
              ? ` · Result: ${challenge.resultSummary}`
              : "";
          detail.innerText = `${challenge.summary || "Challenge summary pending."} · ${ownerLabel}${pairLabel} · ${String(challenge.scoringRule || "balanced").toUpperCase()} scoring · +${Number(challenge.scoreBonus || 0)}${leaderLabel}${resultLabel}`;
          if (challenge.eventCategoryLabel || challenge.cadenceLabel || challenge.divisionLabel) {
            detail.innerText += ` · ${challenge.eventCategoryLabel || "Game Jam"} · ${challenge.cadenceLabel || "Weekly"} · ${challenge.divisionLabel || "Local Small"}`;
          }
          const runMatch = challenge.pairedRunId
            ? allRuns.find((run) => run.id === challenge.pairedRunId) || null
            : challenge.ownerSessionKey
              ? allRuns.find((run) => run.sessionKey === challenge.ownerSessionKey) || null
              : allRuns[0] || null;
          const actions = document.createElement("div");
          actions.className = "forge-arena-inline-actions";

          const editButton = document.createElement("button");
          editButton.type = "button";
          editButton.className = "forge-arena-inline-button";
          editButton.innerText = "Edit";
          editButton.addEventListener("click", () => {
            this.populateForgeArenaChallengeForm(challenge);
          });
          actions.appendChild(editButton);

          const inspectButton = document.createElement("button");
          inspectButton.type = "button";
          inspectButton.className =
            "forge-arena-inline-button forge-arena-inline-button--secondary";
          inspectButton.innerText =
            this.forgeArenaActionState.selectedChallengeId === challenge.id
              ? "Selected"
              : "Inspect";
          inspectButton.addEventListener("click", () => {
            this.forgeArenaActionState.selectedChallengeId = challenge.id;
            this.renderForgeArenaFeed();
          });
          actions.appendChild(inspectButton);

          const quickJudgeButton = document.createElement("button");
          quickJudgeButton.type = "button";
          quickJudgeButton.className = "forge-arena-inline-button";
          quickJudgeButton.innerText =
            challenge.status === "judging" ? "Promote winner" : "Prepare judging";
          quickJudgeButton.addEventListener("click", async () => {
            this.forgeArenaActionState.selectedChallengeId = challenge.id;
            if (!runMatch) {
              this.forgeArenaActionState.judgeStatus = `No matching run is visible yet for ${challenge.title}.`;
              this.renderForgeArenaFeed();
              return;
            }
            try {
              if (challenge.status !== "judging") {
                await this.forgeArena.transitionChallenge({
                  challengeId: challenge.id,
                  toStatus: "judging",
                });
              }
              await this.forgeArena.judgeChallenge({
                challengeId: challenge.id,
                runId: runMatch.id,
                sessionKey:
                  challenge.ownerSessionKey || runMatch.sessionKey || this.activeSessionKey,
                verdict: "promote",
                scoreDelta: 8,
                summary: `Arena quick-judged ${runMatch.title || challenge.title} as the current promoted run.`,
              });
              this.forgeArenaActionState.judgeStatus = `Judging recorded for ${challenge.title}.`;
              await this.refreshForgeArenaFeed({ connected: this.gateway.isConnected });
            } catch (err) {
              console.error("[AetherApp] Failed to quick-judge Forge Arena challenge:", err);
              this.forgeArenaActionState.judgeStatus = `Judging failed: ${err?.message || "unknown error"}`;
              this.renderForgeArenaFeed();
            }
          });
          actions.appendChild(quickJudgeButton);

          [
            { label: "Go live", toStatus: "live", disabled: challenge.status === "live" },
            {
              label: "Judge",
              toStatus: "judging",
              disabled: challenge.status === "judging" || challenge.status === "open",
            },
            { label: "Close", toStatus: "closed", disabled: challenge.status === "closed" },
          ].forEach((action) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "forge-arena-inline-button";
            button.innerText = action.label;
            if (action.disabled) {
              button.setAttribute("disabled", "disabled");
            }
            button.addEventListener("click", async () => {
              button.setAttribute("disabled", "disabled");
              try {
                await this.forgeArena.transitionChallenge({
                  challengeId: challenge.id,
                  toStatus: action.toStatus,
                });
                this.forgeArenaActionState.selectedChallengeId = challenge.id;
                this.forgeArenaActionState.createStatus = `Challenge \"${challenge.title}\" moved to ${String(action.toStatus).toUpperCase()}.`;
                await this.refreshForgeArenaFeed({ connected: this.gateway.isConnected });
              } catch (err) {
                console.error("[AetherApp] Failed to transition Forge Arena challenge:", err);
                this.forgeArenaActionState.createStatus = `Challenge transition failed: ${err?.message || "unknown error"}`;
                this.renderForgeArenaFeed();
              } finally {
                button.removeAttribute("disabled");
              }
            });
            actions.appendChild(button);
          });
          li.appendChild(title);
          li.appendChild(status);
          li.appendChild(detail);
          li.appendChild(actions);
          challengesNode.appendChild(li);
        });
      }
    }

    if (challengeStandingsNode) {
      challengeStandingsNode.innerHTML = "";
      const standings = Array.isArray(selectedChallenge?.standings)
        ? selectedChallenge.standings
        : [];
      if (!selectedChallenge) {
        const empty = document.createElement("li");
        empty.innerText = "Select a challenge to inspect challenge-specific standings.";
        challengeStandingsNode.appendChild(empty);
      } else if (!standings.length) {
        const empty = document.createElement("li");
        empty.innerText = selectedChallenge.pairedRunId
          ? "A run is paired, but no reviewed outcomes are recorded yet."
          : "No reviewed runs are tracked for this challenge yet.";
        challengeStandingsNode.appendChild(empty);
      } else {
        standings.forEach((entry, index) => {
          const li = document.createElement("li");
          const leaderMeta = index === 0 ? "Leader" : `${entry.deltaFromLeader} behind leader`;
          li.className = "forge-list-ranked-row";
          const rank = document.createElement("span");
          rank.className = "forge-arena-rank";
          rank.innerText = `#${index + 1}`;
          const body = document.createElement("div");
          appendArenaIdentityChip(body, matchArenaIdentityCard(entry.runTitle), entry.runTitle);
          const title = document.createElement("strong");
          title.innerText = entry.runTitle;
          const meta = document.createElement("span");
          meta.className = "forge-arena-list-meta";
          meta.innerText = `${leaderMeta} - rating ${Number(entry.rating || 0)} - ${String(entry.latestVerdict || "hold").toUpperCase()} - ${String(entry.latestReviewCategory || "breakthrough").toUpperCase()} - ${Number(entry.resultCount || 0)} review${Number(entry.resultCount || 0) === 1 ? "" : "s"}`;
          const detail = document.createElement("p");
          detail.className = "forge-arena-list-detail";
          detail.innerText = entry.summary || "Challenge standings row.";
          body.appendChild(title);
          body.appendChild(meta);
          body.appendChild(detail);
          const score = document.createElement("span");
          score.className = "forge-arena-score";
          score.innerText = Number(entry.score || 0);
          li.appendChild(rank);
          li.appendChild(body);
          li.appendChild(score);
          challengeStandingsNode.appendChild(li);
        });
      }
    }

    if (challengeHistoryNode) {
      challengeHistoryNode.innerHTML = "";
      const lifecycleHistory = Array.isArray(selectedChallenge?.lifecycleHistory)
        ? selectedChallenge.lifecycleHistory
        : [];
      if (!selectedChallenge) {
        const empty = document.createElement("li");
        empty.innerText = "Select a challenge to inspect lifecycle entries and result visibility.";
        challengeHistoryNode.appendChild(empty);
      } else {
        const resultHistory = Array.isArray(selectedChallenge?.resultHistory)
          ? selectedChallenge.resultHistory
          : [];
        if (!lifecycleHistory.length && !resultHistory.length) {
          const empty = document.createElement("li");
          empty.innerText = "No challenge lifecycle entries or reviewed outcomes recorded yet.";
          challengeHistoryNode.appendChild(empty);
        } else {
          lifecycleHistory.forEach((entry) => {
            const li = document.createElement("li");
            li.innerHTML = `<span class="forge-arena-rank">${String(entry.kind || "event").toUpperCase()}</span><div><strong>${selectedChallenge.title}</strong><span class="forge-arena-list-meta">${new Date(entry.recordedAt || 0).toLocaleString()}</span><p class="forge-arena-list-detail">${entry.summary || "Lifecycle update recorded."}</p></div>`;
            challengeHistoryNode.appendChild(li);
          });
          resultHistory.forEach((entry) => {
            const li = document.createElement("li");
            const deltaFromLeader =
              selectedChallenge?.leaderScore !== undefined
                ? Number(selectedChallenge.leaderScore || 0) - Number(entry.scoreAfter || 0)
                : 0;
            const comparisonLabel =
              deltaFromLeader > 0 ? `${deltaFromLeader} behind leader` : "Current leader";
            li.innerHTML = `<span class="forge-arena-rank">${String(entry.verdict || "hold").toUpperCase()}</span><div><strong>${entry.runTitle || selectedChallenge.title}</strong><span class="forge-arena-list-meta">${new Date(entry.recordedAt || 0).toLocaleString()} · ${String(entry.reviewCategory || "breakthrough").toUpperCase()} · score ${Number(entry.scoreAfter || 0)} · delta ${Number(entry.scoreDelta || 0) > 0 ? "+" : ""}${Number(entry.scoreDelta || 0)} · ${comparisonLabel}</span><p class="forge-arena-list-detail">${entry.summary || "Result recorded."}</p></div>`;
            challengeHistoryNode.appendChild(li);
          });
        }
      }
    }

    if (typeof this.renderForgeArenaGameHub === "function") {
      this.renderForgeArenaGameHub({
        currentArenaProfile,
      });
    }

    if (typeof this.renderForgeArcade === "function") {
      this.renderForgeArcade();
    }
  }

  buildForgeArenaEntryPaths({ allChallenges, allRuns, currentFeaturedRun, selectedChallenge }) {
    const weeklyChallenge = allChallenges[0] || selectedChallenge || null;
    const coBuildChallenge = allChallenges[1] || selectedChallenge || weeklyChallenge || null;
    const publishChallenge = selectedChallenge || weeklyChallenge || null;
    const featuredRun = currentFeaturedRun?.title ? currentFeaturedRun : allRuns[0] || null;
    const watchRun = allRuns[0] || featuredRun || null;
    const agentLabel = this.agentName || "Your BOSS";

    return [
      {
        id: "play-tonight",
        kicker: "Play Tonight",
        title: featuredRun?.title || "Jump Into Tonight's Feature",
        copy:
          featuredRun?.summary ||
          "Start with the easiest path: open the featured run and see what is happening right now.",
        result:
          featuredRun?.detail ||
          "A live run, score, or featured challenge should be visible the moment you enter.",
        meta: [featuredRun?.status || "Live now", this.forgeArenaFeed.status || "Arena standby"],
        cta: "Play Now",
      },
      {
        id: "join-weekly-build",
        kicker: "Weekly Build",
        title: weeklyChallenge?.title || "Join The Weekly Build",
        copy:
          weeklyChallenge?.summary ||
          "Enter the official prompt, submit your best version, and come back for judging and leaderboard movement.",
        result:
          weeklyChallenge?.standingsSummary ||
          weeklyChallenge?.resultSummary ||
          "A submission, a placement, and a judged result should stay visible after you enter.",
        meta: [
          String(weeklyChallenge?.status || "Open").toUpperCase(),
          `${String(weeklyChallenge?.scoringRule || "balanced").toUpperCase()} scoring`,
        ],
        cta: "Enter Build",
      },
      {
        id: "start-co-build",
        kicker: "Co-Build",
        title: coBuildChallenge?.title || "Start A Shared Build",
        copy:
          coBuildChallenge?.summary ||
          "Join a live shared project where humans and agents can keep building on the same world together.",
        result:
          coBuildChallenge?.leaderSummary ||
          "Contributor credits, active zones, and build progress should make the collaboration feel inhabited.",
        meta: [
          `${Math.max(1, Math.min(24, (allRuns[0]?.resultCount || 0) + 3))} builders`,
          "Shared project",
        ],
        cta: "Join Co-Build",
      },
      {
        id: "publish-local-creation",
        kicker: "Publish",
        title: `Publish ${agentLabel}'s Work`,
        copy:
          publishChallenge?.summary ||
          "Take something your BIOS AI system built locally and stage it for Arena visibility with a clear title, summary, and result hook.",
        result:
          publishChallenge?.resultSummary ||
          "Publishing should leave behind a card, category, author credit, and a place where others can find it again.",
        meta: [this.activeSessionKey || "Local BOSS", "Visible trace"],
        cta: "Stage Publish",
      },
      {
        id: "forge-arcade",
        kicker: "Arcade",
        title: "Ask BOSS To Build A Game",
        copy:
          "Describe a classic survival-style game, let BOSS turn it into a bounded template, then playtest it yourself.",
        result:
          "A playable local game, proof-safe spec, last playtest score, and published game card stay visible.",
        meta: ["Human plays", "Agent builds"],
        cta: "Build Game",
      },
      {
        id: "watch-live",
        kicker: "Watch Live",
        title: watchRun?.title || "Watch The Arena",
        copy:
          watchRun?.comparisonSummary ||
          watchRun?.reviewSummary ||
          "Spectating is a real first action. Watch the run, watch the board move, then decide where you want to jump in.",
        result:
          watchRun?.lastJudgementSummary ||
          "Leader changes, run reviews, and season history should make watching feel like progress, not waiting.",
        meta: [watchRun?.status || "Spectate", "Low friction"],
        cta: "Watch Now",
      },
    ];
  }

  buildForgeArenaReturnLoop({ selectedChallenge, selectedRun, entryPath }) {
    const latestOutcome =
      [
        this.forgeArenaActionState.judgeStatus,
        this.forgeArenaActionState.createStatus,
        this.forgeArenaActionState.featureStatus,
      ].find(
        (value) =>
          value &&
          ![
            "Select a challenge before judging.",
            "Ready to create a new challenge.",
            "Ready to feature the active run.",
          ].includes(value),
      ) || "Choose a path and Forge Arena will surface the result here.";

    const returnReasons = {
      "play-tonight": "Come back tomorrow for the next live event and a fresh featured run.",
      "join-weekly-build": "Come back for judging, placements, and the next official prompt.",
      "start-co-build":
        "Come back as your shared build zone gains new contributors and milestones.",
      "publish-local-creation":
        "Come back when your published creation picks up visibility, votes, or replay attention.",
      "forge-arcade": "Come back to iterate the game card, publish variants, and chase scores.",
      "watch-live": "Come back when the leaderboard shifts or a new run becomes worth following.",
    };

    return {
      title:
        entryPath?.title ||
        selectedChallenge?.title ||
        selectedRun?.title ||
        "Choose an Arena path",
      copy:
        entryPath?.copy ||
        selectedChallenge?.summary ||
        selectedRun?.summary ||
        "Forge Arena should always make the next action obvious.",
      trace:
        selectedChallenge?.standingsSummary || selectedRun?.lastJudgementSummary || latestOutcome,
      next:
        returnReasons[entryPath?.id] ||
        "Daily events, weekly build prompts, and shared world progress keep the Arena alive.",
    };
  }

  handleForgeArenaEntryPath(pathId, { scroll = true } = {}) {
    const allChallenges = Array.isArray(this.forgeArenaFeed.challenges)
      ? this.forgeArenaFeed.challenges
      : [];
    const allRuns = Array.isArray(this.forgeArenaFeed.runs) ? this.forgeArenaFeed.runs : [];
    const selectedChallenge =
      allChallenges.find(
        (challenge) => challenge.id === this.forgeArenaActionState.selectedChallengeId,
      ) ||
      allChallenges[0] ||
      null;
    const entryPaths = this.buildForgeArenaEntryPaths({
      allChallenges,
      allRuns,
      currentFeaturedRun: this.forgeArenaFeed.featuredRun || {},
      selectedChallenge,
    });
    const entryPath = entryPaths.find((entry) => entry.id === pathId) || entryPaths[0] || null;
    const scrollTargetByPath = {
      "play-tonight": "forge-arena-featured-title",
      "join-weekly-build": "forge-arena-challenge-rail-panel",
      "start-co-build": "forge-arena-workshop-title",
      "publish-local-creation": "forge-arena-create-challenge-form",
      "forge-arcade": "forge-arcade-panel",
      "watch-live": "forge-arena-leader-title",
    };

    this.forgeArenaActionState.selectedEntryPath = entryPath?.id || "play-tonight";

    switch (pathId) {
      case "join-weekly-build":
        this.forgeArenaActionState.selectedChallengeId =
          allChallenges[0]?.id || this.forgeArenaActionState.selectedChallengeId;
        this.forgeArenaActionState.featureStatus = entryPath?.title
          ? `Weekly build selected: ${entryPath.title}.`
          : "Weekly build selected.";
        break;
      case "start-co-build":
        this.forgeArenaActionState.selectedChallengeId =
          allChallenges[1]?.id ||
          allChallenges[0]?.id ||
          this.forgeArenaActionState.selectedChallengeId;
        this.forgeArenaActionState.featureStatus = entryPath?.title
          ? `Co-build selected: ${entryPath.title}.`
          : "Co-build selected.";
        break;
      case "publish-local-creation": {
        const createTitleInput = document.getElementById("forge-arena-create-title");
        const createSummaryInput = document.getElementById("forge-arena-create-summary");
        const createOwnerSessionInput = document.getElementById("forge-arena-create-owner-session");
        const createStatusInput = document.getElementById("forge-arena-create-status");
        const createScoringRuleInput = document.getElementById("forge-arena-create-scoring-rule");
        const createResultSummaryInput = document.getElementById(
          "forge-arena-create-result-summary",
        );
        if (createTitleInput && !String(createTitleInput.value || "").trim()) {
          createTitleInput.value = `${this.agentName} local creation`;
        }
        if (createSummaryInput && !String(createSummaryInput.value || "").trim()) {
          createSummaryInput.value =
            "A locally built Arena creation staged for visibility, judging, and shared play.";
        }
        if (createOwnerSessionInput) {
          createOwnerSessionInput.value = this.activeSessionKey || "agent:main:main";
        }
        if (createStatusInput) {
          createStatusInput.value = "open";
        }
        if (createScoringRuleInput) {
          createScoringRuleInput.value = "creativity";
        }
        if (createResultSummaryInput && !String(createResultSummaryInput.value || "").trim()) {
          createResultSummaryInput.value =
            "Leaves behind a visible published card and result hook.";
        }
        this.forgeArenaActionState.createStatus =
          "Publish flow staged. Review the prefilled card, then submit it into Forge Arena.";
        break;
      }
      case "watch-live":
        this.forgeArenaActionState.selectedRunId =
          allRuns[0]?.id || this.forgeArenaActionState.selectedRunId;
        this.forgeArenaActionState.featureStatus = entryPath?.title
          ? `Watch live selected: ${entryPath.title}.`
          : "Watch live selected.";
        break;
      case "forge-arcade":
        this.forgeArenaActionState.featureStatus =
          "Forge Arcade selected. Tell BOSS what to build, then start a local playtest.";
        break;
      case "play-tonight":
      default:
        this.forgeArenaActionState.selectedRunId =
          this.forgeArenaFeed.featuredRun?.id ||
          allRuns[0]?.id ||
          this.forgeArenaActionState.selectedRunId;
        this.forgeArenaActionState.featureStatus = entryPath?.title
          ? `Play tonight selected: ${entryPath.title}.`
          : "Play tonight selected.";
        break;
    }

    this.renderForgeArenaFeed();

    if (scroll) {
      document
        .getElementById(scrollTargetByPath[pathId] || scrollTargetByPath["play-tonight"])
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }
  }

  async loadForgeArenaProfile(profileId = this.activeBiosProfileId) {
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof tauriInvoke !== "function" || !profileId) {
      this.forgeArenaProfile = null;
      if (typeof this.renderForgeArenaFeed === "function") {
        this.renderForgeArenaFeed();
      }
      return null;
    }
    try {
      const profile = await tauriInvoke("load_forge_arena_profile", { biosProfileId: profileId });
      this.forgeArenaProfile = profile;
      this.forgeArenaProfileFormSignature = "";
      if (typeof this.renderForgeArenaFeed === "function") {
        this.renderForgeArenaFeed();
      }
      return profile;
    } catch (err) {
      console.warn("[Forge Arena] Failed to load Arena profile:", err);
      this.forgeArenaProfile = null;
      if (typeof this.renderForgeArenaFeed === "function") {
        this.renderForgeArenaFeed();
      }
      return null;
    }
  }

  async saveForgeArenaProfile(input, profileId = this.activeBiosProfileId) {
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof tauriInvoke !== "function" || !profileId) {
      return null;
    }
    const profile = await tauriInvoke("save_forge_arena_profile", {
      biosProfileId: profileId,
      publicDisplayName: input.publicDisplayName,
      bossDisplayName: input.bossDisplayName,
      presentationMode: input.presentationMode,
      firstPathPreference: input.firstPathPreference || null,
      entryRolePreference: input.entryRolePreference || null,
      tagline: input.tagline || null,
      avatarStyle: input.avatarStyle || null,
      bannerStyle: input.bannerStyle || null,
    });
    this.forgeArenaProfile = profile;
    this.forgeArenaProfileFormSignature = "";
    if (typeof this.renderForgeArenaFeed === "function") {
      this.renderForgeArenaFeed();
    }
    return profile;
  }

  populateForgeArenaChallengeForm(challenge) {
    const createTitleInput = document.getElementById("forge-arena-create-title");
    const createSummaryInput = document.getElementById("forge-arena-create-summary");
    const createStatusInput = document.getElementById("forge-arena-create-status");
    const createOwnerSessionInput = document.getElementById("forge-arena-create-owner-session");
    const createScoringRuleInput = document.getElementById("forge-arena-create-scoring-rule");
    const createScoreBonusInput = document.getElementById("forge-arena-create-score-bonus");
    const createResultSummaryInput = document.getElementById("forge-arena-create-result-summary");

    if (createTitleInput) createTitleInput.value = challenge?.title || "";
    if (createSummaryInput) createSummaryInput.value = challenge?.summary || "";
    if (createStatusInput) createStatusInput.value = challenge?.status || "open";
    if (createOwnerSessionInput) createOwnerSessionInput.value = challenge?.ownerSessionKey || "";
    if (createScoringRuleInput) createScoringRuleInput.value = challenge?.scoringRule || "balanced";
    if (createScoreBonusInput)
      createScoreBonusInput.value = String(Number(challenge?.scoreBonus || 0));
    if (createResultSummaryInput) createResultSummaryInput.value = challenge?.resultSummary || "";

    this.forgeArenaActionState.editingChallengeId = challenge?.id || null;
    this.forgeArenaActionState.selectedChallengeId =
      challenge?.id || this.forgeArenaActionState.selectedChallengeId;
    this.forgeArenaActionState.createStatus = challenge?.id
      ? `Editing challenge \"${challenge.title || "Untitled"}\".`
      : "Ready to create a new challenge.";
    this.renderForgeArenaFeed();
  }

  resetForgeArenaChallengeForm() {
    const createChallengeForm = document.getElementById("forge-arena-create-challenge-form");
    const createOwnerSessionInput = document.getElementById("forge-arena-create-owner-session");
    const createResultSummaryInput = document.getElementById("forge-arena-create-result-summary");
    if (createChallengeForm && typeof createChallengeForm.reset === "function") {
      createChallengeForm.reset();
    }
    if (createOwnerSessionInput) {
      createOwnerSessionInput.value = this.activeSessionKey || "agent:main:main";
    }
    if (createResultSummaryInput) {
      createResultSummaryInput.value = "";
    }
    this.forgeArenaActionState.editingChallengeId = null;
    this.forgeArenaActionState.createStatus = "Ready to create a new challenge.";
    this.renderForgeArenaFeed();
  }

  renderForgeArenaGameHub({ currentArenaProfile = null } = {}) {
    const model = buildForgeArenaHubModel({
      forgeArenaFeed: this.forgeArenaFeed,
      forgeArcadeState: this.forgeArcadeState,
      profile: currentArenaProfile || this.forgeArenaProfile,
      agentName: this.agentName,
    });
    const matchHubPlayerCard = (label = "") => {
      const text = String(label || "").toLowerCase();
      return (
        model.playerCards.find((card) => text.includes(String(card.name || "").toLowerCase())) ||
        model.playerCards.find((card) => card.type === "official-bot" && text.includes(card.id)) ||
        model.playerCards.find((card) => card.type === "boss") ||
        model.playerCards.find((card) => card.type === "user") ||
        null
      );
    };
    const babsStatusNode = document.getElementById("forge-hub-babs-status");
    const babsMetricsNode = document.getElementById("forge-hub-babs-metrics");
    const babsNameNode = document.getElementById("forge-hub-babs-name");
    const babsSubtitleNode = document.getElementById("forge-hub-babs-subtitle");
    const babsHealthNode = document.getElementById("forge-hub-babs-health");
    const trendingTemplateNode = document.getElementById("forge-hub-trending-template");
    const babsDirectiveNode = document.getElementById("forge-hub-babs-directive");
    const babsArenaDecisionNode = document.getElementById("forge-hub-babs-arena-decision");
    const babsDispatchesNode = document.getElementById("forge-hub-babs-dispatches");
    const modeGridNode = document.getElementById("forge-hub-mode-grid");
    const playerCardGridNode = document.getElementById("forge-player-card-grid");
    const botRosterNode = document.getElementById("forge-official-bot-roster");
    const starterShelfNode = document.getElementById("forge-official-starter-shelf");
    const officialBuildGridNode = document.getElementById("forge-official-build-grid");
    const pipelineNode = document.getElementById("forge-build-pipeline-steps");
    const rankPreviewNode = document.getElementById("forge-community-rank-list");
    const growthRouteGridNode = document.getElementById("forge-growth-route-grid");
    const skillChallengeGridNode = document.getElementById("forge-skill-challenge-grid");
    const learningOutputGridNode = document.getElementById("forge-learning-output-grid");
    const planSpineGridNode = document.getElementById("forge-plan-spine-grid");

    if (babsStatusNode) babsStatusNode.innerText = model.babs.status;
    if (babsNameNode) babsNameNode.innerText = model.babs.name;
    if (babsSubtitleNode) babsSubtitleNode.innerText = model.babs.subtitle;
    if (babsHealthNode) babsHealthNode.innerText = model.babs.arenaHealth;
    if (trendingTemplateNode) trendingTemplateNode.innerText = model.babs.trendingTemplate;
    if (babsDirectiveNode) babsDirectiveNode.innerText = model.babs.directive;

    if (babsArenaDecisionNode) {
      const decision = model.babs.arenaDecision;
      babsArenaDecisionNode.innerHTML = "";
      babsArenaDecisionNode.dataset.verdict = decision.verdict;
      const meta = document.createElement("span");
      meta.className = "forge-hub-mode-meta";
      meta.innerText = `${String(decision.verdict || "review").toUpperCase()} - ${decision.confidence}`;
      const title = document.createElement("strong");
      title.innerText = decision.title;
      const explanation = document.createElement("p");
      explanation.innerText = decision.explanation;
      const next = document.createElement("span");
      next.className = "forge-babs-next-challenge";
      next.innerText = `Next challenge: ${decision.nextChallenge}`;
      const reasons = document.createElement("div");
      reasons.className = "forge-babs-reason-row";
      decision.reasons.forEach((reason) => {
        const chip = document.createElement("span");
        chip.innerText = reason;
        reasons.appendChild(chip);
      });
      babsArenaDecisionNode.appendChild(meta);
      babsArenaDecisionNode.appendChild(title);
      babsArenaDecisionNode.appendChild(explanation);
      babsArenaDecisionNode.appendChild(next);
      babsArenaDecisionNode.appendChild(reasons);
    }

    if (babsDispatchesNode) {
      babsDispatchesNode.innerHTML = "";
      model.babs.dispatches.forEach((dispatch) => {
        const item = document.createElement("article");
        item.className = "forge-babs-dispatch";
        const label = document.createElement("span");
        label.className = "forge-hub-mode-meta";
        label.innerText = dispatch.label;
        const title = document.createElement("strong");
        title.innerText = dispatch.title;
        const detail = document.createElement("p");
        detail.innerText = dispatch.detail;
        item.appendChild(label);
        item.appendChild(title);
        item.appendChild(detail);
        babsDispatchesNode.appendChild(item);
      });
    }

    if (babsMetricsNode) {
      babsMetricsNode.innerHTML = "";
      model.babs.metrics.forEach((metric) => {
        const item = document.createElement("div");
        item.className = "forge-hub-metric";
        const value = document.createElement("strong");
        value.innerText = metric.value;
        const label = document.createElement("span");
        label.innerText = metric.label;
        item.appendChild(value);
        item.appendChild(label);
        babsMetricsNode.appendChild(item);
      });
    }

    if (modeGridNode) {
      modeGridNode.innerHTML = "";
      model.modes.forEach((mode) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "forge-hub-mode-card";
        button.dataset.forgeHubAction = mode.action;
        button.dataset.forgeHubTarget = mode.targetId;

        const icon = document.createElement("span");
        icon.className = "forge-hub-mode-icon";
        icon.style.setProperty("--forge-hub-icon", `url("../${mode.icon}")`);
        const body = document.createElement("span");
        body.className = "forge-hub-mode-body";
        const meta = document.createElement("span");
        meta.className = "forge-hub-mode-meta";
        meta.innerText = mode.metric;
        const title = document.createElement("strong");
        title.innerText = mode.label;
        const summary = document.createElement("span");
        summary.innerText = mode.summary;
        body.appendChild(meta);
        body.appendChild(title);
        body.appendChild(summary);
        button.appendChild(icon);
        button.appendChild(body);
        modeGridNode.appendChild(button);
      });
    }

    if (playerCardGridNode) {
      playerCardGridNode.innerHTML = "";
      model.playerCards.forEach((card) => {
        const article = document.createElement("article");
        article.className = "forge-player-card";
        article.dataset.cardType = card.type;
        const top = document.createElement("div");
        top.className = "forge-player-card-top";
        const avatar = document.createElement("span");
        avatar.className = "forge-player-avatar";
        avatar.style.setProperty("--forge-player-avatar", `url("../${card.avatarAsset}")`);
        const badge = document.createElement("span");
        badge.className = "forge-player-rank-badge";
        badge.style.setProperty("--forge-player-rank", `url("../${card.rankAsset}")`);
        const identity = document.createElement("div");
        identity.className = "forge-player-identity";
        const status = document.createElement("span");
        status.className = "forge-hub-mode-meta";
        status.innerText = String(card.status || "active").toUpperCase();
        const name = document.createElement("strong");
        name.innerText = card.name;
        const role = document.createElement("span");
        role.innerText = card.role;
        identity.appendChild(status);
        identity.appendChild(name);
        identity.appendChild(role);
        top.appendChild(avatar);
        top.appendChild(badge);
        top.appendChild(identity);
        const stats = document.createElement("div");
        stats.className = "forge-player-stats";
        [
          ["Rank", card.rank],
          ["Level", String(card.level)],
          ["Class", card.arenaClass],
        ].forEach(([labelText, valueText]) => {
          const stat = document.createElement("span");
          const label = document.createElement("em");
          label.innerText = labelText;
          const value = document.createElement("strong");
          value.innerText = valueText;
          stat.appendChild(label);
          stat.appendChild(value);
          stats.appendChild(stat);
        });
        const detail = document.createElement("p");
        detail.innerText = card.detail;
        const progression = document.createElement("div");
        progression.className = "forge-player-progression";
        const progressionHead = document.createElement("span");
        progressionHead.className = "forge-player-progression-head";
        progressionHead.innerText = `${card.progression?.proofPoints || 0} proof pts - next ${card.progression?.nextRank || "rank"}`;
        const progressTrack = document.createElement("span");
        progressTrack.className = "forge-player-progress-track";
        const progressBar = document.createElement("span");
        progressBar.style.width = `${Number(card.progression?.progress || 0)}%`;
        progressTrack.appendChild(progressBar);
        const reasonRow = document.createElement("div");
        reasonRow.className = "forge-player-proof-row";
        (card.progression?.reasons || []).slice(0, 3).forEach((reason) => {
          const chip = document.createElement("span");
          chip.innerText = reason;
          reasonRow.appendChild(chip);
        });
        const nextAction = document.createElement("p");
        nextAction.className = "forge-player-next-action";
        nextAction.innerText = `Next: ${card.progression?.nextAction || "Earn more judged Arena proof."}`;
        progression.appendChild(progressionHead);
        progression.appendChild(progressTrack);
        progression.appendChild(reasonRow);
        progression.appendChild(nextAction);
        article.appendChild(top);
        article.appendChild(stats);
        article.appendChild(progression);
        article.appendChild(detail);
        playerCardGridNode.appendChild(article);
      });
    }

    if (botRosterNode) {
      botRosterNode.innerHTML = "";
      model.officialBots.forEach((bot) => {
        const article = document.createElement("article");
        article.className = "forge-official-bot";
        article.dataset.botAccent = bot.accent;
        const portrait = document.createElement("span");
        portrait.className = "forge-official-bot-icon";
        portrait.style.setProperty("--forge-bot-icon", `url("../${bot.asset}")`);
        const body = document.createElement("div");
        const state = document.createElement("span");
        state.className = "forge-hub-mode-meta";
        state.innerText = String(bot.state || "active").toUpperCase();
        const title = document.createElement("strong");
        title.innerText = bot.name;
        const role = document.createElement("span");
        role.className = "forge-official-bot-role";
        role.innerText = bot.role;
        const directive = document.createElement("p");
        directive.innerText = bot.directive;
        const lock = document.createElement("span");
        lock.className = "forge-official-bot-lock";
        lock.innerText = bot.lockNote;
        body.appendChild(state);
        body.appendChild(title);
        body.appendChild(role);
        body.appendChild(directive);
        body.appendChild(lock);
        article.appendChild(portrait);
        article.appendChild(body);
        botRosterNode.appendChild(article);
      });
    }

    if (starterShelfNode) {
      starterShelfNode.innerHTML = "";
      model.starterGames.forEach((game) => {
        const article = document.createElement("article");
        article.className = "forge-starter-game";
        article.style.setProperty("--forge-starter-cover", `url("../${game.asset}")`);
        const tag = document.createElement("span");
        tag.className = "forge-hub-mode-meta";
        tag.innerText = game.tag;
        const title = document.createElement("strong");
        title.innerText = game.title;
        const summary = document.createElement("p");
        summary.innerText = game.summary;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "forge-arena-inline-button";
        button.dataset.forgeStarterTemplate = game.templateId;
        button.innerText = "Build This";
        article.appendChild(tag);
        article.appendChild(title);
        article.appendChild(summary);
        article.appendChild(button);
        starterShelfNode.appendChild(article);
      });
    }

    if (officialBuildGridNode) {
      officialBuildGridNode.innerHTML = "";
      model.officialBuilds.forEach((build) => {
        const article = document.createElement("article");
        article.className = "forge-official-build-card";
        article.style.setProperty("--forge-official-build-cover", `url("../${build.asset}")`);
        const header = document.createElement("div");
        header.className = "forge-official-build-head";
        const meta = document.createElement("span");
        meta.className = "forge-hub-mode-meta";
        meta.innerText = `${build.bot} - ${build.version}`;
        const gameType = document.createElement("span");
        gameType.className = "forge-official-build-type";
        gameType.innerText = build.gameType;
        header.appendChild(meta);
        header.appendChild(gameType);
        const title = document.createElement("strong");
        title.innerText = build.title;
        const skill = document.createElement("p");
        skill.innerText = `Skill yield: ${build.skillYield}`;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "forge-arena-inline-button";
        button.dataset.forgeOfficialBuildTemplate = build.templateId;
        button.dataset.forgeOfficialBuildPrompt = build.prompt;
        button.innerText = "Try Build";
        article.appendChild(header);
        article.appendChild(title);
        article.appendChild(skill);
        article.appendChild(button);
        officialBuildGridNode.appendChild(article);
      });
    }

    if (pipelineNode) {
      pipelineNode.innerHTML = "";
      model.buildPipeline.forEach((step, index) => {
        const article = document.createElement("article");
        article.className = "forge-build-step";
        const number = document.createElement("span");
        number.className = "forge-build-step-number";
        number.innerText = String(index + 1).padStart(2, "0");
        const body = document.createElement("div");
        const label = document.createElement("span");
        label.className = "forge-hub-mode-meta";
        label.innerText = step.label;
        const title = document.createElement("strong");
        title.innerText = step.title;
        const detail = document.createElement("p");
        detail.innerText = step.detail;
        body.appendChild(label);
        body.appendChild(title);
        body.appendChild(detail);
        article.appendChild(number);
        article.appendChild(body);
        pipelineNode.appendChild(article);
      });
    }

    if (rankPreviewNode) {
      rankPreviewNode.innerHTML = "";
      model.communityRankPreview.forEach((entry) => {
        const item = document.createElement("li");
        item.className = "forge-community-rank-row";
        const rank = document.createElement("span");
        rank.className = "forge-community-rank-number";
        rank.innerText = `#${entry.rank}`;
        const card = matchHubPlayerCard(`${entry.title} ${entry.meta} ${entry.detail}`);
        const avatar = document.createElement("span");
        avatar.className = "forge-community-rank-avatar";
        if (card?.avatarAsset) {
          avatar.style.setProperty("--forge-community-rank-avatar", `url("../${card.avatarAsset}")`);
        }
        const body = document.createElement("div");
        const title = document.createElement("strong");
        title.innerText = entry.title;
        const meta = document.createElement("span");
        meta.className = "forge-arena-list-meta";
        meta.innerText = card
          ? `${entry.meta} - ${card.rank} Lv ${card.level} ${card.arenaClass}`
          : entry.meta;
        const detail = document.createElement("p");
        detail.innerText = entry.detail;
        body.appendChild(title);
        body.appendChild(meta);
        body.appendChild(detail);
        const score = document.createElement("span");
        score.className = "forge-community-rank-score";
        score.innerText = entry.score;
        item.appendChild(rank);
        item.appendChild(avatar);
        item.appendChild(body);
        item.appendChild(score);
        rankPreviewNode.appendChild(item);
      });
    }

    if (growthRouteGridNode) {
      growthRouteGridNode.innerHTML = "";
      model.bossGrowthTracks.forEach((track) => {
        const article = document.createElement("article");
        article.className = "forge-growth-route-card";
        const icon = document.createElement("span");
        icon.className = "forge-growth-route-icon";
        icon.style.setProperty("--forge-growth-route-icon", `url("../${track.asset}")`);
        const body = document.createElement("div");
        const meta = document.createElement("span");
        meta.className = "forge-hub-mode-meta";
        meta.innerText = `${track.label} - ${track.status}`;
        const title = document.createElement("strong");
        title.innerText = track.title;
        const detail = document.createElement("p");
        detail.innerText = track.detail;
        const proof = document.createElement("span");
        proof.className = "forge-growth-route-proof";
        proof.innerText = `Proof route: ${track.proof}`;
        body.appendChild(meta);
        body.appendChild(title);
        body.appendChild(detail);
        body.appendChild(proof);
        article.appendChild(icon);
        article.appendChild(body);
        growthRouteGridNode.appendChild(article);
      });
    }

    if (skillChallengeGridNode) {
      skillChallengeGridNode.innerHTML = "";
      model.skillChallenges.forEach((challenge) => {
        const article = document.createElement("article");
        article.className = "forge-skill-challenge-card";
        article.style.setProperty("--forge-skill-challenge-cover", `url("../${challenge.asset}")`);
        const header = document.createElement("div");
        header.className = "forge-official-build-head";
        const meta = document.createElement("span");
        meta.className = "forge-hub-mode-meta";
        meta.innerText = `${challenge.category} - ${challenge.buildType}`;
        const scoring = document.createElement("span");
        scoring.className = "forge-official-build-type";
        scoring.innerText = challenge.scoringRule;
        header.appendChild(meta);
        header.appendChild(scoring);
        const title = document.createElement("strong");
        title.innerText = challenge.title;
        const summary = document.createElement("p");
        summary.innerText = challenge.summary;
        const learn = document.createElement("span");
        learn.className = "forge-growth-route-proof";
        learn.innerText = `Skill candidate: ${challenge.skillCandidate}. ${challenge.learnWhy}`;
        const proof = document.createElement("span");
        proof.className = "forge-skill-proof-route";
        proof.innerText = `Proof: ${challenge.proofRoute}`;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "forge-arena-inline-button";
        button.dataset.forgeSkillChallengeId = challenge.id;
        button.dataset.forgeSkillChallengeTitle = challenge.title;
        button.dataset.forgeSkillChallengeSummary = `${challenge.summary} Prompt: ${challenge.prompt}`;
        button.dataset.forgeSkillChallengeScoring = challenge.scoringRule;
        button.dataset.forgeSkillChallengeBonus = String(challenge.scoreBonus || 0);
        button.dataset.forgeSkillChallengeResult = `Skill candidate ${challenge.skillCandidate}; proof route: ${challenge.proofRoute}.`;
        button.dataset.forgeSkillChallengeArtifact = challenge.outputContract.artifact;
        button.dataset.forgeSkillChallengeStudy = challenge.outputContract.studyPattern;
        button.dataset.forgeSkillChallengePromotion = challenge.outputContract.promotionRoute;
        button.innerText = "Stage Challenge";
        article.appendChild(header);
        article.appendChild(title);
        article.appendChild(summary);
        article.appendChild(learn);
        article.appendChild(proof);
        article.appendChild(button);
        skillChallengeGridNode.appendChild(article);
      });
    }

    if (learningOutputGridNode) {
      learningOutputGridNode.innerHTML = "";
      model.skillLearningPreview.forEach((learning) => {
        const article = document.createElement("article");
        article.className = "forge-learning-output-card";
        const title = document.createElement("strong");
        title.innerText = learning.title;
        const artifact = document.createElement("p");
        artifact.innerText = learning.artifact;
        const skill = document.createElement("span");
        skill.className = "forge-growth-route-proof";
        skill.innerText = learning.skillCandidate;
        const study = document.createElement("span");
        study.className = "forge-skill-proof-route";
        study.innerText = `Study: ${learning.studyPattern}`;
        const promotion = document.createElement("span");
        promotion.className = "forge-learning-promotion-route";
        promotion.innerText = learning.promotionRoute;
        article.appendChild(title);
        article.appendChild(artifact);
        article.appendChild(skill);
        article.appendChild(study);
        article.appendChild(promotion);
        learningOutputGridNode.appendChild(article);
      });
    }

    if (planSpineGridNode) {
      planSpineGridNode.innerHTML = "";
      model.planSpineContract.forEach((item) => {
        const article = document.createElement("article");
        article.className = "forge-plan-spine-card";
        const meta = document.createElement("span");
        meta.className = "forge-hub-mode-meta";
        meta.innerText = `${item.owner} - ${item.status}`;
        const title = document.createElement("strong");
        title.innerText = item.label;
        const detail = document.createElement("p");
        detail.innerText = item.detail;
        const use = document.createElement("span");
        use.className = "forge-learning-promotion-route";
        use.innerText = `BABS use: ${item.babsUse}`;
        article.appendChild(meta);
        article.appendChild(title);
        article.appendChild(detail);
        article.appendChild(use);
        planSpineGridNode.appendChild(article);
      });
    }
  }

  persistForgeArcadeState() {
    saveForgeArcadeState(this.forgeArcadeState);
  }

  renderForgeArcade() {
    const state = this.forgeArcadeState || loadForgeArcadeState();
    this.forgeArcadeState = state;
    const promptInput = document.getElementById("forge-arcade-prompt");
    const templateInput = document.getElementById("forge-arcade-template");
    const lineageNode = document.getElementById("forge-arcade-lineage");
    const statusNode = document.getElementById("forge-arcade-status");
    const titleNode = document.getElementById("forge-arcade-title");
    const summaryNode = document.getElementById("forge-arcade-summary");
    const runtimeNode = document.getElementById("forge-arcade-runtime");
    const safetyNode = document.getElementById("forge-arcade-safety");
    const scoreNode = document.getElementById("forge-arcade-score");
    const galleryNode = document.getElementById("forge-arcade-gallery");
    const validationNode = document.getElementById("forge-arcade-validation");

    if (promptInput && !promptInput.dataset.forgeArcadeHydrated) {
      promptInput.value = state.activeBrief || state.draftSpec?.prompt || "";
      promptInput.dataset.forgeArcadeHydrated = "true";
    }
    if (templateInput && !templateInput.dataset.forgeArcadeHydrated) {
      templateInput.innerHTML = "";
      FORGE_ARCADE_TEMPLATES.forEach((template) => {
        const option = document.createElement("option");
        option.value = template.id;
        option.innerText = template.label;
        templateInput.appendChild(option);
      });
      templateInput.value = state.activeTemplateId || state.draftSpec?.templateId || "survival-arena";
      templateInput.dataset.forgeArcadeHydrated = "true";
    }

    const spec = state.draftSpec;
    const summary = summarizeForgeGameSpec(spec);
    const validation = validateForgeGameSpec(spec);
    if (statusNode) statusNode.innerText = state.status || "Forge Arcade is ready.";
    if (titleNode) titleNode.innerText = summary.title;
    if (summaryNode) {
      summaryNode.innerText = `${summary.template} - ${summary.theme} - ${spec?.objective || "Survive and publish."}`;
    }
    if (runtimeNode) runtimeNode.innerText = `${summary.runtime} - ${summary.difficulty}`;
    if (safetyNode) safetyNode.innerText = summary.safety;
    if (scoreNode) {
      const playtest = state.lastPlaytest;
      scoreNode.innerText = playtest
        ? `${Number(playtest.score || 0)} pts - ${Number(playtest.shardsCollected || 0)} shards - ${Math.round(Number(playtest.survivedSeconds || 0))}s`
        : "No playtest yet";
    }
    if (validationNode) {
      validationNode.innerText = validation.ok
        ? "Spec validated: template data only, no host powers."
        : `Spec blocked: ${validation.errors.join(", ")}`;
      validationNode.dataset.state = validation.ok ? "ok" : "blocked";
    }
    if (lineageNode) {
      const latestRemix = Array.isArray(state.remixLineage) ? state.remixLineage[0] : null;
      lineageNode.innerText =
        latestRemix?.summary ||
        (spec?.remix?.parentSpecId
          ? `Remix generation ${Number(spec.remix.generation || 0)} from ${spec.remix.parentSpecId}.`
          : "Original Season Zero build.");
    }

    if (galleryNode) {
      galleryNode.innerHTML = "";
      const cards = Array.isArray(state.publishedCards) ? state.publishedCards : [];
      if (!cards.length) {
        const empty = document.createElement("article");
        empty.className = "forge-arcade-card";
        empty.innerText = "Published game cards will appear here after the first playtest.";
        galleryNode.appendChild(empty);
      } else {
        cards.slice(0, 6).forEach((card) => {
          const article = document.createElement("article");
          article.className = "forge-arcade-card";
          article.style.setProperty("--forge-arcade-card-cover", `url("../${card.cover}")`);
          const title = document.createElement("h3");
          title.innerText = card.title || "Forge Arcade Game";
          const meta = document.createElement("span");
          meta.className = "forge-arena-list-meta";
          const votes = card.votes || {};
          const voteScore =
            Number(votes.fun || 0) + Number(votes.useful || 0) + Number(votes.remix || 0);
          meta.innerText = `${String(card.templateLabel || card.templateId || "Template").toUpperCase()} - ${Number(card.score || 0)} pts - ${voteScore} vote(s)`;
          const detail = document.createElement("p");
          detail.innerText = card.proofSummary || card.objective || "Local published card.";
          const actions = document.createElement("div");
          actions.className = "forge-arcade-card-actions";
          [
            { label: "Fun", vote: "fun" },
            { label: "Useful", vote: "useful" },
            { label: "Remix", vote: "remix" },
          ].forEach((action) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "forge-arena-inline-button";
            button.innerText = action.label;
            button.addEventListener("click", () => this.voteForgeArcadeCard(card.id, action.vote));
            actions.appendChild(button);
          });
          const remixButton = document.createElement("button");
          remixButton.type = "button";
          remixButton.className = "forge-arena-inline-button forge-arena-inline-button--secondary";
          remixButton.innerText = "Build Variant";
          remixButton.addEventListener("click", () => this.remixForgeArcadeCard(card.id));
          actions.appendChild(remixButton);
          article.appendChild(title);
          article.appendChild(meta);
          article.appendChild(detail);
          article.appendChild(actions);
          galleryNode.appendChild(article);
        });
      }
    }

    this.drawForgeArcadeScene();
  }

  setupForgeArcadeActions() {
    const promptInput = document.getElementById("forge-arcade-prompt");
    const templateInput = document.getElementById("forge-arcade-template");
    const buildButton = document.getElementById("forge-arcade-build");
    const startButton = document.getElementById("forge-arcade-start");
    const iterateButton = document.getElementById("forge-arcade-iterate");
    const publishButton = document.getElementById("forge-arcade-publish");
    const resetButton = document.getElementById("forge-arcade-reset");

    const rebuildFromPrompt = ({ harder = false } = {}) => {
      const prompt = String(promptInput?.value || this.forgeArcadeState?.activeBrief || "").trim();
      const templateId =
        String(templateInput?.value || this.forgeArcadeState?.activeTemplateId || "").trim() ||
        "survival-arena";
      const iteration = Number(this.forgeArcadeState?.draftSpec?.version || 1) + (harder ? 1 : 0);
      const previousSpec = this.forgeArcadeState?.draftSpec || null;
      const spec = buildForgeGameSpecFromPrompt(prompt, {
        harder,
        iteration,
        templateId,
        parentSpecId: harder ? previousSpec?.id || null : null,
        generation: harder ? Number(previousSpec?.remix?.generation || 0) + 1 : 0,
        remixNote: harder ? "Iterated locally from the previous draft." : "",
      });
      this.forgeArcadeState = {
        ...(this.forgeArcadeState || loadForgeArcadeState()),
        activeBrief: prompt || spec.prompt,
        activeTemplateId: spec.templateId,
        draftSpec: spec,
        lastPlaytest: null,
        status: harder
          ? `BOSS rebuilt ${spec.templateLabel} with a harder pattern.`
          : `BOSS built a playable ${spec.templateLabel} draft from the brief.`,
      };
      if (harder && previousSpec?.id) {
        this.forgeArcadeState.remixLineage = [
          {
            parentSpecId: previousSpec.id,
            childSpecId: spec.id,
            summary: `Remixed ${previousSpec.title} into ${spec.title}.`,
            recordedAt: Date.now(),
          },
          ...(this.forgeArcadeState.remixLineage || []),
        ].slice(0, 12);
      }
      this.persistForgeArcadeState();
      this.stopForgeArcadeRuntime();
      this.renderForgeArcade();
    };

    buildButton?.addEventListener("click", () => rebuildFromPrompt());
    iterateButton?.addEventListener("click", () => rebuildFromPrompt({ harder: true }));
    startButton?.addEventListener("click", () => this.startForgeArcadeRuntime());
    publishButton?.addEventListener("click", () => this.publishForgeArcadeGame());
    resetButton?.addEventListener("click", () => {
      this.stopForgeArcadeRuntime();
      this.forgeArcadeState = loadForgeArcadeState({ getItem: () => null, setItem: () => {} });
      this.persistForgeArcadeState();
      if (promptInput) promptInput.value = this.forgeArcadeState.activeBrief;
      if (templateInput) templateInput.value = this.forgeArcadeState.activeTemplateId;
      this.renderForgeArcade();
    });

    window.addEventListener("keydown", (event) => {
      const keys = ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"];
      if (keys.includes(String(event.key || "").toLowerCase())) {
        this.forgeArcadeKeys.add(String(event.key).toLowerCase());
      }
    });
    window.addEventListener("keyup", (event) => {
      this.forgeArcadeKeys.delete(String(event.key || "").toLowerCase());
    });
  }

  voteForgeArcadeCard(cardId, voteKind) {
    const state = this.forgeArcadeState || loadForgeArcadeState();
    const cards = Array.isArray(state.publishedCards) ? state.publishedCards : [];
    const safeVote = ["fun", "useful", "remix"].includes(voteKind) ? voteKind : "fun";
    this.forgeArcadeState = {
      ...state,
      publishedCards: cards.map((card) => {
        if (card.id !== cardId) return card;
        const votes = card.votes || {};
        return {
          ...card,
          votes: {
            fun: Number(votes.fun || 0) + (safeVote === "fun" ? 1 : 0),
            useful: Number(votes.useful || 0) + (safeVote === "useful" ? 1 : 0),
            remix: Number(votes.remix || 0) + (safeVote === "remix" ? 1 : 0),
          },
        };
      }),
      communityVotes: {
        ...(state.communityVotes || {}),
        [cardId]: {
          ...((state.communityVotes || {})[cardId] || {}),
          [safeVote]: Number((state.communityVotes || {})[cardId]?.[safeVote] || 0) + 1,
        },
      },
      status: `Recorded a local ${safeVote} vote for this Forge Arcade card.`,
    };
    this.persistForgeArcadeState();
    this.renderForgeArcade();
  }

  remixForgeArcadeCard(cardId) {
    const state = this.forgeArcadeState || loadForgeArcadeState();
    const card = (Array.isArray(state.publishedCards) ? state.publishedCards : []).find(
      (entry) => entry.id === cardId,
    );
    if (!card) {
      this.forgeArcadeState.status = "Remix blocked: card not found.";
      this.renderForgeArcade();
      return;
    }
    const prompt = `Remix ${card.title} with a sharper hook, clearer scoring, and stronger co-op BOSS callouts.`;
    const spec = buildForgeGameSpecFromPrompt(prompt, {
      templateId: card.templateId || "survival-arena",
      parentSpecId: card.specId || card.id,
      generation: Number(card.remix?.generation || 0) + 1,
      remixNote: `Local remix from ${card.title}.`,
      harder: true,
    });
    this.forgeArcadeState = {
      ...state,
      activeBrief: prompt,
      activeTemplateId: spec.templateId,
      draftSpec: spec,
      lastPlaytest: null,
      remixLineage: [
        {
          parentSpecId: card.specId || card.id,
          childSpecId: spec.id,
          summary: `Variant drafted from ${card.title}.`,
          recordedAt: Date.now(),
        },
        ...(state.remixLineage || []),
      ].slice(0, 12),
      status: `BOSS drafted a remix variant from ${card.title}.`,
    };
    const promptInput = document.getElementById("forge-arcade-prompt");
    const templateInput = document.getElementById("forge-arcade-template");
    if (promptInput) promptInput.value = prompt;
    if (templateInput) templateInput.value = spec.templateId;
    this.persistForgeArcadeState();
    this.stopForgeArcadeRuntime();
    this.renderForgeArcade();
  }

  createForgeArcadeRuntime(spec) {
    const idHash = String(spec?.id || "forge-game-7").replace(/[^0-9a-f]/gi, "").slice(-8);
    const seed = Number.parseInt(idHash || "7", 16) || 7;
    const random = (index) => {
      const value = Math.sin(seed + index * 999) * 10000;
      return value - Math.floor(value);
    };
    const hazards = Array.from({ length: Number(spec?.rules?.hazardCount || 6) }, (_, index) => ({
      x: 60 + random(index) * 520,
      y: 54 + random(index + 20) * 280,
      vx: (random(index + 40) > 0.5 ? 1 : -1) * (70 + random(index + 60) * 70),
      vy: (random(index + 80) > 0.5 ? 1 : -1) * (55 + random(index + 100) * 60),
      radius: 12 + random(index + 120) * 8,
    }));
    const pickups = Array.from({ length: Number(spec?.rules?.pickupCount || 6) }, (_, index) => ({
      x: 70 + random(index + 140) * 500,
      y: 64 + random(index + 160) * 260,
      collected: false,
    }));
    return {
      running: true,
      startedAt: performance.now(),
      lastFrameAt: performance.now(),
      player: { x: 320, y: 190, radius: 13 },
      companion: { x: 286, y: 214, radius: 10 },
      hazards,
      pickups,
      shardsCollected: 0,
      score: 0,
      survivedSeconds: 0,
      beaconIntegrity: spec?.templateId === "boss-defense" ? 100 : null,
      message: "BOSS: keep moving and collect proof shards.",
      animationId: null,
    };
  }

  startForgeArcadeRuntime() {
    const spec = this.forgeArcadeState?.draftSpec;
    const validation = validateForgeGameSpec(spec);
    if (!validation.ok) {
      this.forgeArcadeState.status = `Cannot start: ${validation.errors.join(", ")}`;
      this.renderForgeArcade();
      return;
    }
    this.stopForgeArcadeRuntime();
    this.forgeArcadeRuntime = this.createForgeArcadeRuntime(spec);
    this.forgeArcadeState.status = "Playtest running. Move with WASD or arrow keys.";
    this.persistForgeArcadeState();
    this.tickForgeArcadeRuntime();
  }

  stopForgeArcadeRuntime() {
    if (this.forgeArcadeRuntime?.animationId) {
      cancelAnimationFrame(this.forgeArcadeRuntime.animationId);
    }
    this.forgeArcadeRuntime = null;
  }

  tickForgeArcadeRuntime() {
    const runtime = this.forgeArcadeRuntime;
    const spec = this.forgeArcadeState?.draftSpec;
    if (!runtime || !spec) return;

    const now = performance.now();
    const delta = Math.min(0.04, Math.max(0.001, (now - runtime.lastFrameAt) / 1000));
    runtime.lastFrameAt = now;
    runtime.survivedSeconds = (now - runtime.startedAt) / 1000;
    const speed = Number(spec.rules?.playerSpeed || 250);
    const keys = this.forgeArcadeKeys || new Set();
    const dx =
      (keys.has("arrowright") || keys.has("d") ? 1 : 0) -
      (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
    const dy =
      (keys.has("arrowdown") || keys.has("s") ? 1 : 0) -
      (keys.has("arrowup") || keys.has("w") ? 1 : 0);
    const normalizer = dx && dy ? Math.SQRT1_2 : 1;
    runtime.player.x = Math.max(24, Math.min(616, runtime.player.x + dx * speed * normalizer * delta));
    runtime.player.y = Math.max(24, Math.min(356, runtime.player.y + dy * speed * normalizer * delta));
    runtime.companion.x += (runtime.player.x - 38 - runtime.companion.x) * Math.min(1, delta * 5);
    runtime.companion.y += (runtime.player.y + 24 - runtime.companion.y) * Math.min(1, delta * 5);

    for (const hazard of runtime.hazards) {
      hazard.x += hazard.vx * delta;
      hazard.y += hazard.vy * delta;
      if (hazard.x < 18 || hazard.x > 622) hazard.vx *= -1;
      if (hazard.y < 18 || hazard.y > 362) hazard.vy *= -1;
      const distance = Math.hypot(runtime.player.x - hazard.x, runtime.player.y - hazard.y);
      if (distance < runtime.player.radius + hazard.radius) {
        this.finishForgeArcadePlaytest("hit");
        return;
      }
      if (spec.templateId === "boss-defense" && runtime.beaconIntegrity !== null) {
        const beaconDistance = Math.hypot(320 - hazard.x, 190 - hazard.y);
        if (beaconDistance < hazard.radius + 42) {
          runtime.beaconIntegrity = Math.max(0, runtime.beaconIntegrity - 18 * delta);
          runtime.message = `BOSS: beacon integrity ${Math.round(runtime.beaconIntegrity)}%.`;
          if (runtime.beaconIntegrity <= 0) {
            this.finishForgeArcadePlaytest("beacon-lost");
            return;
          }
        }
      }
    }

    for (const pickup of runtime.pickups) {
      if (pickup.collected) continue;
      const distance = Math.hypot(runtime.player.x - pickup.x, runtime.player.y - pickup.y);
      if (distance < runtime.player.radius + 14) {
        pickup.collected = true;
        runtime.shardsCollected += 1;
        runtime.message = "BOSS: proof shard secured. Keep rotating.";
      }
    }

    runtime.score =
      Math.floor(runtime.survivedSeconds * Number(spec.rules?.survivalScorePerSecond || 8)) +
      runtime.shardsCollected * Number(spec.rules?.scorePerShard || 120);
    const duration = Number(spec.rules?.durationSeconds || 60);
    const collectAll = spec.rules?.winCondition === "collect-all";
    const protectedBeacon =
      spec.rules?.winCondition === "protect-beacon" && runtime.beaconIntegrity > 0;
    if (
      (collectAll && runtime.shardsCollected >= runtime.pickups.length) ||
      (!collectAll && runtime.survivedSeconds >= duration) ||
      (protectedBeacon && runtime.survivedSeconds >= duration)
    ) {
      this.finishForgeArcadePlaytest("extracted");
      return;
    }

    this.drawForgeArcadeScene();
    runtime.animationId = requestAnimationFrame(() => this.tickForgeArcadeRuntime());
  }

  finishForgeArcadePlaytest(outcome) {
    const runtime = this.forgeArcadeRuntime;
    if (!runtime) return;
    const playtest = {
      outcome,
      score: runtime.score,
      shardsCollected: runtime.shardsCollected,
      survivedSeconds: runtime.survivedSeconds,
      recordedAt: Date.now(),
    };
    this.stopForgeArcadeRuntime();
    this.forgeArcadeState = {
      ...(this.forgeArcadeState || loadForgeArcadeState()),
      lastPlaytest: playtest,
      status:
        outcome === "extracted"
          ? "Playtest complete: extraction survived. Ready to publish or iterate."
          : outcome === "beacon-lost"
            ? "Playtest complete: BOSS beacon fell. Iterate the defense pattern."
          : "Playtest complete: player was hit. BOSS can iterate the arena.",
    };
    this.persistForgeArcadeState();
    this.renderForgeArcade();
  }

  drawForgeArcadeScene() {
    const canvas = document.getElementById("forge-arcade-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const spec = this.forgeArcadeState?.draftSpec;
    const runtime = this.forgeArcadeRuntime;
    const palette = spec?.visual?.palette || ["#7dffb4", "#ffd56a", "#101820"];
    context.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, palette[2] || "#101820");
    gradient.addColorStop(1, "#05080d");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "rgba(125, 255, 180, 0.16)";
    context.lineWidth = 1;
    for (let x = 40; x < canvas.width; x += 40) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
    for (let y = 40; y < canvas.height; y += 40) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }

    const scene = runtime || this.createForgeArcadeRuntime(spec || {});
    if (spec?.templateId === "boss-defense") {
      context.fillStyle = "rgba(133, 245, 255, 0.16)";
      context.beginPath();
      context.arc(320, 190, 44, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "rgba(133, 245, 255, 0.78)";
      context.lineWidth = 3;
      context.beginPath();
      context.arc(320, 190, 28, 0, Math.PI * 2);
      context.stroke();
    }
    for (const pickup of scene.pickups) {
      if (pickup.collected) continue;
      context.fillStyle = palette[1] || "#ffd56a";
      context.beginPath();
      context.arc(pickup.x, pickup.y, 7, 0, Math.PI * 2);
      context.fill();
    }
    for (const hazard of scene.hazards) {
      context.fillStyle = "rgba(255, 92, 122, 0.88)";
      context.beginPath();
      context.arc(hazard.x, hazard.y, hazard.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = palette[1] || "#ffd56a";
    context.beginPath();
    context.arc(scene.companion.x, scene.companion.y, scene.companion.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = palette[0] || "#7dffb4";
    context.beginPath();
    context.arc(scene.player.x, scene.player.y, scene.player.radius, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "rgba(239, 247, 244, 0.92)";
    context.font = "14px Outfit, sans-serif";
    context.fillText(
      runtime
        ? `${runtime.message} Score ${runtime.score}${runtime.beaconIntegrity !== null ? ` Beacon ${Math.round(runtime.beaconIntegrity)}%` : ""}`
        : "Press Start Playtest. WASD or arrow keys move the player.",
      18,
      28,
    );
  }

  publishForgeArcadeGame() {
    const spec = this.forgeArcadeState?.draftSpec;
    const validation = validateForgeGameSpec(spec);
    if (!validation.ok) {
      this.forgeArcadeState.status = `Publish blocked: ${validation.errors.join(", ")}`;
      this.renderForgeArcade();
      return;
    }
    const card = createForgeGameCardFromSpec(spec, this.forgeArcadeState.lastPlaytest, {
      cardId: `${spec.id}-${Date.now().toString(36)}`,
      publishedAt: Date.now(),
      plays: this.forgeArcadeState.lastPlaytest ? 1 : 0,
    });
    this.forgeArcadeState = {
      ...this.forgeArcadeState,
      publishedCards: [card, ...(this.forgeArcadeState.publishedCards || [])].slice(0, 12),
      selectedCardId: card.id,
      status: `Published ${card.title} as a local Forge Arcade game card.`,
    };
    this.persistForgeArcadeState();
    this.renderForgeArcade();
  }

  setupForgeArenaActions() {
    const createChallengeForm = document.getElementById("forge-arena-create-challenge-form");
    const createChallengeButton = document.getElementById("forge-arena-create-challenge");
    const featureActiveRunButton = document.getElementById("forge-arena-feature-active-run");
    const runLocalProofButton = document.getElementById("forge-arena-run-local-proof");
    const runMajorBossTestButton = document.getElementById("forge-arena-run-major-boss-test");
    const runOvernightBossTestButton = document.getElementById(
      "forge-arena-run-overnight-boss-test",
    );
    const recordCoBuildButton = document.getElementById("forge-arena-record-co-build");
    const saveReplayButton = document.getElementById("forge-arena-save-replay");
    const pairSelectedRunButton = document.getElementById("forge-arena-pair-selected-run");
    const pairRunSelectInput = document.getElementById("forge-arena-pair-run-select");
    const judgeSelectedButton = document.getElementById("forge-arena-judge-selected");
    const challengeFilterInput = document.getElementById("forge-arena-challenge-filter");
    const judgeVerdictInput = document.getElementById("forge-arena-judge-verdict");
    const judgeReviewCategoryInput = document.getElementById("forge-arena-judge-review-category");
    const judgeScoreDeltaInput = document.getElementById("forge-arena-judge-score-delta");
    const judgeSummaryInput = document.getElementById("forge-arena-judge-summary");
    const cancelEditButton = document.getElementById("forge-arena-cancel-edit");
    const scrollChallengesButton = document.getElementById("forge-arena-scroll-challenges");
    const hubNode = document.getElementById("forge-game-hub");
    const entryPathsNode = document.getElementById("forge-arena-entry-paths");
    const profileForm = document.getElementById("forge-arena-profile-form");
    const profileSaveButton = document.getElementById("forge-arena-profile-save");
    const profilePublicInput = document.getElementById("forge-arena-profile-public-input");
    const profileBossInput = document.getElementById("forge-arena-profile-boss-input");
    const profileModeInput = document.getElementById("forge-arena-profile-mode-select");
    const profileRoleInput = document.getElementById("forge-arena-profile-role-select");
    const profilePathInput = document.getElementById("forge-arena-profile-path-select");
    const profileTaglineInput = document.getElementById("forge-arena-profile-tagline-input");
    const createTitleInput = document.getElementById("forge-arena-create-title");
    const createSummaryInput = document.getElementById("forge-arena-create-summary");
    const createStatusInput = document.getElementById("forge-arena-create-status");
    const createOwnerSessionInput = document.getElementById("forge-arena-create-owner-session");
    const createScoringRuleInput = document.getElementById("forge-arena-create-scoring-rule");
    const createScoreBonusInput = document.getElementById("forge-arena-create-score-bonus");
    const createResultSummaryInput = document.getElementById("forge-arena-create-result-summary");

    if (cancelEditButton) {
      cancelEditButton.addEventListener("click", () => this.resetForgeArenaChallengeForm());
    }

    if (scrollChallengesButton) {
      scrollChallengesButton.addEventListener("click", () => {
        document
          .getElementById("forge-arena-challenge-rail-panel")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    if (hubNode) {
      hubNode.addEventListener("click", (event) => {
        const skillChallengeButton = event.target.closest?.("[data-forge-skill-challenge-id]");
        if (skillChallengeButton) {
          const createTitleInput = document.getElementById("forge-arena-create-title");
          const createSummaryInput = document.getElementById("forge-arena-create-summary");
          const createStatusInput = document.getElementById("forge-arena-create-status");
          const createOwnerSessionInput = document.getElementById(
            "forge-arena-create-owner-session",
          );
          const createScoringRuleInput = document.getElementById(
            "forge-arena-create-scoring-rule",
          );
          const createScoreBonusInput = document.getElementById("forge-arena-create-score-bonus");
          const createResultSummaryInput = document.getElementById(
            "forge-arena-create-result-summary",
          );
          if (createTitleInput) {
            createTitleInput.value = skillChallengeButton.dataset.forgeSkillChallengeTitle || "";
          }
          if (createSummaryInput) {
            createSummaryInput.value =
              skillChallengeButton.dataset.forgeSkillChallengeSummary || "";
          }
          if (createStatusInput) createStatusInput.value = "open";
          if (createOwnerSessionInput) {
            createOwnerSessionInput.value = this.activeSessionKey || "agent:main:main";
          }
          if (createScoringRuleInput) {
            createScoringRuleInput.value =
              skillChallengeButton.dataset.forgeSkillChallengeScoring || "efficiency";
          }
          if (createScoreBonusInput) {
            createScoreBonusInput.value =
              skillChallengeButton.dataset.forgeSkillChallengeBonus || "0";
          }
          if (createResultSummaryInput) {
            const result = skillChallengeButton.dataset.forgeSkillChallengeResult || "";
            const artifact = skillChallengeButton.dataset.forgeSkillChallengeArtifact || "";
            const study = skillChallengeButton.dataset.forgeSkillChallengeStudy || "";
            const promotion = skillChallengeButton.dataset.forgeSkillChallengePromotion || "";
            createResultSummaryInput.value = [
              result,
              artifact ? `Expected artifact: ${artifact}` : "",
              study ? `Study pattern: ${study}` : "",
              promotion ? `Safe promotion route: ${promotion}` : "",
            ]
              .filter(Boolean)
              .join(" ");
          }
          this.forgeArenaActionState.createStatus = `Staged Skill Forge challenge \"${skillChallengeButton.dataset.forgeSkillChallengeTitle || "Productivity Challenge"}\". Review and create it from the Challenge Control Deck.`;
          this.renderForgeArenaFeed();
          document
            .getElementById("forge-arena-create-challenge-form")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }

        const officialBuildButton = event.target.closest?.("[data-forge-official-build-template]");
        if (officialBuildButton) {
          const templateInput = document.getElementById("forge-arcade-template");
          const promptInput = document.getElementById("forge-arcade-prompt");
          const templateId = officialBuildButton.dataset.forgeOfficialBuildTemplate || "survival-arena";
          if (templateInput) templateInput.value = templateId;
          if (promptInput) {
            promptInput.value =
              officialBuildButton.dataset.forgeOfficialBuildPrompt ||
              "BABS, load this official Arena build for my profile to try.";
          }
          document.getElementById("forge-arcade-build")?.click();
          document
            .getElementById("forge-arcade-panel")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }

        const starterButton = event.target.closest?.("[data-forge-starter-template]");
        if (starterButton) {
          const templateInput = document.getElementById("forge-arcade-template");
          const promptInput = document.getElementById("forge-arcade-prompt");
          const templateId = starterButton.dataset.forgeStarterTemplate || "survival-arena";
          if (templateInput) templateInput.value = templateId;
          if (promptInput) {
            promptInput.value = `BABS, build a polished ${starterButton.closest(".forge-starter-game")?.querySelector("strong")?.innerText || "starter game"} for a human and BOSS pair.`;
          }
          document.getElementById("forge-arcade-build")?.click();
          document
            .getElementById("forge-arcade-panel")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }

        const modeButton = event.target.closest?.("[data-forge-hub-target]");
        if (!modeButton) return;
        const targetId = modeButton.dataset.forgeHubTarget || "forge-game-hub";
        document
          .getElementById(targetId)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    if (runLocalProofButton) {
      runLocalProofButton.addEventListener("click", async () => {
        if (!this.activeBiosProfileId) {
          this.forgeArenaActionState.localStatus =
            "Create or select a BIOS profile before running the local Arena proving round.";
          this.renderForgeArenaFeed();
          return;
        }
        runLocalProofButton.setAttribute("disabled", "disabled");
        this.forgeArenaActionState.localStatus = "Running local BOSS proving round...";
        this.renderForgeArenaFeed();
        try {
          this.forgeArenaFeed = await this.forgeArena.runLocalBossProvingRound({
            profileId: this.activeBiosProfileId,
            bossLabel: this.forgeArenaProfile?.boss_display_name || this.agentName || "BOSS",
            artifactTitle: "BOSS Local Proving Run",
            artifactSummary:
              "BOSS created a local Forge Arena proof artifact, measured blocked paths, and recorded the result into BIOS memory, operating truth, and proof spine.",
            attemptedCapabilities: [
              "local artifact creation",
              "native memory record",
              "truthspine session update",
              "network publish",
            ],
          });
          const score = this.forgeArenaFeed.runs?.[0]?.score;
          this.forgeArenaActionState.localStatus =
            score === null || score === undefined
              ? "Local BOSS proving round recorded."
              : `Local BOSS proving round judged with score ${score}.`;
          this.renderForgeArenaFeed();
        } catch (err) {
          console.error("[AetherApp] Failed to run local Forge Arena proving round:", err);
          this.forgeArenaActionState.localStatus = `Local proving round failed: ${err?.message || "unknown error"}`;
          this.renderForgeArenaFeed();
        } finally {
          runLocalProofButton.removeAttribute("disabled");
        }
      });
    }

    if (runMajorBossTestButton) {
      runMajorBossTestButton.addEventListener("click", async () => {
        if (!this.activeBiosProfileId) {
          this.forgeArenaActionState.majorBossStatus =
            "Create or select a real BOSS profile before running the Major BOSS system test.";
          this.renderForgeArenaFeed();
          return;
        }
        runMajorBossTestButton.setAttribute("disabled", "disabled");
        this.forgeArenaActionState.majorBossStatus =
          "Running real packaged Major BOSS system test through local supervisor and Forge Arena...";
        this.renderForgeArenaFeed();
        const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke || null;
        try {
          const report = await runMajorBossSystemTest({
            profileId: this.activeBiosProfileId,
            agentName: this.forgeArenaProfile?.boss_display_name || this.agentName || "BOSS",
            runtimeMode: "packaged-app-real-runtime",
            runtimeClient: this.getRuntimeTransportClient(),
            forgeArena: this.forgeArena,
            recordProofEvent: (event) => recordBiosProofEventSafe(event),
            recordTruthSessionUpdate: async (input) => {
              if (typeof tauriInvoke !== "function") {
                throw new Error("Major BOSS system test needs packaged native truth recording.");
              }
              return tauriInvoke("record_bios_truth_session_update", { input });
            },
          });
          this.majorBossSystemTestReport = report;
          this.forgeArenaFeed = await this.forgeArena.getLocalSnapshot({
            profileId: this.activeBiosProfileId,
          });
          this.forgeArenaActionState.majorBossStatus =
            report.status === "passed_local_major_boss_contract"
              ? "Major BOSS system test passed through real runtime path."
              : `Major BOSS system test recorded: ${report.status}.`;
          await appendBiosDebugLog("major_boss_system_test.completed", {
            runId: report.run_id,
            runtimeMode: report.runtime_mode,
            status: report.status,
            scenarioCount: report.scenario_count,
          });
          this.renderForgeArenaFeed();
        } catch (err) {
          console.error("[AetherApp] Failed to run Major BOSS system test:", err);
          this.forgeArenaActionState.majorBossStatus = `Major BOSS system test blocked: ${err?.message || "unknown error"}`;
          await appendBiosDebugLog("major_boss_system_test.blocked", {
            profileId: this.activeBiosProfileId,
            detail: err?.message || String(err),
          });
          this.renderForgeArenaFeed();
        } finally {
          runMajorBossTestButton.removeAttribute("disabled");
        }
      });
    }

    if (runOvernightBossTestButton) {
      runOvernightBossTestButton.addEventListener("click", async () => {
        if (!this.activeBiosProfileId) {
          this.forgeArenaActionState.overnightStatus =
            "Create or select a real BOSS profile before running the overnight Arena test.";
          this.renderForgeArenaFeed();
          return;
        }
        runOvernightBossTestButton.setAttribute("disabled", "disabled");
        if (runMajorBossTestButton) {
          runMajorBossTestButton.setAttribute("disabled", "disabled");
        }
        this.forgeArenaActionState.overnightStatus =
          "Running 50-scenario overnight Arena test: 3 scenarios per batch, 2 minute cooldown between batches.";
        this.renderForgeArenaFeed();
        const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke || null;
        try {
          const report = await runMajorBossOvernightArenaRun({
            profileId: this.activeBiosProfileId,
            agentName: this.forgeArenaProfile?.boss_display_name || this.agentName || "BOSS",
            runtimeMode: "packaged-app-real-runtime",
            runtimeClient: this.getRuntimeTransportClient(),
            forgeArena: this.forgeArena,
            batchSize: 3,
            cooldownMs: this.majorBossOvernightCooldownMs ?? 2 * 60 * 1000,
            maxScenarios: 50,
            maxGpuTempC: 82,
            recordProofEvent: (event) => recordBiosProofEventSafe(event),
            recordTruthSessionUpdate: async (input) => {
              if (typeof tauriInvoke !== "function") {
                throw new Error("Major BOSS overnight run needs packaged native truth recording.");
              }
              return tauriInvoke("record_bios_truth_session_update", { input });
            },
            readGpuTelemetry:
              typeof tauriInvoke === "function" ? () => tauriInvoke("bios_gpu_telemetry") : null,
            onProgress: async (progress) => {
              const completed = `${progress.completedScenarios}/${progress.totalScenarios}`;
              this.forgeArenaRunLogSummary = {
                state: progress.status === "cooldown" ? "running-or-interrupted" : "running",
                title:
                  progress.status === "cooldown"
                    ? "Overnight field run cooling down"
                    : "Overnight field run active",
                progressLabel: `${completed} scenarios`,
                progressPercent: progress.totalScenarios
                  ? Math.max(
                      0,
                      Math.min(
                        100,
                        Math.round(
                          (Number(progress.completedScenarios || 0) /
                            Number(progress.totalScenarios || 1)) *
                            100,
                        ),
                      ),
                    )
                  : 0,
                detail:
                  progress.status === "cooldown"
                    ? `Batch ${progress.batchIndex} is complete; BIOS AI is cooling down before the next 3 scenarios.`
                    : `Batch ${progress.batchIndex} completed and BIOS AI is recording proof.`,
                runId: progress.runId || "",
                completedScenarios: Number(progress.completedScenarios || 0),
                totalScenarios: Number(progress.totalScenarios || 50),
                batchIndex: Number(progress.batchIndex || 0),
                latestEvent: "major_boss_overnight.progress",
                recordHash: "",
                source: "live-progress",
              };
              this.forgeArenaActionState.overnightStatus =
                progress.status === "cooldown"
                  ? `Overnight Arena cooldown after batch ${progress.batchIndex}: ${completed} scenarios complete, ${progress.judgedArtifacts ?? 0} judged artifact(s); waiting 2 minutes before the next 3.`
                  : `Overnight Arena batch ${progress.batchIndex} complete: ${completed} scenarios recorded, ${progress.judgedArtifacts ?? 0} judged artifact(s).`;
              await appendBiosDebugLog("major_boss_overnight.progress", {
                runId: progress.runId,
                batchIndex: progress.batchIndex,
                completedScenarios: progress.completedScenarios,
                totalScenarios: progress.totalScenarios,
                judgedArtifacts: progress.judgedArtifacts,
                status: progress.status,
              });
              this.renderForgeArenaFeed();
            },
            wait: this.majorBossOvernightWait,
          });
          this.majorBossOvernightReport = report;
          this.majorBossSystemTestReport = report;
          this.forgeArenaFeed = await this.forgeArena.getLocalSnapshot({
            profileId: this.activeBiosProfileId,
          });
          this.forgeArenaActionState.overnightStatus =
            report.status === "passed_overnight_major_boss_contract"
              ? `Overnight Arena test completed through the real packaged runtime with ${report.reconciliation?.judged_artifacts ?? report.scenario_count} judged artifact(s) and ${report.reconciliation?.context_sleep_count ?? 0} context sleep(s).`
              : `Overnight Arena test recorded: ${report.status}.`;
          this.forgeArenaRunLogSummary = {
            state:
              report.status === "passed_overnight_major_boss_contract" ? "complete" : "partial",
            title:
              report.status === "passed_overnight_major_boss_contract"
                ? "Overnight field run completed"
                : "Overnight field run recorded",
            progressLabel: `${report.scenario_count || 0}/${report.scenario_count || 50} scenarios`,
            progressPercent: report.status === "passed_overnight_major_boss_contract" ? 100 : 0,
            detail: `${report.status}; ${report.reconciliation?.judged_artifacts ?? 0} judged artifact(s), ${report.reconciliation?.context_sleep_count ?? 0} context sleep(s), ${report.thermal_samples?.length ?? 0} thermal sample(s).`,
            runId: report.run_id || "",
            completedScenarios: Number(report.scenario_count || 0),
            totalScenarios: Number(report.scenario_count || 50),
            batchIndex: Number(report.batch_count || 0),
            latestEvent: "major_boss_overnight.completed",
            recordHash: "",
            source: "live-complete",
          };
          await appendBiosDebugLog("major_boss_overnight.completed", {
            runId: report.run_id,
            runtimeMode: report.runtime_mode,
            status: report.status,
            scenarioCount: report.scenario_count,
            batchCount: report.batch_count,
            judgedArtifacts: report.reconciliation?.judged_artifacts || 0,
            contextSleepCount: report.reconciliation?.context_sleep_count || 0,
            missingArtifactCount: report.reconciliation?.missing_artifact_count || 0,
            thermalSampleCount: report.thermal_samples?.length || 0,
          });
          this.renderForgeArenaFeed();
        } catch (err) {
          console.error("[AetherApp] Failed to run overnight Major BOSS Arena test:", err);
          this.forgeArenaActionState.overnightStatus = `Overnight Arena test stopped: ${err?.message || "unknown error"}`;
          this.forgeArenaRunLogSummary = {
            ...(this.forgeArenaRunLogSummary || summarizeForgeArenaOvernightLog("")),
            state: "partial",
            title: "Overnight field run stopped",
            detail: err?.message || "The overnight run stopped before completion.",
            latestEvent: "major_boss_overnight.blocked",
          };
          await appendBiosDebugLog("major_boss_overnight.blocked", {
            profileId: this.activeBiosProfileId,
            detail: err?.message || String(err),
          });
          this.renderForgeArenaFeed();
        } finally {
          runOvernightBossTestButton.removeAttribute("disabled");
          runMajorBossTestButton?.removeAttribute("disabled");
        }
      });
    }

    const recordLocalParticipation = async ({
      button,
      kind,
      title,
      summary,
      resultSummary,
      scoreBonus = 0,
    }) => {
      if (!this.activeBiosProfileId) {
        this.forgeArenaActionState.participationStatus =
          "Create or select a BIOS profile before recording local Arena participation.";
        this.renderForgeArenaFeed();
        return;
      }
      button?.setAttribute("disabled", "disabled");
      this.forgeArenaActionState.participationStatus = `Recording local ${String(kind || "submission").replace(/_/g, " ")}...`;
      this.renderForgeArenaFeed();
      try {
        this.forgeArenaFeed = await this.forgeArena.recordLocalParticipation({
          profileId: this.activeBiosProfileId,
          actorLabel: this.forgeArenaProfile?.boss_display_name || this.agentName || "BOSS",
          kind,
          title,
          summary,
          resultSummary,
          scoreBonus,
        });
        const score = this.forgeArenaFeed.runs?.[0]?.score;
        this.forgeArenaActionState.participationStatus =
          score === null || score === undefined
            ? `Local ${String(kind || "submission").replace(/_/g, " ")} recorded.`
            : `Local ${String(kind || "submission").replace(/_/g, " ")} recorded with score ${score}.`;
        this.renderForgeArenaFeed();
      } catch (err) {
        console.error("[AetherApp] Failed to record local Forge Arena participation:", err);
        this.forgeArenaActionState.participationStatus = `Local participation failed: ${err?.message || "unknown error"}`;
        this.renderForgeArenaFeed();
      } finally {
        button?.removeAttribute("disabled");
      }
    };

    if (recordCoBuildButton) {
      recordCoBuildButton.addEventListener("click", () =>
        recordLocalParticipation({
          button: recordCoBuildButton,
          kind: "co_build",
          title: `${this.agentName || "BOSS"} co-build contribution`,
          summary:
            "A local co-build contribution was recorded with contributor credit, shared build context, and a replayable trace.",
          resultSummary:
            "Co-build contribution saved locally with contributor credit and return-loop visibility.",
          scoreBonus: 3,
        }),
      );
    }

    if (saveReplayButton) {
      saveReplayButton.addEventListener("click", () =>
        recordLocalParticipation({
          button: saveReplayButton,
          kind: "replay",
          title: `${this.agentName || "BOSS"} replay note`,
          summary:
            "A local Arena replay note was saved so the user can revisit the result, score, proof, and next action.",
          resultSummary:
            "Replay saved locally with score, proof reference, and a clear next return point.",
          scoreBonus: 1,
        }),
      );
    }

    if (entryPathsNode) {
      entryPathsNode.addEventListener("click", (event) => {
        const button =
          event.target instanceof Element ? event.target.closest("[data-forge-entry-path]") : null;
        if (!button) return;
        const pathId = String(button.getAttribute("data-forge-entry-path") || "").trim();
        if (!pathId) return;
        this.handleForgeArenaEntryPath(pathId);
      });
    }

    if (
      profileForm &&
      profileSaveButton &&
      profilePublicInput &&
      profileBossInput &&
      profileModeInput &&
      profileRoleInput &&
      profilePathInput &&
      profileTaglineInput
    ) {
      profileForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const publicDisplayName = String(profilePublicInput.value || "").trim();
        const bossDisplayName = String(profileBossInput.value || "").trim();
        const presentationMode = String(profileModeInput.value || "duo").trim() || "duo";
        const entryRolePreference = String(profileRoleInput.value || "").trim();
        const firstPathPreference = String(profilePathInput.value || "").trim();
        const tagline = String(profileTaglineInput.value || "").trim();

        if (!this.activeBiosProfileId) {
          this.forgeArenaActionState.profileStatus =
            "Finish BIOS profile setup before entering connected Forge Arena.";
          this.renderForgeArenaFeed();
          return;
        }
        if (!publicDisplayName || !bossDisplayName) {
          this.forgeArenaActionState.profileStatus =
            "Choose both a public name and a BOSS name for Forge Arena.";
          this.renderForgeArenaFeed();
          return;
        }

        profileSaveButton.setAttribute("disabled", "disabled");
        this.forgeArenaActionState.profileStatus = "Saving Forge Arena identity...";
        this.renderForgeArenaFeed();
        try {
          const profile = await this.saveForgeArenaProfile(
            {
              publicDisplayName,
              bossDisplayName,
              presentationMode,
              entryRolePreference,
              firstPathPreference,
              tagline,
            },
            this.activeBiosProfileId,
          );
          this.forgeArenaActionState.profileStatus =
            presentationMode === "studio"
              ? `Arena studio identity saved for ${profile.public_display_name}.`
              : `Arena identity saved for ${profile.public_display_name} + ${profile.boss_display_name}.`;
          if (firstPathPreference) {
            this.handleForgeArenaEntryPath(firstPathPreference, { scroll: false });
          } else {
            this.renderForgeArenaFeed();
          }
        } catch (err) {
          console.error("[AetherApp] Failed to save Forge Arena profile:", err);
          this.forgeArenaActionState.profileStatus = `Forge Arena identity save failed: ${err?.message || "unknown error"}`;
          this.renderForgeArenaFeed();
        } finally {
          profileSaveButton.removeAttribute("disabled");
        }
      });
    }

    if (challengeFilterInput) {
      challengeFilterInput.addEventListener("change", () => {
        this.forgeArenaActionState.challengeFilter = String(challengeFilterInput.value || "all");
        this.renderForgeArenaFeed();
      });
    }

    if (pairRunSelectInput) {
      pairRunSelectInput.addEventListener("change", () => {
        this.forgeArenaActionState.selectedRunId = String(pairRunSelectInput.value || "");
      });
    }

    if (pairSelectedRunButton && pairRunSelectInput) {
      pairSelectedRunButton.addEventListener("click", async () => {
        const selectedChallenge = Array.isArray(this.forgeArenaFeed.challenges)
          ? this.forgeArenaFeed.challenges.find(
              (challenge) => challenge.id === this.forgeArenaActionState.selectedChallengeId,
            ) || this.forgeArenaFeed.challenges[0]
          : null;
        const runId = String(
          pairRunSelectInput.value || this.forgeArenaActionState.selectedRunId || "",
        ).trim();
        if (!selectedChallenge) {
          this.forgeArenaActionState.featureStatus =
            describeForgeArenaAction("pair-missing-challenge");
          this.renderForgeArenaFeed();
          return;
        }
        if (!runId) {
          this.forgeArenaActionState.featureStatus = describeForgeArenaAction("pair-missing-run", {
            title: selectedChallenge.title,
          });
          this.renderForgeArenaFeed();
          return;
        }

        pairSelectedRunButton.setAttribute("disabled", "disabled");
        this.forgeArenaActionState.featureStatus = describeForgeArenaAction("pair-pending", {
          title: selectedChallenge.title,
          runId,
        });
        this.renderForgeArenaFeed();
        try {
          await this.forgeArena.pairChallenge({
            challengeId: selectedChallenge.id,
            runId,
          });
          this.forgeArenaActionState.selectedChallengeId = selectedChallenge.id;
          this.forgeArenaActionState.selectedRunId = runId;
          this.forgeArenaActionState.featureStatus = describeForgeArenaAction("pair-success", {
            title: selectedChallenge.title,
            runId,
          });
          await this.refreshForgeArenaFeed({ connected: this.gateway.isConnected });
        } catch (err) {
          console.error("[AetherApp] Failed to pair Forge Arena challenge to run:", err);
          this.forgeArenaActionState.featureStatus = describeForgeArenaAction("pair-error", {
            title: selectedChallenge.title,
            detail: err?.message || "unknown error",
          });
          this.renderForgeArenaFeed();
        } finally {
          pairSelectedRunButton.removeAttribute("disabled");
        }
      });
    }

    if (
      judgeSelectedButton &&
      judgeVerdictInput &&
      judgeReviewCategoryInput &&
      judgeScoreDeltaInput &&
      judgeSummaryInput
    ) {
      judgeSelectedButton.addEventListener("click", async () => {
        const selectedChallenge = Array.isArray(this.forgeArenaFeed.challenges)
          ? this.forgeArenaFeed.challenges.find(
              (challenge) => challenge.id === this.forgeArenaActionState.selectedChallengeId,
            ) || this.forgeArenaFeed.challenges[0]
          : null;
        if (!selectedChallenge) {
          this.forgeArenaActionState.judgeStatus =
            describeForgeArenaAction("judge-missing-challenge");
          this.renderForgeArenaFeed();
          return;
        }

        judgeSelectedButton.setAttribute("disabled", "disabled");
        const verdict = String(judgeVerdictInput.value || "promote").trim() || "promote";
        const reviewCategory =
          String(
            judgeReviewCategoryInput.value ||
              this.forgeArenaActionState.reviewCategory ||
              "breakthrough",
          ).trim() || "breakthrough";
        const scoreDelta = Number(judgeScoreDeltaInput.value || 0) || 0;
        const summary = String(judgeSummaryInput.value || "").trim();
        this.forgeArenaActionState.judgeStatus = describeForgeArenaAction("judge-pending", {
          title: selectedChallenge.title,
          verdict,
        });
        this.renderForgeArenaFeed();
        try {
          await this.forgeArena.judgeChallenge({
            challengeId: selectedChallenge.id,
            runId:
              selectedChallenge.pairedRunId ||
              this.forgeArenaActionState.selectedRunId ||
              undefined,
            sessionKey: selectedChallenge.ownerSessionKey || this.activeSessionKey,
            verdict,
            reviewCategory,
            scoreDelta,
            summary: summary || undefined,
          });
          this.forgeArenaActionState.selectedChallengeId = selectedChallenge.id;
          this.forgeArenaActionState.reviewCategory = reviewCategory;
          this.forgeArenaActionState.judgeStatus = describeForgeArenaAction("judge-success", {
            title: selectedChallenge.title,
            reviewCategory,
          });
          await this.refreshForgeArenaFeed({ connected: this.gateway.isConnected });
        } catch (err) {
          console.error("[AetherApp] Failed to judge Forge Arena challenge:", err);
          this.forgeArenaActionState.judgeStatus = describeForgeArenaAction("judge-error", {
            title: selectedChallenge.title,
            detail: err?.message || "unknown error",
          });
          this.renderForgeArenaFeed();
        } finally {
          judgeSelectedButton.removeAttribute("disabled");
        }
      });
    }

    if (
      createChallengeForm &&
      createChallengeButton &&
      createTitleInput &&
      createSummaryInput &&
      createStatusInput &&
      createOwnerSessionInput &&
      createScoringRuleInput &&
      createScoreBonusInput &&
      createResultSummaryInput
    ) {
      createChallengeForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const title = String(createTitleInput.value || "").trim();
        const summary = String(createSummaryInput.value || "").trim();
        const status = String(createStatusInput.value || "open").trim() || "open";
        const ownerSessionKey = String(createOwnerSessionInput.value || "").trim();
        const scoringRule = String(createScoringRuleInput.value || "balanced").trim() || "balanced";
        const scoreBonus = Math.max(
          0,
          Math.min(100, Number(createScoreBonusInput.value || 0) || 0),
        );
        const resultSummary = String(createResultSummaryInput.value || "").trim();
        const editingChallengeId = this.forgeArenaActionState.editingChallengeId;

        if (!title || !summary) {
          this.forgeArenaActionState.createStatus = describeForgeArenaAction("challenge-invalid");
          this.renderForgeArenaFeed();
          return;
        }

        createChallengeButton.setAttribute("disabled", "disabled");
        this.forgeArenaActionState.createStatus = describeForgeArenaAction(
          editingChallengeId ? "challenge-update-pending" : "challenge-create-pending",
          { title },
        );
        this.renderForgeArenaFeed();
        try {
          if (this.forgeArenaFeed?.localArena && !editingChallengeId) {
            this.forgeArenaFeed = await this.forgeArena.recordLocalParticipation({
              profileId: this.activeBiosProfileId,
              actorLabel: this.forgeArenaProfile?.boss_display_name || this.agentName || "BOSS",
              kind:
                this.forgeArenaActionState.selectedEntryPath === "publish-local-creation"
                  ? "publish_local"
                  : "submission",
              title,
              summary,
              resultSummary: resultSummary || "Local submission saved for replay and judging.",
              scoreBonus,
            });
            const localStatusLabel =
              this.forgeArenaActionState.selectedEntryPath === "publish-local-creation"
                ? "published local"
                : "judged local";
            this.forgeArenaActionState.createStatus = `Local participation "${title}" recorded as ${localStatusLabel} with ${scoringRule} scoring (+${scoreBonus}).`;
            this.forgeArenaActionState.participationStatus =
              this.forgeArenaActionState.createStatus;
          } else if (editingChallengeId) {
            await this.forgeArena.updateChallenge({
              challengeId: editingChallengeId,
              title,
              summary,
              status,
              ownerSessionKey: ownerSessionKey || "",
              scoringRule,
              scoreBonus,
              resultSummary,
            });
            this.forgeArenaActionState.createStatus = describeForgeArenaAction(
              "challenge-update-success",
              { title, scoringRule, scoreBonus, resultSummary },
            );
          } else {
            await this.forgeArena.createChallenge({
              title,
              summary,
              status,
              ownerSessionKey: ownerSessionKey || undefined,
              scoringRule,
              scoreBonus,
              resultSummary: resultSummary || undefined,
            });
            this.forgeArenaActionState.createStatus = describeForgeArenaAction(
              "challenge-create-success",
              { title, scoringRule, scoreBonus, resultSummary },
            );
          }
          this.forgeArenaActionState.selectedChallengeId =
            editingChallengeId || this.forgeArenaActionState.selectedChallengeId;
          this.forgeArenaActionState.editingChallengeId = null;
          if (createChallengeForm && typeof createChallengeForm.reset === "function") {
            createChallengeForm.reset();
          }
          createOwnerSessionInput.value = this.activeSessionKey || "agent:main:main";
          if (!this.forgeArenaFeed?.localArena) {
            await this.refreshForgeArenaFeed({ connected: this.gateway.isConnected });
          } else {
            this.renderForgeArenaFeed();
          }
        } catch (err) {
          console.error("[AetherApp] Failed to save Forge Arena challenge:", err);
          this.forgeArenaActionState.createStatus = describeForgeArenaAction("challenge-error", {
            title,
            detail: err?.message || "unknown error",
          });
          this.renderForgeArenaFeed();
        } finally {
          createChallengeButton.removeAttribute("disabled");
        }
      });
    }

    if (featureActiveRunButton) {
      featureActiveRunButton.addEventListener("click", async () => {
        if (!this.activeSessionKey) {
          this.forgeArenaActionState.featureStatus =
            describeForgeArenaAction("feature-missing-session");
          this.renderForgeArenaFeed();
          return;
        }
        featureActiveRunButton.setAttribute("disabled", "disabled");
        this.forgeArenaActionState.featureStatus = describeForgeArenaAction("feature-pending", {
          sessionKey: this.activeSessionKey,
        });
        this.renderForgeArenaFeed();
        try {
          await this.forgeArena.featureRun({ sessionKey: this.activeSessionKey });
          this.forgeArenaActionState.featureStatus = describeForgeArenaAction("feature-success", {
            sessionKey: this.activeSessionKey,
          });
          await this.refreshForgeArenaFeed({ connected: this.gateway.isConnected });
        } catch (err) {
          console.error("[AetherApp] Failed to feature active Forge Arena run:", err);
          this.forgeArenaActionState.featureStatus = describeForgeArenaAction("feature-error", {
            sessionKey: this.activeSessionKey,
            detail: err?.message || "unknown error",
          });
          this.renderForgeArenaFeed();
        } finally {
          featureActiveRunButton.removeAttribute("disabled");
        }
      });
    }

    this.resetForgeArenaChallengeForm();
    this.renderProfileSettings();

    // ── Settings: API Provider management ───────────────────
    this.initSettingsProviderPanel();
  }

  /** Initialize the Settings > API Provider panel */
  async initSettingsProviderPanel() {
    const providerSelect = document.getElementById("settings-provider-select");
    const modelInput = document.getElementById("settings-model-input");
    const btnAddKey = document.getElementById("btn-add-key");
    const statusEl = document.getElementById("settings-provider-status");
    const newProviderEl = document.getElementById("settings-new-provider");
    const newKeyEl = document.getElementById("settings-new-key");

    if (!providerSelect) return;

    const setProviderPanelPending = (pending) => {
      providerSelect.disabled = pending;
      if (modelInput) modelInput.disabled = pending;
      if (btnAddKey) btnAddKey.disabled = pending;
      if (newProviderEl) newProviderEl.disabled = pending;
      if (newKeyEl) newKeyEl.disabled = pending;
    };

    if (statusEl) {
      statusEl.textContent = describeSettingsProviderAction("load-pending");
    }

    const loadProviderConfig =
      typeof this.loadBiosProviderConfig === "function"
        ? this.loadBiosProviderConfig.bind(this)
        : AetherApp.prototype.loadBiosProviderConfig.bind(this);
    const saveProviderConfig =
      typeof this.saveBiosProfileProviderConfig === "function"
        ? this.saveBiosProfileProviderConfig.bind(this)
        : AetherApp.prototype.saveBiosProfileProviderConfig.bind(this);

    let config = await loadProviderConfig(this.activeBiosProfileId);
    const saved = this.getSavedOnboardingSnapshot?.() || null;
    const routeMode = saved?.modelPref || (config.active_provider ? "commercial" : null);
    const cloudKeys = (config.keys || []).filter((key) => {
      const provider = String(key?.provider || "")
        .trim()
        .toLowerCase();
      return provider && !NON_LLM_PROVIDERS.has(provider) && !LOCAL_RUNTIME_PROVIDERS.has(provider);
    });
    const preferredCloudProvider =
      saved?.preferredCloudProvider ||
      cloudKeys.find((key) => key.provider === config.active_provider)?.provider ||
      "";

    providerSelect.innerHTML = "";
    if (cloudKeys.length === 0) {
      providerSelect.innerHTML = '<option value="">No cloud keys configured</option>';
    } else {
      cloudKeys.forEach((k) => {
        const opt = document.createElement("option");
        opt.value = k.provider;
        opt.textContent = `${k.provider} (${k.label || k.provider})`;
        if (k.provider === preferredCloudProvider) opt.selected = true;
        providerSelect.appendChild(opt);
      });
    }

    if (modelInput) modelInput.value = config.active_model || "";
    if (statusEl) {
      if (!routeMode) {
        statusEl.textContent =
          "Choose a BOSS route during onboarding before cloud provider settings become active.";
      } else if (routeMode === "local") {
        statusEl.textContent =
          "Local routing is active above. Cloud keys here stay ready for later hybrid or cloud use.";
      } else if (config.active_provider && !LOCAL_RUNTIME_PROVIDERS.has(config.active_provider)) {
        statusEl.textContent = describeSettingsProviderAction("load-ready", {
          provider: config.active_provider,
        });
      } else if (preferredCloudProvider) {
        statusEl.textContent = `Preferred cloud provider: ${preferredCloudProvider}`;
      } else {
        statusEl.textContent = describeSettingsProviderAction("load-empty");
      }
    }

    providerSelect.addEventListener("change", async () => {
      const newProvider = providerSelect.value;
      if (!newProvider) return;
      config.active_provider = newProvider;
      if (statusEl) {
        statusEl.textContent = describeSettingsProviderAction("switch-pending", {
          provider: newProvider,
        });
      }
      setProviderPanelPending(true);
      try {
        config = await saveProviderConfig(config, {
          preferredCloudProvider: newProvider,
        });
        if (statusEl)
          statusEl.textContent = describeSettingsProviderAction("switch-success", {
            provider: newProvider,
          });
        // Reset conversation for new provider
        this._conversationHistory = [];
      } catch (e) {
        if (statusEl)
          statusEl.textContent = describeSettingsProviderAction("switch-error", {
            provider: newProvider,
            detail: e?.message || String(e),
          });
      } finally {
        setProviderPanelPending(false);
      }
    });

    // Save model on blur
    if (modelInput) {
      modelInput.addEventListener("change", async () => {
        config.active_model = modelInput.value.trim();
        if (statusEl) {
          statusEl.textContent = describeSettingsProviderAction("model-pending", {
            model: config.active_model || "auto",
          });
        }
        setProviderPanelPending(true);
        try {
          config = await saveProviderConfig(config);
          if (statusEl)
            statusEl.textContent = describeSettingsProviderAction("model-success", {
              model: config.active_model || "auto",
            });
        } catch (e) {
          if (statusEl)
            statusEl.textContent = describeSettingsProviderAction("model-error", {
              model: config.active_model || "auto",
              detail: e?.message || String(e),
            });
        } finally {
          setProviderPanelPending(false);
        }
      });
    }

    // Add new key
    if (btnAddKey) {
      btnAddKey.addEventListener("click", async () => {
        if (!newProviderEl || !newKeyEl) return;
        const provider = newProviderEl.value;
        const key = newKeyEl.value.trim();
        if (!key) {
          if (statusEl) statusEl.textContent = describeSettingsProviderAction("key-missing");
          return;
        }
        // Add to config
        config.keys = config.keys || [];
        // Replace existing key for same provider
        config.keys = config.keys.filter((k) => k.provider !== provider);
        config.keys.push({ provider, key, source: "manual", label: `${provider} (manual)` });
        config.active_provider = provider;
        if (statusEl) {
          statusEl.textContent = describeSettingsProviderAction("key-pending", { provider });
        }
        setProviderPanelPending(true);
        try {
          config = await saveProviderConfig(config, {
            preferredCloudProvider: provider,
          });
          newKeyEl.value = "";
          if (statusEl)
            statusEl.textContent = describeSettingsProviderAction("key-success", { provider });
          this.initSettingsProviderPanel();
        } catch (e) {
          if (statusEl)
            statusEl.textContent = describeSettingsProviderAction("key-error", {
              provider,
              detail: e?.message || String(e),
            });
        } finally {
          setProviderPanelPending(false);
        }
      });
    }
  }

  setupGatewayListeners() {
    // Connection handshake events
    this.gateway.on("connect", async (welcome) => {
      console.log("[AetherApp] Connected to server gateway successfully.");

      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = null;
      }
      if (this.disconnectTimeout) {
        clearTimeout(this.disconnectTimeout);
        this.disconnectTimeout = null;
      }

      // Query User Profile to resolve custom Agent Name
      try {
        const profileRes = await this.gateway.request("user.profile.get");
        const profile = profileRes?.profile || "";
        let name = this.parseAgentName(profile);
        if (!name) {
          name = await this.promptForAgentName(profile);
        }
        this.agentName = name;
        this.hasCalibratedAgentName = Boolean(name);
        this.updateAgentNameDOM();
      } catch (err) {
        console.error("[AetherApp] Failed to resolve custom agent name:", err);
      }

      this.hideConnectionStatusBar();

      // Remove offline welcome if present
      const offlineWelcome = document.querySelector(".offline-welcome");
      if (offlineWelcome) offlineWelcome.remove();

      this.subtitles.update(`Cognitive link established with ${this.agentName}.`);
      this.orb.setState("idle");

      // Render conversation tabs
      this.renderSessionTabs();

      const existingProfiles = await this.loadBiosProfiles();
      if (existingProfiles.length > 0 && !this.pendingNewBiosProfile) {
        this.hasCalibratedAgentName = false;
        this.showProfilePicker();
        return;
      }

      // Load initial chat history and product surfaces with explicit bootstrap feedback.
      await this.runInitialShellHydration();

      // Start live HUD synchronization (Sovereign Clipboard & Workflow Checkpoints)
      this.refreshHudData();
      this.hudInterval = setInterval(() => this.refreshHudData(), 5000);
    });

    this.gateway.on("disconnect", () => {
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = null;
      }

      this.orb.setState("idle");

      // Clear active HUD synchronizers
      if (this.hudInterval) {
        clearInterval(this.hudInterval);
      }

      this.setStatusValue("st-gateway", "Offline");
      void this.refreshForgeArenaFeed({ connected: false });
      this.renderContinuityShellSurface();

      // Show a small non-blocking status bar instead of re-blocking the full UI
      if (!this.disconnectTimeout) {
        this.disconnectTimeout = setTimeout(() => {
          this.showConnectionStatusBar(
            describeBootstrapAction("reconnect-pending", { agentName: this.agentName }),
          );
        }, 4000);
      }

      // Start background reconnection
      this.scheduleBackgroundReconnect();
    });

    // Chat streams (message content updates)
    this.gateway.on("chat", (payload) => {
      if (payload.sessionKey && payload.sessionKey !== this.activeSessionKey) {
        return;
      }
      if (payload.state === "delta") {
        this.chat.handleChatDelta(payload);
      } else if (payload.state === "final") {
        this.chat.handleChatFinal(payload);
      }
    });

    // Low-level agent events (tools lifecycle and detailed tracing)
    this.gateway.on("agent", (evt) => {
      if (evt.stream === "tool") {
        this.handleLiveToolStatus(evt);
        this.chat.handleToolEvent(evt);
      } else if (evt.stream === "assistant") {
        const text = evt.data?.text || "";
        if (text) {
          this.subtitles.update(text, `${this.agentName} (thinking): `, false);
        }
      } else if (evt.stream === "lifecycle") {
        const phase = evt.data?.phase;
        if (phase === "start") {
          this.runInProgress = true;
          this.currentRunStatus = this.currentRunStatus || "Working on your request";
          this.orb.setState("thinking");
          this.updateObservationPlane("thinking", "Working", this.currentRunStatus);
          this.refreshHeroStatus();
        } else if (phase === "end" || phase === "error") {
          this.runInProgress = false;
          this.currentRunStatus = phase === "error" ? "Blocked by an execution error" : "";
          this.orb.setState("idle");
          this.updateObservationPlane(
            phase === "error" ? "blocked" : "idle",
            phase === "error" ? "Blocked" : "Idle",
            this.currentRunStatus,
          );
          this.refreshHeroStatus({ phase });
        }
      }
    });

    // Modular Apps SDK Widget Projection
    this.gateway.on("widget-projection", (payload) => {
      this.chat.renderWidget(payload);
    });

    // J.A.R.V.I.S. Visual Telemetry Channel
    this.gateway.on("cognitive.state", (payload) => {
      const { state, text, yolo } = payload;

      if (state) this.orb.setState(state);
      if (state)
        this.updateObservationPlane(
          state,
          state === "thinking" ? "Thinking" : state === "acting" ? "Executing" : "Idle",
          text || "",
        );
      if (yolo !== undefined) {
        this.autonomousMode = yolo;
        this.orb.setAutonomousMode(yolo);
      }
      if (text) {
        this.subtitles.update(text, `${this.agentName}: `);
        this.orb.updateStatus(text);
      }
    });
  }

  normalizeStatusText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  shortenStatus(text, maxLength = 88) {
    const normalized = this.normalizeStatusText(text);
    if (!normalized) return "";
    return normalized.length > maxLength
      ? `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
      : normalized;
  }

  setHeroStatus(text) {
    // Route to viewport status text instead of the removed hero header
    const statusText = document.getElementById("viewport-status-text");
    if (statusText) statusText.innerText = this.shortenStatus(text).toUpperCase();
    this.currentRunStatus = text;
    this.renderActivityLabels();
  }

  renderActivityLabels() {
    const summary = this.describeActivitySnapshot();
    const activityLabel = document.getElementById("activity-label");
    const tasksActivityLabel = document.getElementById("tasks-activity-label");
    if (activityLabel) {
      activityLabel.innerText = summary.activityLabel;
      activityLabel.title = summary.copy;
    }
    if (tasksActivityLabel) {
      tasksActivityLabel.innerText = summary.taskActivityLabel;
      tasksActivityLabel.title = summary.copy;
    }
  }

  summarizeUserIntent(text) {
    const normalized = this.shortenStatus(text, 72);
    return normalized ? `Working on: ${normalized}` : "Working on your request";
  }

  summarizeToolAction(toolName, data) {
    const name = String(toolName || "tool").toLowerCase();
    const params = data?.args || data?.params || data?.arguments || {};
    const request = params?.request || {};
    const browserAction = params?.action || request?.kind || data?.action || "";
    const targetUrl = params?.url || params?.targetUrl || request?.url || "";
    const rawPath = params?.path || params?.filePath || "";
    const action = String(browserAction || params?.kind || params?.action || "").toLowerCase();
    const command = this.shortenStatus(params?.command || "", 64);
    const fileLabel = rawPath ? rawPath.split(/[/\\]/).filter(Boolean).pop() : "";

    const describeHost = (value) => {
      if (!value) return "";
      try {
        return new URL(value).hostname.replace(/^www\./, "");
      } catch {
        return "";
      }
    };

    if (name === "browser") {
      const host = describeHost(targetUrl);
      if (action === "navigate" || action === "open") {
        return host ? `Checking ${host}` : "Checking the browser";
      }
      if (action === "snapshot" || action === "screenshot") {
        return host ? `Inspecting ${host}` : "Inspecting the page";
      }
      if (action === "click" || action === "type" || action === "fill" || action === "act") {
        return host ? `Working in ${host}` : "Working in the browser";
      }
      return host ? `Using ${host}` : "Using the browser";
    }

    if (name === "read") return fileLabel ? `Reading ${fileLabel}` : "Reading a file";
    if (name === "edit") return fileLabel ? `Updating ${fileLabel}` : "Updating a file";
    if (name === "write") return fileLabel ? `Writing ${fileLabel}` : "Writing a file";
    if (name === "exec") return command ? `Running ${command}` : "Running a command";
    if (name === "process") {
      const processAction = String(params?.action || "").toLowerCase();
      return processAction === "poll" || processAction === "log"
        ? "Checking background work"
        : "Managing background work";
    }
    if (name === "web_search") return "Searching the web";
    if (name === "web_fetch")
      return targetUrl
        ? `Reading ${describeHost(targetUrl) || "a web page"}`
        : "Reading a web page";
    if (name === "sessions_spawn") return "Launching a helper agent";

    return `Running ${toolName || "tool"}`;
  }

  summarizeBackgroundWait(toolName, data, fallbackText = "") {
    const name = String(toolName || "tool").toLowerCase();
    const params = data?.args || data?.params || data?.arguments || {};
    if (name === "exec") {
      const command = this.shortenStatus(params?.command || "", 58);
      return command
        ? `Waiting on background command: ${command}`
        : "Waiting on background command";
    }
    if (name === "sessions_spawn") {
      return "Waiting on helper agent results";
    }
    return fallbackText || `Waiting on ${toolName || "background work"}`;
  }

  isBackgroundContinuation(toolName, data) {
    const name = String(toolName || "tool").toLowerCase();
    const result = data?.result;
    if (!result || typeof result !== "object") return false;
    if (name === "exec") {
      return Boolean(
        result.sessionId ||
        result.background === true ||
        (typeof result.message === "string" && /still running/i.test(result.message)),
      );
    }
    if (name === "sessions_spawn") {
      return Boolean(result.sessionKey || result.runId || result.target);
    }
    return false;
  }

  refreshHeroStatus(options = {}) {
    const latestToolStatus = Array.from(this.liveToolStatuses.values()).at(-1) || "";
    const phase = options?.phase || "";

    if (this.pendingBackgroundStatus) {
      this.setHeroStatus(this.pendingBackgroundStatus);
      return;
    }
    if (latestToolStatus) {
      this.setHeroStatus(latestToolStatus);
      return;
    }
    if (this.runInProgress) {
      this.setHeroStatus(this.currentRunStatus || "Working on your request");
      return;
    }
    if (phase === "error") {
      this.setHeroStatus(this.currentRunStatus || "Blocked by an execution error");
      return;
    }
    this.setHeroStatus("Ready for next task");
  }

  handleLiveToolStatus(evt) {
    const data = evt?.data || {};
    const toolName = data?.name || "tool";
    const phase = data?.phase || "start";
    const seqKey = evt?.seq || data?.toolCallId || `${toolName}-${Date.now()}`;

    if (phase === "start") {
      const summary = this.summarizeToolAction(toolName, data);
      this.liveToolStatuses.set(seqKey, summary);
      this.currentRunStatus = summary;
      this.refreshHeroStatus();
      return;
    }

    if (phase === "end" || phase === "result") {
      const activeSummary =
        this.liveToolStatuses.get(seqKey) || this.summarizeToolAction(toolName, data);
      this.liveToolStatuses.delete(seqKey);

      if (this.isBackgroundContinuation(toolName, data)) {
        this.pendingBackgroundStatus = this.summarizeBackgroundWait(toolName, data, activeSummary);
        this.refreshHeroStatus();
        return;
      }

      if (String(toolName || "").toLowerCase() === "process") {
        this.pendingBackgroundStatus = "";
      }

      if (data?.isError) {
        this.currentRunStatus = `${this.shortenStatus(toolName, 24)} failed`;
      }
      this.refreshHeroStatus();
    }
  }

  /**
   * Load chat history for the main session.
   */
  async loadSessionHistory() {
    try {
      const history = await this.getRuntimeTransportClient().loadChatHistory({
        sessionKey: this.activeSessionKey,
        profileId: this.activeBiosProfileId || null,
        limit: 50,
        conversationHistory: this._conversationHistory || [],
      });

      this.chat.clear();

      if (history && history.messages) {
        // Renders existing text messages in correct order
        history.messages.forEach((msg) => {
          if ((msg.role === "user" || msg.role === "assistant") && msg.text) {
            this.chat.appendMessage(msg.role, msg.text);
          }
        });
      }
    } catch (err) {
      console.error("[AetherApp] Failed to load session history:", err);
    }
  }

  getRuntimeTransportClient() {
    if (!this.runtimeTransport) {
      this.runtimeTransport = createBiosRuntimeTransportClient({
        gateway: this.gateway,
        getTauriInvoke: () => window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke || null,
      });
    }
    return this.runtimeTransport;
  }

  /**
   * Send text message — uses gateway if connected, otherwise direct LLM via Tauri backend.
   */
  formatChatFailureMessage(err) {
    const detail = err?.message || String(err);
    if (/still warming up|still loading/i.test(detail) && /BOSS brain|Local worker/i.test(detail)) {
      return [
        "BOSS brain is still loading the selected local model.",
        "BIOS AI kept the GPU runtime running, so retry in a moment.",
        "If this keeps happening with Qwen3 14B, open Settings, choose the recommended ready BOSS model, and click Save Settings.",
      ].join(" ");
    }
    return `Error: ${detail}`;
  }

  async sendChatMessage(text) {
    try {
      const normalizedText = this.normalizeStatusText(text);
      if (!normalizedText) return;
      const runtimeTransportClient = AetherApp.prototype.getRuntimeTransportClient.call(this);
      const activeTransport = runtimeTransportClient.getActiveTransportKind();
      const activationStatus =
        activeTransport === "gateway"
          ? { ready: true, reason: null }
          : await AetherApp.prototype.ensureBiosActivationReady.call(this);

      if (!activationStatus.ready) {
        await appendBiosDebugLog("chat.route.activation_required", {
          reason: activationStatus.reason,
          profileId: this.activeBiosProfileId || null,
        });
        if (typeof this.showOfflineWelcome === "function") {
          this.showOfflineWelcome();
        }
        this.chat?.appendMessage?.(
          "assistant",
          activationStatus.message ||
            "BIOS AI still needs a real BOSS profile and a selected BOSS brain before chat can begin.",
        );
        this.subtitles.update(
          describeChatAction("local-error", {
            agentName: this.agentName,
            detail: activationStatus.reason || "activation required",
          }),
        );
        this.orb.setState("idle");
        return false;
      }

      this.runInProgress = true;
      this.currentRunStatus = this.summarizeUserIntent(normalizedText);
      this.pendingBackgroundStatus = "";
      this.liveToolStatuses.clear();
      this.refreshHeroStatus();
      this.chat?.setBusy?.(
        true,
        describeChatAction("gateway-pending", { agentName: this.agentName }),
      );

      // ── Try runtime transport first ────────────────────────
      if (activeTransport === "gateway") {
        this.subtitles.update(describeChatAction("gateway-pending", { agentName: this.agentName }));
        await runtimeTransportClient.sendChatMessage({
          normalizedText,
          sessionKey: this.activeSessionKey,
          recordRouteDecision: this.recordRouteDecision?.bind(this),
        });
        this.subtitles.update(describeChatAction("gateway-success", { agentName: this.agentName }));
        return true;
      }

      // ── Direct LLM fallback via Tauri ───────────────────────
      this.subtitles.update(describeChatAction("local-thinking", { agentName: this.agentName }));
      this.chat?.setBusy?.(
        true,
        describeChatAction("local-thinking", { agentName: this.agentName }),
      );
      this.orb.setState("thinking");

      // Show thinking indicator in chat
      const thinkingNode = this.chat.appendMessage("assistant", "");
      if (thinkingNode) {
        thinkingNode.innerHTML = `<span style="color: #4a5568; font-style: italic;">💭 ${this.agentName} is thinking...</span>`;
      }

      const onboardingState = this.getSavedOnboardingSnapshot();
      const localResult = await runtimeTransportClient.sendChatMessage({
        normalizedText,
        agentName: this.agentName,
        profileId: this.activeBiosProfileId || null,
        onboardingState,
        conversationHistory: this._conversationHistory || [],
      });
      this._conversationHistory =
        localResult.conversationHistory || this._conversationHistory || [];
      if (Array.isArray(localResult.actionEvents) && localResult.actionEvents.length) {
        localResult.actionEvents.forEach((event) => this.chat?.handleToolEvent?.(event));
      }

      // Show response in chat (replace thinking indicator)
      if (thinkingNode) {
        thinkingNode.innerHTML = "";
        thinkingNode.innerText = localResult.responseText;
      }

      this.subtitles.update(describeChatAction("local-success", { agentName: this.agentName }));
      this.orb.setState("idle");
      this.chat.scrollToBottom();
      return true;
    } catch (err) {
      console.error("[AetherApp] Message sending failed:", err);
      await appendBiosDebugLog("chat.route.error", {
        detail: err?.message || String(err),
      });
      this.chat.appendMessage(
        "assistant",
        AetherApp.prototype.formatChatFailureMessage.call(this, err),
      );
      this.subtitles.update(
        describeChatAction(this.gateway?.isConnected ? "gateway-error" : "local-error", {
          agentName: this.agentName,
          detail: err?.message || String(err),
        }),
      );
      this.orb.setState("idle");
      return false;
    } finally {
      this.runInProgress = false;
      this.chat?.setBusy?.(false);
      this.refreshHeroStatus();
    }
  }

  /**
   * Switch viewport layouts between full HUD and Minimized Orb.
   */
  setViewMode(mode) {
    if (this.viewMode === mode) return;
    this.viewMode = mode;

    const fullPanel = document.getElementById("content");
    const titlebar = document.getElementById("titlebar");

    if (mode === "minimized") {
      if (fullPanel) fullPanel.classList.add("hidden");
      if (titlebar) titlebar.classList.add("titlebar-minimized");

      // Update viewport status on view mode change
      this.orb.show();

      // Notify Electron shell to adjust window bounds dynamically
      if (window.electronAPI) {
        window.electronAPI.setMinimizedBounds();
      }
    } else {
      if (fullPanel) fullPanel.classList.remove("hidden");
      if (titlebar) titlebar.classList.remove("titlebar-minimized");

      this.orb.hide();

      // Notify Electron shell to restore full bounds
      if (window.electronAPI) {
        window.electronAPI.setFullBounds();
      }
    }
  }

  loadSessionsFromStore() {
    try {
      const stored = localStorage.getItem("aether_chat_sessions");
      if (stored) {
        this.sessions = JSON.parse(stored);
      }
      const active = localStorage.getItem("aether_active_session");
      if (active) {
        this.activeSessionKey = active;
      }

      if (this.sessions.length === 0) {
        this.sessions = [{ key: "agent:main:main", name: "Main Canvas" }];
        this.activeSessionKey = "agent:main:main";
        this.saveSessionsToStore();
      }
    } catch (err) {
      console.error("Failed to load sessions from store:", err);
      this.sessions = [{ key: "agent:main:main", name: "Main Canvas" }];
      this.activeSessionKey = "agent:main:main";
    }
  }

  saveSessionsToStore() {
    try {
      localStorage.setItem("aether_chat_sessions", JSON.stringify(this.sessions));
      localStorage.setItem("aether_active_session", this.activeSessionKey);
    } catch (err) {
      console.error("Failed to save sessions to store:", err);
    }
  }

  renderSessionTabs() {
    const container = document.getElementById("session-tabs-container");
    if (!container) return;

    container.innerHTML = "";

    this.sessions.forEach((session) => {
      const tab = document.createElement("div");
      tab.className = `session-tab${session.key === this.activeSessionKey ? " active" : ""}`;
      tab.setAttribute("data-session-key", session.key);
      if (this.sessionActionPending) {
        tab.style.pointerEvents = "none";
        tab.style.opacity = "0.7";
      }

      const nameSpan = document.createElement("span");
      nameSpan.className = "session-tab-name";
      nameSpan.innerText = session.name;
      nameSpan.style.overflow = "hidden";
      nameSpan.style.textOverflow = "ellipsis";
      nameSpan.style.whiteSpace = "nowrap";

      // Double-click to rename session
      tab.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        const newName = prompt("Rename conversation:", session.name);
        if (newName && newName.trim()) {
          session.name = newName.trim();
          this.saveSessionsToStore();
          this.renderSessionTabs();
        }
      });

      tab.addEventListener("click", () => {
        this.switchSession(session.key);
      });

      const closeBtn = document.createElement("button");
      closeBtn.className = "session-tab-close";
      closeBtn.innerText = "×";
      closeBtn.title = "Delete Conversation";
      closeBtn.disabled = this.sessionActionPending;
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        void this.deleteSession(session.key);
      });

      tab.appendChild(nameSpan);
      tab.appendChild(closeBtn);
      container.appendChild(tab);
    });
  }

  async switchSession(sessionKey) {
    if (this.activeSessionKey === sessionKey || this.sessionActionPending) return false;
    this.sessionActionPending = true;
    this.activeSessionKey = sessionKey;
    this.saveSessionsToStore();
    this.renderSessionTabs();

    // Reset chat and load selected session history
    this.chat.clear();
    const sessionName = this.sessions.find((s) => s.key === sessionKey)?.name || "Session";
    this.subtitles.update(describeSessionAction("switch-pending", { name: sessionName }));
    try {
      await this.loadSessionHistory();
      await this.loadSessionMission();
      await this.refreshForgeArenaFeed({ connected: this.gateway.isConnected });
      this.subtitles.update(describeSessionAction("switch-success", { name: sessionName }));
      return true;
    } catch (err) {
      this.subtitles.update(
        describeSessionAction("switch-error", {
          name: sessionName,
          detail: err?.message || String(err),
        }),
      );
      return false;
    } finally {
      this.sessionActionPending = false;
      this.renderSessionTabs();
    }
  }

  async deleteSession(sessionKey) {
    if (this.sessionActionPending) return false;
    if (confirm("Are you sure you want to delete this conversation and all its history?")) {
      this.sessionActionPending = true;
      const index = this.sessions.findIndex((s) => s.key === sessionKey);
      if (index === -1) {
        this.sessionActionPending = false;
        return false;
      }

      const sessionName = this.sessions[index]?.name || "Conversation";
      this.subtitles.update(describeSessionAction("delete-pending", { name: sessionName }));

      this.sessions.splice(index, 1);
      if (this.sessions.length === 0) {
        this.sessions.push({ key: "agent:main:main", name: "Main Canvas" });
      }

      if (this.activeSessionKey === sessionKey) {
        this.activeSessionKey = this.sessions[0].key;
      }

      this.saveSessionsToStore();
      this.renderSessionTabs();

      this.chat.clear();
      try {
        await this.loadSessionHistory();
        await this.refreshForgeArenaFeed({ connected: this.gateway.isConnected });
        this.subtitles.update(describeSessionAction("delete-success", { name: sessionName }));
        return true;
      } catch (err) {
        this.subtitles.update(
          describeSessionAction("delete-error", {
            name: sessionName,
            detail: err?.message || String(err),
          }),
        );
        return false;
      } finally {
        this.sessionActionPending = false;
        this.renderSessionTabs();
      }
    }
    return false;
  }

  async createSession() {
    if (this.sessionActionPending) return false;
    this.sessionActionPending = true;
    const count = this.sessions.length + 1;
    const newKey = `agent:main:session-${Date.now()}`;
    const newName = `Conversation ${count}`;

    this.sessions.push({ key: newKey, name: newName });
    this.activeSessionKey = newKey;

    this.saveSessionsToStore();
    this.renderSessionTabs();

    this.chat.clear();
    this.subtitles.update(describeSessionAction("create-pending", { name: newName }));

    try {
      await this.loadSessionHistory();
      await this.refreshForgeArenaFeed({ connected: this.gateway.isConnected });
      this.subtitles.update(describeSessionAction("create-success", { name: newName }));
      return true;
    } catch (err) {
      this.subtitles.update(
        describeSessionAction("create-error", {
          name: newName,
          detail: err?.message || String(err),
        }),
      );
      return false;
    } finally {
      this.sessionActionPending = false;
      this.renderSessionTabs();
    }
  }

  async refreshHudData() {
    if (!this.gateway.isConnected) return;

    try {
      const requestHud = async (surface, method, params) => {
        try {
          return {
            ok: true,
            value: await this.gateway.request(method, params),
            error: null,
          };
        } catch (error) {
          console.error(`[AetherApp] Failed to load ${surface}:`, error);
          return {
            ok: false,
            value: null,
            error,
          };
        }
      };

      const [
        clipboardRes,
        checkpointerRes,
        skillsRes,
        promotedToolsRes,
        sessionsRes,
        modelsRes,
        modelAuthRes,
        launcherStatusRes,
      ] = await Promise.all([
        requestHud("clipboard", "clipboard.list"),
        requestHud("resumable workflows", "checkpointer.list"),
        requestHud("skills", "skills.list"),
        requestHud("promoted tools", "skills.tools"),
        requestHud("sessions", "sessions.list", {}),
        requestHud("model posture", "models.list", { view: "configured" }),
        requestHud("model auth status", "models.authStatus"),
        requestHud("launcher status", "launcher.status"),
      ]);

      const variables = clipboardRes.value?.variables || {};
      const checkpoints = checkpointerRes.value?.checkpoints || {};
      let skills = skillsRes.value?.skills || [];
      let promotedTools = promotedToolsRes.value?.tools || [];
      // Filter out glymphatic/cache cleanup skills since they run automatically in the background
      skills = skills.filter((skill) => {
        const isGlymphatic =
          skill.id?.toLowerCase().includes("glymphatic") ||
          skill.description?.toLowerCase().includes("cleanup") ||
          skill.description?.toLowerCase().includes("clean up") ||
          skill.commands?.some((cmd) => cmd.toLowerCase().includes("glymphatic"));
        return !isGlymphatic;
      });
      promotedTools = promotedTools.filter((tool) => {
        const toolText =
          `${tool.toolName || ""} ${tool.displayName || ""} ${tool.commandPreview || ""}`.toLowerCase();
        return (
          !toolText.includes("glymphatic") &&
          !toolText.includes("cleanup") &&
          !toolText.includes("clean up")
        );
      });
      const activeSession = Array.isArray(sessionsRes.value?.sessions)
        ? sessionsRes.value.sessions.find((session) => session.key === this.activeSessionKey) ||
          null
        : null;
      this.promptEconomyTelemetry = buildPromptEconomyTelemetry(activeSession);
      this.modelTelemetry = buildModelTelemetry({
        models: modelsRes.value?.models || [],
        authStatus: modelAuthRes.value,
      });
      this.launchSupportTelemetry = buildLaunchSupportTelemetry(launcherStatusRes.value || null);
      this.modelChoiceGuidance = buildModelChoiceGuidance({
        modelTelemetry: this.modelTelemetry,
        launchSupportTelemetry: this.launchSupportTelemetry,
      });
      const topRoutedSkill = skills.reduce((currentTop, skill) => {
        if (!currentTop || (skill.routeHits || 0) > (currentTop.routeHits || 0)) {
          return skill;
        }
        return currentTop;
      }, null);
      this.skillTelemetry = {
        ...(skillsRes.value?.telemetry || {}),
        totalSkillCount: skills.length,
        readySkillCount: skills.filter((skill) => skill.fastPathReady).length,
        promotedToolCount: skills.filter((skill) => skill.toolReady).length,
        validationBacklogCount: skills.filter((skill) => skill.needsValidation).length,
        learningSkillCount: skills.filter((skill) => !skill.fastPathReady && !skill.needsValidation)
          .length,
        totalRouteHits: skills.reduce((sum, skill) => sum + (skill.routeHits || 0), 0),
        totalSuccessCount: skills.reduce((sum, skill) => sum + (skill.successCount || 0), 0),
        totalFailureCount: skills.reduce((sum, skill) => sum + (skill.failureCount || 0), 0),
        topRoutedSkillId: topRoutedSkill?.id || null,
        topPromotedToolName: promotedTools[0]?.toolName || null,
      };

      // 4. Render inside the BIOS AI HUD canvas sidebar
      const hudPanel = document.getElementById("hud-panel");
      if (!hudPanel) return;

      hudPanel.innerHTML = "";

      // Section 1: Sovereign Clipboard Monitor
      const clipboardSection = document.createElement("div");
      clipboardSection.className = "hud-section";
      clipboardSection.innerHTML = `<h3 class="hud-section-title">⚡ Sovereign Clipboard</h3>`;

      if (!clipboardRes.ok) {
        clipboardSection.innerHTML += `<p style="font-size: var(--text-xs); color: var(--danger); font-style: italic; margin-top: var(--sp-2);">${this.escapeHtml(describeTelemetryLoad("error", { surface: "Sovereign Clipboard", detail: clipboardRes.error?.message || String(clipboardRes.error) }))}</p>`;
      } else {
        const varKeys = Object.keys(variables);
        if (varKeys.length === 0) {
          clipboardSection.innerHTML += `<p style="font-size: var(--text-xs); color: var(--text-muted); font-style: italic; margin-top: var(--sp-2);">No variables in clipboard.</p>`;
        } else {
          varKeys.forEach((key) => {
            const entry = variables[key];
            // Redact value if long or highly sensitive looking
            let valDisplay = entry.value;
            if (valDisplay.length > 30) {
              valDisplay = valDisplay.slice(0, 27) + "...";
            }

            clipboardSection.innerHTML += `
            <div class="hud-card" title="Origin: ${entry.origin}\nUpdated: ${new Date(entry.timestamp).toLocaleTimeString()}">
              <div class="hud-card-label">${key}</div>
              <div class="hud-card-value" style="font-family: var(--font-mono); font-size: var(--text-xs); color: var(--accent);">${valDisplay}</div>
            </div>
          `;
          });
        }
      }
      hudPanel.appendChild(clipboardSection);

      if (this.modelTelemetry || !modelsRes.ok || !modelAuthRes.ok) {
        const modelSection = document.createElement("div");
        modelSection.className = "hud-section";
        modelSection.innerHTML =
          this.modelTelemetry && modelsRes.ok && modelAuthRes.ok
            ? `
          <h3 class="hud-section-title">🧬 Model Posture</h3>
          <div class="hud-card">
            <div class="hud-card-label" style="display: flex; justify-content: space-between; align-items: center; color: var(--accent);">
              <span>Catalog and auth posture</span>
              <span class="tool-card-badge" style="background: rgba(16,185,129,0.15); color: var(--accent); padding: 1px 4px; border-radius: 4px; font-size: 7px; font-family: var(--font-mono); font-weight: bold;">${this.modelTelemetry.readyProviderCount || 0} READY</span>
            </div>
            <div class="hud-card-value" style="font-size: 9px; margin-top: 4px; color: var(--text-muted); font-family: var(--font-mono);">${this.describeModelTelemetry()}</div>
            <div class="hud-card-value" style="font-size: 8px; margin-top: 4px; color: var(--text-muted); font-family: var(--font-mono);">Configured ${this.modelTelemetry.configuredModelCount || 0} • Local ${this.modelTelemetry.localModelCount || 0} • Hosted ${this.modelTelemetry.hostedModelCount || 0} • Blocked ${this.modelTelemetry.blockedProviderCount || 0}</div>
            ${this.modelChoiceGuidance ? `<div class="hud-card-value" style="font-size: 8px; margin-top: 4px; color: var(--text-muted); font-family: var(--font-mono);">${this.describeModelChoiceGuidance()}</div>` : ""}
          </div>
        `
            : `
          <h3 class="hud-section-title">🧬 Model Posture</h3>
          <p style="font-size: var(--text-xs); color: var(--danger); font-style: italic; margin-top: var(--sp-2);">${this.escapeHtml(describeTelemetryLoad("error", { surface: "Model Posture", detail: modelsRes.error?.message || modelAuthRes.error?.message || "gateway unavailable" }))}</p>
        `;
        hudPanel.appendChild(modelSection);
      }
      if (this.launchSupportTelemetry || !launcherStatusRes.ok) {
        const supportSection = document.createElement("div");
        supportSection.className = "hud-section";
        supportSection.innerHTML =
          this.launchSupportTelemetry && launcherStatusRes.ok
            ? `
          <h3 class="hud-section-title">📦 Packaged Support</h3>
          <div class="hud-card">
            <div class="hud-card-label" style="display: flex; justify-content: space-between; align-items: center; color: var(--accent);">
              <span>Launcher posture</span>
              <span class="tool-card-badge" style="background: rgba(255,255,255,0.08); color: var(--text-secondary); padding: 1px 4px; border-radius: 4px; font-size: 7px; font-family: var(--font-mono); font-weight: bold;">${String(this.launchSupportTelemetry.status || "unknown").toUpperCase()}</span>
            </div>
            <div class="hud-card-value" style="font-size: 9px; margin-top: 4px; color: var(--text-muted); font-family: var(--font-mono);">${this.describeLaunchSupportTelemetry()}</div>
            <div class="hud-card-value" style="font-size: 8px; margin-top: 4px; color: var(--text-muted); font-family: var(--font-mono);">Settings ${this.launchSupportTelemetry.settingsConfigured ? "READY" : "MISSING"} • Update ${this.launchSupportTelemetry.updateStrategy || "unknown"} • Model posture ${this.launchSupportTelemetry.modelPosture || "unknown"}</div>
            ${this.launchSupportTelemetry.logPath ? `<div class="hud-card-value" style="font-size: 8px; margin-top: 4px; color: var(--text-muted); font-family: var(--font-mono);">Log: ${this.launchSupportTelemetry.logPath}</div>` : ""}
          </div>
        `
            : `
          <h3 class="hud-section-title">📦 Packaged Support</h3>
          <p style="font-size: var(--text-xs); color: var(--danger); font-style: italic; margin-top: var(--sp-2);">${this.escapeHtml(describeTelemetryLoad("error", { surface: "Packaged Support", detail: launcherStatusRes.error?.message || "launcher unavailable" }))}</p>
        `;
        hudPanel.appendChild(supportSection);
      }
      if (this.promptEconomyTelemetry || !sessionsRes.ok) {
        const promptSection = document.createElement("div");
        promptSection.className = "hud-section";
        promptSection.innerHTML =
          this.promptEconomyTelemetry && sessionsRes.ok
            ? `
          <h3 class="hud-section-title">🪙 Prompt Economy</h3>
          <div class="hud-card">
            <div class="hud-card-label" style="display: flex; justify-content: space-between; align-items: center; color: var(--accent);">
              <span>Active session usage</span>
              <span class="tool-card-badge" style="background: rgba(255,255,255,0.08); color: var(--text-secondary); padding: 1px 4px; border-radius: 4px; font-size: 7px; font-family: var(--font-mono); font-weight: bold;">${this.promptEconomyTelemetry.totalTokensFresh ? "LIVE" : "STALE"}</span>
            </div>
            <div class="hud-card-value" style="font-size: 9px; margin-top: 4px; color: var(--text-muted); font-family: var(--font-mono);">${this.describePromptEconomyTelemetry()}</div>
            <div class="hud-card-value" style="font-size: 8px; margin-top: 4px; color: var(--text-muted); font-family: var(--font-mono);">In ${this.promptEconomyTelemetry.inputTokens || 0} • Out ${this.promptEconomyTelemetry.outputTokens || 0} • Cache read ${this.promptEconomyTelemetry.cacheRead || 0} • Cache write ${this.promptEconomyTelemetry.cacheWrite || 0}</div>
            ${this.promptEconomyTelemetry.model || this.promptEconomyTelemetry.modelProvider ? `<div class="hud-card-value" style="font-size: 8px; margin-top: 4px; color: var(--text-muted); font-family: var(--font-mono);">Model ${this.promptEconomyTelemetry.model || "unknown"} • Provider ${this.promptEconomyTelemetry.modelProvider || "unknown"}</div>` : ""}
          </div>
        `
            : `
          <h3 class="hud-section-title">🪙 Prompt Economy</h3>
          <p style="font-size: var(--text-xs); color: var(--danger); font-style: italic; margin-top: var(--sp-2);">${this.escapeHtml(describeTelemetryLoad("error", { surface: "Prompt Economy", detail: sessionsRes.error?.message || "session data unavailable" }))}</p>
        `;
        hudPanel.appendChild(promptSection);
      }

      // Section 1.5: Hardened Skills Dashboard (Myelinated Pathways)
      const skillsSection = document.createElement("div");
      skillsSection.className = "hud-section";
      skillsSection.innerHTML = `<h3 class="hud-section-title">⚛️ Hardened Skills (Reflexes)</h3>`;
      if (this.skillTelemetry) {
        skillsSection.innerHTML += `
          <div class="hud-card" style="border: 1px solid rgba(16, 185, 129, 0.18); background: rgba(16, 185, 129, 0.06);">
            <div class="hud-card-label" style="display: flex; justify-content: space-between; align-items: center; color: var(--accent);">
              <span>Route telemetry</span>
              <span class="tool-card-badge" style="background: rgba(16,185,129,0.15); color: var(--accent); padding: 1px 4px; border-radius: 4px; font-size: 7px; font-family: var(--font-mono); font-weight: bold;">${this.skillTelemetry.readySkillCount || 0} READY</span>
            </div>
            <div class="hud-card-value" style="font-size: 9px; margin-top: 4px; color: var(--text-muted); font-family: var(--font-mono);">${this.describeSkillTelemetry()}</div>
            <div class="hud-card-value" style="font-size: 8px; margin-top: 4px; color: var(--text-muted); font-family: var(--font-mono);">Tool-ready ${this.skillTelemetry.promotedToolCount || 0} • Saved ${this.skillTelemetry.avoidedSlowPathRuns || 0} turns • Success ${this.skillTelemetry.totalSuccessCount || 0}</div>
            <div class="hud-card-value" style="font-size: 8px; margin-top: 4px; color: var(--text-muted); font-family: var(--font-mono);">${this.describeLatestRouteDecision() || "Latest route: awaiting first preflight."}</div>
          </div>
        `;
      }
      if (promotedTools.length > 0) {
        const promotedPreview = promotedTools
          .slice(0, 3)
          .map((tool) => tool.toolName)
          .join(" • ");
        const leadTool = promotedTools[0];
        skillsSection.innerHTML += `
          <div class="hud-card" style="border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03);">
            <div class="hud-card-label" style="display: flex; justify-content: space-between; align-items: center; color: var(--accent);">
              <span>Promoted tools</span>
              <span class="tool-card-badge" style="background: rgba(16,185,129,0.15); color: var(--success); padding: 1px 4px; border-radius: 4px; font-size: 7px; font-family: var(--font-mono); font-weight: bold;">${promotedTools.length} READY</span>
            </div>
            <div class="hud-card-value" style="font-size: 9px; margin-top: 4px; color: var(--text-muted); font-family: var(--font-mono);">${promotedPreview}</div>
            <div class="hud-card-value" style="font-size: 8px; margin-top: 4px; color: var(--text-muted); font-family: var(--font-mono);">Lead tool: ${leadTool.toolName} • ${leadTool.commandPreview || leadTool.invocation}</div>
          </div>
        `;
      }

      if (!skillsRes.ok) {
        skillsSection.innerHTML += `<p style="font-size: var(--text-xs); color: var(--danger); font-style: italic; margin-top: var(--sp-2); padding: var(--sp-2);">${this.escapeHtml(describeTelemetryLoad("error", { surface: "Hardened Skills", detail: skillsRes.error?.message || String(skillsRes.error) }))}</p>`;
      } else if (skills.length === 0) {
        skillsSection.innerHTML += `<p style="font-size: var(--text-xs); color: var(--text-muted); font-style: italic; margin-top: var(--sp-2); padding: var(--sp-2);">No hardened skills consolidated yet.</p>`;
      } else {
        skills.forEach((skill) => {
          const skillAction = this.hudActionState?.skills?.get(skill.id) || null;
          const canValidate = Boolean(skill.needsValidation && skill.validationTarget);
          const toolReady = Boolean(skill.toolReady && skill.promotedTool);
          const badgeLabel = toolReady
            ? "TOOL READY"
            : skill.fastPathReady
              ? "READY"
              : canValidate
                ? "VALIDATE"
                : skill.needsValidation
                  ? "OBSERVED"
                  : "LEARNING";
          const badgeColor =
            toolReady || skill.fastPathReady
              ? "var(--success)"
              : canValidate || skill.needsValidation
                ? "var(--warning)"
                : "var(--accent)";
          const badgeBackground =
            toolReady || skill.fastPathReady
              ? "rgba(16,185,129,0.15)"
              : canValidate || skill.needsValidation
                ? "rgba(245,158,11,0.15)"
                : "rgba(16,185,129,0.15)";
          const defaultStatusLine = toolReady
            ? `Tool ${skill.promotedTool.toolName} • Route hits ${skill.routeHits || 0}`
            : skill.fastPathReady
              ? `Success ${skill.successCount || 0} • Route hits ${skill.routeHits || 0}`
              : canValidate
                ? `Observed ${skill.successCount || 0} success${skill.successCount === 1 ? "" : "es"} • click to validate`
                : `Observed ${skill.successCount || 0} success${skill.successCount === 1 ? "" : "es"} • still learning`;
          const statusLine = skillAction?.message || defaultStatusLine;
          const toolLine = toolReady ? `Invoke: ${skill.promotedTool.invocation}` : "";
          const btn = document.createElement("button");
          btn.className = "hud-card";
          btn.style.width = "100%";
          btn.style.border = "1px solid rgba(16, 185, 129, 0.2)";
          btn.style.background = "rgba(16, 185, 129, 0.05)";
          btn.style.cursor = "pointer";
          btn.style.transition = "all 0.2s ease";
          btn.style.textAlign = "left";

          btn.innerHTML = `
            <div class="hud-card-label" style="display: flex; justify-content: space-between; align-items: center; color: var(--accent);">
              <span>${skill.description}</span>
              <span class="tool-card-badge" style="background: ${badgeBackground}; color: ${badgeColor}; padding: 1px 4px; border-radius: 4px; font-size: 7px; font-family: var(--font-mono); font-weight: bold;">${badgeLabel}</span>
            </div>
            <div class="hud-card-value" style="font-size: 9px; margin-top: 4px; color: var(--text-muted); font-family: var(--font-mono);">${skill.id}.json</div>
            <div class="hud-card-value" style="font-size: 8px; margin-top: 4px; color: ${badgeColor}; font-family: var(--font-mono);">${statusLine}</div>
            ${toolLine ? `<div class="hud-card-value" style="font-size: 8px; margin-top: 4px; color: var(--text-muted); font-family: var(--font-mono);">${toolLine}</div>` : ""}
          `;

          if (skillAction?.pending) {
            btn.disabled = true;
            btn.style.cursor = "progress";
            btn.style.opacity = "0.78";
          } else if (!skill.fastPathReady && !canValidate) {
            btn.disabled = true;
            btn.style.cursor = "not-allowed";
            btn.style.opacity = "0.72";
          } else {
            btn.addEventListener("mouseover", () => {
              btn.style.background = "rgba(16, 185, 129, 0.12)";
              btn.style.borderColor = "var(--accent)";
            });

            btn.addEventListener("mouseout", () => {
              btn.style.background = "rgba(16, 185, 129, 0.05)";
              btn.style.borderColor = "rgba(16, 185, 129, 0.2)";
            });

            btn.addEventListener("click", async () => {
              if (skill.fastPathReady) {
                const invocation =
                  skill.promotedTool?.invocation || `Instantly execute skill sequence: ${skill.id}`;
                const confirmLabel = skill.promotedTool?.toolName
                  ? `Instantly execute promoted tool "${skill.promotedTool.toolName}"?`
                  : `Instantly execute hardened skill reflex: "${skill.description}"?`;
                const statusLabel = skill.promotedTool?.toolName
                  ? `Triggering promoted tool: ${skill.promotedTool.toolName}...`
                  : `Triggering System 1 reflex: ${skill.id}...`;
                if (confirm(confirmLabel)) {
                  this.hudActionState.skills.set(skill.id, {
                    pending: true,
                    message: describeSkillAction("execute-pending", {
                      description: skill.description,
                      toolName: skill.promotedTool?.toolName || skill.id,
                      skillId: skill.id,
                    }),
                  });
                  void this.refreshHudData();
                  this.subtitles.update(statusLabel);
                  const ok = await this.sendChatMessage(invocation);
                  this.hudActionState.skills.set(skill.id, {
                    pending: false,
                    message: describeSkillAction(ok ? "execute-success" : "execute-error", {
                      description: skill.description,
                      toolName: skill.promotedTool?.toolName || skill.id,
                      skillId: skill.id,
                      detail: ok ? "" : "BIOS AI could not queue this skill right now.",
                    }),
                  });
                  void this.refreshHudData();
                }
                return;
              }

              if (!canValidate) {
                this.subtitles.update(
                  `Skill ${skill.id} is still learning and cannot be promoted yet.`,
                );
                return;
              }

              if (
                confirm(
                  `Promote observed skill candidate "${skill.description}" into a fast-path reflex now?`,
                )
              ) {
                this.hudActionState.skills.set(skill.id, {
                  pending: true,
                  message: describeSkillAction("validate-pending", {
                    skillId: skill.id,
                    description: skill.description,
                  }),
                });
                void this.refreshHudData();
                this.subtitles.update(`Validating observed skill: ${skill.id}...`);
                try {
                  await this.gateway.request("skills.validate", {
                    skillId: skill.id,
                    validationTarget: skill.validationTarget,
                  });
                  this.hudActionState.skills.set(skill.id, {
                    pending: false,
                    message: describeSkillAction("validate-success", {
                      skillId: skill.id,
                      description: skill.description,
                    }),
                  });
                  this.subtitles.update(`Validated observed skill: ${skill.id}.`);
                  await this.refreshHudData();
                } catch (err) {
                  this.hudActionState.skills.set(skill.id, {
                    pending: false,
                    message: describeSkillAction("validate-error", {
                      skillId: skill.id,
                      description: skill.description,
                      detail: err?.message || String(err),
                    }),
                  });
                  this.subtitles.update(`Failed to validate observed skill: ${skill.id}.`);
                  void this.refreshHudData();
                }
              }
            });
          }

          skillsSection.appendChild(btn);
        });
      }
      hudPanel.appendChild(skillsSection);

      // Section 2: Resumable Checkpoints
      const checkpointSection = document.createElement("div");
      checkpointSection.className = "hud-section";
      checkpointSection.innerHTML = `<h3 class="hud-section-title">📋 Resumable Workflows</h3>`;

      if (!checkpointerRes.ok) {
        checkpointSection.innerHTML += `<p style="font-size: var(--text-xs); color: var(--danger); font-style: italic; margin-top: var(--sp-2);">${this.escapeHtml(describeTelemetryLoad("error", { surface: "Resumable Workflows", detail: checkpointerRes.error?.message || String(checkpointerRes.error) }))}</p>`;
      } else {
        const checkpointKeys = Object.keys(checkpoints);
        if (checkpointKeys.length === 0) {
          checkpointSection.innerHTML += `<p style="font-size: var(--text-xs); color: var(--text-muted); font-style: italic; margin-top: var(--sp-2);">No suspended checkpoints found.</p>`;
        } else {
          checkpointKeys.forEach((key) => {
            const entry = checkpoints[key];
            const checkpointAction =
              this.hudActionState?.checkpoints?.get(entry.sessionKey) || null;
            const dateStr = new Date(entry.timestamp).toLocaleTimeString();
            const lifecycle = this.formatContinuityLabel(
              entry.continuity?.lifecycle || "resumable",
            );
            const summary = entry.continuity?.summary || entry.sessionKey;
            const lifecycleColor =
              entry.continuity?.lifecycle === "waiting_for_approval"
                ? "var(--warning)"
                : entry.continuity?.lifecycle === "stale" ||
                    entry.continuity?.lifecycle === "failed"
                  ? "var(--danger)"
                  : "var(--accent)";

            const card = document.createElement("div");
            card.className = "hud-card";
            card.style.cursor = "pointer";
            card.title = `${lifecycle} on step ${entry.stepIndex} at ${dateStr}\n${summary}\nClick to inspect resumable continuity.`;
            card.innerHTML = `
            <div class="hud-card-label" style="display: flex; justify-content: space-between; align-items: center;">
              <span>Checkpoint</span>
              <span class="tool-card-badge" style="background: rgba(16,185,129,0.12); color: ${lifecycleColor}; padding: 1px 4px; border-radius: 4px; font-size: 8px; text-transform: uppercase;">${lifecycle}</span>
            </div>
            <div class="hud-card-value" style="font-size: var(--text-xs); margin-top: 4px; color: var(--text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${entry.sessionKey}</div>
            <div class="hud-card-value" style="font-size: 9px; margin-top: 4px; color: var(--text-muted);">Step ${entry.stepIndex} · ${summary}</div>
            ${checkpointAction?.message ? `<div class="hud-card-value" style="font-size: 8px; margin-top: 4px; color: var(--accent);">${checkpointAction.message}</div>` : ""}
          `;

            if (checkpointAction?.pending) {
              card.style.opacity = "0.78";
              card.style.cursor = "progress";
              card.style.pointerEvents = "none";
            }

            card.addEventListener("click", () => {
              this.resumeWorkflowCheckpoint(entry.sessionKey);
            });

            checkpointSection.appendChild(card);
          });
        }
      }
      hudPanel.appendChild(checkpointSection);

      // Section 3: Diagnostics & Background Sloops
      const [radixRes, cpuRes] = await Promise.all([
        requestHud("radix sidecar", "radix.status"),
        requestHud("cpu fallback", "cpu.fallback.status"),
      ]);

      let radixStatus = "UNAVAILABLE";
      let radixColor = "var(--danger)";
      if (radixRes.ok && radixRes.value?.status) {
        const state = radixRes.value.status.status.toUpperCase();
        radixStatus = state;
        if (state === "RUNNING") {
          radixStatus = "NOMINAL";
          radixColor = "var(--success)";
        } else if (state === "STARTING") {
          radixColor = "var(--warning)";
        } else if (state === "ERROR") {
          radixColor = "var(--danger)";
        }
      }

      let cpuStatus = "UNAVAILABLE";
      let cpuColor = "var(--danger)";
      let cpuDetail = "No BOSS runtime selected";
      if (cpuRes.ok && cpuRes.value) {
        if (cpuRes.value.running) {
          cpuStatus = "NOMINAL";
          cpuColor = "var(--success)";
        } else {
          cpuStatus = "READY";
          cpuColor = "var(--accent)";
        }
        cpuDetail = cpuRes.value.modelId || cpuRes.value.lastError || cpuDetail;
      }

      const diagnosticSection = document.createElement("div");
      diagnosticSection.className = "hud-section";
      diagnosticSection.innerHTML = `
        <h3 class="hud-section-title">🩺 Diagnostics & Sloops</h3>
        <div class="hud-status-row">
          <span class="hud-status-label">Visual Healing Engine</span>
          <span class="hud-status-value" style="color: var(--success);">NOMINAL</span>
        </div>
        <div class="hud-status-row">
          <span class="hud-status-label">Sloop Background Worker</span>
          <span class="hud-status-value" style="color: var(--accent);">ACTIVE</span>
        </div>
        <div class="hud-status-row">
          <span class="hud-status-label">Memory Dreaming Compactor</span>
          <span class="hud-status-value" style="color: var(--accent);">READY</span>
        </div>
        <div class="hud-status-row">
          <span class="hud-status-label">Radix SGLang Sidecar</span>
          <span class="hud-status-value" style="color: ${radixColor};">${radixStatus}</span>
        </div>
        <div class="hud-status-row">
          <span class="hud-status-label">Local Vector Indexer</span>
          <span class="hud-status-value" style="color: var(--accent);">READY</span>
        </div>
        <div class="hud-status-row">
          <span class="hud-status-label">CPU Fallback Engine</span>
          <span class="hud-status-value" style="color: ${cpuColor};">${cpuStatus}</span>
        </div>
        <div class="hud-card-value" style="font-size: 8px; margin-top: 2px; color: var(--text-muted);">${cpuDetail}</div>
        <div class="hud-status-row">
          <span class="hud-status-label">Browser Sandbox</span>
          <span class="hud-status-value" style="color: var(--accent);">READY</span>
        </div>
      `;
      hudPanel.appendChild(diagnosticSection);
      this.renderContinuityShellSurface();
    } catch (err) {
      console.error("Failed to refresh HUD data:", err);
    }
  }

  async resumeWorkflowCheckpoint(sessionKey) {
    if (!confirm(`Are you sure you want to resume workflow: ${sessionKey}?`)) return;

    try {
      this.hudActionState.checkpoints.set(sessionKey, {
        pending: true,
        message: describeSessionAction("resume-pending", { sessionKey }),
      });
      void this.refreshHudData();
      this.subtitles.update(
        describeSessionAction("resume-pending", {
          sessionKey,
        }),
      );

      const res = await this.gateway.request("checkpointer.resume", { sessionKey });
      const checkpoint = res?.checkpoint;
      const continuity = res?.continuity;

      if (checkpoint) {
        // Load the chat history of the checkpoint session
        await this.switchSession(sessionKey);
        const lifecycle = this.formatContinuityLabel(
          continuity?.lifecycle || checkpoint.continuity?.lifecycle || "resumable",
        );
        this.subtitles.update(
          describeSessionAction("resume-success", {
            stepIndex: checkpoint.stepIndex,
            lifecycle,
          }),
        );
        this.hudActionState.checkpoints.set(sessionKey, {
          pending: false,
          message: describeSessionAction("resume-success", {
            stepIndex: checkpoint.stepIndex,
            lifecycle,
          }),
        });
        void this.refreshHudData();
      }
    } catch (err) {
      console.error("Failed to resume checkpoint:", err);
      const message = describeSessionAction("resume-error", {
        sessionKey,
        detail: err?.message || String(err),
      });
      this.hudActionState.checkpoints.set(sessionKey, {
        pending: false,
        message,
      });
      void this.refreshHudData();
      this.subtitles.update(message);
      alert(message);
    }
  }

  setupPipDraggable() {
    // PIP removed — viewport is now the primary surface directly.
  }

  showGlassLab(url = "about:blank") {
    const frame = document.getElementById("viewport-iframe");
    const idle = document.getElementById("viewport-idle");
    const badge = document.getElementById("agent-badge");
    if (frame) frame.src = url;
    if (idle && url !== "about:blank") idle.classList.add("hidden");
    if (badge && url !== "about:blank") badge.classList.remove("hidden");
    void this.persistViewportObservation({
      state: url && url !== "about:blank" ? "acting" : "idle",
      label: url && url !== "about:blank" ? "Browser active" : "BIOS Home",
      detail: url && url !== "about:blank" ? url : "Virtual desktop body is standing by.",
      activeSurface: "virtual_desktop",
      targetUrl: url && url !== "about:blank" ? url : null,
    });
  }

  async speak(text) {
    // Voice abilities disabled at operator request.
  }

  stopSpeaking() {
    // Voice abilities disabled at operator request.
  }

  sanitizeTextForSpeech(text) {
    if (!text) return "";
    let clean = text;
    // 1. Remove fenced code blocks
    clean = clean.replace(/```[\s\S]*?```/g, "");
    // 2. Remove inline code
    clean = clean.replace(/`[^`]+`/g, "");
    // 3. Remove markdown links, keep label
    clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    // 4. Remove bold/italic/markdown symbols
    clean = clean.replace(/[*_#~]/g, "");
    // 5. Clean up extra whitespace and newlines
    clean = clean.replace(/\s+/g, " ").trim();
    return clean;
  }

  parseAgentName(profileText) {
    if (!profileText) return null;
    const match = profileText.match(/(?:Preferred\s+)?Agent\s+Name\s*[:=]\s*(.+)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    return null;
  }

  updateAgentNameInProfile(profileText, newName) {
    if (!profileText) {
      return `# BIOS AI — User Profile & Personalization\n\n## User Preferences\n- Preferred Agent Name: ${newName}\n- Preferred Name: Operator\n`;
    }
    const regex = /((?:Preferred\s+)?Agent\s+Name\s*[:=]\s*)(.+)/i;
    if (regex.test(profileText)) {
      return profileText.replace(regex, `$1${newName}`);
    }
    const sectionRegex = /(##\s+User\s+Preferences[^\n]*\n)/i;
    if (sectionRegex.test(profileText)) {
      return profileText.replace(sectionRegex, `$1- Preferred Agent Name: ${newName}\n`);
    }
    return profileText + `\n\n## User Preferences\n- Preferred Agent Name: ${newName}\n`;
  }

  promptForAgentName(profile) {
    return new Promise((resolve) => {
      const modal = document.getElementById("naming-modal");
      const card = modal.querySelector(".glass-elevated");

      // Step elements
      const stepIntro = document.getElementById("onboarding-step-intro");
      const stepName = document.getElementById("onboarding-step-name");
      const stepPerms = document.getElementById("onboarding-step-permissions");
      const stepReadback = document.getElementById("onboarding-step-readback");
      const title = document.getElementById("onboarding-title");
      const input = document.getElementById("agent-name-input");

      const onboardingResult = { agentName: null, permissionMode: "not_allowed" };

      function showStep(step) {
        [stepIntro, stepName, stepPerms, stepReadback].forEach((s) => {
          if (s) s.classList.add("hidden");
        });
        if (step) step.classList.remove("hidden");
      }

      modal.classList.remove("hidden");
      void modal.offsetWidth;
      modal.style.opacity = "1";
      card.style.transform = "translateY(0)";
      showStep(stepIntro);

      // Step 1: Introduction -> Name
      const btnIntroNext = document.getElementById("btn-onboarding-intro-next");
      if (btnIntroNext) {
        btnIntroNext.onclick = async () => {
          try {
            await this.gateway.request("onboarding.update", { introduced: true });
          } catch {
            /* best effort */
          }
          if (title) title.innerText = "NAME YOUR AGENT";
          showStep(stepName);
          if (input) input.focus();
        };
      }

      // Step 2: Name -> Permissions
      const btnNameNext = document.getElementById("btn-onboarding-name-next");
      if (btnNameNext) {
        btnNameNext.onclick = async () => {
          const val = input.value.trim();
          if (!val) {
            input.style.borderColor = "var(--danger)";
            return;
          }
          onboardingResult.agentName = val;
          try {
            await this.gateway.request("onboarding.update", { agentName: val });
          } catch {
            /* best effort */
          }

          const nameLabel = document.getElementById("onboarding-agent-name-label");
          if (nameLabel) nameLabel.innerText = val;
          if (title) title.innerText = "PERMISSION POSTURE";
          showStep(stepPerms);
        };
      }
      if (input) {
        input.onkeydown = (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (btnNameNext) btnNameNext.click();
          }
        };
      }

      // Step 3: Permission choice -> Readback
      const btnPermYes = document.getElementById("btn-onboarding-perm-yes");
      const btnPermNo = document.getElementById("btn-onboarding-perm-no");

      const handlePermission = async (mode) => {
        onboardingResult.permissionMode = mode;
        try {
          await this.gateway.request("onboarding.update", { permissionMode: mode });
          if (mode === "allowed") {
            await this.gateway.request("boss.posture.update", { mode: "yolo" });
          }
        } catch {
          /* best effort */
        }

        const readbackCopy = document.getElementById("onboarding-readback-copy");
        if (readbackCopy) {
          const permLabel =
            mode === "allowed"
              ? "broad authority - routine system actions can proceed without approval prompts"
              : "ask-first - BIOS AI will stop before actions that affect your system";
          readbackCopy.innerHTML =
            `<strong>${onboardingResult.agentName}</strong> is ready.<br><br>` +
            `<strong>Permission posture:</strong> ${permLabel}.<br>` +
            `<strong>Kernel hard stops:</strong> always active.<br>` +
            `<strong>Sandbox-first execution:</strong> always active.`;
        }
        if (title) title.innerText = "SYSTEM READY";
        showStep(stepReadback);
      };

      if (btnPermYes) btnPermYes.onclick = () => handlePermission("allowed");
      if (btnPermNo) btnPermNo.onclick = () => handlePermission("not_allowed");

      // Step 4: Finish
      const btnFinish = document.getElementById("btn-onboarding-finish");
      if (btnFinish) {
        btnFinish.onclick = async () => {
          btnFinish.disabled = true;
          btnFinish.innerText = "Initializing...";
          try {
            const updatedProfile = this.updateAgentNameInProfile(
              profile,
              onboardingResult.agentName,
            );
            await this.gateway.request("user.profile.update", { content: updatedProfile });
            await this.gateway.request("onboarding.update", { completed: true });
          } catch (err) {
            console.error("Failed to save onboarding state:", err);
          }

          modal.style.opacity = "0";
          card.style.transform = "translateY(20px)";
          setTimeout(() => {
            modal.classList.add("hidden");
            resolve(onboardingResult.agentName);
          }, 300);
        };
      }
    });
  }

  showOnboardingModal() {
    this.promptForAgentName("").then((name) => {
      if (name) {
        this.agentName = name;
        this.updateAgentNameDOM();
      }
    });
  }

  /** Update non-visual connection status; visible detail belongs in Status and Log. */
  showConnectionStatusBar(message) {
    let bar = document.getElementById("connection-status-bar");
    const tone = arguments[1] || "info";
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "connection-status-bar";
      bar.className = "connection-status-bar";
      bar.setAttribute("role", "status");
      bar.setAttribute("aria-live", "polite");
      bar.style.cssText = `
        position: fixed;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        clip-path: inset(50%);
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
      `;
      document.body.appendChild(bar);
    }
    bar.dataset.tone = tone;
    bar.title =
      tone === "warning"
        ? "BIOS AI keeps local work available while online services reconnect."
        : message;
    bar.innerText = message;
    bar.setAttribute("aria-label", message);
    bar.style.display = "block";
  }

  /** Hide the non-blocking status bar. */
  hideConnectionStatusBar() {
    const bar = document.getElementById("connection-status-bar");
    if (bar) bar.style.display = "none";
  }

  setConnectOverlayMessage(message) {
    const connectStatus = document.getElementById("connect-status");
    if (connectStatus) {
      connectStatus.innerText = message;
    }
  }

  setMemoryListPlaceholder(listId, message) {
    const el = document.getElementById(listId);
    if (!el) return;
    el.innerHTML = `<li class="ctx-empty">${this.escapeHtml(message)}</li>`;
  }

  setStatusValue(id, message) {
    const el = document.getElementById(id);
    if (el) {
      el.innerText = message;
    }
    renderStatusOverviewCard(this);
  }

  async runInitialShellHydration() {
    return runInitialShellHydrationSequence(this);
  }

  /** Conversational onboarding that runs directly in the chat stream.
   *  Matches the spec: "No forms, no wizards — just a conversation."
   *  Works offline (localStorage) or with gateway. */
  showOfflineWelcome() {
    const chatStream = document.getElementById("chat-stream");
    const chatEmpty = document.getElementById("chat-empty");
    if (chatEmpty) chatEmpty.style.display = "none";
    if (!chatStream || chatStream.querySelector(".onboard-conv")) return;

    this.runConversationalOnboarding(chatStream);
  }

  /** Also callable from the modal setup button path. */
  runClientSideOnboarding() {
    const offlineWelcome = document.querySelector(".offline-welcome");
    if (offlineWelcome) offlineWelcome.remove();

    const chatStream = document.getElementById("chat-stream");
    const chatEmpty = document.getElementById("chat-empty");
    if (chatEmpty) chatEmpty.style.display = "none";
    if (!chatStream) return;

    this.runConversationalOnboarding(chatStream);
  }

  /** Core conversational onboarding engine — renders chat bubbles with inline action cards.
   *  Now includes Step 0: System Discovery via Tauri command. */
  async runConversationalOnboarding(chatStream) {
    return runConversationalOnboardingController(this, chatStream);
  }

  updateAgentNameDOM() {
    const name = this.agentName || "BIOS AI";
    document.title = "BIOS AI";

    const chatInput = document.getElementById("chat-input");
    if (chatInput) chatInput.placeholder = `Message ${name}...`;

    const connectStatus = document.getElementById("connect-status");
    if (connectStatus) connectStatus.innerText = `Connecting to ${name}...`;

    const idleSub = document.getElementById("viewport-idle-agent");
    if (idleSub) idleSub.innerText = `${name} ready`;

    const settingsName = document.getElementById("settings-agent-name");
    if (settingsName) settingsName.innerText = name;
  }

  getActiveBiosProfileId() {
    return getActiveBiosProfileIdFromStorage(localStorage, this.activeBiosProfileId);
  }

  getSavedOnboardingSnapshot(profileId = this.getActiveBiosProfileId()) {
    return getSavedOnboardingSnapshotFromStorage(localStorage, profileId);
  }

  async ensureBiosActivationReady() {
    const profileId = String(this.activeBiosProfileId || "").trim();
    if (!profileId) {
      return {
        ready: false,
        reason: "missing_boss_profile",
        message:
          "BIOS AI needs a BOSS profile before chat can start. I’m reopening setup so you can create or resume one.",
      };
    }

    const detail = await AetherApp.prototype.loadBiosProfileDetail
      .call(this, profileId)
      .catch(() => null);
    if (!detail?.onboarding) {
      return {
        ready: false,
        reason: "missing_boss_profile_detail",
        message:
          "BIOS AI found the profile id but not the saved BOSS setup. I’m reopening setup so the profile can be rebuilt safely.",
      };
    }

    const snapshot = buildSavedOnboardingSnapshotFromProfileDetail(
      detail,
      this.agentName || "BOSS Agent",
    );
    if (!snapshot?.completed || !snapshot?.agentName) {
      return {
        ready: false,
        reason: "boss_profile_incomplete",
        message:
          "This BOSS profile is not fully onboarded yet. I’m taking you back into setup so BIOS AI can finish activation.",
      };
    }

    const routeReady = await savedOnboardingRouteIsRunnable(snapshot, profileId);
    if (!routeReady) {
      return {
        ready: false,
        reason: "boss_brain_not_ready",
        message:
          "This BOSS profile still needs a selected and ready BOSS brain before chat can begin. I’m reopening setup to finish that step.",
      };
    }

    return {
      ready: true,
      reason: null,
      snapshot,
    };
  }

  saveSavedOnboardingSnapshot(snapshot, profileId = this.getActiveBiosProfileId()) {
    return saveSavedOnboardingSnapshotStorage(localStorage, snapshot, profileId);
  }

  clearSavedOnboardingSnapshot(profileId) {
    return clearSavedOnboardingSnapshotStorage(localStorage, profileId);
  }

  beginFreshBiosProfileOnboarding({ clearExistingProfileId = null } = {}) {
    const profileIdToClear = clearExistingProfileId || null;
    this.pendingNewBiosProfile = true;
    this.profilePickerActive = false;
    if (profileIdToClear) {
      this.clearSavedOnboardingSnapshot(profileIdToClear);
    } else {
      this.clearSavedOnboardingSnapshot(null);
    }
    this.activeBiosProfileId = null;
    this.hasCalibratedAgentName = false;
    this.biosRuntimeStatus = null;
    this.biosShellContract = null;
    this.biosBoxedLane = null;
    this.biosPromotion = null;
    this.biosBrainstem = null;
    this.biosReflex = null;
    this.biosObservation = null;
    this.biosMemoryContract = null;
    this.biosSoulContract = null;
    this.biosSoulGovernance = null;
    this.pendingSoulDecisionId = null;
    this.biosDreamContract = null;
    this.forgeArenaProfile = null;
    this.forgeArenaProfileFormSignature = "";
    this.agentName = "BIOS AI";
    this.updateAgentNameDOM();
    this.syncSavedOnboardingSnapshot();
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof tauriInvoke === "function") {
      void tauriInvoke("clear_active_bios_profile").catch((err) => {
        console.warn(
          "[BIOS AI] Failed to clear native active profile before fresh onboarding:",
          err,
        );
      });
    }
    const chatStream = document.getElementById("chat-stream");
    if (chatStream) {
      chatStream.innerHTML = "";
    }
    this.showOfflineWelcome();
  }

  async loadBiosProfiles() {
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof tauriInvoke !== "function") {
      return [];
    }
    try {
      const response = await tauriInvoke("list_bios_profiles");
      this.biosProfiles = response?.profiles || [];
      const resolvedActiveProfileId = this.biosProfiles.length
        ? response?.active_profile_id || null
        : null;
      this.activeBiosProfileId = resolvedActiveProfileId;
      if (this.activeBiosProfileId) {
        localStorage.setItem(BIOS_ACTIVE_PROFILE_KEY, this.activeBiosProfileId);
      } else {
        localStorage.removeItem(BIOS_ACTIVE_PROFILE_KEY);
      }
      this.renderProfileSettings();
      if (typeof this.loadForgeArenaProfile === "function") {
        await this.loadForgeArenaProfile(this.activeBiosProfileId);
      }
      return this.biosProfiles;
    } catch (err) {
      console.warn("[BIOS AI] Failed to load BIOS profiles:", err);
      return [];
    }
  }

  async loadBiosProfileDetail(profileId) {
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof tauriInvoke !== "function" || !profileId) {
      return null;
    }
    return tauriInvoke("load_bios_profile", { profileId });
  }

  async loadWorkerModelCatalog(profileId = this.activeBiosProfileId) {
    return loadWorkerModelCatalogSafe(profileId || null);
  }

  async loadBiosProviderConfig(profileId = this.activeBiosProfileId) {
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof tauriInvoke !== "function") {
      return {
        active_provider: "",
        active_model: "",
        keys: [],
        conversation_history: [],
      };
    }
    try {
      return await tauriInvoke("load_provider_config", {
        profileId: profileId || null,
      });
    } catch {
      return {
        active_provider: "",
        active_model: "",
        keys: [],
        conversation_history: [],
      };
    }
  }

  async loadBiosLocalConnectorStatus(profileId = this.activeBiosProfileId) {
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof tauriInvoke !== "function") {
      return {
        profile_id: profileId || null,
        connectors: [],
      };
    }
    try {
      return await tauriInvoke("load_bios_local_connector_status", {
        profileId: profileId || null,
      });
    } catch {
      return {
        profile_id: profileId || null,
        connectors: [],
      };
    }
  }

  async loadBiosLocalToolRegistry() {
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof tauriInvoke !== "function") {
      return { tools: [] };
    }
    try {
      return await tauriInvoke("bios_local_tool_registry");
    } catch {
      return { tools: [] };
    }
  }

  async saveBiosLocalConnectorBinding({
    connector,
    enabled,
    targetId = null,
    allowedActions = undefined,
  } = {}) {
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (!this.activeBiosProfileId) {
      throw new Error("Create or resume a BIOS profile before saving local connector settings.");
    }
    if (typeof tauriInvoke !== "function") {
      throw new Error("BIOS AI local connector controls need the native runtime.");
    }
    const response = await tauriInvoke("save_bios_local_connector_binding", {
      input: {
        profile_id: this.activeBiosProfileId,
        connector,
        enabled: Boolean(enabled),
        target_id: targetId ? String(targetId).trim() : null,
        allowed_actions: Array.isArray(allowedActions) ? allowedActions : undefined,
      },
    });
    await recordBiosProofEventSafe({
      profileId: this.activeBiosProfileId,
      eventType: "local_connector_bound",
      source: "settings.local_connector",
      summary: `${connector || "local connector"} settings changed for this BOSS profile.`,
      tags: ["settings", "connector", "runtime"],
      payloadRedacted: {
        connector: connector || null,
        enabled: Boolean(enabled),
        has_target: Boolean(targetId),
        allowed_actions: Array.isArray(allowedActions) ? allowedActions.slice().sort() : [],
      },
    });
    await this.loadBiosRuntimeStatus({ tickBrainstem: false });
    this.renderProfileSettings();
    return response;
  }

  async saveBiosProfileProviderConfig(config, { preferredCloudProvider = undefined } = {}) {
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    const normalizedConfig = {
      active_provider: "",
      active_model: "",
      keys: [],
      conversation_history: [],
      ...(config || {}),
    };
    if (!this.activeBiosProfileId) {
      throw new Error("Create or resume a BIOS profile before saving provider settings.");
    }
    const detail = await this.loadBiosProfileDetail(this.activeBiosProfileId);
    const snapshot = mergeProviderConfigIntoSavedSnapshot(
      buildSavedOnboardingSnapshotFromProfileDetail(detail, this.agentName || "BOSS Agent"),
      normalizedConfig,
    );
    if (preferredCloudProvider !== undefined) {
      snapshot.preferredCloudProvider = preferredCloudProvider || null;
    }
    const alignedConfig = alignProviderConfigToSavedRoute(snapshot, normalizedConfig);
    if (typeof tauriInvoke === "function") {
      await tauriInvoke("save_provider_config", {
        config: alignedConfig,
        profileId: this.activeBiosProfileId || null,
      });
    }
    await this.saveBiosProfileSnapshot(snapshot, this.activeBiosProfileId, true);
    await recordBiosProofEventSafe({
      profileId: this.activeBiosProfileId,
      eventType: "settings_changed",
      source: "settings.provider_config",
      summary: "Provider settings changed for this BOSS profile.",
      tags: ["settings", "provider", "runtime"],
      payloadRedacted: {
        active_provider: alignedConfig.active_provider || null,
        active_model: alignedConfig.active_model || null,
        key_count: Array.isArray(alignedConfig.keys) ? alignedConfig.keys.length : 0,
        preferred_cloud_provider: snapshot.preferredCloudProvider || null,
      },
    });
    this.syncSavedOnboardingSnapshot();
    await this.loadBiosRuntimeStatus({ tickBrainstem: false });
    this.renderProfileSettings();
    return alignedConfig;
  }

  async installManagedWorkerModel(variant, { onProgress = null } = {}) {
    const result = await installManagedWorkerModelSafe({
      variant,
      profileId: this.activeBiosProfileId || null,
      onProgress,
    });
    await recordBiosProofEventSafe({
      profileId: this.activeBiosProfileId,
      eventType: result?.download?.state === "failed" ? "model_install_failed" : "model_installed",
      source: "settings.managed_worker_install",
      summary:
        result?.download?.state === "failed"
          ? "Managed local model install failed."
          : "Managed local model install completed or reused.",
      tags: ["model", "worker", "runtime"],
      payloadRedacted: {
        variant,
        download_state: result?.download?.state || null,
        installed_count: Array.isArray(result?.assetsStatus?.installed_models)
          ? result.assetsStatus.installed_models.length
          : null,
        error: result?.download?.error || null,
      },
    });
    return result;
  }

  async installAllManagedWorkerModels({ onProgress = null } = {}) {
    const result = await installAllManagedWorkerModelsSafe({
      profileId: this.activeBiosProfileId || null,
      onProgress,
    });
    await recordBiosProofEventSafe({
      profileId: this.activeBiosProfileId,
      eventType:
        result?.downloadQueue?.state === "failed"
          ? "model_catalog_install_failed"
          : "model_catalog_install_started",
      source: "settings.managed_worker_install_all",
      summary:
        result?.downloadQueue?.state === "failed"
          ? "Managed local model catalog install failed."
          : "Managed local model catalog install started or completed.",
      tags: ["model", "worker", "runtime"],
      payloadRedacted: {
        queue_state: result?.downloadQueue?.state || null,
        requested_variants: result?.downloadQueue?.requested_variants || [],
        completed_count: result?.downloadQueue?.completed_count || 0,
        total_count: result?.downloadQueue?.total_count || 0,
        active_variant: result?.downloadQueue?.active_variant || null,
        error: result?.downloadQueue?.error || null,
      },
    });
    return result;
  }

  async saveBiosProfileSnapshot(snapshot, profileId = this.activeBiosProfileId, makeActive = true) {
    if (profileId) {
      this.saveSavedOnboardingSnapshot(snapshot, profileId);
    }
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof tauriInvoke !== "function") {
      this.saveSavedOnboardingSnapshot(snapshot, profileId || this.getActiveBiosProfileId());
      return null;
    }
    const detail = await tauriInvoke(
      "save_bios_profile",
      buildBiosProfileSaveInput(snapshot, {
        profileId,
        displayName: this.agentName || "BOSS Agent",
        makeActive,
      }),
    );
    this.activeBiosProfileId = detail?.profile?.id || profileId || null;
    if (this.activeBiosProfileId) {
      this.saveSavedOnboardingSnapshot(snapshot, this.activeBiosProfileId);
    }
    await recordBiosProofEventSafe({
      profileId: this.activeBiosProfileId,
      eventType: profileId ? "boss_profile_updated" : "boss_profile_created",
      source: "bios_profile.save",
      summary: `${snapshot?.agentName || this.agentName || "BOSS profile"} profile saved.`,
      tags: ["profile", "runtime"],
      payloadRedacted: {
        completed: Boolean(snapshot?.completed),
        make_active: Boolean(makeActive),
        model_pref: snapshot?.modelPref || null,
        preferred_local_backend: snapshot?.preferredLocalBackend || null,
        local_worker_model_variant: snapshot?.localWorkerModelVariant || null,
        worker_roster_count: Array.isArray(snapshot?.biosWorkerRoster)
          ? snapshot.biosWorkerRoster.length
          : 0,
      },
    });
    this.agentName = snapshot?.agentName || this.agentName;
    this.updateAgentNameDOM();
    await this.loadBiosProfiles();
    if (typeof this.loadForgeArenaProfile === "function") {
      await this.loadForgeArenaProfile(this.activeBiosProfileId);
    }
    return detail;
  }

  async setActiveBiosProfile(profileId) {
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    this.activeBiosProfileId = profileId || null;
    if (document?.body) {
      document.body.dataset.activeBiosProfileId = this.activeBiosProfileId || "";
      document.body.dataset.activeBossName = this.agentName || "";
    }
    if (profileId) {
      localStorage.setItem(BIOS_ACTIVE_PROFILE_KEY, profileId);
    }
    if (typeof tauriInvoke === "function" && profileId) {
      try {
        await tauriInvoke("set_active_bios_profile", { profileId });
        await recordBiosProofEventSafe({
          profileId,
          eventType: "boss_profile_resumed",
          source: "bios_profile.activation",
          summary: "BOSS profile resumed as the active BIOS AI profile.",
          tags: ["profile", "runtime"],
          payloadRedacted: {
            active_profile_id: profileId,
          },
        });
      } catch (err) {
        console.warn("[BIOS AI] Failed to set active BIOS profile:", err);
      }
    }
    this.renderProfileSettings();
    if (typeof this.loadForgeArenaProfile === "function") {
      await this.loadForgeArenaProfile(profileId);
    }
  }

  async deleteBiosProfile(profileId) {
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof tauriInvoke !== "function" || !profileId) {
      return null;
    }
    const response = await tauriInvoke("delete_bios_profile", { profileId });
    this.clearSavedOnboardingSnapshot(profileId);
    await this.loadBiosProfiles();
    if (response?.active_profile_id) {
      await this.activateExistingBiosProfile(response.active_profile_id, { announce: false });
    } else {
      this.activeBiosProfileId = null;
      this.forgeArenaProfile = null;
      this.forgeArenaProfileFormSignature = "";
      this.agentName = "BIOS AI";
      this.updateAgentNameDOM();
      this.syncSavedOnboardingSnapshot();
    }
    return response;
  }

  async renameActiveBiosProfile(nextName) {
    const trimmedName = String(nextName || "").trim();
    if (!trimmedName || !this.activeBiosProfileId) {
      return null;
    }
    const detail = await this.loadBiosProfileDetail(this.activeBiosProfileId);
    const snapshot = buildSavedOnboardingSnapshotFromProfileDetail(detail, trimmedName);
    snapshot.agentName = trimmedName;
    const savedDetail = await this.saveBiosProfileSnapshot(
      snapshot,
      this.activeBiosProfileId,
      true,
    );
    await appendBiosDebugLog("bios_profile.rename", {
      profileId: this.activeBiosProfileId,
      agentName: trimmedName,
    });
    this.syncSavedOnboardingSnapshot();
    return savedDetail;
  }

  async saveBiosProfileRuntimePreferences({
    permissionMode = undefined,
    modelPref = undefined,
    preferredLocalBackend = undefined,
    localWorkerModelVariant = undefined,
    localWorkerModelPath = undefined,
    biosWorkerRoster = undefined,
  } = {}) {
    if (!this.activeBiosProfileId) {
      return null;
    }
    const detail = await this.loadBiosProfileDetail(this.activeBiosProfileId);
    const snapshot = buildSavedOnboardingSnapshotFromProfileDetail(
      detail,
      this.agentName || "BOSS Agent",
    );

    if (permissionMode) {
      snapshot.permissionMode = permissionMode;
    }
    if (modelPref) {
      snapshot.modelPref = modelPref;
    }
    if (preferredLocalBackend !== undefined) {
      snapshot.preferredLocalBackend = preferredLocalBackend || null;
      if (preferredLocalBackend === MANAGED_LOCAL_RUNTIME_PROVIDER) {
        snapshot.localRuntimeOwner = "BIOS AI";
        snapshot.localRuntimeEngine = MANAGED_LOCAL_RUNTIME_ENGINE;
        snapshot.localRuntimeStrategy = "BIOS-managed local runtime";
      } else if (preferredLocalBackend) {
        snapshot.localRuntimeOwner = "External local runtime";
        snapshot.localRuntimeEngine = formatSavedLocalBackend(preferredLocalBackend);
        snapshot.localRuntimeStrategy = "Connected existing local backend";
        snapshot.localWorkerModelVariant = null;
        snapshot.localWorkerModelPath = null;
        snapshot.biosWorkerRoster = [];
        snapshot.localWorkerDownloadStatus = "not-needed";
      }
    }

    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    const workerCatalog = await this.loadWorkerModelCatalog?.();
    const machineProfile = workerCatalog?.machine_profile || null;
    const installedWorkerVariants = new Set(
      (Array.isArray(workerCatalog?.entries) ? workerCatalog.entries : [])
        .filter((entry) => entry?.installed)
        .map((entry) =>
          String(entry?.variant || "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    );
    const normalizeRoster = (fallbackVariant = null, fallbackPath = null) => {
      if (Array.isArray(biosWorkerRoster)) {
        return biosWorkerRoster;
      }
      return buildBossWorkerRosterAssignments({
        workerCatalog,
        machineProfile,
        bossVariant: fallbackVariant,
        bossPath: fallbackPath,
      });
    };
    const buildNativeRosterAssignments = (roster = []) =>
      roster
        .map((entry) => {
          const role = String(entry?.role || "").trim();
          const variant = String(entry?.variant || "")
            .trim()
            .toLowerCase();
          return {
            role,
            variant,
          };
        })
        .filter((entry) => {
          const variant = entry.variant;
          return (
            entry.role &&
            variant &&
            (!installedWorkerVariants.size || installedWorkerVariants.has(variant))
          );
        });
    if (
      preferredLocalBackend === MANAGED_LOCAL_RUNTIME_PROVIDER &&
      localWorkerModelPath &&
      typeof tauriInvoke === "function"
    ) {
      const selection = await tauriInvoke("register_external_worker_model", {
        path: localWorkerModelPath,
        profileId: this.activeBiosProfileId,
      });
      snapshot.localWorkerModelVariant = selection?.variant || null;
      snapshot.localWorkerModelPath = selection?.path || localWorkerModelPath || null;
      snapshot.localRuntimeOwner = "BIOS AI";
      snapshot.localRuntimeEngine = MANAGED_LOCAL_RUNTIME_ENGINE;
      snapshot.localRuntimeStrategy = "BIOS-managed custom GGUF runtime";
      snapshot.biosWorkerRoster = normalizeRoster(
        selection?.variant || snapshot.localWorkerModelVariant || null,
        selection?.path || localWorkerModelPath || null,
      );
      const nativeRoster = buildNativeRosterAssignments(snapshot.biosWorkerRoster);
      if (nativeRoster.length) {
        await tauriInvoke("save_worker_runtime_roster", {
          assignments: nativeRoster,
          profileId: this.activeBiosProfileId,
        });
      }
      snapshot.localWorkerDownloadStatus = "installed";
    } else if (
      preferredLocalBackend === MANAGED_LOCAL_RUNTIME_PROVIDER &&
      localWorkerModelVariant &&
      typeof tauriInvoke === "function"
    ) {
      const selection = await tauriInvoke("save_worker_runtime_selection", {
        variant: localWorkerModelVariant,
        profileId: this.activeBiosProfileId,
      });
      snapshot.localWorkerModelVariant = selection?.variant || localWorkerModelVariant;
      snapshot.localWorkerModelPath = selection?.path || snapshot.localWorkerModelPath || null;
      snapshot.biosWorkerRoster = normalizeRoster(
        selection?.variant || localWorkerModelVariant,
        selection?.path || null,
      );
      const nativeRoster = buildNativeRosterAssignments(snapshot.biosWorkerRoster);
      if (nativeRoster.length) {
        await tauriInvoke("save_worker_runtime_roster", {
          assignments: nativeRoster,
          profileId: this.activeBiosProfileId,
        });
      }
      snapshot.localWorkerDownloadStatus = "installed";
    } else if (localWorkerModelVariant !== undefined) {
      snapshot.localWorkerModelVariant = localWorkerModelVariant || null;
      if (localWorkerModelPath !== undefined) {
        snapshot.localWorkerModelPath = localWorkerModelPath || null;
      }
      snapshot.biosWorkerRoster = normalizeRoster(
        snapshot.localWorkerModelVariant,
        snapshot.localWorkerModelPath,
      );
    } else if (biosWorkerRoster !== undefined) {
      snapshot.biosWorkerRoster = Array.isArray(biosWorkerRoster) ? biosWorkerRoster : [];
    }

    const savedDetail = await this.saveBiosProfileSnapshot(
      snapshot,
      this.activeBiosProfileId,
      true,
    );
    if (
      typeof tauriInvoke === "function" &&
      this.activeBiosProfileId &&
      typeof this.saveSavedOnboardingSnapshot === "function"
    ) {
      const refreshedDetail = await this.loadBiosProfileDetail(this.activeBiosProfileId);
      const refreshedSnapshot = buildSavedOnboardingSnapshotFromProfileDetail(
        refreshedDetail,
        snapshot.agentName || this.agentName || "BOSS Agent",
      );
      this.saveSavedOnboardingSnapshot(refreshedSnapshot, this.activeBiosProfileId);
    }
    await recordBiosProofEventSafe({
      profileId: this.activeBiosProfileId,
      eventType: "settings_changed",
      source: "settings.runtime_preferences",
      summary: "Runtime preferences changed for this BOSS profile.",
      tags: ["settings", "runtime", "model"],
      payloadRedacted: {
        permission_mode: snapshot.permissionMode || null,
        model_pref: snapshot.modelPref || null,
        preferred_local_backend: snapshot.preferredLocalBackend || null,
        local_worker_model_variant: snapshot.localWorkerModelVariant || null,
        local_worker_model_path_present: Boolean(snapshot.localWorkerModelPath),
        worker_roster: Array.isArray(snapshot.biosWorkerRoster)
          ? snapshot.biosWorkerRoster.map((entry) => ({
              role: entry?.role || null,
              variant: entry?.variant || entry?.selection?.variant || null,
              has_path: Boolean(entry?.path || entry?.selection?.path),
            }))
          : [],
      },
    });
    if (typeof tauriInvoke === "function") {
      const providerConfig = await this.loadBiosProviderConfig(this.activeBiosProfileId);
      const alignedProviderConfig = alignProviderConfigToSavedRoute(snapshot, providerConfig);
      await tauriInvoke("save_provider_config", {
        config: alignedProviderConfig,
        profileId: this.activeBiosProfileId,
      });
    }
    this.syncSavedOnboardingSnapshot();
    await this.loadBiosRuntimeStatus({ tickBrainstem: false });
    this.renderProfileSettings();
    return savedDetail;
  }

  async activateExistingBiosProfile(profileId, { announce = true } = {}) {
    this.profilePickerActive = false;
    const detail = await this.loadBiosProfileDetail(profileId);
    if (!detail?.onboarding) {
      return false;
    }
    const snapshot = buildSavedOnboardingSnapshotFromProfileDetail(detail);
    await this.setActiveBiosProfile(profileId);
    this.saveSavedOnboardingSnapshot(snapshot, profileId);
    this.hasCalibratedAgentName = Boolean(snapshot.completed && snapshot.agentName);
    this.agentName = snapshot.agentName || "BIOS AI";
    this.updateAgentNameDOM();
    if (document?.body) {
      document.body.dataset.activeBiosProfileId = profileId || "";
      document.body.dataset.activeBossName = this.agentName || "";
    }
    this.syncSavedOnboardingSnapshot();
    await this.tickBiosBrainstem();
    await this.loadBiosRuntimeStatus({ tickBrainstem: false });
    if (typeof this.loadForgeArenaProfile === "function") {
      await this.loadForgeArenaProfile(profileId);
    }
    this.initSettingsProviderPanel();
    const routeReady = await savedOnboardingRouteIsRunnable(snapshot, profileId);
    if (announce) {
      const chatEmpty = document.getElementById("chat-empty");
      if (chatEmpty) chatEmpty.style.display = "none";
      const chatStream = document.getElementById("chat-stream");
      if (chatStream) {
        chatStream.innerHTML = "";
        const bubble = document.createElement("div");
        bubble.className = "chat-bubble chat-bubble-agent";
        bubble.innerHTML =
          snapshot.completed && routeReady
            ? `<p style="font-size: 14px; color: #e2e8f0; margin: 0;"><strong>${this.escapeHtml(snapshot.agentName)}</strong> is loaded. Resume whenever you're ready.</p>`
            : `<p style="font-size: 14px; color: #e2e8f0; margin: 0;"><strong>${this.escapeHtml(snapshot.agentName)}</strong> is loaded, but chat is still locked. BIOS AI is reopening the saved onboarding state now so it can finish the missing local route, model, or connection work.</p>`;
        chatStream.appendChild(bubble);
      }
      if (!snapshot.completed || !routeReady) {
        this.showOfflineWelcome();
      }
    }
    return routeReady;
  }

  showProfilePicker() {
    this.profilePickerActive = true;
    const chatStream = document.getElementById("chat-stream");
    const chatEmpty = document.getElementById("chat-empty");
    if (chatEmpty) chatEmpty.style.display = "none";
    if (!chatStream) return;
    chatStream.innerHTML = "";
    this.renderProfilePickerViewport();
    this.renderRailBossStatus({
      profileLabel: "Choose profile",
      routeLabel: "Route waiting",
      workerLabel: "Worker after choice",
    });

    const card = document.createElement("div");
    const highlightedProfileId = this.profilePickerActive ? null : this.activeBiosProfileId;
    card.className = "onboard-conv chat-bubble chat-bubble-agent";
    card.innerHTML = `
      <div style="padding: 14px; border-radius: 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); margin: 4px 0 12px;">
        <p style="font-size: 13px; color: #e2e8f0; margin: 0 0 12px; line-height: 1.6;">
          I found existing BOSS profiles. Choose which one you want to bring back, or start a brand new one.
        </p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${this.biosProfiles
            .map(
              (profile) => `
                <button data-profile-id="${profile.id}" class="bios-profile-picker" style="padding: 12px; text-align: left; border-radius: 10px; background: ${profile.id === highlightedProfileId ? "rgba(0,255,170,0.08)" : "transparent"}; border: 1px solid rgba(255,255,255,0.08); color: #e2e8f0; cursor: pointer;">
                  <strong>${this.escapeHtml(profile.display_name)}</strong>
                  <span style="display: block; font-size: 11px; color: #718096; margin-top: 4px;">${this.escapeHtml(profile.model_pref || "setup in progress")} · ${profile.local_worker_ready ? "BOSS runtime ready" : "BOSS runtime not ready yet"}</span>
                </button>`,
            )
            .join("")}
          <button id="bios-profile-start-new" style="padding: 12px; border-radius: 10px; background: hsl(160,100%,50%); border: none; color: #080a10; font-weight: 700; cursor: pointer;">Start a new BOSS profile</button>
        </div>
      </div>
    `;
    chatStream.appendChild(card);
    card.querySelectorAll(".bios-profile-picker").forEach((button) => {
      const profileId = button.getAttribute("data-profile-id");
      const profile = this.biosProfiles.find((entry) => entry.id === profileId);
      if (!profile) {
        return;
      }
      const routeLine = button.querySelector("span");
      if (routeLine) {
        routeLine.textContent = buildBiosProfilePickerSummary(profile);
      }
      buildBiosProfilePickerMetaLines(profile).forEach(({ text, color }) => {
        const line = document.createElement("span");
        line.style.display = "block";
        line.style.fontSize = "11px";
        line.style.color = color;
        line.style.marginTop = "4px";
        line.textContent = text;
        button.appendChild(line);
      });
    });

    card.querySelectorAll(".bios-profile-picker").forEach((button) => {
      button.addEventListener("click", async () => {
        const profileId = button.getAttribute("data-profile-id");
        await this.activateExistingBiosProfile(profileId);
      });
    });
    card.querySelector("#bios-profile-start-new")?.addEventListener("click", async () => {
      this.beginFreshBiosProfileOnboarding();
    });
  }

  renderProfilePickerViewport() {
    const idleOverlay = document.getElementById("viewport-idle");
    const bodyPosture = document.getElementById("viewport-body-posture");
    const appTitle = document.getElementById("viewport-app-title");
    if (idleOverlay) idleOverlay.classList.add("hidden");
    if (bodyPosture) bodyPosture.innerText = "Waiting for profile choice";
    if (appTitle) appTitle.innerText = "Choose BOSS profile";
  }

  renderProfileSettings() {
    return renderProfileSettingsSurface(this);
  }

  syncSavedOnboardingSnapshot() {
    return syncSavedOnboardingSnapshotSurface(this);
  }

  renderViewportIdleCompanion(snapshot) {
    const idle = buildViewportIdleSnapshot(snapshot);
    const idleOverlay = document.getElementById("viewport-idle");
    const kicker = document.getElementById("viewport-idle-kicker");
    const title = document.getElementById("viewport-idle-title");
    const route = document.getElementById("viewport-idle-route");
    const authority = document.getElementById("viewport-idle-authority");
    const profile = document.getElementById("viewport-idle-profile");
    const safety = document.getElementById("viewport-idle-safety");
    const note = document.getElementById("viewport-idle-note");
    const readiness = document.getElementById("viewport-idle-readiness");
    const worker = document.getElementById("viewport-idle-worker");
    const nextStep = document.getElementById("viewport-idle-next-step");
    const support = document.getElementById("viewport-idle-support");
    const body = document.getElementById("viewport-idle-body");
    const hostPolicy = document.getElementById("viewport-idle-host-policy");
    const bodyPosture = document.getElementById("viewport-body-posture");
    const appTitle = document.getElementById("viewport-app-title");
    if (idleOverlay) idleOverlay.classList.add("hidden");
    if (kicker) kicker.innerText = idle.kicker;
    if (title) title.innerText = idle.title;
    if (profile) profile.innerText = idle.profileLabel;
    if (route) route.innerText = idle.routeLabel;
    if (safety) safety.innerText = idle.safetyLabel;
    if (authority) authority.innerText = idle.authorityLabel;
    if (note) note.innerText = idle.note;
    if (readiness) readiness.innerText = idle.readinessLabel;
    if (worker) worker.innerText = idle.workerLabel;
    if (nextStep) nextStep.innerText = idle.nextActionLabel;
    if (support) support.innerText = idle.supportLabel;
    if (body) body.innerText = idle.bodyStateLabel;
    if (hostPolicy) hostPolicy.innerText = idle.hostInterruptionPolicy;
    if (bodyPosture) bodyPosture.innerText = idle.bodyStateLabel;
    if (appTitle && idle.viewportTitle) appTitle.innerText = idle.viewportTitle;
  }

  renderRailBossStatus(snapshot = {}) {
    const bossName = document.getElementById("rail-boss-name");
    const route = document.getElementById("rail-boss-route");
    const worker = document.getElementById("rail-boss-worker");
    if (bossName) bossName.innerText = snapshot.profileLabel || "Waiting";
    if (route) route.innerText = snapshot.routeLabel || "Route waiting";
    if (worker) worker.innerText = snapshot.workerLabel || "Worker waiting";
  }

  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  updateObservationPlane(state, label, detail = "") {
    // Update viewport status bar directly
    this.renderViewportStatus();
    void this.persistViewportObservation({
      state,
      label,
      detail,
      activeSurface:
        this.browserSandboxStatus?.active && this.browserSandboxStatus?.url !== "about:blank"
          ? "virtual_desktop"
          : "local_shell",
      bodyMode:
        this.browserSandboxStatus?.active && this.browserSandboxStatus?.url !== "about:blank"
          ? "private_desktop_active"
          : state === "idle"
            ? "shell_standby"
            : "shell_visible",
      targetUrl:
        this.browserSandboxStatus?.active && this.browserSandboxStatus?.url !== "about:blank"
          ? this.browserSandboxStatus.url
          : null,
    });
  }

  async persistViewportObservation({
    state = "idle",
    label = "BIOS Home",
    detail = "",
    activeSurface = "local_shell",
    bodyMode = null,
    targetUrl = null,
  } = {}) {
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof tauriInvoke !== "function" || !this.activeBiosProfileId) {
      return null;
    }
    try {
      const observation = await tauriInvoke("update_bios_observation_state", {
        input: {
          profile_id: this.activeBiosProfileId,
          state,
          label,
          detail,
          active_surface: activeSurface,
          body_mode: bodyMode,
          target_url: targetUrl,
        },
      });
      this.biosObservation = observation;
      return observation;
    } catch (err) {
      console.warn("[AetherApp] Failed to persist BIOS observation state:", err);
      return null;
    }
  }

  async loadSessionMission() {
    try {
      const res = await this.gateway.request("mission.get", { sessionKey: this.activeSessionKey });
      if (res && res.state) {
        this.activeMission = res.state;
        this.activeContinuity = res.continuity || null;
        this.renderContinuityShellSurface();
        this.renderMissionControl();
      }
    } catch (err) {
      console.error("[AetherApp] Failed to load session mission:", err);
    }
  }

  async loadOnboardingState() {
    return loadOnboardingStateSurface(this);
  }

  async tickBiosBrainstem({ allowDream = true } = {}) {
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof tauriInvoke !== "function" || !this.activeBiosProfileId) {
      return null;
    }
    try {
      const state = await runBiosBrainstemTick(tauriInvoke, {
        profileId: this.activeBiosProfileId,
        allowDream,
      });
      if (state) {
        this.biosBrainstem = state;
      }
      return state;
    } catch (err) {
      console.warn("[AetherApp] Failed to tick BIOS brainstem:", err);
      return null;
    }
  }

  async loadBiosRuntimeStatus(options = {}) {
    return loadBiosRuntimeStatusSurface(this, options);
  }

  renderBiosRuntimeStatus(status) {
    return renderBiosRuntimeStatusSurface(this, status);
  }

  async loadDebugLog() {
    return loadDebugLogSurface(this);
  }

  async refreshForgeArenaRunLogSummary() {
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke || null;
    if (typeof tauriInvoke !== "function") {
      this.forgeArenaRunLogSummary = summarizeForgeArenaOvernightLog("");
      return this.forgeArenaRunLogSummary;
    }
    try {
      const logText = await tauriInvoke("read_debug_log");
      this.forgeArenaRunLogSummary = summarizeForgeArenaOvernightLog(logText || "");
    } catch (err) {
      this.forgeArenaRunLogSummary = {
        ...summarizeForgeArenaOvernightLog(""),
        state: "unavailable",
        title: "Field-run log unavailable",
        detail: err?.message || "BIOS AI could not read the packaged runtime debug log.",
      };
    }
    return this.forgeArenaRunLogSummary;
  }

  async clearDebugLog() {
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof tauriInvoke !== "function") {
      return;
    }
    try {
      await tauriInvoke("clear_debug_log");
      await appendBiosDebugLog("bios.debug_log.cleared", {
        profileId: this.activeBiosProfileId || null,
      });
      await this.loadDebugLog();
    } catch (err) {
      console.error("[AetherApp] Failed to clear BIOS debug log:", err);
    }
  }

  async loadContinuityHealth() {
    this.telemetryLoadState.continuity = "loading";
    this.setStatusValue(
      "st-agent-state",
      describeTelemetryLoad("pending", { surface: "Agent State" }),
    );
    try {
      const res = await this.gateway.request("continuity.health", {});
      if (res) {
        this.continuityHealth = res;
        this.telemetryLoadState.continuity = "ready";
        this.renderContinuityHealthPanel(res);
      }
    } catch (err) {
      this.telemetryLoadState.continuity = "error";
      this.setStatusValue(
        "st-agent-state",
        describeTelemetryLoad("error", {
          surface: "Agent State",
          detail: err?.message || String(err),
        }),
      );
      console.error("[AetherApp] Failed to load continuity health:", err);
    }
  }

  async loadMemorySurface() {
    const resetCount = (id) => {
      const el = document.getElementById(id);
      if (el) {
        el.innerText = "0";
      }
    };

    this.telemetryLoadState.memory = "loading";
    resetCount("memory-count-orders");
    resetCount("memory-count-prefs");
    resetCount("memory-count-facts");
    resetCount("memory-count-longterm");
    this.setMemoryListPlaceholder(
      "memory-orders-list",
      describeTelemetryLoad("pending", { surface: "Standing Orders" }),
    );
    this.setMemoryListPlaceholder(
      "memory-prefs-list",
      describeTelemetryLoad("pending", { surface: "Preferences" }),
    );
    this.setMemoryListPlaceholder(
      "memory-facts-list",
      describeTelemetryLoad("pending", { surface: "Mission Facts" }),
    );
    this.setMemoryListPlaceholder(
      "memory-longterm-list",
      describeTelemetryLoad("pending", { surface: "Long-Term Memory" }),
    );
    try {
      const res = await AetherApp.prototype.getRuntimeTransportClient.call(this).loadMemorySurface({
        profileId: this.activeBiosProfileId || null,
      });
      if (res && res.surface) {
        this.memorySurface = res.surface;
        if (typeof this.loadBiosSoulGovernance === "function") {
          await this.loadBiosSoulGovernance();
        }
        this.telemetryLoadState.memory = "ready";
        this.renderMemorySurfacePanel(res.surface);
      }
    } catch (err) {
      this.telemetryLoadState.memory = "error";
      this.setMemoryListPlaceholder(
        "memory-orders-list",
        describeTelemetryLoad("error", {
          surface: "Standing Orders",
          detail: err?.message || String(err),
        }),
      );
      this.setMemoryListPlaceholder(
        "memory-prefs-list",
        describeTelemetryLoad("error", {
          surface: "Preferences",
          detail: err?.message || String(err),
        }),
      );
      this.setMemoryListPlaceholder(
        "memory-facts-list",
        describeTelemetryLoad("error", {
          surface: "Mission Facts",
          detail: err?.message || String(err),
        }),
      );
      this.setMemoryListPlaceholder(
        "memory-longterm-list",
        describeTelemetryLoad("error", {
          surface: "Long-Term Memory",
          detail: err?.message || String(err),
        }),
      );
      console.error("[AetherApp] Failed to load memory surface:", err);
    }
  }

  renderMemorySurfacePanel(surface) {
    if (!surface) return;

    const renderList = (listId, items, emptyMessage) => {
      const el = document.getElementById(listId);
      if (!el) return;
      if (!items?.length) {
        el.innerHTML = `<li class="ctx-empty">${this.escapeHtml(emptyMessage)}</li>`;
        return;
      }
      el.innerHTML = items.map((item) => `<li>${this.escapeHtml(item.text)}</li>`).join("");
    };

    const setCount = (id, value) => {
      const el = document.getElementById(id);
      if (el) {
        el.innerText = String(value);
      }
    };

    renderList("memory-orders-list", surface.standingOrders, "No standing orders yet.");
    renderList("memory-prefs-list", surface.userPreferences, "No preferences learned yet.");
    renderList("memory-facts-list", surface.missionFacts, "No mission facts captured yet.");
    renderList(
      "memory-longterm-list",
      surface.consolidatedMemory,
      "No long-term memory consolidated yet.",
    );
    setCount("memory-count-orders", surface.standingOrders?.length || 0);
    setCount("memory-count-prefs", surface.userPreferences?.length || 0);
    setCount("memory-count-facts", surface.missionFacts?.length || 0);
    setCount("memory-count-longterm", surface.consolidatedMemory?.length || 0);
    if (typeof this.renderBiosSoulGovernancePanel === "function") {
      this.renderBiosSoulGovernancePanel(this.biosSoulGovernance);
    }
    if (typeof this.renderBiosSurfacePanel === "function") {
      this.renderBiosSurfacePanel();
    }
  }

  async loadBiosSoulGovernance() {
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof tauriInvoke !== "function" || !this.activeBiosProfileId) {
      this.biosSoulGovernance = null;
      return null;
    }
    try {
      const governance = await loadBiosSoulGovernanceContract(
        tauriInvoke,
        this.activeBiosProfileId,
      );
      this.biosSoulGovernance = governance;
      this.renderBiosSoulGovernancePanel(governance);
      return governance;
    } catch (err) {
      console.error("[AetherApp] Failed to load BIOS soul governance:", err);
      this.renderBiosSoulGovernancePanel({
        summary: err?.message || String(err),
        pendingChanges: [],
        recentRevisions: [],
      });
      return null;
    }
  }

  renderBiosSoulGovernancePanel(governance) {
    const summaryEl = document.getElementById("memory-soul-summary");
    const pendingCountEl = document.getElementById("memory-soul-pending-count");
    const revisionCountEl = document.getElementById("memory-soul-revision-count");
    const actionStatusEl = document.getElementById("memory-soul-action-status");
    const pendingListEl = document.getElementById("memory-soul-pending-list");
    const revisionListEl = document.getElementById("memory-soul-revision-list");
    if (!summaryEl || !pendingListEl || !revisionListEl) {
      return;
    }

    const pendingChanges = Array.isArray(governance?.pendingChanges)
      ? governance.pendingChanges
      : [];
    const recentRevisions = Array.isArray(governance?.recentRevisions)
      ? governance.recentRevisions
      : [];
    summaryEl.innerText =
      governance?.summary || "BIOS AI has not hydrated guarded soul governance yet.";
    if (pendingCountEl) {
      pendingCountEl.innerText = String(pendingChanges.length);
    }
    if (revisionCountEl) {
      revisionCountEl.innerText = String(recentRevisions.length);
    }
    if (actionStatusEl && !this.pendingSoulDecisionId) {
      actionStatusEl.innerText = pendingChanges.length
        ? "Each pending soul change needs an explicit keep or reject decision before BIOS AI mutates core truth."
        : "No guarded soul changes are waiting right now.";
    }

    if (!pendingChanges.length) {
      pendingListEl.innerHTML =
        '<p class="ctx-empty">No guarded soul changes are waiting for review.</p>';
    } else {
      pendingListEl.innerHTML = pendingChanges
        .map((change) => {
          const targetSection = change.targetSection || "Growth Notes";
          const approvalTier = change.approvalTier || "operator_review";
          const approvalReason =
            change.approvalReason ||
            "This guarded change affects durable BOSS behavior and needs operator review before promotion.";
          const explanationText = change.requiresExplanation
            ? "BOSS must explain this clearly before BIOS writes it into durable truth."
            : "Operator review is required before BIOS writes this into durable truth.";
          return `
            <article class="ctx-section memory-section-card" data-soul-change-id="${this.escapeHtml(change.id)}" style="margin-top: 10px;">
              <span class="memory-overview-kicker">${this.escapeHtml(change.area || "guarded_change")}</span>
              <strong>${this.escapeHtml(change.text || "Pending change")}</strong>
              <p class="setting-note">${this.escapeHtml(change.detail || "BIOS AI wants to update governed identity truth.")}</p>
              <p class="setting-note"><strong>Target:</strong> ${this.escapeHtml(targetSection)} - <strong>Approval:</strong> ${this.escapeHtml(approvalTier)}</p>
              <p class="setting-note">${this.escapeHtml(approvalReason)}</p>
              <p class="setting-note">${this.escapeHtml(explanationText)}</p>
              <p class="setting-note">Source: ${this.escapeHtml(change.source || "unknown")} · Created: ${this.escapeHtml(change.createdAt || "unknown")}</p>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;">
                <button type="button" class="settings-action-btn settings-action-btn--secondary bios-soul-approve-btn" data-change-id="${this.escapeHtml(change.id)}"${this.pendingSoulDecisionId ? " disabled" : ""}>Approve change</button>
                <button type="button" class="toggle-btn bios-soul-reject-btn" data-change-id="${this.escapeHtml(change.id)}"${this.pendingSoulDecisionId ? " disabled" : ""}>Reject change</button>
              </div>
            </article>`;
        })
        .join("");
      pendingListEl.querySelectorAll(".bios-soul-approve-btn").forEach((button) => {
        button.addEventListener("click", () => {
          void this.applyBiosSoulDecision(button.getAttribute("data-change-id"), "approved");
        });
      });
      pendingListEl.querySelectorAll(".bios-soul-reject-btn").forEach((button) => {
        button.addEventListener("click", () => {
          void this.applyBiosSoulDecision(button.getAttribute("data-change-id"), "rejected");
        });
      });
    }

    if (!recentRevisions.length) {
      revisionListEl.innerHTML =
        '<li class="ctx-empty">No soul governance decisions have been recorded yet.</li>';
    } else {
      revisionListEl.innerHTML = recentRevisions
        .map(
          (revision) =>
            `<li><strong>${this.escapeHtml(revision.text || "Soul revision")}</strong> · ${this.escapeHtml(revision.decision || "decision")} · ${this.escapeHtml(revision.targetSection || "Growth Notes")} · ${this.escapeHtml(revision.decidedAt || "unknown time")}</li>`,
        )
        .join("");
    }
  }

  async applyBiosSoulDecision(changeId, decision) {
    const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof tauriInvoke !== "function" || !this.activeBiosProfileId) {
      return null;
    }
    const normalizedChangeId = String(changeId || "").trim();
    if (!normalizedChangeId) {
      return null;
    }
    const actionStatusEl = document.getElementById("memory-soul-action-status");
    this.pendingSoulDecisionId = normalizedChangeId;
    if (actionStatusEl) {
      actionStatusEl.innerText =
        decision === "approved"
          ? "Approving the guarded soul change..."
          : "Rejecting the guarded soul change...";
    }
    this.renderBiosSoulGovernancePanel(this.biosSoulGovernance);
    try {
      const response = await applyBiosSoulDecisionContract(tauriInvoke, {
        profileId: this.activeBiosProfileId,
        changeId: normalizedChangeId,
        decision,
        decidedBy: "operator",
      });
      this.biosSoulGovernance = response?.governance || null;
      if (response?.memory) {
        this.memorySurface = response.memory;
      }
      if (actionStatusEl) {
        actionStatusEl.innerText =
          decision === "approved"
            ? "The guarded soul change was approved and written into the governed BIOS files."
            : "The guarded soul change was rejected and kept out of the governed BIOS files.";
      }
      await this.loadBiosRuntimeStatus({ tickBrainstem: false });
      if (this.memorySurface) {
        this.renderMemorySurfacePanel(this.memorySurface);
      } else {
        this.renderBiosSoulGovernancePanel(this.biosSoulGovernance);
      }
      return response;
    } catch (err) {
      if (actionStatusEl) {
        actionStatusEl.innerText = err?.message || String(err);
      }
      throw err;
    } finally {
      this.pendingSoulDecisionId = null;
      if (this.memorySurface) {
        this.renderMemorySurfacePanel(this.memorySurface);
      } else {
        this.renderBiosSoulGovernancePanel(this.biosSoulGovernance);
      }
    }
  }

  renderBiosSurfacePanel() {
    const snapshot = buildBiosSurfaceSnapshot({
      memory: this.biosMemoryContract || null,
      soul: this.biosSoulContract || null,
      dream: this.biosDreamContract || null,
      brainstem: this.biosBrainstem || null,
      circadian: this.biosShellContract?.circadian || this.circadianState || null,
      glymphatic: this.biosShellContract?.glymphatic || this.compactionHealth || null,
      reflex: this.biosReflex || null,
      observation: this.biosObservation || null,
      nervousSystem: this.biosShellContract?.nervous_system || null,
      organSupervisor: this.biosShellContract?.organ_supervisor || null,
      truthSpine: this.biosShellContract?.truth_spine || null,
      skillLibrary: this.biosShellContract?.skill_library || null,
      boxedLane: this.biosBoxedLane || null,
      promotion: this.biosPromotion || null,
      sandboxState: this.biosShellContract?.sandbox_state || null,
    });

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) {
        el.innerText = String(value ?? "");
      }
    };

    setText("bios-surface-title", snapshot.title);
    setText("bios-surface-copy", snapshot.copy);
    setText("bios-stat-durable-memory", snapshot.stats.durableMemory);
    setText("bios-stat-hardened-skills", snapshot.stats.hardenedSkills);
    setText("bios-stat-nervous-signals", snapshot.stats.nervousSignals);
    setText("bios-stat-truth-records", snapshot.stats.truthRecords);
    setText("bios-stat-boxed-artifacts", snapshot.stats.boxedArtifacts);
    setText("bios-schema-note", snapshot.schemaNote);

    const grid = document.getElementById("bios-subsystem-grid");
    if (grid) {
      grid.innerHTML = snapshot.cards
        .map(
          (card) => `
            <section class="ctx-section memory-section-card">
              <span class="memory-overview-kicker">${this.escapeHtml(card.label)}</span>
              <h3 class="ctx-section-title">${this.escapeHtml(card.title)}</h3>
              <p class="ctx-sub status-sub">${this.escapeHtml(card.summary)}</p>
            </section>`,
        )
        .join("");
    }
  }

  async loadTokenEconomy() {
    this.telemetryLoadState.tokenEconomy = "loading";
    this.setStatusValue(
      "st-tokens",
      describeTelemetryLoad("pending", { surface: "Token Economy" }),
    );
    this.setStatusValue(
      "st-cache",
      describeTelemetryLoad("pending", { surface: "Cache Hit Rate" }),
    );
    try {
      const res = await this.gateway.request("token.economy", {});
      if (res && res.fleet) {
        this.tokenEconomy = res.fleet;
        this.telemetryLoadState.tokenEconomy = "ready";
        this.renderTokenEconomyPanel(res.fleet);
      }
    } catch (err) {
      this.telemetryLoadState.tokenEconomy = "error";
      this.setStatusValue(
        "st-tokens",
        describeTelemetryLoad("error", {
          surface: "Token Economy",
          detail: err?.message || String(err),
        }),
      );
      this.setStatusValue(
        "st-cache",
        describeTelemetryLoad("error", {
          surface: "Cache Hit Rate",
          detail: err?.message || String(err),
        }),
      );
      console.error("[AetherApp] Failed to load token economy:", err);
    }
  }

  renderTokenEconomyPanel(fleet) {
    if (!fleet) return;
    const stTokens = document.getElementById("st-tokens");
    const stCache = document.getElementById("st-cache");

    if (fleet.totalCalls > 0) {
      const tokensK =
        fleet.totalTokens >= 1000
          ? `${(fleet.totalTokens / 1000).toFixed(1)}k`
          : `${fleet.totalTokens}`;
      if (stTokens) stTokens.innerText = `${tokensK} (${fleet.totalCalls} calls)`;
      if (stCache) stCache.innerText = `${Math.round(fleet.cacheHitRate * 100)}%`;
    }
  }

  async loadRestartRecovery() {
    this.telemetryLoadState.restartRecovery = "loading";
    try {
      const res = await this.gateway.request("restart.recovery", {});
      if (res && res.plan) {
        this.restartRecoveryPlan = res.plan;
        this.telemetryLoadState.restartRecovery = "ready";
        this.renderRestartRecoveryPanel(res.plan);
      }
    } catch (err) {
      this.telemetryLoadState.restartRecovery = "error";
      console.error("[AetherApp] Failed to load restart recovery plan:", err);
    }
  }

  renderRestartRecoveryPanel(plan) {
    // Recovery data is now surfaced through the task checklist and log stream
  }

  renderContinuityHealthPanel(health) {
    if (!health) return;
    this.setStatusValue("st-gateway", this.gateway?.isConnected ? "Connected" : "Offline");
    const stAgent = document.getElementById("st-agent-state");
    if (stAgent) {
      stAgent.innerText =
        health.health === "healthy"
          ? "Active"
          : health.health === "idle"
            ? "Idle"
            : "Needs attention";
    }
  }

  async loadBrowserSandboxStatus() {
    this.telemetryLoadState.browserSandbox = "loading";
    this.setStatusValue(
      "st-workers",
      describeTelemetryLoad("pending", { surface: "BOSS Runtime" }),
    );
    try {
      const res = await this.gateway.request("browser.sandbox.status", {});
      if (res) {
        this.browserSandboxStatus = res;
        this.telemetryLoadState.browserSandbox = "ready";
        const existingWorkers = document.getElementById("st-workers")?.innerText || "";
        this.setStatusValue(
          "st-workers",
          res.active
            ? "Browser active"
            : existingWorkers &&
                existingWorkers !== "—" &&
                existingWorkers !== "Waiting on onboarding"
              ? existingWorkers
              : "Browser ready",
        );
        if (res.active && res.url && res.url !== "about:blank") {
          this.updateObservationPlane("acting", "Browser active", res.url);
          // Show the Glass Lab PIP with the active browser URL
          this.showGlassLab(res.url);
        }
      }
    } catch (err) {
      this.telemetryLoadState.browserSandbox = "error";
      this.setStatusValue(
        "st-workers",
        describeTelemetryLoad("error", {
          surface: "BOSS Runtime",
          detail: err?.message || String(err),
        }),
      );
      console.error("[AetherApp] Failed to load browser sandbox status:", err);
    }
  }

  async loadCircadianState() {
    this.telemetryLoadState.circadian = "loading";
    this.setStatusValue("st-circadian", describeTelemetryLoad("pending", { surface: "Circadian" }));
    try {
      const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
      if (typeof tauriInvoke === "function" && this.activeBiosProfileId) {
        const state = await tauriInvoke("load_bios_circadian_state", {
          profileId: this.activeBiosProfileId,
        });
        this.circadianState = state;
        this.telemetryLoadState.circadian = "ready";
        const el = document.getElementById("st-circadian");
        if (el) el.innerText = state.phase_label || state.current_phase || "Unknown";
        return;
      }

      const res = await this.gateway.request("circadian.state", {});
      if (res && res.state) {
        this.circadianState = res.state;
        this.telemetryLoadState.circadian = "ready";
        const el = document.getElementById("st-circadian");
        if (el) el.innerText = res.state.currentPhase;
      }
    } catch (err) {
      this.telemetryLoadState.circadian = "error";
      this.setStatusValue(
        "st-circadian",
        describeTelemetryLoad("error", {
          surface: "Circadian",
          detail: err?.message || String(err),
        }),
      );
      console.error("[AetherApp] Failed to load circadian state:", err);
    }
  }

  async loadCompactionHealth() {
    this.telemetryLoadState.compaction = "loading";
    this.setStatusValue(
      "st-compaction",
      describeTelemetryLoad("pending", { surface: "Compaction" }),
    );
    try {
      const tauriInvoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
      if (typeof tauriInvoke === "function" && this.activeBiosProfileId) {
        const status = await tauriInvoke("load_bios_glymphatic_status", {
          profileId: this.activeBiosProfileId,
        });
        this.compactionHealth = status;
        this.telemetryLoadState.compaction = "ready";
        const el = document.getElementById("st-compaction");
        if (el && status.total_compactions > 0) {
          el.innerText = `${status.total_compactions} (${Math.round(status.average_reduction_ratio * 100)}% avg)`;
        } else if (el) {
          el.innerText = status.cleanup_needed ? "Queue pending" : "0";
        }
        return;
      }

      const res = await this.gateway.request("compaction.health", {});
      if (res && res.compaction) {
        this.compactionHealth = res.compaction;
        this.telemetryLoadState.compaction = "ready";
        const el = document.getElementById("st-compaction");
        if (el && res.compaction.totalCompactions > 0) {
          el.innerText = `${res.compaction.totalCompactions} (${Math.round(res.compaction.averageReductionRatio * 100)}% avg)`;
        } else if (el) {
          el.innerText = "0";
        }
      }
    } catch (err) {
      this.telemetryLoadState.compaction = "error";
      this.setStatusValue(
        "st-compaction",
        describeTelemetryLoad("error", {
          surface: "Compaction",
          detail: err?.message || String(err),
        }),
      );
      console.error("[AetherApp] Failed to load compaction health:", err);
    }
  }

  async resolveMissionApproval(actionId, approved) {
    const actionLabel = approved ? "Approving" : "Rejecting";
    const resultLabel = approved ? "approved" : "rejected";
    this.subtitles.update(`${actionLabel} pending operator gate...`);

    try {
      const res = await this.gateway.request("risk.resolve", { actionId, approved });
      if (!res?.success) {
        throw new Error("Approval resolution did not succeed.");
      }

      await this.loadSessionMission();
      void this.refreshHudData();
      this.subtitles.update(`Operator gate ${resultLabel}.`);
      return {
        ok: true,
        statusMessage: describeApprovalAction(approved ? "approve-success" : "reject-success", {
          title: res?.title || "this operator gate",
        }),
      };
    } catch (err) {
      console.error(`[AetherApp] Failed to resolve approval ${actionId}:`, err);
      this.subtitles.update(`Failed to ${approved ? "approve" : "reject"} operator gate.`);
      return {
        ok: false,
        statusMessage: describeApprovalAction(approved ? "approve-error" : "reject-error", {
          title: "this operator gate",
          detail: err?.message || String(err),
        }),
      };
    }
  }

  renderTaskChecklist() {
    const list = document.getElementById("task-checklist");
    if (!list) return;

    const mission = this.activeMission;
    if (!mission || !mission.checklist?.length) {
      list.innerHTML =
        '<li class="task-item pending"><span class="task-icon">☐</span><div><strong>No active mission</strong><span class="task-detail">Send a message to start working.</span></div></li>';
      return;
    }

    list.innerHTML = mission.checklist
      .map((item) => {
        const isCompleted = item.status === "completed";
        const isActive = item.status === "progress";
        const stateClass = isCompleted ? "completed" : isActive ? "active" : "pending";
        const icon = isCompleted ? "✓" : isActive ? "▶" : "☐";
        const detail = isCompleted ? "Complete" : isActive ? "In Progress..." : "Pending";
        return `<li class="task-item ${stateClass}"><span class="task-icon">${icon}</span><div><strong>${this.escapeHtml(item.text)}</strong><span class="task-detail">${detail}</span></div></li>`;
      })
      .join("");
  }

  renderViewportStatus() {
    const dot = document.getElementById("viewport-dot");
    const text = document.getElementById("viewport-status-text");
    const mode = document.getElementById("viewport-mode");
    const appTitle = document.getElementById("viewport-app-title");
    const bodyPosture = document.getElementById("viewport-body-posture");
    const idleOverlay = document.getElementById("viewport-idle");
    const badge = document.getElementById("agent-badge");

    const isWorking =
      this.runInProgress || this.orb?.state === "thinking" || this.orb?.state === "acting";

    if (dot) dot.className = `viewport-status-dot ${isWorking ? "green" : ""}`;
    if (text) text.innerText = isWorking ? this.currentRunStatus || "WORKING" : "IDLE";
    if (mode) {
      mode.innerText = this.autonomousMode ? "● AUTONOMOUS" : "● SUPERVISED";
      mode.className = `viewport-mode ${this.autonomousMode ? "autonomous" : "supervised"}`;
    }
    if (appTitle) {
      appTitle.innerText = this.profilePickerActive
        ? "Choose BOSS profile"
        : this.biosObservation?.viewport_title ||
          this.biosObservation?.viewportTitle ||
          (this.browserSandboxStatus?.active
            ? this.browserSandboxStatus.url || "Virtual desktop"
            : "BIOS Home");
    }
    if (bodyPosture) {
      const rawBodyLabel =
        this.biosObservation?.body_state_label ||
        this.biosObservation?.bodyStateLabel ||
        (this.browserSandboxStatus?.active ? "Protected workspace active" : "Workspace ready");
      const rawBodyLabelText = String(rawBodyLabel);
      const bodyLabel = /shell standing by/i.test(rawBodyLabelText)
        ? "Workspace ready"
        : rawBodyLabelText;
      bodyPosture.innerText = this.profilePickerActive
        ? "Waiting for profile choice"
        : String(bodyLabel).toLowerCase().startsWith("body:") ||
            String(bodyLabel).toLowerCase().startsWith("workspace")
          ? bodyLabel
          : `Body: ${bodyLabel}`;
    }
    if (idleOverlay) {
      idleOverlay.classList.add("hidden");
    }
    if (badge) {
      badge.classList.toggle("hidden", !isWorking);
    }
  }

  renderMissionControl() {
    const sidebar = document.getElementById("chat-outline-sidebar");
    if (!sidebar) return;

    const mission = this.activeMission;
    if (!mission) return;
    const continuity = this.activeContinuity;
    const {
      continuityLabel,
      continuityRecovery,
      continuitySummary,
      pendingApproval,
      continuityTone,
    } = buildMissionControlSnapshot({
      mission,
      continuity,
      formatContinuityLabel: this.formatContinuityLabel.bind(this),
    });

    sidebar.innerHTML = `
      <div class="hud-section" style="border-bottom: 1px solid rgba(255, 255, 255, 0.03); padding-bottom: 12px; margin-bottom: 12px;">
        <h3 class="hud-section-title" style="color: var(--accent); display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:hsl(190,100%,50%);margin-right:6px;"></span> MISSION CONTROL
        </h3>
        <div style="font-family: var(--font-display); font-size: 13px; font-weight: 700; color: var(--text-primary); margin-top: 6px;">${mission.title}</div>
        <p style="font-size: 10px; color: var(--text-muted); line-height: 1.4; margin-top: 4px;">${mission.description}</p>
      </div>

      <div class="hud-section" style="border-bottom: 1px solid rgba(255, 255, 255, 0.03); padding-bottom: 12px; margin-bottom: 12px;">
        <h3 class="hud-section-title">📋 ACTIVE PLAN</h3>
        <div class="checklist-container" style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px;">
          ${mission.checklist
            .map(
              (item) => `
            <div class="checklist-item" style="display: flex; align-items: center; gap: 8px; font-size: 11px;">
              <span class="checklist-status-orb" style="
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: ${item.status === "completed" ? "var(--success)" : item.status === "progress" ? "var(--warning)" : "var(--text-dim)"};
                box-shadow: 0 0 6px ${item.status === "completed" ? "var(--success-glow)" : item.status === "progress" ? "var(--warning-glow)" : "transparent"};
              "></span>
              <span style="color: ${item.status === "completed" ? "var(--text-muted)" : "var(--text-secondary)"}; text-decoration: ${item.status === "completed" ? "line-through" : "none"};">${item.text}</span>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>

      <div class="hud-section" style="border-bottom: 1px solid rgba(255, 255, 255, 0.03); padding-bottom: 12px; margin-bottom: 12px;">
        <h3 class="hud-section-title">🧠 CONTINUITY</h3>
        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;">
          <span class="tool-card-badge" style="background: rgba(16,185,129,0.12); color: ${continuityTone}; padding: 2px 6px; border-radius: 999px; font-size: 8px; text-transform: uppercase;">${continuityLabel}</span>
          <span class="tool-card-badge" style="background: rgba(255,255,255,0.06); color: var(--text-secondary); padding: 2px 6px; border-radius: 999px; font-size: 8px; text-transform: uppercase;">${continuityRecovery}</span>
          ${continuity?.blockedByApproval ? '<span class="tool-card-badge" style="background: rgba(245,158,11,0.12); color: var(--warning); padding: 2px 6px; border-radius: 999px; font-size: 8px; text-transform: uppercase;">approval blocked</span>' : ""}
          ${continuity?.stale ? '<span class="tool-card-badge" style="background: rgba(239,68,68,0.12); color: var(--danger); padding: 2px 6px; border-radius: 999px; font-size: 8px; text-transform: uppercase;">stale</span>' : ""}
        </div>
        <p style="font-size: 10px; color: var(--text-muted); line-height: 1.4; margin-top: 8px;">${continuitySummary}</p>
      </div>

      ${
        pendingApproval
          ? `
        <div class="hud-section" style="border-bottom: 1px solid rgba(255, 255, 255, 0.03); padding-bottom: 12px; margin-bottom: 12px;">
          <h3 class="hud-section-title">⚠ APPROVAL CONTROL</h3>
          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;">
            <span class="tool-card-badge" style="background: rgba(245,158,11,0.12); color: var(--warning); padding: 2px 6px; border-radius: 999px; font-size: 8px; text-transform: uppercase;">${pendingApproval.kind}</span>
            <span class="tool-card-badge" style="background: rgba(255,255,255,0.06); color: var(--text-secondary); padding: 2px 6px; border-radius: 999px; font-size: 8px; text-transform: uppercase;">${pendingApproval.boundaryClass || "review"}</span>
          </div>
          <p style="font-size: 10px; color: var(--text-primary); line-height: 1.4; margin-top: 8px;">${pendingApproval.title}</p>
          <p style="font-size: 10px; color: var(--text-muted); line-height: 1.4; margin-top: 4px;">${pendingApproval.summary || pendingApproval.warningText || "Approval is required before the mission can continue."}</p>
          <div style="display: flex; gap: 8px; margin-top: 10px;">
            <button data-approval-action="approve" type="button" style="flex: 1; min-height: 28px; border-radius: 8px; border: 1px solid rgba(16,185,129,0.25); background: rgba(16,185,129,0.08); color: var(--success); font-size: 10px; font-family: var(--font-mono); cursor: pointer;">Approve</button>
            <button data-approval-action="reject" type="button" style="flex: 1; min-height: 28px; border-radius: 8px; border: 1px solid rgba(239,68,68,0.25); background: rgba(239,68,68,0.08); color: var(--danger); font-size: 10px; font-family: var(--font-mono); cursor: pointer;">Reject</button>
          </div>
          <p id="mission-approval-status" style="font-size: 9px; color: var(--text-muted); line-height: 1.4; margin-top: 8px;">Choose approve or reject to resolve the active gate.</p>
        </div>
      `
          : ""
      }

      <div class="hud-section" style="border-bottom: 1px solid rgba(255, 255, 255, 0.03); padding-bottom: 12px; margin-bottom: 12px;" id="outline-hud-section">
        <h3 class="hud-section-title">⚛&nbsp; OUTLINE MAP</h3>
      </div>

      <div class="hud-section" style="border-bottom: 1px solid rgba(255, 255, 255, 0.03); padding-bottom: 12px; margin-bottom: 12px;">
        <h3 class="hud-section-title">🛠 LIVE OPERATOR WORK</h3>
        ${renderMissionOperatorWorkSection(mission.operatorRecord)}
      </div>

      <div class="hud-section">
        <h3 class="hud-section-title">📦 EVIDENCE LOG</h3>
        <div class="evidence-container" style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
          ${
            mission.evidence.length === 0
              ? `
            <p style="font-size: 10px; color: var(--text-dim); font-style: italic;">No evidence files consolidated.</p>
          `
              : mission.evidence
                  .map(
                    (file) => `
            <div style="font-size: 9px; font-family: var(--font-mono); color: var(--accent); background: rgba(16,185,129,0.05); padding: 4px 8px; border: 1px solid rgba(16,185,129,0.1); border-radius: var(--radius-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${file}">
              📄 ${file.substring(file.lastIndexOf("/") + 1)}
            </div>
          `,
                  )
                  .join("")
          }
        </div>
      </div>
    `;

    if (pendingApproval?.id) {
      const approveButton = sidebar.querySelector('[data-approval-action="approve"]');
      const rejectButton = sidebar.querySelector('[data-approval-action="reject"]');
      const approvalStatus = sidebar.querySelector("#mission-approval-status");
      const bindApprovalAction = (button, approved) => {
        if (!button) return;
        button.addEventListener("click", async () => {
          if (approveButton) approveButton.disabled = true;
          if (rejectButton) rejectButton.disabled = true;
          if (approvalStatus) {
            approvalStatus.innerText = describeApprovalAction(
              approved ? "approve-pending" : "reject-pending",
              {
                title: pendingApproval.title,
              },
            );
          }
          const result = await this.resolveMissionApproval(pendingApproval.id, approved);
          if (approvalStatus && result?.statusMessage) {
            approvalStatus.innerText = result.statusMessage;
          }
          if (!result?.ok) {
            if (approveButton) approveButton.disabled = false;
            if (rejectButton) rejectButton.disabled = false;
          }
        });
      };
      bindApprovalAction(approveButton, true);
      bindApprovalAction(rejectButton, false);
    }

    this.chat.updateOutlineMap(this.chat.activeMessageText || "");
  }
}

// Instantiate on load
window.addEventListener("DOMContentLoaded", () => {
  window.app = new AetherApp();
});
