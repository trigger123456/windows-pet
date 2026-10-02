const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen, dialog, safeStorage } = require("electron");
const { pathToFileURL } = require("node:url");
const { createAIService } = require("./ai-service.cjs");

const baseWindowSize = {
  width: 410,
  height: 450
};

const defaultSettings = {
  alwaysOnTop: true,
  transparentAreaPassthrough: true,
  openAtLogin: false,
  opacity: 1,
  scale: 1,
  bubbles: true,
  wander: true,
  microActions: true,
  sass: true,
  energy: 58,
  reminderMinutes: 25,
  idleActionSeconds: 14,
  linkedApps: [],
  pomodoroMinutes: 25,
  windowBounds: null
};

let petWindow = null;
let settingsWindow = null;
let chatWindow = null;
let ai = null;
let tray = null;
let settings = { ...defaultSettings };
let pomodoroTimer = 0;
let pomodoroEndsAt = 0;

function getAssetPath(...segments) {
  return path.join(__dirname, "..", ...segments);
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function normalizeNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(Math.max(number, min), max);
}

function normalizeBounds(bounds) {
  if (
    !bounds ||
    typeof bounds.x !== "number" ||
    typeof bounds.y !== "number" ||
    typeof bounds.width !== "number" ||
    typeof bounds.height !== "number"
  ) {
    return null;
  }

  return {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height)
  };
}

function normalizeSettings(nextSettings) {
  return {
    ...defaultSettings,
    ...nextSettings,
    alwaysOnTop: Boolean(nextSettings.alwaysOnTop),
    transparentAreaPassthrough: Boolean(nextSettings.transparentAreaPassthrough),
    openAtLogin: Boolean(nextSettings.openAtLogin),
    bubbles: Boolean(nextSettings.bubbles),
    wander: Boolean(nextSettings.wander),
    microActions: Boolean(nextSettings.microActions),
    sass: Boolean(nextSettings.sass),
    opacity: normalizeNumber(nextSettings.opacity, 0.35, 1, defaultSettings.opacity),
    scale: normalizeNumber(nextSettings.scale, 0.65, 1.6, defaultSettings.scale),
    energy: normalizeNumber(nextSettings.energy, 0, 100, defaultSettings.energy),
    reminderMinutes: normalizeNumber(nextSettings.reminderMinutes, 5, 60, defaultSettings.reminderMinutes),
    idleActionSeconds: normalizeNumber(nextSettings.idleActionSeconds, 6, 45, defaultSettings.idleActionSeconds),
    pomodoroMinutes: normalizeNumber(nextSettings.pomodoroMinutes, 5, 120, defaultSettings.pomodoroMinutes),
    linkedApps: Array.isArray(nextSettings.linkedApps) ? nextSettings.linkedApps.filter(item => typeof item?.path === "string" && path.isAbsolute(item.path) && /\.exe$/i.test(item.path)).slice(0, 6).map(item => ({ path: item.path, name: path.basename(item.path, path.extname(item.path)) })) : [],
    windowBounds: normalizeBounds(nextSettings.windowBounds)
  };
}

function loadSettings() {
  try {
    const rawSettings = JSON.parse(fs.readFileSync(getSettingsPath(), "utf8"));
    settings = normalizeSettings({ ...defaultSettings, ...rawSettings });
  } catch {
    settings = { ...defaultSettings };
  }
}

function saveSettings() {
  fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true });
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
}

function broadcastSettings() {
  petWindow?.webContents.send("settings:changed", publicSettings());
  settingsWindow?.webContents.send("settings:changed", publicSettings());
}

function publicSettings() { return { ...settings, aiEnabled: ai?.getConfig().enabled ?? false }; }

function broadcastAI() {
  for (const win of [petWindow, settingsWindow, chatWindow]) win?.webContents.send("ai:changed", ai.getConfig());
  broadcastSettings();
}

function openChatWindow() {
  if (!ai?.getConfig().enabled) { openSettingsWindow(); return; }
  if (chatWindow) { chatWindow.show(); chatWindow.focus(); return; }
  chatWindow = new BrowserWindow({
    width: 420, height: 560, minWidth: 360, minHeight: 430,
    title: "和桌宠聊天", autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false }
  });
  chatWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  chatWindow.webContents.on("will-navigate", event => event.preventDefault());
  chatWindow.loadFile(getAssetPath("src", "chat.html"));
  chatWindow.once("ready-to-show", () => chatWindow?.show());
  chatWindow.on("closed", () => { ai.clear(); chatWindow = null; });
}

