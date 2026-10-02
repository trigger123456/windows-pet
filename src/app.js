const petShell = document.querySelector("#petShell");
const petArt = document.querySelector("#petArt");
const petShadow = document.querySelector("#petShadow");
const petBadge = document.querySelector("#petBadge");
const speechBubble = document.querySelector("#speechBubble");

const isDesktopShell = document.body.dataset.appShell === "desktop";
const desktopPet = window.desktopPet;
let aiEnabled = false;
const characterImage = "./assets/character-v2.png";

const defaultConfig = {
  energy: 58,
  wander: true,
  bubbles: true,
  microActions: true,
  sass: true,
  reminderMinutes: 25,
  idleActionSeconds: 14
};

const stateMachine = {
  idle: { label: "待机", type: "base", sticky: true },
  walk: { label: "散步", type: "base", sticky: true },
  focus: { label: "专注", type: "base", sticky: true },
  sleep: { label: "休息", type: "base", sticky: true },
  celebrate: { label: "庆祝", type: "base", duration: 2200, next: "idle" },
  greet: { label: "招呼", type: "line", duration: 1400, next: "idle" },
  drag: { label: "拖拽", type: "interaction", sticky: true },
  drop: { label: "落地", type: "interaction", duration: 800, next: "idle" },
  click: { label: "点击", type: "interaction", duration: 4200, next: "idle" },
  talk: { label: "说话", type: "line", duration: 1700, next: "idle" },
  think: { label: "思考", type: "line", duration: 1900, next: "idle" },
  remind: { label: "提醒", type: "system", duration: 2200, next: "idle" },
  fail: { label: "失败", type: "system", duration: 2400, next: "idle" },
  wake: { label: "唤醒", type: "interaction", duration: 1000, next: "idle" },
  turn: { label: "观察", type: "line", duration: 1200, next: "idle" },
  edge_peek: { label: "贴边", type: "line", duration: 1600, next: "idle" }
};

const linePools = {
  idle: [
    "我在。今日主线别忘了推进。",
    "待机中。你忙你的，我看着进度条。",
    "安静陪跑模式启动。"
  ],
  walk: [
    "巡查中。桌面暂时没有异常。",
    "移动一下，防止自己像贴图一样卡住。",
    "散步路线确认，地形平坦。"
  ],
  focus: [
    "专注模式。先别分心，十分钟后再看别的。",
    "我把杂念先收进后台了。",
    "现在是主线时间。支线等一下。"
  ],
  sleep: [
    "进入省电状态。需要我时再叫醒。",
    "休息一下。体力条不是无限的。",
    "我先挂起。别把自己也挂起太久。"
  ],
  celebrate: [
    "完成了。嗯，这次值得记一笔。",
    "不错，主线进度加一。",
    "通过。看起来今天的运气还在线。"
  ],
  greet: [
    "欢迎回来。要继续刚才的进度吗？",
    "回来了？缓存还热着。",
    "检测到玩家回归。主线继续。"
  ],
  drag: [
    "检测到非自愿位移。请轻一点。",
    "搬运中。记得放稳。",
    "位置变更申请已被你强行批准。"
  ],
  drop: [
    "落点稳定。没有损坏，暂时。",
    "着陆完成。桌面还活着。",
    "我站好了。你也稳一点。"
  ],
  click: [
    "嗯？我在。今天有什么小事想分享？",
    "点名成功。你的桌面队友已上线。",
    "休息一小会儿？我帮你守着进度。",
    "今天的隐藏任务：找一件让自己开心的小事。",
    "被发现了。我刚刚确实在发呆。",
    "如果桌面是一张地图，这里就是存档点。",
    "要不要猜拳？右键找我，随时应战。",
    "把我拖到屏幕边缘，我帮你守住这边。"
  ],
  talk: [
    "我会说重点。你负责执行。",
    "简报：先做最小的一步。",
    "当前建议：把复杂问题切小。"
  ],
  think: [
    "思考中。这个分支需要一点耐心。",
    "我在整理路线。别急着开新坑。",
    "计算中。大概不是玄学，应该。"
  ],
  remind: [
    "休息一下，体力条不是无限的。",
    "提醒：喝水、眨眼、伸展。顺序随意。",
    "暂停三分钟也算推进，不算逃跑。"
  ],
  fail: [
    "失败用例在发光。要我假装没看见吗？",
    "这里红了。先别逃，红色不会自己变绿。",
    "测试说它有话要讲，语气不太友好。"
  ],
  wake: [
    "唤醒完成。缓存还在，继续吧。",
    "我醒了。你最好也醒着。",
    "恢复运行。主线任务还在等。"
  ],
  turn: [
    "换个方向看。盲区也要检查。",
    "观察确认。后方没有新任务，暂时。",
    "视角切换。没有发现偷懒证据。"
  ],
  edge_peek: [
    "我在边缘观察。你是不是又开小差了？",
    "贴边模式。存在感降低，监督不降低。",
    "我只探头，不打扰。大概。"
  ],
  sass: [
    "支线很多，主线只有一条。你知道我在说什么。",
    "保存一下。别让命运替你做版本管理。",
    "任务不会自己完成，但它很会假装不急。",
    "先别优化到宇宙尽头，能跑起来也很可贵。",
    "这一步不难，只是有点会装难。"
  ]
};

