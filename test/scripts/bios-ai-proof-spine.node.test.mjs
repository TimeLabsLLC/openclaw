import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  BIOS_HOME_OVERRIDE_ENV,
  canonicalJson,
  createBuildProofPayload,
  exportBiosProofBundle,
  loadBiosProofSummary,
  proofHashForValue,
  recordBiosProofEvent,
  resolveBiosProofLogPath,
  sha256Hex,
  verifyBiosProofSpine,
} from "../../scripts/bios-ai-proof-spine.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempRoots = [];

function makeTempHome(label) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), `bios-ai-proof-${label}-`));
  tempRoots.push(home);
  return home;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("BIOS AI build proof spine", () => {
  it("uses stable canonical hashes for redacted payloads", () => {
    const left = { b: 2, a: { d: 4, c: 3 } };
    const right = { a: { c: 3, d: 4 }, b: 2 };

    assert.equal(canonicalJson(left), canonicalJson(right));
    assert.equal(proofHashForValue(left), proofHashForValue(right));
  });

  it("records failed smoke, passed test, and phase checkpoint records as a local-only chain", () => {
    const home = makeTempHome("chain");
    const options = { env: { [BIOS_HOME_OVERRIDE_ENV]: home } };

    const failedSmoke = recordBiosProofEvent(
      {
        profileId: "build",
        eventType: "smoke_failed",
        source: "scripts/bios-ai-ux-smoke.mjs",
        summary: "UX smoke failed while proving Phase 0C resume truth.",
        tags: ["phase_0c", "smoke", "failed"],
        payloadRedacted: createBuildProofPayload({
          command: "node scripts/bios-ai-ux-smoke.mjs",
          exitCode: 1,
          files: ["scripts/bios-ai-ux-smoke.mjs"],
          ledgerRef: "BIOS_AI_FOUNDATION/bios_ai_strict_gap_ledger.md#TimeProof-records-spine",
          nextAction: "Fix the failing smoke scenario before closing the phase.",
          outputExcerpt: "Expected local proof record but found none.",
          phase: "0C",
          subsystem: "TimeProof records spine",
        }),
      },
      options,
    );

    const passedTest = recordBiosProofEvent(
      {
        profileId: "build",
        eventType: "test_passed",
        source: "test/scripts/bios-ai-proof-spine.node.test.mjs",
        summary: "Targeted BIOS AI proof-spine script tests passed.",
        tags: ["phase_0c", "test", "passed"],
        payloadRedacted: createBuildProofPayload({
          command: "node --test test/scripts/bios-ai-proof-spine.node.test.mjs",
          exitCode: 0,
          files: [
            "scripts/bios-ai-proof-spine.mjs",
            "scripts/bios-ai-record-proof.mjs",
            "test/scripts/bios-ai-proof-spine.node.test.mjs",
          ],
          ledgerRef: "BIOS_AI_FOUNDATION/bios_ai_strict_gap_ledger.md#TimeProof-records-spine",
          phase: "0C",
          subsystem: "TimeProof records spine",
        }),
      },
      options,
    );

    const checkpoint = recordBiosProofEvent(
      {
        profileId: "build",
        eventType: "phase_checkpointed",
        source: "bios_ai_post_foundation_execution_plan.md",
        summary: "Phase 0C checkpoint linked to the strict gap ledger.",
        tags: ["phase_0c", "ledger", "checkpoint"],
        payloadRedacted: createBuildProofPayload({
          files: ["MASTER_DOCS/BIOS_AI_V1/BIOS_AI_FOUNDATION/bios_ai_strict_gap_ledger.md"],
          ledgerRef: "BIOS_AI_FOUNDATION/bios_ai_strict_gap_ledger.md#Active-Phase-0C",
          phase: "0C",
          subsystem: "TimeProof records spine",
        }),
      },
      options,
    );

    assert.equal(failedSmoke.anchor_policy, "local_only");
    assert.equal(passedTest.previous_hash, failedSmoke.record_hash);
    assert.equal(checkpoint.previous_hash, passedTest.record_hash);

    const report = verifyBiosProofSpine("build", options);
    assert.equal(report.valid, true);
    assert.equal(report.record_count, 3);
    assert.equal(report.latest_record_hash, checkpoint.record_hash);
    assert.equal(typeof report.merkle_root, "string");

    const summary = loadBiosProofSummary("build", options);
    assert.deepEqual(
      summary.recent_records.map((record) => record.event_type),
      ["smoke_failed", "test_passed", "phase_checkpointed"],
    );
  });

  it("detects tampering in build proof records", () => {
    const home = makeTempHome("tamper");
    const options = { env: { [BIOS_HOME_OVERRIDE_ENV]: home } };
    recordBiosProofEvent(
      {
        profileId: "build",
        eventType: "phase_started",
        source: "phase-runner",
        summary: "Phase 0C started.",
        payloadRedacted: { phase: "0C" },
      },
      options,
    );

    const logPath = resolveBiosProofLogPath("build", options);
    fs.writeFileSync(logPath, fs.readFileSync(logPath, "utf8").replace("Phase 0C", "Phase XX"));

    const report = verifyBiosProofSpine("build", options);
    assert.equal(report.valid, false);
    assert.equal(
      report.issues.some((issue) => issue.code === "record_hash_mismatch"),
      true,
    );
  });

  it("lets the CLI write and verify proof records in the managed BIOS root", () => {
    const home = makeTempHome("cli");
    const env = { ...process.env, [BIOS_HOME_OVERRIDE_ENV]: home };

    const output = execFileSync(
      process.execPath,
      [
        "scripts/bios-ai-record-proof.mjs",
        "record",
        "--profile",
        "build",
        "--event",
        "test_passed",
        "--source",
        "node:test",
        "--summary",
        "CLI proof record created.",
        "--tag",
        "phase_0c",
        "--phase",
        "0C",
        "--ledger-ref",
        "BIOS_AI_FOUNDATION/bios_ai_strict_gap_ledger.md#TimeProof-records-spine",
        "--command",
        "node --test test/scripts/bios-ai-proof-spine.node.test.mjs",
        "--exit-code",
        "0",
      ],
      { cwd: repoRoot, env, encoding: "utf8" },
    );
    const record = JSON.parse(output);
    assert.equal(record.event_type, "test_passed");

    const verifyOutput = execFileSync(
      process.execPath,
      ["scripts/bios-ai-record-proof.mjs", "verify", "--profile", "build"],
      { cwd: repoRoot, env, encoding: "utf8" },
    );
    assert.deepEqual(JSON.parse(verifyOutput), {
      profile_id: "build",
      valid: true,
      record_count: 1,
      latest_record_hash: record.record_hash,
      merkle_root: record.record_hash,
      issues: [],
    });
  });

  it("exports local proof bundles with inclusion paths, checksums, and instructions", () => {
    const home = makeTempHome("bundle");
    const options = { env: { [BIOS_HOME_OVERRIDE_ENV]: home } };
    recordBiosProofEvent(
      {
        profileId: "build",
        eventType: "test_passed",
        source: "node:test",
        summary: "First bundled proof.",
        payloadRedacted: { safe: "summary only" },
      },
      options,
    );
    recordBiosProofEvent(
      {
        profileId: "build",
        eventType: "phase_closed",
        source: "phase.closeout",
        summary: "Second bundled proof.",
        payloadRedacted: { next_action: "continue" },
      },
      options,
    );

    const bundle = exportBiosProofBundle(
      {
        profileId: "build",
        context: "Build Proof",
        eventTypes: ["test_passed", "phase_closed"],
      },
      options,
    );

    assert.equal(bundle.context, "build-proof");
    assert.equal(bundle.record_count, 2);
    assert.equal(typeof bundle.merkle_root, "string");
    assert.equal(fs.existsSync(bundle.manifest_path), true);
    assert.equal(fs.existsSync(bundle.records_path), true);
    assert.equal(fs.existsSync(bundle.inclusion_proofs_path), true);
    assert.equal(fs.existsSync(bundle.checksums_path), true);
    assert.equal(fs.existsSync(bundle.instructions_path), true);
    assert.equal(typeof bundle.checksums["records.json"], "string");

    const inclusionProofs = JSON.parse(fs.readFileSync(bundle.inclusion_proofs_path, "utf8"));
    assert.equal(inclusionProofs.length, 2);
    assert.equal(inclusionProofs[0].proof_path.length > 0, true);

    fs.writeFileSync(bundle.records_path, "tampered", "utf8");
    assert.notEqual(
      sha256Hex(fs.readFileSync(bundle.records_path, "utf8")),
      bundle.checksums["records.json"],
    );
  });

  it("lets the CLI export a proof bundle", () => {
    const home = makeTempHome("cli-bundle");
    const env = { ...process.env, [BIOS_HOME_OVERRIDE_ENV]: home };
    execFileSync(
      process.execPath,
      [
        "scripts/bios-ai-record-proof.mjs",
        "record",
        "--profile",
        "build",
        "--event",
        "test_passed",
        "--source",
        "node:test",
        "--summary",
        "CLI bundle source record.",
      ],
      { cwd: repoRoot, env, encoding: "utf8" },
    );

    const output = execFileSync(
      process.execPath,
      [
        "scripts/bios-ai-record-proof.mjs",
        "export-bundle",
        "--profile",
        "build",
        "--context",
        "Build Proof",
        "--event-type",
        "test_passed",
      ],
      { cwd: repoRoot, env, encoding: "utf8" },
    );
    const bundle = JSON.parse(output);
    assert.equal(bundle.record_count, 1);
    assert.equal(fs.existsSync(bundle.checksums_path), true);
    assert.equal(fs.readFileSync(bundle.instructions_path, "utf8").includes("local-only"), true);
  });
});
