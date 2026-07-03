import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { verifyBiosAiBuildGovernanceGate } from "../../scripts/bios-ai-build-governance-gate.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function writeFixtureFile(root, relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

function compliantLedger(title = "BIOS AI Strict Gap Ledger") {
  return `# ${title}

## Definition Of Done

- **Promised by docs:** tracked
- **Built in code:** tracked
- **Verified in app:** tracked
- **Missing:** tracked
- **Blocked:** tracked
- **Tests:** tracked
- **Packaged proof:** tracked

### Example Slice

- **Promised by docs:** promised
- **Built in code:** built
- **Verified in app:** verified
- **Missing:** nothing
- **Blocked:** none
- **Tests:** tests
- **Packaged proof:** package proof

#### Proof Block

- **What was built:** build governance
- **What exact files own it:** scripts/bios-ai-build-governance-gate.mjs
- **What tests passed:** node --test test/scripts/bios-ai-build-governance-gate.node.test.mjs
- **What packaged-app behavior was verified:** release smoke invokes governance gate
- **What is still not done:** package proof not run in this fixture
`;
}

const liveReleasePlan = `# BIOS AI V1 Live Release Completion Plan

The feature exists in code.
The feature is wired into the real runtime path.
The packaged app proves it when the change reaches a meaningful closure point.
The UI explains it truthfully.
The old bypass path is removed or blocked.
Tests cover the failure mode that previously slipped through.
Packaged app proof is required for phase/subsystem closeout.
Packaged app proof is not required after every tiny edit.
`;

const postFoundationPlan = `# BIOS AI Post-Foundation Execution Plan

Every slice must include contract, backend owner, frontend surface, persistence, tests, and proof.
The old bypass path is removed or explicitly blocked.
Maintain one live gap ledger.
Run packaged proof when closing a vertical slice.
Do not rerun packaged proof only because a tiny copy-only or docs-only correction happened.
`;

const gapAudit = `# BIOS AI Gap Audit

BIOS AI is not finished for a V1 live-release claim yet.
Next work is the boxed-lane setup/provisioning path.
Then run the live installed B.A.Bs flow.
`;

async function makeFixture({
  forgeLedger = compliantLedger("Forge Arena Strict Gap Ledger"),
} = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "bios-ai-build-governance-"));
  const base = "MASTER_DOCS/BIOS_AI_V1/BIOS_AI_FOUNDATION";
  await writeFixtureFile(root, `${base}/bios_ai_strict_gap_ledger.md`, compliantLedger());
  await writeFixtureFile(root, `${base}/forge_arena_strict_gap_ledger.md`, forgeLedger);
  await writeFixtureFile(
    root,
    `${base}/bios_ai_v1_live_release_completion_plan.md`,
    liveReleasePlan,
  );
  await writeFixtureFile(
    root,
    `${base}/bios_ai_post_foundation_execution_plan.md`,
    postFoundationPlan,
  );
  await writeFixtureFile(root, `${base}/bios_ai_gap_audit_2026_06_25.md`, gapAudit);
  return root;
}

describe("BIOS AI build governance gate", () => {
  it("passes when ledgers, plans, gap audit, and proof blocks include the required contract", async () => {
    const root = await makeFixture();
    const report = await verifyBiosAiBuildGovernanceGate(root, {
      noVisibleTerminalGate: { status: "verified", findings: [] },
      tauriReleasePathBlockGate: { status: "pass", checks: [] },
      writeReport: false,
    });

    assert.equal(report.status, "pass");
    assert.equal(report.owner, "scripts/bios-ai-build-governance-gate.mjs");
    assert.ok(
      report.checks.some(
        (check) => check.name === "Latest BIOS proof block has required closeout fields",
      ),
    );
  });

  it("fails when a latest proof block omits package-proof closeout truth", async () => {
    const brokenForgeLedger = compliantLedger("Forge Arena Strict Gap Ledger").replace(
      "- **What packaged-app behavior was verified:** release smoke invokes governance gate\n",
      "",
    );
    const root = await makeFixture({ forgeLedger: brokenForgeLedger });

    await assert.rejects(
      () =>
        verifyBiosAiBuildGovernanceGate(root, {
          noVisibleTerminalGate: { status: "verified", findings: [] },
          tauriReleasePathBlockGate: { status: "pass", checks: [] },
          writeReport: false,
        }),
      /Latest Forge proof block has required closeout fields/,
    );
  });

  it("fails when the no-visible-terminal runtime gate finds a visible launch risk", async () => {
    const root = await makeFixture();

    await assert.rejects(
      () =>
        verifyBiosAiBuildGovernanceGate(root, {
          noVisibleTerminalGate: {
            status: "blocked",
            findings: [
              {
                file: "aether-canvas/src-tauri/src/llm.rs",
                reason: "Raw .output() call can show a Windows console window.",
              },
            ],
          },
          tauriReleasePathBlockGate: { status: "pass", checks: [] },
          writeReport: false,
        }),
      /BIOS AI runtime blocks visible terminal process launches/,
    );
  });

  it("is wired into package and release verification surfaces", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
    const releaseSmokeSource = await readFile(
      path.join(repoRoot, "scripts/bios-ai-release-smoke.mjs"),
      "utf8",
    );

    assert.equal(
      packageJson.scripts["bios-ai:build-governance"],
      "node scripts/bios-ai-build-governance-gate.mjs",
    );
    assert.match(releaseSmokeSource, /verifyBiosAiBuildGovernanceGate/);
    assert.match(releaseSmokeSource, /buildGovernanceGate/);
  });
});