const ambientLineDeck = [
  { state: "greet", weight: 2 },
  { state: "talk", weight: 3 },
  { state: "think", weight: 2 },
  { state: "turn", weight: 2 },
  { state: "edge_peek", weight: 1 }
];

const position = {
  x: 0,
  y: 0,
  vx: 0.4,
  vy: 0,
  turnAt: 0
};

const behavior = {
  config: { ...defaultConfig },
  state: "idle",
  queue: [],
  currentAction: null,
  actionId: 0,
  stateTimer: 0,
  lastReminderAt: performance.now(),
  nextAmbientLineAt: performance.now() + 6000,
  recentLines: new Map()
};

let dragging = false;
let dragOffset = { x: 0, y: 0 };
let lastWanderAt = performance.now();
let pointerStart = { x: 0, y: 0 };
let wasDragged = false;
let desktopDragStart = null;
let desktopTransparentAreaPassthrough = true;
let lastPassthrough = null;
let speechTypeTimer = 0;
let speechTypeToken = 0;
let bumpTimer = 0;
let glideFrame = 0;
let dragSample = { x: 0, y: 0, at: 0 };
let releaseVelocity = { x: 0, y: 0 };
let lastClickAt = 0;
let clickStreak = 0;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let stageWidth = 0;
let stageHeight = 0;
let shellWidth = 0;
let shellHeight = 0;

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(Math.max(number, min), max);
}

function normalizeConfig(config) {
  return {
    energy: clampNumber(config.energy, 0, 100, defaultConfig.energy),
    wander: Boolean(config.wander),
    bubbles: Boolean(config.bubbles),
    microActions: Boolean(config.microActions),
    sass: Boolean(config.sass),
    reminderMinutes: clampNumber(config.reminderMinutes, 5, 60, defaultConfig.reminderMinutes),
    idleActionSeconds: clampNumber(config.idleActionSeconds, 6, 45, defaultConfig.idleActionSeconds)
  };
}

async function loadInitialConfig() {
  if (isDesktopShell && desktopPet?.getSettings) {
    return normalizeConfig(await desktopPet.getSettings());
  }

  return { ...defaultConfig };
}

async function updateConfig(patch, options = {}) {
  const previous = { ...behavior.config };
  behavior.config = normalizeConfig({ ...behavior.config, ...patch });
  if (!options.fromDesktopSettings) {
    if (isDesktopShell && desktopPet?.updateSettings) {
      await desktopPet.updateSettings(patch);
    }
  }
  applyConfigToDom();
  if (patch.reminderMinutes !== undefined && patch.reminderMinutes !== previous.reminderMinutes) {
    resetReminderTimer();
  }
  if (patch.idleActionSeconds !== undefined && patch.idleActionSeconds !== previous.idleActionSeconds) {
    scheduleNextAmbientLine();
  }
}

function applyConfigToDom() {
  document.body.dataset.bubbles = behavior.config.bubbles ? "on" : "off";
}

