const { app, BrowserWindow, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const output = path.join(__dirname, '..', 'build', 'desktop-smoke');
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, 'profile'));
// An isolated smoke run must not alter the user's Windows startup preference.
app.setLoginItemSettings = () => {};
require('../electron/main.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const errors = [];
app.on('web-contents-created', (_event, contents) => {
  contents.on('console-message', (_event, level, message) => { if (level === 3) errors.push(message); });
});
function native(action, target) {
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, '..', 'electron', 'window-control.ps1'), '-Action', action];
  if (target) args.push('-Handle', target.handle, '-OwnerProcess', String(target.process));
  return new Promise((resolve, reject) => execFile('powershell.exe', args, { windowsHide: true, timeout: 10000 }, (error, stdout) => {
    if (error) reject(error); else { try { resolve(JSON.parse(stdout.trim())); } catch (error) { reject(error); } }
  }));
}
app.whenReady().then(async () => {
  try {
    await delay(1600);
    const pet = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith('desktop.html'));
    assert(pet, 'Desktop window exists');
    await pet.webContents.executeJavaScript('window.desktopPet.updateSettings({microActions:false,wander:false})');
    await delay(150);
    const rect = await pet.webContents.executeJavaScript('(() => {const r=document.querySelector("#petShell").getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()');
    pet.setIgnoreMouseEvents(false);
    pet.webContents.sendInputEvent({ type: 'mouseDown', ...rect, button: 'left', clickCount: 1 });
    pet.webContents.sendInputEvent({ type: 'mouseUp', ...rect, button: 'left', clickCount: 1 });
    await delay(500);
    assert.equal(await pet.webContents.executeJavaScript('document.body.dataset.state'), 'click', 'Click is not overwritten by a drop');
    const first = await pet.webContents.executeJavaScript('document.querySelector("#speechBubble").textContent');
    pet.webContents.send('pet:command', { type: 'interaction', action: 'chat' });
    await delay(650);
    const second = await pet.webContents.executeJavaScript('document.querySelector("#speechBubble").textContent');
    assert.notEqual(first, second, 'Chat does not repeat immediately');
    pet.webContents.send('pet:command', { type: 'interaction', action: 'rps:0' });
    await delay(800);
    assert.match(await pet.webContents.executeJavaScript('document.querySelector("#speechBubble").textContent'), /^我出/);
    fs.writeFileSync(path.join(output, 'pet.png'), (await pet.webContents.capturePage()).toPNG());
    const settings = new BrowserWindow({ width: 420, height: 640, show: false, webPreferences: { preload: path.join(__dirname, '..', 'electron', 'preload.cjs'), contextIsolation: true, nodeIntegration: false } });
    await settings.loadFile(path.join(__dirname, '..', 'src', 'settings.html'));
    await delay(300);
    assert.equal(await settings.webContents.executeJavaScript('document.querySelector("#scale").value'), '1');
    fs.writeFileSync(path.join(output, 'settings.png'), (await settings.webContents.capturePage()).toPNG());
    const targetWindow = new BrowserWindow({ width: 500, height: 400, title: 'Pet smoke target', show: true });
    await targetWindow.loadURL('data:text/html,<title>Pet smoke target</title><h1>Window control smoke test</h1>');
    const target = (await native('list')).find(item => item.title === 'Pet smoke target');
    assert(target, 'Native helper lists the test window');
    const area = screen.getDisplayMatching(targetWindow.getBounds()).workArea;
    await native('left', target);
    assert.equal(targetWindow.getBounds().x, area.x);
    assert.equal(targetWindow.getBounds().width, Math.floor(area.width / 2));
    await native('right', target);
    assert.equal(targetWindow.getBounds().x, area.x + Math.floor(area.width / 2));
    await native('minimize', target);
    assert(targetWindow.isMinimized());
    await native('restore', target);
    assert(!targetWindow.isMinimized());
    await assert.rejects(native('minimize', { ...target, process: 0 }), 'Reject stale/invalid window owner');
    assert.deepEqual(errors, []);
    console.log('PASS: desktop click, nonrepeating chat, game, settings, native window list/move/minimize/restore/owner validation');
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
