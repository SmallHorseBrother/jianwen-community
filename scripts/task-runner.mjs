import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RUNNER_POLL_INTERVAL_MS = Number(process.env.RUNNER_POLL_INTERVAL_MS || 30000);
const RUNNER_MAX_OUTPUT_CHARS = Number(process.env.RUNNER_MAX_OUTPUT_CHARS || 12000);
const RUNNER_TIMEOUT_MS = Number(process.env.RUNNER_TIMEOUT_MS || 30 * 60 * 1000);
const CODEX_CMD = process.env.CODEX_CMD || 'codex';
const CLAUDE_CMD = process.env.CLAUDE_CMD || 'claude';
const LOG_DIR = process.env.TASK_RUNNER_LOG_DIR || path.resolve(process.cwd(), '.task-runner-logs');
const DRY_RUN = process.argv.includes('--dry-run');
const ONCE = process.argv.includes('--once');
const ENABLE_FULL_ACCESS = process.env.RUNNER_ENABLE_FULL_ACCESS !== 'false';

const priorityRank = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[task-runner] Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

fs.mkdirSync(LOG_DIR, { recursive: true });

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildPrompt(task) {
  return `你现在要处理一个来自任务系统的开发任务。下面这段就是完整任务说明，不需要再去仓库里寻找 TASK.md、工单文件、todo 文件或额外需求文档；也不要向用户追问补充信息。\n\n任务标题：${task.title}\n任务摘要：${task.summary ?? '无'}\n任务类型：${task.type}\n优先级：${task.priority}\n负责人：${task.owner ?? '未指定'}\n所属项目：${task.project_name ?? '未指定项目'}\n项目路径：${task.project_path ?? '未指定路径'}\n建议代理：${task.coding_agent ?? '未指定代理'}\n任务 ID：${task.id}\n来源群：${task.source_group}\n\n强制要求：\n- 只在该项目路径内工作。\n- 先快速理解相关页面与组件，然后直接开始实现。\n- 不要以“缺少任务文件/工单文件/验收文档”为理由停下。\n- 不要回头向用户提问；如果信息不完整，基于当前任务摘要做最合理、最保守的实现。\n- 必须产出实际代码改动，不要只给分析或建议。\n- 优先改动与任务直接相关的页面、组件、样式和必要的 supporting 逻辑。\n- 改完后运行相关检查、构建或测试（如果项目里有）。\n- 自查 diff，确认没有明显多余改动。\n- 最后 commit 并 push 到当前 Git 分支，让现有部署流程自动部署。\n\n如果最终没有产生代码改动，这次任务就算失败，不要把“仓库里没任务文件”当作结果。\n\n完成后请输出：\n1. 修改了哪些文件\n2. 为什么这样改\n3. 如何验证\n4. 是否还有风险或待人工确认项`; 
}

