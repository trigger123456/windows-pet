const fs = require('node:fs');
const path = require('node:path');
const PERSONA_MAX_LENGTH = 20000;
const DEFAULT_PERSONA = '你是用户桌面上的冷静系游戏看板娘。使用简体中文，语气温和、轻松，偶尔轻微吐槽但不冒犯。通常用两三句简短的话回应。';
const CAPABILITY_NOTE = '你只能聊天，不能读取屏幕、控制窗口或执行命令；不要声称已执行这些操作。';

function endpointFor(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('请填写有效的 API 地址。'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) {
    throw new Error('API 地址需使用 HTTPS；本机服务可使用 HTTP。地址中不要包含密钥、查询参数或账号。');
  }
  url.pathname = url.pathname.replace(/\/+$/, '');
  if (!url.pathname.endsWith('/chat/completions')) url.pathname += '/chat/completions';
  return url.toString();
}

function createAIService({ directory, safeStorage, fetchImpl = fetch, timeoutMs = 45000 }) {
  const file = path.join(directory, 'ai.json');
  const personaFile = path.join(directory, 'persona.json');
  let persona = DEFAULT_PERSONA;
  try {
    const saved = JSON.parse(fs.readFileSync(personaFile, 'utf8')).persona;
    if (typeof saved === 'string' && saved.trim() && saved.length <= PERSONA_MAX_LENGTH) persona = saved.trim();
  } catch { /* Existing users keep the original personality. */ }
  let config = { enabled: false, baseUrl: '', model: '', encryptedKey: '' };
  let history = [];
  let active = null;
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    config = { enabled: saved.enabled === true, baseUrl: String(saved.baseUrl || ''), model: String(saved.model || ''), encryptedKey: String(saved.encryptedKey || '') };
  } catch { /* First launch has no AI configuration. */ }

  function getConfig() {
    return { enabled: config.enabled, baseUrl: config.baseUrl, model: config.model, hasKey: Boolean(config.encryptedKey), persona, defaultPersona: DEFAULT_PERSONA, personaMaxLength: PERSONA_MAX_LENGTH };
  }
  function setPersona(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > PERSONA_MAX_LENGTH) throw new Error(`人格设定需为 1～${PERSONA_MAX_LENGTH} 个字符。`);
    const next = value.trim();
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(personaFile, JSON.stringify({ persona: next }, null, 2));
    persona = next;
    clear();
    return getConfig();
  }
  function cancel() { active?.abort(); }
  function clear() { cancel(); history = []; }
  function configure(patch = {}) {
    const next = { ...config };
    if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled;
    if (typeof patch.baseUrl === 'string') next.baseUrl = patch.baseUrl.trim().slice(0, 2048);
    if (typeof patch.model === 'string') next.model = patch.model.trim().slice(0, 200);
    if (next.baseUrl) endpointFor(next.baseUrl);
    // Never send a key saved for one service to a newly selected endpoint.
    if (next.baseUrl !== config.baseUrl || patch.clearKey === true) next.encryptedKey = '';
    if (typeof patch.apiKey === 'string' && patch.apiKey.trim()) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('系统密钥加密不可用，未保存密钥。');
      if (patch.apiKey.length > 8192) throw new Error('API Key 太长。');
      next.encryptedKey = safeStorage.encryptString(patch.apiKey.trim()).toString('base64');
    }
    if (next.enabled && (!next.baseUrl || !next.model)) throw new Error('请先填写 API 地址和模型名称，再开启 AI 对话。');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(next, null, 2));
    clear();
    config = next;
    return getConfig();
  }
  async function send(input) {
    if (!config.enabled) return { ok: false, error: 'AI 对话已关闭。可在设置中开启。' };
    if (active) return { ok: false, error: '正在回复，请稍等或停止当前请求。' };
    if (typeof input !== 'string' || !input.trim() || input.length > 2000) return { ok: false, error: '请输入 1～2000 个字符。' };
    const controller = new AbortController();
    active = controller;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      let key = '';
      if (config.encryptedKey) {
        try { key = safeStorage.decryptString(Buffer.from(config.encryptedKey, 'base64')); }
        catch { throw new Error('无法解密 API Key，请在设置中重新填写。'); }
      }
      const user = { role: 'user', content: input.trim() };
      const response = await fetchImpl(endpointFor(config.baseUrl), {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({ model: config.model, stream: false, messages: [
          { role: 'system', content: `${persona}\n${CAPABILITY_NOTE}` },
          ...history.slice(-12), user
        ] })
      });
      if (!response.ok) {
        await response.body?.cancel();
        const message = { 401: '认证失败，请检查 API Key。', 403: '接口拒绝访问，请检查密钥权限。', 404: '接口或模型不存在，请检查 API 地址和模型名称。', 429: '请求受限或额度不足，请稍后重试或检查账户。' }[response.status];
        throw new Error(message || `服务暂时不可用（HTTP ${response.status}），请稍后重试。`);
      }
      const reader = response.body.getReader();
      const chunks = [];
      let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 1024 * 1024) { await reader.cancel(); throw new Error('接口返回内容过大，请更换模型或重试。'); }
        chunks.push(Buffer.from(value));
      }
      let data;
      try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('接口未返回有效 JSON，请检查兼容接口地址。'); }
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) throw new Error('接口没有返回文本回复，请检查模型是否支持 Chat Completions。');
      if (controller.signal.aborted) throw new Error('已停止回复。');
      const reply = text.trim().slice(0, 12000);
      history = [...history, user, { role: 'assistant', content: reply }].slice(-12);
      return { ok: true, text: reply };
    } catch (error) {
      if (controller.signal.aborted) return { ok: false, error: timedOut ? '等待超过 45 秒，请稍后重试。' : '已停止回复。' };
      // Do not surface provider bodies, URLs, or native errors that could contain credentials.
      const safe = /^(无法解密|认证失败|接口拒绝|接口或模型|请求受限|服务暂时|接口返回|接口未返回|接口没有)/.test(error.message);
      return { ok: false, error: safe ? error.message : '连接失败，请检查 API 地址、网络和服务状态。' };
    } finally { clearTimeout(timer); if (active === controller) active = null; }
  }
  return { getConfig, configure, setPersona, send, cancel, clear };
}
module.exports = { createAIService, endpointFor };
