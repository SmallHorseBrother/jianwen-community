import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { sourceDirectory, readMessages } from './network-atlas-source.mjs';
import { publicId, xmlField, unxml, redact } from './network-atlas-lib.mjs';

const script = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(script), '..');
const defaultOutput = 'D:/cache/agent-tests/jianwen-portraits-20261013';
const founderId = '552cdd3376358c74';
const iso = value => Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
const digest = text => createHash('sha256').update(text).digest('hex').slice(0, 20);

// These filters apply to evidence text, never to the observed message counters.
const sensitive = /确诊|患有|诊断为|抑郁症|焦虑症|艾滋|HIV|癌症|病史|用药|性取向|性癖|性生活|做爱|嫖娼|自慰|手淫|阴茎|阴道|共产|政治立场|政治信仰|习近平|毛泽东|台湾独立|台独|反党|入党|党委|党支部|自杀|自残/i;
const template = /个人介绍示例|自我介绍模板|复制粘贴|群规|群公告|通过扫描.{0,40}二维码|邀请.{0,40}加入群聊|撤回了一条消息|接龙|请修改群昵称|群名片格式|未经允许禁止|禁止.{0,12}(?:广告|刷屏)|每日打卡模板/;
const trivial = /^(?:[哈哈呵嘿嘻啊哦嗯呀哇呜笑唉嗷啦哈额诶牛]+|[好对是有没的了吧]+|收到|谢谢|感谢|加油|不错|可以|确实|好的|好滴|厉害|牛逼|牛批|早安|晚安|早上好|晚上好|欢迎|赞|[6８8８]+|[?？!！.。…~～\s]+)$/i;
const technicalShort = /引体|双力臂|前水平|倒立|卧推|深蹲|硬拉|街健|街头健身|负重|考研|考博|保研|博士|读博|硕士|论文|科研|大模型|AI|GPU|agent|VLA|机器人|北大|清华|增肌|减脂|跑步|游泳|复习|法考/i;
const practice = /(?:我|本人|自己|我们|咱们).{0,35}(?:练|学|做|研究|开发|读|考|负责|运营|用|试|写|测|教|带|跑|买|工作|专业|毕业)|(?:现在|目前|最近|之前|已经|今天|昨天).{0,20}(?:练|学|做|读|考|研究|开发|负责|运营)|\d+(?:kg|公斤|千克|公里|km|次|组|个|年|小时|分钟)/i;
const intention = /(?:我|本人|自己).{0,30}(?:想|准备|打算|希望|喜欢|计划|目标|找|缺|需要)|(?:求|有没有|想问|请问|如何|怎么).{1,40}|[?？]/;
const resource = /分享|推荐|教程|方法|建议|经验|技巧|可以试|注意|关键|发力|动作|节奏|组数|频率|训练计划|复习|笔记|资料|项目|工具|代码|论文|GitHub|github|竞赛|实习|岗位|课程/;

export function cleanEvidenceText(value) {
  const text = redact(unxml(value || ''))
    .replace(/^\s*[>＞].*$/gm, '')
    .replace(/https?:\/\/[^\s<>]+/gi, '［链接］')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '［邮箱已隐藏］')
    .replace(/(?:微信|vx|v信|QQ|qq|电话|手机号|联系我|加我)[号：:\s]*[a-z\d_+.-]{5,}/gi, '［联系方式已隐藏］')
    .replace(/(?:详细地址|住址|家庭住址|身份证)[：:\s]*[^。\n；;]{3,}/g, '［个人信息已隐藏］')
    .replace(/\b\d{17}[\dXx]\b/g, '［个人信息已隐藏］')
    .replace(/\[[^\]]{1,10}\]/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim();
  if (!text || template.test(text)) return '';
  // Drop sensitive clauses but preserve separate non-sensitive learning/training facts.
  return text.split(/(?<=[。！？!?；;])/u).filter(part => !sensitive.test(part)).join('').trim();
}

