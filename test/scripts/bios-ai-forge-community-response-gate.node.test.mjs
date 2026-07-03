import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { verifyBiosAiForgeCommunityResponseGate } from "../../scripts/bios-ai-forge-community-response-gate.mjs";

async function writeFixture(repoRoot, relativePath, content) {
  const filePath = path.join(repoRoot, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}

test("Forge Arena community response gate requires native, UI, smoke, and test proof", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "bios-ai-forge-community-response-gate-"));
  await writeFixture(
    repoRoot,
    "aether-canvas/src-tauri/src/forge_arena_local.rs",
    [
      "ForgeArenaCommunityVoteLane",
      "ForgeArenaCommunityNomination",
      "ForgeArenaCommunitySpotlightCandidate",
      "ForgeArenaCommunityResponseState",
      "community_response: ForgeArenaCommunityResponseState",
      "build_community_response_state",
      "human_vote",
      "agent_vote",
      "local_community_response_preview",
      "does not override official_boss_judging",
      "quarantined_for_review",
      "non_ranking_bonus",
    ].join("\n"),
  );
  await writeFixture(
    repoRoot,
    "aether-canvas/js/forge-arena-service.js",
    [
      "communityResponse",
      "Community Response",
      "Human Vote Lane",
      "Agent Vote Lane",
      "Spotlight Pipeline",
      "Side Awards",
      "officialRankBoundary",
      "spotlightCandidates",
    ].join("\n"),
  );
  await writeFixture(
    repoRoot,
    "aether-canvas/js/forge-arena-service.test.js",
    [
      "local_community_response_preview",
      "human_vote",
      "agent_vote",
      "spotlight_candidate",
      "Truthful Limits",
      "does not override official_boss_judging",
      "Spotlight Pipeline",
    ].join("\n"),
  );
  await writeFixture(
    repoRoot,
    "scripts/bios-ai-ux-smoke.mjs",
    [
      "Community Response",
      "Human Vote Lane",
      "Agent Vote Lane",
      "Spotlight Pipeline",
      "Side Awards",
      "does not override official_boss_judging",
      "local_community_response_preview",
      "non_ranking_bonus",
    ].join("\n"),
  );
  await writeFixture(
    repoRoot,
    "scripts/bios-ai-ux-audit-server.mjs",
    [
      "buildForgeCommunityResponse",
      "community_response",
      "human_vote",
      "agent_vote",
      "spotlight_candidates",
      "quarantined_for_review",
      "does not override official_boss_judging",
    ].join("\n"),
  );
  await writeFixture(
    repoRoot,
    "test/vitest/vitest.bios-ai.config.ts",
    'aether-canvas/js/**/*.test.js\nenvironment: "jsdom"\nname: "bios-ai"\nisolate: true',
  );

  const result = await verifyBiosAiForgeCommunityResponseGate(repoRoot, {
    buildIdentity: {
      productName: "BIOS AI",
      setupExePath: "target/release/bundle/nsis/BIOS AI_0.1.0_x64-setup.exe",
    },
    packagedState: {
      validatedSurfaces: ["profiles", "profile-owned-identity", "profile-owned-worker-truth"],
    },
    uxSmoke: {
      scenarios: ["forge-arena-local-proving-ground"],
    },
  });

  assert.equal(result.forgeArenaCommunityResponseGate, "complete");
  assert.match(result.packagedExeProof, /\.exe$/);
  assert.ok(result.packagedUxCoverage.some((entry) => entry.includes("human and agent")));
  assert.ok(result.blockedBypassCoverage.some((entry) => entry.includes("official_boss_judging")));
});
