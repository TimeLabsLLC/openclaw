const { contextBridge, ipcRenderer } = require("electron");

async function invoke(command, payload) {
  return ipcRenderer.invoke("bios-ai:invoke", command, payload);
}

contextBridge.exposeInMainWorld("__TAURI__", {
  core: {
    invoke,
  },
  invoke,
});

contextBridge.exposeInMainWorld("__BIOS_AI_DESKTOP_SHELL__", {
  kind: "electron-spike",
  bridge: "tauri-compatible-invoke",
});
