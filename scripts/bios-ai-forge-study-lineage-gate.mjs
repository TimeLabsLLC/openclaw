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

export async function verifyBiosAiForgeStudyLineageGate(repoRoot = resolveRepoRoot(), params = {}) {
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
    "Forge Arena study lineage gate requires BIOS AI product identity proof.",
  );
  assertCondition(
    String(buildIdentity.setupExePath || "").endsWith(".exe"),
    "Forge Arena study lineage gate requires packaged .exe proof.",
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
      "ForgeArenaStudyLineageEntry",
      "ForgeArenaStudyLineageState",
      "study_lineage: ForgeArenaStudyLineageState",
      "build_study_lineage_state",
      "local_study_lineage_preview",
      "study_not_authority",
      "authorship_preserved",
      "remix_requires_consent",
      "published_local_lineage",
      "truthful_blocked_capability_handling",
    ],
    "Forge Arena native study lineage runtime",
  );
  assertAllIncluded(
    serviceSource,
    [
      "studyLineage",
      "Study Lineage",
      "Learnable Patterns",
      "Authorship Boundary",
      "lineageBoundary",
      "remixPermissionPolicy",
      "studyQueue",
    ],
    "Forge Arena study lineage JS projection",
  );
  assertAllIncluded(
    serviceTestSource,
    [
      "local_study_lineage_preview",
      "study_not_authority",
      "authorship_preserved",
      "remix_requires_consent",
      "truthful_blocked_capability_handling",
      "Study Lineage",
    ],
    "Forge Arena study lineage frontend tests",
  );
  assertAllIncluded(
    uxSmokeSource,
    [
      "Study Lineage",
      "Learnable Patterns",
      "Authorship Boundary",
      "study_not_authority",
      "authorship_preserved",
      "remix_requires_consent",
      "published_local_lineage",
    ],
    "Forge Arena study lineage packaged UX smoke",
  );
  assertAllIncluded(
    uxAuditServerSource,
    [
      "buildForgeStudyLineage",
      "study_lineage",
      "local_study_lineage_preview",
      "study_not_authority",
      "authorship_preserved",
      "remix_requires_consent",
    ],
    "Forge Arena study lineage packaged UX fixture",
  );
  assertAllIncluded(
    vitestConfigSource,
    ["aether-canvas/js/**/*.test.js", 'environment: "jsdom"', 'name: "bios-ai"', "isolate: true"],
    "Forge Arena study lineage canonical BIOS JS proof config",
  );

  return {
    repoRoot: path.resolve(repoRoot),
    forgeArenaStudyLineageGate: "complete",
    packagedExeProof: buildIdentity.setupExePath,
    packagedStateSurfaces: packagedState.validatedSurfaces,
    packagedUxCoverage: [
      "forge-arena-local-proving-ground renders local study lineage",
      "learnable patterns and lineage kinds are visible",
      "authorship and remix consent boundaries are visible",
      "study lineage remains separate from official_boss_judging authority",
    ],
    blockedBypassCoverage: [
      "Study lineage cannot be frontend-only because the gate requires native study_lineage",
      "Study cannot transfer authorship because native, service, tests, and UX smoke require authorship_preserved",
      "Remix cannot silently bypass consent because remix_requires_consent is native and visible",
      "The release smoke fails if packaged UX stops showing study lineage truth",
    ],
    canonicalTests: [
      "forge_arena_local native study lineage tests",
      "forge-arena-service study lineage projection tests",
      "packaged UX forge-arena-local-proving-ground study lineage assertions",
    ],
  };
}

function isMainModule() {
  const argv1 = process.argv[1];
  return Boolean(argv1) && import.meta.url === pathToFileURL(argv1).href;
}

if (isMainModule()) {
  const result = await verifyBiosAiForgeStudyLineageGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
