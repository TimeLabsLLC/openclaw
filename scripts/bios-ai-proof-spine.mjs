import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const BIOS_PROOF_SPINE_VERSION = "bios-proof-spine-v1";
export const BIOS_PROOF_LOCAL_ONLY_ANCHOR_POLICY = "local_only";
export const BIOS_HOME_OVERRIDE_ENV = "BIOS_AI_HOME_OVERRIDE";

function assertNonEmpty(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`BIOS proof records require ${label}.`);
  }
  return value.trim();
}

function jsonStringLiteral(value) {
  return JSON.stringify(value);
}

export function canonicalJson(value) {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  switch (typeof value) {
    case "boolean":
      return String(value);
    case "number":
      if (!Number.isFinite(value)) {
        throw new Error("BIOS proof canonical JSON does not support non-finite numbers.");
      }
      return JSON.stringify(value);
    case "string":
      return jsonStringLiteral(value);
    case "object": {
      const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
      return `{${entries
        .map(([key, entryValue]) => `${jsonStringLiteral(key)}:${canonicalJson(entryValue)}`)
        .join(",")}}`;
    }
    default:
      throw new Error(`BIOS proof canonical JSON cannot encode ${typeof value}.`);
  }
}

export function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function proofHashForValue(value) {
  return sha256Hex(canonicalJson(value));
}

export function resolveBiosProofHome(env = process.env, homeDir = os.homedir()) {
  const override = env[BIOS_HOME_OVERRIDE_ENV];
  if (typeof override === "string" && override.trim().length > 0) {
    return path.resolve(override.trim());
  }
  return path.resolve(homeDir);
}

export function resolveBiosProofLogPath(profileId, options = {}) {
  const resolvedProfileId = assertNonEmpty(profileId, "a BOSS profile id");
  const home = resolveBiosProofHome(options.env, options.homeDir);
  return path.join(
    home,
    ".agentos",
    "bios-ai",
    "profiles",
    resolvedProfileId,
    "runtime",
    "proof-spine",
    "records.jsonl",
  );
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function normalizeVisibility(value) {
  switch (String(value || "private").trim().toLowerCase()) {
    case "public":
      return "public";
    case "shared":
      return "shared";
    case "internal":
      return "internal";
    default:
      return "private";
  }
}

function unsignedRecordValue(record) {
  const { record_hash: _recordHash, ...unsigned } = record;
  return unsigned;
}

export function recordHash(record) {
  return proofHashForValue(unsignedRecordValue(record));
}

export function readBiosProofRecords(profileId, options = {}) {
  const logPath = resolveBiosProofLogPath(profileId, options);
  if (!fs.existsSync(logPath)) {
    return [];
  }
  const raw = fs.readFileSync(logPath, "utf8");
  return raw
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function merkleRootForHashes(hashes) {
  if (hashes.length === 0) {
    return null;
  }
  let level = hashes.slice();
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] || left;
      next.push(sha256Hex(`${left}${right}`));
    }
    level = next;
  }
  return level[0] || null;
}

function merkleProofPathForIndex(hashes, index) {
  if (hashes.length <= 1 || index < 0 || index >= hashes.length) {
    return [];
  }
  const proofPath = [];
  let level = hashes.slice();
  let currentIndex = index;
  while (level.length > 1) {
    const isLeft = currentIndex % 2 === 0;
    const siblingIndex = isLeft ? currentIndex + 1 : currentIndex - 1;
    proofPath.push({
      position: isLeft ? "right" : "left",
      hash: level[siblingIndex] || level[currentIndex],
    });
    const next = [];
    for (let pairIndex = 0; pairIndex < level.length; pairIndex += 2) {
      const left = level[pairIndex];
      const right = level[pairIndex + 1] || left;
      next.push(sha256Hex(`${left}${right}`));
    }
    currentIndex = Math.floor(currentIndex / 2);
    level = next;
  }
  return proofPath;
}

function sanitizeBundleContext(value) {
  const normalized = String(value || "general")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "");
  return normalized || "general";
}

function jsonContainsSecretLikeValue(value) {
  if (typeof value === "string") {
    const normalized = value.trim();
    const lower = normalized.toLowerCase();
    return (
      normalized.startsWith("sk-") ||
      normalized.startsWith("ghp_") ||
      normalized.startsWith("ghu_") ||
      normalized.startsWith("xoxb-") ||
      lower.includes("api_key=") ||
      lower.includes("authorization: bearer")
    );
  }
  if (Array.isArray(value)) {
    return value.some((entry) => jsonContainsSecretLikeValue(entry));
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((entry) => jsonContainsSecretLikeValue(entry));
  }
  return false;
}