function pickWeighted(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * total;
  for (const item of items) {
    cursor -= item.weight;
    if (cursor <= 0) {
      return item;
    }
  }
  return items[items.length - 1];
}

function pickLine(poolName) {
  const pool = linePools[poolName] || linePools.idle;
  const recent = behavior.recentLines.get(poolName);
  const candidates = pool.length > 1 ? pool.filter((line) => line !== recent) : pool;
  const line = candidates[Math.floor(Math.random() * candidates.length)];
  behavior.recentLines.set(poolName, line);
  return line;
}

function maybeSassLine(state) {
  if (!behavior.config.sass || state === "sleep" || state === "drag") {
    return pickLine(state);
  }
  return Math.random() < 0.28 ? pickLine("sass") : pickLine(state);
}

function createAction(state, options = {}) {
  const meta = stateMachine[state] || stateMachine.idle;
  return {
    id: ++behavior.actionId,
    state,
    text: options.text || maybeSassLine(state),
    duration: options.duration ?? meta.duration ?? 0,
    sticky: options.sticky ?? meta.sticky ?? false,
    next: options.next ?? meta.next,
    source: options.source || "manual"
  };
}

function updateBehaviorStatus() {
  const meta = stateMachine[behavior.state] || stateMachine.idle;
  if (petBadge) {
    petBadge.textContent = meta.label;
  }
  document.body.dataset.behavior = meta.type;
}

function setSpeechText(text) {
  if (!speechBubble) {
    return;
  }

  const token = ++speechTypeToken;
  window.clearTimeout(speechTypeTimer);

  if (reduceMotion) {
    speechBubble.textContent = text;
    return;
  }

  const chars = Array.from(text);
  let index = 0;
  speechBubble.textContent = "";

  const typeNext = () => {
    if (token !== speechTypeToken) {
      return;
    }
    index += 1;
    speechBubble.textContent = chars.slice(0, index).join("");
    if (index < chars.length) {
      speechTypeTimer = window.setTimeout(typeNext, 16);
    }
  };

  typeNext();
}

function bumpPet() {
  const body = petShell.querySelector(".pet-body");
  if (!body) {
    return;
  }
  body.classList.remove("bump");
  void body.offsetWidth;
  body.classList.add("bump");
  window.clearTimeout(bumpTimer);
  bumpTimer = window.setTimeout(() => body.classList.remove("bump"), 380);
}

function applyState(action) {
  behavior.state = action.state;
  document.body.dataset.state = action.state;

  if (petArt) {
    petArt.src = characterImage;
  }
  if (speechBubble) {
    speechBubble.classList.remove("pop");
    void speechBubble.offsetWidth;
    speechBubble.classList.add("pop");
    setSpeechText(action.text);
  }

  updateBehaviorStatus();
}

function clearCurrentAction() {
  window.clearTimeout(behavior.stateTimer);
  behavior.stateTimer = 0;
  behavior.currentAction = null;
}

function completeAction(action) {
  if (behavior.currentAction?.id !== action.id) {
    return;
  }

  clearCurrentAction();
  if (behavior.queue.length > 0) {
    runNextAction();
    return;
  }

  if (action.next) {
    runAction(createAction(action.next, { source: "transition", sticky: true }));
  }
}

function runAction(action) {
  behavior.currentAction = action;
  applyState(action);

  if (!action.sticky && action.duration > 0) {
    behavior.stateTimer = window.setTimeout(() => completeAction(action), action.duration);
  }
}

function runNextAction() {
  const nextAction = behavior.queue.shift();
  updateBehaviorStatus();
  if (nextAction) {
    runAction(nextAction);
  }
}

function enqueueAction(action, options = {}) {
  if (options.interrupt) {
    clearCurrentAction();
    behavior.queue.length = 0;
    runAction(action);
    return action;
  }

  behavior.queue.push(action);
  updateBehaviorStatus();
  if (!behavior.currentAction || behavior.currentAction.sticky) {
    if (behavior.currentAction?.sticky && behavior.currentAction.state !== "drag") {
      clearCurrentAction();
    }
    runNextAction();
  }
  return action;
}

function setState(nextState, options = {}) {
  return enqueueAction(createAction(nextState, options), { interrupt: options.queue !== true });
}

