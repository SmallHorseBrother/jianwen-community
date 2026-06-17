#!/usr/bin/env node
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_CONFIG_PATH = path.resolve(process.cwd(), 'scripts/wechat-feedback-sources.example.json');
const DEFAULT_CIPHERTALK_CLI = 'D:/files/CipherTalk/dist-electron/cli.js';
const DEFAULT_FROM = '1d';
const DEFAULT_INTERVAL_SECONDS = 120;
const DEFAULT_URL = 'https://feedback-bot.healthymax.cn/api/messages/ingest';
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'tmp', `wechat-message-bridge-${localDateStamp()}`);
const DEFAULT_STATE_PATH = path.resolve(process.cwd(), 'tmp', 'wechat-message-bridge-state.json');

function parseArgs(argv) {
  const flags = new Map();
  const booleanFlags = new Set(['dry-run', 'skip-export', 'watch', 'include-self', 'prime-state']);
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/s, 2);
    if (booleanFlags.has(rawKey)) {
      flags.set(rawKey, true);
      continue;
    }

    if (inlineValue !== undefined) {
      flags.set(rawKey, inlineValue);
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      flags.set(rawKey, next);
      index += 1;
    } else {
      flags.set(rawKey, true);
    }
  }

  return { flags, positionals };
}

function localDateStamp() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function safeFileName(value) {
  return String(value || 'source')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'source';
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf-8').digest('hex');
}

function runCommand(cmd, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: options.cwd || process.cwd(),
      env: process.env,
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      resolve({
        ok: false,
        code: null,
        stdout,
        stderr: `${stderr}\n${error instanceof Error ? error.message : String(error)}`,
      });
    });

    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        code,
        stdout,
        stderr,
      });
    });
  });
}

function cleanText(value) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();
}

function splitSpeaker(content) {
  const match = String(content || '').match(/^([^\n:：]{1,48})[:：]\n([\s\S]+)$/);
  if (!match) {
    return { senderName: null, text: content };
  }

  return {
    senderName: cleanText(match[1]),
    text: match[2],
  };
}

function toUnixSeconds(message) {
  if (typeof message.timestamp === 'number' && Number.isFinite(message.timestamp)) {
    return Math.floor(message.timestamp > 10_000_000_000 ? message.timestamp / 1000 : message.timestamp);
  }

  if (typeof message.datetime === 'string') {
    const normalized = message.datetime.replace(/\//g, '-');
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return Math.floor(parsed.getTime() / 1000);
    }
  }

  return Math.floor(Date.now() / 1000);
}

function stableSourceId(source, exportData) {
  return String(source.sourceId || source.sessionId || exportData?.sessionId || source.key || source.name);
}

function stableSenderId(sourceId, message, senderName) {
  if (message.isSend) return 'self';
  if (senderName) return `wechat-sender-${sha256(`${sourceId}:${senderName}`).slice(0, 16)}`;
  return 'wechat-sender-unknown';
}

function stableMessageId(sourceId, message, senderId, timestamp, content) {
  if (message.id) return String(message.id);
  return sha256(`${sourceId}:${senderId}:${timestamp}:${content}`);
}

function isTextMessage(message) {
  return message?.type === '文本' && typeof message.content === 'string';
}

