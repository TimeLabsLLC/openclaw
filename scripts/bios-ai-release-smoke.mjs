import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verifyBiosAiBuildGovernanceGate } from "./bios-ai-build-governance-gate.mjs";
import { verifyBiosAiBuildIdentity } from "./bios-ai-build-identity.mjs";
import { verifyBiosAiElectronInstallerArtifactGate } from "./bios-ai-electron-installer-artifact-gate.mjs";
import { verifyBiosAiElectronLiveBossGenerationGate } from "./bios-ai-electron-live-boss-generation-gate.mjs";
import { verifyBiosAiElectronPackageArtifactGate } from "./bios-ai-electron-package-artifact-gate.mjs";
import { verifyBiosAiElectronProductFlowGate } from "./bios-ai-electron-product-flow-gate.mjs";
import { verifyBiosAiElectronRuntimePackageGate } from "./bios-ai-electron-runtime-package-gate.mjs";
import { verifyBiosAiForgeCommunityResponseGate } from "./bios-ai-forge-community-response-gate.mjs";
import { verifyBiosAiForgeConnectedIdentityGate } from "./bios-ai-forge-connected-identity-gate.mjs";
import { verifyBiosAiForgeGovernanceGate } from "./bios-ai-forge-governance-gate.mjs";
import { verifyBiosAiForgeLocalProvingGate } from "./bios-ai-forge-local-proving-gate.mjs";
import { verifyBiosAiForgeOfficialSeasonGate } from "./bios-ai-forge-official-season-gate.mjs";
import { verifyBiosAiForgeStudyLineageGate } from "./bios-ai-forge-study-lineage-gate.mjs";
import { verifyBiosAiMajorBossSystemTestGate } from "./bios-ai-major-boss-system-test-gate.mjs";
import { smokeBiosAiPackagedState } from "./bios-ai-packaged-state-smoke.mjs";
import { verifyBiosAiPhase13ReleaseGate } from "./bios-ai-phase13-release-gate.mjs";
import { verifyBiosAiPhase14ReleaseGate } from "./bios-ai-phase14-release-gate.mjs";
import { verifyBiosAiPhase15ReleaseGate } from "./bios-ai-phase15-release-gate.mjs";
import { verifyBiosAiProductInteractionGate } from "./bios-ai-product-interaction-gate.mjs";
import { verifyBiosAiTruthSpineUpgradeGate } from "./bios-ai-truthspine-upgrade-gate.mjs";
import { verifyBiosAiTauriReleasePathBlockGate } from "./bios-ai-tauri-release-path-block-gate.mjs";
import { smokeBiosAiUx } from "./bios-ai-ux-smoke.mjs";

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

function resolveVitestCliCommand(repoRoot) {
  return path.join(repoRoot, "node_modules", "vitest", "vitest.mjs");
}

function resolveWindowsPowerShellCommand(command, args = []) {
  const escaped = [command, ...args].map((value) => `'${String(value).replaceAll("'", "''")}'`);
  return {
    command: "powershell.exe",
    args: ["-NoProfile", "-Command", `& ${escaped.join(" ")}`],
  };
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      windowsHide: false,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(`Command failed with exit code ${code ?? -1}: ${command} ${args.join(" ")}`),
      );
    });
  });
}

const BIOS_VITEST_FILES = [
  "aether-canvas/js/app.chat-actions.test.js",
  "aether-canvas/js/app.shell-actions.test.js",
  "aether-canvas/js/app-action-feedback.test.js",
  "aether-canvas/js/app.bootstrap-actions.test.js",
  "aether-canvas/js/bios-runtime.test.js",
  "aether-canvas/js/bios-runtime-status-ui.test.js",
  "aether-canvas/js/bios-surface-ui.test.js",
  "aether-canvas/js/bios-shell-state.test.js",
  "aether-canvas/js/boss-model-governor.test.js",
  "aether-canvas/js/boss-profiles/profile-storage.test.js",
  "aether-canvas/js/forge-arena-service.test.js",
  "aether-canvas/js/app.forge-actions.test.js",
  "aether-canvas/js/app.forge-profile.test.js",
  "aether-canvas/js/onboarding-route-copy.test.js",
  "aether-canvas/js/runtime-transport/client.test.js",
  "aether-canvas/js/runtime-transport/local-capability-posture.test.js",
  "aether-canvas/js/runtime-status/controller.test.js",
  "aether-canvas/js/runtime-status/status-overview.test.js",
  "aether-canvas/js/shell-summary.test.js",
];