function trustedAIEvent(event, pages) {
  return event.senderFrame === event.sender.mainFrame && pages.some(page => event.sender.getURL() === pathToFileURL(getAssetPath("src", page)).href);
}

function getScaledWindowSize(scale = settings.scale) {
  return {
    width: Math.round(baseWindowSize.width * scale),
    height: Math.round(baseWindowSize.height * scale)
  };
}

function getTrayImage() {
  const image = nativeImage.createFromPath(getAssetPath("src", "assets", "character-v2.png"));
  return image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: 16, height: 16 });
}

function clampWindowToWorkArea(bounds) {
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  const x = Math.min(Math.max(bounds.x, area.x), area.x + area.width - bounds.width);
  const y = Math.min(Math.max(bounds.y, area.y), area.y + area.height - bounds.height);
  return { ...bounds, x, y };
}

function getInitialWindowBounds() {
  const size = getScaledWindowSize();
  if (settings.windowBounds) {
    return clampWindowToWorkArea({ ...settings.windowBounds, ...size });
  }

  const primaryArea = screen.getPrimaryDisplay().workArea;
  return {
    ...size,
    x: primaryArea.x + primaryArea.width - size.width - 32,
    y: primaryArea.y + primaryArea.height - size.height - 48
  };
}

function persistPetWindowBounds() {
  if (!petWindow) {
    return;
  }

  settings = normalizeSettings({
    ...settings,
    windowBounds: petWindow.getBounds()
  });
  saveSettings();
  broadcastSettings();
}

function applyLoginItemSettings() {
  try {
    app.setLoginItemSettings({
      openAtLogin: settings.openAtLogin,
      openAsHidden: true
    });
  } catch {
    // Login item support can be limited in development shells.
  }
}

function applySettingsToPetWindow() {
  if (!petWindow) {
    return;
  }

  petWindow.setAlwaysOnTop(settings.alwaysOnTop, "screen-saver");
  petWindow.setOpacity(settings.opacity);
  petWindow.webContents.setZoomFactor(settings.scale);

  const currentBounds = petWindow.getBounds();
  const size = getScaledWindowSize();
  const nextBounds = clampWindowToWorkArea({
    x: currentBounds.x,
    y: currentBounds.y,
    width: size.width,
    height: size.height
  });
  petWindow.setBounds(nextBounds, false);

  if (!settings.transparentAreaPassthrough) {
    petWindow.setIgnoreMouseEvents(false);
  }

  petWindow.webContents.send("pet:command", {
    type: "passthrough",
    enabled: settings.transparentAreaPassthrough
  });
}

function updateSettings(patch) {
  settings = normalizeSettings({ ...settings, ...patch });
  applySettingsToPetWindow();
  applyLoginItemSettings();
  saveSettings();
  broadcastSettings();
  rebuildTrayMenu();
  return settings;
}

function sendPetWorkflow(result) {
  petWindow?.webContents.send("pet:command", {
    type: "workflow",
    state: result.state,
    text: result.text
  });
}

function snapWindowToEdge() {
  if (!petWindow) {
    return null;
  }

  const bounds = petWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  const threshold = 42;
  const distances = [
    { edge: "left", value: Math.abs(bounds.x - area.x) },
    { edge: "right", value: Math.abs(area.x + area.width - (bounds.x + bounds.width)) },
    { edge: "top", value: Math.abs(bounds.y - area.y) },
    { edge: "bottom", value: Math.abs(area.y + area.height - (bounds.y + bounds.height)) }
  ].sort((a, b) => a.value - b.value);

  if (distances[0].value > threshold) {
    petWindow.setBounds(clampWindowToWorkArea(bounds));
    persistPetWindowBounds();
    return null;
  }

  const nextBounds = { ...bounds };

  if (distances[0].edge === "left") {
    nextBounds.x = area.x;
  }

  if (distances[0].edge === "right") {
    nextBounds.x = area.x + area.width - bounds.width;
  }

  if (distances[0].edge === "top") {
    nextBounds.y = area.y;
  }

  if (distances[0].edge === "bottom") {
    nextBounds.y = area.y + area.height - bounds.height;
  }

  petWindow.setBounds(clampWindowToWorkArea(nextBounds));
  petWindow.webContents.send("pet:command", { type: "state", state: "edge_peek" });
  persistPetWindowBounds();
  return distances[0].edge;
}

