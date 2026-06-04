import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const startedAt = new Date();
const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
const runDir = path.join(root, 'reports', 'ui-test-agent', stamp);
const reportPath = path.join(runDir, 'ui-test-report.md');
const playwrightJsonPath = path.join(root, 'test-results', 'playwright-results.json');
const playwrightHtmlPath = path.join(root, 'playwright-report', 'index.html');

const commands = [
  { name: 'TypeScript build', command: 'npm', args: ['run', 'build'] },
  { name: 'Playwright UI/E2E', command: 'npx', args: ['playwright', 'test'] },
];

function runCommand(step) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(step.command, step.args, {
      cwd: root,
      shell: true,
      env: process.env,
    });

    let output = '';
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });
    child.on('close', (code) => {
      resolve({
        ...step,
        code,
        durationMs: Date.now() - started,
        output: output.trim(),
      });
    });
  });
}

function statusIcon(code) {
  return code === 0 ? 'PASS' : 'FAIL';
}

function formatDuration(ms) {
  return `${Math.round(ms / 1000)}s`;
}

function truncate(text, max = 5000) {
  if (!text) return '';
  return text.length > max ? `${text.slice(-max)}\n\n...output truncated to last ${max} chars` : text;
}

async function readPlaywrightSummary() {
  try {
    const raw = await readFile(playwrightJsonPath, 'utf8');
    const data = JSON.parse(raw);
    const stats = data.stats || {};
    const failures = [];

    for (const suite of data.suites || []) {
      collectFailures(suite, failures);
    }

    return { stats, failures };
  } catch {
    return null;
  }
}

function collectFailures(node, failures) {
  for (const spec of node.specs || []) {
    for (const test of spec.tests || []) {
      for (const result of test.results || []) {
        if (result.status !== 'passed' && result.status !== 'skipped') {
          failures.push({
            title: [...(node.title ? [node.title] : []), spec.title].join(' > '),
            project: test.projectName,
            status: result.status,
            error: result.error?.message || result.errors?.[0]?.message || '',
          });
        }
      }
    }
  }

  for (const suite of node.suites || []) {
    collectFailures(suite, failures);
  }
}

async function main() {
  await mkdir(runDir, { recursive: true });

  const results = [];
  for (const command of commands) {
    results.push(await runCommand(command));
    if (results.at(-1).code !== 0 && command.name === 'TypeScript build') {
      break;
    }
  }

  const finishedAt = new Date();
  const playwright = await readPlaywrightSummary();
  const failed = results.some((result) => result.code !== 0);

  const lines = [
    '# UI 测试 Agent 报告',
    '',
    `- 结果：${failed ? 'FAIL' : 'PASS'}`,
    `- 开始：${startedAt.toLocaleString('zh-CN', { hour12: false })}`,
    `- 结束：${finishedAt.toLocaleString('zh-CN', { hour12: false })}`,
    `- 耗时：${formatDuration(finishedAt.getTime() - startedAt.getTime())}`,
    `- HTML 报告：${playwrightHtmlPath}`,
    '',
    '## 步骤结果',
    '',
    '| 步骤 | 状态 | 耗时 |',
    '| --- | --- | ---: |',
    ...results.map((result) => `| ${result.name} | ${statusIcon(result.code)} | ${formatDuration(result.durationMs)} |`),
    '',
  ];

  if (playwright?.stats) {
    lines.push(
      '## Playwright 汇总',
      '',
      `- 预期通过：${playwright.stats.expected ?? 0}`,
      `- 非预期失败：${playwright.stats.unexpected ?? 0}`,
      `- 跳过：${playwright.stats.skipped ?? 0}`,
      `- Flaky：${playwright.stats.flaky ?? 0}`,
      '',
    );
  }

  if (playwright?.failures?.length) {
    lines.push('## 需要优先看的失败', '');
    for (const failure of playwright.failures) {
      lines.push(
        `### ${failure.title}`,
        '',
        `- 项目：${failure.project}`,
        `- 状态：${failure.status}`,
        '',
        '```text',
        truncate(failure.error, 2000),
        '```',
        '',
      );
    }
  }

  lines.push('## 原始输出', '');
  for (const result of results) {
    lines.push(
      `### ${result.name}`,
      '',
      '```text',
      truncate(result.output),
      '```',
      '',
    );
  }

  await writeFile(reportPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(`\nUI test agent report: ${reportPath}`);

  process.exitCode = failed ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