export function extractOwnEvidence(row, knownNames = new Map()) {
  const type = Number(row.local_type) % 4294967296;
  if (type === 1) return { kind: 'text', text: cleanEvidenceText(row.text) };
  if (type === 49) {
    const appType = Number(xmlField(row.raw, 'type'));
    if (appType === 57 || row.raw.includes('<refermsg>')) {
      const reference = row.raw.match(/<refermsg>([\s\S]*?)<\/refermsg>/)?.[1] || '';
      const author = xmlField(reference, 'chatusr');
      const referenceType = Number(xmlField(reference, 'type'));
      const referenceText = cleanEvidenceText(xmlField(reference, 'content'));
      const context = referenceText && referenceType === 1
        ? { authorId: author ? publicId(author) : null, author: knownNames.get(publicId(author || '')) || '原消息作者', text: referenceText.slice(0, 220), attribution: '引用他人的原消息，仅作回复上下文，不是本人的自述' }
        : undefined;
      return { kind: 'text', text: cleanEvidenceText(xmlField(row.raw, 'title')), context, quotedReply: true, provenance: 'authored-reply' };
    }
    const title = cleanEvidenceText(xmlField(row.raw, 'title'));
    return { kind: 'link', text: title, sharedTitle: true, provenance: 'shared-title', context: { attribution: '分享的文章、链接或文件标题，不是本人撰写的自述，仅表示一次分享行为' } };
  }
  return { kind: type === 3 ? 'image' : type === 47 ? 'sticker' : type === 34 ? 'voice' : [43, 62].includes(type) ? 'video' : 'other', text: '' };
}

export function isMeaningful(text) {
  if (!text || trivial.test(text) || /^[\d\s,.，。+-]+$/.test(text)) return false;
  const content = text.replace(/［[^］]+］/g, '').replace(/[\s\p{P}\p{S}]/gu, '');
  return content.length >= 4 || content.length >= 2 && (technicalShort.test(content) || /\d+\s*(?:kg|公斤|千克|组|个|rm|公里|km)/i.test(text));
}

function score(text) {
  return Math.min(text.length, 200) / 100 + (practice.test(text) ? 4 : 0) + (intention.test(text) ? 2 : 0) + (resource.test(text) ? 2 : 0) + (technicalShort.test(text) ? 1 : 0);
}
function keepBest(list, candidate, count, comparison) {
  list.push(candidate); list.sort(comparison); if (list.length > count) list.length = count;
}
const byScore = (a, b) => b.score - a.score || a.messageId.localeCompare(b.messageId);
function grams(text) {
  const words = text.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
  return new Set(Array.from({ length: Math.max(0, words.length - 1) }, (_, index) => words.slice(index, index + 2)));
}
function finishSamples(state, limit) {
  const pool = new Map();
  for (const message of [...state.priority, ...state.first, ...state.last, ...state.best, ...state.questions, ...state.practices, ...state.resources, ...state.random, ...[...state.months.values()].flat()]) pool.set(message.messageId, message);
  const chosen = [], selected = new Set(), known = new Set();
  const add = message => {
    if (!message || selected.has(message.messageId) || chosen.length >= limit) return;
    chosen.push(message); selected.add(message.messageId); for (const gram of grams(message.text)) known.add(gram);
  };
  for (const message of state.priority) add(message);
  // Ensure early and recent statements survive even for prolific participants.
  for (const message of state.first.slice(0, 2)) add(message);
  for (const message of state.last.slice(0, 2)) add(message);
  for (const [, bucket] of [...state.months.entries()].sort((a, b) => a[0].localeCompare(b[0]))) add(bucket[0]);
  while (chosen.length < limit && selected.size < pool.size) {
    let best, bestScore = -Infinity;
    for (const message of pool.values()) {
      if (selected.has(message.messageId)) continue;
      const set = grams(message.text), novelty = [...set].filter(item => !known.has(item)).length / Math.max(1, set.size);
      const value = message.score + novelty * 8;
      if (value > bestScore) { bestScore = value; best = message; }
    }
    if (!best) break; add(best);
  }
  return chosen.sort((a, b) => a.at.localeCompare(b.at) || a.messageId.localeCompare(b.messageId)).map(({ score: ignoredScore, hash: ignoredHash, ...message }) => message);
}
function observeCandidate(state, candidate, large) {
  keepBest(state.first, candidate, large ? 8 : 4, (a, b) => a.at.localeCompare(b.at));
  keepBest(state.last, candidate, large ? 20 : 8, (a, b) => b.at.localeCompare(a.at));
  keepBest(state.best, candidate, large ? 45 : 15, byScore);
  if (intention.test(candidate.text)) keepBest(state.questions, candidate, large ? 20 : 8, byScore);
  if (practice.test(candidate.text)) keepBest(state.practices, candidate, large ? 25 : 10, byScore);
  if (resource.test(candidate.text)) keepBest(state.resources, candidate, large ? 25 : 10, byScore);
  keepBest(state.random, candidate, large ? 24 : 12, (a, b) => a.hash.localeCompare(b.hash));
  const month = candidate.at.slice(0, 7), bucket = state.months.get(month) || [];
  keepBest(bucket, candidate, large ? 5 : 3, byScore); state.months.set(month, bucket);
}

