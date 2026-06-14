#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_CONFIG_PATH = path.resolve(process.cwd(), 'scripts/wechat-feedback-sources.example.json');
const DEFAULT_CIPHERTALK_CLI = 'D:/files/CipherTalk/dist-electron/cli.js';
const DEFAULT_FROM = '7d';
const DEFAULT_OUTPUT_DIR = path.resolve(
  process.cwd(),
  'tmp',
  `wechat-feedback-intake-${localDateStamp()}`,
);

const taskRules = [
  {
    id: 'FL-001',
    projects: ['food_link'],
    title: 'FL-001 食探：排查识别记录串用户 / 串记录',
    type: 'todo',
    priority: 'urgent',
    executionMode: 'auto_code',
    codingAgent: 'codex',
    category: 'bug',
    patterns: [/识别记录串/, /其他的都不是我识别/, /不是我吃/, /是别人的/],
    summary:
      '微信群出现疑似餐食识别记录串用户/串记录反馈。改前需要先查日志和记录归属，确认是否仍存在跨用户读取、缓存复用或详情页查询条件不严的问题。',
    codeContext: [
      'D:/files/food_link/src/packageExtra/pages/record-detail/index.tsx',
      'D:/files/food_link/backend/internal/foodrecord',
      'D:/files/food_link/backend/internal/worker',
    ],
  },
  {
    id: 'FL-002',
    projects: ['food_link'],
    title: 'FL-002 食探：优化食物匹配和别名机制，避免玉米匹配到玉米肠',
    type: 'todo',
    priority: 'high',
    executionMode: 'auto_code',
    codingAgent: 'codex',
    category: 'bug',
    patterns: [/玉米.*玉米肠/, /匹配算法/, /匹配机制/, /别名机制/, /别名表/],
    summary:
      '群聊反馈食物识别/营养匹配把基础食材错误匹配到加工食品。需要检查别名表和匹配排序，优先验证“玉米”不得匹配“玉米肠”。',
    codeContext: [
      'D:/files/food_link/backend/internal/worker',
      'D:/files/food_link/backend/internal/foodrecord/handler/food_record_handler.go',
    ],
  },
  {
    id: 'FL-003',
    projects: ['food_link'],
    title: 'FL-003 食探：识别结果无法修改、修改后餐食无法保存复用',
    type: 'todo',
    priority: 'high',
    executionMode: 'auto_code',
    codingAgent: 'codex',
    category: 'requirement',
    patterns: [/没法修改/, /保存修改后的餐食/, /添加自己的食物/, /想复用/, /重新调一次/],
    summary:
      '用户反馈识别记录不能编辑，也不能把修改后的餐食保存复用。需要先确认当前是否已有更新接口或收藏/常用餐食能力，再补齐记录详情页编辑与复用链路。',
    codeContext: [
      'D:/files/food_link/src/packageExtra/pages/record-detail/index.tsx',
      'D:/files/food_link/src/packageExtra/pages/food-library',
      'D:/files/food_link/src/packageExtra/pages/record-manual',
      'D:/files/food_link/backend/internal/foodrecord',
    ],
  },
  {
    id: 'FL-004',
    projects: ['food_link'],
    title: 'FL-004 食探：摄入比例显示 100.2% 这类小数溢出不自然',
    type: 'todo',
    priority: 'medium',
    executionMode: 'auto_code',
    codingAgent: 'codex',
    category: 'ux_bug',
    patterns: [/100\.2%/, /摄入比例/, /四舍五入.*比例/],
    summary:
      '微信群反馈因为四舍五入导致摄入比例显示 100.2%。需要区分真实超标和浮点/展示误差，在接近 100% 时做更自然的展示。',
    codeContext: [
      'D:/files/food_link/src/pages/index/components/MacrosSection.tsx',
      'D:/files/food_link/src/pages/index/components/CalorieCard.tsx',
    ],
  },
  {
    id: 'FL-005',
    projects: ['food_link'],
    title: 'FL-005 食探：首页“赚积分”条目误触隐藏后缺少恢复入口',
    type: 'follow_up',
    priority: 'medium',
    executionMode: 'manual',
    codingAgent: null,
    category: 'product_decision',
    patterns: [/赚积分/, /积分.*条目.*消失/, /叉叉/, /设置页面.*开关/, /隐藏.*恢复/],
    summary:
      '用户反馈赚积分入口可能被误触隐藏。需要产品确认采用去掉关闭按钮、设置页恢复开关，还是隐藏后自动恢复。',
    codeContext: [
      'D:/files/food_link/src/pages/index/index.tsx',
      'D:/files/food_link/src/packageExtra/pages/reward-center',
      'D:/files/food_link/src/packageExtra/pages/profile-settings',
    ],
  },
  {
    id: 'FL-006',
    projects: ['food_link'],
    title: 'FL-006 食探：19.9 月卡支付投诉需要补支付异常回溯',
    type: 'follow_up',
    priority: 'medium',
    executionMode: 'manual',
    codingAgent: null,
    category: 'ops',
    patterns: [/支付系统/, /投诉.*19\.?9/, /19\.?9.*月卡/, /月卡.*支付/],
    summary:
      '支付问题可能已解决，但支付类投诉应进入异常回溯。建议先查订单和支付日志，不直接触发代码修改。',
    codeContext: [
      'D:/files/food_link/src/packageExtra/pages/pro-membership',
      'D:/files/food_link/src/packageExtra/pages/auto-renew-audit',
    ],
  },
  {
    id: 'JW-001',
    projects: ['jianwen-community'],
    title: 'JW-001 健文社区：沉淀 AI 辅助学习内容 / 工具入口',
    type: 'follow_up',
    priority: 'low',
    executionMode: 'manual',
    codingAgent: null,
    category: 'content_opportunity',
    patterns: [/AI.*辅助学习/, /AI.*学习/, /碎片化学习/, /大纲.*教学/, /怎么学习AI/],
    summary:
      '学习群持续出现 AI 辅助学习、碎片化学习和教学路径讨论。建议先作为内容/产品方向沉淀，不自动进入开发。',
    codeContext: [
      'D:/files/jianwen-community/src/pages/learning',
      'D:/files/jianwen-community/src/services/questionService.ts',
      'D:/files/jianwen-community/src/pages/AdminQA.tsx',
    ],
  },
  {
    id: 'JW-002',
    projects: ['jianwen-community'],
    title: 'JW-002 健文社区：AI 求职 / 产品经理路径问答沉淀',
    type: 'follow_up',
    priority: 'low',
    executionMode: 'manual',
    codingAgent: null,
    category: 'content_opportunity',
    patterns: [/产品经理/, /求职/, /agent/i, /RAG/i, /长记忆/, /论文.*项目/, /项目壁垒/],
    summary:
      '学习群讨论 AI 产品经理、求职路径、Agent/RAG/长记忆等主题，适合沉淀为专题问答或学习路线。',
    codeContext: [
      'D:/files/jianwen-community/src/pages/learning',
      'D:/files/jianwen-community/src/services/questionService.ts',
      'D:/files/jianwen-community/src/pages/AdminQA.tsx',
    ],
  },
  {
    id: 'GEN-001',
    projects: ['coachlink', 'coachlink-wechat-app'],
    title: '待人工分类：教链群聊出现疑似 bug / 需求反馈',
    type: 'follow_up',
    priority: 'medium',
    executionMode: 'manual',
    codingAgent: null,
    category: 'triage',
    genericOnly: true,
    patterns: [/bug/i, /报错/, /闪退/, /打不开/, /无法/, /不能/, /失败/, /异常/, /建议/, /需求/, /优化/],
    summary:
      '教链相关群出现疑似反馈信号。由于当前规则还未细分教链业务语义，建议先人工分类后再决定是否拆成具体开发任务。',
    codeContext: [
      'D:/files/coachlink-wechat-app',
      'D:/files/coachlink',
    ],
  },
];

