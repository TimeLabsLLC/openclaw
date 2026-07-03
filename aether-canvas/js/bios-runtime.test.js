import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatBiosProfileRouteLabel,
  installManagedWorkerModelSafe,
  recordBiosProofEventSafe,
} from "./bios-runtime.js";

describe("formatBiosProfileRouteLabel", () => {
  it("describes cloud as infrastructure instead of replacing the BOSS", () => {
    expect(formatBiosProfileRouteLabel("commercial")).toBe("Cloud route");
    expect(formatBiosProfileRouteLabel("local")).toBe("Local only");
    expect(formatBiosProfileRouteLabel("hybrid")).toBe("Hybrid");
  });
});

describe("installManagedWorkerModelSafe", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.__TAURI__ = {
      core: {
        invoke: vi.fn(),
      },
    };
  });

  it("requires a real BIOS profile before starting a managed worker install", async () => {
    await expect(
      installManagedWorkerModelSafe({
        variant: "qwen-3-8b",
        profileId: null,
      }),
    ).rejects.toThrow(
      "Create or resume a BIOS profile before installing a BIOS AI managed worker.",
    );

    expect(window.__TAURI__.core.invoke).not.toHaveBeenCalled();
  });

  it("returns completed reuse state without polling when the selected model is already installed", async () => {
    window.__TAURI__.core.invoke
      .mockResolvedValueOnce({
        state: "completed",
        variant: "llama-3-1-8b",
        file_name: "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
      })
      .mockResolvedValueOnce({
        installed_models: [{ variant: "llama-3-1-8b" }],
      });
    const onProgress = vi.fn();

    const result = await installManagedWorkerModelSafe({
      variant: "llama-3-1-8b",
      profileId: "claw",
      onProgress,
    });

    expect(result.download.state).toBe("completed");
    expect(result.assetsStatus.installed_models).toEqual([{ variant: "llama-3-1-8b" }]);
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(window.__TAURI__.core.invoke).toHaveBeenCalledWith("start_worker_model_download", {
      variant: "llama-3-1-8b",
      profileId: "claw",
    });
    expect(window.__TAURI__.core.invoke).toHaveBeenCalledWith("worker_assets_status", {
      profileId: "claw",
    });
  });

  it("preserves native install failure instead of reporting a ready model", async () => {
    window.__TAURI__.core.invoke
      .mockResolvedValueOnce({
        state: "downloading",
        variant: "qwen-3-14b",
      })
      .mockResolvedValueOnce({
        download: {
          state: "failed",
          variant: "qwen-3-14b",
          error: "Model download failed: 404",
        },
        installed_models: [],
      });
    const onProgress = vi.fn();

    const result = await installManagedWorkerModelSafe({
      variant: "qwen-3-14b",
      profileId: "claw",
      onProgress,
      pollDelayMs: 0,
      maxAttempts: 1,
    });

    expect(result.download).toEqual({
      state: "failed",
      variant: "qwen-3-14b",
      error: "Model download failed: 404",
    });
    expect(result.assetsStatus.installed_models).toEqual([]);
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ state: "failed", error: "Model download failed: 404" }),
      expect.objectContaining({ installed_models: [] }),
    );
  });

  it("times out as failed when native download status never leaves downloading", async () => {
    window.__TAURI__.core.invoke
      .mockResolvedValueOnce({
        state: "downloading",
        variant: "gemma-3-12b",
      })
      .mockResolvedValue({
        download: {
          state: "downloading",
          variant: "gemma-3-12b",
          downloaded_bytes: 128,
        },
        installed_models: [],
      });

    const result = await installManagedWorkerModelSafe({
      variant: "gemma-3-12b",
      profileId: "claw",
      pollDelayMs: 0,
      maxAttempts: 2,
    });

    expect(result.download).toEqual({
      state: "failed",
      error: "Worker model download timed out.",
    });
    expect(result.assetsStatus.download.state).toBe("downloading");
    expect(window.__TAURI__.core.invoke).toHaveBeenCalledTimes(4);
  });

  it("records proof events through the native proof-spine contract without exposing secrets", async () => {
    window.__TAURI__.core.invoke.mockResolvedValue({
      record_hash: "hash-1",
    });

    const result = await recordBiosProofEventSafe({
      profileId: "claw",
      eventType: "settings_changed",
      source: "settings.provider_config",
      summary: "Provider settings changed.",
      tags: ["settings"],
      payloadRedacted: {
        active_provider: "openai",
        key_count: 1,
      },
    });

    expect(result.record_hash).toBe("hash-1");
    expect(window.__TAURI__.core.invoke).toHaveBeenCalledWith("record_bios_proof_event", {
      input: {
        profile_id: "claw",
        event_type: "settings_changed",
        source: "settings.provider_config",
        summary: "Provider settings changed.",
        tags: ["settings"],
        visibility: "private",
        payload_redacted: {
          active_provider: "openai",
          key_count: 1,
        },
      },
    });
  });

  it("does not block callers when proof recording is unavailable", async () => {
    window.__TAURI__.core.invoke.mockRejectedValue(new Error("native proof unavailable"));

    await expect(
      recordBiosProofEventSafe({
        profileId: "claw",
        eventType: "settings_changed",
        source: "settings",
        summary: "Settings changed.",
      }),
    ).resolves.toBeNull();
  });
});