function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 420,
    height: 640,
    minWidth: 380,
    minHeight: 520,
    title: "Windows Pet 设置",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  settingsWindow.loadFile(getAssetPath("src", "settings.html"));
  settingsWindow.once("ready-to-show", () => {
    settingsWindow?.show();
    broadcastSettings();
  });
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

function sendInteraction(action) {
  petWindow?.webContents.send("pet:command", { type: "interaction", action });
}

async function chooseLinkedApp() {
  const result = await dialog.showOpenDialog({ title: "选择一个常用应用", filters: [{ name: "Windows 应用", extensions: ["exe"] }], properties: ["openFile"] });
  if (result.canceled || !result.filePaths[0]) return;
  const appPath = result.filePaths[0];
  if (!/\.exe$/i.test(appPath) || !path.isAbsolute(appPath)) return;
  if (settings.linkedApps.some(item => item.path.toLowerCase() === appPath.toLowerCase())) return;
  if (settings.linkedApps.length >= 6) {
    sendPetWorkflow({ state: "talk", text: "快捷应用已经有六个了，先移除一个吧。" });
    return;
  }
  updateSettings({ linkedApps: [...settings.linkedApps, { path: appPath }] });
  sendPetWorkflow({ state: "celebrate", text: "记住了。右键就能帮你打开它。" });
}

function launchLinkedApp(item) {
  // Paths originate only from the native file picker, never from a shell command.
  const { spawn } = require("node:child_process");
  const child = spawn(item.path, [], { detached: true, stdio: "ignore", cwd: path.dirname(item.path), shell: false });
  child.once("error", () => sendPetWorkflow({ state: "fail", text: "应用没能打开，可能移动了位置。重新添加试试。" }));
  child.once("spawn", () => sendPetWorkflow({ state: "talk", text: item.name + " 已启动，我在这里等你。" }));
  child.unref();
}

function windowCommand(action, target) {
  return new Promise((resolve, reject) => {
    const helper = app.isPackaged ? path.join(process.resourcesPath, "window-control.ps1") : path.join(__dirname, "window-control.ps1");
    const args = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", helper, "-Action", action, "-ExcludeProcess", String(process.pid)];
    if (target) args.push("-Handle", target.handle, "-OwnerProcess", String(target.process));
    execFile("powershell.exe", args, { windowsHide: true, timeout: 10000, encoding: "utf8" }, (error, stdout) => {
      if (error) { reject(error); return; }
      try { resolve(JSON.parse(stdout.replace(/^\uFEFF/, "").trim())); } catch (error) { reject(error); }
    });
  });
}

async function controlWindow(action, target) {
  try {
    await windowCommand(action, target);
    sendPetWorkflow({ state: "celebrate", text: "窗口整理好了。还需要我帮忙吗？" });
  } catch {
    sendPetWorkflow({ state: "fail", text: "没能操作这个窗口。它可能已关闭，或权限不同。" });
  }
}

let menuLoading = false;
async function showInteractionMenu() {
  if (menuLoading) return;
  menuLoading = true;
  let windows;
  try { windows = await windowCommand("list"); } catch { windows = null; }
  menuLoading = false;
  if (!petWindow || petWindow.isDestroyed()) return;
  Menu.buildFromTemplate(interactionMenu(windows)).popup({ window: petWindow });
}

