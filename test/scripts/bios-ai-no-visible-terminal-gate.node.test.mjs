import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  analyzeBiosAiVisibleTerminalRisk,
  verifyBiosAiNoVisibleTerminalGate,
} from "../../scripts/bios-ai-no-visible-terminal-gate.mjs";

function writeRuntimeOwner(root, relativePath, source) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, source);
}

function writeMinimalOwners(root, llmSource) {
  writeRuntimeOwner(root, "aether-canvas/src-tauri/src/llm.rs", llmSource);
  for (const relativePath of [
    "aether-canvas/src-tauri/src/bios_runtime.rs",
    "aether-canvas/src-tauri/src/discovery.rs",
  ]) {
    writeRuntimeOwner(
      root,
      relativePath,
      [
        "use std::process::Command;",
        "const CREATE_NO_WINDOW: u32 = 0x08000000;",
        "fn command_output(command: &mut Command) {",
        "  command.creation_flags(CREATE_NO_WINDOW);",
        "  command.output();",
        "}",
      ].join("\n"),
    );
  }
}

describe("BIOS AI no visible terminal gate", () => {
  it("blocks raw command output in runtime owners", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bios-ai-terminal-risk-"));
    writeMinimalOwners(
      root,
      [
        "use std::process::Command;",
        "const CREATE_NO_WINDOW: u32 = 0x08000000;",
        "fn local_worker_acceleration_status_for_path() {",
        "  Command::new(\"llama-server.exe\").arg(\"--list-devices\").output();",
        "}",
      ].join("\n"),
    );

    const analysis = analyzeBiosAiVisibleTerminalRisk(root);

    assert.equal(analysis.status, "blocked");
    assert.deepEqual(analysis.findings, [
      {
        file: "aether-canvas/src-tauri/src/llm.rs",
        line: 4,
        reason: "raw_command_output",
      },
    ]);
  });

  it("accepts hidden command output wrappers", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bios-ai-terminal-safe-"));
    writeMinimalOwners(
      root,
      [
        "use std::process::Command;",
        "const CREATE_NO_WINDOW: u32 = 0x08000000;",
        "fn local_worker_command_output(command: &mut Command) {",
        "  command.creation_flags(CREATE_NO_WINDOW);",
        "  command.output();",
        "}",
        "fn local_worker_acceleration_status_for_path() {",
        "  let mut command = Command::new(\"llama-server.exe\");",
        "  command.arg(\"--list-devices\");",
        "  local_worker_command_output(&mut command);",
        "}",
      ].join("\n"),
    );

    const analysis = verifyBiosAiNoVisibleTerminalGate(root);

    assert.equal(analysis.status, "verified");
    assert.deepEqual(analysis.findings, []);
  });
});