export async function smokeBiosAiRelease(repoRoot = resolveRepoRoot(), params = {}) {
  if (process.platform === "win32" && params.allowWindowsNodeOrchestration !== true) {
    throw new Error(
      "Use scripts\\bios-ai-release-smoke.cmd on Windows. The nested Node Vitest lane is intentionally blocked because it flakes on worker startup in this environment.",
    );
  }
  const runCommandImpl = params.runCommand ?? runCommand;
  const vitestFiles = params.vitestFiles ?? BIOS_VITEST_FILES;
  await runCommandImpl(
    process.execPath,
    [path.join("aether-canvas", "scripts", "prepare-dist.mjs")],
    repoRoot,
  );
  for (const testFile of vitestFiles) {
    const vitestArgs = [
      resolveVitestCliCommand(repoRoot),
      "run",
      "--pool=forks",
      "--maxWorkers=1",
      "--config",
      path.join("test", "vitest", "vitest.bios-ai.config.ts"),
      testFile,
    ];
    if (process.platform === "win32") {
      const { command, args } = resolveWindowsPowerShellCommand(process.execPath, vitestArgs);
      await runCommandImpl(command, args, repoRoot);
    } else {
      await runCommandImpl(process.execPath, vitestArgs, repoRoot);
    }
  }
  const buildIdentity = await verifyBiosAiBuildIdentity(repoRoot);
  const tauriReleasePathBlockGate = await verifyBiosAiTauriReleasePathBlockGate(repoRoot, {
    buildIdentity,
  });
  const packagedState = await smokeBiosAiPackagedState(repoRoot);
  const uxSmoke = await smokeBiosAiUx(repoRoot, params.uxParams ?? {});
  const productInteractionGate = await verifyBiosAiProductInteractionGate(repoRoot);
  const phase13ReleaseGate = await verifyBiosAiPhase13ReleaseGate(repoRoot, {
    buildIdentity,
    tauriReleasePathBlockGate,
    packagedState,
  });
  const phase14ReleaseGate = await verifyBiosAiPhase14ReleaseGate(repoRoot, {
    buildIdentity,
    packagedState,
    uxSmoke,
  });
  const phase15ReleaseGate = await verifyBiosAiPhase15ReleaseGate(repoRoot, {
    buildIdentity,
    packagedState,
    uxSmoke,
  });
  const truthSpineUpgradeGate = await verifyBiosAiTruthSpineUpgradeGate(repoRoot, {
    buildIdentity,
    packagedState,
    uxSmoke,
  });
  const forgeArenaLocalProvingGate = await verifyBiosAiForgeLocalProvingGate(repoRoot, {
    buildIdentity,
    packagedState,
    uxSmoke,
  });
  const forgeArenaConnectedIdentityGate = await verifyBiosAiForgeConnectedIdentityGate(repoRoot, {
    buildIdentity,
    packagedState,
    uxSmoke,
  });
  const forgeArenaOfficialSeasonGate = await verifyBiosAiForgeOfficialSeasonGate(repoRoot, {
    buildIdentity,
    packagedState,
    uxSmoke,
  });
  const forgeArenaGovernanceGate = await verifyBiosAiForgeGovernanceGate(repoRoot, {
    buildIdentity,
    packagedState,
    uxSmoke,
  });
  const forgeArenaCommunityResponseGate = await verifyBiosAiForgeCommunityResponseGate(repoRoot, {
    buildIdentity,
    packagedState,
    uxSmoke,
  });
  const forgeArenaStudyLineageGate = await verifyBiosAiForgeStudyLineageGate(repoRoot, {
    buildIdentity,
    packagedState,
    uxSmoke,
  });
  const majorBossSystemTestGate = await verifyBiosAiMajorBossSystemTestGate(repoRoot, {
    buildIdentity,
    packagedState,
    uxSmoke,
  });
  const electronRuntimePackageGate =
    params.skipElectronPackageProof === true
      ? { status: "skipped", reason: "skipElectronPackageProof" }
      : await verifyBiosAiElectronRuntimePackageGate(repoRoot);
  const electronPackageArtifactGate =
    params.skipElectronPackageProof === true
      ? { status: "skipped", reason: "skipElectronPackageProof" }
      : await verifyBiosAiElectronPackageArtifactGate(repoRoot);
  const electronInstallerArtifactGate =
    params.skipElectronPackageProof === true
      ? { status: "skipped", reason: "skipElectronPackageProof" }
      : await verifyBiosAiElectronInstallerArtifactGate(repoRoot);
  const electronProductFlowGate =
    params.skipElectronPackageProof === true
      ? { status: "skipped", reason: "skipElectronPackageProof" }
      : await verifyBiosAiElectronProductFlowGate(repoRoot);
  const electronLiveBossGenerationGate =
    params.skipElectronLiveBossProof === true
      ? { status: "skipped", reason: "skipElectronLiveBossProof" }
      : await verifyBiosAiElectronLiveBossGenerationGate(repoRoot, {
          env: { ...process.env, BIOS_AI_ELECTRON_LIVE_BOSS_PROOF: "1" },
        });
  const buildGovernanceGate = await verifyBiosAiBuildGovernanceGate(repoRoot);
  return {
    repoRoot,
    buildIdentity,
    packagedState,
    uxSmoke,
    productInteractionGate,
    phase13ReleaseGate,
    phase14ReleaseGate,
    phase15ReleaseGate,
    truthSpineUpgradeGate,
    forgeArenaLocalProvingGate,
    forgeArenaConnectedIdentityGate,
    forgeArenaOfficialSeasonGate,
    forgeArenaGovernanceGate,
    forgeArenaCommunityResponseGate,
    forgeArenaStudyLineageGate,
    majorBossSystemTestGate,
    electronRuntimePackageGate,
    electronPackageArtifactGate,
    electronInstallerArtifactGate,
    electronProductFlowGate,
    electronLiveBossGenerationGate,
    buildGovernanceGate,
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
  const result = await smokeBiosAiRelease();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
