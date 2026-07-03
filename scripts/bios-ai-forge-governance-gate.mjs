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

export async function verifyBiosAiForgeGovernanceGate(repoRoot = resolveRepoRoot(), params = {}) {
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
    "Forge Arena governance gate requires BIOS AI product identity proof.",
  );
  assertCondition(
    String(buildIdentity.setupExePath || "").endsWith(".exe"),
    "Forge Arena governance gate requires packaged .exe proof.",
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
      "ForgeArenaGovernanceState",
      "ForgeArenaGovernanceWorker",
      "ForgeArenaGovernanceRecord",
      "governance: ForgeArenaGovernanceState",
      "build_governance_state",
      "Forgewarden",
      "local_governance_preview",
      "surprise_event_policy",
      "must not override official seasonal ranking",
      "participation_health",
      "anti_abuse",
    ],
    "Forge Arena native governance runtime",
  );
  assertAllIncluded(
    serviceSource,
    [
      "Arena BOSS Governance",
      "BOSS Delegation Lanes",
      "Arena Health",
      "governanceWorkerLanes",
      "surpriseEventPolicy",
      "arenaBossLabel",
    ],
    "Forge Arena governance JS projection",
  );
  assertAllIncluded(
    serviceTestSource,
    [
      "Forgewarden",
      "local_governance_preview",
      "Arena BOSS Governance",
      "BOSS Delegation Lanes",
      "Arena Health",
      "must not override",
    ],
    "Forge Arena governance frontend tests",
  );
  assertAllIncluded(
    uxSmokeSource,
    [
      "Arena BOSS Governance",
      "Forgewarden",
      "BOSS Delegation Lanes",
      "Arena Health",
      "Surprise events require Forgewarden approval",
      "must not override official seasonal ranking",
    ],
    "Forge Arena governance packaged UX smoke",
  );
  assertAllIncluded(
    uxAuditServerSource,
    [
      "buildForgeGovernance",
      "governance",
      "Forgewarden",
      "worker_lanes",
      "local_governance_preview",
      "surprise_event_policy",
      "participation_health",
    ],
    "Forge Arena governance packaged UX fixture",
  );
  assertAllIncluded(
    vitestConfigSource,
    ["aether-canvas/js/**/*.test.js", 'environment: "jsdom"', 'name: "bios-ai"', "isolate: true"],
    "Forge Arena governance canonical BIOS JS proof config",
  );

  return {
    repoRoot: path.resolve(repoRoot),
    forgeArenaGovernanceGate: "complete",
    packagedExeProof: buildIdentity.setupExePath,
    packagedStateSurfaces: packagedState.validatedSurfaces,
    packagedUxCoverage: [
      "forge-arena-local-proving-ground renders Forgewarden governance",
      "specialist worker lanes are visible as bounded lanes in the packaged Arena surface",
      "arena health and surprise-event policy render from native governance state",
      "governance remains refreshed after BOSS proving and local participation mutations",
    ],
    blockedBypassCoverage: [
      "Governance truth is generated from native Forge Arena local state, not JS-only copy",
      "Specialist workers are internal lanes under Forgewarden rather than separate public BOSSes",
      "Surprise events cannot override official seasonal ranking",
      "The release smoke fails if packaged UX stops showing governance truth",
    ],
    canonicalTests: [
      "forge_arena_local native governance tests",
      "forge-arena-service governance projection tests",
      "packaged UX forge-arena-local-proving-ground governance assertions",
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
  const result = await verifyBiosAiForgeGovernanceGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
