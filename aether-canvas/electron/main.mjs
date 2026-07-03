import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain } from "electron";
import { invokeBiosSidecarCommand, runBiosSidecarSmokeProof } from "./bios-sidecar.mjs";
import { ELECTRON_SHELL_SPIKE_COMMANDS } from "./bridge-contract.mjs";
import { invokeElectronShellSpikeCommand } from "./spike-runtime.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");
const smokeMode = process.env.BIOS_AI_ELECTRON_SMOKE === "1";
const smokeExitMs = Number.parseInt(process.env.BIOS_AI_ELECTRON_SMOKE_EXIT_MS || "1200", 10);
const smokeReportPath = process.env.BIOS_AI_ELECTRON_SMOKE_REPORT || "";
const smokeCommand = process.env.BIOS_AI_ELECTRON_SMOKE_COMMAND || "";
const smokePayloadJson = process.env.BIOS_AI_ELECTRON_SMOKE_PAYLOAD || "";
const smokeUserDataDir = process.env.BIOS_AI_ELECTRON_USER_DATA_DIR || "";
const productFlowProof = process.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_PROOF === "1";
const productFlowProofDir = process.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_DIR || "";
const productFlowScenario = process.env.BIOS_AI_ELECTRON_PRODUCT_FLOW_SCENARIO || "returning-user";

if (smokeMode && smokeUserDataDir) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-3d-apis");
  app.commandLine.appendSwitch("disable-accelerated-2d-canvas");
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-compositing");
  app.commandLine.appendSwitch("disable-gpu-rasterization");
  app.commandLine.appendSwitch("disable-gpu-sandbox");
  app.commandLine.appendSwitch("disable-features", "Vulkan,UseSkiaRenderer,CanvasOopRasterization");
  app.setPath("userData", smokeUserDataDir);
  app.commandLine.appendSwitch("disk-cache-dir", path.join(smokeUserDataDir, "Cache"));
}

