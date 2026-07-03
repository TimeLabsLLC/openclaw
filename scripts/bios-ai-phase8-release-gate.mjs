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

export async function verifyBiosAiPhase8ReleaseGate(repoRoot = resolveRepoRoot(), params = {}) {
  const buildIdentity = params.buildIdentity ?? (await verifyBiosAiBuildIdentity(repoRoot));
  const packagedState = params.packagedState ?? (await smokeBiosAiPackagedState(repoRoot));
  const uxSmoke = params.uxSmoke ?? (await smokeBiosAiUx(repoRoot, params.uxParams ?? {}));
  const runtimeSource = await readRepoFile(repoRoot, "aether-canvas/src-tauri/src/bios_runtime.rs");
  const contractSource = await readRepoFile(
    repoRoot,
    "aether-canvas/src-tauri/src/bios_contracts.rs",
  );
  const libSource = await readRepoFile(repoRoot, "aether-canvas/src-tauri/src/lib.rs");
  const runtimeUiSource = await readRepoFile(
    repoRoot,
    "aether-canvas/js/bios-runtime-status-ui.js",
  );
  const runtimeUiTestSource = await readRepoFile(
    repoRoot,
    "aether-canvas/js/bios-runtime-status-ui.test.js",
  );
  const runtimeStatusControllerSource = await readRepoFile(
    repoRoot,
    "aether-canvas/js/runtime-status/controller.js",
  );
  const profileUiSource = await readRepoFile(repoRoot, "aether-canvas/js/bios-profile-ui.js");
  const uxAuditServerSource = await readRepoFile(repoRoot, "scripts/bios-ai-ux-audit-server.mjs");
  const uxSmokeSource = await readRepoFile(repoRoot, "scripts/bios-ai-ux-smoke.mjs");
  const releaseSmokeSource = await readRepoFile(repoRoot, "scripts/bios-ai-release-smoke.cmd");
  const tauriConfigSource = await readRepoFile(repoRoot, "aether-canvas/src-tauri/tauri.conf.json");
  const installerHookSource = await readRepoFile(
    repoRoot,
    "aether-canvas/src-tauri/installer-hooks/bios-ai-boxed-lane.nsh",
  );

  assertCondition(
    buildIdentity.productName === "BIOS AI",
    "Phase 8 release gate requires the BIOS AI product identity proof.",
  );
  assertCondition(
    String(buildIdentity.setupExePath || "").endsWith(".exe"),
    "Phase 8 release gate requires packaged .exe proof.",
  );
  assertAllIncluded(
    packagedState.validatedSurfaces,
    ["profiles", "provider-config", "connector-bindings", "profile-owned-worker-truth"],
    "Phase 8 packaged state smoke",
  );
  assertCondition(
    Array.isArray(uxSmoke.scenarios) && uxSmoke.scenarios.includes("sandbox-promotion-lifecycle"),
    "Phase 8 packaged UX smoke must run the sandbox promotion lifecycle scenario.",
  );

  assertAllIncluded(
    runtimeSource,
    [
      "pub struct BiosBoxedLaneProvisioningStatus",
      "BIOS AI Boxed Lane",
      "windows-wsl2-managed-distro",
      "Windows managed WSL2 adapter",
      "macOS Boxed Lane (Apple Virtualization Linux VM)",
      "linux-native-container",
      "Linux native container adapter",
      "safe_to_run_untrusted_work",
      "repair_state",
      "repair_owner",
      "background_repair_label",
      "os_setup_started",
      "repair_already_running",
      "background_repair_queued",
      "proof_state",
      "smoke_proof_passed",
      "boxed-lane-repair-state.json",
      "safe_to_run_untrusted_work = ready && proof_passed",
      "boxed_lane.prepare.result",
      "record_boxed_lane_prepare_result",
      "load_installer_boxed_lane_repair_state",
      "installer-boxed-lane-status.json",
      "pub async fn bios_boxed_lane_status",
      "pub async fn bios_prepare_boxed_lane",
      "command_spawn_hidden",
      "BOXED_LANE_REPAIR_SINGLE_FLIGHT_SECONDS",
    ],
    "Phase 8 native boxed-lane runtime",
  );
  assertAllIncluded(
    contractSource,
    [
      "pub provisioning: BiosBoxedLaneProvisioningStatus",
      "runtime.boxed_lane_provisioning.clone()",
    ],
    "Phase 8 shell contract",
  );
  assertAllIncluded(
    libSource,
    ["bios_runtime::bios_boxed_lane_status", "bios_runtime::bios_prepare_boxed_lane"],
    "Phase 8 Tauri command registration",
  );
  assertAllIncluded(
    runtimeUiSource,
    [
      "boxed_lane_provisioning",
      "BIOS AI Boxed Lane",
      "Untrusted tool, skill, dependency, and connection work is blocked from host execution",
    ],
    "Phase 8 Settings runtime UI truth",
  );
  assertAllIncluded(
    runtimeUiTestSource,
    ["BIOS AI Boxed Lane", "Windows managed WSL2 adapter", "blocked from host execution"],
    "Phase 8 Settings runtime UI tests",
  );
  assertAllIncluded(
    runtimeStatusControllerSource,
    ["background_repair_queued", "will not change OS features"],
    "Phase 8 startup-silent boxed-lane background queue",
  );
  assertAllIncluded(
    profileUiSource,
    ["BIOS_DEFAULT_SAFETY_POSTURE", "BIOS_DEFAULT_SANDBOX_BACKEND"],
    "Phase 8 profile default UI",
  );
  assertAllIncluded(
    uxAuditServerSource,
    [
      "bios_boxed_lane_status",
      "bios_prepare_boxed_lane",
      "boxed_lane_provisioning",
      "Native boxed-lane hardened",
      "os_setup_started",
      "BIOS AI must provision its BIOS-managed WSL2 Linux substrate before host promotion.",
    ],
    "Phase 8 packaged UX fixture",
  );
  assertAllIncluded(
    uxSmokeSource,
    [
      "bios_prepare_boxed_lane",
      "background_repair_queued",
      "Repair And Verify Boxed Lane",
      "Latest repair attempt",
      "Boxed Lane Verifying",
      "State: needs_linux_distro",
    ],
    "Phase 8 packaged UX smoke",
  );
  assertAllIncluded(
    releaseSmokeSource,
    ["Phase 8 release gate", "bios-ai-phase8-release-gate.mjs"],
    "Phase 8 release smoke wiring",
  );
  assertAllIncluded(
    tauriConfigSource,
    ['"installMode": "both"', '"installerHooks": "installer-hooks/bios-ai-boxed-lane.nsh"'],
    "Phase 8 setup.exe boxed-lane ownership",
  );
  assertAllIncluded(
    installerHookSource,
    [
      "NSIS_HOOK_POSTINSTALL",
      "runtime_repair_available",
      "record_windows_boxed_lane_requirement",
      "wsl setup owned by BIOS AI runtime repair",
      "BIOS-owned single-flight Repair And Verify Boxed Lane flow",
      "installer-boxed-lane-status.json",
      "$INSTDIR\\installer-boxed-lane-status.json",
    ],
    "Phase 8 NSIS boxed-lane setup hook",
  );

  return {
    repoRoot: path.resolve(repoRoot),
    phase8ReleaseGate: "complete",
    packagedExeProof: buildIdentity.setupExePath,
    packagedStateSurfaces: packagedState.validatedSurfaces,
    packagedUxCoverage: uxSmoke.scenarios,
    nativeBackends: [
      "BIOS AI Boxed Lane",
      "Windows managed WSL2 adapter",
      "macOS Boxed Lane (Apple Virtualization Linux VM)",
      "Linux native container adapter",
    ],
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  verifyBiosAiPhase8ReleaseGate()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
