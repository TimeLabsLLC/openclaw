const FALLBACK_LOCAL_WORKER_CATALOG = [
  {
    variant: "gemma-3-1b",
    label: "Gemma 3 1B",
    family: "Gemma",
    role: "Fastest owned BOSS start for smaller machines.",
    summary:
      "Lightest BIOS AI managed local BOSS brain. Installs quickly, starts quickly, and stays the safest owned fit for smaller systems.",
    sizeLabel: "~0.8 GB download",
    licenseLabel: "Gemma Terms of Use",
    sourceUrl: "https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF",
    enabled: true,
    reason: "",
    managed: true,
    installed: false,
    source: "fallback",
    recommendedForLocal: false,
    recommendedForHybrid: false,
  },
  {
    variant: "gemma-3-4b",
    label: "Gemma 3 4B",
    family: "Gemma",
    role: "Balanced owned BOSS choice for most people.",
    summary:
      "Steadier local BOSS brain without becoming too heavy for normal daily use. This is the safest general recommendation on a mid-range system.",
    sizeLabel: "~3.0 GB download",
    licenseLabel: "Gemma Terms of Use",
    sourceUrl: "https://huggingface.co/ggml-org/gemma-3-4b-it-GGUF",
    enabled: true,
    reason: "",
    managed: true,
    installed: false,
    source: "fallback",
    recommendedForLocal: false,
    recommendedForHybrid: true,
  },
  {
    variant: "qwen-3-8b",
    label: "Qwen3 8B",
    family: "Qwen",
    role: "Stronger reasoning headroom for a serious local BOSS.",
    summary:
      "Gives BIOS AI more local reasoning room than the balanced 4B lane while still staying in a realistic owned-runtime starter range.",
    sizeLabel: "~5.2 GB download",
    licenseLabel: "Apache-2.0",
    sourceUrl: "https://huggingface.co/Qwen/Qwen3-8B-GGUF",
    enabled: true,
    reason: "",
    managed: true,
    installed: false,
    source: "fallback",
    recommendedForLocal: true,
    recommendedForHybrid: false,
  },
  {
    variant: "qwen-3-14b",
    label: "Qwen3 14B",
    family: "Qwen",
    role: "Deep local reasoning headroom for a stronger owned BOSS.",
    summary:
      "A larger Qwen lane for people who want more owned reasoning depth than 8B without leaving the BIOS AI managed llama.cpp path.",
    sizeLabel: "~9.0 GB download",
    licenseLabel: "Apache-2.0",
    sourceUrl: "https://huggingface.co/Qwen/Qwen3-14B-GGUF",
    enabled: true,
    reason: "",
    managed: true,
    installed: false,
    source: "fallback",
    recommendedForLocal: false,
    recommendedForHybrid: false,
  },
  {
    variant: "gemma-3-12b",
    label: "Gemma 3 12B",
    family: "Gemma",
    role: "Deepest managed on-device BOSS brain in the starter lane.",
    summary:
      "Largest BIOS AI managed starter option. Best when the machine has the memory and cores to carry a heavier owned local BOSS without dragging the shell down.",
    sizeLabel: "~8.1 GB download",
    licenseLabel: "Gemma Terms of Use",
    sourceUrl: "https://huggingface.co/ggml-org/gemma-3-12b-it-GGUF",
    enabled: true,
    reason: "",
    managed: true,
    installed: false,
    source: "fallback",
    recommendedForLocal: false,
    recommendedForHybrid: false,
  },
  {
    variant: "llama-3-1-8b",
    label: "Llama 3.1 8B",
    family: "Llama",
    role: "Popular general-purpose local BOSS brain with strong ecosystem compatibility.",
    summary:
      "A widely supported 8B local reasoning lane for users who want the Llama family inside the BIOS AI managed llama.cpp path.",
    sizeLabel: "~4.9 GB download",
    licenseLabel: "Llama 3.1 Community License",
    sourceUrl: "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF",
    enabled: true,
    reason: "",
    managed: true,
    installed: false,
    source: "fallback",
    recommendedForLocal: false,
    recommendedForHybrid: false,
  },
  {
    variant: "mistral-7b-v0-3",
    label: "Mistral 7B Instruct v0.3",
    family: "Mistral",
    role: "Efficient open-weight worker lane for fast general tasks.",
    summary:
      "A compact, capable local worker option for users who want a proven Mistral-family model without choosing a heavier BOSS brain.",
    sizeLabel: "~4.4 GB download",
    licenseLabel: "Apache-2.0",
    sourceUrl: "https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF",
    enabled: true,
    reason: "",
    managed: true,
    installed: false,
    source: "fallback",
    recommendedForLocal: false,
    recommendedForHybrid: false,
  },
  {
    variant: "phi-3-5-mini",
    label: "Phi-3.5 Mini Instruct",
    family: "Phi",
    role: "Small fast reasoning worker for lighter helper tasks.",
    summary:
      "A small managed worker choice for quick local helper tasks where speed and low resource use matter more than maximum depth.",
    sizeLabel: "~2.2 GB download",
    licenseLabel: "MIT",
    sourceUrl: "https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF",
    enabled: true,
    reason: "",
    managed: true,
    installed: false,
    source: "fallback",
    recommendedForLocal: false,
    recommendedForHybrid: false,
  },
];

