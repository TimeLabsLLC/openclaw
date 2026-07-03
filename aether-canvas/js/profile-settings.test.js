import { describe, expect, it } from "vitest";
import {
  buildWorkerCatalogState,
  buildWorkerSelectLabel,
} from "./boss-profiles/profile-settings.js";

describe("profile-settings worker catalog", () => {
  it("uses the shared managed model catalog truth for settings choices", () => {
    const workerCatalog = {
      machine_profile: {
        logical_cores: 16,
        total_memory_gb: 32,
        gpu_vram_gb: 16,
        gpu_name: "NVIDIA GeForce RTX 4080",
      },
      recommended_local_variant: "qwen-3-14b",
      recommended_hybrid_variant: "gemma-3-4b",
      entries: [
        {
          variant: "qwen-3-14b",
          label: "Qwen3 14B",
          family: "Qwen",
          role: "Deep local reasoning headroom for a stronger owned BOSS.",
          summary: "Large local BOSS model.",
          size_label: "~9.0 GB download",
          license_label: "Apache-2.0",
          source_url: "https://huggingface.co/Qwen/Qwen3-14B-GGUF",
          download_supported: true,
          installed: false,
          recommended_for_local: true,
          recommended_for_hybrid: false,
        },
        {
          variant: "llama-3-1-8b",
          label: "Llama 3.1 8B",
          family: "Llama",
          role: "Popular general-purpose local BOSS brain.",
          summary: "Widely supported local model.",
          size_label: "~4.9 GB download",
          license_label: "Llama 3.1 Community License",
          source_url: "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF",
          download_supported: true,
          installed: false,
          recommended_for_local: false,
          recommended_for_hybrid: false,
        },
      ],
    };

    const state = buildWorkerCatalogState(workerCatalog, "", "local");
    const llama = state.entryByVariant.get("llama-3-1-8b");

    expect(state.workerOptions).toHaveLength(2);
    expect(state.recommendedEntry.variant).toBe("qwen-3-14b");
    expect(llama.licenseLabel).toBe("Llama 3.1 Community License");
    expect(llama.sourceUrl).toContain("Meta-Llama-3.1-8B-Instruct-GGUF");
    expect(buildWorkerSelectLabel(llama)).toBe("Llama 3.1 8B - Llama - available to install");
  });

  it("preserves partial hardware fit truth in settings catalog state", () => {
    const workerCatalog = {
      machine_profile: {
        logical_cores: 16,
        total_memory_gb: 32,
        gpu_name: "NVIDIA GeForce RTX 4080",
        truth_notes: ["BIOS AI could not verify dedicated GPU VRAM."],
      },
      recommended_local_variant: "qwen-3-14b",
      entries: [
        {
          variant: "qwen-3-14b",
          label: "Qwen3 14B",
          family: "Qwen",
          role: "Deep local reasoning headroom.",
          summary: "Large local BOSS model.",
          size_label: "~9.0 GB download",
          license_label: "Apache-2.0",
          source_url: "https://huggingface.co/Qwen/Qwen3-14B-GGUF",
          download_supported: true,
          installed: false,
          recommended_for_local: true,
          min_memory_gb: 28,
          min_cores: 12,
          recommended_gpu_vram_gb: 12,
        },
      ],
    };

    const state = buildWorkerCatalogState(workerCatalog, "", "local");
    const qwen14 = state.entryByVariant.get("qwen-3-14b");

    expect(qwen14.enabled).toBe(true);
    expect(qwen14.fitConfidence).toBe("partial");
    expect(qwen14.reason).toContain("could not verify GPU VRAM");
    expect(state.machineFitSummary).toContain("VRAM not verified");
  });
});
