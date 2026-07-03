import { describe, expect, it } from "vitest";
import {
  estimatePromptTokens,
  prepareMessagesForModelContext,
  resolveModelContextBudget,
} from "./model-context-governor.js";

describe("model context governor", () => {
  it("defaults managed local workers to an 8192-token context budget", () => {
    const budget = resolveModelContextBudget({
      provider: "bios-managed",
      model: "Qwen3-8B-Q4_K_M.gguf",
    });

    expect(budget.contextWindowTokens).toBe(8192);
    expect(budget.safeInputLimitTokens).toBeLessThan(8192);
    expect(budget.responseReserveTokens).toBeGreaterThanOrEqual(1024);
  });

  it("compacts an oversized prompt before it can reach an 8k local model", () => {
    const budget = resolveModelContextBudget({ provider: "bios-managed" });
    const hugeHistory = Array.from({ length: 24 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      text: `turn ${index} ${"large context ".repeat(900)}`,
    }));

    const originalTokens = estimatePromptTokens({
      systemPrompt: "compact BOSS truth",
      messages: hugeHistory,
    });
    const preflight = prepareMessagesForModelContext({
      systemPrompt: "compact BOSS truth",
      messages: hugeHistory,
      budget,
      maxRetainedMessages: 2,
    });

    expect(originalTokens).toBeGreaterThan(8192);
    expect(preflight.sleepRequired).toBe(true);
    expect(preflight.compacted).toBe(true);
    expect(preflight.finalTokens).toBeLessThan(budget.hardInputLimitTokens);
    expect(preflight.droppedMessageCount).toBeGreaterThan(0);
  });

  it("compacts oversized operating truth instead of letting a local worker context overflow", () => {
    const budget = resolveModelContextBudget({ provider: "bios-managed" });
    const hugeSystemPrompt = `Compact BOSS operating truth\n${"truth packet ".repeat(26000)}`;
    const messages = [
      {
        role: "user",
        text: "Run the next Forge Arena overnight scenario with current BOSS truth.",
      },
    ];

    const preflight = prepareMessagesForModelContext({
      systemPrompt: hugeSystemPrompt,
      messages,
      budget,
    });

    expect(estimatePromptTokens({ systemPrompt: hugeSystemPrompt, messages })).toBeGreaterThan(
      budget.contextWindowTokens,
    );
    expect(preflight.sleepRequired).toBe(true);
    expect(preflight.systemPrompt).toContain(
      "context governor compacted oversized operating truth",
    );
    expect(preflight.finalTokens).toBeLessThan(budget.hardInputLimitTokens);
  });

  it("uses runtime-declared context windows when available", () => {
    const budget = resolveModelContextBudget({
      runtimeStatus: {
        worker_lanes: [
          {
            role: "boss_brain",
            context_window_tokens: 32768,
          },
        ],
      },
      workerRole: "boss_brain",
    });

    expect(budget.contextWindowTokens).toBe(32768);
    expect(budget.source).toBe("runtime");
  });
});
