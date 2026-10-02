const api = window.desktopPet;
const status = document.querySelector("#settingsStatus");
const inputs = [...document.querySelectorAll("input")].filter(input => !input.closest('#aiSection'));
const formatters = {
  scale: value => `${Math.round(value * 100)}%`,
  opacity: value => `${Math.round(value * 100)}%`,
  reminderMinutes: value => `${value} 分钟`,
  pomodoroMinutes: value => `${value} 分钟`,
  idleActionSeconds: value => `${value} 秒`
};

function renderRange(input) {
  const value = Number(input.value);
  document.getElementById(`${input.id}Output`).textContent = formatters[input.id](value);
  input.style.setProperty("--p", `${100 * (value - Number(input.min)) / (Number(input.max) - Number(input.min))}%`);
}

function render(settings) {
  for (const input of inputs) {
    if (input.type === "checkbox") input.checked = settings[input.id];
    else { input.value = settings[input.id]; renderRange(input); }
  }
}

async function init() {
  if (!api) { status.textContent = "请从桌宠右键菜单打开设置。"; return; }
  try {
    render(await api.getSettings());
    api.onSettingsChanged(render);
    await initAI();
    for (const input of inputs) {
      if (input.type === "range") input.addEventListener("input", () => renderRange(input));
      input.addEventListener("change", async () => {
        try {
          await api.updateSettings({ [input.id]: input.type === "checkbox" ? input.checked : Number(input.value) });
          status.textContent = "已保存。";
        } catch { status.textContent = "保存失败，请重试。"; }
      });
    }
  } catch { status.textContent = "无法加载设置，请重新打开。"; }
}

init();

async function initAI() {
  const toggle = document.querySelector('#aiEnabled');
  const address = document.querySelector('#aiBaseUrl');
  const model = document.querySelector('#aiModel');
  const key = document.querySelector('#aiKey');
  const message = document.querySelector('#aiStatus');
  let current = await api.getAIConfig();
  const personaInput = document.querySelector('#aiPersona');
  const personaStatus = document.querySelector('#personaStatus');
  const personaLimit = current.personaMaxLength;
  function updatePersonaCount() {
    const length = personaInput.value.length;
    const overLimit = length > personaLimit;
    document.querySelector('#personaCount').textContent = `${length} / ${personaLimit} 字符${overLimit ? '，超出上限，请缩短后保存。' : '（含空格与换行）'}`;
    personaInput.setCustomValidity(overLimit ? `人格设定不能超过 ${personaLimit} 个字符。` : '');
    personaInput.setAttribute('aria-invalid', String(overLimit));
  }
  personaInput.value = current.persona;
  updatePersonaCount();
  personaInput.addEventListener('input', updatePersonaCount);
  async function savePersona(value) {
    const buttons = [...document.querySelectorAll('#personaForm button')];
    buttons.forEach(button => { button.disabled = true; });
    try {
      const result = await api.setAIPersona(value);
      if (!result.ok) { personaStatus.textContent = result.error; return; }
      personaInput.value = result.config.persona;
      updatePersonaCount();
      personaStatus.textContent = '人格已保存，下次回复生效；旧对话已清空。';
    } catch (error) {
      personaStatus.textContent = /No handler registered|setAIPersona.*not a function/.test(String(error?.message))
        ? '桌宠后台仍是旧版本。请从托盘退出桌宠，再运行 npm.cmd start，然后重新保存。'
        : '人格保存失败，请重启桌宠后重试。';
    }
    finally { buttons.forEach(button => { button.disabled = false; }); }
  }
  document.querySelector('#personaForm').addEventListener('submit', event => { event.preventDefault(); savePersona(personaInput.value); });
  document.querySelector('#resetPersona').addEventListener('click', () => savePersona(current.defaultPersona));
  function renderAI(config, fill = false) {
    current = config;
    toggle.checked = config.enabled;
    if (fill) { address.value = config.baseUrl; model.value = config.model; }
    key.placeholder = config.hasKey ? '已保存；留空保留原密钥' : '本机无鉴权服务可留空';
    document.querySelector('#aiKeyStatus').textContent = config.hasKey ? '密钥已加密保存。更换 API 地址时需重新填写密钥。' : '未保存密钥；密钥将使用系统加密后保存在本机。';
    message.textContent = config.enabled ? '已开启，点击桌宠开始对话。' : '已关闭，点击桌宠使用本地台词。';
  }
  renderAI(current, true);
  api.onAIChanged(config => renderAI(config));
  toggle.addEventListener('change', async () => {
    const enabled = toggle.checked;
    toggle.disabled = true;
    try {
      const result = await api.configureAI({ enabled });
      if (!result.ok) { toggle.checked = current.enabled; message.textContent = result.error; document.querySelector('#aiDetails').open = true; }
      else renderAI(result.config);
    } catch { toggle.checked = current.enabled; message.textContent = '开关保存失败，请重试。'; }
    finally { toggle.disabled = false; }
  });
  document.querySelector('#aiConfigForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter;
    if (button) button.disabled = true;
    try {
      const result = await api.configureAI({ baseUrl: address.value, model: model.value, apiKey: key.value });
      if (result.ok) { key.value = ''; renderAI(result.config, true); message.textContent = '接口已保存。开启 AI 后可点击桌宠发送消息。'; }
      else message.textContent = result.error;
    } catch { message.textContent = '保存失败，请重试。'; }
    finally { if (button) button.disabled = false; }
  });
  document.querySelector('#clearAIKey').addEventListener('click', async () => {
    try {
      const result = await api.configureAI({ clearKey: true, enabled: false });
      if (result.ok) { key.value = ''; renderAI(result.config); message.textContent = '密钥已清除，AI 已关闭。'; }
      else message.textContent = result.error;
    } catch { message.textContent = '清除失败，请重试。'; }
  });
}