function truncate(text, maxChars = RUNNER_MAX_OUTPUT_CHARS) {
  if (!text) return '';
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n\n[truncated]`;
}

function makeCommand(command, cwd) {
  if (process.platform === 'win32') {
    return {
      cmd: 'cmd.exe',
      args: ['/d', '/s', '/c', command],
      display: command,
      cwd,
    };
  }

  return {
    cmd: 'sh',
    args: ['-lc', command],
    display: command,
    cwd,
  };
}

function runCommand(command, cwd, { timeoutMs = 120000 } = {}) {
  const { cmd, args, display } = makeCommand(command, cwd);

  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      env: process.env,
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    let finished = false;

    const timeout = setTimeout(() => {
      if (finished) return;
      stderr += `\n[runner] command timeout after ${timeoutMs}ms`;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve({ ok: false, code: null, stdout, stderr: `${stderr}\n${error instanceof Error ? error.message : String(error)}`, display });
    });

    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve({ ok: code === 0, code, stdout, stderr, display });
    });
  });
}

async function inspectRepoState(cwd) {
  const branch = await runCommand('git rev-parse --abbrev-ref HEAD', cwd);
  const head = await runCommand('git rev-parse HEAD', cwd);
  const status = await runCommand('git status --short', cwd);
  const last = await runCommand('git log --oneline -n 1', cwd);
  return {
    branch: normalizeText(branch.stdout),
    head: normalizeText(head.stdout),
    status: (status.stdout || '').trim(),
    lastCommit: normalizeText(last.stdout),
  };
}

async function validateTaskExecution(task) {
  const cwd = task.project_path;
  const checks = {
    repo: await inspectRepoState(cwd),
    pushDryRun: await runCommand('git push --dry-run origin HEAD', cwd, { timeoutMs: 120000 }),
  };

  return checks;
}

function formatValidationSummary(validation, beforeRepo, afterRepo) {
  const lines = [];
  lines.push('--- runner validation ---');
  lines.push(`before branch: ${beforeRepo.branch ?? '-'}`);
  lines.push(`before head: ${beforeRepo.head ?? '-'}`);
  lines.push(`after branch: ${afterRepo.branch ?? '-'}`);
  lines.push(`after head: ${afterRepo.head ?? '-'}`);
  lines.push(`last commit: ${afterRepo.lastCommit ?? '-'}`);
  lines.push(`working tree clean: ${afterRepo.status ? 'no' : 'yes'}`);
  lines.push(`push dry-run ok: ${validation.pushDryRun.ok ? 'yes' : 'no'}`);
  lines.push('auto acceptance: disabled (final confirmation is human-owned)');

  if (validation.pushDryRun.stdout?.trim()) {
    lines.push('--- git push --dry-run stdout ---');
    lines.push(validation.pushDryRun.stdout.trim());
  }
  if (validation.pushDryRun.stderr?.trim()) {
    lines.push('--- git push --dry-run stderr ---');
    lines.push(validation.pushDryRun.stderr.trim());
  }

  return truncate(lines.join('\n'));
}

async function fetchReadyTasks() {
  const { data, error } = await supabase
    .from('feedback_tasks')
    .select('*')
    .eq('execution_mode', 'auto_code')
    .eq('execution_status', 'ready')
    .not('project_path', 'is', null)
    .not('coding_agent', 'is', null)
    .order('updated_at', { ascending: true })
    .limit(20);

  if (error) {
    throw error;
  }

  return (data || []).sort((a, b) => {
    const pa = priorityRank[a.priority] ?? 99;
    const pb = priorityRank[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
  });
}

async function updateTask(taskId, updates) {
  const { data, error } = await supabase
    .from('feedback_tasks')
    .update(updates)
    .eq('id', taskId)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function claimTask(task) {
  const { data, error } = await supabase
    .from('feedback_tasks')
    .update({
      status: 'in_progress',
      execution_status: 'queued',
      progress_note: '任务已被本地 runner 接管，等待启动执行。',
    })
    .eq('id', task.id)
    .eq('execution_status', 'ready')
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

function resolveAgentCommand(task, prompt) {
  if (task.coding_agent === 'codex') {
    const codexExecCommand = ENABLE_FULL_ACCESS
      ? `${CODEX_CMD} exec --dangerously-bypass-approvals-and-sandbox -`
      : `${CODEX_CMD} exec --full-auto -`;

    return {
      cmd: process.platform === 'win32' ? 'cmd.exe' : CODEX_CMD,
      args: process.platform === 'win32'
        ? ['/d', '/s', '/c', codexExecCommand]
        : ENABLE_FULL_ACCESS
          ? ['exec', '--dangerously-bypass-approvals-and-sandbox', '-']
          : ['exec', '--full-auto', '-'],
      stdinText: prompt,
      display: `${codexExecCommand} <prompt-from-stdin>`,
    };
  }

  if (task.coding_agent === 'claude') {
    return {
      cmd: process.platform === 'win32' ? 'cmd.exe' : CLAUDE_CMD,
      args: process.platform === 'win32'
        ? ['/d', '/s', '/c', `${CLAUDE_CMD} --permission-mode bypassPermissions --print -`]
        : ['--permission-mode', 'bypassPermissions', '--print', '-'],
      stdinText: prompt,
      display: `${CLAUDE_CMD} --permission-mode bypassPermissions --print - <prompt-from-stdin>`,
    };
  }

  throw new Error(`Unsupported coding_agent: ${task.coding_agent}`);
}

async function runAgentForTask(task) {
  const prompt = buildPrompt(task);
  const cwd = task.project_path;

  if (!cwd || !fs.existsSync(cwd)) {
    throw new Error(`Project path does not exist: ${cwd}`);
  }

  const { cmd, args, stdinText, display } = resolveAgentCommand(task, prompt);
  const logPath = path.join(LOG_DIR, `${task.id}.log`);
  const startTime = Date.now();

  await updateTask(task.id, {
    status: 'in_progress',
    execution_status: 'running',
    progress_note: `本地 runner 已启动 ${task.coding_agent}。\n工作目录：${cwd}\n命令：${display}`,
  });

  if (DRY_RUN) {
    const drySummary = `[dry-run] Would run ${display} in ${cwd}`;
    fs.writeFileSync(logPath, drySummary, 'utf-8');
    return {
      ok: true,
      stdout: drySummary,
      stderr: '',
      code: 0,
      durationMs: 0,
      logPath,
    };
  }

  return await new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      env: process.env,
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    let finished = false;

    const timeout = setTimeout(() => {
      if (finished) return;
      stderr += `\n[runner] Timed out after ${RUNNER_TIMEOUT_MS}ms`;
      child.kill('SIGTERM');
    }, RUNNER_TIMEOUT_MS);

    const append = (chunk, target) => {
      const text = chunk.toString();
      if (target === 'stdout') stdout += text;
      else stderr += text;
      fs.appendFileSync(logPath, text, 'utf-8');
    };

    fs.writeFileSync(logPath, `[runner] Started at ${new Date().toISOString()}\n[runner] cwd=${cwd}\n[runner] command=${display}\n\n`, 'utf-8');

    child.stdout?.on('data', (chunk) => append(chunk, 'stdout'));
    child.stderr?.on('data', (chunk) => append(chunk, 'stderr'));

    if (typeof stdinText === 'string') {
      child.stdin?.write(stdinText);
      child.stdin?.end();
    }

    child.on('error', (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      const message = error instanceof Error ? error.message : String(error);
      fs.appendFileSync(logPath, `\n[runner] spawn error: ${message}`, 'utf-8');
      resolve({
        ok: false,
        stdout,
        stderr: `${stderr}\n${message}`,
        code: null,
        durationMs: Date.now() - startTime,
        logPath,
      });
    });

    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      const durationMs = Date.now() - startTime;
      fs.appendFileSync(logPath, `\n\n[runner] finished code=${code} durationMs=${durationMs}\n`, 'utf-8');
      resolve({
        ok: code === 0,
        stdout,
        stderr,
        code,
        durationMs,
        logPath,
      });
    });
  });
}

async function finalizeTask(task, result) {
  const mergedOutput = truncate([
    result.stdout?.trim(),
    result.stderr?.trim() ? `--- stderr ---\n${result.stderr.trim()}` : '',
    result.logPath ? `--- log ---\n${result.logPath}` : '',
  ].filter(Boolean).join('\n\n'));

  if (result.ok) {
    await updateTask(task.id, {
      status: 'in_progress',
      execution_status: 'review_required',
      progress_note: `本地 runner 执行完成，等待人工审核。\n\n${mergedOutput}`,
    });
    return;
  }

  await updateTask(task.id, {
    status: 'in_progress',
    execution_status: 'failed',
    progress_note: `本地 runner 执行失败。\n\n${mergedOutput}`,
  });
}

async function processOneTask() {
  const readyTasks = await fetchReadyTasks();
  if (readyTasks.length === 0) {
    console.log('[task-runner] No ready tasks found.');
    return false;
  }

  const candidate = readyTasks[0];
  const claimed = await claimTask(candidate);
  if (!claimed) {
    console.log(`[task-runner] Task ${candidate.id} was already claimed by another runner.`);
    return true;
  }

  console.log(`[task-runner] Claimed task ${claimed.id}: ${claimed.title}`);

  try {
    const beforeRepo = await inspectRepoState(claimed.project_path);
    const result = await runAgentForTask(claimed);
    const afterRepo = await inspectRepoState(claimed.project_path);
    const validation = await validateTaskExecution(claimed);

    const repoChanged = beforeRepo.head !== afterRepo.head;
    const pushOk = validation.pushDryRun.ok;
    const validationSummary = formatValidationSummary(validation, beforeRepo, afterRepo);
    const hasReviewableOutcome = result.ok || repoChanged || pushOk;

    if (hasReviewableOutcome) {
      await updateTask(claimed.id, {
        status: 'in_progress',
        execution_status: 'review_required',
        progress_note: truncate(`本地 runner 已形成可审阅结果，等待人工确认。\n\n${validationSummary}\n\n--- agent output ---\n${result.stdout?.trim() || ''}\n${result.stderr?.trim() ? `\n--- agent stderr ---\n${result.stderr.trim()}` : ''}\n\n--- log ---\n${result.logPath}`),
      });
      console.log(`[task-runner] Finished task ${claimed.id} with status review_required`);
    } else {
      await updateTask(claimed.id, {
        status: 'in_progress',
        execution_status: 'failed',
        progress_note: truncate(`本地 runner 未形成可审阅结果。\n\n${validationSummary}\n\n--- agent output ---\n${result.stdout?.trim() || ''}\n${result.stderr?.trim() ? `\n--- agent stderr ---\n${result.stderr.trim()}` : ''}\n\n--- log ---\n${result.logPath}`),
      });
      console.log(`[task-runner] Finished task ${claimed.id} with status failed`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateTask(claimed.id, {
      status: 'in_progress',
      execution_status: 'failed',
      progress_note: `本地 runner 遇到异常。\n\n${truncate(message)}`,
    });
    console.error(`[task-runner] Task ${claimed.id} failed:`, message);
  }

  return true;
}

async function main() {
  console.log(`[task-runner] started. interval=${RUNNER_POLL_INTERVAL_MS}ms dryRun=${DRY_RUN} once=${ONCE}`);

  do {
    try {
      await processOneTask();
    } catch (error) {
      console.error('[task-runner] Loop error:', error instanceof Error ? error.message : error);
    }

    if (ONCE) break;
    await sleep(RUNNER_POLL_INTERVAL_MS);
  } while (true);
}

main().catch((error) => {
  console.error('[task-runner] Fatal error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
