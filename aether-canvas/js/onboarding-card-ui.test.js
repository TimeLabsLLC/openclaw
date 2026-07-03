import { describe, expect, it } from "vitest";
import {
  renderExternalWorkerSetupCard,
  renderManagedWorkerSetupCard,
  renderOnboardingReadbackCard,
  renderWorkerStorageCard,
} from "./onboarding-card-ui.js";

describe("onboarding-card-ui", () => {
  it("renders the managed worker setup card with skip option when allowed", () => {
    const html = renderManagedWorkerSetupCard({
      agentName: "Claw",
      cardStyle: "card",
      ghostBtn: "ghost",
      primaryBtn: "primary",
      recommendedWorker: { label: "Gemma 3 4B", variant: "gemma-3-4b" },
      workerOptions: [
        {
          variant: "gemma-3-4b",
          label: "Gemma 3 4B",
          role: "Everyday reasoning",
          summary: "Balanced option",
          sizeLabel: "~3.0 GB download",
          licenseLabel: "Gemma Terms of Use",
          sourceUrl: "https://huggingface.co/google/gemma-3-4b-it-qat-q4_0-gguf",
          enabled: true,
          reason: "",
          managed: true,
          modelId: "gemma-3-4b-it",
        },
      ],
      mustFinishWithLocalWorker: false,
      modelChoice: "hybrid",
      machineFitSummary: "32 GB RAM, 20 logical cores, 16 GB VRAM, NVIDIA GeForce RTX 5070 Ti",
      escapeTooltip: (value) => value,
    });

    expect(html).toContain("exact local BOSS brain");
    expect(html).toContain("Skip for now");
    expect(html).toContain("Gemma 3 4B");
    expect(html).toContain("BIOS AI recommends");
    expect(html).toContain("Use my own llama.cpp GGUF");
    expect(html).toContain("verified machine read");
    expect(html).toContain("Exact model: gemma-3-4b-it");
    expect(html).toContain("License: Gemma Terms of Use");
    expect(html).toContain("Source: https://huggingface.co/google/gemma-3-4b-it-qat-q4_0-gguf");
    expect(html).toContain("BIOS AI managed download and runtime lane");
    expect(html).toContain("16 GB VRAM");
    expect(html).toContain("NVIDIA GeForce RTX 5070 Ti");
  });

  it("renders partial hardware verification truth for selectable local models", () => {
    const html = renderManagedWorkerSetupCard({
      agentName: "Claw",
      cardStyle: "card",
      ghostBtn: "ghost",
      primaryBtn: "primary",
      recommendedWorker: { label: "Qwen3 14B", variant: "qwen-3-14b" },
      workerOptions: [
        {
          variant: "qwen-3-14b",
          label: "Qwen3 14B",
          role: "Deep local reasoning",
          summary: "Strong local BOSS option",
          sizeLabel: "~9.0 GB download",
          licenseLabel: "Apache-2.0",
          sourceUrl: "https://huggingface.co/Qwen/Qwen3-14B-GGUF",
          enabled: true,
          fitConfidence: "partial",
          reason: "BIOS AI could not verify GPU VRAM.",
          managed: true,
          modelId: "qwen3-14b",
        },
      ],
      mustFinishWithLocalWorker: true,
      modelChoice: "local",
      machineFitSummary: "32 GB RAM, 16 logical cores, VRAM not verified",
      escapeTooltip: (value) => value,
    });

    expect(html).toContain("Available, hardware partly verified");
    expect(html).toContain("BIOS AI could not verify GPU VRAM.");
    expect(html).toContain("VRAM not verified");
  });

  it("renders the external GGUF setup card", () => {
    const html = renderExternalWorkerSetupCard({
      cardStyle: "card",
      primaryBtn: "primary",
    });

    expect(html).toContain("llama.cpp-compatible GGUF");
    expect(html).toContain("Use this GGUF");
    expect(html).toContain(".gguf");
  });

  it("renders the worker storage card", () => {
    const html = renderWorkerStorageCard({
      cardStyle: "card",
      escapeOnboardingHtml: (value) => value,
      formatStorageBytes: (value) => `${value} bytes`,
      ghostBtn: "ghost",
      primaryBtn: "primary",
      recommendedStorage: { path: "E:/Models" },
      selectedWorkerLabel: "Gemma 3 4B",
      storageOptions: [
        {
          path: "E:/Models",
          label: "Data Drive",
          is_default: false,
          is_recommended: true,
          free_bytes: 123,
        },
      ],
    });

    expect(html).toContain("Where should BIOS AI store the Gemma 3 4B files?");
    expect(html).toContain("Data Drive");
    expect(html).toContain("recommended");
  });

  it("renders the onboarding readback card", () => {
    const html = renderOnboardingReadbackCard({
      agentName: "Claw",
      cardStyle: "card",
      keysSummary: "openai (sk-...123)",
      localRuntimeLabel: "BIOS AI managed llama.cpp lane",
      localWorkerLabel: "Gemma 3 4B",
      modeLabel: "Ask before actions that affect your system",
      modelLabel: "Local only",
      modelPref: "local",
      primaryBtn: "primary",
      promotionPolicy: "Approval and validation before host adoption",
      routeReadinessDetail:
        "BIOS AI verified the owned managed runtime and the selected local BOSS brain.",
      routeReadinessHeadline: "Local route verified",
      safetyPostureLabel: "LXC-first hardened",
    });

    expect(html).toContain("Claw");
    expect(html).toContain("Local route verified");
    expect(html).toContain("openai (sk-...123)");
    expect(html).toContain("BIOS AI managed llama.cpp lane");
    expect(html).toContain("Gemma 3 4B");
    expect(html).toContain("Start Working ->");
  });
});
