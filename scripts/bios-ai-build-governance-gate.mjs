import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verifyBiosAiNoVisibleTerminalGate } from "./bios-ai-no-visible-terminal-gate.mjs";
import { verifyBiosAiTauriReleasePathBlockGate } from "./bios-ai-tauri-release-path-block-gate.mjs";

const BIOS_LEDGER = "MASTER_DOCS/BIOS_AI_V1/BIOS_AI_FOUNDATION/bios_ai_strict_gap_ledger.md";
const FORGE_LEDGER = "MASTER_DOCS/BIOS_AI_V1/BIOS_AI_FOUNDATION/forge_arena_strict_gap_ledger.md";
const LIVE_RELEASE_PLAN =
  "MASTER_DOCS/BIOS_AI_V1/BIOS_AI_FOUNDATION/bios_ai_v1_live_release_completion_plan.md";
const POST_FOUNDATION_PLAN =
  "MASTER_DOCS/BIOS_AI_V1/BIOS_AI_FOUNDATION/bios_ai_post_foundation_execution_plan.md";
const GAP_AUDIT = "MASTER_DOCS/BIOS_AI_V1/BIOS_AI_FOUNDATION/bios_ai_gap_audit_2026_06_25.md";

const REQUIRED_LEDGER_FIELDS = [
  "Promised by docs",
  "Built in code",
  "Verified in app",
  "Missing",
  "Blocked",
  "Tests",
  "Packaged proof",
];

const REQUIRED_PROOF_BLOCK_FIELDS = [
  "What was built",
  "What exact files own it",
  "What tests passed",
  "What packaged-app behavior was verified",
  "What is still not done",
];

const REQUIRED_DONE_RULES = [
  "The feature exists in code",
  "wired into the real runtime path",
  "packaged app proves it when the change reaches a meaningful closure point",
  "UI explains it truthfully",
  "old bypass path is removed or blocked",
  "Tests cover the failure mode",
];

const REQUIRED_PROOF_CADENCE_RULES = [
  "Packaged app proof is required for phase/subsystem closeout",
  "Packaged app proof is not required after every tiny edit",
  "Run packaged proof when closing a vertical slice",
  "Do not rerun packaged proof only because a tiny copy-only or docs-only correction happened",
];

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