function parseArgs(argv) {
  const flags = new Map();
  const positionals = [];
  const booleanFlags = new Set(['dry-run', 'write', 'skip-export']);

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
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date());
}

function localDateTimeStamp() {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return formatter.format(new Date());
}

const { flags, positionals } = parseArgs(process.argv.slice(2));
const configPath = path.resolve(String(flags.get('config') || DEFAULT_CONFIG_PATH));
const fromWindow = String(flags.get('from') || positionals[0] || DEFAULT_FROM);
const outputDir = path.resolve(String(flags.get('output') || positionals[1] || DEFAULT_OUTPUT_DIR));
const shouldWrite = flags.has('write');
const skipExport = flags.has('skip-export');
const maxEvidence = Number(flags.get('max-evidence') || 8);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

function safeFileName(value) {
  return String(value || 'source')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'source';
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

function decodeEntities(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)));
}

function scrubSensitive(value) {
  return String(value || '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[uuid]')
    .replace(/\bwxid_[a-z0-9_]{8,}\b/gi, '[wxid]')
    .replace(/\b\d{13,}\b/g, '[long-id]');
}

function cleanSnippet(value) {
  const decoded = decodeEntities(value);
  const withoutXml = decoded
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  return scrubSensitive(withoutXml)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();
}

function isReadableSnippet(value) {
  const text = String(value || '').trim();
  if (text.length < 3) return false;
  if (/aeskey|cdnthumb|secHashInfoBase64|emoji fromusername|videomsg/i.test(text)) return false;
  return /[\u4e00-\u9fa5A-Za-z0-9]/.test(text);
}

