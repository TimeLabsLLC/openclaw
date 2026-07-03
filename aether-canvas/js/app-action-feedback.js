function normalizeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function describeSettingsProviderAction(action, context = {}) {
  const provider = normalizeText(context.provider, "this provider");
  const model = normalizeText(context.model, "auto");
  const detail = normalizeText(context.detail);

  switch (action) {
    case "load-pending":
      return "Loading provider configuration...";
    case "load-empty":
      return "No provider selected";
    case "load-ready":
      return `Active: ${provider}`;
    case "switch-pending":
      return `Switching BIOS AI to ${provider}...`;
    case "switch-success":
      return `Switched to ${provider}. New messages will use it.`;
    case "switch-error":
      return detail
        ? `Provider switch failed: ${detail}`
        : `Provider switch failed for ${provider}.`;
    case "model-pending":
      return `Saving model preference (${model})...`;
    case "model-success":
      return `Model preference saved: ${model}.`;
    case "model-error":
      return detail ? `Model save failed: ${detail}` : `Model save failed for ${model}.`;
    case "key-missing":
      return "Enter an API key first.";
    case "key-pending":
      return `Saving encrypted ${provider} key and refreshing this panel...`;
    case "key-success":
      return `Added ${provider} key and made it active.`;
    case "key-error":
      return detail
        ? `Provider key save failed: ${detail}`
        : `Provider key save failed for ${provider}.`;
    default:
      return "Working...";
  }
}

export function describeApprovalAction(action, context = {}) {
  const title = normalizeText(context.title, "this operator gate");
  const detail = normalizeText(context.detail);

  switch (action) {
    case "approve-pending":
      return `Approving ${title}...`;
    case "approve-success":
      return `${title} approved. Mission work can continue.`;
    case "approve-error":
      return detail ? `Approval failed: ${detail}` : `Approval failed for ${title}.`;
    case "reject-pending":
      return `Rejecting ${title}...`;
    case "reject-success":
      return `${title} rejected. BIOS AI will wait for the next direction.`;
    case "reject-error":
      return detail ? `Rejection failed: ${detail}` : `Rejection failed for ${title}.`;
    default:
      return "Resolving operator gate...";
  }
}

export function describeForgeArenaAction(action, context = {}) {
  const title = normalizeText(context.title, "this challenge");
  const runId = normalizeText(context.runId, "the selected run");
  const sessionKey = normalizeText(context.sessionKey, "the active BIOS AI session");
  const detail = normalizeText(context.detail);
  const verdict = normalizeText(context.verdict, "hold").toUpperCase();
  const reviewCategory = normalizeText(context.reviewCategory, "breakthrough").toUpperCase();
  const scoringRule = normalizeText(context.scoringRule, "balanced");
  const scoreBonus = Number.isFinite(context.scoreBonus)
    ? Math.max(0, Math.trunc(context.scoreBonus))
    : 0;
  const hasResultSummary = Boolean(normalizeText(context.resultSummary));

  switch (action) {
    case "feature-missing-session":
      return "Select an active BIOS AI session before featuring a run.";
    case "feature-pending":
      return `Featuring run for ${sessionKey}...`;
    case "feature-success":
      return `Featured run updated to ${sessionKey}.`;
    case "feature-error":
      return detail
        ? `Feature action failed: ${detail}`
        : `Feature action failed for ${sessionKey}.`;
    case "pair-missing-challenge":
      return "Select a challenge before pairing a run.";
    case "pair-missing-run":
      return `Select a visible run to pair with ${title}.`;
    case "pair-pending":
      return `Pairing ${title} to ${runId}...`;
    case "pair-success":
      return `Paired ${title} to ${runId}.`;
    case "pair-error":
      return detail ? `Pairing failed: ${detail}` : `Pairing failed for ${title}.`;
    case "judge-missing-challenge":
      return "Select a challenge before judging.";
    case "judge-missing-run":
      return `No matching run is visible yet for ${title}.`;
    case "judge-pending":
      return `Applying ${verdict} judgement to ${title}...`;
    case "judge-success":
      return `Judgement recorded for ${title} (${reviewCategory}).`;
    case "judge-error":
      return detail ? `Judging failed: ${detail}` : `Judging failed for ${title}.`;
    case "challenge-invalid":
      return "Title and summary are required for a challenge.";
    case "challenge-create-pending":
      return `Creating challenge \"${title}\"...`;
    case "challenge-update-pending":
      return `Saving challenge \"${title}\"...`;
    case "challenge-create-success":
      return `Challenge \"${title}\" created with ${scoringRule} scoring (+${scoreBonus})${hasResultSummary ? " and a result summary" : ""}.`;
    case "challenge-update-success":
      return `Challenge \"${title}\" updated with ${scoringRule} scoring (+${scoreBonus})${hasResultSummary ? " and result visibility" : ""}.`;
    case "challenge-error":
      return detail ? `Challenge save failed: ${detail}` : `Challenge save failed for ${title}.`;
    default:
      return "Processing Forge Arena action...";
  }
}

