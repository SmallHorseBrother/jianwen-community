#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  listTaskSnapshotRecords,
  upsertTaskSnapshots,
} from '../../scripts/feishu-task-snapshots.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const DIST_DIR = path.join(HERE, 'dist');
const DATA_DIR = path.join(HERE, 'data');
const SNAPSHOT_DIR = path.join(DATA_DIR, 'task-snapshots');
const RUNNER_LOG_DIR = path.join(REPO_ROOT, 'logs', 'feishu-task-runner');
const RUNNER_CONFIG_PATH = path.join(REPO_ROOT, 'scripts', 'feishu-task-runner.config.json');
const CODEX_CMD = process.env.CODEX_CMD || 'codex';
const HOST = process.env.FEISHU_CODEX_CONSOLE_HOST || '127.0.0.1';
const PORT = Number(process.env.FEISHU_CODEX_CONSOLE_PORT || process.argv[2] || 47831);
const MAX_BODY_BYTES = 128 * 1024;
const MAX_TEXT_CHARS = 160_000;
const MAX_LOG_TAIL_CHARS = 40_000;
const RESUME_TIMEOUT_MS = Number(process.env.FEISHU_CODEX_RESUME_TIMEOUT_MS || 90 * 60 * 1000);
const RESUME_IDLE_TIMEOUT_MS = Number(
  process.env.FEISHU_CODEX_RESUME_IDLE_TIMEOUT_MS || 20 * 60 * 1000,
);
const RESUME_WATCHDOG_INTERVAL_MS = 30 * 1000;
const MEDIA_EXTENSIONS = new Set([
  '.gif',
  '.html',
  '.jpeg',
  '.jpg',
  '.mp4',
  '.png',
  '.webm',
  '.webp',
]);

fs.mkdirSync(DATA_DIR, { recursive: true });

const activeResumes = new Map();
let taskCache = { expiresAt: 0, value: [] };
let larkQueue = Promise.resolve();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function scalar(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function textValue(value) {
  const item = scalar(value);
  if (item == null) return '';
  if (typeof item === 'object') return JSON.stringify(item);
  return String(item);
}

function listValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value == null ? [] : [value];
}

