function trimString(value) {
  return String(value || "").trim();
}

function parseJsonObject(rawText) {
  const text = trimString(rawText);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // fall through
  }

  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch {
      // fall through
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeToolRegistry(rawRegistry) {
  const tools = Array.isArray(rawRegistry?.tools) ? rawRegistry.tools : [];
  return tools
    .map((tool) => ({
      name: trimString(tool?.name).toLowerCase(),
      label: trimString(tool?.label) || trimString(tool?.name),
      category: trimString(tool?.category),
      summary: trimString(tool?.summary),
      approvalRequired: Boolean(tool?.approval_required),
      executionClass: trimString(tool?.execution_class),
      profileRequired: Boolean(tool?.profile_required),
    }))
    .filter((tool) => tool.name);
}

function normalizeConnectorInventory(rawConnectorStatus) {
  const connectors = Array.isArray(rawConnectorStatus?.connectors)
    ? rawConnectorStatus.connectors
    : [];
  return connectors
    .map((connector) => ({
      connector: trimString(connector?.connector).toLowerCase(),
      label: trimString(connector?.label) || trimString(connector?.connector),
      ready: Boolean(connector?.ready),
      configured: Boolean(connector?.configured),
      enabled: Boolean(connector?.enabled),
      profileBound: Boolean(connector?.profile_bound),
      targetSummary: trimString(connector?.target_summary),
      allowedActions: Array.isArray(connector?.allowed_actions)
        ? connector.allowed_actions
            .map((action) => trimString(action).toLowerCase())
            .filter(Boolean)
        : [],
      detail: trimString(connector?.detail),
    }))
    .filter((connector) => connector.connector);
}

function buildReflexPlanningLines(capabilityPosture = null) {
  const reflexSummary = capabilityPosture?.reflexSummary || null;
  const reflexSurface = capabilityPosture?.reflexSurface || null;
  if (!reflexSummary && !reflexSurface) {
    return "- none";
  }
  const candidateCount =
    reflexSummary?.candidateCount ??
    reflexSurface?.skill_candidate_count ??
    reflexSurface?.skillCandidateCount ??
    0;
  const hardenedCount =
    reflexSummary?.hardenedCount ??
    reflexSurface?.hardened_skill_count ??
    reflexSurface?.hardenedSkillCount ??
    0;
  const synapseCount =
    reflexSummary?.synapseCount ??
    reflexSurface?.synapse_event_count ??
    reflexSurface?.synapseEventCount ??
    0;
  const topCandidate =
    reflexSummary?.topCandidate ||
    reflexSurface?.top_skill_candidate ||
    reflexSurface?.topSkillCandidate ||
    "none";
  const strongestHardened =
    reflexSummary?.strongestHardened ||
    reflexSurface?.strongest_hardened_skill ||
    reflexSurface?.strongestHardenedSkill ||
    "none";
  const schemaSummary =
    reflexSummary?.schemaSummary ||
    reflexSurface?.schema_summary ||
    reflexSurface?.schemaSummary ||
    "unknown";
  const labels = [
    reflexSummary?.topTagLabel || reflexSurface?.top_tag_label || reflexSurface?.topTagLabel,
    reflexSummary?.topEvidenceLabel ||
      reflexSurface?.top_evidence_label ||
      reflexSurface?.topEvidenceLabel,
    reflexSummary?.topStateLabel || reflexSurface?.top_state_label || reflexSurface?.topStateLabel,
  ].filter(Boolean);
  return [
    `- skill_candidates=${candidateCount}`,
    `- hardened_skills=${hardenedCount}`,
    `- synapse_events=${synapseCount}`,
    `- top_reflex_candidate=${topCandidate}`,
    `- strongest_hardened_skill=${strongestHardened}`,
    `- schema=${schemaSummary}`,
    `- dominant_labels=${labels.join(" | ") || "none"}`,
    "- rule=Use learned reflexes to prefer safer known patterns, but never invent tools, connectors, file reads, or system powers.",
  ].join("\n");
}

function hasLiveReflexPlanningContext(capabilityPosture = null) {
  const reflexSummary = capabilityPosture?.reflexSummary || null;
  const reflexSurface = capabilityPosture?.reflexSurface || null;
  return Boolean(
    reflexSummary?.ready ||
    reflexSurface?.ready ||
    reflexSummary?.candidateCount ||
    reflexSummary?.hardenedCount ||
    reflexSummary?.synapseCount ||
    reflexSurface?.skill_candidate_count ||
    reflexSurface?.hardened_skill_count ||
    reflexSurface?.synapse_event_count,
  );
}

async function recordReflexPlanningSignal({ tauriInvoke, profileId, capabilityPosture }) {
  const normalizedProfileId = trimString(profileId);
  if (
    typeof tauriInvoke !== "function" ||
    !normalizedProfileId ||
    !hasLiveReflexPlanningContext(capabilityPosture)
  ) {
    return;
  }
  const reflexSummary = capabilityPosture?.reflexSummary || {};
  try {
    await tauriInvoke("record_bios_nervous_system_event", {
      input: {
        profile_id: normalizedProfileId,
        source: "reflex",
        signal: "reflex.planning_context_loaded",
        state: "validating",
        detail:
          `Local BOSS planner loaded ${reflexSummary.candidateCount ?? 0} skill candidate(s), ` +
          `${reflexSummary.hardenedCount ?? 0} hardened skill(s), and ` +
          `${reflexSummary.synapseCount ?? 0} synapse event(s) before action choice.`,
        tags: ["skill_candidate", "pattern_observed", "validating"],
      },
    });
  } catch {
    // Nervous-system recording must not break the chat turn.
  }
}

function shouldAttemptActionPlanning(normalizedText) {
  const lower = trimString(normalizedText).toLowerCase();
  if (!lower) return false;
  return [
    "inspect",
    "check",
    "show",
    "read",
    "load",
    "memory",
    "history",
    "profile",
    "soul",
    "identity",
    "user file",
    "machine",
    "system",
    "runtime",
    "settings",
    "permission",
    "model",
    "telegram",
    "send",
    "message",
    "update",
    "change",
    "switch",
    "configure",
  ].some((needle) => lower.includes(needle));
}

function buildPlannerPrompt({
  agentName,
  capabilityPosture,
  normalizedText,
  toolRegistry,
  connectorInventory,
}) {
  const toolLines = toolRegistry.length
    ? toolRegistry
        .map(
          (tool) =>
            `- tool:${tool.name} | ${tool.label} | ${tool.summary} | approval_required=${tool.approvalRequired} | execution_class=${tool.executionClass}`,
        )
        .join("\n")
    : "- none";
  const connectorLines = connectorInventory.length
    ? connectorInventory
        .map(
          (connector) =>
            `- connector:${connector.connector} | ready=${connector.ready} | enabled=${connector.enabled} | allowed_actions=${connector.allowedActions.join(",") || "none"} | target=${connector.targetSummary || "none"}`,
        )
        .join("\n")
    : "- none";
  const reflexLines = buildReflexPlanningLines(capabilityPosture);

  return (
    `You are ${agentName}, the BIOS AI local runtime turn planner.\n` +
    `Plan against real BIOS-owned local tools and connectors only.\n` +
    `Never invent a tool, connector, file read, system inspection, or Telegram action.\n` +
    `If the request can be answered honestly without actions, do not plan actions.\n` +
    `If the request needs action, choose the minimum action set.\n` +
    `Return JSON only with this exact shape:\n` +
    `{\n` +
    `  "mode": "respond" | "act",\n` +
    `  "reason": "short explanation",\n` +
    `  "response": "only when mode=respond",\n` +
    `  "actions": [\n` +
    `    {\n` +
    `      "kind": "tool" | "connector",\n` +
    `      "name": "tool name when kind=tool",\n` +
    `      "connector": "connector name when kind=connector",\n` +
    `      "action": "action name when kind=connector",\n` +
    `      "arguments": {}\n` +
    `    }\n` +
    `  ]\n` +
    `}\n\n` +
    `Current local capability posture:\n${capabilityPosture?.summary || "unknown"}\n\n` +
    `Learned BIOS reflexes and synapses:\n${reflexLines}\n\n` +
    `Real BIOS tools:\n${toolLines}\n\n` +
    `Real BIOS connectors:\n${connectorLines}\n\n` +
    `User request:\n${normalizedText}\n`
  );
}

function buildSynthesisPrompt({ agentName, capabilityPosture, normalizedText, actionResults }) {
  const actionLines = actionResults.length
    ? actionResults
        .map(
          (result, index) =>
            `- [${index + 1}] kind=${result.kind} name=${result.displayName} state=${result.state} summary=${result.summary} detail=${result.detail} data=${JSON.stringify(result.data || {})}`,
        )
        .join("\n")
    : "- none";
  const reflexLines = buildReflexPlanningLines(capabilityPosture);

  return (
    `You are ${agentName}, the BIOS AI local BOSS.\n` +
    `Answer from the real BIOS results below.\n` +
    `Do not claim any action that is not present in the action results.\n` +
    `If approval is pending, explain that plainly.\n` +
    `If something was blocked, explain that plainly.\n` +
    `Be concise, practical, and honest.\n\n` +
    `Capability posture:\n${capabilityPosture?.summary || "unknown"}\n\n` +
    `Learned BIOS reflexes and synapses:\n${reflexLines}\n\n` +
    `User request:\n${normalizedText}\n\n` +
    `Real BIOS action results:\n${actionLines}\n`
  );
}

function normalizePlannerActions(rawPlan, toolRegistry, connectorInventory) {
  const toolMap = new Map(toolRegistry.map((tool) => [tool.name, tool]));
  const connectorMap = new Map(
    connectorInventory.map((connector) => [connector.connector, connector]),
  );
  const rawActions = Array.isArray(rawPlan?.actions) ? rawPlan.actions : [];

  const accepted = [];
  const rejected = [];
  rawActions.slice(0, 3).forEach((action) => {
    const kind = trimString(action?.kind).toLowerCase();
    if (kind === "tool") {
      const name = trimString(action?.name).toLowerCase();
      const tool = toolMap.get(name);
      if (!tool) {
        rejected.push({
          kind: "tool",
          name: name || "unknown",
          reason: "not_registered",
        });
        return;
      }
      accepted.push({
        kind: "tool",
        name,
        label: tool.label,
        arguments:
          action?.arguments && typeof action.arguments === "object" ? action.arguments : {},
      });
      return;
    }
    if (kind === "connector") {
      const connectorName = trimString(action?.connector).toLowerCase();
      const connector = connectorMap.get(connectorName);
      const connectorAction = trimString(action?.action).toLowerCase();
      if (!connector || !connectorAction) {
        rejected.push({
          kind: "connector",
          connector: connectorName || "unknown",
          action: connectorAction || "unknown",
          reason: "not_registered",
        });
        return;
      }
      if (!connector.allowedActions.includes(connectorAction)) {
        rejected.push({
          kind: "connector",
          connector: connectorName,
          action: connectorAction,
          reason: "action_not_allowed",
        });
        return;
      }
      accepted.push({
        kind: "connector",
        connector: connectorName,
        label: connector.label,
        action: connectorAction,
        arguments:
          action?.arguments && typeof action.arguments === "object" ? action.arguments : {},
      });
      return;
    }
    rejected.push({
      kind: kind || "unknown",
      name: trimString(action?.name) || trimString(action?.connector) || "unknown",
      reason: "unsupported_kind",
    });
  });

  return { accepted, rejected };
}

function actionReflexRank(action, toolRegistry) {
  if (action.kind === "connector") {
    return 30;
  }
  const tool = toolRegistry.find((entry) => entry.name === action.name);
  const executionClass = trimString(tool?.executionClass).toLowerCase();
  if (executionClass === "safe_local_read") {
    return 0;
  }
  if (executionClass === "boxed_first_risky_action") {
    return 10;
  }
  if (tool?.approvalRequired || executionClass === "approval_required_host_action") {
    return 20;
  }
  return 15;
}

function shouldPreferSaferReflexOrder(capabilityPosture = null) {
  if (!hasLiveReflexPlanningContext(capabilityPosture)) {
    return false;
  }
  const reflexSummary = capabilityPosture?.reflexSummary || {};
  const reflexSurface = capabilityPosture?.reflexSurface || {};
  const reflexText = [
    reflexSummary.topCandidate,
    reflexSummary.strongestHardened,
    reflexSurface.top_skill_candidate,
    reflexSurface.strongest_hardened_skill,
    reflexSummary.schemaSummary,
    reflexSurface.schema_summary,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return ["inspect", "check", "validate", "sandbox", "proof", "safe"].some((needle) =>
    reflexText.includes(needle),
  );
}

function applyReflexActionPreference(plannedActions, capabilityPosture, toolRegistry) {
  if (plannedActions.length < 2 || !shouldPreferSaferReflexOrder(capabilityPosture)) {
    return plannedActions;
  }
  return plannedActions
    .map((action, index) => ({ action, index }))
    .sort((left, right) => {
      const rankDelta =
        actionReflexRank(left.action, toolRegistry) - actionReflexRank(right.action, toolRegistry);
      return rankDelta || left.index - right.index;
    })
    .map((entry) => entry.action);
}

function buildRejectedActionResult({ rejectedActions, toolRegistry, connectorInventory }) {
  const registeredTools = toolRegistry.map((tool) => tool.name).sort();
  const connectorActions = connectorInventory
    .filter((connector) => connector.ready && connector.allowedActions.length)
    .map((connector) => `${connector.connector}:${connector.allowedActions.join(",")}`)
    .sort();
  const rejectedSummary = rejectedActions
    .map((action) => {
      if (action.kind === "connector") {
        return `${action.connector}.${action.action}`;
      }
      return `${action.kind}:${action.name || "unknown"}`;
    })
    .join(", ");
  return {
    kind: "capability",
    eventName: "capability.inventory.block",
    displayName: "BIOS local capability guard",
    arguments: {},
    ok: false,
    state: "blocked",
    summary: "BIOS AI blocked an unregistered local action plan.",
    detail: `The requested action plan included ${rejectedSummary || "an unsupported action"}, which is not present in the BIOS-owned local tool or connector registry.`,
    data: {
      rejected_actions: rejectedActions,
      registered_tools: registeredTools,
      ready_connector_actions: connectorActions,
    },
    approvalRequired: false,
    approvalId: null,
  };
}

function buildBlockedCapabilityReply(blockedResult) {
  const tools = Array.isArray(blockedResult?.data?.registered_tools)
    ? blockedResult.data.registered_tools
    : [];
  const connectors = Array.isArray(blockedResult?.data?.ready_connector_actions)
    ? blockedResult.data.ready_connector_actions
    : [];
  const toolCopy = tools.length ? tools.join(", ") : "no registered local tools";
  const connectorCopy = connectors.length ? connectors.join(", ") : "no ready connector actions";
  return (
    `${blockedResult.summary} ${blockedResult.detail}\n\n` +
    `Current registered local tools: ${toolCopy}.\n` +
    `Ready connector actions: ${connectorCopy}.`
  );
}

function buildActionEvents(actionResults) {
  const events = [];
  actionResults.forEach((result, index) => {
    const seq = `local-${index + 1}-${result.kind}-${result.eventName}`;
    events.push({
      seq,
      transport: "local-supervisor",
      data: {
        name: result.eventName,
        phase: "start",
        params: result.arguments || {},
      },
    });
    events.push({
      seq,
      transport: "local-supervisor",
      data: {
        name: result.eventName,
        phase: "result",
        isError: result.ok === false && result.state !== "pending_approval",
        requiresApproval: result.approvalRequired === true,
        approvalId: result.approvalId || null,
        localActionKind: result.kind,
        connector: result.connector || null,
        action: result.connectorAction || null,
        params: result.arguments || {},
        result: {
          ok: result.ok,
          state: result.state,
          summary: result.summary,
          detail: result.detail,
          data: result.data || {},
          approval_id: result.approvalId || null,
          approval_required: result.approvalRequired === true,
        },
      },
    });
  });
  return events;
}

function buildPendingApprovalReply(actionResults) {
  const pending = actionResults.find((result) => result.state === "pending_approval");
  if (!pending) return null;
  return `${pending.summary} ${pending.detail}`.trim();
}

export async function runLocalRuntimeTurn({
  tauriInvoke,
  profileId = null,
  agentName,
  normalizedText,
  conversationHistory = [],
  capabilityPosture,
  invokeReasoner,
  buildFallbackReply,
}) {
  let toolRegistry = [];
  try {
    const rawRegistry = await tauriInvoke("bios_local_tool_registry");
    toolRegistry = normalizeToolRegistry(rawRegistry);
  } catch {
    toolRegistry = [];
  }

  const connectorInventory = normalizeConnectorInventory(capabilityPosture?.connectorStatus);
  const shouldPlan =
    shouldAttemptActionPlanning(normalizedText) &&
    (toolRegistry.length || connectorInventory.length);

  if (!shouldPlan) {
    return buildFallbackReply();
  }

  await recordReflexPlanningSignal({ tauriInvoke, profileId, capabilityPosture });

  const plannerRaw = await invokeReasoner({
    messages: [{ role: "user", text: normalizedText }],
    systemPrompt: buildPlannerPrompt({
      agentName,
      capabilityPosture,
      normalizedText,
      toolRegistry,
      connectorInventory,
    }),
  });
  const plannerPayload = parseJsonObject(plannerRaw);
  const plannedMode = trimString(plannerPayload?.mode).toLowerCase();
  const { accepted: rawPlannedActions, rejected: rejectedActions } = normalizePlannerActions(
    plannerPayload,
    toolRegistry,
    connectorInventory,
  );
  const plannedActions = applyReflexActionPreference(
    rawPlannedActions,
    capabilityPosture,
    toolRegistry,
  );

  if (plannedMode !== "act" || !plannedActions.length) {
    if (plannedMode === "act" && rejectedActions.length) {
      const blockedResult = buildRejectedActionResult({
        rejectedActions,
        toolRegistry,
        connectorInventory,
      });
      const responseText = buildBlockedCapabilityReply(blockedResult);
      const conversationHistoryWithReply = [
        ...conversationHistory,
        { role: "user", text: normalizedText },
        { role: "assistant", text: responseText },
      ];
      return {
        ok: true,
        responseText,
        conversationHistory: conversationHistoryWithReply,
        actionResults: [blockedResult],
        actionEvents: buildActionEvents([blockedResult]),
      };
    }
    if (plannedMode === "respond" && trimString(plannerPayload?.response)) {
      const responseText = trimString(plannerPayload.response);
      const conversationHistoryWithReply = [
        ...conversationHistory,
        { role: "user", text: normalizedText },
        { role: "assistant", text: responseText },
      ];
      return {
        ok: true,
        responseText,
        conversationHistory: conversationHistoryWithReply,
        actionResults: [],
        actionEvents: [],
      };
    }
    return buildFallbackReply();
  }

  const actionResults = [];
  for (const action of plannedActions) {
    if (action.kind === "tool") {
      const result = await tauriInvoke("invoke_bios_local_tool", {
        input: {
          profile_id: profileId,
          name: action.name,
          arguments: action.arguments,
          confirm: false,
        },
      });
      actionResults.push({
        kind: "tool",
        eventName: action.name,
        displayName: action.label,
        arguments: action.arguments,
        ok: Boolean(result?.ok),
        state: trimString(result?.state) || "completed",
        summary: trimString(result?.summary),
        detail: trimString(result?.detail),
        data: result?.data || {},
        approvalRequired: Boolean(result?.approval_required),
        approvalId: trimString(result?.approval_id) || null,
      });
      if (result?.approval_required === true || trimString(result?.state) === "blocked") {
        break;
      }
      continue;
    }

    const result = await tauriInvoke("invoke_bios_local_connector", {
      input: {
        profile_id: profileId,
        connector: action.connector,
        action: action.action,
        arguments: action.arguments,
        confirm: false,
      },
    });
    actionResults.push({
      kind: "connector",
      eventName: `${action.connector}.${action.action}`,
      displayName: `${action.label} ${action.action}`,
      connector: action.connector,
      connectorAction: action.action,
      arguments: action.arguments,
      ok: Boolean(result?.ok),
      state: trimString(result?.state) || "completed",
      summary: trimString(result?.summary),
      detail: trimString(result?.detail),
      data: result?.data || {},
      approvalRequired: Boolean(result?.approval_required),
      approvalId: trimString(result?.approval_id) || null,
    });
    if (result?.approval_required === true || trimString(result?.state) === "blocked") {
      break;
    }
  }

  const pendingApprovalReply = buildPendingApprovalReply(actionResults);
  if (pendingApprovalReply) {
    const conversationHistoryWithReply = [
      ...conversationHistory,
      { role: "user", text: normalizedText },
      { role: "assistant", text: pendingApprovalReply },
    ];
    return {
      ok: true,
      responseText: pendingApprovalReply,
      conversationHistory: conversationHistoryWithReply,
      actionResults,
      actionEvents: buildActionEvents(actionResults),
    };
  }

  const synthesisRaw = await invokeReasoner({
    messages: [
      ...conversationHistory.slice(-6),
      { role: "user", text: normalizedText },
      {
        role: "assistant",
        text:
          "Real BIOS action results:\n" +
          actionResults
            .map(
              (result, index) =>
                `[${index + 1}] ${result.displayName} | state=${result.state} | summary=${result.summary} | detail=${result.detail} | data=${JSON.stringify(result.data || {})}`,
            )
            .join("\n"),
      },
    ],
    systemPrompt: buildSynthesisPrompt({
      agentName,
      capabilityPosture,
      normalizedText,
      actionResults,
    }),
  });

  const responseText =
    trimString(synthesisRaw) ||
    buildPendingApprovalReply(actionResults) ||
    "BIOS AI completed the local action.";
  const conversationHistoryWithReply = [
    ...conversationHistory,
    { role: "user", text: normalizedText },
    { role: "assistant", text: responseText },
  ];

  return {
    ok: true,
    responseText,
    conversationHistory: conversationHistoryWithReply,
    actionResults,
    actionEvents: buildActionEvents(actionResults),
  };
}
