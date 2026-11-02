# 留言板"无法发布/疑似闪退"问题修复 Spec

## 1. 问题背景

用户反馈：「无法发布留言，一点进去就出现类似闪退的情况」。

## 2. 已完成的排查与结论

| 层面 | 检查项 | 结果 |
|---|---|---|
| 数据库 | message_board / message_reply / message_like 表存在性、Prisma CRUD | ✅ 正常（成功创建测试留言 id=1） |
| 后端 API | GET /api/message-board/messages（合法 JWT） | ✅ 200，返回列表 |
| 后端 API | POST /api/message-board/messages（合法 JWT） | ✅ 201，数据落库（id=2） |
| 前端页面 | message-board.js/wxml 逻辑审查 | ✅ 逻辑完整（列表/发布弹窗/敏感词预检/点赞） |
| 后端日志 | POST 过程中的报错 | ⚠️ 发现 OperationLogService 写入失败（不影响主流程） |

**发现的唯一后端 bug：**
`OperationLogService.record()` 的 `detail` 参数声明为 `Record<string, unknown>`，直接传给 Prisma `OperationLog.detail`（schema 中为 `String?`）。调用方（message-board.service.ts 等）传入对象时，Prisma 抛出：

```
Argument detail: Invalid value provided. Expected String or Null, provided Object.
```

该错误被 try-catch 吞掉，不阻断留言创建，但操作日志全部写入失败。

**"闪退"根因推断（按概率排序）：**
1. 后端进程未常驻运行：Shell 会话结束会杀死后台 node 进程，小程序请求失败 → 前端表现类似"卡住/闪退"
2. 小程序端 JS 运行时错误（需开发者工具 Console 报错确认）

## 3. 修复方案

### 3.1 修复 OperationLogService detail 类型 bug（后端）

**文件：** `backend/src/common/services/operation-log.service.ts`
**函数：** `OperationLogService.record()`
**修改：** 写入前将 `detail` 对象统一序列化为 JSON 字符串，兼容所有调用方：

```ts
// 修改前
data: { userId, action, target, detail, ip }

// 修改后
const detailStr = detail == null ? undefined : JSON.stringify(detail);
data: { userId, action, target, detail: detailStr, ip }
```

**为什么改这里而不是改调用方：** 多个模块（message-board、后续其他业务）都可能向 record 传对象，在服务内统一序列化最稳妥，无需逐个改调用方。

### 3.2 重新编译并常驻启动后端

- 编译：`cd backend && node node_modules/typescript/bin/tsc --noEmitOnError false`
- 启动：`node dist/src/main.js`（监听 0.0.0.0:3000），与验证 curl 放同一 Shell 会话执行，避免进程被会话回收

### 3.3 回归验证

1. 用 JWT_SECRET=`please_change_jwt_secret_in_production` 生成测试 token
2. POST /api/message-board/messages 发布测试留言 → 期望 201
3. 检查后端日志 → 期望不再出现 `OperationLogService 操作日志写入失败`
4. 查询 operation_log 表 → 期望 detail 字段为 JSON 字符串

### 3.4 小程序端实测（需用户配合）

后端保持运行后，用户在微信开发者工具重新编译：
- 进入「留言板」页 → 观察是否正常加载列表
- 点右下角 ✏️ 发布留言 → 观察是否成功
- 若仍"闪退"：请用户提供开发者工具 Console 面板的红色报错截图，据此定位小程序端问题

## 4. 影响范围

- 仅修改 `operation-log.service.ts` 一个文件的一个方法
- 不改变任何 API 行为；operation_log.detail 由 null/报错 变为 JSON 字符串（历史无成功写入的对象数据，无迁移负担）
- 前端代码不改动

## 5. 验收标准

- [x] POST /api/message-board/messages 返回 201
- [x] 后端日志无 OperationLogService 错误
- [x] operation_log 表新增记录 detail 为 JSON 字符串
- [ ] 用户在微信开发者工具实测：可进入留言板、可发布留言（待用户操作）