async function readRepoFile(repoRoot, relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function includesAll(source, needles) {
  return needles.filter((needle) => !source.includes(needle));
}

function parseProofBlocks(source) {
  const proofBlockRegex = /#### Proof Block(?: Status)?\n([\s\S]*?)(?=\n### |\n## |\n---\n|$)/g;
  const blocks = [];
  let match;
  while ((match = proofBlockRegex.exec(source)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

function summarizeCheck(name, missing = [], details = {}) {
  return {
    name,
    status: missing.length === 0 ? "pass" : "fail",
    missing,
    ...details,
  };
}

function assertPass(report) {
  const failed = report.checks.filter((check) => check.status !== "pass");
  if (failed.length === 0) {
    return;
  }
  const lines = failed.map((check) => `${check.name}: missing ${check.missing.join(", ")}`);
  throw new Error(`BIOS AI build governance gate failed:\n${lines.join("\n")}`);
}

async function writeReportFiles(repoRoot, report, params = {}) {
  const outputDir = path.join(repoRoot, "runtime", "outputs");
  await mkdir(outputDir, { recursive: true });
  const jsonPath = params.jsonPath ?? path.join(outputDir, "bios-ai-build-governance-report.json");
  const markdownPath =
    params.markdownPath ?? path.join(outputDir, "bios-ai-build-governance-report.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderMarkdownReport(report), "utf8");
  return {
    jsonPath,
    markdownPath,
  };
}

function renderMarkdownReport(report) {
  const lines = [
    "# BIOS AI Build Governance Report",
    "",
    `Status: ${report.status}`,
    "",
    "## Checks",
    "",
  ];
  for (const check of report.checks) {
    lines.push(`- ${check.status === "pass" ? "PASS" : "FAIL"} ${check.name}`);
    if (check.missing.length > 0) {
      lines.push(`  - Missing: ${check.missing.join(", ")}`);
    }
  }
  lines.push(
    "",
    "## Next",
    "",
    "- Continue boxed-lane setup/provisioning and live B.A.Bs flow proof as the next vertical slice.",
    "- Do not mark BIOS AI V1 done until the live release plan and strict ledger agree.",
    "",
  );
  return `${lines.join("\n")}\n`;
}

export async function verifyBiosAiBuildGovernanceGate(repoRoot = resolveRepoRoot(), params = {}) {
  const files = {
    biosLedger: await readRepoFile(repoRoot, BIOS_LEDGER),
    forgeLedger: await readRepoFile(repoRoot, FORGE_LEDGER),
    liveReleasePlan: await readRepoFile(repoRoot, LIVE_RELEASE_PLAN),
    postFoundationPlan: await readRepoFile(repoRoot, POST_FOUNDATION_PLAN),
    gapAudit: await readRepoFile(repoRoot, GAP_AUDIT),
  };

  const biosProofBlocks = parseProofBlocks(files.biosLedger);
  const forgeProofBlocks = parseProofBlocks(files.forgeLedger);
  const latestBiosProofBlock = biosProofBlocks.at(-1) ?? "";
  const latestForgeProofBlock = forgeProofBlocks.at(-1) ?? "";
  const noVisibleTerminalGate =
    params.noVisibleTerminalGate ?? verifyBiosAiNoVisibleTerminalGate(repoRoot);
  const tauriReleasePathBlockGate =
    params.tauriReleasePathBlockGate ??
    (await verifyBiosAiTauriReleasePathBlockGate(repoRoot, { throwOnFailure: false }));

  const checks = [
    summarizeCheck(
      "BIOS strict ledger tracks required gap fields",
      includesAll(files.biosLedger, REQUIRED_LEDGER_FIELDS),
      { file: BIOS_LEDGER },
    ),
    summarizeCheck(
      "Forge strict ledger tracks required gap fields",
      includesAll(files.forgeLedger, REQUIRED_LEDGER_FIELDS),
      { file: FORGE_LEDGER },
    ),
    summarizeCheck(
      "Live release plan locks strict done rules",
      includesAll(files.liveReleasePlan, REQUIRED_DONE_RULES),
      { file: LIVE_RELEASE_PLAN },
    ),
    summarizeCheck(
      "Build plans lock package proof cadence",
      includesAll(`${files.liveReleasePlan}\n${files.postFoundationPlan}`, REQUIRED_PROOF_CADENCE_RULES),
      { file: `${LIVE_RELEASE_PLAN}, ${POST_FOUNDATION_PLAN}` },
    ),
    summarizeCheck(
      "Post-foundation plan requires vertical slices and bypass blocking",
      includesAll(files.postFoundationPlan, [
        "contract, backend owner, frontend surface, persistence, tests, and proof",
        "old bypass path is removed or explicitly blocked",
        "one live gap ledger",
      ]),
      { file: POST_FOUNDATION_PLAN },
    ),
    summarizeCheck(
      "Latest BIOS proof block has required closeout fields",
      includesAll(latestBiosProofBlock, REQUIRED_PROOF_BLOCK_FIELDS),
      { file: BIOS_LEDGER, proofBlockCount: biosProofBlocks.length },
    ),
    summarizeCheck(
      "Latest Forge proof block has required closeout fields",
      includesAll(latestForgeProofBlock, REQUIRED_PROOF_BLOCK_FIELDS),
      { file: FORGE_LEDGER, proofBlockCount: forgeProofBlocks.length },
    ),
    summarizeCheck(
      "Gap audit names current next vertical slice",
      includesAll(files.gapAudit, [
        "boxed-lane setup/provisioning path",
        "live installed B.A.Bs flow",
        "BIOS AI is not finished for a V1 live-release claim yet",
      ]),
      { file: GAP_AUDIT },
    ),
    summarizeCheck(
      "BIOS AI runtime blocks visible terminal process launches",
      noVisibleTerminalGate.status === "verified"
        ? []
        : [`no-visible-terminal gate ${noVisibleTerminalGate.status}`],
      {
        file: "scripts/bios-ai-no-visible-terminal-gate.mjs",
        findings: noVisibleTerminalGate.findings ?? [],
      },
    ),
    summarizeCheck(
      "BIOS AI release proof blocks the old Tauri package path",
      tauriReleasePathBlockGate.status === "pass"
        ? []
        : [`Tauri release path block gate ${tauriReleasePathBlockGate.status}`],
      {
        file: "scripts/bios-ai-tauri-release-path-block-gate.mjs",
        findings: tauriReleasePathBlockGate.checks ?? [],
      },
    ),
  ];

  const report = {
    repoRoot: path.resolve(repoRoot),
    generatedAt: new Date().toISOString(),
    status: checks.every((check) => check.status === "pass") ? "pass" : "fail",
    owner: "scripts/bios-ai-build-governance-gate.mjs",
    governedFiles: [
      BIOS_LEDGER,
      FORGE_LEDGER,
      LIVE_RELEASE_PLAN,
      POST_FOUNDATION_PLAN,
      GAP_AUDIT,
      "scripts/bios-ai-no-visible-terminal-gate.mjs",
      "scripts/bios-ai-tauri-release-path-block-gate.mjs",
    ],
    ruleSet: {
      ownerDiscipline:
        "Use existing subsystem owners first; create new modules only for real subsystem, platform adapter, persistence boundary, or tested public contract ownership.",
      definitionOfDone:
        "Code, runtime wiring, persistence, truthful UI, bypass blocking, tests for original failure, package proof at meaningful closure points, and proof block.",
      verticalSlice:
        "contract -> backend/runtime owner -> persistence -> frontend/user surface -> tests -> package proof when closing the slice -> proof block.",
      proofCadence:
        "Use targeted gates during edit loops; run packaged proof for closure, release, installer, app shell, packaged resource, sidecar/runtime wiring, and visible packaged flow claims.",
      ledger:
        "One live gap ledger with promised, built, verified, missing, blocked, tests, and packaged proof.",
      splitBrain:
        "Do not call a subsystem done while old and new paths can silently bypass each other.",
    },
    checks,
  };

  if (params.writeReport !== false) {
    report.outputs = await writeReportFiles(repoRoot, report, params);
  }
  if (params.throwOnFailure !== false) {
    assertPass(report);
  }
  return report;
}

function isMainModule() {
  const argv1 = process.argv[1];
  if (!argv1) {
    return false;
  }
  return import.meta.url === pathToFileURL(argv1).href;
}

if (isMainModule()) {
  const result = await verifyBiosAiBuildGovernanceGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
