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

export async function verifyBiosAiForgeConnectedIdentityGate(
  repoRoot = resolveRepoRoot(),
  params = {},
) {
  const buildIdentity = params.buildIdentity ?? (await verifyBiosAiBuildIdentity(repoRoot));
  const packagedState = params.packagedState ?? (await smokeBiosAiPackagedState(repoRoot));
  const uxSmoke =
    params.uxSmoke ??
    (await smokeBiosAiUx(
      repoRoot,
      params.uxParams ?? { scenarios: ["forge-arena-profile-entry"] },
    ));
  const profileSource = await readRepoFile(
    repoRoot,
    "aether-canvas/src-tauri/src/forge_arena_profiles.rs",
  );
  const libSource = await readRepoFile(repoRoot, "aether-canvas/src-tauri/src/lib.rs");
  const appSource = await readRepoFile(repoRoot, "aether-canvas/js/app.js");
  const indexSource = await readRepoFile(repoRoot, "aether-canvas/index.html");
  const profileTestSource = await readRepoFile(
    repoRoot,
    "aether-canvas/js/app.forge-profile.test.js",
  );
  const uxSmokeSource = await readRepoFile(repoRoot, "scripts/bios-ai-ux-smoke.mjs");
  const uxAuditServerSource = await readRepoFile(repoRoot, "scripts/bios-ai-ux-audit-server.mjs");
  const vitestConfigSource = await readRepoFile(repoRoot, "test/vitest/vitest.bios-ai.config.ts");

  assertCondition(
    buildIdentity.productName === "BIOS AI",
    "Forge Arena connected identity gate requires BIOS AI product identity proof.",
  );
  assertCondition(
    String(buildIdentity.setupExePath || "").endsWith(".exe"),
    "Forge Arena connected identity gate requires packaged .exe proof.",
  );
  assertAllIncluded(
    packagedState.validatedSurfaces,
    ["profiles", "profile-owned-identity", "profile-owned-worker-truth"],
    "BIOS AI packaged state smoke",
  );
  assertScenarioRan(uxSmoke, "forge-arena-profile-entry");

  assertAllIncluded(
    profileSource,
    [
      "arena_identity_id",
      "connected_identity_version",
      "connected_backend_status",
      "public_visibility",
      "public_identity_scope",
      "private_truth_boundary",
      "normalize_connected_identity_contract",
      "response_upgrades_older_profile_records_with_connected_identity_contract",
      "local_contract_ready_backend_not_attached",
      "forge-arena-connected-identity-v1",
    ],
    "Forge Arena native connected identity contract",
  );
  assertAllIncluded(
    libSource,
    [
      "forge_arena_profiles::load_forge_arena_profile",
      "forge_arena_profiles::save_forge_arena_profile",
    ],
    "Forge Arena profile Tauri command registration",
  );
  assertAllIncluded(
    appSource,
    [
      "forge-arena-connected-identity-id",
      "forge-arena-connected-backend-status",
      "forge-arena-public-visibility",
      "forge-arena-public-scope",
      "forge-arena-private-boundary",
      "Local contract ready; connected backend not attached.",
      "Public preview",
    ],
    "Forge Arena connected identity UI runtime wiring",
  );
  assertAllIncluded(
    indexSource,
    [
      "Connected Boundary",
      "forge-arena-connected-identity-id",
      "forge-arena-connected-backend-status",
      "forge-arena-public-visibility",
      "forge-arena-public-scope",
      "forge-arena-private-boundary",
    ],
    "Forge Arena connected identity UI truth",
  );
  assertAllIncluded(
    profileTestSource,
    [
      "forge-local:claw",
      "local_contract_ready_backend_not_attached",
      "Public preview",
      "unsubmitted artifacts stay owned by the local BIOS profile",
    ],
    "Forge Arena connected identity frontend tests",
  );
  assertAllIncluded(
    uxSmokeSource,
    [
      "forge-arena-profile-entry",
      "forge-arena-connected-identity-id",
      "forge-arena-public-visibility",
      "forge-arena-private-boundary",
      "unsubmitted artifacts stay owned by the local BIOS profile",
    ],
    "Forge Arena connected identity packaged UX smoke",
  );
  assertAllIncluded(
    uxAuditServerSource,
    [
      "arena_identity_id",
      "connected_identity_version",
      "connected_backend_status",
      "public_identity_scope",
      "private_truth_boundary",
    ],
    "Forge Arena connected identity packaged UX fixture",
  );
  assertAllIncluded(
    vitestConfigSource,
    ["aether-canvas/js/**/*.test.js", 'environment: "jsdom"', 'name: "bios-ai"', "isolate: true"],
    "Forge Arena connected identity canonical BIOS JS proof config",
  );

  return {
    repoRoot: path.resolve(repoRoot),
    forgeArenaConnectedIdentityGate: "complete",
    packagedExeProof: buildIdentity.setupExePath,
    packagedStateSurfaces: packagedState.validatedSurfaces,
    packagedUxCoverage: [
      "forge-arena-profile-entry saves first connected Arena identity",
      "profile reload preserves connected identity id and public preview visibility",
      "UI names the connected backend as not attached instead of pretending public network sync exists",
      "UI names the private BIOS truth boundary for memory, keys, prompts, and unsubmitted artifacts",
    ],
    blockedBypassCoverage: [
      "Connected profile truth cannot be invented only in the frontend",
      "Older saved Arena profiles are upgraded through the native connected identity contract",
      "Public identity scope is explicit before any connected backend can publish data",
      "Private BIOS truth cannot silently become Forge Arena public truth",
    ],
    canonicalTests: [
      "forge_arena_profiles native Rust connected identity contract tests",
      "app Forge Arena profile connected boundary tests",
      "packaged UX forge-arena-profile-entry connected identity assertions",
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
  const result = await verifyBiosAiForgeConnectedIdentityGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
