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
    `BIOS AI packaged UX smoke did not run required Phase 15 scenario: ${scenario}`,
  );
}

export async function verifyBiosAiPhase15ReleaseGate(repoRoot = resolveRepoRoot(), params = {}) {
  const buildIdentity = params.buildIdentity ?? (await verifyBiosAiBuildIdentity(repoRoot));
  const packagedState = params.packagedState ?? (await smokeBiosAiPackagedState(repoRoot));
  const uxSmoke =
    params.uxSmoke ??
    (await smokeBiosAiUx(
      repoRoot,
      params.uxParams ?? {
        scenarios: [
          "legacy-ready-without-profile",
          "stale-saved-route-bypass-blocked",
          "diagnostics-recovery-surface",
        ],
      },
    ));
  const localCapabilitySource = await readRepoFile(
    repoRoot,
    "aether-canvas/js/runtime-transport/local-capability-posture.js",
  );
  const localSupervisorSource = await readRepoFile(
    repoRoot,
    "aether-canvas/js/runtime-transport/local-supervisor-transport.js",
  );
  const profileStorageSource = await readRepoFile(
    repoRoot,
    "aether-canvas/js/boss-profiles/profile-storage.js",
  );
  const shellStateSource = await readRepoFile(repoRoot, "aether-canvas/js/bios-shell-state.js");
  const uxSmokeSource = await readRepoFile(repoRoot, "scripts/bios-ai-ux-smoke.mjs");
  const uxAuditServerSource = await readRepoFile(repoRoot, "scripts/bios-ai-ux-audit-server.mjs");
  const vitestConfigSource = await readRepoFile(repoRoot, "test/vitest/vitest.bios-ai.config.ts");

  assertCondition(
    buildIdentity.productName === "BIOS AI",
    "Phase 15 release gate requires the BIOS AI product identity proof.",
  );
  assertCondition(
    String(buildIdentity.setupExePath || "").endsWith(".exe"),
    "Phase 15 release gate requires packaged .exe proof.",
  );
  assertAllIncluded(
    packagedState.validatedSurfaces,
    ["profiles", "provider-config", "profile-owned-worker-truth", "legacy-model-fallback-blocked"],
    "BIOS AI packaged state smoke",
  );
  assertScenarioRan(uxSmoke, "legacy-ready-without-profile");
  assertScenarioRan(uxSmoke, "stale-saved-route-bypass-blocked");
  assertScenarioRan(uxSmoke, "diagnostics-recovery-surface");

  assertAllIncluded(
    localCapabilitySource,
    ["const chatReady = Boolean(runtimeStatus?.route_ready);"],
    "Phase 15 local capability posture",
  );
  assertCondition(
    !localCapabilitySource.includes("Boolean(runtimeStatus?.worker_ready) ||"),
    "Phase 15 local capability posture must not treat worker_ready as chat-ready.",
  );
  assertCondition(
    !localCapabilitySource.includes("Boolean(localBackend)"),
    "Phase 15 local capability posture must not treat saved backend hints as chat-ready.",
  );

  assertAllIncluded(
    localSupervisorSource,
    [
      "function assertRuntimeRouteReady(runtimeStatus)",
      "This BOSS profile still needs a selected and ready BOSS brain before chat can begin.",
      "assertRuntimeRouteReady(runtimeStatus);",
    ],
    "Phase 15 local supervisor route guard",
  );
  const sendIndex = localSupervisorSource.indexOf("async sendChatMessage({");
  const guardIndex = localSupervisorSource.indexOf(
    "assertRuntimeRouteReady(runtimeStatus);",
    sendIndex,
  );
  const contextIndex = localSupervisorSource.indexOf("loadLocalCapabilityContext(", sendIndex);
  const routeIndex = localSupervisorSource.indexOf("chooseBossChatRoute({", sendIndex);
  assertCondition(
    sendIndex >= 0 && guardIndex > sendIndex,
    "Phase 15 chat guard missing from sendChatMessage.",
  );
  assertCondition(
    contextIndex < 0 || guardIndex < contextIndex,
    "Phase 15 chat guard must run before local context loading.",
  );
  assertCondition(
    routeIndex < 0 || guardIndex < routeIndex,
    "Phase 15 chat guard must run before provider or worker route selection.",
  );

  assertAllIncluded(
    profileStorageSource,
    ["if (!profileId) {\n      return null;", "storage.removeItem(BIOS_ACTIVE_ONBOARDING_KEY);"],
    "Phase 15 scoped onboarding storage",
  );
  assertAllIncluded(
    shellStateSource,
    [
      "savedRuntimeCheckNeeded",
      "Runtime check needed",
      "has not verified the active route yet",
      "Wait for BIOS AI to verify the saved runtime route before chat.",
    ],
    "Phase 15 shell-state runtime truth",
  );
  assertAllIncluded(
    uxSmokeSource,
    [
      "stale-saved-route-bypass",
      "stale-saved-route-bypass-blocked",
      "Blocked native route should make local chat send fail.",
      "Saved provider/backend hints must not bypass a blocked native BOSS brain route.",
    ],
    "Phase 15 packaged UX assertions",
  );
  assertAllIncluded(
    uxAuditServerSource,
    [
      "stale-saved-route-bypass",
      "routeBlockedScenario",
      "bios-ai-onboarding:claw",
      "Verify the BOSS brain route before chat.",
    ],
    "Phase 15 packaged UX fixture",
  );
  assertAllIncluded(
    vitestConfigSource,
    ["aether-canvas/js/**/*.test.js", 'environment: "jsdom"', 'name: "bios-ai"', "isolate: true"],
    "Phase 15 canonical BIOS JS proof config",
  );

  return {
    repoRoot: path.resolve(repoRoot),
    phase15ReleaseGate: "complete",
    packagedExeProof: buildIdentity.setupExePath,
    packagedStateSurfaces: packagedState.validatedSurfaces,
    packagedUxCoverage: [
      "legacy-ready-without-profile blocks global localStorage readiness",
      "stale-saved-route-bypass-blocked refuses saved provider/backend hints",
      "diagnostics-recovery-surface keeps runtime blocked states visible",
    ],
    blockedBypassCoverage: [
      "route_ready-only local capability posture",
      "local supervisor chat guard before context loading",
      "local supervisor chat guard before provider or worker route selection",
      "saved shell state requires runtime verification before ready UI",
      "scoped onboarding storage ignores global readiness without a profile",
    ],
    canonicalTests: [
      "runtime-transport/client",
      "runtime-transport/local-capability-posture",
      "boss-profiles/profile-storage",
      "app.bootstrap-actions",
      "bios-shell-state",
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
  const result = await verifyBiosAiPhase15ReleaseGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