function buildPayload(source, exportData, message) {
  const sourceId = stableSourceId(source, exportData);
  const { senderName, text } = splitSpeaker(message.content);
  const content = cleanText(text);
  if (!content || content.length < 2) return null;

  const timestamp = toUnixSeconds(message);
  const senderId = stableSenderId(sourceId, message, senderName);
  const messageId = stableMessageId(sourceId, message, senderId, timestamp, content);

  return {
    platform: 'wechat',
    source_type: source.sourceType || (String(sourceId).includes('@chatroom') ? 'group' : 'private'),
    source_id: sourceId,
    source_name: source.name || exportData?.sessionName || sourceId,
    message_id: messageId,
    sender_id: senderId,
    sender_name: senderName || (message.isSend ? 'self' : null),
    message_type: 'text',
    content,
    timestamp,
    raw: {
      ciphertalk: {
        id: message.id ?? null,
        type: message.type ?? null,
        datetime: message.datetime ?? null,
        isSend: Boolean(message.isSend),
      },
      source: {
        key: source.key ?? null,
        session_id: source.sessionId ?? exportData?.sessionId ?? null,
        project_name: source.projectName ?? null,
        project_path: source.projectPath ?? null,
        tags: Array.isArray(source.tags) ? source.tags : [],
      },
      review: {
        initial_confirmation: 'pending',
        needs_human_confirmation: true,
      },
    },
  };
}

async function exportSource(source, config, options) {
  if (options.inputPath) return path.resolve(options.inputPath);
  if (source.inputPath) return path.resolve(source.inputPath);
  if (options.skipExport || !source.sessionId) return null;

  const cipherTalkCli = String(config.cipherTalkCli || DEFAULT_CIPHERTALK_CLI);
  const exportPath = path.join(options.outputDir, 'exports', `${safeFileName(source.key || source.name)}.json`);
  ensureDir(path.dirname(exportPath));

  const args = [
    cipherTalkCli,
    'export',
    '--session',
    source.sessionId,
    '--from',
    String(source.from || options.fromWindow),
    '--output',
    exportPath,
  ];

  const result = await runCommand(process.execPath, args);
  if (!result.ok) {
    throw new Error(`CipherTalk export failed for ${source.name}: ${result.stderr || result.stdout}`);
  }

  return exportPath;
}

function selectSources(config, sourceFilter) {
  const sources = Array.isArray(config.sources) ? config.sources : [];
  return sources.filter((source) => {
    if (source.enabled === false) return false;
    if (!sourceFilter) return true;
    return source.key === sourceFilter || source.name === sourceFilter || source.sessionId === sourceFilter;
  });
}

function loadState(statePath) {
  const state = readJson(statePath, { sent: {} });
  if (!state.sent || typeof state.sent !== 'object') state.sent = {};
  return state;
}

async function postPayload(payload, options) {
  const response = await fetch(options.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Feedback-Bot-Token': options.token,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(options.timeoutMs),
  });

  const body = await response.json().catch(async () => ({ text: await response.text().catch(() => '') }));
  if (response.status !== 202 && !response.ok) {
    throw new Error(`ingest HTTP ${response.status}: ${JSON.stringify(body)}`);
  }

  return { status: response.status, body };
}

