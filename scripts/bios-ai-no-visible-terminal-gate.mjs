import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

const RUNTIME_OWNERS = [
  "aether-canvas/src-tauri/src/llm.rs",
  "aether-canvas/src-tauri/src/bios_runtime.rs",
  "aether-canvas/src-tauri/src/discovery.rs",
];

const REQUIRED_HIDDEN_WRAPPERS = {
  "aether-canvas/src-tauri/src/llm.rs": "local_worker_command_output",
  "aether-canvas/src-tauri/src/bios_runtime.rs": "command_output",
  "aether-canvas/src-tauri/src/discovery.rs": "command_output",
};

function lineNumberFor(source, offset) {
  return source.slice(0, offset).split(/\r?\n/u).length;
}

function findRawCommandOutputCalls(relativePath, source) {
  const findings = [];
  const outputCallPattern = /\.output\(\)/gu;
  let match;
  while ((match = outputCallPattern.exec(source)) !== null) {
    const line = lineNumberFor(source, match.index);
    const start = Math.max(0, match.index - 240);
    const prefix = source.slice(start, match.index);
    const inWrapper =
      prefix.includes(`fn ${REQUIRED_HIDDEN_WRAPPERS[relativePath]}`) ||
      prefix.includes("command.creation_flags(CREATE_NO_WINDOW)");
    if (!inWrapper) {
      findings.push({
        file: relativePath,
        line,
        reason: "raw_command_output",
      });
    }
  }
  return findings;
}

function findMissingWindowsNoWindowConstant(relativePath, source) {
  const findings = [];
  if (!source.includes("Command::new")) {
    return findings;
  }
  if (!source.includes("CREATE_NO_WINDOW")) {
    findings.push({
      file: relativePath,
      line: 1,
      reason: "missing_create_no_window_constant",
    });
  }
  return findings;
}

export function analyzeBiosAiVisibleTerminalRisk(repoRoot = resolveRepoRoot()) {
  const findings = [];
  for (const relativePath of RUNTIME_OWNERS) {
    const absolutePath = path.join(repoRoot, relativePath);
    const source = fs.readFileSync(absolutePath, "utf8");
    findings.push(...findMissingWindowsNoWindowConstant(relativePath, source));
    findings.push(...findRawCommandOutputCalls(relativePath, source));
  }

  return {
    status: findings.length ? "blocked" : "verified",
    checkedFiles: RUNTIME_OWNERS,
    findings,
  };
}

export function verifyBiosAiNoVisibleTerminalGate(repoRoot = resolveRepoRoot()) {
  const analysis = analyzeBiosAiVisibleTerminalRisk(repoRoot);
  if (analysis.findings.length) {
    const details = analysis.findings
      .map((finding) => `${finding.file}:${finding.line} ${finding.reason}`)
      .join(", ");
    throw new Error(`BIOS AI visible-terminal gate blocked runtime process launch risk: ${details}`);
  }
  return analysis;
}

function isMainModule() {
  const argv1 = process.argv[1];
  return Boolean(argv1 && import.meta.url === pathToFileURL(argv1).href);
}

if (isMainModule()) {
  const result = verifyBiosAiNoVisibleTerminalGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
