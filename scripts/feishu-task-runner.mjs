#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { upsertTaskSnapshots } from './feishu-task-snapshots.mjs';

const DEFAULT_CONFIG_PATH = path.resolve(process.cwd(), 'scripts/feishu-task-runner.config.json');
const DEFAULT_LOG_DIR = path.resolve(process.cwd(), 'logs', 'feishu-task-runner');
const DEFAULT_SNAPSHOT_DIR = path.resolve(
  process.cwd(),
  'tools',
  'feishu-codex-console',
  'data',
  'task-snapshots',
);
const DEFAULT_INTERVAL_SECONDS = 300;
const RUNNER_TIMEOUT_MS = Number(process.env.FEISHU_RUNNER_TIMEOUT_MS || 60 * 60 * 1000);
const MAX_LOG_CHARS = Number(process.env.FEISHU_RUNNER_MAX_LOG_CHARS || 12000);
const CODEX_CMD = process.env.CODEX_CMD || 'codex';
const PUSH_BRANCH = process.env.FEISHU_RUNNER_PUSH === 'true';
const IMAGE_EXTENSIONS = new Set(['.gif', '.jpeg', '.jpg', '.png', '.webp']);

function parseArgs(argv) {
  const flags = new Map();
  const booleanFlags = new Set(['once', 'dry-run']);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    if (booleanFlags.has(key)) {
      flags.set(key, true);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      flags.set(key, next);
      index += 1;
    } else {
      flags.set(key, true);
    }
  }
  return flags;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(text, max = MAX_LOG_CHARS) {
  const value = String(text || '');
  return value.length <= max ? value : `${value.slice(-max)}\n\n[truncated to last ${max} chars]`;
}

function single(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function stringValue(value) {
  const item = single(value);
  if (item == null) return '';
  if (typeof item === 'object') return JSON.stringify(item);
  return String(item);
}

function arrayValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value == null ? [] : [value];
}

