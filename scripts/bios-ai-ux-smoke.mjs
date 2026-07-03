import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_PORT = 4173;
const SERVER_READY_LINE = "BIOS AI UX audit server listening on";

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function resolveRepoRoot(scriptUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

function resolveDependencyRoot(repoRoot, env = process.env) {
  return path.resolve(env.AGENTOS_DESKTOP_SHELL_DEPENDENCY_ROOT || repoRoot);
}

async function loadPlaywrightChromium(repoRoot, params = {}) {
  const dependencyRoot = path.resolve(
    params.dependencyRoot ?? resolveDependencyRoot(repoRoot, params.env ?? process.env),
  );
  const playwrightCoreUrl = pathToFileURL(
    path.join(dependencyRoot, "node_modules", "playwright-core", "index.mjs"),
  ).href;
  const playwrightCore = await import(playwrightCoreUrl);
  return playwrightCore.chromium;
}

function resolveBiosAiUxBrowserPath() {
  const envPath = process.env.BIOS_AI_UX_SMOKE_BROWSER_PATH;
  if (envPath && envPath.trim()) {
    return envPath;
  }
  if (process.platform === "win32") {
    return "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  }
  return null;
}

async function ensureBrowserExecutable(browserPath) {
  assertCondition(browserPath, "BIOS AI UX smoke needs a browser executable path");
  try {
    await access(browserPath);
  } catch {
    throw new Error(`BIOS AI UX smoke browser not found: ${browserPath}`);
  }
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function resolveAuditPort(preferredPort) {
  if (await isPortAvailable(preferredPort)) {
    return preferredPort;
  }
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.once("listening", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : preferredPort + 1;
      server.close(() => resolve(port));
    });
    server.listen(0, "127.0.0.1");
  });
}

function waitForServerReady(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timed out waiting for BIOS AI UX audit server to start"));
    }, timeoutMs);

    const handleOutput = (chunk) => {
      const text = String(chunk || "");
      if (text.includes(SERVER_READY_LINE)) {
        clearTimeout(timer);
        child.stdout?.off("data", handleOutput);
        child.stderr?.off("data", handleOutput);
        resolve();
      }
    };

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`BIOS AI UX audit server exited early with code ${code ?? -1}`));
    });
    child.stdout?.on("data", handleOutput);
    child.stderr?.on("data", handleOutput);
  });
}

async function waitForBodyText(page, text, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let latestText = "";
  while (Date.now() < deadline) {
    const bodyText = await page.locator("body").textContent();
    latestText = String(bodyText || "");
    if (latestText.includes(text)) {
      return;
    }
    await page.waitForTimeout(100);
  }
  const chatText = await page
    .locator("#chat-stream")
    .textContent()
    .catch(() => "");
  throw new Error(
    `Timed out waiting for page text: ${text}. Browser errors: ${JSON.stringify(
      page.__biosSmokeErrors || [],
    )}. Chat text: ${String(chatText || "").slice(-2000)}. Visible text head: ${latestText.slice(
      0,
      1200,
    )}. Visible text tail: ${latestText.slice(-1200)}`,
  );
}

async function clickButtonByText(page, text, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const button = page
      .getByRole("button", {
        name: new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      })
      .last();
    if (await button.count()) {
      const disabled = await button.isDisabled().catch(() => false);
      if (!disabled) {
        await button.click();
        return;
      }
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out waiting for button: ${text}`);
}

async function clickButtonIfPresent(page, text, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const button = page
      .getByRole("button", {
        name: new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      })
      .last();
    if (await button.count()) {
      const disabled = await button.isDisabled().catch(() => false);
      if (!disabled) {
        await button.click();
        return true;
      }
    }
    await page.waitForTimeout(100);
  }
  return false;
}

async function waitForSelectorText(page, selector, expectedText, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = await page
      .locator(selector)
      .textContent()
      .catch(() => "");
    if (String(text || "").includes(expectedText)) {
      return;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out waiting for selector ${selector} text: ${expectedText}`);
}

async function waitForSelectOptionsText(page, selector, expectedText, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let latestText = "";
  while (Date.now() < deadline) {
    latestText = await page
      .locator(`${selector} option`)
      .evaluateAll((options) => options.map((option) => option.textContent || "").join("\n"))
      .catch(() => "");
    if (String(latestText || "").includes(expectedText)) {
      return latestText;
    }
    await page.waitForTimeout(100);
  }
  const storageDebug = await page
    .evaluate(() => ({
      activeProfile: window.localStorage.getItem("bios-ai-active-profile"),
      activeSnapshot: window.localStorage.getItem(
        `bios-ai-onboarding:${window.localStorage.getItem("bios-ai-active-profile") || ""}`,
      ),
      globalSnapshot: window.localStorage.getItem("bios-ai-onboarding"),
    }))
    .catch(() => ({}));
  throw new Error(
    `Timed out waiting for select ${selector} option text: ${expectedText}. Options were: ${latestText}. Storage: ${JSON.stringify(storageDebug)}`,
  );
}

