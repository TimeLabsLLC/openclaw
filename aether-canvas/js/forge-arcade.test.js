import { describe, expect, it } from "vitest";
import {
  FORGE_ARCADE_TEMPLATES,
  buildForgeGameSpecFromPrompt,
  buildSurvivalArenaSpecFromPrompt,
  createForgeGameCardFromSpec,
  createInitialForgeArcadeState,
  loadForgeArcadeState,
  saveForgeArcadeState,
  summarizeForgeGameSpec,
  validateForgeGameSpec,
} from "./forge-arcade.js";

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe("Forge Arcade template contract", () => {
  it("builds a bounded Survival Arena spec from a creative prompt", () => {
    const spec = buildSurvivalArenaSpecFromPrompt(
      "Make a brutal co-op sky castle survival game with proof shards",
    );

    expect(spec.templateId).toBe("survival-arena");
    expect(spec.theme).toBe("Skyward Keep");
    expect(spec.entities.companion.mode).toBe("tactical-companion");
    expect(spec.rules.hazardCount).toBeGreaterThanOrEqual(8);
    expect(spec.governance.authoringMode).toBe("template-data-only");
    expect(spec.governance.allowedHostPowers).toEqual([]);
    expect(validateForgeGameSpec(spec)).toEqual({ ok: true, errors: [] });
  });

  it("blocks specs that try to leave the template boundary", () => {
    const spec = buildSurvivalArenaSpecFromPrompt("make a survival arena");
    spec.governance.allowedHostPowers = ["filesystem"];

    const validation = validateForgeGameSpec(spec);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("host powers must remain empty");
  });

  it("persists and restores Forge Arcade state", () => {
    const storage = createMemoryStorage();
    const state = createInitialForgeArcadeState(123);

    expect(saveForgeArcadeState(state, storage)).toBe(true);
    const restored = loadForgeArcadeState(storage);

    expect(restored.draftSpec.id).toBe(state.draftSpec.id);
    expect(restored.publishedCards).toHaveLength(1);
    expect(summarizeForgeGameSpec(restored.draftSpec).runtime).toBe(
      "Template-bound playable runtime",
    );
  });

  it("creates a published game card from a playtest", () => {
    const spec = buildSurvivalArenaSpecFromPrompt("agent clash survival");
    const card = createForgeGameCardFromSpec(spec, {
      score: 440,
      shardsCollected: 3,
      survivedSeconds: 48.2,
    });

    expect(card.title).toBe(spec.title);
    expect(card.score).toBe(440);
    expect(card.proofSummary).toContain("3 shard");
    expect(card.status).toBe("local-published");
  });

  it("builds multiple approved game templates without host powers", () => {
    const specs = FORGE_ARCADE_TEMPLATES.map((template) =>
      buildForgeGameSpecFromPrompt(`make a ${template.label} with co-op callouts`, {
        templateId: template.id,
      }),
    );

    expect(specs.map((spec) => spec.templateId)).toEqual([
      "survival-arena",
      "proof-rush",
      "boss-defense",
    ]);
    expect(specs[1].rules.winCondition).toBe("collect-all");
    expect(specs[2].entities.beacon.label).toBe("BOSS Beacon");
    specs.forEach((spec) => {
      expect(validateForgeGameSpec(spec)).toEqual({ ok: true, errors: [] });
      expect(spec.governance.allowedHostPowers).toEqual([]);
    });
  });

  it("tracks remix lineage and votes on game cards", () => {
    const parent = buildForgeGameSpecFromPrompt("make a proof rush", { templateId: "proof-rush" });
    const child = buildForgeGameSpecFromPrompt("remix the proof rush", {
      templateId: "proof-rush",
      parentSpecId: parent.id,
      generation: 1,
      remixNote: "test remix",
    });
    const card = createForgeGameCardFromSpec(child, null, {
      votes: { fun: 2, useful: 1, remix: 3 },
    });

    expect(child.remix.parentSpecId).toBe(parent.id);
    expect(child.remix.generation).toBe(1);
    expect(card.votes).toEqual({ fun: 2, useful: 1, remix: 3 });
    expect(card.templateLabel).toBe("Proof Rush");
  });
});
