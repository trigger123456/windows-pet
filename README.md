# Windows Pet

Windows Pet 是一个使用 Electron 和原生 HTML/CSS/JavaScript 开发的 Windows 桌宠原型。

项目目前采用单张静止立绘，通过呼吸、重心变化、阴影、气泡和状态反馈营造轻量动态效果。角色定位是冷静系游戏看板娘，主要提供安静陪伴、简短对话、专注提醒和简单的桌面辅助功能。

## 当前能力

- 透明、无边框、始终置顶的桌宠窗口
- 点击对话、双击庆祝、右键互动菜单
- 可选 AI 对话：配置兼容接口，开启后点击角色打开桌面对话窗口
- 拖动桌宠和屏幕边缘吸附
- 自动游走、待机表现、随机台词和轻微吐槽
- 对话气泡、休息提醒和专注计时
- 猜拳小游戏
- 系统托盘中的显示、隐藏、设置和退出入口
- 窗口助手：将其他窗口移动到左右半屏、最小化或还原
- 最多添加 6 个常用 Windows 应用快捷入口
- 桌宠大小、透明度、置顶、开机启动等设置持久化
- 无控制面板的全屏 Web 预览

## 环境要求

- Windows 10 或 Windows 11
- Node.js 与 npm
- Windows PowerShell（窗口助手会调用项目内的 PowerShell 脚本）

## 开发运行

安装依赖：

```powershell
npm.cmd install
```

启动 Electron 桌宠：

```powershell
npm.cmd start
```

下面的命令效果相同：

```powershell
npm.cmd run desktop
```

启动 Web 预览：

```powershell
npm.cmd run dev
```

默认访问地址为：

```text
http://localhost:5173
```

Web 预览只展示桌宠本体，可用于检查立绘、气泡、拖拽、自动游走和点击反馈。桌面窗口、托盘、开机启动、窗口助手等能力只能在 Electron 模式中使用。

## 使用方式

- 单击角色：触发随机对话。
- 双击角色：触发庆祝反馈。
- 拖动角色：移动桌宠；靠近屏幕边缘时自动吸附。
- 右键角色：打开聊天、猜拳、专注、窗口助手、常用应用和设置菜单。
- 单击托盘图标：显示或隐藏桌宠。
- 右键托盘图标：打开与角色右键相同的互动菜单。

### 窗口助手

窗口助手会列出当前可操作的顶层窗口。选择窗口后，可以执行：

- 移到左半屏
- 移到右半屏
- 最小化
- 还原

不同权限级别的程序可能无法被操作；部分应用也会受到自身最小尺寸限制。

### 常用应用

通过“打开应用 → 添加应用…”选择本地 `.exe` 文件。添加后可直接从桌宠右键菜单启动，最多保存 6 个入口，也可以在菜单中单独移除。

### 设置

设置会自动保存到 Electron 的用户数据目录，主要包括：

- 桌宠大小和透明度
- 始终置顶和开机启动
- 自动游走和主动说话
- 对话气泡和轻微吐槽
- 透明区域鼠标穿透
- 休息提醒、台词频率和专注时长
- 桌宠上次所在位置

### 可选 AI 对话

人格设定支持最多 **20000 个字符**，输入框显示实时计数，包含空格、换行（部分 Emoji 占两个计数单位）。长设定可以完整粘贴；超出限制时会提示，不能保存，不会静默截断。人格随每次主动发送的消息一并提交，越长则请求的输入文本越多；保存人格本身不会调用 AI。

在“设置 → AI 对话 → 人格设定”中可编辑称呼、性格、语气和回复长度，点击“保存人格”后从下一次回复生效，也可恢复默认人格。保存时会停止当前请求并清空旧对话；不主动调用模型。人格单独保存在用户数据目录的 `persona.json`，不修改 API 地址、模型或密钥，仅影响 AI 回复，不改变本地随机台词。

默认关闭，未开启时继续使用本地台词，不发送网络请求。