async function processOnce(config, options) {
  ensureDir(options.outputDir);

  const state = loadState(options.statePath);
  const results = [];
  const sourceFilter = options.sourceFilter;
  const sources = selectSources(config, sourceFilter);

  for (const source of sources) {
    const sourceName = source.name || source.key || 'unnamed source';
    const sourceResult = {
      source: sourceName,
      exported: null,
      scanned: 0,
      text: 0,
      skippedKnown: 0,
      sent: 0,
      dryRun: 0,
      primed: 0,
      failed: 0,
      errors: [],
    };

    try {
      const exportPath = await exportSource(source, config, options);
      sourceResult.exported = exportPath;
      if (!exportPath) {
        sourceResult.errors.push('missing sessionId or export skipped');
        results.push(sourceResult);
        continue;
      }

      const exportData = readJson(exportPath, {});
      const messages = Array.isArray(exportData.messages) ? exportData.messages : [];
      const payloads = messages
        .filter((message) => options.includeSelf || !message.isSend)
        .filter(isTextMessage)
        .map((message) => buildPayload(source, exportData, message))
        .filter(Boolean)
        .sort((a, b) => a.timestamp - b.timestamp);

      sourceResult.scanned = messages.length;
      sourceResult.text = payloads.length;

      const limitedPayloads = Number.isFinite(options.limit) && options.limit > 0
        ? payloads.slice(-options.limit)
        : payloads;

      for (const payload of limitedPayloads) {
        if (state.sent[payload.message_id]) {
          sourceResult.skippedKnown += 1;
          continue;
        }

        if (options.primeState) {
          state.sent[payload.message_id] = {
            primed_at: new Date().toISOString(),
            source_id: payload.source_id,
            status: 'primed',
          };
          sourceResult.primed += 1;
          continue;
        }

        if (options.dryRun) {
          sourceResult.dryRun += 1;
          continue;
        }

        try {
          const response = await postPayload(payload, options);
          state.sent[payload.message_id] = {
            sent_at: new Date().toISOString(),
            source_id: payload.source_id,
            status: response.status,
            duplicate: Boolean(response.body?.duplicate),
          };
          sourceResult.sent += 1;
        } catch (error) {
          sourceResult.failed += 1;
          sourceResult.errors.push(error instanceof Error ? error.message : String(error));
        }
      }
    } catch (error) {
      sourceResult.errors.push(error instanceof Error ? error.message : String(error));
    }

    results.push(sourceResult);
  }

  if (!options.dryRun || options.primeState) {
    state.updated_at = new Date().toISOString();
    writeJson(options.statePath, state);
  }

  const reportPath = path.join(options.outputDir, 'bridge-report.json');
  writeJson(reportPath, {
    generated_at: new Date().toISOString(),
    dry_run: options.dryRun,
    prime_state: options.primeState,
    from: options.fromWindow,
    results,
  });

  return { reportPath, results };
}

async function main() {
  const { flags, positionals } = parseArgs(process.argv.slice(2));
  const envFile = flags.get('env-file');
  if (envFile) loadEnvFile(path.resolve(String(envFile)));

  const configPath = path.resolve(String(flags.get('config') || DEFAULT_CONFIG_PATH));
  const config = readJson(configPath);
  if (!config) throw new Error(`Config not found: ${configPath}`);

  const options = {
    url: String(flags.get('url') || process.env.FEEDBACK_BOT_INGEST_URL || DEFAULT_URL),
    token: String(flags.get('token') || process.env.FEEDBACK_BOT_TOKEN || ''),
    fromWindow: String(flags.get('from') || positionals[0] || DEFAULT_FROM),
    outputDir: path.resolve(String(flags.get('output') || DEFAULT_OUTPUT_DIR)),
    statePath: path.resolve(String(flags.get('state') || DEFAULT_STATE_PATH)),
    sourceFilter: flags.get('source') ? String(flags.get('source')) : null,
    inputPath: flags.get('input') ? String(flags.get('input')) : null,
    dryRun: flags.has('dry-run'),
    primeState: flags.has('prime-state'),
    skipExport: flags.has('skip-export'),
    includeSelf: flags.has('include-self'),
    watch: flags.has('watch'),
    intervalMs: Math.max(10, Number(flags.get('interval') || DEFAULT_INTERVAL_SECONDS)) * 1000,
    timeoutMs: Math.max(3, Number(flags.get('timeout') || 10)) * 1000,
    limit: Number(flags.get('limit') || 0),
  };

  if (!options.dryRun && !options.primeState && !options.token) {
    throw new Error('Missing FEEDBACK_BOT_TOKEN. Set it in the environment or pass --token.');
  }

  do {
    const { reportPath, results } = await processOnce(config, options);
    const summary = results
      .map((result) => `${result.source}: text=${result.text} sent=${result.sent} dry=${result.dryRun} primed=${result.primed} known=${result.skippedKnown} failed=${result.failed}`)
      .join(' | ');
    console.log(`[wechat-bridge] ${summary}`);
    console.log(`[wechat-bridge] report: ${reportPath}`);

    if (!options.watch) break;
    await new Promise((resolve) => setTimeout(resolve, options.intervalMs));
  } while (options.watch);
}

main().catch((error) => {
  console.error('[wechat-bridge] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