function interactionMenu(windows) {
  return [
    { label: ai?.getConfig().enabled ? "AI 对话…" : "聊两句", click: () => ai?.getConfig().enabled ? openChatWindow() : sendInteraction("chat") },
    { label: "猜拳", submenu: ["石头", "剪刀", "布"].map((label, index) => ({ label, click: () => sendInteraction("rps:" + index) })) },
    { label: pomodoroTimer ? "结束专注" : "专注 " + settings.pomodoroMinutes + " 分钟", click: () => sendPetWorkflow(pomodoroTimer ? stopPomodoro() : startPomodoro()) },
    { label: "窗口助手", submenu: windows?.length ? windows.map(target => ({
      label: target.title.slice(0, 70).replace(/&/g, "&&"),
      submenu: [["left", "移到左半屏"], ["right", "移到右半屏"], ["minimize", "最小化"], ["restore", "还原"]].map(([action, label]) => ({ label, click: () => controlWindow(action, target) }))
    })) : [{ label: windows === null ? "无法读取窗口，右键重试" : "没有可操作的窗口", enabled: false }] },
    { label: "打开应用", submenu: [
      ...settings.linkedApps.map(item => ({ label: item.name.replace(/&/g, "&&"), click: () => launchLinkedApp(item) })),
      { label: "添加应用…", enabled: settings.linkedApps.length < 6, click: chooseLinkedApp },
      ...(settings.linkedApps.length ? [{ label: "移除快捷入口", submenu: settings.linkedApps.map(item => ({ label: item.name.replace(/&/g, "&&"), click: () => updateSettings({ linkedApps: settings.linkedApps.filter(other => other.path !== item.path) }) })) }] : [])
    ] },
    { type: "separator" },
    { label: "设置…", click: openSettingsWindow },
    { label: petWindow?.isVisible() ? "隐藏桌宠" : "显示桌宠", click: () => { if (petWindow?.isVisible()) petWindow.hide(); else petWindow?.showInactive(); rebuildTrayMenu(); } },
    { label: "退出", click: () => app.quit() }
  ];
}

function rebuildTrayMenu() {
  if (!tray) return;
  tray.setToolTip("Windows Pet · 点击聊天，右键互动");
}

function createTray() {
  tray = new Tray(getTrayImage());
  tray.on("right-click", showInteractionMenu);
  tray.on("click", () => {
    if (petWindow?.isVisible()) {
      petWindow.hide();
    } else {
      petWindow?.showInactive();
    }

    rebuildTrayMenu();
  });
  rebuildTrayMenu();
}