function runGroup(groupId, outputDirectory) {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'scripts/network-atlas.config.json'), 'utf8'));
  const group = config.groups.find(item => item.id === groupId);
  if (!group) throw new Error(`Unknown group: ${groupId}`);
  const datasetPath = path.join(root, 'public/data', groupId === config.defaultGroup ? 'network-atlas.json' : `network/${groupId}.json`);
  const data = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  const referencePath = path.join(outputDirectory, 'reference-portraits.json');
  const reference = fs.existsSync(referencePath) ? JSON.parse(fs.readFileSync(referencePath, 'utf8')) : null;
  const priorityIds = new Map((reference?.sourceGroup === groupId ? reference.people : []).map(person => [person.id, new Set([...(person.evidence || []).map(item => item.id), ...(person.details || []).flatMap(item => item.evidenceIds || []), ...(person.incorrectOldGoal?.evidenceId ? [person.incorrectOldGoal.evidenceId] : [])])]));
  const cutoff = Date.parse(data.lastMessageAt) / 1000;
  if (!Number.isFinite(cutoff)) throw new Error(`Invalid snapshot cutoff for ${groupId}`);
  const states = new Map(data.people.map(person => [person.id, { person, messageCount: 0, counts: { text: 0, image: 0, sticker: 0, voice: 0, video: 0, link: 0, other: 0 }, quoteReplyCount: 0, sharedTitleCount: 0, meaningfulMessageCount: 0, meaningfulTextCount: 0, firstAt: Infinity, lastAt: -Infinity, textFirstAt: Infinity, textLastAt: -Infinity, seenText: new Set(), priority: [], first: [], last: [], best: [], questions: [], practices: [], resources: [], random: [], months: new Map() }]));
  const knownNames = new Map(data.people.map(person => [person.id, person.name]));
  const seen = new Set(); let scanned = 0, duplicates = 0;
  for (const row of readMessages(sourceDirectory(), group.groupId)) {
    if (row.create_time > cutoff) continue;
    const sourceKey = row.server_id && row.server_id !== '0' ? `server:${row.server_id}` : row.key;
    if (seen.has(sourceKey)) { duplicates++; continue; } seen.add(sourceKey); scanned++;
    if (Number(row.local_type) % 4294967296 === 10000) continue;
    const state = states.get(publicId(row.user_name || ''));
    if (!state) continue;
    const own = extractOwnEvidence(row, knownNames);
    state.messageCount++; state.counts[own.kind]++;
    state.firstAt = Math.min(state.firstAt, row.create_time); state.lastAt = Math.max(state.lastAt, row.create_time);
    if (own.quotedReply) state.quoteReplyCount++;
    if (own.sharedTitle && isMeaningful(own.text)) state.sharedTitleCount++;
    if (own.kind !== 'text' && !own.sharedTitle || !isMeaningful(own.text)) continue;
    state.meaningfulMessageCount++;
    const hash = digest(own.text.replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase());
    const isPriority = priorityIds.get(state.person.id)?.has(row.key);
    if (state.seenText.has(hash) && !isPriority) continue;
    if (!state.seenText.has(hash)) { state.seenText.add(hash); state.meaningfulTextCount++; }
    state.textFirstAt = Math.min(state.textFirstAt, row.create_time); state.textLastAt = Math.max(state.textLastAt, row.create_time);
    const candidate = { messageId: row.key, at: iso(row.create_time), text: own.text.slice(0, 350), provenance: own.provenance || 'authored-text', ...(own.text.length > 350 ? { truncated: true } : {}), ...(own.quotedReply ? { quotedReply: true } : {}), ...(own.sharedTitle ? { sharedTitle: true } : {}), ...(own.context ? { context: own.context } : {}), score: score(own.text) - (own.sharedTitle ? 3 : 0), hash };
    if (isPriority) state.priority.push(candidate);
    observeCandidate(state, candidate, state.person.id === founderId);
  }
  const output = [], mismatches = [];
  for (const state of states.values()) {
    if (state.messageCount !== state.person.messageCount) mismatches.push({ id: state.person.id, expected: state.person.messageCount, observed: state.messageCount });
    const messages = finishSamples(state, state.person.id === founderId ? 80 : 30);
    output.push({ id: state.person.id, name: state.person.name, groupId, coverage: { messageCount: state.messageCount, textCount: state.counts.text, meaningfulMessageCount: state.meaningfulMessageCount, meaningfulTextCount: state.meaningfulTextCount, sampledMessages: messages.length, imageCount: state.counts.image, stickerCount: state.counts.sticker, voiceCount: state.counts.voice, videoCount: state.counts.video, linkCount: state.counts.link, otherCount: state.counts.other, quoteReplyCount: state.quoteReplyCount, replyCount: state.quoteReplyCount, sharedTitleCount: state.sharedTitleCount, firstAt: iso(state.firstAt), lastAt: iso(state.lastAt), textFirstAt: iso(state.textFirstAt), textLastAt: iso(state.textLastAt) }, messages, currentSummary: state.person.summary, introductions: state.person.introductions, currentTags: state.person.tags, currentTopics: state.person.topics });
  }
  output.sort((a, b) => b.coverage.messageCount - a.coverage.messageCount || a.id.localeCompare(b.id));
  const directory = path.join(outputDirectory, 'evidence'); fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${groupId}.jsonl`);
  fs.writeFileSync(file, output.map(item => JSON.stringify(item)).join('\n') + '\n');
  const missingPriority = [...priorityIds].flatMap(([id, ids]) => [...ids].filter(messageId => !output.find(person => person.id === id)?.messages.some(message => message.messageId === messageId)).map(messageId => ({ id, messageId })));
  const result = { groupId, title: data.title, snapshotCutoff: data.lastMessageAt, datasetMembers: data.people.length, eligibleMembers: output.length, meaningfulMembers: output.filter(item => item.coverage.meaningfulTextCount > 0).length, founderMessages: output.find(item => item.id === founderId)?.coverage, scanned, duplicates, sampledMessages: output.reduce((sum, item) => sum + item.messages.length, 0), bytes: fs.statSync(file).size, file, countMismatches: mismatches, missingPriority };
  fs.writeFileSync(path.join(directory, `${groupId}.manifest.json`), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}

async function main() {
  const args = process.argv.slice(2), outputIndex = args.indexOf('--output');
  const outputDirectory = path.resolve(outputIndex >= 0 ? args[outputIndex + 1] : defaultOutput);
  if (!outputDirectory.toLowerCase().startsWith('d:\\cache\\agent-tests\\') && !outputDirectory.toLowerCase().startsWith('d:/cache/agent-tests/')) throw new Error('Evidence output must stay within D:/cache/agent-tests');
  const workerIndex = args.indexOf('--worker');
  if (workerIndex >= 0) { runGroup(args[workerIndex + 1], outputDirectory); return; }
  const groupIndex = args.indexOf('--group');
  const config = JSON.parse(fs.readFileSync(path.join(root, 'scripts/network-atlas.config.json'), 'utf8'));
  const groups = groupIndex >= 0 ? config.groups.filter(item => item.id === args[groupIndex + 1]) : config.groups;
  if (!groups.length) throw new Error('No matching group');
  fs.mkdirSync(outputDirectory, { recursive: true });
  const results = [], pending = [...groups];
  const worker = async () => {
    while (pending.length) {
      const group = pending.shift();
      await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [script, '--worker', group.id, '--output', outputDirectory], { cwd: root, env: { ...process.env, TEMP: outputDirectory, TMP: outputDirectory, TMPDIR: outputDirectory, NODE_NO_WARNINGS: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '', stderr = ''; child.stdout.on('data', value => { stdout += value; }); child.stderr.on('data', value => { stderr += value; });
        child.on('error', reject); child.on('exit', code => {
          if (code !== 0) { reject(new Error(`${group.id}: ${stderr.slice(0, 1500)}`)); return; }
          const result = JSON.parse(stdout.trim().split('\n').at(-1)); results.push(result);
          console.log(JSON.stringify({ group: group.id, members: result.eligibleMembers, meaningfulMembers: result.meaningfulMembers, samples: result.sampledMessages, bytes: result.bytes, mismatches: result.countMismatches.length })); resolve();
        });
      });
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, groups.length) }, worker));
  results.sort((a, b) => config.groups.findIndex(item => item.id === a.groupId) - config.groups.findIndex(item => item.id === b.groupId));
  const manifest = { schemaVersion: 1, generatedAt: new Date().toISOString(), parallelWorkers: Math.min(3, groups.length), notes: 'Read-only source; counts cover all observed types before filtering. textCount includes plain text and quote-reply author titles. sharedTitleCount identifies meaningful shared article/file titles, which are weak evidence of sharing and never authored self-descriptions. meaningfulMessageCount counts retained authored text/replies/shared titles before per-author identical-text deduplication; meaningfulTextCount is after deduplication. Evidence is bounded and time-diverse, never a complete chat export. Quoted context belongs to its stated author and must not become the replier biography. Source snapshot membership and lastMessageAt cutoff are preserved.', groups: results, totalMembers: results.reduce((sum, item) => sum + item.eligibleMembers, 0), totalBytes: results.reduce((sum, item) => sum + item.bytes, 0) };
  fs.writeFileSync(path.join(outputDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ manifest: path.join(outputDirectory, 'manifest.json'), totalMembers: manifest.totalMembers, totalBytes: manifest.totalBytes, countMismatches: results.reduce((sum, item) => sum + item.countMismatches.length, 0) }));
}
if (path.resolve(process.argv[1] || '') === script) await main();