function extractAppTitle(raw) {
  const decoded = decodeEntities(raw);
  const titles = [...decoded.matchAll(/<title>([\s\S]*?)<\/title>/gi)].map((match) => match[1]);

  if (titles.length === 0) {
    const endIndex = decoded.indexOf('</title>');
    if (endIndex > 0 && endIndex < 260) {
      titles.push(decoded.slice(0, endIndex));
    }
  }

  return titles.map(cleanSnippet).filter(isReadableSnippet);
}

function extractReferContent(raw) {
  const decoded = decodeEntities(raw);
  return [...decoded.matchAll(/<content>([\s\S]*?)<\/content>/gi)]
    .map((match) => cleanSnippet(match[1]))
    .filter(isReadableSnippet)
    .filter((text) => text.length <= 220);
}

function splitSpeaker(content) {
  const match = String(content || '').match(/^([^\n:：]{1,36})[:：]\n([\s\S]+)$/);
  if (!match) {
    return { speaker: null, text: content };
  }

  return {
    speaker: cleanSnippet(match[1]),
    text: match[2],
  };
}

function extractMessageText(message) {
  const raw = String(message.content || '');
  const type = String(message.type || '');

  if (type === '文本') {
    const { speaker, text } = splitSpeaker(raw);
    const clean = cleanSnippet(text);
    return {
      text: isReadableSnippet(clean) ? clean : null,
      speaker,
      derivedFrom: 'text',
    };
  }

  if (type === '其他') {
    const snippets = [...extractAppTitle(raw), ...extractReferContent(raw)];
    const unique = [...new Set(snippets)].filter((snippet) => snippet.length <= 260);
    return {
      text: unique.length > 0 ? unique.join(' / ') : null,
      speaker: null,
      derivedFrom: 'appmsg',
    };
  }

  if (type === '图片') {
    const title = extractReferContent(raw)[0] || extractAppTitle(raw)[0] || null;
    return {
      text: title,
      speaker: null,
      derivedFrom: 'image',
    };
  }

  return {
    text: null,
    speaker: null,
    derivedFrom: type || 'unknown',
  };
}

