import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verifyBiosAiBuildIdentity } from "./bios-ai-build-identity.mjs";
import { smokeBiosAiPackagedState } from "./bios-ai-packaged-state-smoke.mjs";
import { smokeBiosAiUx } from "./bios-ai-ux-smoke.mjs";
import { verifyBiosAiWindowsRegistrationProof } from "./bios-ai-windows-registration-proof.mjs";

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

function assertScenariosRan(uxSmoke, scenarios) {
  for (const scenario of scenarios) {
    assertCondition(
      Array.isArray(uxSmoke.scenarios) && uxSmoke.scenarios.includes(scenario),
      `User-flow reality gate did not run required packaged UX scenario: ${scenario}`,
    );
  }
}

export const BIOS_AI_USER_FLOW_REALITY_SCENARIOS = [
  "managed-runtime-entry",
  "hybrid-managed-runtime-install",
  "resume-managed-runtime-setup",
  "profile-lifecycle-control-plane",
  "settings-control-plane",
  "sandbox-promotion-lifecycle",
  "forge-arena-local-proving-ground",
  "diagnostics-recovery-surface",
  "delete-last-profile-reopens-onboarding",
];

export async function verifyBiosAiUserFlowRealityGate(repoRoot = resolveRepoRoot(), params = {}) {
  const buildIdentity = params.buildIdentity ?? (await verifyBiosAiBuildIdentity(repoRoot));
  const windowsRegistrationProof =
    params.windowsRegistrationProof ??
    (await verifyBiosAiWindowsRegistrationProof(repoRoot, { buildIdentity }));
  const packagedState = params.packagedState ?? (await smokeBiosAiPackagedState(repoRoot));
  const uxSmoke =
    params.uxSmoke ??
    (await smokeBiosAiUx(
      repoRoot,
      params.uxParams ?? {
        scenarios: BIOS_AI_USER_FLOW_REALITY_SCENARIOS,
      },
    ));
  const uxSmokeSource = await readRepoFile(repoRoot, "scripts/bios-ai-ux-smoke.mjs");
  const releaseSmokeCmdSource = await readRepoFile(repoRoot, "scripts/bios-ai-release-smoke.cmd");
  const releaseSmokePsSource = await readRepoFile(repoRoot, "scripts/bios-ai-release-smoke.ps1");
  const windowsRegistrationProofSource = await readRepoFile(
    repoRoot,
    "scripts/bios-ai-windows-registration-proof.mjs",
  );
  const designSystemSource = await readRepoFile(repoRoot, "aether-canvas/css/design-system.css");
  const layoutSource = await readRepoFile(repoRoot, "aether-canvas/css/layout.css");
  const productDesignContractSource = await readRepoFile(
    repoRoot,
    "MASTER_DOCS/BIOS_AI_V1/BIOS AI_UI/BIOS_AI_FORGE_ARENA_PRODUCT_DESIGN_CONTRACT.md",
  );
  const sandboxControllerTestSource = await readRepoFile(
    repoRoot,
    "aether-canvas/js/sandbox-lanes/controller.test.js",
  );

  assertCondition(
    buildIdentity.productName === "BIOS AI",
    "User-flow reality gate requires BIOS AI build identity proof.",
  );
  assertCondition(
    String(buildIdentity.setupExePath || "").endsWith(".exe"),
    "User-flow reality gate requires packaged installer proof.",
  );
  assertAllIncluded(
    packagedState.validatedSurfaces,
    ["logs", "profiles", "worker-selection", "connector-bindings", "legacy-model-fallback-blocked"],
    "User-flow reality packaged state smoke",
  );
  assertScenariosRan(uxSmoke, BIOS_AI_USER_FLOW_REALITY_SCENARIOS);

  assertAllIncluded(
    uxSmokeSource,
    [
      "clickButtonByText",
      "waitForSelectorText",
      "window.localStorage.clear()",
      "smokeManagedRuntimeEntry",
      "smokeHybridManagedRuntimeInstall",
      "smokeResumeManagedRuntimeSetup",
      "smokeProfileLifecycleControlPlane",
      "smokeSettingsControlPlane",
      "smokeSandboxPromotionLifecycle",
      'page.click("#settings-prepare-boxed-lane")',
      "Latest repair attempt",
      "background_repair_queued",
      'prepareResult?.action_taken === "background_repair_queued"',
      "smokeForgeArenaLocalProvingGround",
      "smokeDiagnosticsRecoverySurface",
      "smokeDeleteLastProfileReopensOnboarding",
    ],
    "User-flow reality packaged UX smoke",
  );
  assertAllIncluded(
    sandboxControllerTestSource,
    [
      "keeps the manual repair result visible after runtime refresh rerenders settings",
      "Latest repair attempt: Boxed-lane setup started",
    ],
    "User-flow reality regression tests",
  );
  assertAllIncluded(
    designSystemSource,
    [
      "--pressable-hover-y",
      "--pressable-hover-scale",
      "--pressable-active-scale",
      "button:not(:disabled):hover",
      ".settings-action-btn:not(:disabled):hover",
      ".forge-cta-primary:not(:disabled):hover",
      "[data-approval-action]:not(:disabled):active",
      "@media (prefers-reduced-motion: reduce)",
    ],
    "User-flow reality global pressable interaction system",
  );
  assertAllIncluded(
    layoutSource,
    [
      "translateX(-1px) translateY(var(--pressable-hover-y))",
      ".forge-cta-primary:hover",
      ".conv-action:hover",
      "var(--pressable-hover-shadow)",
      "font-size: clamp(34px, 4vw, 56px)",
      ".forge-run-monitor-head",
      "grid-template-columns: minmax(0, 1fr) auto",
      ".forge-poster-card.is-selected::before",
      "position: absolute",
    ],
    "User-flow reality layout pressable interaction overrides",
  );
  assertAllIncluded(
    productDesignContractSource,
    [
      "Make BIOS AI and Forge Arena feel like a polished customer product",
      "No global yellow warning banner may permanently cover or crop primary app content.",
      "Settings must separate user choices from internal system diagnostics.",
      "Forge Arena is a full page, not a drawer, popup, or right-side panel.",
      "Use `aether-canvas/assets/forge-arena/season-zero-concept.png` as the style anchor",
    ],
    "BIOS AI and Forge Arena approved product design contract",
  );
  assertAllIncluded(
    releaseSmokeCmdSource,
    [
      "Windows app registration proof",
      "bios-ai-windows-registration-proof.mjs",
      "User-flow reality release gate",
      "bios-ai-user-flow-reality-gate.mjs",
    ],
    "Windows cmd release smoke user-flow wiring",
  );
  assertAllIncluded(
    releaseSmokePsSource,
    [
      "Windows app registration proof",
      "bios-ai-windows-registration-proof.mjs",
      "User-flow reality release gate",
      "bios-ai-user-flow-reality-gate.mjs",
    ],
    "Windows PowerShell release smoke user-flow wiring",
  );
  assertAllIncluded(
    windowsRegistrationProofSource,
    [
      "bios-ai-installer-smoke",
      "forbiddenTargets",
      "currentInstallTargets",
      "splitBrainTargets",
      "BIOS AI Windows registration points at a stale development or smoke target",
      "BIOS AI Windows registration has multiple installed app targets",
    ],
    "Windows registered app target proof",
  );

  return {
    repoRoot: path.resolve(repoRoot),
    userFlowRealityGate: "complete",
    packagedExeProof: buildIdentity.setupExePath,
    windowsRegistrationProof: windowsRegistrationProof.windowsRegistrationProof,
    packagedStateSurfaces: packagedState.validatedSurfaces,
    packagedUxCoverage: BIOS_AI_USER_FLOW_REALITY_SCENARIOS,
    realUserFlowContracts: [
      "visible user controls are clicked instead of only calling backend commands",
      "state is checked after rerender or runtime refresh",
      "profile/onboarding flows prove persistence and reopen behavior",
      "model install/reuse flows prove progress and route text",
      "settings flows prove saved choices and connector state",
      "boxed-lane repair proves visible latest repair status",
      "button-like surfaces share hover raise/grow and press feedback",
      "Forge Arena flows prove action buttons mutate visible state",
      "diagnostics flows prove blocked runtime states stay visible",
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
  const result = await verifyBiosAiUserFlowRealityGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
