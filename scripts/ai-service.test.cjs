const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAIService, endpointFor } = require('../electron/ai-service.cjs');
const encryption = {
  isEncryptionAvailable: () => true,
  encryptString: text => Buffer.from(text.split('').reverse().join('')),
  decryptString: bytes => bytes.toString().split('').reverse().join('')
};
function service(t, fetchImpl, timeoutMs) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-ai-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const ai = createAIService({ directory, safeStorage: encryption, fetchImpl, timeoutMs });
  return { ai, directory };
}
const config = { baseUrl: 'http://127.0.0.1:12345/v1', model: 'test-model', enabled: true };

test('personality persists separately, replaces context and never changes API configuration', async t => {
  const requests = [];
  const { ai, directory } = service(t, async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return Response.json({ choices: [{ message: { content: '收到，队长。' } }] });
  });
  ai.configure(config);
  const original = fs.readFileSync(path.join(directory, 'ai.json'));
  const defaultPersona = ai.getConfig().defaultPersona;
  await ai.send('旧对话');
  ai.setPersona('叫我队长，温柔且简短。');
  assert.deepEqual(fs.readFileSync(path.join(directory, 'ai.json')), original);
  await ai.send('你好');
  assert.equal(requests[1].messages.length, 2);
  assert.match(requests[1].messages[0].content, /^叫我队长/);
  assert.match(requests[1].messages[0].content, /不能读取屏幕/);
  const reloaded = createAIService({ directory, safeStorage: encryption });
  assert.equal(reloaded.getConfig().persona, '叫我队长，温柔且简短。');
  assert.throws(() => ai.setPersona(' '));
  const limit = ai.getConfig().personaMaxLength;
  const longPersona = '桃桃：温柔陪伴，认真解答。\n'.repeat(400);
  assert(longPersona.length > 2000);
  ai.setPersona(longPersona);
  const longReload = createAIService({ directory, safeStorage: encryption });
  assert.equal(longReload.getConfig().persona, longPersona.trim());
  await ai.send('长人格测试');
  assert(requests.at(-1).messages[0].content.startsWith(longPersona.trim()));
  ai.setPersona('字'.repeat(limit));
  assert.equal(ai.getConfig().persona.length, limit);
  assert.throws(() => ai.setPersona('字'.repeat(limit + 1)));
  assert.equal(ai.getConfig().persona.length, limit, 'Rejected save preserves previous personality');
  ai.setPersona(defaultPersona);
  assert.equal(ai.getConfig().persona, defaultPersona);
  assert.deepEqual(fs.readFileSync(path.join(directory, 'ai.json')), original);
});

test('disabled mode never sends; context and encrypted configuration persist correctly', async t => {
  const requests = [];
  const { ai, directory } = service(t, async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body) });
    return Response.json({ choices: [{ message: { content: '我在。' } }] });
  });
  assert.equal((await ai.send('你好')).ok, false);
  assert.equal(requests.length, 0);
  ai.configure({ ...config, apiKey: 'test-secret-123' });
  assert(!fs.readFileSync(path.join(directory, 'ai.json'), 'utf8').includes('test-secret-123'));
  assert(!JSON.stringify(ai.getConfig()).includes('test-secret-123'));
  assert.equal((await ai.send('你好')).text, '我在。');
  await ai.send('继续');
  assert.equal(requests[0].url, config.baseUrl + '/chat/completions');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer test-secret-123');
  assert.equal(requests[1].body.messages.length, 4);
  ai.clear();
  await ai.send('新话题');
  assert.equal(requests[2].body.messages.length, 2);
  ai.configure({ baseUrl: 'http://127.0.0.1:54321/v1' });
  assert.equal(ai.getConfig().hasKey, false, 'Changing service clears the prior key');
  ai.configure({ enabled: false });
  await ai.send('关闭后');
  assert.equal(requests.length, 3);
  const reloaded = createAIService({ directory, safeStorage: encryption });
  assert.equal(reloaded.getConfig().enabled, false);
  assert.equal(reloaded.getConfig().model, 'test-model');
});

test('configuration rejects invalid endpoints; valid local and full paths work', t => {
  assert.equal(endpointFor('https://example.com/v1/'), 'https://example.com/v1/chat/completions');
  assert.equal(endpointFor('http://localhost:11434/v1/chat/completions'), 'http://localhost:11434/v1/chat/completions');
  for (const url of ['file:///a', 'http://example.com/v1', 'https://user:secret@example.com', 'https://example.com?key=secret']) assert.throws(() => endpointFor(url));
  const { ai } = service(t);
  assert.throws(() => ai.configure({ enabled: true }));
  assert.equal(ai.getConfig().enabled, false);
});

test('HTTP failures and malformed replies return useful errors without provider secrets', async t => {
  for (const response of [new Response('secret-provider-error', { status: 401 }), new Response('not-json'), Response.json({ choices: [] })]) {
    const { ai } = service(t, async () => response);
    ai.configure(config);
    const result = await ai.send('你好');
    assert.equal(result.ok, false);
    assert(!result.error.includes('secret-provider-error'));
  }
});

test('timeout, concurrent send and switching off cancel pending requests', async t => {
  const stalled = (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  const { ai } = service(t, stalled, 30);
  ai.configure(config);
  const pending = ai.send('你好');
  assert.equal((await ai.send('并发')).ok, false);
  assert.match((await pending).error, /等待超过/);
  const second = ai.send('再来');
  ai.configure({ enabled: false });
  assert.match((await second).error, /停止/);
  assert.equal((await ai.send('关闭后')).ok, false);
});
