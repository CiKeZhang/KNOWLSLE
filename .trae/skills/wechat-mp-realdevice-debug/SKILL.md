***

name: "wechat-mp-realdevice-debug"
description: "Troubleshoot WeChat Mini Program real-device (preview/真机调试) failures like white screen, __wxAppCode__ not found, routeDone webviewId not found, component injection errors. Invoke when simulator works but phone shows blank/white screen or framework-level SystemError on real device."
--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 微信小程序真机白屏 / 框架级报错排障流程

适用场景：开发者工具**模拟器正常**，但**真机预览/真机调试**白屏、卡在启动页，或 vConsole 出现框架级 SystemError，例如：

- `Can't find variable: __wxAppCode__`（栈含 `recurseUsingComponents` / `injectComponentsRecursively`）

- `[Page route 错误(system error)] routeDone with a webviewId xx is not found`

- `TypeError: Attempting to change configurable attribute of unconfigurable property`（defineProperty, global code）

- `Component is not found in path "wx://not-found"`、`Page "pages/xxx" has not been registered yet`

- 真机调试通道反复"发送失败/重试"、WebSocket disconnected

核心纪律：**证据驱动、隔离定性、一次只改一个变量**，禁止在根因未明时大规模重构业务代码。

***

## 第 0 步：先读"第一条"报错

vConsole/控制台里错误是连锁的，**只看时间顺序最早的第一条**：

- 第一条若是 `defineProperty ... unconfigurable property`（global code 阶段）→ 转译运行时问题（见第 3 步 es6 开关）。

- 第一条若是 `__wxAppCode__` 缺失 → app-service 包未成功加载/注册，属**装配/投递层**问题。

- `routeDone not found`、`timeout`、webviewId 错误几乎总是**更早错误的连锁反应**，不要针对它们本身修。

模拟器与真机差异本身就是线索：模拟器宽松、真机严格。

***

## 第 1 步：隔离实验（一锤定音，先做）

在**改任何业务代码之前**，用最小页面定性：

1. 新建 `pages/test/test.{js,json,wxml,wxss}`：js 里只有 `Page({ data:{msg:'hello'}, onLoad(){ console.log('TEST OK') } })`，wxml 只放一行静态文字，json 为 `{}`。
2. 临时把 `app.json` 的 `pages` 改为**只有** `["pages/test/test"]`（备份原 pages，便于恢复）。
3. 重新编译 → 预览 → 手机扫码（手机上先杀掉小程序重进）。

判定：

- **空页面也白屏/报同样错误 → 环境或构建配置问题**，与业务代码无关。直接跳到第 3、4 步，不要再改页面代码。

- **空页面正常 → 业务代码问题**，进入第 2 步逐页排查（可按 pages 顺序二分加回，定位具体文件）。

实验后务必恢复 `app.json` 并删除测试页。

***

## 第 2 步：代码层清单（仅当空页面正常时）

用脚本批量核验（macOS/Linux）：

1. **页面四件套完整**：`app.json` 的每个 page 都有 `.js/.json/.wxml/.wxss`，缺失 `.json` 在真机组件注入阶段会崩（模拟器不报错）。
2. **每个页面 js 调用了** **`Page()`**，`app.js` 调用了 `App()`；入口页第一个注册。
3. **组件引用可解析**：所有 `.json` 的 `usingComponents` 路径指向真实存在的组件 4 文件；删除组件后必须同步移除引用和 `usingComponents` 声明，否则真机报 `wx://not-found`。
4. **禁止模块顶层** **`const app = getApp()`**：页面模块在 App 实例注册前被求值，真机上 `getApp()` 可能为空。改为在生命周期/方法内调用 `getApp().xxx`。
5. **`es6`** **转译开启时不要用** **`Proxy`**（无法降级为 ES5，会生成异常 defineProperty 代码）。
6. 老基础库下避免可选链 `?.`、空值合并 `??`、逻辑赋值 `||=`、数字分隔符等新语法；或确保不依赖转译且基础库够新。
7. 所有 `require('./xxx')` 相对路径能解析到真实文件。
8. 自定义组件在真机不稳定时，可降级为**普通 WXML + require 的 JS 工具模块**（不经过组件注入），彻底绕开 `injectComponentsRecursively`。

***

## 第 3 步：构建配置清单（project.config.json 与 project.private.config.json 都要查）

**私有配置会覆盖主配置**，两个文件都要核对。逐个开关验证、一次改一个：

| 开关                                                                      | 风险                                                                           | 处置                           |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------- |
| `es6: true`（ES6转ES5）                                                    | 页面用 async/await 时注入的 regenerator 运行时，在真机上下文对不可配置属性 defineProperty 抛错，整包初始化失败 | 真机新基础库原生支持 ES6，可设 `false` 验证 |
| `useIsolateContext: true`                                               | 隔离子上下文(WASubContext)里拿不到主上下文的 `__wxAppCode__` 注册表 → 引用即 ReferenceError       | 设 `false` 验证（两处配置都改）         |
| `lazyCodeLoading: "requiredComponents"`                                 | 按需注入在真机配合自定义组件/角色切换时漏注入页面代码                                                  | 真机白屏排查期间先移除该字段               |
| `enhance` / `useMultiFrameRuntime` / `useApiHook` / `useApiHostProcess` | 多帧/增强运行时打包差异，模拟器不走真机走                                                        | 排障期间统一设 `false`              |
| `ignoreDevUnusedFiles: true`                                            | 构建时误删"看似未用"的文件，真机包缺模块                                                        | 设 `false`                    |
| `compileHotReLoad: true`                                                | 真机加载到损坏的热更新增量包                                                               | 设 `false`                    |
| `libVersion`                                                            | 主配置与私有配置基础库版本不一致/过新导致框架包裹层不兼容                                                | 两边对齐，必要时降到稳定版                |

***

## 第 4 步：环境/投递层（空页面也失败时，命中率最高）

预览走微信 CDN 下载包，真机调试走局域网直推，链路不同，可交叉验证：

1. **清手机坏包缓存**：微信「我→设置→通用→存储空间」清缓存；「发现→小程序」里删除该小程序；彻底杀掉微信重开；再扫**新生成**的预览码（勿扫旧码）。
2. **开发者工具侧清缓存**：工具→清除缓存→全部清除；必要时关闭项目、从项目列表删除记录、重新导入（目录选**包含 app.json 的那一层**，不要选外层目录）。
3. **降调试基础库**：详情→本地设置→调试基础库，从最新版降到稳定版（如 2.33.x / 3.4.x）验证框架包裹层兼容性。
4. **更新/重装开发者工具**与手机微信到最新稳定版；损坏的工具会产出坏预览包。
5. **换投递方式**：预览失败就试真机调试（保持手机与电脑同一局域网、等待连接完成不要提前结束）；反之亦然。
6. **换一台手机**验证，区分是否当前手机微信环境问题。
7. 真机联调后端时：`config` 里 API 地址用**电脑局域网 IP**（不能用 `localhost`，那指向手机自身）；手机与电脑同一 WiFi/热点；开发阶段勾选「不校验合法域名」；正式发布必须公网 HTTPS 域名并在公众平台配置 request 合法域名。

***

## 交付纪律

- 每改一项，让用户：清缓存 → 重新编译（确认模拟器正常）→ 生成**新**预览码 → 手机杀掉小程序重进。

- 要求用户回报 vConsole **第一条**红色报错；错误内容变化即说明方向有效。

- 配置类开关一次只动一个并记录，避免引入不可回溯的变量。

- 不在缺证据时宣布"已修复"；以真机实际渲染结果为唯一验收标准。