function truncate(value, max = MAX_TEXT_CHARS) {
  const text = String(value || '');
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[内容已截断，共 ${text.length} 字符]`;
}

function terminateProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    killer.unref();
    return;
  }
  child.kill('SIGTERM');
}

function codexEnvironment() {
  const env = { ...process.env };
  if (env.FEISHU_CODEX_PRESERVE_OPENAI_ENV !== '1') {
    delete env.OPENAI_API_KEY;
    delete env.OPENAI_BASE_URL;
    delete env.OPENAI_MODEL;
  }
  return env;
}

function resolveLarkCommand(args) {
  if (process.platform !== 'win32') {
    return { command: 'lark-cli', args };
  }
  const runScript = path.join(
    process.env.APPDATA || '',
    'npm',
    'node_modules',
    '@larksuite',
    'cli',
    'scripts',
    'run.js',
  );
  if (fs.existsSync(runScript)) {
    return { command: process.execPath, args: [runScript, ...args] };
  }
  return { command: 'lark-cli', args };
}

function spawnCapture(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || REPO_ROOT,
      env: process.env,
      shell: options.shell ?? false,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      stderr += `\n[console] command timed out after ${options.timeoutMs || 120000}ms`;
      child.kill('SIGTERM');
    }, options.timeoutMs || 120000);
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ ok: false, code: null, stdout, stderr: `${stderr}\n${error.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}

function runLark(args) {
  const operation = async () => {
    const command = resolveLarkCommand(args);
    const result = await spawnCapture(command.command, command.args, {
      cwd: REPO_ROOT,
      timeoutMs: 120000,
    });
    if (!result.ok) {
      throw new Error(result.stderr || result.stdout || 'lark-cli failed');
    }
    const payload = JSON.parse(result.stdout.replace(/^\uFEFF/, ''));
    if (payload.ok === false) {
      throw new Error(payload.error?.message || result.stdout);
    }
    return payload;
  };
  const queued = larkQueue.then(operation, operation);
  larkQueue = queued.catch(() => undefined);
  return queued;
}

async function updateRecord(recordId, fields) {
  const config = readJson(RUNNER_CONFIG_PATH);
  return runLark([
    'base',
    '+record-upsert',
    '--as',
    'user',
    '--base-token',
    config.baseToken,
    '--table-id',
    config.tableId,
    '--record-id',
    recordId,
    '--json',
    JSON.stringify(fields),
  ]);
}

function rawRecord(fields, row, recordId) {
  const record = { _recordId: recordId };
  fields.forEach((field, index) => {
    record[field] = row[index];
  });
  return record;
}

function normalizeRecord(record, sourceAvailable = true) {
  const recordId = record._recordId;
  const attachments = listValue(record['附件']).map((attachment) => ({
    name: attachment?.name || '附件',
    size: attachment?.size || 0,
    type: path.extname(attachment?.name || '').slice(1).toLowerCase(),
  }));
  return {
    id: recordId,
    title: textValue(record['需求名称']) || recordId,
    description: textValue(record['需求描述']),
    acceptance: textValue(record['验收标准']),
    plannedAt: textValue(record['计划执行时间']),
    aiEnabled: textValue(record['是否AI自动修改']) === '是',
    executionStatus: textValue(record['AI执行状态']) || '未开始',
    status: textValue(record['状态']) || '未设置',
    priority: textValue(record['优先级']) || '未指定',
    complexity: textValue(record['复杂度']) || '未指定',
    projectKey: textValue(record['项目Key']) || 'foodlink',
    projectPath: textValue(record['AI执行项目路径']),
    executionLog: textValue(record['AI执行日志']),
    validation: textValue(record['AI验证结果']),
    branchCommit: textValue(record['代码分支/提交']),
    testResult: textValue(record['测试结果']),
    attachments,
    sourceAvailable,
  };
}

async function listTasks({ fresh = false } = {}) {
  if (!fresh && Date.now() < taskCache.expiresAt) return taskCache.value;
  const config = readJson(RUNNER_CONFIG_PATH);
  const args = [
    'base',
    '+record-list',
    '--as',
    'user',
    '--base-token',
    config.baseToken,
    '--table-id',
    config.tableId,
    '--offset',
    '0',
    '--limit',
    '200',
  ];
  if (config.viewId) args.push('--view-id', config.viewId);
  const payload = await runLark(args);
  const data = payload.data || {};
  const fields = data.fields || [];
  const liveRecords = (data.data || []).map((row, index) => (
    rawRecord(fields, row, data.record_id_list?.[index])
  ));
  const mergedLiveRecords = upsertTaskSnapshots(SNAPSHOT_DIR, liveRecords);
  const liveIds = new Set(mergedLiveRecords.map((record) => record._recordId));
  const rememberedRecords = listTaskSnapshotRecords(SNAPSHOT_DIR)
    .filter((record) => !liveIds.has(record._recordId));
  const tasks = [
    ...mergedLiveRecords.map((record) => normalizeRecord(record, true)),
    ...rememberedRecords.map((record) => normalizeRecord(record, false)),
  ]
    .filter((task) => task.id && task.aiEnabled)
    .map((task) => ({ ...task, local: localSummary(task.id) }))
    .sort((left, right) => {
      const rank = { 执行中: 0, 待执行: 1, 失败: 2, 已完成: 3, 未开始: 4 };
      return (rank[left.executionStatus] ?? 5) - (rank[right.executionStatus] ?? 5);
    });
  taskCache = { expiresAt: Date.now() + 3000, value: tasks };
  return tasks;
}

function taskLogFiles(recordId) {
  if (!fs.existsSync(RUNNER_LOG_DIR)) return [];
  return fs
    .readdirSync(RUNNER_LOG_DIR)
    .filter((name) => name.startsWith(`${recordId}-`) && name.endsWith('.log'))
    .map((name) => {
      const filePath = path.join(RUNNER_LOG_DIR, name);
      return { filePath, stat: fs.statSync(filePath) };
    })
    .sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs);
}

function parseExecutionContext(logText) {
  const sessionId = logText.match(/session id:\s*([0-9a-f-]{36})/i)?.[1] || '';
  const worktree = logText.match(/^worktree=(.+)$/m)?.[1]?.trim() || '';
  const branch =
    logText.match(/^branch=(.+)$/m)?.[1]?.trim() ||
    logText.match(/^当前分支：(.+)$/m)?.[1]?.trim() ||
    '';
  return { sessionId, worktree, branch };
}

function localSummary(recordId) {
  const files = taskLogFiles(recordId);
  if (files.length === 0) {
    return { hasLog: false, sessionId: '', worktree: '', branch: '', updatedAt: '' };
  }
  for (const entry of files) {
    const content = fs.readFileSync(entry.filePath, 'utf8');
    const context = parseExecutionContext(content);
    if (context.sessionId || context.worktree) {
      return {
        hasLog: true,
        logPath: entry.filePath,
        updatedAt: entry.stat.mtime.toISOString(),
        ...context,
      };
    }
  }
  const newest = files[0];
  return {
    hasLog: true,
    logPath: newest.filePath,
    updatedAt: newest.stat.mtime.toISOString(),
    ...parseExecutionContext(fs.readFileSync(newest.filePath, 'utf8')),
  };
}