async function smokeManagedRuntimeEntry(page, baseUrl) {
  await page.goto(`${baseUrl}/?scenario=onboarding-model&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  await waitForBodyText(page, "Here's what I found on your system.");
  await clickButtonByText(page, "Import Selected");
  if (await clickButtonIfPresent(page, "Skip for Now")) {
    await waitForBodyText(page, "Give me a name.");
  }
  await waitForBodyText(page, "Give me a name.");
  await page.locator("#conv-name-input").fill("Atlas");
  await clickButtonByText(page, "Confirm");
  await waitForBodyText(page, "How should");
  await clickButtonByText(page, "Local only");
  await waitForBodyText(page, "BIOS AI managed llama.cpp runtime");
  await clickButtonByText(page, "Gemma 3 1B");
  if (await clickButtonIfPresent(page, "Default path")) {
    await waitForBodyText(page, "Store local model files on");
  }
  await waitForBodyText(page, "Last question - how much system authority should");
  await clickButtonByText(page, "Ask me first");
  await waitForBodyText(page, "Press Start Working");
  await clickButtonByText(page, "Start Working");
  await waitForBodyText(page, "Local-first shell ready");
  await page.locator('button[data-surface="settings"]').click();
  const settingsTitle = await page.locator("#settings-overview-title").innerText();
  assertCondition(
    settingsTitle.includes("Atlas control room"),
    `Unexpected BIOS AI settings title after onboarding: ${settingsTitle}`,
  );
  const workerOptionText = await waitForSelectOptionsText(
    page,
    "#settings-local-worker-select",
    "Llama 3.1 8B - Llama - available to install",
  );
  for (const expected of [
    "Llama 3.1 8B - Llama - available to install",
    "Mistral 7B Instruct v0.3 - Mistral - available to install",
    "Phi-3.5 Mini Instruct - Phi - available to install",
  ]) {
    assertCondition(
      workerOptionText.includes(expected),
      `Expected managed catalog option missing from Settings: ${expected}. Options were: ${workerOptionText}`,
    );
  }
}

async function smokeHybridManagedRuntimeInstall(page, baseUrl) {
  await page.goto(`${baseUrl}/?scenario=onboarding-hybrid-managed&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  await waitForBodyText(page, "Here's what I found on your system.");
  await clickButtonByText(page, "Import Selected");
  if (await clickButtonIfPresent(page, "Skip for Now")) {
    await waitForBodyText(page, "Give me a name.");
  }
  await waitForBodyText(page, "Give me a name.");
  await page.locator("#conv-name-input").fill("Atlas");
  await clickButtonByText(page, "Confirm");
  await waitForBodyText(page, "How should");
  await clickButtonByText(page, "Hybrid");
  await waitForBodyText(page, "BIOS AI managed llama.cpp runtime");
  await waitForBodyText(page, "Because you chose Hybrid");
  await clickButtonByText(page, "Qwen3 8B");
  await waitForBodyText(page, "Where should BIOS AI store the Qwen3 8B files?");
  await clickButtonByText(page, "Default path");
  await waitForBodyText(page, "Install Qwen3 8B");
  await waitForBodyText(page, "Local worker installed:");
  await waitForBodyText(page, "Qwen3 8B");
  await waitForBodyText(page, "Last question - how much system authority should");
  await clickButtonByText(page, "Ask me first");
  await waitForBodyText(page, "Press Start Working");
  await clickButtonByText(page, "Start Working");
  await waitForBodyText(page, "Local-first shell ready");
  await waitForBodyText(page, "Qwen3 8B");
}

async function smokeExternalLocalRuntimeBranch(page, baseUrl, scenario, expectedLabel) {
  await page.goto(`${baseUrl}/?scenario=${scenario}&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  await waitForBodyText(page, "Here's what I found on your system.");
  await clickButtonByText(page, "Import Selected");
  if (await clickButtonIfPresent(page, "Skip for Now")) {
    await waitForBodyText(page, "Give me a name.");
  }
  await waitForBodyText(page, "Give me a name.");
  await page.locator("#conv-name-input").fill("Atlas");
  await clickButtonByText(page, "Confirm");
  await waitForBodyText(page, "How should");
  await clickButtonByText(page, "Local only");
  await waitForBodyText(page, `Use ${expectedLabel} for local routing`);
  await waitForBodyText(page, `Checking ${expectedLabel} before setup continues`);
  await waitForBodyText(page, "Local runtime is reachable.");
  await waitForBodyText(page, "Last question - how much system authority should");
  await clickButtonByText(page, "Ask me first");
  await waitForBodyText(page, "Press Start Working");
  await clickButtonByText(page, "Start Working");
  await waitForBodyText(page, "Local-first shell ready");
  await waitForBodyText(page, expectedLabel);
}

async function smokeResumeManagedRuntimeSetup(page, baseUrl) {
  await page.goto(`${baseUrl}/?scenario=resume-runtime-setup&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  if (await clickButtonIfPresent(page, "Claw")) {
    await page.waitForTimeout(300);
  }
  await waitForBodyText(page, "local brain setup was not finished");
  await waitForBodyText(page, "BIOS AI managed llama.cpp runtime");
  await clickButtonByText(page, "Gemma 3 4B");
  await waitForBodyText(page, "Where should BIOS AI store the Gemma 3 4B files?");
  await clickButtonByText(page, "Default path");
  await waitForBodyText(page, "Local worker installed:");
  await waitForBodyText(page, "Gemma 3 4B");
  await waitForBodyText(page, "Last question - how much system authority should");
  await clickButtonByText(page, "Ask me first");
  await waitForBodyText(page, "Press Start Working");
  await clickButtonByText(page, "Start Working");
  await waitForBodyText(page, "Claw is ready");
}

async function smokeLocalOnlyOptionalImportFailure(page, baseUrl) {
  await page.goto(`${baseUrl}/?scenario=onboarding-model-import-fail&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  await waitForBodyText(page, "Here's what I found on your system.");
  await clickButtonByText(page, "Import Selected");
  await waitForBodyText(page, "Give me a name.");
  await page.locator("#conv-name-input").fill("Atlas");
  await clickButtonByText(page, "Confirm");
  await waitForBodyText(page, "How should");
  await clickButtonByText(page, "Local only");
  await waitForBodyText(page, "BIOS AI managed llama.cpp runtime");
  await clickButtonByText(page, "Gemma 3 1B");
  if (await clickButtonIfPresent(page, "Default path")) {
    await waitForBodyText(page, "Store local model files on");
  }
  await waitForBodyText(page, "Last question - how much system authority should");
  await clickButtonByText(page, "Ask me first");
  await waitForBodyText(page, "Press Start Working");
  await clickButtonByText(page, "Start Working");
  await waitForBodyText(page, "Atlas is ready");
  await waitForBodyText(page, "Cloud key import can be revisited later");
}

async function smokeLegacyReadyWithoutProfile(page, baseUrl) {
  await page.goto(`${baseUrl}/?scenario=legacy-ready-without-profile&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  await waitForBodyText(page, "Here's what I found on your system.");
  const bodyText = await page.locator("body").evaluate((node) => node.innerText || "");
  assertCondition(
    !String(bodyText || "").includes("Legacy Claw is ready"),
    "Legacy saved onboarding must not reopen a fake ready shell when no BIOS profile exists.",
  );
}

async function smokeStaleSavedRouteBypassBlocked(page, baseUrl) {
  await page.goto(`${baseUrl}/?scenario=stale-saved-route-bypass&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(async () => {
    await window.app?.activateExistingBiosProfile?.("claw", { announce: false });
  });
  await page.evaluate(() => window.app?.applyShellSurface?.("settings"));
  await waitForSelectorText(page, "#settings-route-readiness", "Runtime blocked");
  await waitForSelectorText(page, "#viewport-idle-readiness", "Runtime blocked");
  await waitForSelectorText(
    page,
    "#viewport-idle-next-step",
    "Verify the BOSS brain route before chat.",
  );

  const sendResult = await page.evaluate(() =>
    window.app?.sendChatMessage?.("Use the saved LM Studio route."),
  );
  assertCondition(sendResult === false, "Blocked native route should make local chat send fail.");
  await page.evaluate(() => window.app?.applyShellSurface?.("home"));
  await waitForBodyText(page, "still needs a selected and ready BOSS brain");

  const bodyText = await page.locator("body").textContent();
  assertCondition(
    !String(bodyText || "").includes("Local BIOS reply"),
    "Saved provider/backend hints must not bypass a blocked native BOSS brain route.",
  );
}

async function smokeForgeArenaProfileEntry(page, baseUrl) {
  await page.goto(`${baseUrl}/?scenario=forge-profile&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  await waitForBodyText(page, "I found existing BOSS profiles.");
  await clickButtonByText(page, "Claw");
  await page.evaluate(() => window.app?.applyShellSurface?.("status"));
  await waitForSelectorText(page, "#st-forge", "Local Arena available");
  await waitForSelectorText(page, "#status-open-forge-arena", "Open Forge Arena");
  await page.locator("#status-open-forge-arena").click();
  await page.waitForTimeout(300);
  await waitForBodyText(page, "Arena Identity");
  await page.evaluate(() => {
    document.getElementById("forge-arena-profile-public-input").value = "Nick";
    document.getElementById("forge-arena-profile-boss-input").value = "Claw";
    document.getElementById("forge-arena-profile-mode-select").value = "duo";
    document.getElementById("forge-arena-profile-role-select").value = "builder";
    document.getElementById("forge-arena-profile-path-select").value = "join-weekly-build";
    document.getElementById("forge-arena-profile-tagline-input").value = "Ready for the Arena.";
    document
      .getElementById("forge-arena-profile-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

  await waitForBodyText(page, "Arena identity saved for Nick + Claw.");

  const summaryTitle = await page.locator("#forge-arena-profile-summary-title").innerText();
  const entryRole = await page.locator("#forge-arena-profile-entry-role").innerText();
  const firstPath = await page.locator("#forge-arena-profile-first-path").innerText();
  const featureTitle = await page.locator("#forge-arena-profile-feature-title").innerText();
  const connectedIdentityId = await page.locator("#forge-arena-connected-identity-id").innerText();
  const connectedBackendStatus = await page
    .locator("#forge-arena-connected-backend-status")
    .innerText();
  const publicVisibility = await page.locator("#forge-arena-public-visibility").innerText();
  const publicScope = await page.locator("#forge-arena-public-scope").innerText();
  const privateBoundary = await page.locator("#forge-arena-private-boundary").innerText();

  assertCondition(
    summaryTitle.toLowerCase().includes("nick + claw"),
    `Unexpected Arena summary title: ${summaryTitle}`,
  );
  assertCondition(entryRole.includes("Builder"), `Unexpected Arena entry role: ${entryRole}`);
  assertCondition(
    firstPath.includes("Join The Weekly Build"),
    `Unexpected Arena first path: ${firstPath}`,
  );
  assertCondition(
    featureTitle.toLowerCase().includes("weekly build lane chosen"),
    `Unexpected Arena featured work title: ${featureTitle}`,
  );
  assertCondition(
    connectedIdentityId === "forge-local:claw",
    `Unexpected Arena connected identity id: ${connectedIdentityId}`,
  );
  assertCondition(
    connectedBackendStatus.toLowerCase().includes("connected backend not attached"),
    `Unexpected Arena connected backend status: ${connectedBackendStatus}`,
  );
  assertCondition(
    publicVisibility.includes("Public preview"),
    `Unexpected Arena public visibility: ${publicVisibility}`,
  );
  assertCondition(
    publicScope.includes("public display name") && publicScope.includes("featured work"),
    `Unexpected Arena public scope: ${publicScope}`,
  );
  assertCondition(
    privateBoundary.includes("Private BIOS memory") &&
      privateBoundary.includes("unsubmitted artifacts"),
    `Unexpected Arena private boundary: ${privateBoundary}`,
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForBodyText(page, "I found existing BOSS profiles.");
  await clickButtonByText(page, "Claw");
  await page.evaluate(() => window.app?.switchPage?.("forge"));
  await page.waitForTimeout(300);
  await waitForSelectorText(page, "#forge-arena-profile-summary-title", "Nick + Claw");
  await waitForSelectorText(page, "#forge-arena-connected-identity-id", "forge-local:claw");
  await waitForSelectorText(page, "#forge-arena-public-visibility", "Public preview");
  await waitForSelectorText(
    page,
    "#forge-arena-private-boundary",
    "unsubmitted artifacts stay owned by the local BIOS profile",
  );
}

async function smokeForgeArenaLocalProvingGround(page, baseUrl) {
  await page.goto(`${baseUrl}/?scenario=forge-profile&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  await waitForBodyText(page, "I found existing BOSS profiles.");
  await clickButtonByText(page, "Claw");
  await page.evaluate(() => window.app?.switchPage?.("forge"));
  await page.waitForTimeout(300);
  await waitForBodyText(page, "Local Forge Arena proving ground live");
  await waitForBodyText(page, "Spark Judge");
  await waitForBodyText(page, "Season Zero - Foundry Dawn");
  await waitForBodyText(page, "Official Season Zero truth is locally owned");
  await waitForBodyText(page, "official_weekly_build");
  await waitForBodyText(page, "Arena BOSS Governance");
  await waitForBodyText(page, "Forgewarden");
  await waitForBodyText(page, "BOSS Delegation Lanes");
  await waitForBodyText(page, "Arena Health");
  await waitForBodyText(page, "Surprise events require Forgewarden approval");
  await waitForBodyText(page, "Community Response");
  await waitForBodyText(page, "Human Vote Lane");
  await waitForBodyText(page, "Agent Vote Lane");
  await waitForBodyText(page, "Spotlight Pipeline");
  await waitForBodyText(page, "Side Awards");
  await waitForBodyText(page, "does not override official_boss_judging");
  await waitForBodyText(page, "Study Lineage");
  await waitForBodyText(page, "Learnable Patterns");
  await waitForBodyText(page, "Authorship Boundary");
  await waitForBodyText(page, "study_not_authority");
  await waitForBodyText(page, "authorship_preserved");
  await waitForBodyText(page, "remix_requires_consent");

  await page.locator("#forge-arena-run-local-proof").click();
  await waitForSelectorText(
    page,
    "#forge-arena-local-proof-status",
    "Local BOSS proving round judged with score",
  );
  await waitForBodyText(page, "BOSS Local Proving Run");
  await waitForBodyText(page, "truthfully naming 1 blocked capability path");
  await waitForBodyText(page, "Native packaged local Arena contract");
  await waitForBodyText(page, "Learning bridge ready");
  await waitForBodyText(page, "Worker Governance");
  await waitForBodyText(page, "Reflex Candidate");
  await waitForBodyText(page, "local_governance_preview");
  await waitForBodyText(page, "must not override official seasonal ranking");
  await waitForBodyText(page, "local_community_response_preview");
  await waitForBodyText(page, "Truthful Limits");
  await waitForBodyText(page, "non_ranking_bonus");
  await waitForBodyText(page, "truthful_blocked_capability_handling");
  await waitForBodyText(page, "pretending success");
  await waitForBodyText(page, "Foundry Dawn Leader");
  await waitForBodyText(page, "Official standout");
  await waitForBodyText(page, "official_boss_judging");

  await page.locator("#forge-arena-run-major-boss-test").click();
  await waitForSelectorText(
    page,
    "#forge-arena-major-boss-status",
    "Major BOSS system test passed through real runtime path",
  );
  await waitForSelectorText(page, "#forge-arena-major-boss-status", "packaged-app-real-runtime");
  await waitForSelectorText(page, "#forge-arena-major-boss-status", "5 scenario(s)");
  await waitForBodyText(page, "Local Creation With Truthful Limits - BOSS System Test");
  await waitForBodyText(page, "Sovereignty Boundary - BOSS System Test");
  await waitForBodyText(page, "Run Overnight Arena");
  await waitForSelectorText(
    page,
    "#forge-arena-overnight-boss-status",
    "Overnight Arena run is ready",
  );
  assertCondition(
    (await page.locator("#forge-arena-run-overnight-boss-test").count()) === 1,
    "Forge Arena must expose the overnight BOSS runner control.",
  );

  await page.evaluate(() => {
    window.app?.handleForgeArenaEntryPath?.("publish-local-creation", { scroll: false });
    document.getElementById("forge-arena-create-title").value = "Tiny local game";
    document.getElementById("forge-arena-create-summary").value =
      "Claw staged a small local game card with proof, replay notes, and clear local ownership.";
    document.getElementById("forge-arena-create-score-bonus").value = "4";
    document.getElementById("forge-arena-create-result-summary").value =
      "Replay this card from the local Forge feed.";
    document
      .getElementById("forge-arena-create-challenge-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await waitForBodyText(page, 'Local participation "Tiny local game" recorded');
  await waitForBodyText(page, "published local");
  await waitForBodyText(page, "Replay this card from the local Forge feed");
  await waitForBodyText(page, "published_local_lineage");

  await page.locator("#forge-arena-record-co-build").click();
  await waitForSelectorText(
    page,
    "#forge-arena-local-participation-status",
    "Local co build recorded with score",
  );
  await waitForBodyText(page, "co-build contribution");

  await page.locator("#forge-arena-save-replay").click();
  await waitForSelectorText(
    page,
    "#forge-arena-local-participation-status",
    "Local replay recorded with score",
  );
  await waitForBodyText(page, "Replay saved locally");
}

async function smokeStoredProfilesWithoutActiveStillShowPicker(page, baseUrl) {
  await page
    .evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    })
    .catch(() => {});
  await page.goto(`${baseUrl}/?scenario=profiles-no-active&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  await waitForBodyText(page, "I found existing BOSS profiles.");
  await waitForBodyText(page, "Choose which one you want to bring back");
  await waitForSelectorText(page, "#viewport-app-title", "Choose BOSS profile");
  await waitForSelectorText(page, "#viewport-body-posture", "Waiting for profile choice");
  const idleHidden = await page
    .locator("#viewport-idle")
    .evaluate((node) => node.classList.contains("hidden"));
  assertCondition(
    idleHidden,
    "Profile selection must not render the right-side viewport companion card before choice.",
  );
  const bodyText = await page.locator("body").textContent();
  assertCondition(
    !String(bodyText || "").includes("Claw is ready"),
    "A stored profile must not silently auto-resume when native active profile truth is empty.",
  );
  const viewportText = await page.locator(".viewport").evaluate((node) => node.innerText || "");
  assertCondition(
    !String(viewportText || "").includes("Choose your BOSS profile"),
    "Profile selection must stay in the left chooser instead of the virtual desktop viewport card.",
  );
  assertCondition(
    !String(bodyText || "").includes("Verifying BIOS AI runtime"),
    "Profile selection must not show stale runtime verification before the user chooses a BOSS profile.",
  );
}

async function smokeSoulGovernanceReview(page, baseUrl) {
  await page.goto(`${baseUrl}/?scenario=soul-governance&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(async () => {
    await window.app?.activateExistingBiosProfile?.("claw", { announce: false });
    await window.app?.loadMemorySurface?.();
    await window.app?.loadBiosSoulGovernance?.();
  });
  await page.evaluate(() => window.app?.applyShellSurface?.("memory"));
  await waitForBodyText(page, "Guarded Soul Governance");
  await waitForBodyText(page, "Add direct, calm, practical to Claw's governed helper tone.");
  await waitForBodyText(page, "Target: Core Identity");
  await waitForBodyText(page, "Approval: kernel_locked");
  await waitForBodyText(
    page,
    "Core identity changes alter who the BOSS is, so BIOS must explain the change and wait for explicit operator approval.",
  );
  await waitForBodyText(
    page,
    "BOSS must explain this clearly before BIOS writes it into durable truth.",
  );
  await clickButtonByText(page, "Approve change");
  await waitForBodyText(
    page,
    "The newest guarded soul change was approved and written into the governed BIOS identity files.",
  );
  await waitForBodyText(page, "No guarded soul changes are waiting right now.");
  await waitForBodyText(page, "No guarded soul changes are waiting for review.");
  await waitForBodyText(page, "approved");
  await waitForBodyText(page, "Core Identity");
}

async function smokeNervousSystemCoordinationSurface(page, baseUrl) {
  await page.goto(`${baseUrl}/?scenario=nervous-system&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(async () => {
    await window.app?.activateExistingBiosProfile?.("claw", { announce: false });
    await window.app?.loadBiosRuntimeStatus?.({ tickBrainstem: false });
  });
  await page.evaluate(() => window.app?.applyShellSurface?.("memory"));
  await waitForSelectorText(
    page,
    "#bios-surface-title",
    "B.I.O.S. Biologically Inspired Operating System",
  );
  await waitForSelectorText(page, "#bios-stat-nervous-signals", "4");
  await waitForSelectorText(page, "#bios-stat-truth-records", "5");
  await waitForBodyText(page, "1 attention signal active");
  await waitForBodyText(page, "BOSS Operating Truth");
  const surfaceText = await page.locator("body").textContent();
  assertCondition(
    !String(surfaceText || "").includes("BOSS TruthSpine"),
    "BIOS surface must not expose TruthSpine as a user-facing subsystem.",
  );
  await waitForBodyText(page, "Clear | 5 truth records");
  await waitForBodyText(page, "bios-shared-v1 reflex labels active");
  await waitForBodyText(page, "Dominant memory tag: Skill candidate.");
  await waitForBodyText(page, "Dominant evidence: User approved.");
  await waitForBodyText(page, "Dominant state: Validating.");
  await waitForBodyText(page, "approval.requested from connector");
  await waitForBodyText(page, "Waiting for operator approval before Telegram delivery.");
  await waitForBodyText(
    page,
    "Brainstem is holding route, approval pauses, and recovery timing steady.",
  );
  await waitForBodyText(page, "Rhythm & Cleanup");
  await waitForBodyText(page, "Awake | 0 queued memories | 0 cleanups");
  await waitForBodyText(page, "No immediate circadian action is required.");
}

async function smokeTruthSpineSessionUpdate(page, baseUrl) {
  await page.goto(`${baseUrl}/?scenario=nervous-system&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(async () => {
    await window.app?.activateExistingBiosProfile?.("claw", { announce: false });
    const state = await window.__TAURI__.core.invoke("record_bios_truth_session_update", {
      input: {
        profile_id: "claw",
        source_ref: "ux-smoke",
        run_id: "ux-smoke",
        step_id: "truthspine-upgrade",
        chat_id: "ux-smoke",
        usage: {
          context_profile: "tiny",
          baseline_tokens: 1459,
          truthspine_context_tokens: 163,
          label: "bios-truthspine-upgrade",
        },
        events: [
          {
            type: "candidate",
            summary: "Consider a detached truth sidecar as a candidate only.",
            subject_refs: ["truthspine_runtime_dependency"],
          },
          {
            type: "decision_accept",
            summary: "Keep compact BOSS truth native inside the packaged runtime.",
            subject_refs: ["truthspine_runtime_dependency"],
            proof_refs: ["ux-smoke"],
          },
        ],
      },
    });
    window.__biosTruthSpineSessionUpdateState = state;
    await window.app?.loadBiosRuntimeStatus?.({ tickBrainstem: false });
    window.app?.applyShellSurface?.("memory");
    window.app?.renderBiosSurfacePanel?.();
  });
  const state = await page.evaluate(() => window.__biosTruthSpineSessionUpdateState);
  assertCondition(
    state?.latest_usage?.token_savings_percent === 88.83,
    `Expected measured compact-truth savings in packaged smoke, received ${JSON.stringify(
      state?.latest_usage,
    )}`,
  );
  assertCondition(
    state?.tiny_pack?.active_decisions?.some((line) =>
      String(line).includes("native inside the packaged runtime"),
    ),
    "Accepted BOSS truth session decision must reach the active decision pack.",
  );
  assertCondition(
    state?.tiny_pack?.brainstorm?.some((line) => String(line).includes("detached truth")),
    "Candidate BOSS truth session truth must stay in the brainstorm pack.",
  );
  await waitForBodyText(page, "BOSS Operating Truth");
  await waitForBodyText(page, "88.83% token savings with measured confidence");
  await waitForBodyText(page, "Candidate truth is separate from accepted decisions.");
  const surfaceText = await page.locator("body").textContent();
  assertCondition(
    !String(surfaceText || "").includes("BOSS TruthSpine"),
    "TruthSpine must remain an internal BOSS mechanism, not a visible product surface.",
  );
}

async function smokeImmediateLearningBiomimicry(page, baseUrl) {
  await page.goto(`${baseUrl}/?scenario=nervous-system&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(async () => {
    await window.app?.activateExistingBiosProfile?.("claw", { announce: false });
    await window.__TAURI__.core.invoke("record_bios_memory_event", {
      profileId: "claw",
      input: {
        summary: "User wants BIOS phases completed to strict proof before being called done.",
        detail: "This should become usable immediately and durable after dreaming.",
        tags: ["user_preference", "important_moment"],
        importance: 9,
        confidence: 0.95,
        source: "ux-smoke",
        promote_immediately: true,
      },
    });
    await window.app?.loadBiosRuntimeStatus?.({ tickBrainstem: false });
    window.app?.applyShellSurface?.("memory");
    window.app?.renderBiosSurfacePanel?.();
  });
  await waitForBodyText(page, "4 live learnings active");
  await waitForBodyText(page, "Rhythm & Cleanup");
  await waitForBodyText(page, "Dreaming | 1 queued memory | 0 cleanups");
  await waitForBodyText(
    page,
    "BIOS has 1 queued memory promotion candidate(s) waiting for glymphatic cleanup.",
  );
  await waitForBodyText(
    page,
    "Latest: User wants BIOS phases completed to strict proof before being called done.",
  );
  await waitForBodyText(page, "memory.recorded from memory");
  await page.evaluate(async () => {
    await window.__TAURI__.core.invoke("run_bios_dream_cycle", { profileId: "claw" });
    await window.app?.loadBiosRuntimeStatus?.({ tickBrainstem: false });
    window.app?.applyShellSurface?.("memory");
    window.app?.renderBiosSurfacePanel?.();
  });
  await waitForBodyText(page, "0 item(s) are queued for dream consolidation into durable memory");
  await waitForSelectorText(page, "#bios-stat-durable-memory", "2");
  await waitForBodyText(page, "dream.completed from dream");
}

async function smokeOrganSupervisorRecoverySurface(page, baseUrl) {
  await page.goto(`${baseUrl}/?scenario=organ-supervisor&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  await waitForBodyText(page, "I found existing BOSS profiles.");
  await clickButtonByText(page, "Claw");
  await page.evaluate(async () => {
    await window.app?.loadBiosRuntimeStatus?.({ tickBrainstem: false });
  });
  await page.evaluate(() => window.app?.applyShellSurface?.("memory"));
  await waitForSelectorText(page, "#bios-surface-title", "B.I.O.S.");
  await waitForBodyText(page, "Organ Supervisor");
  await waitForBodyText(page, "Partially Blocked | 6 organs | 0 restarts");
  await waitForBodyText(
    page,
    "5 organs can restart under supervisor control; 1 organ requires manual setup or substrate.",
  );
  await waitForBodyText(page, "3 organs are process, body-worker, or boxed-lane boundaries.");
  await page.evaluate(async () => {
    await window.__TAURI__.core.invoke("simulate_bios_organ_failure_and_recover", {
      input: {
        profile_id: "claw",
        organ_id: "memory_dream",
        error: "Phase 11 UX smoke simulated memory organ failure.",
      },
    });
    await window.app?.loadBiosRuntimeStatus?.({ tickBrainstem: false });
    window.app?.applyShellSurface?.("memory");
    window.app?.renderBiosSurfacePanel?.();
  });
  await waitForBodyText(page, "Partially Blocked | 6 organs | 1 restart");
  await waitForBodyText(
    page,
    "memory_dream | organ.restarted | Memory And Dreaming recovered under supervision without restarting the BIOS shell.",
  );
  await waitForBodyText(
    page,
    "Nervous system is recovering: organ supervisor reported a restart event.",
  );
  const blockedRecovery = await page.evaluate(async () => {
    try {
      await window.__TAURI__.core.invoke("recover_bios_organ", {
        input: {
          profile_id: "claw",
          organ_id: "sandbox_validator",
          reason: "Phase 11 UX smoke must not fake boxed lane recovery.",
        },
      });
      return "unexpected success";
    } catch (error) {
      return String(error?.message || error);
    }
  });
  if (!blockedRecovery.includes("Sandbox Validator cannot be restarted")) {
    throw new Error(`Expected boxed lane recovery to be blocked, got: ${blockedRecovery}`);
  }
}

async function smokeProfileIsolation(page, baseUrl) {
  await page.goto(`${baseUrl}/?scenario=profile-isolation&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(async () => {
    await window.app?.activateExistingBiosProfile?.("claw", { announce: false });
  });
  await page.evaluate(() => window.app?.applyShellSurface?.("settings"));
  await waitForBodyText(page, "API Provider");
  await page.selectOption("#settings-provider-select", "openai");
  await page.selectOption("#settings-route-mode-select", "local");
  await page.selectOption("#settings-local-worker-select", "gemma-3-1b");
  await clickButtonByText(page, "Save Settings");
  await page.waitForTimeout(300);
  await page.selectOption("#settings-telegram-enabled-select", "enabled");
  await page.locator("#settings-telegram-target-input").fill("claw-room");
  await clickButtonByText(page, "Save Telegram connector");
  await waitForSelectorText(
    page,
    "#settings-telegram-connector-status",
    "Telegram connector ready",
  );

  await page.evaluate(async () => {
    await window.app?.activateExistingBiosProfile?.("ember", { announce: false });
  });
  await page.evaluate(() => window.app?.applyShellSurface?.("settings"));
  await waitForBodyText(page, "API Provider");
  const emberProvider = await page.inputValue("#settings-provider-select");
  const emberRoute = await page.inputValue("#settings-route-mode-select");
  const emberWorker = await page.inputValue("#settings-local-worker-select");
  const emberConnectorMode = await page.inputValue("#settings-telegram-enabled-select");
  const emberTelegramTarget = await page.inputValue("#settings-telegram-target-input");
  assertCondition(
    emberProvider === "anthropic",
    `Expected Ember provider isolation to remain anthropic, received ${emberProvider}`,
  );
  assertCondition(
    emberRoute === "hybrid",
    `Expected Ember route isolation to remain hybrid, received ${emberRoute}`,
  );
  assertCondition(
    emberWorker === "qwen-3-8b",
    `Expected Ember worker isolation to remain qwen-3-8b, received ${emberWorker}`,
  );
  assertCondition(
    emberConnectorMode === "enabled",
    `Expected Ember Telegram mode isolation to remain enabled, received ${emberConnectorMode}`,
  );
  assertCondition(
    emberTelegramTarget === "ember-room",
    `Expected Ember Telegram target isolation to remain ember-room, received ${emberTelegramTarget}`,
  );

  await page.evaluate(async () => {
    await window.app?.activateExistingBiosProfile?.("claw", { announce: false });
  });
  await page.evaluate(() => window.app?.applyShellSurface?.("settings"));
  await waitForBodyText(page, "API Provider");
  const clawProvider = await page.inputValue("#settings-provider-select");
  const clawRoute = await page.inputValue("#settings-route-mode-select");
  const clawWorker = await page.inputValue("#settings-local-worker-select");
  const clawConnectorMode = await page.inputValue("#settings-telegram-enabled-select");
  const clawTelegramTarget = await page.inputValue("#settings-telegram-target-input");
  assertCondition(
    clawProvider === "openai",
    `Expected Claw provider isolation to persist as openai, received ${clawProvider}`,
  );
  assertCondition(
    clawRoute === "local",
    `Expected Claw route isolation to persist as local, received ${clawRoute}`,
  );
  assertCondition(
    clawWorker === "gemma-3-1b",
    `Expected Claw worker isolation to persist as gemma-3-1b, received ${clawWorker}`,
  );
  assertCondition(
    clawConnectorMode === "enabled",
    `Expected Claw Telegram mode isolation to persist as enabled, received ${clawConnectorMode}`,
  );
  assertCondition(
    clawTelegramTarget === "claw-room",
    `Expected Claw Telegram target isolation to persist as claw-room, received ${clawTelegramTarget}`,
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await window.app?.activateExistingBiosProfile?.("ember", { announce: false });
  });
  await page.evaluate(() => window.app?.applyShellSurface?.("settings"));
  await waitForBodyText(page, "API Provider");
  const reloadedEmberProvider = await page.inputValue("#settings-provider-select");
  const reloadedEmberRoute = await page.inputValue("#settings-route-mode-select");
  const reloadedEmberWorker = await page.inputValue("#settings-local-worker-select");
  const reloadedEmberConnectorMode = await page.inputValue("#settings-telegram-enabled-select");
  const reloadedEmberTelegramTarget = await page.inputValue("#settings-telegram-target-input");
  assertCondition(
    reloadedEmberProvider === "anthropic",
    `Expected reloaded Ember provider isolation to remain anthropic, received ${reloadedEmberProvider}`,
  );
  assertCondition(
    reloadedEmberRoute === "hybrid",
    `Expected reloaded Ember route isolation to remain hybrid, received ${reloadedEmberRoute}`,
  );
  assertCondition(
    reloadedEmberWorker === "qwen-3-8b",
    `Expected reloaded Ember worker isolation to remain qwen-3-8b, received ${reloadedEmberWorker}`,
  );
  assertCondition(
    reloadedEmberConnectorMode === "enabled",
    `Expected reloaded Ember Telegram mode isolation to remain enabled, received ${reloadedEmberConnectorMode}`,
  );
  assertCondition(
    reloadedEmberTelegramTarget === "ember-room",
    `Expected reloaded Ember Telegram target isolation to remain ember-room, received ${reloadedEmberTelegramTarget}`,
  );
}

async function smokeSettingsControlPlane(page, baseUrl) {
  await page.goto(`${baseUrl}/?scenario=settings-surface&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(async () => {
    await window.app?.activateExistingBiosProfile?.("claw", { announce: false });
  });
  await page.evaluate(() => window.app?.applyShellSurface?.("settings"));
  await waitForSelectorText(page, "#settings-overview-title", "control room");
  await waitForSelectorText(page, "#settings-provider-status", "Local routing is active above.");
  await waitForSelectorText(
    page,
    "#settings-local-capability-summary",
    "8 BIOS-owned local tool contract",
  );
  await waitForSelectorText(page, "#settings-local-capability-safe-read", "5 safe-read action");
  await waitForSelectorText(
    page,
    "#settings-local-capability-approval",
    "2 approval-required host action",
  );
  await waitForSelectorText(page, "#settings-local-capability-boxed", "1 boxed-first risky action");
  await waitForSelectorText(
    page,
    "#settings-local-capability-truth-rule",
    "only claim or run local actions",
  );
  const downloadAllModelsButton = page.locator("#settings-install-all-local-workers");
  assertCondition(
    (await downloadAllModelsButton.innerText()).includes("Download all listed BIOS AI models"),
    "Settings must expose a truthful download-all listed managed models control.",
  );
  await waitForSelectorText(page, "#viewport-body-posture", "Body: Private body standing by");
  await waitForSelectorText(page, "#viewport-idle-kicker", "BIOS Home");
  await waitForSelectorText(page, "#viewport-idle-title", "Local-first shell ready");
  await waitForSelectorText(page, "#viewport-idle-readiness", "Route ready");
  await waitForSelectorText(page, "#viewport-idle-next-step", "You can start chatting now.");
  await waitForSelectorText(page, "#viewport-idle-body", "Body: Private body standing by");
  await waitForSelectorText(
    page,
    "#viewport-idle-host-policy",
    "User desktop interruption blocked by default",
  );
  const idlePanelHidden = await page
    .locator("#viewport-idle")
    .evaluate((node) => node.classList.contains("hidden"));
  assertCondition(
    idlePanelHidden,
    "BIOS Home status truth must stay out of the right-side viewport panel.",
  );
  await waitForSelectorText(page, "#viewport-app-title", "BIOS private desktop");
  await page.evaluate(() => {
    window.app?.showConnectionStatusBar?.(
      "BIOS AI is still in local shell mode. Local features remain available while gateway retry continues.",
      "warning",
    );
    if (window.app) {
      window.app.runInProgress = true;
    }
    window.app?.setHeroStatus?.("Working on: prepare packaged app proof");
  });
  await waitForSelectorText(
    page,
    "#connection-status-bar",
    "Local features remain available while gateway retry continues.",
  );
  await waitForSelectorText(page, "#activity-label", "WORKING");
  await waitForSelectorText(
    page,
    "#tasks-activity-label",
    "Working on: prepare packaged app proof",
  );
  const connectionBar = page.locator("#connection-status-bar");
  assertCondition(
    (await connectionBar.getAttribute("role")) === "status",
    "Local shell reconnect strip must expose status semantics.",
  );
  assertCondition(
    (await connectionBar.getAttribute("aria-live")) === "polite",
    "Local shell reconnect strip must use a polite live region.",
  );
  assertCondition(
    (await connectionBar.getAttribute("data-tone")) === "warning",
    "Local shell reconnect strip must expose warning tone metadata.",
  );
  const connectionBarLayout = await connectionBar.evaluate((node) => {
    const style = window.getComputedStyle(node);
    return {
      height: node.getBoundingClientRect().height,
      opacity: style.opacity,
      overflow: style.overflow,
      pointerEvents: style.pointerEvents,
      width: node.getBoundingClientRect().width,
    };
  });
  assertCondition(
    connectionBarLayout.width <= 2 &&
      connectionBarLayout.height <= 2 &&
      connectionBarLayout.opacity === "0" &&
      connectionBarLayout.pointerEvents === "none",
    "Local shell reconnect status must stay non-visual and out of the app layout.",
  );
  assertCondition(
    connectionBarLayout.overflow === "hidden",
    "Local shell reconnect status must be clipped as an accessibility live region.",
  );
  assertCondition(
    String(await connectionBar.getAttribute("title")).includes("local shell features"),
    "Local shell reconnect strip must explain that local shell features remain available.",
  );

  await page.selectOption("#settings-provider-select", "anthropic");
  await waitForSelectorText(page, "#settings-provider-status", "Switched to anthropic.");

  await page.selectOption("#settings-telegram-enabled-select", "enabled");
  await page.locator("#settings-telegram-target-input").fill("123456");
  await clickButtonByText(page, "Save Telegram connector");
  await waitForSelectorText(
    page,
    "#settings-telegram-connector-status",
    "Telegram connector ready",
  );
  await waitForSelectorText(page, "#settings-local-capability-connectors", "1 connector ready");
  const connectorInvocation = await page.evaluate(async () => {
    return window.app?.runtimeTransport?.invokeConnector?.({
      profileId: window.app?.activeBiosProfileId || null,
      connector: "telegram",
      action: "send_message",
      arguments: {
        text: "Connector proof from BIOS AI UX smoke.",
      },
      confirm: true,
    });
  });
  assertCondition(
    connectorInvocation?.summary === "Telegram connector delivered the message through BIOS AI.",
    `Expected packaged local connector invoke proof, received ${JSON.stringify(connectorInvocation)}`,
  );

  const routeMode = await page.inputValue("#settings-route-mode-select");
  const localLane = await page.inputValue("#settings-local-backend-select");
  const telegramTarget = await page.inputValue("#settings-telegram-target-input");
  assertCondition(
    routeMode === "local",
    `Expected local route to stay active, received ${routeMode}`,
  );
  assertCondition(
    localLane === "bios-managed",
    `Expected BIOS managed local lane to stay active, received ${localLane}`,
  );
  assertCondition(
    telegramTarget === "123456",
    `Expected Telegram target to save as 123456, received ${telegramTarget}`,
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await window.app?.activateExistingBiosProfile?.("claw", { announce: false });
  });
  await page.evaluate(() => window.app?.applyShellSurface?.("settings"));
  await waitForSelectorText(page, "#settings-provider-status", "Local routing is active above.");
  const persistedProvider = await page.inputValue("#settings-provider-select");
  const persistedRoute = await page.inputValue("#settings-route-mode-select");
  const persistedConnectorMode = await page.inputValue("#settings-telegram-enabled-select");
  const persistedTelegramTarget = await page.inputValue("#settings-telegram-target-input");
  assertCondition(
    persistedProvider === "anthropic",
    `Expected preferred cloud provider to persist as anthropic, received ${persistedProvider}`,
  );
  assertCondition(
    persistedRoute === "local",
    `Expected persisted route to stay local, received ${persistedRoute}`,
  );
  assertCondition(
    persistedConnectorMode === "enabled",
    `Expected Telegram connector to persist as enabled, received ${persistedConnectorMode}`,
  );
  assertCondition(
    persistedTelegramTarget === "123456",
    `Expected Telegram target to persist as 123456, received ${persistedTelegramTarget}`,
  );
}

async function smokeSandboxPromotionLifecycle(page, baseUrl) {
  await page.goto(`${baseUrl}/?scenario=sandbox-promotion-lifecycle&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(async () => {
    await window.app?.activateExistingBiosProfile?.("claw", { announce: false });
  });
  await page.evaluate(() => window.app?.applyShellSurface?.("settings"));
  await waitForSelectorText(page, "#settings-boxed-lane-queue", "3 queued boxed-lane artifacts");
  await waitForSelectorText(page, "#settings-promotion-record", "Validated skill patch | approved");
  await waitForSelectorText(page, "#settings-boxed-lane-queue-list", "Approved for host adoption");
  await waitForSelectorText(page, "#settings-boxed-lane-queue-list", "Host adoption blocked");
  await waitForSelectorText(page, "#settings-prepare-boxed-lane", "Repair And Verify Boxed Lane");
  await waitForSelectorText(
    page,
    "#settings-boxed-lane-queue-list",
    "Ready to request host promotion",
  );
  await waitForSelectorText(page, "#settings-boxed-lane-queue-list", "3 evidence items recorded");
  await page.click("#settings-prepare-boxed-lane");
  await waitForSelectorText(page, "#settings-prepare-boxed-lane-status", "Latest repair attempt");
  await waitForSelectorText(
    page,
    "#settings-prepare-boxed-lane-status",
    "Boxed-lane setup started",
  );
  await waitForSelectorText(page, "#settings-prepare-boxed-lane", "Boxed Lane Verifying");
  await waitForSelectorText(
    page,
    "#settings-prepare-boxed-lane-status",
    "State: needs_linux_distro",
  );
  const prepareResult = await page.evaluate(async () => {
    return window.__TAURI__.core.invoke("bios_prepare_boxed_lane", {
      input: {
        profile_id: "claw",
        allow_os_changes: false,
      },
    });
  });
  assertCondition(
    prepareResult?.action_taken === "background_repair_queued",
    `Expected boxed-lane preparation without OS-change approval to queue background repair, received ${prepareResult?.action_taken}`,
  );
  assertCondition(
    String(prepareResult?.blocked_reason || "").includes("will not change OS features"),
    "Expected boxed-lane preparation without OS-change approval to avoid OS mutation.",
  );
}

async function smokeDiagnosticsRecoverySurface(page, baseUrl) {
  await page.goto(`${baseUrl}/?scenario=diagnostics-recovery&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(async () => {
    await window.app?.activateExistingBiosProfile?.("claw", { announce: false });
  });
  await page.evaluate(() => window.app?.applyShellSurface?.("settings"));
  await waitForSelectorText(page, "#settings-diagnostics-headline", "needs route recovery");
  await waitForSelectorText(
    page,
    "#settings-diagnostics-groups",
    "No managed local worker is selected",
  );
  await waitForSelectorText(
    page,
    "#settings-diagnostics-actions",
    "Install the selected managed worker or switch to an available external runtime.",
  );
  await waitForSelectorText(
    page,
    "#settings-diagnostics-still-works",
    "saved BOSS profile can still be inspected",
  );
  await waitForSelectorText(page, "#settings-diagnostics-support-summary", "active recovery item");
  await waitForSelectorText(page, "#settings-show-profile-picker", "Change BOSS profile");
  await waitForSelectorText(page, "#settings-rerun-onboarding", "Rerun setup");
  await waitForSelectorText(page, "#settings-route-readiness", "Runtime blocked");
  await waitForSelectorText(page, "#viewport-idle-readiness", "Runtime blocked");
  await waitForSelectorText(
    page,
    "#viewport-idle-next-step",
    "Install the selected managed worker or switch to an available external runtime.",
  );
  const settingsText = await page.locator("#surface-settings").textContent();
  assertCondition(
    !String(settingsText || "").includes("runtime.route.blocked"),
    "Detailed debug events should not clutter the normal Settings recovery surface.",
  );
  await page.locator("#settings-show-profile-picker").click();
  await waitForBodyText(page, "I found existing BOSS profiles.");
  await page.evaluate(() => window.app?.applyShellSurface?.("settings"));

  await page.evaluate(() => window.app?.applyShellSurface?.("log"));
  await waitForSelectorText(page, "#log-meta", "Latest event: diagnostics.recovery.rendered");
  await waitForSelectorText(page, "#log-stream", "runtime.route.blocked");
}

async function smokeDeleteLastProfileReopensOnboarding(page, baseUrl) {
  await page.goto(`${baseUrl}/?scenario=delete-last-profile&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  await waitForBodyText(page, "I found existing BOSS profiles.");
  await clickButtonByText(page, "Claw");
  await page.evaluate(() => window.app?.applyShellSurface?.("settings"));
  await waitForSelectorText(page, "#settings-overview-title", "control room");
  await page.locator("#settings-delete-profile").click();
  await waitForBodyText(page, "Here's what I found on your system.");
  const bodyText = await page.locator("body").textContent();
  assertCondition(
    !String(bodyText || "").includes("Claw is loaded. Resume whenever you're ready."),
    "Deleting the last BOSS profile must reopen onboarding instead of leaving the old ready shell visible.",
  );
}

async function smokeProfileLifecycleControlPlane(page, baseUrl) {
  await page.goto(`${baseUrl}/?scenario=profile-lifecycle&auto=off`, {
    waitUntil: "domcontentloaded",
  });
  await waitForBodyText(page, "I found existing BOSS profiles.");
  await clickButtonByText(page, "Ember");
  await waitForBodyText(page, "Ember is loaded. Resume whenever you're ready.");

  await page.evaluate(() => window.app?.applyShellSurface?.("settings"));
  await waitForSelectorText(page, "#settings-overview-title", "Ember control room");
  await waitForSelectorText(page, "#settings-profile-status", "2 saved BOSS profiles");
  await waitForSelectorText(
    page,
    "#settings-profile-danger-copy",
    "Other BOSS profiles and unrelated user files stay untouched.",
  );

  await page.fill("#settings-profile-rename", "Ember Prime");
  await page.locator("#settings-rename-profile").click();
  await waitForSelectorText(page, "#settings-active-profile", "Ember Prime");
  await waitForSelectorText(page, "#settings-profile-status", "Saved the new BOSS profile name.");

  await page.locator("#settings-profile-list .settings-profile-chip", { hasText: "Claw" }).click();
  await waitForSelectorText(page, "#settings-overview-title", "Claw control room");
  await page.locator("#settings-delete-profile").click();
  await waitForSelectorText(page, "#settings-overview-title", "Ember Prime control room");
  await waitForSelectorText(page, "#settings-profile-status", "Claw was deleted.");

  await page.locator("#settings-create-profile").click();
  await waitForBodyText(page, "Here's what I found on your system.");
  const activeProfile = await page.evaluate(() =>
    window.localStorage.getItem("bios-ai-active-profile"),
  );
  const preservedSnapshot = await page.evaluate(() =>
    window.localStorage.getItem("bios-ai-onboarding:ember"),
  );
  assertCondition(
    activeProfile === null,
    `Expected fresh profile start to clear active profile, received ${activeProfile}`,
  );
  assertCondition(
    String(preservedSnapshot || "").includes("Ember Prime"),
    "Expected starting a new BOSS profile to preserve the previously saved profile snapshot.",
  );
}

export async function smokeBiosAiUx(repoRoot = resolveRepoRoot(), params = {}) {
  const port = params.port ?? (await resolveAuditPort(DEFAULT_PORT));
  const browserPath = params.browserPath ?? resolveBiosAiUxBrowserPath();
  await ensureBrowserExecutable(browserPath);
  const chromium = await loadPlaywrightChromium(repoRoot, params);

  const serverScriptPath = path.join(repoRoot, "scripts", "bios-ai-ux-audit-server.mjs");
  const server = spawn(process.execPath, [serverScriptPath], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: {
      ...process.env,
      BIOS_AI_UX_AUDIT_PORT: String(port),
    },
  });

  let browser;
  try {
    await waitForServerReady(server, params.serverReadyTimeoutMs ?? 15000);
    browser = await chromium.launch({
      executablePath: browserPath,
      headless: true,
    });
    const page = await browser.newPage();
    page.__biosSmokeErrors = [];
    page.on("pageerror", (error) => {
      page.__biosSmokeErrors.push(`pageerror: ${error?.message || String(error)}`);
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        page.__biosSmokeErrors.push(`console: ${message.text()}`);
      }
    });
    page.on("dialog", async (dialog) => {
      await dialog.accept().catch(() => {});
    });
    const baseUrl = `http://127.0.0.1:${port}`;
    const selectedScenarios = Array.isArray(params.scenarios)
      ? new Set(params.scenarios.map((scenario) => String(scenario)))
      : null;
    const ranScenarios = [];
    const runScenario = async (id, action) => {
      if (selectedScenarios && !selectedScenarios.has(id)) {
        return;
      }
      await page
        .evaluate(() => {
          window.localStorage.clear();
          window.sessionStorage.clear();
        })
        .catch(() => {});
      await action();
      ranScenarios.push(id);
    };

    await runScenario("managed-runtime-entry", () => smokeManagedRuntimeEntry(page, baseUrl));
    await runScenario("hybrid-managed-runtime-install", () =>
      smokeHybridManagedRuntimeInstall(page, baseUrl),
    );
    await runScenario("external-local-runtime-lmstudio", () =>
      smokeExternalLocalRuntimeBranch(page, baseUrl, "onboarding-lmstudio", "LM Studio"),
    );
    await runScenario("external-local-runtime-ollama", () =>
      smokeExternalLocalRuntimeBranch(page, baseUrl, "onboarding-ollama", "Ollama"),
    );
    await runScenario("resume-managed-runtime-setup", () =>
      smokeResumeManagedRuntimeSetup(page, baseUrl),
    );
    await runScenario("local-only-optional-import-failure", () =>
      smokeLocalOnlyOptionalImportFailure(page, baseUrl),
    );
    await runScenario("legacy-ready-without-profile", () =>
      smokeLegacyReadyWithoutProfile(page, baseUrl),
    );
    await runScenario("stale-saved-route-bypass-blocked", () =>
      smokeStaleSavedRouteBypassBlocked(page, baseUrl),
    );
    await runScenario("forge-arena-profile-entry", () =>
      smokeForgeArenaProfileEntry(page, baseUrl),
    );
    await runScenario("forge-arena-local-proving-ground", () =>
      smokeForgeArenaLocalProvingGround(page, baseUrl),
    );
    await runScenario("profiles-without-active-still-show-picker", () =>
      smokeStoredProfilesWithoutActiveStillShowPicker(page, baseUrl),
    );
    await runScenario("soul-governance-review", () => smokeSoulGovernanceReview(page, baseUrl));
    await runScenario("nervous-system-coordination-surface", () =>
      smokeNervousSystemCoordinationSurface(page, baseUrl),
    );
    await runScenario("truthspine-session-update", () =>
      smokeTruthSpineSessionUpdate(page, baseUrl),
    );
    await runScenario("immediate-learning-biomimicry", () =>
      smokeImmediateLearningBiomimicry(page, baseUrl),
    );
    await runScenario("organ-supervisor-recovery-surface", () =>
      smokeOrganSupervisorRecoverySurface(page, baseUrl),
    );
    await runScenario("profile-isolation", () => smokeProfileIsolation(page, baseUrl));
    await runScenario("profile-lifecycle-control-plane", () =>
      smokeProfileLifecycleControlPlane(page, baseUrl),
    );
    await runScenario("settings-control-plane", () => smokeSettingsControlPlane(page, baseUrl));
    await runScenario("sandbox-promotion-lifecycle", () =>
      smokeSandboxPromotionLifecycle(page, baseUrl),
    );
    await runScenario("diagnostics-recovery-surface", () =>
      smokeDiagnosticsRecoverySurface(page, baseUrl),
    );
    await runScenario("delete-last-profile-reopens-onboarding", () =>
      smokeDeleteLastProfileReopensOnboarding(page, baseUrl),
    );
    if (selectedScenarios) {
      const missing = Array.from(selectedScenarios).filter(
        (scenario) => !ranScenarios.includes(scenario),
      );
      assertCondition(
        !missing.length,
        `Unknown BIOS AI UX smoke scenario(s): ${missing.join(", ")}`,
      );
    }

    return {
      repoRoot,
      browserPath,
      baseUrl,
      scenarios: selectedScenarios
        ? ranScenarios
        : [
            "managed-runtime-entry",
            "hybrid-managed-runtime-install",
            "external-local-runtime-lmstudio",
            "external-local-runtime-ollama",
            "resume-managed-runtime-setup",
            "local-only-optional-import-failure",
            "legacy-ready-without-profile",
            "stale-saved-route-bypass-blocked",
            "calibration-shell-visible",
            "forge-arena-profile-entry",
            "forge-arena-local-proving-ground",
            "profiles-without-active-still-show-picker",
            "soul-governance-review",
            "nervous-system-coordination-surface",
            "truthspine-session-update",
            "immediate-learning-biomimicry",
            "organ-supervisor-recovery-surface",
            "profile-isolation",
            "profile-lifecycle-control-plane",
            "settings-control-plane",
            "sandbox-promotion-lifecycle",
            "diagnostics-recovery-surface",
            "delete-last-profile-reopens-onboarding",
          ],
    };
  } finally {
    await browser?.close().catch(() => {});
    server.kill();
  }
}

function isMainModule() {
  const argv1 = process.argv[1];
  if (!argv1) {
    return false;
  }
  return import.meta.url === pathToFileURL(argv1).href;
}

if (isMainModule()) {
  const result = await smokeBiosAiUx();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
