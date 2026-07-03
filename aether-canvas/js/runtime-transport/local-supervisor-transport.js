import {
  appendBiosDebugLog,
  buildSavedLocalBackendRoute,
  DIRECT_LOCAL_LLM_PROVIDERS,
  isUsableDirectLlmProvider,
  LOCAL_RUNTIME_PROVIDERS,
  recordBiosProofEventSafe,
} from "../bios-runtime.js";
import {
  BIOS_WORKER_ROLE_BOSS,
  appendBossModelGovernanceHistory,
  buildBossModelGovernanceDecision,
  chooseBossChatRoute,
  chooseBossWorkerRoleForTurn,
} from "../boss-model-governor.js";
import {
  buildBiosProfileSaveInput,
  buildSavedOnboardingSnapshotFromProfileDetail,
} from "../boss-profiles/profile-contract.js";
import { runLocalRuntimeTurn } from "../chat-runtime/local-runtime-turn.js";
import {
  buildContextSleepTruthEvent,
  prepareMessagesForModelContext,
  resolveModelContextBudget,
} from "../model-context-governor.js";
import {
  loadBiosShellContract,
  loadBiosMemorySurfaceContract,
  loadBiosObservationStateContract,
  loadBiosSkillLibraryContract,
  loadSystemMachineProfileContract,
  readBiosRuntimeStatusFromContract,
} from "../native-contracts/bios-shell-contract.js";
import {
  buildLocalCapabilityPosture,
  buildLocalCapabilitySystemPrompt,
} from "./local-capability-posture.js";

function getTauriInvoke(getInvoke) {
  return typeof getInvoke === "function" ? getInvoke() : null;
}

function defaultProviderConfig() {
  return {
    active_provider: "",
    active_model: "",
    keys: [],
    conversation_history: [],
  };
}

async function loadLocalCapabilityContext(tauriInvoke, profileId, shellContract = null) {
  if (typeof tauriInvoke !== "function" || !String(profileId || "").trim()) {
    return {
      memorySurface: null,
      observation: null,
      skillLibrary: null,
      reflex: null,
      machineProfile: null,
      connectorStatus: null,
      toolRegistry: null,
      truthSpine: null,
    };
  }

  const [
    memorySurface,
    observation,
    skillLibrary,
    machineProfile,
    connectorStatus,
    toolRegistry,
    truthSpine,
  ] = await Promise.all([
    loadBiosMemorySurfaceContract(tauriInvoke, profileId).catch(() => null),
    loadBiosObservationStateContract(tauriInvoke, profileId).catch(() => null),
    loadBiosSkillLibraryContract(tauriInvoke, profileId).catch(() => null),
    loadSystemMachineProfileContract(tauriInvoke).catch(() => null),
    tauriInvoke("load_bios_local_connector_status", { profileId }).catch(() => null),
    tauriInvoke("bios_local_tool_registry").catch(() => null),
    tauriInvoke("load_bios_truth_spine_state", { profileId }).catch(() => null),
  ]);

  return {
    memorySurface,
    observation,
    skillLibrary,
    reflex: shellContract?.reflex || null,
    machineProfile,
    connectorStatus,
    toolRegistry,
    truthSpine,
  };
}

