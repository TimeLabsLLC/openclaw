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
    `BIOS AI packaged UX smoke did not run required Phase 14 scenario: ${scenario}`,
  );
}

export async function verifyBiosAiPhase14ReleaseGate(repoRoot = resolveRepoRoot(), params = {}) {
  const buildIdentity = params.buildIdentity ?? (await verifyBiosAiBuildIdentity(repoRoot));
  const packagedState = params.packagedState ?? (await smokeBiosAiPackagedState(repoRoot));
  const uxSmoke = params.uxSmoke ?? (await smokeBiosAiUx(repoRoot, params.uxParams ?? {}));
  const appSource = await readRepoFile(repoRoot, "aether-canvas/js/app.js");
  const actionFeedbackSource = await readRepoFile(
    repoRoot,
    "aether-canvas/js/app-action-feedback.js",
  );
  const runtimeStatusSource = await readRepoFile(
    repoRoot,
    "aether-canvas/js/bios-runtime-status-ui.js",
  );
  const shellSummarySource = await readRepoFile(repoRoot, "aether-canvas/js/shell-summary.js");
  const indexSource = await readRepoFile(repoRoot, "aether-canvas/index.html");
  const uxSmokeSource = await readRepoFile(repoRoot, "scripts/bios-ai-ux-smoke.mjs");
  const vitestConfigSource = await readRepoFile(repoRoot, "test/vitest/vitest.bios-ai.config.ts");

  assertCondition(
    buildIdentity.productName === "BIOS AI",
    "Phase 14 release gate requires the BIOS AI product identity proof.",
  );
  assertCondition(
    String(buildIdentity.setupExePath || "").endsWith(".exe"),
    "Phase 14 release gate requires packaged .exe proof.",
  );
  assertAllIncluded(
    packagedState.validatedSurfaces,
    ["profiles", "provider-config", "connector-bindings", "legacy-model-fallback-blocked"],
    "BIOS AI packaged state smoke",
  );
  for (const scenario of [
    "settings-control-plane",
    "diagnostics-recovery-surface",
    "legacy-ready-without-profile",
  ]) {
    assertScenarioRan(uxSmoke, scenario);
  }

  assertAllIncluded(
    actionFeedbackSource,
    [
      "Local features are available while it reconnects to the gateway.",
      "Local features remain available while gateway retry continues.",
      "Local shell mode continues. Gateway retry is still running.",
    ],
    "Phase 14 local-shell copy",
  );
  assertAllIncluded(
    appSource,
    [
      'bar.setAttribute("role", "status")',
      'bar.setAttribute("aria-live", "polite")',
      "bar.dataset.tone = tone",
      "bootstrap.offline.block_legacy_ready_shell",
      "renderViewportIdleCompanion(snapshot)",
      "describeActivitySnapshot()",
    ],
    "Phase 14 runtime wiring",
  );
  assertAllIncluded(
    indexSource,
    [
      'id="viewport-idle-kicker"',
      'id="viewport-idle-next-step"',
      'id="activity-label"',
      'id="tasks-activity-label"',
    ],
    "Phase 14 UI ownership",
  );
  assertAllIncluded(
    runtimeStatusSource,
    [
      "BOSS brain download in progress",
      "BOSS brain download failed",
      "Runtime blocked",
      "Route degraded",
      "Keep BIOS AI open while the BOSS brain download finishes.",
    ],
    "Phase 14 runtime-state truth",
  );
  assertAllIncluded(
    shellSummarySource,
    ['activityLabel: "READY"', 'activityLabel: "WORKING"', 'activityLabel: "BACKGROUND"'],
    "Phase 14 activity-state truth",
  );
  assertAllIncluded(
    uxSmokeSource,
    [
      "#viewport-idle-kicker",
      "#connection-status-bar",
      "Local features remain available while gateway retry continues.",
      "#activity-label",
      "#tasks-activity-label",
      "#viewport-idle-readiness",
      "Runtime blocked",
    ],
    "Phase 14 packaged UX assertions",
  );
  assertAllIncluded(
    vitestConfigSource,
    ["aether-canvas/js/**/*.test.js", 'environment: "jsdom"', 'name: "bios-ai"', "isolate: true"],
    "Phase 14 canonical BIOS JS proof config",
  );

  return {
    repoRoot: path.resolve(repoRoot),
    phase14ReleaseGate: "complete",
    packagedExeProof: buildIdentity.setupExePath,
    packagedStateSurfaces: packagedState.validatedSurfaces,
    packagedUxCoverage: [
      "settings-control-plane home companion and reconnect strip",
      "diagnostics-recovery runtime blocked clarity",
      "legacy-ready-without-profile bypass block",
    ],
    blockedBypassCoverage: [
      "native-profile-only ready shell",
      "debug route details hidden from normal Settings recovery surface",
    ],
    canonicalTests: [
      "app-action-feedback",
      "app.bootstrap-actions",
      "bios-runtime-status-ui",
      "runtime-status/controller",
      "runtime-status/status-overview",
      "shell-summary",
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
  const result = await verifyBiosAiPhase14ReleaseGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
