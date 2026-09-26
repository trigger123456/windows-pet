# 发布清单

## 已具备

- Electron 桌面入口：`npm.cmd run desktop`
- 目录级打包：`npm.cmd run pack`
- Windows 安装包和便携版：`npm.cmd run dist`
- 产物目录：`release/`
- 基础检查脚本：`npm.cmd run check`
- 测试入口：`npm.cmd run test`
- 生产依赖审计：`npm.cmd audit --omit=dev`

## 当前产物

- 目录版：`release/win-unpacked/Windows Pet.exe`
- 安装包：`release/Windows Pet Setup 0.1.0.exe`
- 便携版：`release/Windows Pet 0.1.0.exe`

这些产物可能仍是旧版本；角色资产切换为 `src/assets/character-v2.png` 后，需要重新打包才能得到最新产物。

## 发布前必做

1. 确认角色视觉是否定稿。
2. 重新运行 `npm.cmd run check`。
3. 重新运行 `npm.cmd run pack` 或 `npm.cmd run dist`。
4. 在真实机器上手动安装并检查：
   - 透明窗口
   - 置顶
   - 托盘
   - 设置持久化
   - 开机启动
   - 鼠标穿透
   - 静止立绘显示
5. 准备代码签名证书。
6. 决定自动更新渠道。

## 自动更新选项

- GitHub Releases
- 私有 HTTP 更新源
- 对象存储静态更新源

当前仓库没有发布账号、证书或更新服务器配置，因此自动更新不能在本地单方面定稿。

## 签名说明

当前打包流程可以生成安装包和便携版，但正式分发仍应使用可信代码签名证书。没有证书时，Windows SmartScreen 可能提示未知发布者。

## 不要中途打开应用

桌面冒烟测试会打开 Electron GUI。除非用户明确要求或明确同意，不要在协作过程中自动运行：

```powershell
npm.cmd run desktop
```