function queueState(nextState, options = {}) {
  return enqueueAction(createAction(nextState, { ...options, source: options.source || "queue" }));
}

function measureStage() {
  const stageRect = petShell.parentElement.getBoundingClientRect();
  const shellRect = petShell.getBoundingClientRect();
  stageWidth = stageRect.width;
  stageHeight = stageRect.height;
  shellWidth = shellRect.width;
  shellHeight = shellRect.height;
}

function setPetPosition(x, y) {
  const maxX = Math.max(0, stageWidth - shellWidth - 16);
  const maxY = Math.max(0, stageHeight - shellHeight - 16);

  position.x = Math.min(Math.max(x, 16), maxX);
  position.y = Math.min(Math.max(y, isDesktopShell ? 110 : 16), maxY);

  petShell.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
  if (petShadow) {
    petShadow.style.transform = `translate3d(${position.x + 50}px, ${position.y + 278}px, 0)`;
  }
}

function cancelGlide() {
  if (glideFrame) {
    window.cancelAnimationFrame(glideFrame);
    glideFrame = 0;
  }
  petShell.classList.remove("is-gliding");
}

function finishDragInteraction() {
  cancelGlide();
  petShell.style.setProperty("--drag-tilt", "0deg");
  setState("drop");
  scheduleNextAmbientLine();
}

function startGlide(velocityX, velocityY) {
  const speed = Math.hypot(velocityX, velocityY);
  if (reduceMotion || speed < 0.12) {
    finishDragInteraction();
    return;
  }

  cancelGlide();
  const maxSpeed = 1.15;
  const ratio = Math.min(1, maxSpeed / speed);
  let vx = velocityX * ratio;
  let vy = velocityY * ratio;
  let lastAt = performance.now();
  let elapsed = 0;
  let bumped = false;
  petShell.classList.add("is-gliding");

  const glide = (now) => {
    const delta = Math.min(32, now - lastAt);
    lastAt = now;
    elapsed += delta;

    const nextX = position.x + vx * delta;
    const nextY = position.y + vy * delta;
    setPetPosition(nextX, nextY);

    const hitX = Math.abs(position.x - nextX) > 0.1;
    const hitY = Math.abs(position.y - nextY) > 0.1;
    if (hitX) {
      vx *= -0.28;
    }
    if (hitY) {
      vy *= -0.28;
    }
    if ((hitX || hitY) && !bumped) {
      bumped = true;
      bumpPet();
    }

    const dragTilt = Math.max(-4, Math.min(4, vx * 4));
    petShell.style.setProperty("--drag-tilt", `${dragTilt.toFixed(2)}deg`);
    const friction = Math.pow(0.9, delta / 16.67);
    vx *= friction;
    vy *= friction;

    if (Math.hypot(vx, vy) < 0.035 || elapsed > 850) {
      finishDragInteraction();
      return;
    }
    glideFrame = window.requestAnimationFrame(glide);
  };

  glideFrame = window.requestAnimationFrame(glide);
}

function setPointerParallax(event) {
  if (reduceMotion || dragging) {
    return;
  }
  const normalizedX = Math.max(-1, Math.min(1, (event.offsetX / shellWidth - 0.5) * 2));
  const normalizedY = Math.max(-1, Math.min(1, (event.offsetY / shellHeight - 0.5) * 2));
  petShell.style.setProperty("--look-x", `${(normalizedX * 3.5).toFixed(2)}px`);
  petShell.style.setProperty("--look-y", `${(normalizedY * 2.2).toFixed(2)}px`);
}

function resetPointerParallax() {
  petShell.classList.remove("is-hovered");
  petShell.style.setProperty("--look-x", "0px");
  petShell.style.setProperty("--look-y", "0px");
}