function parseFeishuDateTime(value) {
  const item = single(value);
  if (item == null || item === '') return null;
  if (typeof item === 'number') {
    const milliseconds = item < 1e12 ? item * 1000 : item;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const text = String(item).trim();
  const localMatch = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (localMatch) {
    const [, year, month, day, hour, minute, second = '0'] = localMatch;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLocalDateTime(date) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day} ${value.hour}:${value.minute}:${value.second}`;
}

function sourceIdFromRaw(raw) {
  const match = String(raw || '').match(/^来源:\s*(.+)$/m);
  return match?.[1]?.trim() || null;
}

function safeSlug(value) {
  return String(value || 'task')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'task';
}

function makeShellCommand(command, cwd) {
  if (process.platform === 'win32') {
    return { cmd: 'cmd.exe', args: ['/d', '/s', '/c', command], cwd };
  }
  return { cmd: 'sh', args: ['-lc', command], cwd };
}

function runCommand(command, cwd, options = {}) {
  const { cmd, args } = Array.isArray(command)
    ? { cmd: command[0], args: command.slice(1) }
    : makeShellCommand(command, cwd);
  const timeoutMs = options.timeoutMs || 120000;
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: process.env, shell: false });
    let stdout = '';
    let stderr = '';
    let finished = false;
    const timeout = setTimeout(() => {
      if (finished) return;
      stderr += `\n[runner] command timeout after ${timeoutMs}ms`;
      child.kill('SIGTERM');
    }, timeoutMs);
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve({ ok: false, code: null, stdout, stderr: `${stderr}\n${error.message}` });
    });
    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
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

function runLark(args, options = {}) {
  return new Promise((resolve) => {
    const command = resolveLarkCommand(args);
    const child = spawn(command.command, command.args, {
      cwd: options.cwd || process.cwd(),
      env: process.env,
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => resolve({ ok: false, error, stdout, stderr }));
    child.on('close', (code) => {
      if (code !== 0) {
        resolve({ ok: false, code, stdout, stderr });
        return;
      }
      try {
        const json = JSON.parse(stdout.replace(/^\uFEFF/, ''));
        resolve({ ok: json.ok === undefined ? true : Boolean(json.ok), json, stdout, stderr });
      } catch (error) {
        resolve({ ok: false, error, stdout, stderr });
      }
    });
  });
}

async function updateRecord(config, recordId, fields) {
  const result = await runLark([
    'base', '+record-upsert',
    '--as', 'user',
    '--base-token', config.baseToken,
    '--table-id', config.tableId,
    '--record-id', recordId,
    '--json', JSON.stringify(fields),
  ]);
  if (!result.ok) {
    throw new Error(`record update failed: ${result.stderr || result.stdout || result.error?.message}`);
  }
  return result.json;
}

async function listRecords(config) {
  const args = [
    'base', '+record-list',
    '--as', 'user',
    '--base-token', config.baseToken,
    '--table-id', config.tableId,
    '--offset', '0',
    '--limit', '200',
  ];
  if (config.viewId) args.push('--view-id', config.viewId);
  const result = await runLark(args);
  if (!result.ok) {
    throw new Error(`record list failed: ${result.stderr || result.stdout || result.error?.message}`);
  }

  const payload = result.json.data;
  const fields = payload.fields || [];
  const rows = payload.data || [];
  const ids = payload.record_id_list || [];
  const records = rows.map((row, index) => {
    const record = { _recordId: ids[index], _row: row };
    fields.forEach((field, fieldIndex) => {
      record[field] = row[fieldIndex];
    });
    return record;
  });
  const snapshotDir = path.resolve(config.snapshotDir || DEFAULT_SNAPSHOT_DIR);
  return upsertTaskSnapshots(snapshotDir, records);
}

function taskEligibility(record, now = new Date()) {
  const aiAllowed = stringValue(record['是否AI自动修改']) === '是';
  const execStatus = stringValue(record['AI执行状态']);
  const plannedAt = parseFeishuDateTime(record['计划执行时间']);
  if (!aiAllowed) return { eligible: false, reason: 'not-approved', plannedAt };
  if (execStatus && execStatus !== '待执行') {
    return { eligible: false, reason: `status-${execStatus}`, plannedAt };
  }
  if (!stringValue(record['需求名称'])) {
    return { eligible: false, reason: 'missing-title', plannedAt };
  }
  if (!plannedAt) return { eligible: false, reason: 'missing-schedule', plannedAt };
  if (plannedAt.getTime() > now.getTime()) {
    return { eligible: false, reason: 'scheduled', plannedAt };
  }
  return { eligible: true, reason: 'due', plannedAt };
}

function resolveProjectPath(config, record) {
  const explicit = stringValue(record['AI执行项目路径']);
  if (explicit) return explicit;
  const projectKey = stringValue(record['项目Key']);
  if (projectKey && config.projectPathMap?.[projectKey]) {
    return config.projectPathMap[projectKey];
  }
  const sourceId = sourceIdFromRaw(record['原始群聊消息']);
  if (sourceId && config.sourceProjectMap?.[sourceId]) return config.sourceProjectMap[sourceId];
  return config.defaultProjectPath || null;
}

async function inspectRepo(cwd) {
  const branch = await runCommand('git rev-parse --abbrev-ref HEAD', cwd);
  const head = await runCommand('git rev-parse HEAD', cwd);
  const status = await runCommand('git status --short', cwd);
  const last = await runCommand('git log --oneline -n 1', cwd);
  return {
    branch: branch.stdout.trim(),
    head: head.stdout.trim(),
    status: status.stdout.trim(),
    last: last.stdout.trim(),
  };
}

async function prepareWorktree(config, projectPath, record) {
  const root = path.resolve(config.worktreeRoot || 'D:/files/_feishu-codex-worktrees');
  fs.mkdirSync(root, { recursive: true });
  const title = safeSlug(record['需求名称']);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const branch = `codex/feishu-${safeSlug(record._recordId)}-${stamp}`;
  const worktree = path.join(root, `${safeSlug(path.basename(projectPath))}-${safeSlug(record._recordId)}-${stamp}`);
  const add = await runCommand(
    ['git', 'worktree', 'add', '-b', branch, worktree, 'HEAD'],
    projectPath,
    { timeoutMs: 180000 },
  );
  if (!add.ok) {
    throw new Error(`git worktree add failed:\n${add.stdout}\n${add.stderr}`);
  }
  const sourceNodeModules = path.join(projectPath, 'node_modules');
  const worktreeNodeModules = path.join(worktree, 'node_modules');
  if (fs.existsSync(sourceNodeModules) && !fs.existsSync(worktreeNodeModules)) {
    fs.symlinkSync(sourceNodeModules, worktreeNodeModules, 'junction');
  }
  return { worktree, branch, title };
}

async function downloadAttachments(config, record) {
  const attachments = arrayValue(record['附件']).filter(
    (attachment) => attachment && typeof attachment === 'object' && attachment.file_token,
  );
  if (attachments.length === 0) return { files: [], errors: [] };

  const attachmentFieldId = config.attachmentFieldId || 'fldIiQ4IFn';
  const outputDir = path.resolve(
    process.cwd(),
    'tmp',
    'feishu-task-runner-attachments',
    record._recordId,
    String(Date.now()),
  );
  fs.mkdirSync(outputDir, { recursive: true });
  const files = [];
  const errors = [];

  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index];
    const fileName = `${String(index + 1).padStart(2, '0')}-${path.basename(attachment.name || 'attachment')}`;
    const outputPath = path.join(outputDir, fileName);
    const extra = JSON.stringify({
      bitablePerm: {
        tableId: config.tableId,
        attachments: {
          [attachmentFieldId]: {
            [record._recordId]: [attachment.file_token],
          },
        },
      },
    });
    const result = await runLark([
      'api',
      'GET',
      `/open-apis/drive/v1/medias/${attachment.file_token}/download`,
      '--as',
      'user',
      '--params',
      JSON.stringify({ extra }),
      '--output',
      `./${fileName}`,
    ], { cwd: outputDir });
    if (result.ok && fs.existsSync(outputPath)) {
      files.push(outputPath);
    } else {
      errors.push(
        `${attachment.name || attachment.file_token}: ${result.stderr || result.stdout || result.error?.message}`,
      );
    }
  }
  return { files, errors };
}

function buildPrompt(record, context, attachmentResult) {
  const attachmentSummary = attachmentResult.files.length > 0
    ? attachmentResult.files.map((filePath) => `- ${filePath}`).join('\n')
    : '无';
  const attachmentErrors = attachmentResult.errors.length > 0
    ? attachmentResult.errors.join('\n')
    : '无';
  return `你正在处理一条从飞书多维表格派发给 Codex 的工程任务。请直接在当前仓库完成实现，不要再向用户追问。

飞书记录 ID：${record._recordId}
需求名称：${stringValue(record['需求名称'])}
需求描述：${stringValue(record['需求描述']) || '无'}
验收标准：${stringValue(record['验收标准']) || '未填写，请根据需求描述制定最小、可验证的验收标准'}
计划执行时间：${formatLocalDateTime(parseFeishuDateTime(record['计划执行时间']))}
优先级：${stringValue(record['优先级']) || '未指定'}
复杂度：${stringValue(record['复杂度']) || '未指定'}
原始群聊消息：
${stringValue(record['原始群聊消息']) || '无'}
附件（图片已通过 Codex --image 同时传入）：
${attachmentSummary}
附件下载错误：
${attachmentErrors}

执行要求：
- 当前工作目录是独立 git worktree：${context.worktree}
- 当前分支：${context.branch}
- 只实现与这条需求直接相关的内容。
- 不要改动无关文件，不要做顺手重构。
- 如果需求明显不适合自动执行，请只做最小可解释处理，并在最终说明风险。
- 完成后必须运行可用的验证命令。优先级：npm run lint、npm run test:run、npm run build。
- 如果涉及前端 UI/交互/视觉变化，必须运行或补充 Playwright 验证，并尽量产出截图或报告路径；本项目可使用 npm run test:agent。
- 自查 git diff，确认没有明显多余改动。
- 如果产生代码改动，请在当前分支创建一个提交，提交信息以 "feishu: " 开头。

最终请输出：
1. 修改文件
2. 实现说明
3. 验证命令和结果
4. 截图/测试报告路径（如有）
5. 风险或需要人工确认的点`;
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

function runCodex(prompt, cwd, logPath, attachmentFiles = []) {
  const imageArgs = attachmentFiles
    .filter((filePath) => IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
    .flatMap((filePath) => ['--image', filePath]);
  const args = ['exec', '--full-auto', ...imageArgs, '-'];
  return new Promise((resolve) => {
    const child = spawn(CODEX_CMD, args, {
      cwd,
      env: codexEnvironment(),
      shell: process.platform === 'win32',
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let finished = false;
    const started = Date.now();
    const timeout = setTimeout(() => {
      if (finished) return;
      stderr += `\n[runner] codex timeout after ${RUNNER_TIMEOUT_MS}ms`;
      if (process.platform === 'win32' && child.pid) {
        const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
          windowsHide: true,
          stdio: 'ignore',
        });
        killer.unref();
      } else {
        child.kill('SIGTERM');
      }
    }, RUNNER_TIMEOUT_MS);
    const append = (chunk, target) => {
      const text = chunk.toString();
      if (target === 'stdout') stdout += text;
      else stderr += text;
      fs.appendFileSync(logPath, text, 'utf8');
    };
    child.stdout?.on('data', (chunk) => append(chunk, 'stdout'));
    child.stderr?.on('data', (chunk) => append(chunk, 'stderr'));
    child.stdin?.write(prompt);
    child.stdin?.end();
    child.on('error', (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve({ ok: false, code: null, stdout, stderr: `${stderr}\n${error.message}`, durationMs: Date.now() - started });
    });
    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve({ ok: code === 0, code, stdout, stderr, durationMs: Date.now() - started });
    });
  });
}

function summarizeExecution(result, beforeRepo, afterRepo, logPath, pushResult = null) {
  const lines = [
    `结果：${result.ok ? 'Codex 执行完成' : 'Codex 执行失败'}`,
    `退出码：${result.code ?? '无'}`,
    `耗时：${Math.round(result.durationMs / 1000)} 秒`,
    `执行日志：${logPath}`,
    `执行前 HEAD：${beforeRepo.head}`,
    `执行后 HEAD：${afterRepo.head}`,
    `当前分支：${afterRepo.branch}`,
    `工作区是否干净：${afterRepo.status ? '否' : '是'}`,
  ];
  if (afterRepo.status) {
    lines.push('', '未提交/未清理改动：', afterRepo.status);
  }
  if (pushResult) {
    lines.push('', `推送结果：${pushResult.ok ? '成功' : '失败'}`, truncate(`${pushResult.stdout}\n${pushResult.stderr}`, 2000));
  }
  lines.push('', '--- Codex 输出摘要 ---', truncate(`${result.stdout}\n${result.stderr}`, 7000));
  return truncate(lines.join('\n'));
}

async function processRecord(config, record, options) {
  const recordId = record._recordId;
  const title = stringValue(record['需求名称']) || recordId;
  const projectPath = resolveProjectPath(config, record);
  const logDir = path.resolve(options.logDir || DEFAULT_LOG_DIR);
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `${recordId}-${Date.now()}.log`);

  if (options.dryRun) {
    const plannedAt = parseFeishuDateTime(record['计划执行时间']);
    const message = [
      `[dry-run] eligible task: ${title}`,
      `record=${recordId}`,
      `plannedAt=${plannedAt ? formatLocalDateTime(plannedAt) : 'missing'}`,
      `projectPath=${projectPath || 'missing'}`,
      `source=${sourceIdFromRaw(record['原始群聊消息']) || 'unknown'}`,
    ].join('\n');
    fs.writeFileSync(logPath, `${message}\n`, 'utf8');
    console.log(`[feishu-runner] ${message.replace(/\n/g, ' | ')}`);
    return true;
  }

  if (!projectPath || !fs.existsSync(projectPath)) {
    await updateRecord(config, recordId, {
      'AI执行状态': '跳过',
      'AI执行日志': `缺少可用项目路径。请填写「AI执行项目路径」，或在 runner config 中补 sourceProjectMap。\n推断路径：${projectPath || '空'}`,
    });
    console.log(`[feishu-runner] skipped ${recordId}: missing project path`);
    return true;
  }

  await updateRecord(config, recordId, {
    'AI执行状态': '执行中',
    '状态': '开发中',
    'AI执行日志': `本地 runner 已接管。\n开始时间：${new Date().toISOString()}\n项目路径：${projectPath}`,
  });

  try {
    const worktreeContext = await prepareWorktree(config, projectPath, record);
    const beforeRepo = await inspectRepo(worktreeContext.worktree);
    const attachmentResult = await downloadAttachments(config, record);
    const prompt = buildPrompt(record, worktreeContext, attachmentResult);
    fs.writeFileSync(logPath, `[feishu-runner] ${new Date().toISOString()}\nrecord=${recordId}\nworktree=${worktreeContext.worktree}\nbranch=${worktreeContext.branch}\n\n`, 'utf8');

    const result = await runCodex(prompt, worktreeContext.worktree, logPath, attachmentResult.files);
    const afterRepo = await inspectRepo(worktreeContext.worktree);
    let pushResult = null;
    if (PUSH_BRANCH && beforeRepo.head !== afterRepo.head) {
      pushResult = await runCommand(
        ['git', 'push', '-u', 'origin', worktreeContext.branch],
        worktreeContext.worktree,
        { timeoutMs: 180000 },
      );
    }

    const validation = summarizeExecution(result, beforeRepo, afterRepo, logPath, pushResult);
    const commitSummary = `branch=${worktreeContext.branch}\nhead=${afterRepo.head}\nlast=${afterRepo.last}`;
    const madeCommit = beforeRepo.head !== afterRepo.head;
    const success = result.ok && madeCommit;

    await updateRecord(config, recordId, {
      'AI执行状态': success ? '已完成' : '失败',
      '状态': success ? '验收中' : '待处理',
      'AI执行日志': validation,
      'AI验证结果': validation,
      '代码分支/提交': commitSummary,
      'AI执行项目路径': projectPath,
    });
    console.log(`[feishu-runner] ${success ? 'completed' : 'failed'} ${recordId}: ${title}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    fs.appendFileSync(logPath, `\n[feishu-runner] error\n${message}\n`, 'utf8');
    await updateRecord(config, recordId, {
      'AI执行状态': '失败',
      '状态': '待处理',
      'AI执行日志': truncate(`本地 runner 异常：\n${message}\n\n日志：${logPath}`),
      'AI验证结果': truncate(`失败：${message}`),
      'AI执行项目路径': projectPath,
    });
    console.error(`[feishu-runner] failed ${recordId}: ${message}`);
    return true;
  }
}