function writeJsonPretty(filePath, value) {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256File(filePath) {
  return sha256Hex(fs.readFileSync(filePath));
}

function defaultBundleDir(profileId, batchId, options = {}) {
  const logPath = resolveBiosProofLogPath(profileId, options);
  return path.join(path.dirname(logPath), "bundles", batchId);
}

function writeVerificationInstructions(filePath, bundle) {
  ensureParentDir(filePath);
  fs.writeFileSync(
    filePath,
    `# BIOS AI Proof Bundle Verification

Profile: \`${bundle.profile_id}\`

Context: \`${bundle.context}\`

Batch: \`${bundle.batch_id}\`

Record count: \`${bundle.record_count}\`

Merkle root: \`${bundle.merkle_root || "none"}\`

This local bundle contains redacted BIOS AI proof records, inclusion proof paths, and a checksum manifest.

To review it manually:

1. Read \`manifest.json\` for batch metadata and selected record hashes.
2. Read \`records.json\` for the redacted records included in this bundle.
3. Read \`inclusion-proofs.json\` to see each record's Merkle sibling path.
4. Compare the SHA-256 hashes in \`checksums.json\` with the exported files before trusting the bundle.

This bundle is local-only. It was not anchored to a hosted TimeProof service or blockchain by BIOS AI V1.
`,
    "utf8",
  );
}

export function exportBiosProofBundle(input, options = {}) {
  const profileId = assertNonEmpty(input?.profileId, "a BOSS profile id");
  const context = sanitizeBundleContext(input?.context);
  const recordIds = new Set(
    Array.isArray(input?.recordIds)
      ? input.recordIds.map((value) => String(value).trim()).filter(Boolean)
      : [],
  );
  const eventTypes = new Set(
    Array.isArray(input?.eventTypes)
      ? input.eventTypes.map((value) => String(value).trim()).filter(Boolean)
      : [],
  );
  const selectedRecords = readBiosProofRecords(profileId, options).filter((record) => {
    const recordMatch = recordIds.size === 0 || recordIds.has(record.record_id);
    const eventMatch = eventTypes.size === 0 || eventTypes.has(record.event_type);
    return recordMatch && eventMatch;
  });
  if (selectedRecords.length === 0) {
    throw new Error("No BIOS proof records matched that bundle export request.");
  }
  if (selectedRecords.some((record) => jsonContainsSecretLikeValue(record.payload_redacted))) {
    throw new Error(
      "BIOS proof bundle export refused a record with secret-like redacted payload text.",
    );
  }
  const recordHashes = selectedRecords.map((record) => record.record_hash);
  const merkleRoot = merkleRootForHashes(recordHashes);
  const batchId = `bios-proof-bundle-${proofHashForValue({
    profile_id: profileId,
    context,
    record_hashes: recordHashes,
    merkle_root: merkleRoot,
  }).slice(0, 16)}`;
  const bundleDir = input?.outputDir
    ? path.resolve(String(input.outputDir))
    : defaultBundleDir(profileId, batchId, options);
  fs.mkdirSync(bundleDir, { recursive: true });

  const inclusionProofs = selectedRecords.map((record, index) => ({
    record_id: record.record_id,
    record_hash: record.record_hash,
    proof_path: merkleProofPathForIndex(recordHashes, index),
  }));
  const manifest = {
    version: BIOS_PROOF_SPINE_VERSION,
    bundle_type: "bios-proof-bundle-v1",
    profile_id: profileId,
    context,
    batch_id: batchId,
    record_count: selectedRecords.length,
    record_hashes: recordHashes,
    merkle_root: merkleRoot,
    anchor_policy: BIOS_PROOF_LOCAL_ONLY_ANCHOR_POLICY,
    hosted_anchor: null,
    standalone_verifier: "future_work",
  };

  const manifestPath = path.join(bundleDir, "manifest.json");
  const recordsPath = path.join(bundleDir, "records.json");
  const inclusionProofsPath = path.join(bundleDir, "inclusion-proofs.json");
  const instructionsPath = path.join(bundleDir, "VERIFY.md");
  const checksumsPath = path.join(bundleDir, "checksums.json");
  writeJsonPretty(manifestPath, manifest);
  writeJsonPretty(recordsPath, selectedRecords);
  writeJsonPretty(inclusionProofsPath, inclusionProofs);
  writeVerificationInstructions(instructionsPath, manifest);

  const checksums = Object.fromEntries(
    [
      ["manifest.json", manifestPath],
      ["records.json", recordsPath],
      ["inclusion-proofs.json", inclusionProofsPath],
      ["VERIFY.md", instructionsPath],
    ].map(([fileName, filePath]) => [fileName, sha256File(filePath)]),
  );
  writeJsonPretty(checksumsPath, checksums);

  return {
    profile_id: profileId,
    context,
    batch_id: batchId,
    record_count: selectedRecords.length,
    merkle_root: merkleRoot,
    bundle_dir: bundleDir,
    manifest_path: manifestPath,
    records_path: recordsPath,
    inclusion_proofs_path: inclusionProofsPath,
    checksums_path: checksumsPath,
    instructions_path: instructionsPath,
    checksums,
  };
}

export function createBuildProofPayload(input = {}) {
  return {
    command: input.command || null,
    cwd: input.cwd ? path.resolve(input.cwd) : process.cwd(),
    duration_ms: Number.isFinite(input.durationMs) ? input.durationMs : null,
    exit_code: Number.isInteger(input.exitCode) ? input.exitCode : null,
    files: Array.isArray(input.files) ? input.files.slice().sort() : [],
    ledger_ref: input.ledgerRef || null,
    next_action: input.nextAction || null,
    output_excerpt: input.outputExcerpt || null,
    phase: input.phase || null,
    subsystem: input.subsystem || null,
  };
}

export function recordBiosProofEvent(input, options = {}) {
  const profileId = assertNonEmpty(input?.profileId, "a BOSS profile id");
  const eventType = assertNonEmpty(input?.eventType, "an event type");
  const source = assertNonEmpty(input?.source, "a source");
  const summary = assertNonEmpty(input?.summary, "a summary");
  const records = readBiosProofRecords(profileId, options);
  const previousHash = records.at(-1)?.record_hash || null;
  const timestamp = String(input.timestamp || Math.floor(Date.now() / 1000));
  const payloadRedacted = input.payloadRedacted ?? null;
  const record = {
    version: BIOS_PROOF_SPINE_VERSION,
    record_id: `${profileId}-${eventType}-${timestamp}-${records.length + 1}`,
    profile_id: profileId,
    event_type: eventType,
    source,
    summary,
    timestamp,
    tags: Array.isArray(input.tags) ? input.tags.slice() : [],
    visibility: normalizeVisibility(input.visibility),
    anchor_policy: BIOS_PROOF_LOCAL_ONLY_ANCHOR_POLICY,
    payload_hash: proofHashForValue(payloadRedacted),
    payload_redacted: payloadRedacted,
    previous_hash: previousHash,
    record_hash: "",
  };
  record.record_hash = recordHash(record);

  const logPath = resolveBiosProofLogPath(profileId, options);
  ensureParentDir(logPath);
  fs.appendFileSync(logPath, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export function verifyBiosProofSpine(profileId, options = {}) {
  const records = readBiosProofRecords(profileId, options);
  const issues = [];
  let previousHash = null;
  records.forEach((record, index) => {
    const line = index + 1;
    const expectedPayloadHash = proofHashForValue(record.payload_redacted);
    if (record.payload_hash !== expectedPayloadHash) {
      issues.push({
        line,
        code: "payload_hash_mismatch",
        message: "The payload hash no longer matches the redacted payload.",
      });
    }
    if ((record.previous_hash || null) !== previousHash) {
      issues.push({
        line,
        code: "parent_hash_mismatch",
        message: "The record does not point at the previous record hash.",
      });
    }
    const expectedRecordHash = recordHash(record);
    if (record.record_hash !== expectedRecordHash) {
      issues.push({
        line,
        code: "record_hash_mismatch",
        message: "The record hash no longer matches the canonical unsigned record.",
      });
    }
    if (record.anchor_policy !== BIOS_PROOF_LOCAL_ONLY_ANCHOR_POLICY) {
      issues.push({
        line,
        code: "unexpected_anchor_policy",
        message: "V1 BIOS proof records must stay local-only.",
      });
    }
    previousHash = record.record_hash;
  });
  const hashes = records.map((record) => record.record_hash);
  return {
    profile_id: assertNonEmpty(profileId, "a BOSS profile id"),
    valid: issues.length === 0,
    record_count: records.length,
    latest_record_hash: records.at(-1)?.record_hash || null,
    merkle_root: merkleRootForHashes(hashes),
    issues,
  };
}

export function loadBiosProofSummary(profileId, options = {}) {
  const records = readBiosProofRecords(profileId, options);
  const hashes = records.map((record) => record.record_hash);
  return {
    profile_id: assertNonEmpty(profileId, "a BOSS profile id"),
    record_count: records.length,
    latest_record_hash: records.at(-1)?.record_hash || null,
    merkle_root: merkleRootForHashes(hashes),
    proof_log_path: resolveBiosProofLogPath(profileId, options),
    recent_records: records.slice(-10),
  };
}