export function describeWorkflowAction(action, context = {}) {
  const title = normalizeText(context.title, "workflow");
  const detail = normalizeText(context.detail);
  const keyCount = Number.isFinite(context.keyCount)
    ? Math.max(0, Math.trunc(context.keyCount))
    : 0;
  const modelCount = Number.isFinite(context.modelCount)
    ? Math.max(0, Math.trunc(context.modelCount))
    : 0;
  const toolCount = Number.isFinite(context.toolCount)
    ? Math.max(0, Math.trunc(context.toolCount))
    : 0;
  const agentFound = Boolean(context.agentFound);

  switch (action) {
    case "deploy-ready":
      return "Build -> test -> approvals -> deploy. Queue it through BIOS AI when you are ready.";
    case "deploy-pending":
      return `Queuing ${title} through BIOS AI...`;
    case "deploy-success":
      return `${title} handed to BIOS AI. Watch Tasks and Approvals for the live run.`;
    case "deploy-error":
      return detail ? `${title} failed to queue: ${detail}` : `${title} failed to queue.`;
    case "cleanup-ready":
      return "Run cleanup on demand to push BIOS AI through glymphatic maintenance now.";
    case "cleanup-pending":
      return `Queuing ${title} through BIOS AI...`;
    case "cleanup-success":
      return `${title} handed to BIOS AI. Watch Status and Memory for the cleanup pass.`;
    case "cleanup-error":
      return detail ? `${title} failed to queue: ${detail}` : `${title} failed to queue.`;
    case "discovery-ready":
      return "Re-scan this machine for keys, identity files, tools, and local models.";
    case "discovery-pending":
      return `Scanning this machine again for ${title.toLowerCase()}...`;
    case "discovery-success":
      return `Discovery found ${keyCount} key${keyCount === 1 ? "" : "s"}, ${modelCount} local model${modelCount === 1 ? "" : "s"}, ${toolCount} tool${toolCount === 1 ? "" : "s"}${agentFound ? ", and an existing agent profile" : ""}.`;
    case "discovery-error":
      return detail ? `Discovery failed: ${detail}` : "Discovery failed.";
    default:
      return `${title} is ready.`;
  }
}

export function describeSessionAction(action, context = {}) {
  const name = normalizeText(context.name, "Conversation");
  const sessionKey = normalizeText(context.sessionKey, "the selected session");
  const lifecycle = normalizeText(context.lifecycle, "resumable");
  const stepIndex = Number.isFinite(context.stepIndex)
    ? Math.max(0, Math.trunc(context.stepIndex))
    : 0;
  const detail = normalizeText(context.detail);

  switch (action) {
    case "switch-pending":
      return `Switching to conversation: ${name}...`;
    case "switch-success":
      return `Switched to conversation: ${name}.`;
    case "switch-error":
      return detail
        ? `Conversation switch failed: ${detail}`
        : `Conversation switch failed for ${name}.`;
    case "create-pending":
      return `Creating new conversation: ${name}...`;
    case "create-success":
      return `Created new conversation: ${name}.`;
    case "create-error":
      return detail
        ? `Conversation creation failed: ${detail}`
        : `Conversation creation failed for ${name}.`;
    case "delete-pending":
      return `Deleting conversation: ${name}...`;
    case "delete-success":
      return `Deleted conversation: ${name}.`;
    case "delete-error":
      return detail
        ? `Conversation delete failed: ${detail}`
        : `Conversation delete failed for ${name}.`;
    case "resume-pending":
      return `Resuming workflow checkpoint for: ${sessionKey}...`;
    case "resume-success":
      return `Workflow resumed at step ${stepIndex}. ${lifecycle} continuity recovered.`;
    case "resume-error":
      return detail
        ? `Workflow resume failed: ${detail}`
        : `Workflow resume failed for ${sessionKey}.`;
    default:
      return "Processing conversation state...";
  }
}

