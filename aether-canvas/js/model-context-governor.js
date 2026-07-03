export const DEFAULT_LOCAL_CONTEXT_TOKENS = 8192;
export const DEFAULT_RESPONSE_RESERVE_TOKENS = 1024;
export const DEFAULT_CONTEXT_SAFETY_RATIO = 0.78;

function normalizeString(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function asFiniteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function estimateTextTokens(value) {
  return Math.ceil(String(value || "").length / 4);
}

export function estimateMessagesTokens(messages = []) {
  return (Array.isArray(messages) ? messages : []).reduce(
    (total, message) =>
      total +
      estimateTextTokens(message?.role || "") +
      estimateTextTokens(message?.text ?? message?.content ?? ""),
    0,
  );
}

export function estimatePromptTokens({ systemPrompt = "", messages = [] } = {}) {
  return estimateTextTokens(systemPrompt) + estimateMessagesTokens(messages);
}

export function resolveModelContextBudget({
  runtimeStatus = null,
  capabilityPosture = null,
  provider = "",
  model = "",
  workerRole = "",
} = {}) {
  const candidates = [
    runtimeStatus?.context_window_tokens,
    runtimeStatus?.contextWindowTokens,
    runtimeStatus?.context_size_tokens,
    runtimeStatus?.contextSizeTokens,
    capabilityPosture?.contextBudget?.contextWindowTokens,
    capabilityPosture?.modelContext?.contextWindowTokens,
  ];
  const lanes = Array.isArray(runtimeStatus?.worker_lanes) ? runtimeStatus.worker_lanes : [];
  const lane = lanes.find((entry) => {
    const role = normalizeString(entry?.role).toLowerCase();
    return role && role === normalizeString(workerRole).toLowerCase();
  });
  candidates.push(
    lane?.context_window_tokens,
    lane?.contextWindowTokens,
    lane?.context_size_tokens,
    lane?.contextSizeTokens,
  );

  const explicit = candidates.map((candidate) => asFiniteNumber(candidate)).find(Boolean);
  const normalizedProvider = normalizeString(provider).toLowerCase();
  const normalizedModel = normalizeString(model).toLowerCase();
  const localManaged =
    !normalizedProvider ||
    normalizedProvider === "bios-managed" ||
    normalizedProvider === "llama.cpp" ||
    normalizedProvider === "llamacpp" ||
    normalizedProvider === "ollama" ||
    normalizedProvider === "lmstudio" ||
    normalizedModel.endsWith(".gguf");
  const contextWindowTokens = explicit || (localManaged ? DEFAULT_LOCAL_CONTEXT_TOKENS : 32768);
  const responseReserveTokens = Math.min(
    Math.max(DEFAULT_RESPONSE_RESERVE_TOKENS, Math.floor(contextWindowTokens * 0.12)),
    Math.floor(contextWindowTokens * 0.35),
  );
  const hardInputLimitTokens = Math.max(512, contextWindowTokens - responseReserveTokens);
  const safeInputLimitTokens = Math.max(
    256,
    Math.floor(hardInputLimitTokens * DEFAULT_CONTEXT_SAFETY_RATIO),
  );
  return {
    contextWindowTokens,
    responseReserveTokens,
    hardInputLimitTokens,
    safeInputLimitTokens,
    source: explicit ? "runtime" : localManaged ? "local-default" : "cloud-default",
  };
}

function normalizeMessage(message) {
  return {
    role: message?.role === "assistant" ? "assistant" : "user",
    text: normalizeString(message?.text ?? message?.content),
  };
}

function truncateMessageText(text, maxTokens) {
  const maxChars = Math.max(120, maxTokens * 4);
  const normalized = normalizeString(text);
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars - 96).trim()}\n[BIOS AI context governor truncated this oversized message before model send.]`;
}

function truncateSystemPrompt(text, maxTokens) {
  const maxChars = Math.max(240, maxTokens * 4);
  const normalized = normalizeString(text);
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars - 128).trim()}\n[BIOS AI context governor compacted oversized operating truth before model send.]`;
}

