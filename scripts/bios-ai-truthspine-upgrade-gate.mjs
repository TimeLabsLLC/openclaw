import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

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
    `BIOS AI packaged UX smoke did not run required TruthSpine scenario: ${scenario}`,
  );
}

export async function verifyBiosAiTruthSpineUpgradeGate(repoRoot = resolveRepoRoot(), params = {}) {
  const buildIdentity =
    params.buildIdentity ??
    (await import("./bios-ai-build-identity.mjs")).verifyBiosAiBuildIdentity(repoRoot);
  const packagedState =
    params.packagedState ??
    (await import("./bios-ai-packaged-state-smoke.mjs")).smokeBiosAiPackagedState(repoRoot);
  const uxSmoke =
    params.uxSmoke ??
    (await import("./bios-ai-ux-smoke.mjs")).smokeBiosAiUx(
      repoRoot,
      params.uxParams ?? { scenarios: ["truthspine-session-update"] },
    );
  const buildIdentityResult = await buildIdentity;
  const packagedStateResult = await packagedState;
  const uxSmokeResult = await uxSmoke;
  const rustSource = await readRepoFile(
    repoRoot,
    "aether-canvas/src-tauri/src/bios_truth_spine.rs",
  );
  const libSource = await readRepoFile(repoRoot, "aether-canvas/src-tauri/src/lib.rs");
  const localPostureSource = await readRepoFile(
    repoRoot,
    "aether-canvas/js/runtime-transport/local-capability-posture.js",
  );
  const localSupervisorSource = await readRepoFile(
    repoRoot,
    "aether-canvas/js/runtime-transport/local-supervisor-transport.js",
  );
  const biosSurfaceSource = await readRepoFile(repoRoot, "aether-canvas/js/bios-surface-ui.js");
  const uxSmokeSource = await readRepoFile(repoRoot, "scripts/bios-ai-ux-smoke.mjs");
  const uxAuditServerSource = await readRepoFile(repoRoot, "scripts/bios-ai-ux-audit-server.mjs");
  const vitestConfigSource = await readRepoFile(repoRoot, "test/vitest/vitest.bios-ai.config.ts");

  assertCondition(
    buildIdentityResult.productName === "BIOS AI",
    "TruthSpine upgrade gate requires the BIOS AI product identity proof.",
  );
  assertCondition(
    String(buildIdentityResult.setupExePath || "").endsWith(".exe"),
    "TruthSpine upgrade gate requires packaged .exe proof.",
  );
  assertAllIncluded(
    packagedStateResult.validatedSurfaces,
    ["profiles", "memory-active-state", "provider-config", "profile-owned-worker-truth"],
    "BIOS AI packaged state smoke",
  );
  assertScenarioRan(uxSmokeResult, "truthspine-session-update");

  assertAllIncluded(
    rustSource,
    [
      "pub async fn record_bios_truth_session_update",
      "RecordBiosTruthSessionUpdateInput",
      "BiosTruthUsageSample",
      "truth_stage",
      "latest_usage",
      "brainstorm",
      "answer_guard",
      "truth_nudges",
      "readiness_gaps",
      "proof_moments",
      "advisory_signals",
      "build_readiness_gaps",
      "build_advisory_signals",
      "build_superseded_set",
      "build_stale_action_set",
      "truth_spine_builds_answer_guard_nudges_gaps_and_advisory_signals",
      "session_update_preserves_truth_stage_and_usage_without_promoting_brainstorm",
      "accepted_decision_supersedes_prior_same_subject_and_done_clears_next",
    ],
    "TruthSpine native runtime",
  );
  assertAllIncluded(
    libSource,
    ["bios_truth_spine::record_bios_truth_session_update"],
    "TruthSpine Tauri command registration",
  );
  assertAllIncluded(
    localSupervisorSource,
    ["record_bios_truth_session_update", 'type: "done"', "source_ref"],
    "TruthSpine real local supervisor runtime path",
  );
  assertCondition(
    !localSupervisorSource.includes('record_bios_truth_event", {\n    input: {\n      profile_id'),
    "Local supervisor must not keep the old single-event TruthSpine bypass path for chat turns.",
  );
  assertAllIncluded(
    localPostureSource,
    [
      "Candidate/question/exploration truth",
      "BOSS pre-answer operating-truth guard",
      "Readiness gaps",
      "Proof moments",
      "Advisory signals",
      "buildBiosAnswerGuard",
      "Stale action suppression",
      "Usage baseline",
      "token_savings_percent",
      "Compact BOSS operating truth",
    ],
    "TruthSpine prompt truth",
  );
  assertAllIncluded(
    biosSurfaceSource,
    [
      "BOSS Operating Truth",
      "Candidate truth is separate from accepted decisions.",
      "token savings with",
      "readiness gap",
      "proof moment",
      "advisory signal",
      "stale action",
    ],
    "internal TruthSpine user-facing operating-truth surface",
  );
  assertCondition(
    !biosSurfaceSource.includes("BOSS TruthSpine"),
    "BIOS surface must not expose TruthSpine as a user-facing subsystem.",
  );
  assertAllIncluded(
    uxSmokeSource,
    [
      "truthspine-session-update",
      "record_bios_truth_session_update",
      "88.83% token savings with measured confidence",
      "Candidate truth is separate from accepted decisions.",
      "BOSS Operating Truth",
      "must remain an internal BOSS mechanism",
    ],
    "TruthSpine packaged UX smoke",
  );
  assertAllIncluded(
    uxAuditServerSource,
    ["record_bios_truth_session_update", "latest_usage", "brainstorm"],
    "TruthSpine packaged UX fixture",
  );
  assertAllIncluded(
    vitestConfigSource,
    ["aether-canvas/js/**/*.test.js", 'environment: "jsdom"', 'name: "bios-ai"', "isolate: true"],
    "TruthSpine canonical BIOS JS proof config",
  );

  return {
    repoRoot: path.resolve(repoRoot),
    truthSpineUpgradeGate: "complete",
    packagedExeProof: buildIdentityResult.setupExePath,
    packagedStateSurfaces: packagedStateResult.validatedSurfaces,
    packagedUxCoverage: [
      "truthspine-session-update records candidate and accepted decision through Tauri",
      "B.I.O.S. surface shows measured operating-truth readiness, proof moments, gaps, and advisory signals without exposing TruthSpine as a user-facing subsystem",
    ],
    blockedBypassCoverage: [
      "local supervisor chat turns use record_bios_truth_session_update",
      "candidate/question/exploration truth stays out of active decisions",
      "stale NEXT/OPEN truth is suppressed from live next actions",
      "done/status/prior-plan prompts route through BOSS operating truth before answer",
      "proof gaps and advisory signals are visible to BOSS without turning into accepted truth",
      "standalone TruthSpine sidecar is not required for packaged runtime operation",
    ],
    canonicalTests: [
      "bios_truth_spine native Rust tests",
      "runtime-transport/client",
      "runtime-transport/local-capability-posture",
      "bios-surface-ui",
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
  const result = await verifyBiosAiTruthSpineUpgradeGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