async function recordBossTruthTurnDelta({
  tauriInvoke,
  profileId,
  source,
  sourceBodyPart,
  normalizedText,
  responseText,
  actionResults = [],
  actionEvents = [],
  proofRefs = [],
}) {
  const normalizedProfileId = String(profileId || "").trim();
  if (typeof tauriInvoke !== "function" || !normalizedProfileId) {
    return null;
  }
  const userSummary = String(normalizedText || "")
    .trim()
    .slice(0, 160);
  const responseSummary = String(responseText || "")
    .trim()
    .slice(0, 160);
  const actionCount = Array.isArray(actionResults) ? actionResults.length : 0;
  const eventCount = Array.isArray(actionEvents) ? actionEvents.length : 0;
  const summary = [
    userSummary ? `BOSS handled user turn: ${userSummary}` : "BOSS handled a user turn.",
    responseSummary ? `Response began: ${responseSummary}` : null,
    actionCount || eventCount
      ? `Actions/events recorded: ${actionCount} action result(s), ${eventCount} event(s).`
      : "No action results were returned.",
  ]
    .filter(Boolean)
    .join(" ");
  return tauriInvoke("record_bios_truth_session_update", {
    input: {
      profile_id: normalizedProfileId,
      source_ref: source || "local_supervisor",
      step_id: sourceBodyPart,
      events: [
        {
          type: "done",
          summary,
          details: {
            user_text_preview: userSummary,
            response_preview: responseSummary,
            action_result_count: actionCount,
            action_event_count: eventCount,
          },
          subject_refs: ["chat_turn", sourceBodyPart],
          proof_refs: proofRefs,
          source_refs: [source || "local_supervisor"],
        },
      ],
    },
  }).catch((err) =>
    appendBiosDebugLog("chat.truth_spine.record_failed", {
      source,
      error: err?.message || String(err),
    }),
  );
}

async function recordBossContextSleepDelta({
  tauriInvoke,
  profileId,
  source,
  preflight,
  workerRole = null,
}) {
  const normalizedProfileId = String(profileId || "").trim();
  if (typeof tauriInvoke !== "function" || !normalizedProfileId || !preflight?.sleepRequired) {
    return null;
  }
  return tauriInvoke("record_bios_truth_session_update", {
    input: {
      profile_id: normalizedProfileId,
      source_ref: source || "model_context_governor",
      step_id: "memory_sleep",
      events: [
        buildContextSleepTruthEvent({
          label: "BOSS model context sleep ran before local model call",
          preflight,
          subjectRefs: workerRole ? [workerRole] : [],
        }),
      ],
    },
  }).catch((err) =>
    appendBiosDebugLog("chat.context_governor.record_failed", {
      source,
      error: err?.message || String(err),
    }),
  );
}

function createContextGovernedReasoner({
  tauriInvoke,
  profileId,
  source,
  provider,
  model,
  runtimeStatus,
  capabilityPosture,
  workerRole,
  invokeReasoner,
}) {
  return async ({ messages, systemPrompt }) => {
    const budget = resolveModelContextBudget({
      runtimeStatus,
      capabilityPosture,
      provider,
      model,
      workerRole,
    });
    const preflight = prepareMessagesForModelContext({
      messages,
      systemPrompt,
      budget,
    });
    if (preflight.sleepRequired) {
      await appendBiosDebugLog("chat.context_governor.sleep", {
        source,
        provider,
        model,
        workerRole,
        originalTokens: preflight.originalTokens,
        finalTokens: preflight.finalTokens,
        droppedMessageCount: preflight.droppedMessageCount,
        contextWindowTokens: budget.contextWindowTokens,
      });
      await recordBossContextSleepDelta({
        tauriInvoke,
        profileId,
        source,
        preflight,
        workerRole,
      });
    } else {
      await appendBiosDebugLog("chat.context_governor.pass", {
        source,
        provider,
        model,
        workerRole,
        promptTokens: preflight.finalTokens,
        contextWindowTokens: budget.contextWindowTokens,
      });
    }
    return invokeReasoner({
      messages: preflight.messages,
      systemPrompt: preflight.systemPrompt,
    });
  };
}

function buildRuntimeCapabilityPosture({
  capabilityPosture = null,
  runtimeStatus = null,
  onboardingState = null,
  providerConfig = null,
  localCapabilityContext = {},
} = {}) {
  const livePosture = buildLocalCapabilityPosture({
    runtimeStatus,
    onboardingState,
    providerConfig,
    ...localCapabilityContext,
  });
  if (!capabilityPosture) {
    return livePosture;
  }
  return {
    ...capabilityPosture,
    ...livePosture,
    // These fields are body-truth owned. Never let a stale caller posture bypass them.
    allowedKnowledgeSources: livePosture.allowedKnowledgeSources,
    memorySurface: livePosture.memorySurface,
    truthSpine: livePosture.truthSpine,
    truthPack: livePosture.truthPack,
    reflexSurface: livePosture.reflexSurface,
    reflexSummary: livePosture.reflexSummary,
    observationSnapshot: livePosture.observationSnapshot,
    skillLibrarySurface: livePosture.skillLibrarySurface,
    machineProfile: livePosture.machineProfile,
    connectorStatus: livePosture.connectorStatus,
    toolRegistry: livePosture.toolRegistry,
    toolInventory: livePosture.toolInventory,
    summary: livePosture.summary,
    nextStep: livePosture.nextStep,
  };
}

