/** Read-only by default. Use --write to refresh the validated upstream snapshot. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';

const root = new URL('../', import.meta.url);
const repository = 'https://github.com/tzhu40816-ai/ai-miriacles';
const domains = new Set(['math', 'physics', 'chemistry', 'materials', 'biology', 'medicine', 'astronomy', 'earth', 'computing', 'games', 'robotics', 'language', 'other']);
const kinds = new Set(['paper', 'official', 'news', 'reference']);
const args = process.argv.slice(2);
const write = args.includes('--write');
const refIndex = args.indexOf('--ref');
const requestedRef = refIndex >= 0 ? args[refIndex + 1] : undefined;
if (args.some((arg, index) => arg !== '--write' && arg !== '--ref' && (refIndex < 0 || index !== refIndex + 1))) throw new Error('Usage: node scripts/sync-ai-miracles.mjs [--write] [--ref <commit-sha>]');
if (refIndex >= 0 && !/^[a-f0-9]{40}$/i.test(requestedRef || '')) throw new Error('--ref requires a full 40-character commit SHA');

async function fetchText(url) {
  let text;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'jianwen-ai-miracles-sync' } });
    if (!response.ok) throw new Error(`Upstream request failed: HTTP ${response.status}`);
    text = await response.text();
  } catch (error) {
    if (process.platform !== 'win32') throw error;
    // Windows' native HTTP client respects the user's system proxy and trust store.
    // The URL goes through stdin; no dynamic shell command or additional dependency.
    text = await new Promise((resolve, reject) => {
      const command = "$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); $uri=[Console]::In.ReadToEnd(); $response=Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 20; [Console]::Out.Write($response.Content)";
      const child = execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command],
        { windowsHide: true, encoding: 'utf8', timeout: 25000, maxBuffer: 3 * 1024 * 1024 },
        (failure, stdout) => failure ? reject(new Error('Upstream request failed through the Windows HTTP client')) : resolve(stdout));
      child.stdin.end(url);
    });
  }
  if (Buffer.byteLength(text) > 2 * 1024 * 1024) throw new Error('Upstream document exceeds the expected size');
  return text;
}

function validate(events) {
  if (!Array.isArray(events) || !events.length) throw new Error('The catalog must be a nonempty array');
  const ids = new Set();
  for (const event of events) {
    if (!event || typeof event.id !== 'string' || !/^[a-z0-9-]+$/.test(event.id) || ids.has(event.id)) throw new Error('Invalid or duplicate event ID');
    ids.add(event.id);
    if (typeof event.date !== 'string' || !/^\d{4}(-(?:0[1-9]|1[0-2])(-(?:0[1-9]|[12]\d|3[01]))?)?$/.test(event.date)) throw new Error(`Invalid date: ${event.id}`);
    if (event.date.length === 10 && new Date(`${event.date}T00:00:00Z`).toISOString().slice(0, 10) !== event.date) throw new Error(`Invalid calendar date: ${event.id}`);
    if (!domains.has(event.domain)) throw new Error(`Unknown domain: ${event.id}`);
    for (const field of ['title', 'summary', ...(event.caveat ? ['caveat'] : [])]) {
      for (const language of ['zh', 'en']) {
        if (typeof event[field]?.[language] !== 'string' || !event[field][language].trim()) throw new Error(`Missing ${field}.${language}: ${event.id}`);
      }
    }
    if (!Array.isArray(event.links) || !event.links.length) throw new Error(`Missing sources: ${event.id}`);
    for (const link of event.links) {
      if (typeof link.url !== 'string' || !['https:', 'http:'].includes(new URL(link.url).protocol) || !kinds.has(link.kind)) throw new Error(`Invalid source: ${event.id}`);
    }
  }
}

const revision = requestedRef || JSON.parse(await fetchText('https://api.github.com/repos/tzhu40816-ai/ai-miriacles/commits/main')).sha;
if (!/^[a-f0-9]{40}$/i.test(revision || '')) throw new Error('Could not resolve the upstream commit');
const rawBase = `https://raw.githubusercontent.com/tzhu40816-ai/ai-miriacles/${revision}/`;
const [data, license] = await Promise.all([fetchText(`${rawBase}data/events.json`), fetchText(`${rawBase}LICENSE`)]);
const events = JSON.parse(data);
validate(events);
if (!license.includes('CC BY 4.0')) throw new Error('Upstream data license changed; review before importing');

const directory = new URL('public/data/ai-miracles/', root);
const previousMetadata = JSON.parse(readFileSync(new URL('source.json', directory), 'utf8'));
const previousData = readFileSync(new URL('events.json', directory), 'utf8');
const hash = (text) => createHash('sha256').update(text.replaceAll('\r\n', '\n')).digest('hex');
const summary = { revision, entries: events.length, domains: new Set(events.map((event) => event.domain)).size, dataChanged: hash(previousData) !== hash(data), versionChanged: previousMetadata.revision !== revision, write };

if (write && (summary.dataChanged || summary.versionChanged)) {
  const catalogPath = new URL('src/features/aiMiracles/catalog.ts', root);
  const docsPath = new URL('docs/ai-miracles.md', root);
  const catalog = readFileSync(catalogPath, 'utf8');
  if (!/export const MIRACLES_REVISION = '[a-f0-9]{40}';/.test(catalog)) throw new Error('Catalog source version marker not found');
  const docs = readFileSync(docsPath, 'utf8');
  if (!/- 本次快照：`[a-f0-9]{40}`，\d+ 条、\d+ 个分类（含其他）。/.test(docs)) throw new Error('Documentation snapshot marker not found');
  const metadata = {
    title: 'AI创造的奇迹', author: 'tzhu40816-ai', repository, revision,
    importedAt: new Date().toISOString(), entries: events.length,
    license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    modification: 'Original event data preserved; adapted display and navigation for Jianwen Community.',
  };
  // Fetch and validate all inputs, including version markers, before writing files.
  mkdirSync(directory, { recursive: true });
  writeFileSync(new URL('events.json', directory), data);
  writeFileSync(new URL('LICENSE.txt', directory), license);
  writeFileSync(new URL('source.json', directory), JSON.stringify(metadata, null, 2) + '\n');
  writeFileSync(catalogPath, catalog.replace(/export const MIRACLES_REVISION = '[a-f0-9]{40}';/, `export const MIRACLES_REVISION = '${revision}';`));
  writeFileSync(docsPath, docs.replace(/- 本次快照：`[a-f0-9]{40}`，\d+ 条、\d+ 个分类（含其他）。/, `- 本次快照：\`${revision}\`，${events.length} 条、${summary.domains} 个分类（含其他）。`));
}
console.log(JSON.stringify(summary, null, 2));