function spawnReactionSparks(originX = shellWidth * 0.5, originY = shellHeight * 0.38, count = 5) {
  if (reduceMotion) {
    return;
  }

  for (let index = 0; index < count; index += 1) {
    const spark = document.createElement("span");
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const distance = 24 + Math.random() * 22;
    spark.className = "reaction-spark";
    spark.style.setProperty("--spark-left", `${originX.toFixed(1)}px`);
    spark.style.setProperty("--spark-top", `${originY.toFixed(1)}px`);
    spark.style.setProperty("--spark-x", `${(Math.cos(angle) * distance).toFixed(1)}px`);
    spark.style.setProperty("--spark-y", `${(Math.sin(angle) * distance).toFixed(1)}px`);
    spark.style.setProperty("--spark-delay", `${index * 24}ms`);
    petShell.append(spark);
    spark.addEventListener("animationend", () => spark.remove(), { once: true });
  }
}

function isMotionPaused() {
  return ["sleep", "focus", "think", "remind", "fail", "drag", "celebrate", "drop", "edge_peek"].includes(
    behavior.state
  );
}

const wanderEaseZone = 80;
const wanderMinRatio = 0.3;
const wanderRampMs = 700;

function wander(now) {
  if (dragging || !behavior.config.wander) {
    requestAnimationFrame(wander);
    return;
  }

  if (isMotionPaused()) {
    requestAnimationFrame(wander);
    return;
  }

  const speed = 0.2 + behavior.config.energy / 120;
  if (now - lastWanderAt > 4200) {
    position.vx = (Math.random() > 0.5 ? 1 : -1) * speed;
    position.turnAt = 0;
    lastWanderAt = now;
  }

  const maxX = stageWidth - shellWidth - 16;

  const direction = position.vx > 0 ? 1 : -1;
  const distanceToWall = direction > 0 ? maxX - position.x : position.x - 16;

  if (distanceToWall <= 0) {
    position.vx = -direction * speed * wanderMinRatio;
    position.turnAt = now;
    bumpPet();
    if (behavior.state === "idle" && !behavior.currentAction?.duration) {
      queueState("turn", { source: "wander" });
    }
  } else if (distanceToWall < wanderEaseZone) {
    position.vx = direction * speed * Math.max(wanderMinRatio, distanceToWall / wanderEaseZone);
  } else if (now - position.turnAt < wanderRampMs) {
    position.vx =
      direction * speed * (wanderMinRatio + (1 - wanderMinRatio) * ((now - position.turnAt) / wanderRampMs));
  }

  setPetPosition(position.x + position.vx, position.y + position.vy);
  requestAnimationFrame(wander);
}

function canRunAmbientLine() {
  return (
    behavior.config.microActions &&
    !dragging &&
    behavior.queue.length === 0 &&
    (!behavior.currentAction || behavior.currentAction.sticky) &&
    ["idle", "walk"].includes(behavior.state)
  );
}

function scheduleNextAmbientLine() {
  const base = behavior.config.idleActionSeconds * 1000;
  const jitter = base * (0.55 + Math.random() * 0.9);
  behavior.nextAmbientLineAt = performance.now() + jitter;
}

function maybeRunAmbientLine(now) {
  if (!canRunAmbientLine() || now < behavior.nextAmbientLineAt) {
    return;
  }

  queueState(pickWeighted(ambientLineDeck).state, { source: "ambient" });
  scheduleNextAmbientLine();
}

function resetReminderTimer() {
  behavior.lastReminderAt = performance.now();
}

function maybeRunReminder(now) {
  const interval = behavior.config.reminderMinutes * 60 * 1000;
  if (dragging || behavior.state === "sleep" || now - behavior.lastReminderAt < interval) {
    return;
  }

  behavior.lastReminderAt = now;
  queueState("remind", { source: "reminder" });
}

function behaviorTick() {
  const now = performance.now();
  maybeRunAmbientLine(now);
  maybeRunReminder(now);
}