1. 右键角色 → 设置 → AI 对话 → 接口配置。
2. 填写 API 地址（例如 `https://服务地址/v1`）、服务商提供的模型 ID 和 API Key，点击“保存接口”。也可填写完整 `/chat/completions` 地址；本机无鉴权服务可不填密钥。
3. 打开“启用 AI 对话”，点击角色或右键选择“AI 对话”打开桌面对话窗口。
4. Enter 发送、Shift+Enter 换行；支持停止回复和新对话。关闭 AI 后，点击角色恢复本地随机台词。

接口遵循 [Chat Completions 格式](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)，使用非流式文本请求。云端使用 HTTPS，本机回环地址可 HTTP。仅主动发送消息才调用接口，不上传屏幕、窗口列表或文件；AI 回复不会执行窗口操作或命令。

最近 6 轮成功对话用作上下文，只保留在内存中；关窗、修改 AI 配置或开始新对话后清空。请求支持停止和 45 秒超时。AI 设置独立存放在用户数据目录的 `ai.json`，密钥使用系统加密，不向页面回传原密钥；更换接口地址时需重新填写密钥。“清除密钥”同时关闭 AI。

## 检查与测试

执行 JavaScript 语法检查：

```powershell
npm.cmd run check
```

执行默认测试：

包含语法检查和 AI 服务测试：关闭后零请求、上下文、密钥隔离、错误返回、超时与取消。

```powershell
npm.cmd test
```

执行桌面冒烟测试：

```powershell
npm.cmd run test:desktop
```

桌面冒烟测试需要交互式 Windows 会话，会打开测试窗口并生成临时测试数据。它不会移动现有应用窗口，也不会修改开机启动设置。AI 部分通过真实设置页保存配置、切换开关，再访问本地模拟 HTTP 服务验证对话，不需要真实密钥或付费调用。输出位于 `build/desktop-smoke`。

## 打包

生成目录版应用：

```powershell
npm.cmd run pack
```

生成 Windows 安装包和便携版：

```powershell
npm.cmd run dist
```

默认产物位于 `release/`：

- `release/win-unpacked/Windows Pet.exe`
- `release/Windows Pet Setup 0.1.0.exe`
- `release/Windows Pet 0.1.0.exe`

如果修改过源码或角色资源，需要重新打包后，发布文件才会包含最新内容。

## 项目结构

```text
windows pet/
├─ electron/
│  ├─ main.cjs              # Electron 主进程、窗口、托盘和桌面能力
│  ├─ preload.cjs           # 渲染进程可用的受限 IPC 接口
│  ├─ ai-service.cjs        # AI 配置、密钥加密、请求和上下文
│  └─ window-control.ps1    # Windows 窗口枚举和控制
├─ scripts/
│  ├─ dev-server.mjs        # Web 预览静态服务器
│  ├─ ai-service.test.cjs   # AI 服务测试
│  └─ desktop-smoke.cjs     # Electron 桌面冒烟测试
├─ src/
│  ├─ index.html            # 纯桌宠 Web 预览
│  ├─ desktop.html          # Electron 桌宠入口
│  ├─ settings.html         # 设置窗口
│  ├─ chat.html             # 桌面 AI 对话窗口
│  ├─ chat.js               # 发送、停止和新对话
│  ├─ app.js                # 状态、台词、拖拽、游走和互动逻辑
│  ├─ settings.js           # 设置页逻辑
│  ├─ styles.css            # 桌宠、气泡、动效和设置页样式
│  └─ assets/
│     └─ character-v2.png   # 当前使用的角色立绘
├─ docs/                    # 产品、角色、状态与发布文档
└─ package.json
```

## 当前限制

- 角色仍是单张静止立绘，不是 Live2D、Spine 或逐帧动画。
- 默认使用本地台词；AI 接口已通过本地模拟服务测试，真实服务商需用户填写配置后联网验收。
- 窗口助手只操作窗口位置和显示状态，不读取其他应用的内容。
- 尚未配置代码签名和自动更新，正式分发时可能出现 Windows SmartScreen 提示。

## 后续方向

1. 继续优化角色透明边缘、桌面缩放、阴影和气泡位置。
2. 增加窗口布局撤销和更自然的窗口边缘互动。
3. 丰富按时段变化的台词与轻量收集玩法。
4. 在确定角色表现路线后，再评估表情差分、Live2D 或 Spine。
