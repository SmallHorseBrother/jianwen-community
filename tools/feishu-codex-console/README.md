# Codex 任务台

这是飞书需求自动开发流程的本地可视化界面。

## 能看到什么

- 飞书中标记为“是否 AI 自动修改 = 是”的任务
- 计划执行时间、AI 执行状态和业务状态
- Codex 实时日志、worktree、分支和 Git diff
- 测试结果、截图、视频和 HTML 报告
- 原 Codex 会话的后续对话

## 如何继续修改

首次任务完成后，在右侧“继续对话”输入补充要求并发送。任务台会调用：

```text
codex exec resume <原会话 ID>
```

因此后续修改会保留原需求、代码分析、worktree 和验证上下文。

任务处于“执行中”时不能重复发送，避免两个 Codex 同时改同一条任务。

## 构建

在 `D:\files\jianwen-community` 中运行：

```powershell
npx vite build --config tools/feishu-codex-console/vite.config.ts
```

## 启动

```powershell
powershell -ExecutionPolicy Bypass -File tools/feishu-codex-console/start-feishu-codex-console.ps1
```

默认地址：

```text
http://127.0.0.1:47831
```

服务只监听本机地址，不会直接暴露到公网。