function assertRuntimeRouteReady(runtimeStatus) {
  if (runtimeStatus?.route_ready) {
    return;
  }
  throw new Error(
    runtimeStatus?.next_step ||
      "This BOSS profile still needs a selected and ready BOSS brain before chat can begin.",
  );
}

async function loadWorkerModelCatalog(tauriInvoke, profileId) {
  if (typeof tauriInvoke !== "function") {
    return null;
  }
  try {
    return await tauriInvoke("worker_model_catalog", { profileId });
  } catch {
    return null;
  }
}

async function persistBossModelGovernanceDecision({
  tauriInvoke,
  profileId,
  agentName,
  snapshot,
  decision,
} = {}) {
  const normalizedProfileId = String(profileId || "").trim();
  if (!normalizedProfileId || typeof tauriInvoke !== "function" || !decision) {
    return snapshot;
  }

  const nextSnapshot = appendBossModelGovernanceHistory(snapshot || {}, decision);
  if (Array.isArray(decision.nextRoster) && decision.action === "apply_roster_change") {
    await tauriInvoke("save_worker_runtime_roster", {
      assignments: decision.nextRoster,
      profileId: normalizedProfileId,
    });
    nextSnapshot.biosWorkerRoster = decision.nextRoster;
    nextSnapshot.localWorkerModelVariant =
      decision.nextRoster.find((entry) => entry.role === "boss_brain")?.variant ||
      nextSnapshot.localWorkerModelVariant ||
      null;
  }

  await tauriInvoke(
    "save_bios_profile",
    buildBiosProfileSaveInput(nextSnapshot, {
      profileId: normalizedProfileId,
      displayName: agentName || nextSnapshot.agentName || "BOSS Agent",
      makeActive: true,
    }),
  );
  await recordBiosProofEventSafe({
    profileId: normalizedProfileId,
    eventType:
      decision.action === "apply_roster_change"
        ? "model_governance_applied"
        : "model_governance_recommended",
    source: "runtime.model_governance",
    summary: decision.reason,
    tags: ["runtime", "model", "worker", "governance"],
    payloadRedacted: {
      action: decision.action,
      target_role: decision.targetRole || decision.role || null,
      target_variant: decision.targetVariant || null,
      permission_boundary: nextSnapshot.permissionMode || null,
      route_boundary: nextSnapshot.modelPref || null,
      requires_approval: Boolean(decision.requiresApproval),
    },
  });

  return nextSnapshot;
}

