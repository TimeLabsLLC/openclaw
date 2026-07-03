import { describe, expect, it } from "vitest";
import { buildWorkerInstallOutcomeSnapshot } from "./onboarding-worker-status.js";

describe("onboarding-worker-status", () => {
  it("builds success messaging", () => {
    const snapshot = buildWorkerInstallOutcomeSnapshot({
      finalDownload: { state: "completed" },
      selectedStorageLabel: "Data Drive",
      workerLabel: "Gemma 3 4B",
      probeError: null,
    });

    expect(snapshot.status).toBe("ready");
    expect(snapshot.progressText).toContain("Download complete");
    expect(snapshot.bubbleHtml).toContain("Gemma 3 4B");
    expect(snapshot.bubbleHtml).toContain("Data Drive");
  });

  it("builds probe failure messaging", () => {
    const snapshot = buildWorkerInstallOutcomeSnapshot({
      finalDownload: { state: "completed" },
      selectedStorageLabel: "Data Drive",
      workerLabel: "Gemma 3 4B",
      probeError: "probe failed",
    });

    expect(snapshot.status).toBe("probe_failed");
    expect(snapshot.progressText).toBe("probe failed");
    expect(snapshot.bubbleHtml).toContain("could not be verified yet");
  });

  it("builds download failure messaging", () => {
    const snapshot = buildWorkerInstallOutcomeSnapshot({
      finalDownload: { state: "failed", error: "network down" },
      selectedStorageLabel: "Data Drive",
      workerLabel: "Gemma 3 4B",
      probeError: null,
    });

    expect(snapshot.status).toBe("download_failed");
    expect(snapshot.progressText).toBe("network down");
    expect(snapshot.bubbleHtml).toContain("network down");
  });

  it("builds resumable download failure messaging", () => {
    const snapshot = buildWorkerInstallOutcomeSnapshot({
      finalDownload: {
        state: "failed",
        error: "stream dropped",
        resumable: true,
        downloaded_bytes: 2 * 1024 * 1024 * 1024,
      },
      selectedStorageLabel: "E drive",
      workerLabel: "Qwen3 14B",
      probeError: null,
    });

    expect(snapshot.status).toBe("download_resumable");
    expect(snapshot.progressText).toContain("2048 MB is saved");
    expect(snapshot.progressText).toContain("Retry will resume");
    expect(snapshot.bubbleHtml).toContain("kept the partial file");
  });
});