const FALLBACK_REQUIREMENTS = {
  "gemma-3-4b": { minMemoryGb: 12, minCores: 8, minGpuVramGb: 6 },
  "phi-3-5-mini": { minMemoryGb: 10, minCores: 6, minGpuVramGb: 4 },
  "mistral-7b-v0-3": { minMemoryGb: 16, minCores: 8, minGpuVramGb: 8 },
  "llama-3-1-8b": { minMemoryGb: 18, minCores: 10, minGpuVramGb: 8 },
  "qwen-3-8b": { minMemoryGb: 18, minCores: 10, minGpuVramGb: 8 },
  "qwen-3-14b": { minMemoryGb: 28, minCores: 12, minGpuVramGb: 12 },
  "gemma-3-12b": { minMemoryGb: 24, minCores: 12, minGpuVramGb: 10 },
};

export function getSystemFitProfile(machineProfile) {
  if (machineProfile && typeof machineProfile === "object") {
    const logicalCores = Number.isFinite(machineProfile.logical_cores)
      ? machineProfile.logical_cores
      : 4;
    const totalMemoryGb = Number.isFinite(machineProfile.total_memory_gb)
      ? machineProfile.total_memory_gb
      : null;
    const gpuVramGb = Number.isFinite(machineProfile.gpu_vram_gb)
      ? machineProfile.gpu_vram_gb
      : null;
    return {
      logicalCores,
      deviceMemoryGb: totalMemoryGb,
      gpuVramGb,
      gpuName: machineProfile.gpu_name || "",
      gpuVendor: machineProfile.gpu_vendor || "",
      truthNotes: Array.isArray(machineProfile.truth_notes) ? machineProfile.truth_notes : [],
    };
  }
  const logicalCores =
    typeof navigator !== "undefined" && Number.isFinite(navigator.hardwareConcurrency)
      ? navigator.hardwareConcurrency
      : 4;
  const deviceMemoryGb =
    typeof navigator !== "undefined" && Number.isFinite(navigator.deviceMemory)
      ? navigator.deviceMemory
      : null;
  return {
    logicalCores,
    deviceMemoryGb,
    gpuVramGb: null,
    gpuName: "",
    gpuVendor: "",
    truthNotes: [],
  };
}

export function describeLocalMachineFit(machineProfile) {
  const profile = getSystemFitProfile(machineProfile);
  const parts = [];
  if (Number.isFinite(profile.deviceMemoryGb)) {
    parts.push(`${profile.deviceMemoryGb} GB RAM`);
  }
  if (Number.isFinite(profile.logicalCores)) {
    parts.push(`${profile.logicalCores} logical cores`);
  }
  if (Number.isFinite(profile.gpuVramGb)) {
    parts.push(`${profile.gpuVramGb} GB VRAM`);
  }
  if (profile.gpuName) {
    parts.push(profile.gpuName);
  } else if (profile.gpuVendor) {
    parts.push(`${profile.gpuVendor} GPU`);
  } else {
    parts.push("GPU not verified");
  }
  if (!Number.isFinite(profile.gpuVramGb)) {
    parts.push("VRAM not verified");
  }
  if (!parts.length) {
    return "the verified machine read is still incomplete";
  }
  return parts.join(", ");
}

export function formatStorageBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "";
  }
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 100 ? `${gb.toFixed(0)} GB` : `${gb.toFixed(1)} GB`;
}

export function escapeOnboardingHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeCatalogEntry(entry) {
  return {
    variant: entry.variant,
    label: entry.label,
    family: entry.family || "Local model",
    modelId: entry.model_id || entry.modelId || entry.variant,
    role: entry.role,
    summary: entry.summary,
    sizeLabel: entry.size_label || entry.sizeLabel || "",
    licenseLabel: entry.license_label || entry.licenseLabel || "",
    sourceUrl: entry.source_url || entry.sourceUrl || "",
    enabled: entry.enabled !== false,
    reason: entry.disabled_reason || entry.reason || "",
    fitConfidence: entry.fit_confidence || entry.fitConfidence || "unknown",
    fitNote: entry.fit_note || entry.fitNote || "",
    managed: entry.managed !== false,
    installed: Boolean(entry.installed),
    source: entry.source || "catalog",
    downloadSupported: entry.download_supported !== false,
    recommendedForLocal: Boolean(entry.recommended_for_local || entry.recommendedForLocal),
    recommendedForHybrid: Boolean(entry.recommended_for_hybrid || entry.recommendedForHybrid),
    minMemoryGb: Number.isFinite(entry.min_memory_gb)
      ? entry.min_memory_gb
      : Number.isFinite(entry.minMemoryGb)
        ? entry.minMemoryGb
        : null,
    minCores: Number.isFinite(entry.min_cores)
      ? entry.min_cores
      : Number.isFinite(entry.minCores)
        ? entry.minCores
        : null,
    minGpuVramGb: Number.isFinite(entry.recommended_gpu_vram_gb)
      ? entry.recommended_gpu_vram_gb
      : Number.isFinite(entry.minGpuVramGb)
        ? entry.minGpuVramGb
        : null,
  };
}

