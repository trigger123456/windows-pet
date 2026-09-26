const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopPet", {
  isElectron: true,
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
