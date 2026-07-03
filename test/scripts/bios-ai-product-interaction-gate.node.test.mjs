import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { verifyBiosAiProductInteractionGate } from "../../scripts/bios-ai-product-interaction-gate.mjs";

async function fixtureRepo({ buttonClass = "btn-primary", omitFocus = false, bodyText = "" } = {}) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "bios-ai-product-interaction-"));
  await mkdir(path.join(repoRoot, "aether-canvas", "css"), { recursive: true });
  await writeFile(
    path.join(repoRoot, "aether-canvas", "index.html"),
    `<button id="primary" class="${buttonClass}" type="button">Run</button>${bodyText}`,
  );
  const classes = [
    "btn",
    "btn-primary",
    "btn-secondary",
    "btn-ghost",
    "btn-icon",
    "toggle-btn",
    "settings-action-btn",
    "settings-danger-btn",
    "settings-profile-chip",
    "bios-profile-picker",
    "chat-send",
    "rail-btn",
    "workflow-run-btn",
    "forge-cta-primary",
    "forge-cta-secondary",
    "forge-entry-card-action",
    "forge-arena-action-btn",
    "bios-soul-approve-btn",
    "bios-soul-reject-btn",
  ];
  const css = [
    classes.map((className) => `.${className}:hover { transform: translateY(-2px); }`).join("\n"),
    classes.map((className) => `.${className}:active { transform: scale(.98); }`).join("\n"),
    classes.map((className) => `.${className}:disabled { cursor: not-allowed; }`).join("\n"),
    omitFocus ? "" : classes.map((className) => `.${className}:focus-visible { outline: 2px solid green; }`).join("\n"),
    ".rail-btn.active {}",
    ".toggle-btn.on {}",
    ".settings-profile-chip.is-active {}",
    ".bios-profile-picker.is-active {}",
    ".forge-entry-card-action.is-active {}",
    ".forge-arena-action-btn.is-active {}",
    "[aria-pressed=\"true\"] {}",
    "[aria-selected=\"true\"] {}",
  ].join("\n");
  await writeFile(path.join(repoRoot, "aether-canvas", "css", "design-system.css"), css);
  await writeFile(path.join(repoRoot, "aether-canvas", "css", "layout.css"), "");
  return repoRoot;
}

describe("BIOS AI product interaction gate", () => {
  it("passes when every button has a governed pressable class and all states exist", async () => {
    const repoRoot = await fixtureRepo();
    const report = await verifyBiosAiProductInteractionGate(repoRoot, { writeReport: false });
    assert.equal(report.status, "pass");
    assert.equal(report.buttonCount, 1);
  });

  it("blocks buttons without a governed pressable class", async () => {
    const repoRoot = await fixtureRepo({ buttonClass: "unknown-button" });
    await assert.rejects(
      verifyBiosAiProductInteractionGate(repoRoot, { writeReport: false }),
      /Every button/,
    );
  });

  it("blocks governed classes that lack focus-visible proof", async () => {
    const repoRoot = await fixtureRepo({ omitFocus: true });
    await assert.rejects(
      verifyBiosAiProductInteractionGate(repoRoot, { writeReport: false }),
      /focus-visible/,
    );
  });

  it("blocks internal support language on primary product surfaces", async () => {
    const repoRoot = await fixtureRepo({ bodyText: "<p>Debug Log File</p>" });
    await assert.rejects(
      verifyBiosAiProductInteractionGate(repoRoot, { writeReport: false }),
      /internal support-language labels/,
    );
  });
});