async function gitDetails(worktree) {
  if (!worktree || !fs.existsSync(worktree)) {
    return { available: false, status: '', stat: '', diff: '', recentCommits: '' };
  }
  const [status, stat, diff, recentCommits] = await Promise.all([
    spawnCapture('git', ['status', '--short'], { cwd: worktree }),
    spawnCapture('git', ['diff', '--stat', 'HEAD'], { cwd: worktree }),
    spawnCapture('git', ['diff', '--no-color', 'HEAD'], { cwd: worktree }),
    spawnCapture('git', ['log', '--oneline', '-n', '5'], { cwd: worktree }),
  ]);
  return {
    available: true,
    status: truncate(status.stdout, 20_000),
    stat: truncate(stat.stdout, 20_000),
    diff: truncate(diff.stdout, MAX_TEXT_CHARS),
    recentCommits: truncate(recentCommits.stdout, 20_000),
  };
}

async function listArtifacts(worktree, recordId) {
  if (!worktree || !fs.existsSync(worktree)) return [];
  const candidates = new Set();
  const [changed, untracked] = await Promise.all([
    spawnCapture('git', ['diff', '--name-only', 'HEAD'], { cwd: worktree }),
    spawnCapture('git', ['ls-files', '--others', '--exclude-standard'], { cwd: worktree }),
  ]);
  const relevantPaths = new Set([
    ...changed.stdout.split(/\r?\n/).filter(Boolean),
    ...untracked.stdout.split(/\r?\n/).filter(Boolean),
  ]);
  for (const relativePath of relevantPaths) {
    const extension = path.extname(relativePath).toLowerCase();
    if (!MEDIA_EXTENSIONS.has(extension)) continue;
    if (relativePath.includes('node_modules/')) continue;
    const absolutePath = path.resolve(worktree, relativePath);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      candidates.add(absolutePath);
    }
  }
  for (const entry of taskLogFiles(recordId)) {
    const logText = fs.readFileSync(entry.filePath, 'utf8');
    for (const match of logText.matchAll(/[A-Za-z]:\\[^\r\n"'<>|]+\.(?:png|jpe?g|webp|gif|mp4|webm|html)/gi)) {
      const candidate = path.resolve(match[0].trim());
      if (
        candidate.startsWith(path.resolve(worktree)) &&
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile()
      ) {
        candidates.add(candidate);
      }
    }
  }
  return [...candidates]
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
    .slice(0, 30)
    .map((filePath) => ({
      name: path.basename(filePath),
      type: path.extname(filePath).slice(1).toLowerCase(),
      size: fs.statSync(filePath).size,
      url: `/api/tasks/${encodeURIComponent(recordId)}/artifacts/${Buffer.from(filePath).toString('base64url')}`,
    }));
}

function conversationPath(recordId) {
  return path.join(DATA_DIR, `${recordId}.jsonl`);
}

function readConversation(recordId) {
  const filePath = conversationPath(recordId);
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function appendConversation(recordId, event) {
  fs.appendFileSync(
    conversationPath(recordId),
    `${JSON.stringify({ ...event, timestamp: new Date().toISOString() })}\n`,
    'utf8',
  );
}

function parseAgentMessages(jsonLines) {
  const messages = [];
  for (const line of jsonLines.split(/\r?\n/).filter(Boolean)) {
    try {
      const event = JSON.parse(line);
      const item = event.item || event.data?.item;
      if (item?.type === 'agent_message' && item.text) messages.push(item.text);
      if (event.type === 'agent_message' && event.message) messages.push(event.message);
    } catch {
      // Codex may mix non-JSON diagnostics into stderr; the raw log remains available.
    }
  }
  return messages;
}

async function taskDetail(recordId) {
  const tasks = await listTasks();
  const task = tasks.find((item) => item.id === recordId);
  if (!task) return null;
  const logPath = task.local.logPath;
  const logText = logPath && fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
  const active = activeResumes.get(recordId);
  return {
    ...task,
    local: {
      ...task.local,
      logTail: truncate(logText.slice(-MAX_LOG_TAIL_CHARS), MAX_LOG_TAIL_CHARS),
      activeResume: active
        ? {
            startedAt: active.startedAt,
            output: truncate(active.output.slice(-50_000), 50_000),
          }
        : null,
    },
    git: await gitDetails(task.local.worktree),
    artifacts: await listArtifacts(task.local.worktree, recordId),
    conversation: readConversation(recordId),
  };
}

async function startResume(recordId, message) {
  const tasks = await listTasks({ fresh: true });
  const task = tasks.find((item) => item.id === recordId);
  if (!task) throw Object.assign(new Error('没有找到这条飞书任务。'), { statusCode: 404 });
  const running = tasks.find((item) => item.executionStatus === '执行中');
  if (running) {
    throw Object.assign(
      new Error(`当前任务“${running.title}”仍在执行，请完成后再发送后续修改。`),
      { statusCode: 409 },
    );
  }
  if (activeResumes.has(recordId)) {
    throw Object.assign(new Error('这条任务已有一轮续改正在执行。'), { statusCode: 409 });
  }
  if (!task.local.sessionId || !task.local.worktree || !fs.existsSync(task.local.worktree)) {
    throw Object.assign(new Error('这条任务还没有可恢复的 Codex 会话或 worktree。'), {
      statusCode: 409,
    });
  }

  const prompt = `这是用户从本地 AI 开发任务台发送的后续反馈。请沿用当前任务上下文，直接继续处理，不要重新实现无关部分。

用户反馈：
${message}

执行要求：
- 继续在当前 worktree 和分支内修改。
- 先检查已有改动和上一次验证结果。
- 修改后运行与变更相关的测试；涉及界面时补充可查看的截图或报告。
- 有代码改动时创建一个新的 git commit，提交信息以 "feishu-followup: " 开头。
- 最终清楚说明修改、验证、截图/报告路径和仍需人工确认的内容。`;

  const logPath = path.join(
    RUNNER_LOG_DIR,
    `${recordId}-conversation-${Date.now()}.log`,
  );
  const state = {
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
    lastOutputAtMs: Date.now(),
    output: '',
    logPath,
  };
  activeResumes.set(recordId, state);
  appendConversation(recordId, { role: 'user', content: message, status: 'sent' });
  try {
    await updateRecord(recordId, {
      AI执行状态: '执行中',
      状态: '开发中',
      AI执行日志: `用户通过本地任务台继续修改。\n开始时间：${state.startedAt}\n会话：${task.local.sessionId}`,
    });
  } catch (error) {
    activeResumes.delete(recordId);
    appendConversation(recordId, {
      role: 'assistant',
      content: `无法更新飞书执行状态，本轮续改没有启动：${error.message}`,
      status: 'failed',
    });
    throw error;
  }
  taskCache.expiresAt = 0;

  let settled = false;
  let terminationReason = '';
  const child = spawn(
    CODEX_CMD,
    ['exec', 'resume', '--full-auto', '--json', task.local.sessionId, '-'],
    {
      cwd: task.local.worktree,
      env: codexEnvironment(),
      shell: process.platform === 'win32',
      windowsHide: true,
    },
  );
  state.pid = child.pid;
  const watchdog = setInterval(() => {
    if (settled || terminationReason) return;
    const now = Date.now();
    const elapsedMs = now - state.startedAtMs;
    const idleMs = now - state.lastOutputAtMs;
    if (elapsedMs >= RESUME_TIMEOUT_MS) {
      terminationReason = `续改执行超过 ${Math.round(RESUME_TIMEOUT_MS / 60_000)} 分钟，已自动终止。`;
    } else if (idleMs >= RESUME_IDLE_TIMEOUT_MS) {
      terminationReason = `续改连续 ${Math.round(RESUME_IDLE_TIMEOUT_MS / 60_000)} 分钟没有输出，已自动终止。`;
    }
    if (terminationReason) {
      const line = `\n[console] ${terminationReason}\n`;
      state.output += line;
      fs.appendFileSync(logPath, line, 'utf8');
      terminateProcessTree(child);
    }
  }, RESUME_WATCHDOG_INTERVAL_MS);
  watchdog.unref();
  child.stdout?.on('data', (chunk) => {
    const text = chunk.toString();
    state.lastOutputAtMs = Date.now();
    state.output += text;
    fs.appendFileSync(logPath, text, 'utf8');
  });
  child.stderr?.on('data', (chunk) => {
    const text = chunk.toString();
    state.lastOutputAtMs = Date.now();
    state.output += text;
    fs.appendFileSync(logPath, text, 'utf8');
  });
  child.stdin?.write(prompt);
  child.stdin?.end();
  child.on('error', async (error) => {
    if (settled) return;
    settled = true;
    clearInterval(watchdog);
    state.output += `\n${error.stack || error.message}`;
    appendConversation(recordId, {
      role: 'assistant',
      content: `续改启动失败：${error.message}`,
      status: 'failed',
    });
    activeResumes.delete(recordId);
    await updateRecord(recordId, {
      AI执行状态: '失败',
      状态: '待处理',
      AI执行日志: truncate(state.output.slice(-12_000), 12_000),
      AI验证结果: `续改启动失败：${error.message}`,
    }).catch(() => undefined);
    taskCache.expiresAt = 0;
  });
  child.on('close', async (code) => {
    if (settled) return;
    settled = true;
    clearInterval(watchdog);
    const agentMessages = parseAgentMessages(state.output);
    const assistantMessage =
      agentMessages.at(-1) ||
      (code === 0
        ? '本轮续改已完成，请查看代码改动和验证结果。'
        : terminationReason || '本轮续改执行失败，请查看原始日志。');
    appendConversation(recordId, {
      role: 'assistant',
      content: assistantMessage,
      status: code === 0 ? 'completed' : 'failed',
    });
    activeResumes.delete(recordId);
    await updateRecord(recordId, {
      AI执行状态: code === 0 ? '已完成' : '失败',
      状态: code === 0 ? '验收中' : '待处理',
      AI执行日志: truncate(state.output.slice(-12_000), 12_000),
      AI验证结果: truncate(assistantMessage, 12_000),
    }).catch(() => undefined);
    taskCache.expiresAt = 0;
  });
  return { accepted: true, startedAt: state.startedAt };
}

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk.toString();
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      throw Object.assign(new Error('请求内容过大。'), { statusCode: 413 });
    }
  }
  return body ? JSON.parse(body) : {};
}

