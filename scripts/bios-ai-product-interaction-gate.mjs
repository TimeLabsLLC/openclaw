import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const PRESSABLE_CLASSES = [
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

const STATE_SELECTORS = [
  ".rail-btn.active",
  ".toggle-btn.on",
  ".settings-profile-chip.is-active",
  ".bios-profile-picker.is-active",
  ".forge-entry-card-action.is-active",
  ".forge-arena-action-btn.is-active",
  "[aria-pressed=\"true\"]",
  "[aria-selected=\"true\"]",
];

const PRIMARY_SURFACE_FORBIDDEN_TEXT = [
  "Debug Log File",
  "Boxed Lane Substrate",
  "Native Boxed Substrate",
  "Local Runtime",
  "Save Settings",
  "Electron bridge",
  "IPC",
  "Tauri",
];

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unique(values) {
  return [...new Set(values)];
}

function buttonClassLists(html) {
  const buttons = [];
  const buttonPattern = /<button\b([^>]*)>/gi;
  let match;
  while ((match = buttonPattern.exec(html))) {
    const attrs = match[1] || "";
    const id = attrs.match(/\bid="([^"]+)"/i)?.[1] || null;
    const classValue = attrs.match(/\bclass="([^"]+)"/i)?.[1] || "";
    const classes = classValue.split(/\s+/).filter(Boolean);
    buttons.push({ id, classes, source: match[0].slice(0, 240) });
  }
  return buttons;
}

function hasSelector(css, selector) {
  return css.includes(selector);
}

function hasClassState(css, className, state) {
  const escaped = escapeRegExp(className);
  return new RegExp(`\\.${escaped}(?:[^,{]*)${escapeRegExp(state)}`).test(css);
}

function coveredByPressableClass(classes) {
  return classes.find((className) => PRESSABLE_CLASSES.includes(className)) || null;
}

function forbiddenPrimarySurfaceText(html) {
  return PRIMARY_SURFACE_FORBIDDEN_TEXT.filter((text) => html.includes(text));
}

export async function verifyBiosAiProductInteractionGate(repoRoot = resolveRepoRoot(), params = {}) {
  const normalizedRoot = path.resolve(repoRoot);
  const html = await readFile(path.join(normalizedRoot, "aether-canvas", "index.html"), "utf8");
  const designSystemCss = await readFile(
    path.join(normalizedRoot, "aether-canvas", "css", "design-system.css"),
    "utf8",
  );
  const layoutCss = await readFile(path.join(normalizedRoot, "aether-canvas", "css", "layout.css"), "utf8");
  const css = `${designSystemCss}\n${layoutCss}`;
  const buttons = buttonClassLists(html);
  const uncoveredButtons = buttons.filter((button) => !coveredByPressableClass(button.classes));
  const missingClassStates = [];
  for (const className of PRESSABLE_CLASSES) {
    for (const state of [":hover", ":active", ":disabled", ":focus-visible"]) {
      if (!hasClassState(css, className, state)) {
        missingClassStates.push({ className, state });
      }
    }
  }
  const missingStateSelectors = STATE_SELECTORS.filter((selector) => !hasSelector(css, selector));
  const forbiddenSurfaceText = forbiddenPrimarySurfaceText(html);
  const report = {
    generatedAt: new Date().toISOString(),
    status:
      uncoveredButtons.length === 0 &&
      missingClassStates.length === 0 &&
      missingStateSelectors.length === 0 &&
      forbiddenSurfaceText.length === 0
        ? "pass"
        : "blocked",
    owner: "scripts/bios-ai-product-interaction-gate.mjs",
    target: "bios-ai",
    surface: "consumer product interaction contract",
    promised:
      "Every clickable BIOS AI button surface must have uniform hover, focus, pressed, disabled, and selected/active feedback, and primary product surfaces must keep internal support terms out of normal labels.",
    buttonCount: buttons.length,
    pressableClasses: PRESSABLE_CLASSES,
    forbiddenPrimarySurfaceText,
    checks: [
      {
        name: "Every button in aether-canvas/index.html uses a governed pressable class",
        status: uncoveredButtons.length === 0 ? "pass" : "fail",
        failures: uncoveredButtons,
      },
      {
        name: "Every governed pressable class has hover, active, disabled, and focus-visible CSS",
        status: missingClassStates.length === 0 ? "pass" : "fail",
        failures: missingClassStates,
      },
      {
        name: "Active/selected/pressed surfaces have visible selected-state CSS",
        status: missingStateSelectors.length === 0 ? "pass" : "fail",
        failures: missingStateSelectors,
      },
      {
        name: "Primary product surfaces avoid internal support-language labels",
        status: forbiddenSurfaceText.length === 0 ? "pass" : "fail",
        failures: forbiddenSurfaceText,
      },
    ],
  };
  if (params.writeReport !== false) {
    const outputPath = path.join(normalizedRoot, "runtime", "outputs", "bios-ai-product-interaction-gate.json");
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    report.outputPath = outputPath;
  }
  if (params.throwOnFailure !== false && report.status !== "pass") {
    const failures = report.checks
      .filter((check) => check.status !== "pass")
      .map((check) => `${check.name}: ${JSON.stringify(check.failures)}`)
      .join("\n");
    throw new Error(`BIOS AI product interaction gate failed:\n${failures}`);
  }
  return report;
}

function isMainModule() {
  const argv1 = process.argv[1];
  return Boolean(argv1) && import.meta.url === pathToFileURL(argv1).href;
}

if (isMainModule()) {
  const result = await verifyBiosAiProductInteractionGate();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