function createPetWindow() {
  petWindow = new BrowserWindow({
    ...getInitialWindowBounds(),
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    maximizable: false,
    minimizable: false,
    hasShadow: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: settings.alwaysOnTop,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  petWindow.setAlwaysOnTop(settings.alwaysOnTop, "screen-saver");
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWindow.setOpacity(settings.opacity);
  petWindow.loadFile(getAssetPath("src", "desktop.html"));

  petWindow.once("ready-to-show", () => {
    petWindow?.showInactive();
    applySettingsToPetWindow();
    broadcastSettings();
  });

  petWindow.on("moved", persistPetWindowBounds);
  petWindow.on("show", rebuildTrayMenu);
  petWindow.on("hide", rebuildTrayMenu);
  petWindow.on("closed", () => {
    petWindow = null;
  });
}

function startPomodoro(minutes = settings.pomodoroMinutes) {
  const safeMinutes = normalizeNumber(minutes, 5, 120, settings.pomodoroMinutes);
  if (pomodoroTimer) {
    clearTimeout(pomodoroTimer);
  }

  pomodoroEndsAt = Date.now() + safeMinutes * 60 * 1000;
  pomodoroTimer = setTimeout(() => {
    pomodoroTimer = 0;
    pomodoroEndsAt = 0;
    rebuildTrayMenu();
    sendPetWorkflow({
      kind: "pomodoro",
      state: "remind",
      text: "番茄钟结束：站起来活动一下，体力条该回一格了。"
    });
  }, safeMinutes * 60 * 1000);

  rebuildTrayMenu();
  return {
    kind: "pomodoro",
    state: "focus",
    text: `番茄钟开始：${safeMinutes} 分钟专注时间。`
  };
}

function stopPomodoro() {
  if (pomodoroTimer) {
    clearTimeout(pomodoroTimer);
  }
  pomodoroTimer = 0;
  pomodoroEndsAt = 0;
  rebuildTrayMenu();
  return {
    kind: "pomodoro",
    state: "talk",
    text: "番茄钟已停止。不是逃跑，是战术调整。"
  };
}

function getPomodoro() {
  return {
    running: Boolean(pomodoroTimer),
    endsAt: pomodoroEndsAt,
    remainingSeconds: pomodoroEndsAt ? Math.max(0, Math.ceil((pomodoroEndsAt - Date.now()) / 1000)) : 0
  };
}

ipcMain.on("pet:context-menu", (event) => {
  if (event.sender === petWindow?.webContents) showInteractionMenu();
});

ipcMain.handle("settings:get", () => publicSettings());

ipcMain.handle("ai:get", () => ai.getConfig());
ipcMain.handle("ai:persona", (event, value) => {
  if (!trustedAIEvent(event, ["settings.html"])) return { ok: false, error: "请从设置页修改人格。" };
  try {
    const config = ai.setPersona(value);
    broadcastAI();
    return { ok: true, config };
  } catch (error) {
    return { ok: false, error: error.message.startsWith("人格设定") ? error.message : "人格保存失败，请重试。" };
  }
});
ipcMain.handle("ai:configure", (event, patch) => {
  if (!trustedAIEvent(event, ["settings.html"])) return { ok: false, error: "请从设置页配置 AI。" };
  try {
    const config = ai.configure(patch);
    broadcastAI();
    return { ok: true, config };
  } catch (error) {
    return { ok: false, error: /^(请|API|系统密钥)/.test(error.message) ? error.message : "配置保存失败，请重试。" };
  }
});
ipcMain.on("ai:open", (event) => { if (trustedAIEvent(event, ["desktop.html", "settings.html"])) openChatWindow(); });
ipcMain.on("settings:open", (event) => { if (trustedAIEvent(event, ["chat.html"])) openSettingsWindow(); });
ipcMain.handle("ai:send", async (event, text) => {
  if (event.sender !== chatWindow?.webContents || !trustedAIEvent(event, ["chat.html"])) return { ok: false, error: "请从对话窗口发送消息。" };
  const result = await ai.send(text);
  if (result.ok) petWindow?.webContents.send("pet:command", { type: "ai-reply", text: result.text.slice(0, 60) });
  return result;
});
ipcMain.on("ai:cancel", (event) => { if (event.sender === chatWindow?.webContents) ai.cancel(); });
ipcMain.handle("ai:clear", (event) => { if (event.sender === chatWindow?.webContents) ai.clear(); });

ipcMain.handle("settings:update", (_event, patch) => {
  if (!patch || typeof patch !== "object") {
    return settings;
  }

  const { linkedApps, windowBounds, aiEnabled, ...preferences } = patch;
  return updateSettings(preferences);
});

ipcMain.handle("settings:reset", () => {
  settings = { ...defaultSettings, linkedApps: settings.linkedApps };
  applySettingsToPetWindow();
  applyLoginItemSettings();
  saveSettings();
  broadcastSettings();
  rebuildTrayMenu();
  return settings;
});

ipcMain.handle("pomodoro:start", (_event, minutes) => startPomodoro(minutes));
ipcMain.handle("pomodoro:stop", stopPomodoro);
ipcMain.handle("pomodoro:get", getPomodoro);

ipcMain.handle("pet:get-window-bounds", () => {
  return petWindow?.getBounds() ?? { x: 0, y: 0, ...getScaledWindowSize() };
});

ipcMain.handle("pet:end-drag", () => {
  if (!petWindow) {
    return null;
  }

  petWindow.setIgnoreMouseEvents(false);
  return snapWindowToEdge();
});

ipcMain.on("pet:set-window-position", (_event, point) => {
  if (!petWindow || typeof point?.x !== "number" || typeof point?.y !== "number") {
    return;
  }

  const bounds = clampWindowToWorkArea({
    ...petWindow.getBounds(),
    x: Math.round(point.x),
    y: Math.round(point.y)
  });

  petWindow.setPosition(bounds.x, bounds.y, false);
});

ipcMain.on("pet:set-mouse-passthrough", (_event, enabled) => {
  if (!petWindow) {
    return;
  }

  petWindow.setIgnoreMouseEvents(Boolean(enabled) && settings.transparentAreaPassthrough, { forward: true });
});

app.whenReady().then(() => {
  app.setAppUserModelId("local.windows-pet");
  loadSettings();
  ai = createAIService({ directory: app.getPath("userData"), safeStorage });
  applyLoginItemSettings();
  createPetWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createPetWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // Keep the tray process alive until the user chooses Quit.
});
