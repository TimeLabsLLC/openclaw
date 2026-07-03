import { describe, expect, it } from "vitest";
import {
  buildManagedWorkerSetupSnapshot,
  buildWorkerDownloadProgressSnapshot,
  buildWorkerStorageSnapshot,
  formatWorkerLabel,
} from "./onboarding-worker-ui.js";

describe("onboarding-worker-ui", () => {
  it("formats known worker labels", () => {
    expect(formatWorkerLabel("gemma-3-1b")).toBe("Gemma 3 1B");
    expect(formatWorkerLabel("gemma-3-4b")).toBe("Gemma 3 4B");
    expect(formatWorkerLabel("qwen-3-8b")).toBe("Qwen3 8B");
    expect(formatWorkerLabel("qwen-3-14b")).toBe("Qwen3 14B");
    expect(formatWorkerLabel("gemma-3-12b")).toBe("Gemma 3 12B");
    expect(formatWorkerLabel("llama-3-1-8b")).toBe("Llama 3.1 8B");
    expect(formatWorkerLabel("mistral-7b-v0-3")).toBe("Mistral 7B Instruct v0.3");
    expect(formatWorkerLabel("phi-3-5-mini")).toBe("Phi-3.5 Mini Instruct");
  });

  it("builds managed worker setup guidance", () => {
    const snapshot = buildManagedWorkerSetupSnapshot({
      machineProfile: { logical_cores: 16, total_memory_gb: 32 },
      modelChoice: "local",
      hasCloudKey: false,
    });

    expect(snapshot.mustFinishWithLocalWorker).toBe(true);
    expect(snapshot.recommendedWorker.variant).toBe("qwen-3-8b");
    expect(snapshot.workerOptions).toHaveLength(8);
    expect(snapshot.workerOptions.map((option) => option.variant)).toEqual(
      expect.arrayContaining(["llama-3-1-8b", "mistral-7b-v0-3", "phi-3-5-mini"]),
    );
  });

  it("requires a local worker during hybrid onboarding even when a cloud key exists", () => {
    const snapshot = buildManagedWorkerSetupSnapshot({
      machineProfile: { logical_cores: 16, total_memory_gb: 32, gpu_vram_gb: 16 },
      modelChoice: "hybrid",
      hasCloudKey: true,
    });

    expect(snapshot.mustFinishWithLocalWorker).toBe(true);
    expect(snapshot.recommendedWorker).toBeTruthy();
  });

  it("keeps larger local models selectable but marks hardware fit as partial when VRAM is unknown", () => {
    const snapshot = buildManagedWorkerSetupSnapshot({
      machineProfile: {
        logical_cores: 16,
        total_memory_gb: 32,
        gpu_name: "NVIDIA GeForce RTX 4080",
        truth_notes: ["BIOS AI could not verify dedicated GPU VRAM."],
      },
      modelChoice: "local",
      hasCloudKey: false,
    });

    const qwen14 = snapshot.workerOptions.find((option) => option.variant === "qwen-3-14b");

    expect(qwen14.enabled).toBe(true);
    expect(qwen14.fitConfidence).toBe("partial");
    expect(qwen14.reason).toContain("could not verify GPU VRAM");
    expect(snapshot.machineFitSummary).toContain("VRAM not verified");
  });

  it("builds storage choice defaults from runtime status", () => {
    const snapshot = buildWorkerStorageSnapshot({
      effective_path: "E:/Models",
      configured_path: "E:/Models",
      options: [
        { path: "C:/Models", label: "System Drive", is_recommended: false },
        { path: "E:/Models", label: "Data Drive", is_recommended: true },
      ],
    });

    expect(snapshot.selectedStoragePath).toBe("E:/Models");
    expect(snapshot.selectedStorageLabel).toBe("Saved custom path");
    expect(snapshot.recommendedStorage.label).toBe("Data Drive");
    expect(snapshot.storageOptions).toHaveLength(2);
  });

  it("builds worker download progress text", () => {
    const snapshot = buildWorkerDownloadProgressSnapshot({
      state: "downloading",
      progress_percent: 42.25,
      downloaded_bytes: 256 * 1024 * 1024,
      total_bytes: 1024 * 1024 * 1024,
    });

    expect(snapshot.percent).toBe(42.25);
    expect(snapshot.progressText).toContain("42.3% downloaded");
    expect(snapshot.progressText).toContain("256 MB of 1024 MB");
  });

  it("falls back safely before download telemetry arrives", () => {
    expect(buildWorkerDownloadProgressSnapshot(null)).toEqual({
      percent: 0,
      progressText: "Starting download...",
    });
  });
});