function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mp4': 'video/mp4',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webm': 'video/webm',
    '.webp': 'image/webp',
  };
  response.writeHead(200, {
    'Content-Type': contentTypes[extension] || 'application/octet-stream',
    'Cache-Control': extension === '.html' ? 'no-store' : 'private, max-age=60',
  });
  fs.createReadStream(filePath).pipe(response);
}

async function handleApi(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/health') {
    json(response, 200, {
      ok: true,
      service: 'feishu-codex-console',
      activeResumes: activeResumes.size,
      time: new Date().toISOString(),
    });
    return true;
  }
  if (request.method === 'GET' && url.pathname === '/api/tasks') {
    json(response, 200, { tasks: await listTasks({ fresh: url.searchParams.has('fresh') }) });
    return true;
  }

  const detailMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (request.method === 'GET' && detailMatch) {
    const detail = await taskDetail(decodeURIComponent(detailMatch[1]));
    if (!detail) {
      json(response, 404, { error: '没有找到这条任务。' });
    } else {
      json(response, 200, { task: detail });
    }
    return true;
  }

  const messageMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/messages$/);
  if (request.method === 'POST' && messageMatch) {
    const body = await readBody(request);
    const message = String(body.message || '').trim();
    if (!message) {
      json(response, 400, { error: '请输入要继续修改的内容。' });
      return true;
    }
    const result = await startResume(decodeURIComponent(messageMatch[1]), message);
    json(response, 202, result);
    return true;
  }

  const artifactMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/artifacts\/([^/]+)$/);
  if (request.method === 'GET' && artifactMatch) {
    const recordId = decodeURIComponent(artifactMatch[1]);
    const task = (await listTasks()).find((item) => item.id === recordId);
    if (!task?.local.worktree) {
      json(response, 404, { error: '附件不存在。' });
      return true;
    }
    const filePath = Buffer.from(artifactMatch[2], 'base64url').toString('utf8');
    const root = path.resolve(task.local.worktree);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(`${root}${path.sep}`) || !fs.existsSync(resolved)) {
      json(response, 403, { error: '附件路径无效。' });
      return true;
    }
    sendFile(response, resolved);
    return true;
  }
  return false;
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || `${HOST}:${PORT}`}`);
    if (url.pathname.startsWith('/api/')) {
      if (!(await handleApi(request, response, url))) {
        json(response, 404, { error: 'API 不存在。' });
      }
      return;
    }

    const relativePath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const candidate = path.resolve(DIST_DIR, relativePath);
    if (candidate.startsWith(`${path.resolve(DIST_DIR)}${path.sep}`) && fs.existsSync(candidate)) {
      sendFile(response, candidate);
      return;
    }
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      sendFile(response, indexPath);
      return;
    }
    json(response, 503, { error: '前端尚未构建，请先运行 Vite build。' });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    json(response, statusCode, { error: error.message || String(error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[feishu-codex-console] http://${HOST}:${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
