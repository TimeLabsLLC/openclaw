const { app, BrowserWindow, ipcMain, screen, session, Menu, MenuItem } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { spawn } = require("node:child_process");

// Robust crash logging to catch and diagnose any hidden startup issues
process.on("uncaughtException", (err) => {
  console.error("[electron-main] Uncaught Exception:", err);
  try {
    const logPath = path.join(__dirname, "electron-crash.log");
    fs.writeFileSync(
      logPath,
      `Uncaught Exception at ${new Date().toISOString()}:\n${err.stack || err}\n`,
      { flag: "a" },
    );
  } catch (logErr) {
    console.error("[electron-main] Failed to write crash log:", logErr);
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[electron-main] Unhandled Rejection at:", promise, "reason:", reason);
  try {
    const logPath = path.join(__dirname, "electron-crash.log");
    fs.writeFileSync(
      logPath,
      `Unhandled Rejection at ${new Date().toISOString()}:\n${reason?.stack || reason}\n`,
      { flag: "a" },
    );
  } catch (logErr) {
    console.error("[electron-main] Failed to write crash log:", logErr);
  }
});

let mainWindow = null;
let gatewayProcess = null;
let spawnedGateway = false;

// Resolves the absolute path to Node.exe or falls back to standard PATH
function resolveNodePath() {
  const commonPaths = [
    "C:\\Program Files\\nodejs\\node.exe",
    "C:\\Program Files (x86)\\nodejs\\node.exe",
  ];
  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return "node";
}

// Resolve Aether OS configurations to fetch the active token and port
function resolveConfig() {
  const userProfile = process.env.USERPROFILE || process.env.HOMEPATH || "";
  const paths = [
    path.join(userProfile, ".agentos", "agentos.json"),
    path.join(userProfile, ".openclaw", "openclaw.json"),
  ];
  let token = "";
  let port = 18789;

  for (const configPath of paths) {
    try {
      if (fs.existsSync(configPath)) {
        const data = JSON.parse(fs.readFileSync(configPath, "utf8"));
        if (data.gateway) {
          if (data.gateway.auth && data.gateway.auth.token) {
            token = data.gateway.auth.token;
          }
          if (data.gateway.port) {
            port = data.gateway.port;
          }
        }
        break; // Successfully loaded active file
      }
    } catch (err) {
      console.error("[electron-main] Error parsing config:", err);
    }
  }
  return { token, port };
}

// Probe local gateway health endpoint
function probeGateway(port, callback) {
  let called = false;
  const done = (result) => {
    if (called) return;
    called = true;
    callback(result);
  };

  const options = {
    hostname: "127.0.0.1",
    port: port,
    path: "/health",
    method: "GET",
    timeout: 1000,
  };

  const req = http.request(options, (res) => {
    done(res.statusCode === 200);
  });

  req.on("error", () => {
    done(false);
  });

  req.on("timeout", () => {
    req.destroy();
    done(false);
  });

  req.end();
}

// Spawns the background gateway using the pre-configured Aether OS gateway daemon commands
function startGateway() {
  const localGatewayPath = path.resolve(__dirname, "..", "agentos.mjs");
  if (fs.existsSync(localGatewayPath)) {
    console.log(
      `[electron-main] Spawning local background gateway daemon from: ${localGatewayPath}`,
    );
    
    // Redirect stdio to a secure log file for debugging and auditing
    const userProfile = process.env.USERPROFILE || process.env.HOMEPATH || "";
    const logDir = path.join(userProfile, ".agentos", "logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logStream = fs.createWriteStream(path.join(logDir, "gateway-electron-spawn.log"), { flags: "a" });

    const nodeExecutable = resolveNodePath();
    gatewayProcess = spawn(nodeExecutable, [localGatewayPath, "gateway", "run"], {
      detached: false, // Keep attached so it kills with Electron
      stdio: ["ignore", "pipe", "pipe"],
    });

    gatewayProcess.stdout.pipe(logStream);
    gatewayProcess.stderr.pipe(logStream);

    gatewayProcess.on("error", (err) => {
      console.error("[electron-main] Failed to spawn background gateway daemon:", err);
      logStream.write(`[ERROR] Spawn failed: ${err.message}\n`);
    });
    spawnedGateway = true;
    return;
  }

  const userProfile = process.env.USERPROFILE || process.env.HOMEPATH || "";
  const paths = [
    path.join(userProfile, ".agentos", "gateway.cmd"),
    path.join(userProfile, ".openclaw", "gateway.cmd"),
  ];

  let found = false;
  for (const gatewayCmd of paths) {
    if (fs.existsSync(gatewayCmd)) {
      console.log(`[electron-main] Spawning background gateway daemon from: ${gatewayCmd}`);
      gatewayProcess = spawn("cmd.exe", ["/c", gatewayCmd], {
        detached: false, // Keep attached so it kills with Electron
        stdio: "ignore",
      });
      spawnedGateway = true;
      found = true;
      break;
    }
  }

  if (!found) {
    console.error(`[electron-main] Gateway startup script not found in .agentos or .openclaw`);
  }
}

// Wait recursively until gateway is fully active and answering probes
function waitForGateway(port, retries, delayMs, callback) {
  probeGateway(port, (active) => {
    if (active) {
      console.log("[electron-main] Gateway daemon is active and healthy.");
      callback(true);
    } else if (retries > 0) {
      if (retries === 60) {
        // Start the gateway if it's inactive on first probe
        startGateway();
      }
      setTimeout(() => {
        waitForGateway(port, retries - 1, delayMs, callback);
      }, delayMs);
    } else {
      console.error("[electron-main] Timeout waiting for Gateway to start.");
      callback(false);
    }
  });
}

function createWindow() {
  if (mainWindow) {
    return;
  }

  const { token, port } = resolveConfig();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false, // Enable frameless chrome for floating companion HUD aesthetic
    show: true,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "public", "aether_os_logo.png"), // Bind custom J.A.R.V.I.S. Arc Reactor brand
    backgroundColor: "#05070a", // Dark obsidian theme
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.maximize();

  // Register right-click native context menu for Copy/Paste mouse support
  mainWindow.webContents.on("context-menu", (event, params) => {
    const menu = new Menu();

    if (params.selectionText) {
      menu.append(new MenuItem({ label: "Copy", role: "copy" }));
    }
    if (params.isEditable) {
      menu.append(new MenuItem({ label: "Cut", role: "cut" }));
      menu.append(new MenuItem({ label: "Paste", role: "paste" }));
    }
    menu.append(new MenuItem({ label: "Select All", role: "selectall" }));

    if (menu.items.length > 0) {
      menu.popup({ window: mainWindow });
    }
  });

  // Load our custom Aether Canvas local HTML natively
  const localHtmlPath = path.join(__dirname, "..", "aether-canvas", "index.html");
  console.log(`[electron-main] Loading local canvas: ${localHtmlPath}`);
  mainWindow.loadFile(localHtmlPath, {
    query: {
      port: port.toString(),
      token: token,
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Register IPC window managers
ipcMain.on("window-minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on("window-maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on("window-close", () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on("window-set-minimized-bounds", () => {
  if (!mainWindow) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  const minWidth = 540;
  const minHeight = 64;
  const targetX = Math.round((width - minWidth) / 2);
  const targetY = 10;

  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setResizable(false);
  mainWindow.setFullScreenable(false);

  // Resizes and repositions window smoothly to top-center edge
  mainWindow.setBounds(
    {
      x: targetX,
      y: targetY,
      width: minWidth,
      height: minHeight,
    },
    true,
  );
});

ipcMain.on("window-set-full-bounds", () => {
  if (!mainWindow) return;

  mainWindow.setAlwaysOnTop(false);
  mainWindow.setResizable(true);
  mainWindow.setFullScreenable(true);

  // Restore full size and center window
  mainWindow.setBounds(
    {
      width: 1280,
      height: 800,
    },
    true,
  );
  mainWindow.center();
  mainWindow.maximize();
});

// Wait for Electron initialization
app.whenReady().then(() => {
  const userProfile = process.env.USERPROFILE || process.env.HOMEPATH || "";
  const localCachePath = path.join(userProfile, ".agentos", "electron-cache");
  try {
    if (!fs.existsSync(localCachePath)) {
      fs.mkdirSync(localCachePath, { recursive: true });
    }
    // Set custom user data path to prevent Access is denied (0x5) database IO locks
    app.setPath("userData", localCachePath);
  } catch (err) {
    console.error("[electron-main] Failed to set custom userData path:", err);
  }

  // Intercept WebSocket handshakes and set a valid origin instead of 'file://' to satisfy server checks
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ["ws://127.0.0.1:*/*", "ws://localhost:*/*"] },
    (details, callback) => {
      const keys = Object.keys(details.requestHeaders);
      const originKey = keys.find((k) => k.toLowerCase() === "origin");
      if (originKey && details.requestHeaders[originKey] === "file://") {
        details.requestHeaders[originKey] = "http://localhost";
      } else if (!originKey) {
        details.requestHeaders["Origin"] = "http://localhost";
      }
      callback({ requestHeaders: details.requestHeaders });
    },
  );

  const { port } = resolveConfig();
  console.log(`[electron-main] Probing OpenClaw Gateway on port ${port}...`);

  waitForGateway(port, 60, 500, () => {
    createWindow();
  });
});

// Quit when all windows are closed, and cleanly terminate spawned gateway process
app.on("window-all-closed", () => {
  if (spawnedGateway && gatewayProcess) {
    console.log("[electron-main] Cleaning up and terminating spawned gateway daemon...");
    try {
      // Force kill gateway process tree on Windows
      spawn("taskkill", ["/pid", gatewayProcess.pid, "/f", "/t"]);
    } catch (err) {
      gatewayProcess.kill();
    }
  }
  app.quit();
});