function isPointInsideElement(element, x, y) {
  if (!element) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function refreshDesktopPassthrough(event) {
  if (!isDesktopShell || !desktopPet || dragging) {
    return;
  }

  const shouldPassthrough =
    desktopTransparentAreaPassthrough && !isPointInsideElement(petShell, event.clientX, event.clientY);
  if (shouldPassthrough === lastPassthrough) {
    return;
  }

  lastPassthrough = shouldPassthrough;
  desktopPet.setMousePassthrough(shouldPassthrough);
}

function playInteraction(action = "chat") {
  let text = pickLine("click");
  let state = "click";
  if (/^rps:[0-2]$/.test(action)) {
    const player = Number(action.slice(-1));
    const opponent = Math.floor(Math.random() * 3);
    const result = (player - opponent + 3) % 3;
    text = "我出" + ["石头", "剪刀", "布"][opponent] + "。" + ["平局！默契不错，再来？", "这局我赢了。下次让你先……开玩笑的。", "你赢了！这次给你记一分。"][result];
    state = result === 2 ? "celebrate" : "talk";
  }
  setState(state, { text, duration: 4800 });
  scheduleNextAmbientLine();
}

function bindPetPointerEvents() {
  petShell.addEventListener("contextmenu", event => {
    if (!desktopPet?.openContextMenu) return;
    event.preventDefault();
    desktopPet.openContextMenu();
  });
  petShell.addEventListener("pointerdown", async (event) => {
    if (event.button !== 0 || dragging) return;
    cancelGlide();
    dragging = true;
    wasDragged = false;
    desktopDragStart = null;
    pointerStart = {
      x: event.clientX,
      y: event.clientY
    };
    dragSample = { x: event.clientX, y: event.clientY, at: performance.now() };
    releaseVelocity = { x: 0, y: 0 };
    // Only enter the drag state after crossing the movement threshold.
    petShell.style.setProperty("--drag-tilt", "0deg");
    lastPassthrough = false;
    desktopPet?.setMousePassthrough(false);
    petShell.setPointerCapture(event.pointerId);
    const rect = petShell.getBoundingClientRect();
    dragOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    if (isDesktopShell && desktopPet) {
      const bounds = await desktopPet.getWindowBounds();
      if (!dragging || !petShell.hasPointerCapture(event.pointerId)) return;
      desktopDragStart = {
        pointerX: event.screenX,
        pointerY: event.screenY,
        x: bounds.x,
        y: bounds.y
      };
    }
  });

  petShell.addEventListener("pointermove", (event) => {
    if (!dragging) {
      setPointerParallax(event);
      return;
    }

    const sampleAt = performance.now();
    const sampleDelta = sampleAt - dragSample.at;
    if (sampleDelta > 0) {
      releaseVelocity = {
        x: (event.clientX - dragSample.x) / sampleDelta,
        y: (event.clientY - dragSample.y) / sampleDelta
      };
      dragSample = { x: event.clientX, y: event.clientY, at: sampleAt };
    }

    const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
    if (distance > 6 && !wasDragged) {
      wasDragged = true;
      setState("drag", { sticky: true });
      petShell.classList.add("is-dragging");
    }
    if (!wasDragged) return;

    if (!reduceMotion) {
      const tilt = Math.max(-5, Math.min(5, (event.clientX - pointerStart.x) * 0.08));
      petShell.style.setProperty("--drag-tilt", `${tilt.toFixed(2)}deg`);
    }

    if (isDesktopShell && desktopPet) {
      if (desktopDragStart) {
        desktopPet.moveWindowTo(
          desktopDragStart.x + event.screenX - desktopDragStart.pointerX,
          desktopDragStart.y + event.screenY - desktopDragStart.pointerY
        );
      }
      return;
    }

    const stage = petShell.parentElement.getBoundingClientRect();
    setPetPosition(event.clientX - stage.left - dragOffset.x, event.clientY - stage.top - dragOffset.y);
  });

  petShell.addEventListener("pointerup", async (event) => {
    if (event.button !== 0 || !dragging) return;
    dragging = false;
    desktopDragStart = null;
    petShell.classList.remove("is-dragging");
    petShell.style.setProperty("--drag-tilt", "0deg");
    petShell.releasePointerCapture(event.pointerId);
    if (!wasDragged) return;

    if (isDesktopShell && desktopPet) {
      const snappedEdge = await desktopPet.endDrag();
      petShell.style.setProperty(
        "--edge-lean",
        snappedEdge === "left" ? "4deg" : snappedEdge === "right" ? "-4deg" : "0deg"
      );
      setState(snappedEdge ? "edge_peek" : "drop");
      lastPassthrough = null;
      refreshDesktopPassthrough(event);
      scheduleNextAmbientLine();
      return;
    }

    if (wasDragged) {
      const releaseAge = performance.now() - dragSample.at;
      startGlide(releaseAge < 90 ? releaseVelocity.x : 0, releaseAge < 90 ? releaseVelocity.y : 0);
    } else {
      finishDragInteraction();
    }
  });

  petShell.addEventListener("pointercancel", () => {
    dragging = false;
    desktopDragStart = null;
    petShell.classList.remove("is-dragging");
    finishDragInteraction();
  });

  petShell.addEventListener("pointerenter", () => {
    if (!dragging) {
      petShell.classList.add("is-hovered");
    }
  });

  petShell.addEventListener("pointerleave", () => {
    if (!dragging) {
      resetPointerParallax();
    }
  });

  petShell.addEventListener("click", (event) => {
    if (!wasDragged) {
      if (aiEnabled && desktopPet) { desktopPet.openAIChat(); return; }
      const now = performance.now();
      clickStreak = now - lastClickAt < 720 ? clickStreak + 1 : 1;
      lastClickAt = now;
      const text =
        clickStreak >= 3
          ? "三连击确认。这里没有隐藏成就，真的。"
          : clickStreak === 2
            ? "又点一次？好吧，我有在听。"
            : pickLine("click");
      setState("click", { text });
      scheduleNextAmbientLine();
      if (event.detail <= 1) {
        const originX = event.detail === 0 ? shellWidth * 0.5 : event.offsetX;
        const originY = event.detail === 0 ? shellHeight * 0.38 : event.offsetY;
        spawnReactionSparks(originX, originY, Math.min(7, clickStreak + 3));
      }
    }
  });

  petShell.addEventListener("dblclick", (event) => {
    event.preventDefault();
    if (aiEnabled) return;
    clickStreak = 0;
    setState("celebrate", { text: "连击成功。给你一个小小的胜利演出。" });
    spawnReactionSparks(event.offsetX, event.offsetY, 6);
  });

  window.addEventListener("resize", () => {
    measureStage();
    setPetPosition(position.x, position.y);
  });
}

function bindDesktopEvents() {
  if (!isDesktopShell || !desktopPet) {
    return;
  }

  window.addEventListener("mousemove", refreshDesktopPassthrough);
  window.addEventListener("mouseleave", () => {
    if (!dragging && desktopTransparentAreaPassthrough) {
      lastPassthrough = true;
      desktopPet.setMousePassthrough(true);
    }
  });

  desktopPet.onSettingsChanged?.((settings) => {
    aiEnabled = Boolean(settings.aiEnabled);
    desktopTransparentAreaPassthrough = Boolean(settings.transparentAreaPassthrough);
    updateConfig(settings, { fromDesktopSettings: true });
  });

  desktopPet.onCommand((command) => {
    if (command?.type === "ai-reply") {
      setState("talk", { text: command.text, duration: 10000 });
      scheduleNextAmbientLine();
    }
    if (command?.type === "interaction") playInteraction(command.action);
    if (command?.type === "state") {
      setState(command.state);
    }

    if (command?.type === "workflow") {
      queueState(command.state, { text: command.text, source: "workflow" });
    }

    if (command?.type === "passthrough") {
      desktopTransparentAreaPassthrough = Boolean(command.enabled);
      lastPassthrough = null;
      desktopPet.setMousePassthrough(!desktopTransparentAreaPassthrough ? false : true);
    }
  });
}

async function init() {
  behavior.config = await loadInitialConfig();
  if (desktopPet?.getAIConfig) aiEnabled = (await desktopPet.getAIConfig()).enabled;
  if (petArt) {
    petArt.src = characterImage;
  }
  bindPetPointerEvents();
  bindDesktopEvents();
  applyConfigToDom();
  measureStage();
  setState("greet");
  setPetPosition(isDesktopShell ? 52 : window.innerWidth * 0.26, isDesktopShell ? stageHeight - shellHeight - 16 : window.innerHeight * 0.42);
  scheduleNextAmbientLine();
  resetReminderTimer();
  window.setInterval(behaviorTick, 1000);
  requestAnimationFrame(wander);
}

init();