function buildMachineFitReason(option, profile) {
  const gaps = [];
  if (Number.isFinite(option.minMemoryGb) && Number.isFinite(profile.deviceMemoryGb)) {
    if (profile.deviceMemoryGb < option.minMemoryGb) {
      gaps.push(`needs about ${option.minMemoryGb} GB RAM`);
    }
  }
  if (Number.isFinite(option.minCores) && Number.isFinite(profile.logicalCores)) {
    if (profile.logicalCores < option.minCores) {
      gaps.push(`needs about ${option.minCores} logical cores`);
    }
  }
  if (Number.isFinite(option.minGpuVramGb) && Number.isFinite(profile.gpuVramGb)) {
    if (profile.gpuVramGb < option.minGpuVramGb) {
      gaps.push(`is best with roughly ${option.minGpuVramGb} GB VRAM`);
    }
  }
  if (!gaps.length) {
    return option.reason || "";
  }
  return `This model is not recommended here because it ${gaps.join(" and ")}.`;
}

function buildPartialFitNote(option, profile) {
  const notes = [];
  if (Number.isFinite(option.minMemoryGb) && !Number.isFinite(profile.deviceMemoryGb)) {
    notes.push("BIOS AI could not verify total RAM.");
  }
  if (Number.isFinite(option.minGpuVramGb) && !Number.isFinite(profile.gpuVramGb)) {
    notes.push("BIOS AI could not verify GPU VRAM.");
  }
  if (!notes.length) {
    return "";
  }
  return `${notes.join(" ")} This stays selectable, but the fit is not fully proven until the runtime verifies it.`;
}

function applyMachineFit(option, profile) {
  const memoryOkay =
    !Number.isFinite(option.minMemoryGb) ||
    !Number.isFinite(profile.deviceMemoryGb) ||
    profile.deviceMemoryGb >= option.minMemoryGb;
  const coresOkay =
    !Number.isFinite(option.minCores) ||
    !Number.isFinite(profile.logicalCores) ||
    profile.logicalCores >= option.minCores;
  const vramOkay =
    !Number.isFinite(option.minGpuVramGb) ||
    !Number.isFinite(profile.gpuVramGb) ||
    profile.gpuVramGb >= option.minGpuVramGb;
  const enabled = option.enabled !== false && memoryOkay && coresOkay && vramOkay;
  const partialNote = enabled ? buildPartialFitNote(option, profile) : "";
  const fitConfidence =
    option.fitConfidence && option.fitConfidence !== "unknown"
      ? option.fitConfidence
      : partialNote
        ? "partial"
        : enabled
          ? "verified"
          : "not_recommended";
  return {
    ...option,
    enabled,
    fitConfidence,
    reason: enabled
      ? option.fitNote || option.reason || partialNote
      : buildMachineFitReason(option, profile),
  };
}

export function buildLocalWorkerOptions(machineProfile, workerCatalog = null) {
  const catalogEntries = Array.isArray(workerCatalog?.entries)
    ? workerCatalog.entries.map(normalizeCatalogEntry)
    : null;
  const profile = getSystemFitProfile(machineProfile);
  if (catalogEntries?.length) {
    return catalogEntries.map((entry) => applyMachineFit(entry, profile));
  }
  return FALLBACK_LOCAL_WORKER_CATALOG.map((entry) => {
    const requirements = FALLBACK_REQUIREMENTS[entry.variant] || {};
    const withRequirements = {
      ...entry,
      minMemoryGb: requirements.minMemoryGb ?? null,
      minCores: requirements.minCores ?? null,
      minGpuVramGb: requirements.minGpuVramGb ?? null,
    };
    return applyMachineFit(withRequirements, profile);
  });
}

export function formatLocalWorkerLabel(variant, workerCatalog = null) {
  return (
    buildLocalWorkerOptions(null, workerCatalog).find((option) => option.variant === variant)
      ?.label || ""
  );
}

export function chooseRecommendedLocalWorker(workerOptions, modelChoice = "local") {
  const enabledOptions = (workerOptions || []).filter((option) => option.enabled);
  if (!enabledOptions.length) {
    return (workerOptions || [])[0] || null;
  }
  if (modelChoice === "local") {
    return (
      enabledOptions.find((option) => option.recommendedForLocal) ||
      enabledOptions.at(-1) ||
      enabledOptions[0]
    );
  }
  return (
    enabledOptions.find((option) => option.recommendedForHybrid) ||
    enabledOptions.find((option) => option.variant === "gemma-3-4b") ||
    enabledOptions[0]
  );
}