function toIsoFromMessage(message) {
  if (typeof message.timestamp === 'number') {
    const timestampMs = message.timestamp > 10_000_000_000 ? message.timestamp : message.timestamp * 1000;
    return new Date(timestampMs).toISOString();
  }

  if (typeof message.datetime === 'string') {
    const normalized = message.datetime.replace(/\//g, '-');
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return null;
}

function buildReadableMessages(exportData) {
  const rawMessages = Array.isArray(exportData?.messages) ? exportData.messages : [];

  return rawMessages.map((message, index) => {
    const extracted = extractMessageText(message);
    return {
      index,
      id: String(message.id || `${index}`),
      type: String(message.type || ''),
      datetime: message.datetime || toIsoFromMessage(message),
      isoTime: toIsoFromMessage(message),
      isSend: Boolean(message.isSend),
      speaker: extracted.speaker,
      text: extracted.text,
      derivedFrom: extracted.derivedFrom,
    };
  });
}

function messageMatchesRule(message, rule) {
  if (!message.text) return false;
  return rule.patterns.some((pattern) => pattern.test(message.text));
}

function buildEvidence(readableMessages, matchedIndexes) {
  const contextIndexes = new Set();

  for (const index of matchedIndexes) {
    for (let offset = -2; offset <= 2; offset += 1) {
      const contextIndex = index + offset;
      if (contextIndex >= 0 && contextIndex < readableMessages.length) {
        contextIndexes.add(contextIndex);
      }
    }
  }

  return [...contextIndexes]
    .sort((a, b) => a - b)
    .map((index) => readableMessages[index])
    .filter((message) => message.text || ['图片', '视频'].includes(message.type))
    .slice(0, maxEvidence)
    .map((message) => ({
      message_id: message.id,
      datetime: message.datetime,
      type: message.type,
      derived_from: message.derivedFrom,
      speaker: message.speaker,
      excerpt: message.text ? message.text.slice(0, 220) : `[${message.type || 'media'} evidence]`,
    }));
}

function appliesToProject(rule, source) {
  if (!source.projectName) return false;
  return rule.projects.includes(source.projectName);
}

function sourceRules(source) {
  return taskRules.filter((rule) => {
    if (!appliesToProject(rule, source)) return false;
    if (rule.genericOnly && source.enableGeneric !== true) return false;
    return true;
  });
}

function buildTask(source, exportData, rule, readableMessages, matchedIndexes) {
  const evidence = buildEvidence(readableMessages, matchedIndexes);
  const sourceFrom = exportData?.timeRange?.start || evidence[0]?.datetime || null;
  const sourceTo = exportData?.timeRange?.end || evidence[evidence.length - 1]?.datetime || null;
  const tags = [
    'wechat',
    'auto-intake',
    rule.id,
    rule.category,
    source.projectName,
    ...(Array.isArray(source.tags) ? source.tags : []),
  ].filter(Boolean);

  return {
    title: rule.title,
    summary: `${rule.summary}\n\n提取统计：本次在「${source.name}」命中 ${matchedIndexes.length} 条相关消息，已附最多 ${evidence.length} 条上下文证据。`,
    type: rule.type,
    status: 'pending',
    priority: rule.priority,
    source_group: source.name,
    source_session_id: source.sessionId || exportData?.sessionId || null,
    source_from: sourceFrom,
    source_to: sourceTo,
    evidence_json: {
      source: {
        key: source.key,
        name: source.name,
        project_name: source.projectName,
        project_path: source.projectPath,
      },
      rule: {
        id: rule.id,
        category: rule.category,
        code_context: rule.codeContext,
      },
      matched_message_count: matchedIndexes.length,
      evidence,
    },
    tags_json: tags,
    owner: source.owner || null,
    progress_note: `由 scripts/wechat-feedback-intake.mjs 自动生成。默认 execution_status=not_ready，需人工确认后再改为 ready。`,
    project_name: source.projectName || null,
    project_path: source.projectPath || null,
    execution_mode: rule.executionMode,
    coding_agent: rule.codingAgent,
    execution_status: 'not_ready',
    is_public: source.isPublic !== false,
  };
}

function analyzeSource(source, exportData) {
  const readableMessages = buildReadableMessages(exportData);
  const readableCount = readableMessages.filter((message) => message.text).length;
  const mediaCount = readableMessages.filter((message) => ['图片', '视频'].includes(message.type)).length;
  const tasks = [];

  for (const rule of sourceRules(source)) {
    const matchedIndexes = readableMessages
      .filter((message) => messageMatchesRule(message, rule))
      .map((message) => message.index);

    if (matchedIndexes.length === 0) continue;
    tasks.push(buildTask(source, exportData, rule, readableMessages, matchedIndexes));
  }

  return {
    source: {
      key: source.key,
      name: source.name,
      sessionId: source.sessionId || exportData?.sessionId || null,
      projectName: source.projectName,
      projectPath: source.projectPath,
    },
    stats: {
      totalMessages: Array.isArray(exportData?.messages) ? exportData.messages.length : 0,
      readableMessages: readableCount,
      mediaMessages: mediaCount,
      candidateTasks: tasks.length,
    },
    tasks,
  };
}

async function exportSource(source, config) {
  if (source.inputPath) {
    return path.resolve(source.inputPath);
  }

  if (skipExport) {
    return null;
  }

  if (!source.sessionId) {
    return null;
  }

  const cipherTalkCli = String(config.cipherTalkCli || DEFAULT_CIPHERTALK_CLI);
  const exportPath = path.join(outputDir, 'exports', `${safeFileName(source.key || source.name)}.json`);
  ensureDir(path.dirname(exportPath));

  const args = [
    cipherTalkCli,
    'export',
    '--session',
    source.sessionId,
    '--from',
    String(source.from || fromWindow),
    '--output',
    exportPath,
  ];

  const result = await runCommand(process.execPath, args);
  if (!result.ok) {
    throw new Error(`CipherTalk export failed for ${source.name}: ${result.stderr || result.stdout}`);
  }

  return exportPath;
}

function buildMarkdownReport({ analyses, skippedSources, writtenResult }) {
  const generatedAt = `${localDateTimeStamp()} Asia/Shanghai`;
  const totalTasks = analyses.reduce((sum, analysis) => sum + analysis.tasks.length, 0);

  const lines = [
    '# WeChat Feedback Intake Report',
    '',
    `Generated at: ${generatedAt}`,
    `Window: ${fromWindow}`,
    `Mode: ${shouldWrite ? 'write to task-intake' : 'dry-run only'}`,
    `Candidate tasks: ${totalTasks}`,
    '',
    '## Source Stats',
    '',
    '| Source | Project | Messages | Readable | Media | Tasks |',
    '|---|---|---:|---:|---:|---:|',
  ];

  for (const analysis of analyses) {
    lines.push(
      `| ${analysis.source.name} | ${analysis.source.projectName || '-'} | ${analysis.stats.totalMessages} | ${analysis.stats.readableMessages} | ${analysis.stats.mediaMessages} | ${analysis.stats.candidateTasks} |`,
    );
  }

  if (skippedSources.length > 0) {
    lines.push('', '## Skipped Sources', '');
    for (const skipped of skippedSources) {
      lines.push(`- ${skipped.name}: ${skipped.reason}`);
    }
  }

  lines.push('', '## Candidate Tasks', '');

  if (totalTasks === 0) {
    lines.push('No candidate tasks were extracted in this run.');
  }

  for (const analysis of analyses) {
    for (const task of analysis.tasks) {
      const evidence = task.evidence_json.evidence || [];
      lines.push(`### ${task.title}`);
      lines.push('');
      lines.push(`- Source: ${task.source_group}`);
      lines.push(`- Project: ${task.project_name || '-'}`);
      lines.push(`- Priority: ${task.priority}`);
      lines.push(`- Execution: ${task.execution_mode} / ${task.coding_agent || '-'} / ${task.execution_status}`);
      lines.push(`- Tags: ${Array.isArray(task.tags_json) ? task.tags_json.join(', ') : '-'}`);
      lines.push('');
      lines.push(task.summary);
      lines.push('');
      lines.push('Evidence:');
      for (const item of evidence.slice(0, 5)) {
        lines.push(`- ${item.datetime || '-'} ${item.type || ''}: ${item.excerpt}`);
      }
      lines.push('');
    }
  }

  if (writtenResult) {
    lines.push('## task-intake Result', '');
    lines.push('```json');
    lines.push(JSON.stringify(writtenResult, null, 2));
    lines.push('```');
  }

  return `${lines.join('\n')}\n`;
}

async function writeTasksToIntake(tasks) {
  const endpoint =
    process.env.TASK_INTAKE_ENDPOINT ||
    (process.env.VITE_SUPABASE_URL ? `${process.env.VITE_SUPABASE_URL}/functions/v1/task-intake` : '');
  const token = process.env.TASK_INTAKE_TOKEN;

  if (!endpoint || !token) {
    throw new Error('Missing TASK_INTAKE_ENDPOINT/VITE_SUPABASE_URL or TASK_INTAKE_TOKEN');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-task-intake-token': token,
    },
    body: JSON.stringify({ tasks }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error || `task-intake HTTP ${response.status}`);
  }

  return body;
}

async function main() {
  ensureDir(outputDir);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }

  const config = readJson(configPath);
  const sources = Array.isArray(config.sources) ? config.sources : [];
  const analyses = [];
  const skippedSources = [];

  for (const source of sources) {
    if (source.enabled === false) {
      skippedSources.push({ name: source.name || source.key, reason: source.skipReason || 'disabled' });
      continue;
    }

    const sourceName = source.name || source.key || 'unnamed source';
    try {
      const exportPath = await exportSource(source, config);
      if (!exportPath) {
        skippedSources.push({ name: sourceName, reason: 'missing sessionId or export skipped' });
        continue;
      }

      const exportData = readJson(exportPath);
      const analysis = analyzeSource(source, exportData);
      analyses.push(analysis);
    } catch (error) {
      skippedSources.push({
        name: sourceName,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const tasks = analyses.flatMap((analysis) => analysis.tasks);
  const candidatePath = path.join(outputDir, 'candidate-tasks.json');
  const analysisPath = path.join(outputDir, 'analysis.json');
  writeJson(candidatePath, { generatedAt: new Date().toISOString(), from: fromWindow, tasks });
  writeJson(analysisPath, { generatedAt: new Date().toISOString(), from: fromWindow, analyses, skippedSources });

  let writtenResult = null;
  if (shouldWrite && tasks.length > 0) {
    writtenResult = await writeTasksToIntake(tasks);
  }

  const reportPath = path.join(outputDir, 'report.md');
  fs.writeFileSync(reportPath, buildMarkdownReport({ analyses, skippedSources, writtenResult }), 'utf-8');

  console.log(`[wechat-intake] sources=${analyses.length} skipped=${skippedSources.length} tasks=${tasks.length}`);
  console.log(`[wechat-intake] candidate tasks: ${candidatePath}`);
  console.log(`[wechat-intake] report: ${reportPath}`);
  if (!shouldWrite) {
    console.log('[wechat-intake] dry-run only. Re-run with --write to POST tasks to task-intake.');
  }
}

main().catch((error) => {
  console.error('[wechat-intake] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