async function processOnce(config, options) {
  const records = await listRecords(config);
  const inProgress = records.filter(
    (record) => stringValue(record['AI执行状态']) === '执行中',
  );
  if (inProgress.length > 0) {
    console.log(
      `[feishu-runner] waiting for in-progress record: ${inProgress.map((record) => record._recordId).join(', ')}`,
    );
    return false;
  }
  const now = new Date();
  const approved = records
    .map((record) => ({ record, eligibility: taskEligibility(record, now) }))
    .filter(({ record }) => stringValue(record['是否AI自动修改']) === '是');
  const eligible = approved
    .filter(({ eligibility }) => eligibility.eligible)
    .sort((left, right) => left.eligibility.plannedAt - right.eligibility.plannedAt)
    .map(({ record }) => record);
  if (eligible.length === 0) {
    const scheduled = approved
      .filter(({ eligibility }) => eligibility.reason === 'scheduled')
      .sort((left, right) => left.eligibility.plannedAt - right.eligibility.plannedAt);
    const missingSchedule = approved.filter(
      ({ eligibility }) => eligibility.reason === 'missing-schedule',
    );
    if (scheduled.length > 0) {
      const next = scheduled[0];
      console.log(
        `[feishu-runner] no due records; next=${next.record._recordId} at ${formatLocalDateTime(next.eligibility.plannedAt)}`,
      );
    } else {
      console.log('[feishu-runner] no due records');
    }
    if (missingSchedule.length > 0) {
      console.log(
        `[feishu-runner] approved records missing schedule: ${missingSchedule.map(({ record }) => record._recordId).join(', ')}`,
      );
    }
    return false;
  }
  console.log(`[feishu-runner] due records: ${eligible.map((record) => record._recordId).join(', ')}`);
  await processRecord(config, eligible[0], options);
  return true;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const configPath = path.resolve(String(flags.get('config') || DEFAULT_CONFIG_PATH));
  const config = readJson(configPath);
  const options = {
    once: flags.has('once'),
    dryRun: flags.has('dry-run'),
    logDir: flags.get('log-dir') ? path.resolve(String(flags.get('log-dir'))) : DEFAULT_LOG_DIR,
    intervalMs: Math.max(30, Number(flags.get('interval') || config.pollIntervalSeconds || DEFAULT_INTERVAL_SECONDS)) * 1000,
  };

  if (!config.baseToken || !config.tableId) {
    throw new Error('Missing baseToken or tableId in feishu task runner config.');
  }

  console.log(`[feishu-runner] started once=${options.once} dryRun=${options.dryRun} intervalMs=${options.intervalMs}`);
  do {
    try {
      await processOnce(config, options);
    } catch (error) {
      console.error('[feishu-runner] loop error:', error instanceof Error ? error.stack || error.message : error);
    }
    if (options.once) break;
    await sleep(options.intervalMs);
  } while (true);
}

main().catch((error) => {
  console.error('[feishu-runner] fatal:', error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
