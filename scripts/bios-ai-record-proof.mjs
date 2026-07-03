#!/usr/bin/env node
import process from "node:process";
import {
  createBuildProofPayload,
  exportBiosProofBundle,
  loadBiosProofSummary,
  recordBiosProofEvent,
  verifyBiosProofSpine,
} from "./bios-ai-proof-spine.mjs";

function usage() {
  return `Usage:
  node scripts/bios-ai-record-proof.mjs record --profile <id> --event <type> --source <source> --summary <text> [--tag <tag>] [--payload-json <json>]
  node scripts/bios-ai-record-proof.mjs export-bundle --profile <id> --context <context> [--event-type <event>] [--record-id <id>] [--output-dir <path>]
  node scripts/bios-ai-record-proof.mjs verify --profile <id>
  node scripts/bios-ai-record-proof.mjs summary --profile <id>

Common build payload fields:
  --phase <phase> --ledger-ref <path-or-row> --command <cmd> --exit-code <n> --duration-ms <n> --file <path> --next-action <text> --output-excerpt <text>`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const parsed = { command, tags: [], files: [], eventTypes: [], recordIds: [] };
  if (command === "--help" || command === "-h") {
    return { ...parsed, help: true };
  }
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    const value = rest[index + 1];
    switch (arg) {
      case "--profile":
        parsed.profile = value;
        index += 1;
        break;
      case "--event":
        parsed.event = value;
        index += 1;
        break;
      case "--source":
        parsed.source = value;
        index += 1;
        break;
      case "--summary":
        parsed.summary = value;
        index += 1;
        break;
      case "--visibility":
        parsed.visibility = value;
        index += 1;
        break;
      case "--tag":
        parsed.tags.push(value);
        index += 1;
        break;
      case "--payload-json":
        parsed.payloadJson = value;
        index += 1;
        break;
      case "--phase":
        parsed.phase = value;
        index += 1;
        break;
      case "--ledger-ref":
        parsed.ledgerRef = value;
        index += 1;
        break;
      case "--command":
        parsed.proofCommand = value;
        index += 1;
        break;
      case "--exit-code":
        parsed.exitCode = Number(value);
        index += 1;
        break;
      case "--duration-ms":
        parsed.durationMs = Number(value);
        index += 1;
        break;
      case "--file":
        parsed.files.push(value);
        index += 1;
        break;
      case "--next-action":
        parsed.nextAction = value;
        index += 1;
        break;
      case "--output-excerpt":
        parsed.outputExcerpt = value;
        index += 1;
        break;
      case "--subsystem":
        parsed.subsystem = value;
        index += 1;
        break;
      case "--context":
        parsed.context = value;
        index += 1;
        break;
      case "--event-type":
        parsed.eventTypes.push(value);
        index += 1;
        break;
      case "--record-id":
        parsed.recordIds.push(value);
        index += 1;
        break;
      case "--output-dir":
        parsed.outputDir = value;
        index += 1;
        break;
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function buildPayload(parsed) {
  if (parsed.payloadJson) {
    return JSON.parse(parsed.payloadJson);
  }
  return createBuildProofPayload({
    command: parsed.proofCommand,
    durationMs: parsed.durationMs,
    exitCode: parsed.exitCode,
    files: parsed.files,
    ledgerRef: parsed.ledgerRef,
    nextAction: parsed.nextAction,
    outputExcerpt: parsed.outputExcerpt,
    phase: parsed.phase,
    subsystem: parsed.subsystem,
  });
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help || !parsed.command) {
    console.log(usage());
    return;
  }
  if (parsed.command === "record") {
    const record = recordBiosProofEvent({
      profileId: parsed.profile,
      eventType: parsed.event,
      source: parsed.source,
      summary: parsed.summary,
      tags: parsed.tags,
      visibility: parsed.visibility,
      payloadRedacted: buildPayload(parsed),
    });
    console.log(JSON.stringify(record, null, 2));
    return;
  }
  if (parsed.command === "export-bundle") {
    console.log(
      JSON.stringify(
        exportBiosProofBundle({
          profileId: parsed.profile,
          context: parsed.context,
          eventTypes: parsed.eventTypes,
          recordIds: parsed.recordIds,
          outputDir: parsed.outputDir,
        }),
        null,
        2,
      ),
    );
    return;
  }
  if (parsed.command === "verify") {
    console.log(JSON.stringify(verifyBiosProofSpine(parsed.profile), null, 2));
    return;
  }
  if (parsed.command === "summary") {
    console.log(JSON.stringify(loadBiosProofSummary(parsed.profile), null, 2));
    return;
  }
  throw new Error(`Unknown BIOS proof command: ${parsed.command}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(usage());
  process.exitCode = 1;
}
