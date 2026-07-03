import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
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

export async function verifyBiosAiForgeOfficialSeasonGate(
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
  const appSource = await readRepoFile(repoRoot, "aether-canvas/js/app.js");
  const uxSmokeSource = await readRepoFile(repoRoot, "scripts/bios-ai-ux-smoke.mjs");
  const uxAuditServerSource = await readRepoFile(repoRoot, "scripts/bios-ai-ux-audit-server.mjs");
  const vitestConfigSource = await readRepoFile(repoRoot, "test/vitest/vitest.bios-ai.config.ts");

  assertCondition(
    buildIdentity.productName === "BIOS AI",
    "Forge Arena official season gate requires BIOS AI product identity proof.",
  );
  assertCondition(
    String(buildIdentity.setupExePath || "").endsWith(".exe"),
    "Forge Arena official season gate requires packaged .exe proof.",
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
      "ForgeArenaOfficialSeason",
      "ForgeArenaOfficialEvent",
      "ForgeArenaOfficialRanking",
      "ForgeArenaOfficialHallOfFameEntry",
      "official_season",
      "official_events",
      "official_rankings",
      "official_hall_of_fame",
      "refresh_official_truth",
      "official_boss_judging",
      "local_contract_ready_backend_not_attached",
      "Season Zero - Foundry Dawn",
    ],
    "Forge Arena native official season runtime",
  );
  assertAllIncluded(
    serviceSource,
    [
      "official_season",
      "official_events",
      "official_rankings",
      "official_hall_of_fame",
      "official_weekly_build",
      "Official local preview",
      "seasonal_title",
    ],
    "Forge Arena official season JS projection",
  );
  assertAllIncluded(
    serviceTestSource,
    [
      "Season Zero - Foundry Dawn",
      "local_official_preview",
      "official_weekly_build",
      "Foundry Dawn Leader",
      "Official standout",
    ],
    "Forge Arena official season frontend tests",
  );
  assertAllIncluded(
    appSource,
    [
      "forge-arena-season-title",
      "forge-arena-leaderboard",
      "forge-arena-hall-of-fame",
      "latestReviewCategory",
    ],
    "Forge Arena official season UI runtime wiring",
  );
  assertAllIncluded(
    uxSmokeSource,
    [
      "Season Zero - Foundry Dawn",
      "Official Season Zero truth is locally owned",
      "official_weekly_build",
      "Foundry Dawn Leader",
      "Official standout",
      "official_boss_judging",
    ],
    "Forge Arena official season packaged UX smoke",
  );
  assertAllIncluded(
    uxAuditServerSource,
    [
      "official_season",
      "official_events",
      "official_rankings",
      "official_hall_of_fame",
      "refreshForgeOfficialTruth",
      "official_boss_judging",
    ],
    "Forge Arena official season packaged UX fixture",
  );
  assertAllIncluded(
    vitestConfigSource,
    ["aether-canvas/js/**/*.test.js", 'environment: "jsdom"', 'name: "bios-ai"', "isolate: true"],
    "Forge Arena official season canonical BIOS JS proof config",
  );

  return {
    repoRoot: path.resolve(repoRoot),
    forgeArenaOfficialSeasonGate: "complete",
    packagedExeProof: buildIdentity.setupExePath,
    packagedStateSurfaces: packagedState.validatedSurfaces,
    packagedUxCoverage: [
      "forge-arena-local-proving-ground renders native official Season Zero truth",
      "official weekly event metadata is visible in the packaged Arena surface",
      "official rankings use BOSS judging authority and survive local state mutation",
      "Hall of Fame entries render from native official Arena truth",
    ],
    blockedBypassCoverage: [
      "Official season truth cannot be JS-only projection from local artifacts",
      "Official ranking authority is explicit as official_boss_judging",
      "Connected backend status is explicit and does not pretend remote season sync exists",
      "Hall of Fame and leaderboard use native official records when present",
    ],
    canonicalTests: [
      "forge_arena_local native official season/ranking tests",
      "forge-arena-service official season projection tests",
      "packaged UX forge-arena-local-proving-ground official season assertions",
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
  const result = await verifyBiosAiForgeOfficialSeasonGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
