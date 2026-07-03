import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verifyBiosAiBuildIdentity } from "./bios-ai-build-identity.mjs";
import { smokeBiosAiPackagedState } from "./bios-ai-packaged-state-smoke.mjs";
import { smokeBiosAiUx } from "./bios-ai-ux-smoke.mjs";

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

async function readRepoFile(repoRoot, relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function assertAllIncluded(haystack, needles, label) {
  for (const needle of needles) {
    assertCondition(haystack.includes(needle), `${label} missing required proof: ${needle}`);
  }
}

function assertScenarioRan(uxSmoke, scenario) {
  assertCondition(
    Array.isArray(uxSmoke.scenarios) && uxSmoke.scenarios.includes(scenario),
    `BIOS AI packaged UX smoke did not run required Forge Arena scenario: ${scenario}`,
  );
}

export async function verifyBiosAiForgeCommunityResponseGate(
  repoRoot = resolveRepoRoot(),
  params = {},
) {
  const buildIdentity = params.buildIdentity ?? (await verifyBiosAiBuildIdentity(repoRoot));
  const packagedState = params.packagedState ?? (await smokeBiosAiPackagedState(repoRoot));
  const uxSmoke =
    params.uxSmoke ??
    (await smokeBiosAiUx(
      repoRoot,
      params.uxParams ?? { scenarios: ["forge-arena-local-proving-ground"] },
    ));
  const rustSource = await readRepoFile(
    repoRoot,
    "aether-canvas/src-tauri/src/forge_arena_local.rs",
  );
  const serviceSource = await readRepoFile(repoRoot, "aether-canvas/js/forge-arena-service.js");
  const serviceTestSource = await readRepoFile(
    repoRoot,
    "aether-canvas/js/forge-arena-service.test.js",
  );
  const uxSmokeSource = await readRepoFile(repoRoot, "scripts/bios-ai-ux-smoke.mjs");
  const uxAuditServerSource = await readRepoFile(repoRoot, "scripts/bios-ai-ux-audit-server.mjs");
  const vitestConfigSource = await readRepoFile(repoRoot, "test/vitest/vitest.bios-ai.config.ts");

  assertCondition(
    buildIdentity.productName === "BIOS AI",
    "Forge Arena community response gate requires BIOS AI product identity proof.",
  );
  assertCondition(
    String(buildIdentity.setupExePath || "").endsWith(".exe"),
    "Forge Arena community response gate requires packaged .exe proof.",
  );
  assertAllIncluded(
    packagedState.validatedSurfaces,
    ["profiles", "profile-owned-identity", "profile-owned-worker-truth"],
    "BIOS AI packaged state smoke",
  );
  assertScenarioRan(uxSmoke, "forge-arena-local-proving-ground");

  assertAllIncluded(
    rustSource,
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
    ],
    "Forge Arena native community response runtime",
  );
  assertAllIncluded(
    serviceSource,
    [
      "communityResponse",
      "Community Response",
      "Human Vote Lane",
      "Agent Vote Lane",
      "Spotlight Pipeline",
      "Side Awards",
      "officialRankBoundary",
      "spotlightCandidates",
    ],
    "Forge Arena community response JS projection",
  );
  assertAllIncluded(
    serviceTestSource,
    [
      "local_community_response_preview",
      "human_vote",
      "agent_vote",
      "spotlight_candidate",
      "Truthful Limits",
      "does not override official_boss_judging",
      "Spotlight Pipeline",
    ],
    "Forge Arena community response frontend tests",
  );
  assertAllIncluded(
    uxSmokeSource,
    [
      "Community Response",
      "Human Vote Lane",
      "Agent Vote Lane",
      "Spotlight Pipeline",
      "Side Awards",
      "does not override official_boss_judging",
      "local_community_response_preview",
      "non_ranking_bonus",
    ],
    "Forge Arena community response packaged UX smoke",
  );
  assertAllIncluded(
    uxAuditServerSource,
    [
      "buildForgeCommunityResponse",
      "community_response",
      "human_vote",
      "agent_vote",
      "spotlight_candidates",
      "quarantined_for_review",
      "does not override official_boss_judging",
    ],
    "Forge Arena community response packaged UX fixture",
  );
  assertAllIncluded(
    vitestConfigSource,
    ["aether-canvas/js/**/*.test.js", 'environment: "jsdom"', 'name: "bios-ai"', "isolate: true"],
    "Forge Arena community response canonical BIOS JS proof config",
  );

  return {
    repoRoot: path.resolve(repoRoot),
    forgeArenaCommunityResponseGate: "complete",
    packagedExeProof: buildIdentity.setupExePath,
    packagedStateSurfaces: packagedState.validatedSurfaces,
    packagedUxCoverage: [
      "forge-arena-local-proving-ground renders local community response",
      "human and agent vote lanes are visible as separate lanes",
      "nomination tags and spotlight candidates are projected from native Arena state",
      "side awards and modest bonuses render as non-ranking recognition",
    ],
    blockedBypassCoverage: [
      "Community response cannot be frontend-only because the gate requires native community_response",
      "Community response cannot override official rankings because the native and UI boundary names official_boss_judging",
      "Suspicious vote clusters are represented as quarantined review state",
      "The release smoke fails if packaged UX stops showing community response truth",
    ],
    canonicalTests: [
      "forge_arena_local native community response tests",
      "forge-arena-service community response projection tests",
      "packaged UX forge-arena-local-proving-ground community response assertions",
    ],
  };
}

function isMainModule() {
  const argv1 = process.argv[1];
  if (!argv1) {
    return false;
  }
  return import.meta.url === pathToFileURL(argv1).href;
}

if (isMainModule()) {
  const result = await verifyBiosAiForgeCommunityResponseGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