export function describeSkillAction(action, context = {}) {
  const description = normalizeText(context.description, "this skill");
  const toolName = normalizeText(context.toolName, context.skillId || "this skill");
  const skillId = normalizeText(context.skillId, "this skill");
  const detail = normalizeText(context.detail);

  switch (action) {
    case "execute-pending":
      return `Triggering ${toolName} for ${description}...`;
    case "execute-success":
      return `${toolName} handed to BIOS AI. Watch Chat and Tasks for the live run.`;
    case "execute-error":
      return detail ? `${toolName} failed to queue: ${detail}` : `${toolName} failed to queue.`;
    case "validate-pending":
      return `Validating observed skill: ${skillId}...`;
    case "validate-success":
      return `Validated observed skill: ${skillId}.`;
    case "validate-error":
      return detail
        ? `Failed to validate observed skill: ${detail}`
        : `Failed to validate observed skill: ${skillId}.`;
    default:
      return `${description} is ready.`;
  }
}

export function describeChatAction(action, context = {}) {
  const agentName = normalizeText(context.agentName, "BIOS AI");
  const provider = normalizeText(context.provider, "provider");
  const detail = normalizeText(context.detail);

  switch (action) {
    case "gateway-pending":
      return `Deploying intent to ${agentName}...`;
    case "gateway-success":
      return `${agentName} has your request and is working on it.`;
    case "gateway-error":
      return detail
        ? `Message dispatch failed: ${detail}`
        : `Message dispatch failed for ${agentName}.`;
    case "local-thinking":
      return `${agentName} is thinking...`;
    case "local-success":
      return `${agentName} responded.`;
    case "local-no-key":
      return `No ${provider} key is configured. Add one in Settings to continue.`;
    case "local-error":
      return detail
        ? `Local response failed: ${detail}`
        : `Local response failed for ${agentName}.`;
    default:
      return `${agentName} is working...`;
  }
}

export function describeBootstrapAction(action, context = {}) {
  const agentName = normalizeText(context.agentName, "BIOS AI");
  const step = normalizeText(context.step, "shell surfaces");
  const detail = normalizeText(context.detail);

  switch (action) {
    case "start":
      return `Starting ${agentName}...`;
    case "connected":
      return `Connection established. Loading ${agentName} surfaces...`;
    case "hydrate-step":
      return `Loading ${step}...`;
    case "ready":
      return `${agentName} is connected. Core surfaces are ready.`;
    case "offline-local":
      return `${agentName} is ready for local work while online services reconnect.`;
    case "reconnect-pending":
      return `${agentName} is keeping local work available while online services reconnect.`;
    case "reconnect-success":
      return `${agentName} reconnected. Live surfaces are current again.`;
    case "reconnect-error":
      return detail
        ? `Local work stays available while online services reconnect: ${detail}`
        : `Local work stays available while online services reconnect.`;
    default:
      return `${agentName} is starting...`;
  }
}

export function describeTelemetryLoad(action, context = {}) {
  const surface = normalizeText(context.surface, "surface");
  const detail = normalizeText(context.detail);

  switch (action) {
    case "pending":
      return `Loading ${surface}...`;
    case "refreshing":
      return `Refreshing ${surface}...`;
    case "success":
      return `${surface} ready.`;
    case "error":
      return detail ? `${surface} unavailable: ${detail}` : `${surface} unavailable.`;
    default:
      return `${surface} pending.`;
  }
}
