import { describe, expect, it, vi } from "vitest";
import { pollOnboardingWorkerDownload } from "./onboarding-transport.js";

describe("onboarding-transport", () => {
  it("returns completed worker download status", async () => {
    const delay = vi.fn(async () => undefined);
    const loadWorkerAssetsStatus = vi.fn(async () => ({
      download: {
        state: "completed",
        variant: "qwen-3-14b",
      },
    }));

    const result = await pollOnboardingWorkerDownload({
      delay,
      loadWorkerAssetsStatus,
      maxAttempts: 4,
    });

    expect(result.state).toBe("completed");
    expect(delay).toHaveBeenCalledTimes(1);
  });

  it("hands long downloads back to onboarding as background work", async () => {
    const delay = vi.fn(async () => undefined);
    const loadWorkerAssetsStatus = vi.fn(async () => ({
      download: {
        state: "downloading",
        variant: "qwen-3-14b",
        downloaded_bytes: 7 * 1024 * 1024 * 1024,
        total_bytes: 9 * 1024 * 1024 * 1024,
        progress_percent: 77.7,
        resumable: true,
      },
    }));

    const result = await pollOnboardingWorkerDownload({
      delay,
      loadWorkerAssetsStatus,
      maxAttempts: 2,
      timeoutState: "downloading",
      timeoutError: "Continuing in background.",
    });

    expect(result).toEqual({
      state: "downloading",
      error: "Continuing in background.",
    });
    expect(delay).toHaveBeenCalledTimes(2);
    expect(loadWorkerAssetsStatus).toHaveBeenCalledTimes(2);
  });
});
