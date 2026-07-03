import {
  buildLocalWorkerOptions,
  chooseRecommendedLocalWorker,
  describeLocalMachineFit,
  formatLocalWorkerLabel,
} from "./onboarding-local-runtime.js";

export function formatWorkerLabel(variant, workerCatalog = null) {
  return formatLocalWorkerLabel(variant, workerCatalog);
}

export function buildManagedWorkerSetupSnapshot({
  machineProfile,
  modelChoice,
  hasCloudKey,
  workerCatalog = null,
}) {
  const workerOptions = buildLocalWorkerOptions(machineProfile, workerCatalog);
  const recommendedWorker = chooseRecommendedLocalWorker(workerOptions, modelChoice);
  return {
    workerOptions,
    recommendedWorker,
    mustFinishWithLocalWorker: modelChoice === "local" || modelChoice === "hybrid" || !hasCloudKey,
    machineFitSummary: describeLocalMachineFit(machineProfile),
  };
}

export function buildWorkerStorageSnapshot(storageStatus) {
  const storageOptions = storageStatus?.options || [];
  const recommendedStorage =
    storageOptions.find((option) => option.is_recommended) || storageOptions[0] || null;

  return {
    storageOptions,
    recommendedStorage,
    selectedStoragePath: storageStatus?.effective_path || null,
    selectedStorageLabel: storageStatus?.configured_path ? "Saved custom path" : "Default path",
  };
}

export function buildWorkerDownloadProgressSnapshot(download) {
  if (download?.state !== "downloading") {
    return {
      percent: 0,
      progressText: "Starting download...",
    };
  }

  const percent = Number.isFinite(download.progress_percent) ? download.progress_percent : 0;
  const totalLabel = download.total_bytes
    ? `${(download.total_bytes / (1024 * 1024)).toFixed(0)} MB`
    : "unknown size";

  return {
    percent: Math.max(0, Math.min(100, percent)),
    progressText: `${percent.toFixed(1)}% downloaded | ${(
      download.downloaded_bytes /
      (1024 * 1024)
    ).toFixed(0)} MB of ${totalLabel}`,
  };
}