export function prepareMessagesForModelContext({
  messages = [],
  systemPrompt = "",
  budget = resolveModelContextBudget(),
  maxRetainedMessages = 8,
} = {}) {
  let compactedSystemPrompt = normalizeString(systemPrompt);
  const normalizedMessages = (Array.isArray(messages) ? messages : [])
    .map(normalizeMessage)
    .filter((message) => message.text);
  const originalTokens = estimatePromptTokens({
    systemPrompt: compactedSystemPrompt,
    messages: normalizedMessages,
  });
  const limit = budget.safeInputLimitTokens;
  if (originalTokens <= limit) {
    return {
      systemPrompt: compactedSystemPrompt,
      messages: normalizedMessages,
      compacted: false,
      sleepRequired: false,
      originalTokens,
      finalTokens: originalTokens,
      droppedMessageCount: 0,
      budget,
    };
  }

  const maxSystemPromptTokens = Math.max(256, Math.floor(limit * 0.45));
  if (estimateTextTokens(compactedSystemPrompt) > maxSystemPromptTokens) {
    compactedSystemPrompt = truncateSystemPrompt(compactedSystemPrompt, maxSystemPromptTokens);
  }

  let retained = normalizedMessages.slice(-Math.max(1, maxRetainedMessages));
  while (
    retained.length > 1 &&
    estimatePromptTokens({ systemPrompt: compactedSystemPrompt, messages: retained }) > limit
  ) {
    retained = retained.slice(1);
  }

  const availableForMessages = Math.max(128, limit - estimateTextTokens(compactedSystemPrompt));
  if (estimateMessagesTokens(retained) > availableForMessages) {
    const perMessageBudget = Math.max(80, Math.floor(availableForMessages / retained.length));
    retained = retained.map((message) => ({
      ...message,
      text: truncateMessageText(message.text, perMessageBudget),
    }));
  }

  let finalTokens = estimatePromptTokens({
    systemPrompt: compactedSystemPrompt,
    messages: retained,
  });
  if (finalTokens > budget.hardInputLimitTokens) {
    const emergencySystemPromptTokens = Math.max(
      128,
      Math.min(
        estimateTextTokens(compactedSystemPrompt),
        Math.floor(budget.hardInputLimitTokens * 0.38),
      ),
    );
    compactedSystemPrompt = truncateSystemPrompt(
      compactedSystemPrompt,
      emergencySystemPromptTokens,
    );
    const emergencyAvailableForMessages = Math.max(
      96,
      budget.hardInputLimitTokens - estimateTextTokens(compactedSystemPrompt) - 64,
    );
    retained = retained.slice(-1).map((message) => ({
      ...message,
      text: truncateMessageText(message.text, emergencyAvailableForMessages),
    }));
    finalTokens = estimatePromptTokens({ systemPrompt: compactedSystemPrompt, messages: retained });
  }

  if (finalTokens > budget.hardInputLimitTokens) {
    throw new Error(
      `BIOS AI context governor blocked model call: compacted prompt still needs ${finalTokens} token(s), but ${budget.contextWindowTokens} context token(s) are available.`,
    );
  }

  return {
    systemPrompt: compactedSystemPrompt,
    messages: retained,
    compacted: true,
    sleepRequired: true,
    originalTokens,
    finalTokens,
    droppedMessageCount: normalizedMessages.length - retained.length,
    budget,
  };
}

export function buildContextSleepTruthEvent({
  label = "BOSS model context compacted before action",
  preflight,
  subjectRefs = [],
} = {}) {
  return {
    type: "done",
    summary: `${label}: ${preflight.originalTokens} estimated prompt tokens compacted to ${preflight.finalTokens} for a ${preflight.budget.contextWindowTokens}-token model window.`,
    details: {
      original_tokens: preflight.originalTokens,
      final_tokens: preflight.finalTokens,
      context_window_tokens: preflight.budget.contextWindowTokens,
      safe_input_limit_tokens: preflight.budget.safeInputLimitTokens,
      dropped_message_count: preflight.droppedMessageCount,
      budget_source: preflight.budget.source,
    },
    subject_refs: ["model_context_governor", "memory_sleep", ...subjectRefs],
    source_refs: ["model_context_governor"],
  };
}