async function writeSmokeReport(status, details = {}) {
  if (!smokeMode || !smokeReportPath) {
    return;
  }
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir(path.dirname(smokeReportPath), { recursive: true });
  await writeFile(
    smokeReportPath,
    `${JSON.stringify(
      {
        status,
        appName: "BIOS AI",
        target: "bios-ai",
        shell: "electron",
        bridge: "tauri-compatible-invoke",
        loadedFile: path.join(appRoot, "dist", "index.html"),
        ...details,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function scheduleSmokeQuit() {
  if (!smokeMode) {
    return;
  }
  setTimeout(
    () => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.destroy();
      }
      app.quit();
      setTimeout(() => {
        app.exit(0);
        process.exit(0);
      }, 500);
    },
    Number.isFinite(smokeExitMs) && smokeExitMs > 0 ? smokeExitMs : 1200,
  );
}

function readSmokePayload() {
  if (!smokePayloadJson.trim()) {
    return {};
  }
  return JSON.parse(smokePayloadJson);
}

async function runSmokeCommand() {
  if (!smokeCommand) {
    return null;
  }
  const payload = readSmokePayload();
  try {
    const result = await invokeBiosSidecarCommand(smokeCommand, payload);
    return {
      status: "pass",
      command: smokeCommand,
      payloadSummary: {
        profileId: payload.profileId || payload.profile_id || null,
        workerRole: payload.workerRole || payload.worker_role || null,
        messageCount: Array.isArray(payload.messages) ? payload.messages.length : 0,
      },
      result,
    };
  } catch (error) {
    return {
      status: "fail",
      command: smokeCommand,
      payloadSummary: {
        profileId: payload.profileId || payload.profile_id || null,
        workerRole: payload.workerRole || payload.worker_role || null,
        messageCount: Array.isArray(payload.messages) ? payload.messages.length : 0,
      },
      error: error?.message || String(error),
    };
  } finally {
    if (smokeCommand === "chat_with_local_worker" || smokeCommand === "probe_local_runtime") {
      await invokeBiosSidecarCommand("shutdown_local_worker_runtime").catch(() => null);
    }
  }
}

async function runProductFlowProof(win) {
  if (!productFlowProof || !productFlowProofDir) {
    return null;
  }
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(productFlowProofDir, { recursive: true });
  const surfaces = [];
  async function waitFor(conditionSource, timeoutMs = 5000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const passed = await win.webContents.executeJavaScript(conditionSource).catch(() => false);
      if (passed) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
  }
  async function click(selector) {
    const clicked = await win.webContents
      .executeJavaScript(
        `(() => { const el = document.querySelector(${JSON.stringify(
          selector,
        )}); if (el) { el.click(); return true; } return false; })()`,
      )
      .catch(() => false);
    await new Promise((resolve) => setTimeout(resolve, 250));
    return clicked;
  }
  async function capture(label, selectorToClick = null) {
    if (selectorToClick) {
      await click(selectorToClick);
    }
    const screenshotPath = path.join(productFlowProofDir, `${label}.png`);
    const image = await win.webContents.capturePage();
    await writeFile(screenshotPath, image.toPNG());
    const snapshot = await win.webContents.executeJavaScript(`(() => ({
      bodyText: document.body.innerText.slice(0, 5000),
      hasProfileChooser: document.body.innerText.includes("BOSS profile") || document.body.innerText.includes("Start a new BOSS profile"),
      activeBossName: document.body.dataset.activeBossName || "",
      activeBiosProfileId: document.body.dataset.activeBiosProfileId || "",
      hasLoadedBossProfile: Boolean(document.body.dataset.activeBossName) || document.body.innerText.includes(" is loaded") || document.body.innerText.includes("Resume whenever you're ready"),
      hasBossOnlyChatPlaceholder: Boolean(document.body.dataset.activeBossName) && Boolean(document.querySelector("#chat-input")?.getAttribute("placeholder")?.includes(document.body.dataset.activeBossName)),
      hasFirstRunOnboarding: document.body.innerText.includes("Before I can start helping you") || document.body.innerText.includes("we'll get set up through conversation"),
      hasSettings: Boolean(document.querySelector("#settings-content")),
      hasForgeArena: Boolean(document.querySelector("#forge-arena-run-monitor-progress")) || document.body.innerText.includes("Forge Arena"),
      hasModelManagement: Boolean(document.querySelector("#settings-local-worker-select")) && Boolean(document.querySelector("#settings-install-all-local-workers")),
      hasChatComposer: Boolean(document.querySelector("#chat-input")) && Boolean(document.querySelector("#btn-send")),
    }))()`);
    surfaces.push({ label, screenshotPath, ...snapshot });
  }
  if (productFlowScenario === "first-run") {
    await waitFor(
      `(() => document.body.innerText.includes("Before I can start helping you") || document.body.innerText.includes("we'll get set up through conversation") || document.body.innerText.includes("no forms"))()`,
      8000,
    );
    await capture("first-run-onboarding");
    const firstRunSurface = surfaces.find((surface) => surface.label === "first-run-onboarding");
    const report = {
      status:
        Boolean(firstRunSurface?.hasFirstRunOnboarding) &&
        !firstRunSurface?.hasProfileChooser &&
        !firstRunSurface?.activeBiosProfileId
          ? "pass"
          : "fail",
      scenario: "first-run",
      surfaces,
      firstRunProof: {
        onboardingStarted: Boolean(firstRunSurface?.hasFirstRunOnboarding),
        noSavedProfileRequired: !firstRunSurface?.activeBiosProfileId,
      },
    };
    await writeFile(
      path.join(productFlowProofDir, "product-flow-proof.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    return report;
  }
  await waitFor(
    `(() => document.body.innerText.includes("I found existing BOSS profiles.") || document.body.innerText.includes("BOSS profile"))()`,
  );
  await capture("profile-or-home");
  const profileClicked = await click(".bios-profile-picker");
  await waitFor(
    `(() => Boolean(document.body.dataset.activeBossName) || document.body.innerText.includes("Resume whenever you're ready"))()`,
    8000,
  );
  await capture("selected-boss-profile");
  await capture("settings", '[data-surface="settings"]');
  await capture("forge-arena", '[data-page-target="forge"]');
  await capture("chat", '[data-page-target="home"]');
  const loadedBossProfile = surfaces.some(
    (surface) => surface.label !== "profile-or-home" && surface.hasLoadedBossProfile,
  );
  const chatSurface = surfaces.find((surface) => surface.label === "chat");
  const report = {
    status:
      surfaces.some((surface) => surface.hasProfileChooser || surface.hasChatComposer) &&
      profileClicked &&
      loadedBossProfile &&
      Boolean(chatSurface?.hasBossOnlyChatPlaceholder) &&
      surfaces.some(
        (surface) =>
          surface.label === "settings" && surface.hasSettings && surface.hasModelManagement,
      ) &&
      surfaces.some((surface) => surface.label === "forge-arena" && surface.hasForgeArena)
        ? "pass"
        : "fail",
    surfaces,
    returningUserProof: {
      profileClicked,
      loadedBossProfile,
      bossOnlyChatPlaceholder: Boolean(chatSurface?.hasBossOnlyChatPlaceholder),
    },
  };
  await writeFile(
    path.join(productFlowProofDir, "product-flow-proof.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  return report;
}

function createMainWindow() {
  const win = new BrowserWindow({
    title: "BIOS AI",
    width: 1280,
    height: 800,
    show: false,
    backgroundColor: "#050b10",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webgl: !smokeMode,
    },
  });

  win.once("ready-to-show", () => {
    if (!smokeMode) {
      win.show();
    }
  });

  win.webContents.once("did-finish-load", async () => {
    const sidecarProof = await runBiosSidecarSmokeProof();
    const commandProof = await runSmokeCommand();
    const productFlow = await runProductFlowProof(win);
    void writeSmokeReport("pass", {
      windowTitle: win.getTitle(),
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
      sidecarProof,
      commandProof,
      productFlow,
    });
    scheduleSmokeQuit();
  });

  win.webContents.once("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    void writeSmokeReport("fail", {
      errorCode,
      errorDescription,
      validatedURL,
    });
    scheduleSmokeQuit();
  });

  void win.loadFile(path.join(appRoot, "dist", "index.html"));
  return win;
}

ipcMain.handle("bios-ai:invoke", async (_event, command, payload) => {
  if (!ELECTRON_SHELL_SPIKE_COMMANDS.includes(command)) {
    throw new Error(`Electron shell spike does not expose BIOS AI command: ${command}`);
  }
  return invokeElectronShellSpikeCommand(command, payload);
});

app.whenReady().then(() => {
  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
