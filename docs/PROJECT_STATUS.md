# 项目状态

## 总览

当前项目已经完成可运行的 Electron 桌面宠物原型，并保留 Web 调试入口。角色视觉已切换为单张静止立绘 `src/assets/character-v2.png`，不再使用像素图、动作帧或旧打包图标。

| 模块 | 状态 | 证据 |
| --- | --- | --- |
| Web 原型 | 已完成 | `npm.cmd start`、`src/index.html` |
| Electron 透明窗口 | 已完成 | `electron/main.cjs`、`src/desktop.html` |
| 静止立绘资产 | 已完成 | `src/assets/character-v2.png` |
| Live2D 风格拟态 | 已完成 | `src/styles.css` 中的分层关键帧与遮罩高光 |
| 托盘菜单 | 已完成 | `electron/main.cjs` |
| 鼠标穿透 | 已完成 | `pet:set-mouse-passthrough` IPC |
| 设置窗口 | 已完成 | `src/settings.html`、`src/settings.js` |
| 设置持久化 | 已完成 | Electron `settings.json` |
| 事件队列 | 已完成 | `src/app.js` |
| 随机台词 | 已完成 | `src/app.js` |
| 番茄钟 | 已完成 | `pomodoro:*` IPC |
| Git 工作区检查 | 已完成 | `workflow:check` IPC |
| Git 后台监控 | 已完成 | `workflowMonitor` |
| 构建/测试脚本入口 | 已完成 | `workflow:run-script` IPC |
| AI 工具进程检查 | 已完成 | `workflow:ai-tools` IPC |
| 目录级打包 | 需复验 | `npm.cmd run pack` |
| 安装包/便携版 | 需复验 | `npm.cmd run dist` |
| 代码签名 | 外部依赖 | 需要证书 |
| 自动更新 | 外部依赖 | 需要发布源 |

## 验证命令

```powershell
npm.cmd run check
npm.cmd run test
npm.cmd audit --omit=dev
npm.cmd run pack
```

`npm.cmd run desktop` 会打开 GUI，只有用户明确同意时才运行。

## 当前结论

本地可独立完成的工程、文档和静态验证工作已经更新到静止立绘版本。剩余事项主要依赖用户决策或外部资源：

- 角色最终视觉定稿
- 代码签名证书
- 自动更新发布源
- 真实机器安装验收
