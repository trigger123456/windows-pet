const api = window.desktopPet;
const input = document.querySelector('#chatInput');
const messages = document.querySelector('#messages');
const status = document.querySelector('#chatStatus');
const send = document.querySelector('#sendChat');
const stop = document.querySelector('#stopChat');
const clear = document.querySelector('#clearChat');
let enabled = false;
let busy = false;
function controls() {
  input.disabled = !enabled;
  send.disabled = !enabled || busy;
  send.hidden = busy;
  stop.hidden = !busy;
  clear.disabled = busy;
}
function renderConfig(config) {
  enabled = config.enabled;
  status.textContent = enabled ? `AI 已开启 · ${config.model}` : 'AI 已关闭，请在设置中开启。';
  // Every configuration change starts a fresh context in the main process.
  messages.replaceChildren();
  controls();
}
function addMessage(role, text) {
  const item = document.createElement('p');
  item.className = `chat-message ${role}`;
  item.textContent = text;
  messages.append(item);
  while (messages.children.length > 40) messages.firstElementChild.remove();
  messages.scrollTop = messages.scrollHeight;
  return item;
}
document.querySelector('#chatForm').addEventListener('submit', async event => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text || busy || !enabled) return;
  busy = true;
  controls();
  addMessage('user', text);
  input.value = '';
  const pending = addMessage('assistant', '让我想一想…');
  try {
    const result = await api.sendAIMessage(text);
    pending.textContent = result.ok ? result.text : result.error;
    pending.classList.toggle('error', !result.ok);
    if (!result.ok && !input.value) input.value = text;
  } catch { pending.textContent = '发送失败，请重试。'; if (!input.value) input.value = text; }
  finally { busy = false; controls(); messages.scrollTop = messages.scrollHeight; input.focus(); }
});
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault();
    document.querySelector('#chatForm').requestSubmit();
  }
});
stop.addEventListener('click', () => api.cancelAIMessage());
clear.addEventListener('click', async () => {
  try { await api.clearAIChat(); messages.replaceChildren(); input.focus(); }
  catch { status.textContent = '清空失败，请重试。'; }
});
document.querySelector('#chatSettings').addEventListener('click', () => api.openSettings());
api.onAIChanged(renderConfig);
api.getAIConfig().then(config => { renderConfig(config); input.focus(); }).catch(() => { status.textContent = '无法读取 AI 设置。'; controls(); });
