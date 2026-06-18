# Feishu Task Runner

This runner turns reviewed Feishu Base records into local Codex tasks.

## Trigger

The runner reads `foodAI-需求以及bug管理` / `AI自动创建`.

A record is eligible only when:

- `是否AI自动修改` is `是`
- `AI执行状态` is empty or `待执行`

The human reviewer controls the handoff by changing `是否AI自动修改`.

## Runner Fields

The runner writes:

- `AI执行状态`: `执行中` / `已完成` / `失败` / `跳过`
- `AI执行日志`: execution log summary
- `AI验证结果`: validation summary, including local log/report paths
- `代码分支/提交`: branch and commit information
- `AI执行项目路径`: resolved project path

## Project Resolution

If `AI执行项目路径` is filled, it wins.

Otherwise the runner reads `来源:` from `原始群聊消息` and resolves it through:

```text
scripts/feishu-task-runner.config.json
```

## Commands

Dry-run one polling pass:

```powershell
npm run feishu:runner:dry
```

Run one real task:

```powershell
npm run feishu:runner:once
```

Run continuously, default 5 minutes:

```powershell
npm run feishu:runner:watch
```

Or start the background wrapper:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-feishu-task-runner.ps1 -IntervalSeconds 300
```

## Execution Model

For each task, the runner creates a separate git worktree under:

```text
D:/files/_feishu-codex-worktrees
```

Codex runs inside that isolated worktree and is instructed to run tests, build checks, and UI/Playwright validation when relevant.
