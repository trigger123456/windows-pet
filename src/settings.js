const api = window.desktopPet;
const status = document.querySelector("#settingsStatus");
const inputs = [...document.querySelectorAll("input")];
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
