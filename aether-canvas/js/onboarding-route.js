import {
  DIRECT_LOCAL_LLM_PROVIDERS,
  formatSavedLocalBackend,
  isUsableDirectLlmProvider,
  MANAGED_LOCAL_RUNTIME_ENGINE,
  MANAGED_LOCAL_RUNTIME_PROVIDER,
} from "./bios-runtime.js";

export function normalizeLocalBackend(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(/[\s_-]+/g, "");
  if (normalized === "lmstudio") {
    return "lmstudio";
  }
  if (normalized === "ollama") {
    return "ollama";
  }
  return null;
}

export function formatLocalBackendLabel(backend) {
  return formatSavedLocalBackend(backend) || "Local backend";
}

export function assignExternalLocalRuntime(result, backend) {
  result.preferredLocalBackend = backend;
  result.localRuntimeOwner = "External local runtime";
  result.localRuntimeEngine = formatLocalBackendLabel(backend);
  result.localRuntimeStrategy = "Connected existing local backend";
}

export function assignManagedLocalRuntime(result) {
  result.preferredLocalBackend = MANAGED_LOCAL_RUNTIME_PROVIDER;
  result.localRuntimeOwner = "BIOS AI";
  result.localRuntimeEngine = MANAGED_LOCAL_RUNTIME_ENGINE;
  result.localRuntimeStrategy = "BIOS-managed local runtime";
}

export function listUsableCloudKeys(apiKeys) {
  return (apiKeys || []).filter(
    (key) =>
      isUsableDirectLlmProvider(key?.provider) &&
      !DIRECT_LOCAL_LLM_PROVIDERS.has(key?.provider),
  );
}
