const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopPet", {
  isElectron: true,
  getAIConfig: () => ipcRenderer.invoke("ai:get"),
  setAIPersona: (value) => ipcRenderer.invoke("ai:persona", value),
  configureAI: (patch) => ipcRenderer.invoke("ai:configure", patch),
  openAIChat: () => ipcRenderer.send("ai:open"),
  openSettings: () => ipcRenderer.send("settings:open"),
  sendAIMessage: (text) => ipcRenderer.invoke("ai:send", text),
  cancelAIMessage: () => ipcRenderer.send("ai:cancel"),
  clearAIChat: () => ipcRenderer.invoke("ai:clear"),
  onAIChanged: (callback) => {
    const listener = (_event, config) => callback(config);
    ipcRenderer.on("ai:changed", listener);
    return () => ipcRenderer.removeListener("ai:changed", listener);
  },
  openContextMenu: () => ipcRenderer.send("pet:context-menu"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (patch) => ipcRenderer.invoke("settings:update", patch),
  resetSettings: () => ipcRenderer.invoke("settings:reset"),
  getWindowBounds: () => ipcRenderer.invoke("pet:get-window-bounds"),
  moveWindowTo: (x, y) => ipcRenderer.send("pet:set-window-position", { x, y }),
  endDrag: () => ipcRenderer.invoke("pet:end-drag"),
  setMousePassthrough: (enabled) => ipcRenderer.send("pet:set-mouse-passthrough", Boolean(enabled)),
  startPomodoro: (minutes) => ipcRenderer.invoke("pomodoro:start", minutes),
  stopPomodoro: () => ipcRenderer.invoke("pomodoro:stop"),
  getPomodoro: () => ipcRenderer.invoke("pomodoro:get"),
  onCommand: (callback) => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on("pet:command", listener);
    return () => ipcRenderer.removeListener("pet:command", listener);
  },
  onSettingsChanged: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on("settings:changed", listener);
    return () => ipcRenderer.removeListener("settings:changed", listener);
  }
});
