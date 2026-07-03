import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verifyBiosAiBuildIdentity } from "./bios-ai-build-identity.mjs";
import { smokeBiosAiPackagedState } from "./bios-ai-packaged-state-smoke.mjs";

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

function assertScenarioCoverage(uxSmokeSource) {
  assertAllIncluded(
    uxSmokeSource,
    [
      "managed-runtime-entry",
      "resume-managed-runtime-setup",
      "profiles-without-active-still-show-picker",
      "profile-lifecycle-control-plane",
      "settings-control-plane",
      "diagnostics-recovery-surface",
      "delete-last-profile-reopens-onboarding",
    ],
    "BIOS AI packaged UX smoke",
  );
  assertAllIncluded(
    uxSmokeSource,
    [
      "Local-first shell ready",
      "BIOS AI managed llama.cpp runtime",
      "A stored profile must not silently auto-resume when native active profile truth is empty.",
      "Expected packaged local connector invoke proof",
      "Detailed debug events should not clutter the normal Settings recovery surface.",
      "runtime.route.blocked",
    ],
    "BIOS AI packaged UX assertions",
  );
}

function assertDoctorSurface(runtimeStatusUiSource, runtimeStatusUiTestSource, auditServerSource) {
  assertAllIncluded(
    runtimeStatusUiSource,
    [
      "Boxed lane needs substrate",
      "Available in the Log surface",
      "Log details will appear after BIOS AI writes support events",
      "doctorSummaryLabel",
      "Installer: ${status.installer_mode}",
    ],
    "BIOS AI doctor UI",
  );
  assertAllIncluded(
    runtimeStatusUiTestSource,
    ["Doctor found issues.", "Boxed lane needs substrate", "dev shell", "Install a worker."],
    "BIOS AI doctor UI tests",
  );
  assertAllIncluded(
    auditServerSource,
    [
      "The selected route is waiting for local worker recovery.",
      "Install the selected managed worker or switch to an available external runtime.",
      "Native boxed lane needs setup before risky host promotion.",
      "runtime.route.blocked",
    ],
    "BIOS AI diagnostics recovery fixture",
  );
}

function assertPlatformLanes(tauriConfig, currentPlatform) {
  const targets = Array.isArray(tauriConfig.bundle?.targets) ? tauriConfig.bundle.targets : [];
  assertCondition(targets.includes("nsis"), "Windows NSIS package target must stay enabled.");
  const lanes = {
    windows: {
      status: currentPlatform === "win32" ? "proved-by-release-smoke" : "configured",
      packageTarget: "nsis",
    },
    macos: {
      status: currentPlatform === "darwin" ? "requires-host-proof" : "blocked-until-darwin-host",
      packageTarget: "app/dmg",
    },
    linux: {
      status: currentPlatform === "linux" ? "requires-host-proof" : "blocked-until-linux-host",
      packageTarget: "appimage/deb/rpm",
    },
  };

  if (currentPlatform !== "darwin") {
    assertCondition(
      lanes.macos.status === "blocked-until-darwin-host",
      "macOS package lane must be explicit when it was not proved on this host.",
    );
  }
  if (currentPlatform !== "linux") {
    assertCondition(
      lanes.linux.status === "blocked-until-linux-host",
      "Linux package lane must be explicit when it was not proved on this host.",
    );
  }
  return lanes;
}

export async function verifyBiosAiPhase13ReleaseGate(repoRoot = resolveRepoRoot(), params = {}) {
  const buildIdentity = params.buildIdentity ?? (await verifyBiosAiBuildIdentity(repoRoot));
  const packagedState = params.packagedState ?? (await smokeBiosAiPackagedState(repoRoot));
  const tauriConfig = JSON.parse(
    await readRepoFile(repoRoot, "aether-canvas/src-tauri/tauri.conf.json"),
  );
  const uxSmokeSource = await readRepoFile(repoRoot, "scripts/bios-ai-ux-smoke.mjs");
  const auditServerSource = await readRepoFile(repoRoot, "scripts/bios-ai-ux-audit-server.mjs");
  const runtimeStatusUiSource = await readRepoFile(
    repoRoot,
    "aether-canvas/js/bios-runtime-status-ui.js",
  );
  const runtimeStatusUiTestSource = await readRepoFile(
    repoRoot,
    "aether-canvas/js/bios-runtime-status-ui.test.js",
  );

  assertCondition(
    buildIdentity.productName === "BIOS AI",
    "Phase 13 release gate requires the BIOS AI product identity proof.",
  );
  assertCondition(
    String(buildIdentity.setupExePath || "").endsWith(".exe"),
    "Phase 13 release gate requires an NSIS setup executable proof.",
  );
  assertCondition(
    String(buildIdentity.installerScriptPath || "").includes(path.join("nsis", "x64")),
    "Phase 13 release gate requires generated NSIS installer script proof.",
  );

  assertAllIncluded(
    packagedState.validatedSurfaces,
    [
      "logs",
      "profiles",
      "memory-active-state",
      "durable-memory",
      "dream-history",
      "brainstem-restart-continuity",
      "provider-config",
      "connector-bindings",
      "connector-approvals",
      "legacy-model-fallback-blocked",
    ],
    "BIOS AI packaged state smoke",
  );
  assertScenarioCoverage(uxSmokeSource);
  assertDoctorSurface(runtimeStatusUiSource, runtimeStatusUiTestSource, auditServerSource);

  const platformLanes = assertPlatformLanes(tauriConfig, params.platform ?? process.platform);
  assertCondition(
    ["both", "perMachine"].includes(tauriConfig.bundle?.windows?.nsis?.installMode),
    "Phase 13 release gate requires an elevation-capable setup.exe for boxed-lane system capabilities.",
  );
  assertCondition(
    tauriConfig.bundle?.windows?.nsis?.installerHooks === "installer-hooks/bios-ai-boxed-lane.nsh",
    "Phase 13 release gate requires the boxed-lane setup.exe hook.",
  );
  return {
    repoRoot: path.resolve(repoRoot),
    windowsReleaseGate: "complete",
    installerProof: {
      setupExePath: buildIdentity.setupExePath,
      installerScriptPath: buildIdentity.installerScriptPath,
      installMode: tauriConfig.bundle?.windows?.nsis?.installMode,
      installerHooks: tauriConfig.bundle?.windows?.nsis?.installerHooks,
    },
    packagedStateSurfaces: packagedState.validatedSurfaces,
    uxCoverage: [
      "first-run-managed-runtime",
      "resume-runtime-setup",
      "profile-picker-without-active-profile",
      "profile-lifecycle-control-plane",
      "settings-control-plane",
      "diagnostics-recovery",
      "delete-last-profile-reopens-onboarding",
    ],
    doctorCoverage: ["runtime-route", "managed-worker", "sandbox-substrate", "debug-log"],
    platformLanes,
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
  const result = await verifyBiosAiPhase13ReleaseGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