export function createLocalSupervisorRuntimeTransport({ getTauriInvoke: getInvoke }) {
  return {
    kind: "local-supervisor",

    isAvailable() {
      return true;
    },

    async loadChatHistory({ profileId = null, conversationHistory = [] }) {
      const tauriInvoke = getTauriInvoke(getInvoke);
      let sourceHistory = Array.isArray(conversationHistory) ? conversationHistory : [];

      if (!sourceHistory.length && typeof tauriInvoke === "function") {
        try {
          const providerConfig = await tauriInvoke("load_provider_config", {
            profileId,
          });
          if (Array.isArray(providerConfig?.conversation_history)) {
            sourceHistory = providerConfig.conversation_history;
          }
        } catch {
          sourceHistory = [];
        }
      }

      const messages = Array.isArray(sourceHistory)
        ? sourceHistory
            .map((entry) => {
              if (entry?.role !== "user" && entry?.role !== "assistant") {
                return null;
              }
              const text = String(entry?.text || "").trim();
              if (!text) {
                return null;
              }
              return { role: entry.role, text };
            })
            .filter(Boolean)
        : [];

      return {
        transport: "local-supervisor",
        messages,
      };
    },

    async getCapabilityPosture({ profileId = null, onboardingState = null } = {}) {
      const tauriInvoke = getTauriInvoke(getInvoke);
      let providerConfig = defaultProviderConfig();
      if (typeof tauriInvoke === "function") {
        try {
          providerConfig = await tauriInvoke("load_provider_config", {
            profileId,
          });
        } catch {
          providerConfig = defaultProviderConfig();
        }
      }

      let runtimeStatus = null;
      let shellContract = null;
      try {
        shellContract = await loadBiosShellContract(tauriInvoke, profileId);
        runtimeStatus = readBiosRuntimeStatusFromContract(shellContract);
      } catch {
        runtimeStatus = null;
      }

      const normalizedProfileId = String(profileId || "").trim();
      if (!normalizedProfileId) {
        throw new Error(
          "BIOS AI needs a real BOSS profile before local chat can start. Finish activation first.",
        );
      }

      let profileDetail = null;
      try {
        profileDetail = await tauriInvoke("load_bios_profile", { profileId: normalizedProfileId });
      } catch {
        profileDetail = null;
      }
      if (!profileDetail?.onboarding) {
        throw new Error(
          "BIOS AI found no saved BOSS setup for this profile. Reopen setup and finish activation before chatting.",
        );
      }
      assertRuntimeRouteReady(runtimeStatus);

      const localCapabilityContext = await loadLocalCapabilityContext(
        tauriInvoke,
        profileId,
        shellContract,
      );

      return buildLocalCapabilityPosture({
        runtimeStatus,
        onboardingState,
        providerConfig,
        ...localCapabilityContext,
      });
    },

    async loadMemorySurface({ profileId = null } = {}) {
      const tauriInvoke = getTauriInvoke(getInvoke);
      const localCapabilityContext = await loadLocalCapabilityContext(tauriInvoke, profileId);
      return {
        transport: "local-supervisor",
        surface: localCapabilityContext.memorySurface,
      };
    },

    async loadConnectorStatus({ profileId = null } = {}) {
      const tauriInvoke = getTauriInvoke(getInvoke);
      if (typeof tauriInvoke !== "function") {
        throw new Error("Local supervisor transport is unavailable in this surface.");
      }
      const result = await tauriInvoke("load_bios_local_connector_status", { profileId });
      return {
        transport: "local-supervisor",
        ...(result || {}),
      };
    },

    async invokeTool({ profileId = null, name, arguments: toolArguments = {}, confirm = false }) {
      const tauriInvoke = getTauriInvoke(getInvoke);
      if (typeof tauriInvoke !== "function") {
        throw new Error("Local supervisor transport is unavailable in this surface.");
      }
      const result = await tauriInvoke("invoke_bios_local_tool", {
        input: {
          profile_id: profileId,
          name,
          arguments: toolArguments,
          confirm: Boolean(confirm),
        },
      });
      return {
        transport: "local-supervisor",
        ...(result || {}),
      };
    },

    async invokeConnector({
      profileId = null,
      connector,
      action,
      arguments: connectorArguments = {},
      confirm = false,
    }) {
      const tauriInvoke = getTauriInvoke(getInvoke);
      if (typeof tauriInvoke !== "function") {
        throw new Error("Local supervisor transport is unavailable in this surface.");
      }
      const result = await tauriInvoke("invoke_bios_local_connector", {
        input: {
          profile_id: profileId,
          connector,
          action,
          arguments: connectorArguments,
          confirm: Boolean(confirm),
        },
      });
      return {
        transport: "local-supervisor",
        ...(result || {}),
      };
    },

    async resolveApproval({ profileId = null, approvalId, decision }) {
      const tauriInvoke = getTauriInvoke(getInvoke);
      if (typeof tauriInvoke !== "function") {
        throw new Error("Local supervisor transport is unavailable in this surface.");
      }
      const normalizedProfileId = String(profileId || "").trim();
      if (!normalizedProfileId) {
        throw new Error("BIOS approval resolution needs an active BOSS profile.");
      }
      const result = await tauriInvoke("resolve_bios_local_approval", {
        input: {
          profile_id: normalizedProfileId,
          approval_id: approvalId,
          decision,
        },
      });
      return {
        transport: "local-supervisor",
        ...(result || {}),
      };
    },

    async sendChatMessage({
      normalizedText,
      agentName,
      profileId = null,
      onboardingState = null,
      conversationHistory = [],
      capabilityPosture = null,
    }) {
      const tauriInvoke = getTauriInvoke(getInvoke);
      if (typeof tauriInvoke !== "function") {
        throw new Error("Local supervisor transport is unavailable in this surface.");
      }

      let providerConfig;
      try {
        providerConfig = await tauriInvoke("load_provider_config", {
          profileId,
        });
      } catch {
        providerConfig = defaultProviderConfig();
      }

      let runtimeStatus = null;
      let shellContract = null;
      try {
        shellContract = await loadBiosShellContract(tauriInvoke, profileId);
        runtimeStatus = readBiosRuntimeStatusFromContract(shellContract);
      } catch {
        runtimeStatus = null;
      }

      let resolvedOnboardingState = onboardingState;
      if (!resolvedOnboardingState && String(profileId || "").trim()) {
        try {
          const profileDetail = await tauriInvoke("load_bios_profile", { profileId });
          resolvedOnboardingState = buildSavedOnboardingSnapshotFromProfileDetail(
            profileDetail,
            agentName,
          );
        } catch {
          resolvedOnboardingState = null;
        }
      }

      assertRuntimeRouteReady(runtimeStatus);

      const localCapabilityContext = await loadLocalCapabilityContext(
        tauriInvoke,
        profileId,
        shellContract,
      );

      const resolvedCapabilityPosture = buildRuntimeCapabilityPosture({
        capabilityPosture,
        runtimeStatus,
        onboardingState: resolvedOnboardingState,
        providerConfig,
        localCapabilityContext,
      });

      const governedRoute = chooseBossChatRoute({
        onboardingState: resolvedOnboardingState,
        providerConfig,
        runtimeStatus,
      });
      let provider = governedRoute.provider;
      let model = governedRoute.model || providerConfig.active_model || "";
      let apiKey = governedRoute.apiKey || "";

      if (
        (!provider || !isUsableDirectLlmProvider(provider)) &&
        LOCAL_RUNTIME_PROVIDERS.has(runtimeStatus?.active_provider)
      ) {
        provider = runtimeStatus.active_provider;
        model = "";
      } else if ((!provider || !isUsableDirectLlmProvider(provider)) && resolvedOnboardingState) {
        const savedLocalRoute = buildSavedLocalBackendRoute(resolvedOnboardingState);
        if (savedLocalRoute) {
          provider = savedLocalRoute.provider;
          model = savedLocalRoute.model;
        }
      }

      const canUseDirectProvider =
        DIRECT_LOCAL_LLM_PROVIDERS.has(provider) ||
        (Boolean(apiKey) && isUsableDirectLlmProvider(provider));
      await appendBiosDebugLog("chat.route.resolve", {
        provider,
        hasApiKey: Boolean(apiKey),
        model,
        reason: governedRoute.reason,
        canUseDirectProvider,
        preferredLocalBackend: resolvedOnboardingState?.preferredLocalBackend || null,
        localWorkerModelVariant: resolvedOnboardingState?.localWorkerModelVariant || null,
        localWorkerDownloadStatus: resolvedOnboardingState?.localWorkerDownloadStatus || null,
      });

      if (!canUseDirectProvider) {
        const workerRoute = chooseBossWorkerRoleForTurn({
          normalizedText,
          conversationHistory,
          runtimeStatus,
        });
        if (!runtimeStatus?.worker_ready) {
          throw new Error(
            runtimeStatus?.next_step ||
              "No API key configured and no local worker is ready. Install a BIOS AI managed local model or add a cloud API key in Settings.",
          );
        }

        let governedWorkerRoute = {
          role: BIOS_WORKER_ROLE_BOSS,
          reason:
            workerRoute.reason ||
            "User chat is BOSS-only; support workers are internal delegation lanes.",
        };
        const workerCatalog = await loadWorkerModelCatalog(tauriInvoke, profileId);
        const governanceDecision = buildBossModelGovernanceDecision({
          normalizedText,
          conversationHistory,
          runtimeStatus,
          onboardingState: resolvedOnboardingState,
          workerCatalog,
          machineProfile: localCapabilityContext.machineProfile?.machine_profile || null,
          currentRoster: resolvedOnboardingState?.biosWorkerRoster || [],
          trigger: "local_chat_turn",
        });
        if (governanceDecision.action !== "keep_current") {
          try {
            resolvedOnboardingState = await persistBossModelGovernanceDecision({
              tauriInvoke,
              profileId,
              agentName,
              snapshot: resolvedOnboardingState || {},
              decision: governanceDecision,
            });
          } catch (err) {
            await appendBiosDebugLog("chat.route.model_governance.persist_failed", {
              action: governanceDecision.action,
              error: err?.message || String(err),
            });
          }
        }
        if (governanceDecision.allowed && governanceDecision.role) {
          governedWorkerRoute = {
            role: BIOS_WORKER_ROLE_BOSS,
            reason: governanceDecision.reason || workerRoute.reason,
          };
        }

        const identity = await tauriInvoke("load_agent_identity", {
          profileId: profileId || null,
        }).catch(() => "");
        const invokeManagedReasoner = createContextGovernedReasoner({
          tauriInvoke,
          profileId,
          source: "local_worker_chat",
          provider: runtimeStatus?.active_provider || runtimeStatus?.preferred_local_backend,
          model: resolvedOnboardingState?.localWorkerModelVariant || "",
          runtimeStatus,
          capabilityPosture: resolvedCapabilityPosture,
          workerRole: BIOS_WORKER_ROLE_BOSS,
          invokeReasoner: ({ messages, systemPrompt }) =>
            tauriInvoke("chat_with_local_worker", {
              messages,
              agentName,
              systemPrompt,
              profileId,
              workerRole: BIOS_WORKER_ROLE_BOSS,
            }),
        });
        const fallbackReply = async () => {
          const historyToSend = [...conversationHistory, { role: "user", text: normalizedText }];
          const response = await invokeManagedReasoner({
            messages: historyToSend,
            systemPrompt: buildLocalCapabilitySystemPrompt({
              agentName,
              capabilityPosture: resolvedCapabilityPosture,
              identityText: identity,
              currentUserPrompt: normalizedText,
            }),
          });
          return {
            ok: true,
            responseText: response,
            conversationHistory: [...historyToSend, { role: "assistant", text: response }],
            actionResults: [],
            actionEvents: [],
          };
        };
        const localTurn = await runLocalRuntimeTurn({
          tauriInvoke,
          profileId,
          agentName,
          normalizedText,
          conversationHistory,
          capabilityPosture: resolvedCapabilityPosture,
          invokeReasoner: invokeManagedReasoner,
          buildFallbackReply: fallbackReply,
        });
        await appendBiosDebugLog("chat.route.local_worker.success", {
          variant: resolvedOnboardingState?.localWorkerModelVariant || null,
          workerRole: BIOS_WORKER_ROLE_BOSS,
          reason: "User chat is BOSS-only; support workers are internal delegation lanes.",
          modelGovernanceAction: governanceDecision.action,
          actionCount: localTurn.actionResults?.length || 0,
        });
        await recordBossTruthTurnDelta({
          tauriInvoke,
          profileId,
          source: "local_worker_chat",
          sourceBodyPart: "brainstem",
          normalizedText,
          responseText: localTurn.responseText,
          actionResults: localTurn.actionResults || [],
          actionEvents: localTurn.actionEvents || [],
        });

        try {
          providerConfig.conversation_history = localTurn.conversationHistory;
          await tauriInvoke("save_provider_config", {
            config: providerConfig,
            profileId,
          });
        } catch {
          /* config save failed - non-critical */
        }

        return {
          ok: true,
          transport: "local-supervisor",
          delivery: "immediate",
          responseText: localTurn.responseText,
          workerRole: BIOS_WORKER_ROLE_BOSS,
          modelGovernance: governanceDecision,
          conversationHistory: localTurn.conversationHistory,
          capabilityPosture: resolvedCapabilityPosture,
          actionResults: localTurn.actionResults || [],
          actionEvents: localTurn.actionEvents || [],
        };
      }

      const updatedConversationHistory = [
        ...conversationHistory,
        { role: "user", text: normalizedText },
      ];

      let systemPrompt = null;
      try {
        const identity = await tauriInvoke("load_agent_identity", {
          profileId: profileId || null,
        });
        if (identity) {
          systemPrompt = buildLocalCapabilitySystemPrompt({
            agentName,
            capabilityPosture: resolvedCapabilityPosture,
            identityText: identity,
            currentUserPrompt: normalizedText,
          });
        }
      } catch {
        /* identity files not found */
      }

      if (!systemPrompt) {
        systemPrompt = buildLocalCapabilitySystemPrompt({
          agentName,
          capabilityPosture: resolvedCapabilityPosture,
          currentUserPrompt: normalizedText,
        });
      }

      const invokeDirectReasoner = createContextGovernedReasoner({
        tauriInvoke,
        profileId,
        source: "direct_provider_chat",
        provider,
        model,
        runtimeStatus,
        capabilityPosture: resolvedCapabilityPosture,
        invokeReasoner: ({ messages, systemPrompt: nextSystemPrompt }) =>
          tauriInvoke("chat_with_llm", {
            provider,
            apiKey,
            messages,
            agentName,
            model,
            systemPrompt: nextSystemPrompt,
          }),
      });
      const fallbackReply = async () => {
        const response = await invokeDirectReasoner({
          messages: updatedConversationHistory,
          systemPrompt,
        });
        return {
          ok: true,
          responseText: response,
          conversationHistory: [
            ...updatedConversationHistory,
            { role: "assistant", text: response },
          ],
          actionResults: [],
          actionEvents: [],
        };
      };
      const localTurn = await runLocalRuntimeTurn({
        tauriInvoke,
        profileId,
        agentName,
        normalizedText,
        conversationHistory,
        capabilityPosture: resolvedCapabilityPosture,
        invokeReasoner: invokeDirectReasoner,
        buildFallbackReply: fallbackReply,
      });
      await appendBiosDebugLog("chat.route.direct_provider.success", {
        provider,
        hasApiKey: Boolean(apiKey),
        model,
        actionCount: localTurn.actionResults?.length || 0,
      });
      await recordBossTruthTurnDelta({
        tauriInvoke,
        profileId,
        source: "direct_provider_chat",
        sourceBodyPart: "brainstem",
        normalizedText,
        responseText: localTurn.responseText,
        actionResults: localTurn.actionResults || [],
        actionEvents: localTurn.actionEvents || [],
      });

      try {
        providerConfig.conversation_history = localTurn.conversationHistory;
        providerConfig.active_provider = provider;
        if (apiKey && !providerConfig.keys.find((key) => key.provider === provider)) {
          providerConfig.keys.push({
            provider,
            key: apiKey,
            source: "onboarding",
            label: provider,
          });
        }
        await tauriInvoke("save_provider_config", {
          config: providerConfig,
          profileId,
        });
      } catch {
        /* config save failed - non-critical */
      }

      return {
        ok: true,
        transport: "local-supervisor",
        delivery: "immediate",
        responseText: localTurn.responseText,
        conversationHistory: localTurn.conversationHistory,
        capabilityPosture: resolvedCapabilityPosture,
        actionResults: localTurn.actionResults || [],
        actionEvents: localTurn.actionEvents || [],
      };
    },
  };
}
