// AI 课堂工作台：业务逻辑（不依赖 Deno / Supabase SDK，便于在本地用模拟服务测试）
// 三种身份：
//   老师（社区账号登录）：创建课堂、开关功能、看作品墙、演示
//   学生（课堂口令 + 名字，不注册）：只能用老师开放的功能，费用记在老师账上
//   自学用户（社区账号登录，不在课堂里）：在 /ai/lab 自己用，扣自己的积分

export type Kind = 'chat' | 'vision' | 't2i' | 'i2i' | 't2v' | 'i2v';
export type Tool = 'chat' | 'image' | 'video';
export type ToolState = { open: boolean; until: string | null; quota: number; round: number; task: string };
export type Classroom = {
  id: string; teacher_id: string; title: string; join_code: string;
  tools: Record<Tool, ToolState>; spend_limit: number | null; archived_at: string | null; created_at: string;
};
export type Student = { id: string; classroom_id: string; display_name: string; token_hash: string; last_seen_at: string; created_at: string };
export type Work = {
  id: string; classroom_id: string | null; student_id: string | null; user_id: string | null; payer_id: string;
  author_name: string; tool: Tool; kind: Kind; round: number; prompt: string; status: string; message: string | null;
  provider_task_id: string | null; model: string | null; input_path: string | null; output_path: string | null;
  output_url: string | null; output_text: string | null; output_type: 'text' | 'image' | 'video' | null;
  cost: number; refunded: boolean; hidden: boolean; created_at: string; completed_at: string | null;
};
export type Shared = { id: string; classroom_id: string; path: string; created_at: string };
export type WorkFilter = { classroomId?: string; studentId?: string; userId?: string; personal?: boolean };

export interface Repo {
  rpc<T>(fn: string, args: Record<string, unknown>): Promise<T>; // 出错时 throw Error(message = 数据库异常文本)
  classroomsByTeacher(teacherId: string): Promise<Classroom[]>;
  classroomById(id: string): Promise<Classroom | null>;
  classroomByCode(code: string): Promise<Classroom | null>;
  insertClassroom(row: { teacher_id: string; title: string; join_code: string }): Promise<Classroom>; // 口令重复时 throw Error('DUPLICATE')
  updateClassroom(id: string, patch: Partial<Classroom>): Promise<Classroom>;
  insertStudent(row: { classroom_id: string; display_name: string; token_hash: string }): Promise<Student>;
  studentByTokenHash(hash: string): Promise<Student | null>;
  updateStudent(id: string, patch: Partial<Student>): Promise<void>;
  studentsByClassroom(classroomId: string): Promise<Student[]>;
  deleteStudentsByClassroom(classroomId: string): Promise<void>;
  work(id: string): Promise<Work | null>;
  updateWork(id: string, patch: Partial<Work>): Promise<void>;
  works(filter: WorkFilter, limit: number): Promise<Work[]>;           // 新的在前
  pendingWorks(filter: WorkFilter, limit: number): Promise<Work[]>;    // status queued/running，旧的在前
  countActiveWorks(studentId: string, tool: Tool, round: number): Promise<number>;
  classroomSpent(classroomId: string): Promise<number>;
  sharedByClassroom(classroomId: string): Promise<Shared[]>;
  insertShared(row: { classroom_id: string; path: string }): Promise<Shared>;
  deleteShared(id: string, classroomId: string): Promise<Shared | null>;
  prices(): Promise<Array<{ kind: Kind; credits: number; label: string }>>;
  isAdmin(userId: string): Promise<boolean>;
}
export interface Storage {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  download(path: string): Promise<Uint8Array>;
  signedUrls(paths: string[], ttlSeconds: number): Promise<Record<string, string>>;
  remove(paths: string[]): Promise<void>;
}
export interface Providers {
  chat(input: { prompt: string; imageDataUrl?: string; signal: AbortSignal }): Promise<{ text: string; model: string }>;
  jimeng(action: 'CVSync2AsyncSubmitTask' | 'CVSync2AsyncGetResult', payload: Record<string, unknown>): Promise<any>; // HTTP 失败 throw {status}
  download(url: string): Promise<{ bytes: Uint8Array; contentType: string }>;
  configured(): boolean;
}
export type Deps = {
  repo: Repo; storage: Storage; providers: Providers;
  now: () => Date; randomHex: (bytes: number) => string; sha256: (text: string) => Promise<string>; uuid: () => string;
};
// ipHash：请求来源 IP 的 HMAC 哈希（不含原始 IP），只在第一次建积分账号时用来限制同一网络领赠送的次数
// ipSource：IP 取自哪个请求头（只在管理员自检里显示，方便部署后核对）
export type Request = { action: string; body: Record<string, any>; userId: string | null; studentToken: string | null; ipHash?: string | null; ipSource?: string | null };
export type Response = { status: number; body: unknown };

export const TOOLS: Tool[] = ['chat', 'image', 'video'];
const KIND_TOOL: Record<Kind, Tool> = { chat: 'chat', vision: 'chat', t2i: 'image', i2i: 'image', t2v: 'video', i2v: 'video' };
const MEDIA_MODEL: Partial<Record<Kind, string>> = { t2i: 'jimeng_t2i_v40', i2i: 'jimeng_t2i_v40', t2v: 'jimeng_t2v_v30', i2v: 'jimeng_i2v_first_v30' };
const URL_TTL = 3600;
const ONLINE_MS = 20_000;

class HttpError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
const fail = (status: number, message: string): never => { throw new HttpError(status, message); };

const DB_ERRORS: Record<string, [number, string]> = {
  TOOL_CLOSED: [403, '这个功能现在没有开放。'],
  QUOTA_EXCEEDED: [429, '这一轮的次数用完了。先检查一下结果，等老师下一轮开放。'],
  CLASS_SPEND_LIMIT: [402, '这节课的积分预算用完了，请老师调整。'],
  INSUFFICIENT_CREDITS: [402, '积分不够了。'],
  CLASS_NOT_FOUND: [404, '课堂不存在或已经结束。'],
  RATE_LIMITED: [429, '操作太快了，歇一分钟再试。'],
  PLATFORM_PAUSED: [503, '今天的 AI 生成量到上限了，明天再来。'],
};
function dbError(e: unknown): never {
  const msg = String((e as Error)?.message || e);
  for (const [code, [status, text]] of Object.entries(DB_ERRORS)) if (msg.includes(code)) throw new HttpError(status, text);
  throw e;
}

// ---------- 小工具 ----------
export function effectiveTools(c: Classroom, now: Date): Record<Tool, ToolState & { remainingMs: number | null }> {
  const out = {} as Record<Tool, ToolState & { remainingMs: number | null }>;
  for (const t of TOOLS) {
    const s = c.tools?.[t] || { open: false, until: null, quota: 1, round: 0, task: '' };
    const untilMs = s.until ? Date.parse(s.until) : null;
    const open = !!s.open && (untilMs === null || untilMs > now.getTime());
    out[t] = { ...s, open, until: open ? s.until : null, remainingMs: open && untilMs ? untilMs - now.getTime() : null };
  }
  return out;
}
const cleanText = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// 来源 IP：优先 Cloudflare 写入的 cf-connecting-ip（客户端伪造不了），其次 x-real-ip；
// 最后才用 x-forwarded-for 的第一项，这一项客户端可以预先填写，只作兜底
export function clientIp(get: (name: string) => string | null): { ip: string; source: string } | null {
  for (const name of ['cf-connecting-ip', 'x-real-ip']) {
    const value = get(name)?.trim();
    if (value) return { ip: value, source: name };
  }
  const first = (get('x-forwarded-for') || '').split(',')[0].trim();
  return first ? { ip: first, source: 'x-forwarded-for 第一项（可能被伪造）' } : null;
}

// 同一网络的标识：IPv4 用完整地址；IPv6 只取前 64 位（同一台手机会在 /64 里随意换地址）
export function networkKey(raw: string): string {
  const ip = raw.trim().replace(/^\[|\]$/g, '').split('%')[0];
  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) return mapped[1];
  if (!ip.includes(':')) return ip;
  const [head, tail] = ip.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = tail !== undefined ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return groups.slice(0, 4).map((g) => (parseInt(g, 16) || 0).toString(16)).join(':') + '::/64';
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes: Uint8Array): string {
  let s = ''; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}
function sniffImage(b: Uint8Array): { ext: 'png' | 'jpg' | 'webp'; mime: string } | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', mime: 'image/png' };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { ext: 'webp', mime: 'image/webp' };
  return null;
}
function parseImage(dataUrl: unknown): { bytes: Uint8Array; ext: string; mime: string } | null {
  if (dataUrl == null || dataUrl === '') return null;
  const m = typeof dataUrl === 'string' && dataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) fail(400, '只支持 PNG、JPG、WebP 图片。');
  const bytes = b64ToBytes((m as RegExpMatchArray)[2]);
  if (bytes.length > 6 * 1024 * 1024) fail(413, '图片太大，请小于 6MB。');
  const kind = sniffImage(bytes);
  if (!kind) fail(400, '图片文件不完整或格式不对。');
  return { bytes, ...(kind as { ext: string; mime: string }) };
}
function imageSize(b: Uint8Array): { w: number; h: number } | null {
  const u32 = (i: number) => (b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3];
  const u16 = (i: number) => (b[i] << 8) | b[i + 1];
  if (b[0] === 0x89) return { w: u32(16), h: u32(20) };
  if (b[0] === 0xff) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1], len = u16(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: u16(i + 5), w: u16(i + 7) };
      i += 2 + len;
    }
  }
  return null;
}
function sizeFor(kind: Kind, dims: { w: number; h: number } | null) {
  if (kind !== 't2i' && kind !== 'i2i') return {};
  if (dims && dims.w > 0 && dims.h > 0) {
    const r = dims.w / dims.h;
    if (r > 1.2) return { width: 1280, height: 720 };
    if (r < 0.83) return { width: 720, height: 1280 };
    return { width: 1024, height: 1024 };
  }
  return { width: 1280, height: 720 };
}
function jimengRefusal(code: number): string {
  if ((code >= 50410 && code <= 50419) || (code >= 50510 && code <= 50519)) return '没有通过平台的安全审核（可能是图片，也可能是文字）。换一种说法或换一张图片试试。积分已退回。';
  if (code === 50429 || code === 50430) return '平台太忙了，等一会儿再试。积分已退回。';
  return `平台没有接受这个任务（代码 ${code || '未知'}），换一种描述再试。积分已退回。`;
}

// ---------- 作品对外的样子 ----------
async function present(deps: Deps, list: Work[], opts: { teacher?: boolean; mineStudentId?: string } = {}) {
  const paths = list.flatMap((w) => [w.output_path, w.input_path]).filter((p): p is string => !!p);
  const urls = paths.length ? await deps.storage.signedUrls([...new Set(paths)], URL_TTL) : {};
  return list.map((w) => ({
    id: w.id, tool: w.tool, kind: w.kind, by: w.author_name, prompt: w.prompt, status: w.status, message: w.message,
    text: w.output_text, type: w.output_type,
    file: w.output_path ? urls[w.output_path] || null : w.output_url,
    input: w.input_path ? urls[w.input_path] || null : null,
    cost: w.cost, refunded: w.refunded, created_at: w.created_at,
    seconds: w.completed_at ? Math.max(1, Math.round((Date.parse(w.completed_at) - Date.parse(w.created_at)) / 1000)) : null,
    ...(opts.teacher ? { hidden: w.hidden, can_resume: w.status === 'waiting' } : {}),
  }));
}

// ---------- 推进进行中的图片/视频任务（由页面轮询驱动，不需要常驻服务） ----------
async function advance(deps: Deps, filter: WorkFilter, limit = 3) {
  const { repo, providers, storage } = deps;
  const pending = await repo.pendingWorks(filter, 10);
  let handled = 0;
  for (const w of pending) {
    if (handled >= limit) break;
    const age = deps.now().getTime() - Date.parse(w.created_at);
    if (w.status === 'queued' && !w.provider_task_id) {
      // 提交过程中函数被中断：3 分钟后退回积分
      if (age > 180_000) await repo.rpc('ai_work_refund', { p_work: w.id, p_message: '提交没有完成，积分已退回。请重新提交。' });
      continue;
    }
    if (!w.provider_task_id) continue;
    const claimed = await repo.rpc<boolean>('ai_work_claim_poll', { p_work: w.id, p_min_seconds: 3 });
    if (!claimed) continue;
    handled++;
    if (age > 15 * 60_000) { await repo.updateWork(w.id, { status: 'waiting', message: '已经等了 15 分钟。老师可以点“继续查询”。' }); continue; }
    let data: any;
    try { data = await providers.jimeng('CVSync2AsyncGetResult', { req_key: w.model, task_id: w.provider_task_id }); }
    catch { await repo.updateWork(w.id, { message: '查询暂时中断，稍后自动再查（不会重新生成）。' }); continue; }
    if (data?.code !== 10000) { await repo.updateWork(w.id, { message: '平台暂时查不到结果，稍后自动再查。' }); continue; }
    const d = data.data || {};
    const st = String(d.status || '').toLowerCase();
    if (st === 'done') { await saveOutput(deps, w, d); continue; }
    if (['failed', 'fail', 'error', 'cancelled', 'canceled', 'expired', 'not_found'].includes(st)) {
      await repo.rpc('ai_work_refund', { p_work: w.id, p_message: '这次没有生成成功，可能是描述不合适或平台繁忙。积分已退回。' });
      continue;
    }
    await repo.updateWork(w.id, { status: 'running', message: w.tool === 'video' ? `正在做视频…已等 ${Math.round(age / 1000)} 秒` : '正在画…' });
  }
  void storage;
}

async function saveOutput(deps: Deps, w: Work, d: any) {
  const { repo, storage, providers } = deps;
  const done = (patch: Partial<Work>) => repo.updateWork(w.id, { ...patch, status: 'done', message: '完成', completed_at: deps.now().toISOString() });
  try {
    const b64 = (d.binary_data_base64 || []).find((x: unknown) => typeof x === 'string');
    if (b64) {
      const bytes = b64ToBytes(b64); const kind = sniffImage(bytes) || { ext: 'png', mime: 'image/png' };
      const path = `outputs/${w.id}.${kind.ext}`;
      await storage.upload(path, bytes, kind.mime);
      return await done({ output_path: path, output_type: 'image' });
    }
    const imgUrl = (d.image_urls || [])[0];
    if (imgUrl) {
      const f = await providers.download(imgUrl); const kind = sniffImage(f.bytes) || { ext: 'jpg', mime: 'image/jpeg' };
      const path = `outputs/${w.id}.${kind.ext}`;
      await storage.upload(path, f.bytes, kind.mime);
      return await done({ output_path: path, output_type: 'image' });
    }
    if (d.video_url) {
      try {
        const f = await providers.download(d.video_url);
        const path = `outputs/${w.id}.mp4`;
        await storage.upload(path, f.bytes, 'video/mp4');
        return await done({ output_path: path, output_type: 'video' });
      } catch {
        return await done({ output_url: d.video_url, output_type: 'video' });
      }
    }
    await repo.rpc('ai_work_refund', { p_work: w.id, p_message: '平台说完成了，但没有返回图片或视频。积分已退回。' });
  } catch (e) {
    await repo.updateWork(w.id, { message: '结果保存失败，稍后自动重试：' + String((e as Error).message).slice(0, 60) });
  }
}

// ---------- 提交 ----------
type Who = { role: 'teacher' | 'student' | 'self'; userId: string | null; studentId: string | null; name: string; classroom: Classroom | null };

async function create(deps: Deps, who: Who, body: Record<string, any>) {
  const { repo, storage, providers } = deps;
  let kind = String(body.kind || '') as Kind;
  if (!KIND_TOOL[kind]) fail(400, '不支持的功能。');
  const prompt = cleanText(body.prompt, 800);
  if (!prompt) fail(400, '请先写下你的要求。');
  if (!providers.configured()) fail(503, '还没有配置模型 API 密钥。');

  let img = parseImage(body.image);
  if (!img && typeof body.ref === 'string' && who.classroom) {
    const shared = (await repo.sharedByClassroom(who.classroom.id)).find((s) => s.id === body.ref);
    if (!shared) fail(400, '老师共享的这张图片已经删掉了，换一张。');
    const bytes = await storage.download((shared as Shared).path);
    const k = sniffImage(bytes); if (!k) fail(400, '图片格式不对。');
    img = { bytes, ...(k as { ext: string; mime: string }) };
  }
  if (kind === 'chat' && img) kind = 'vision';
  if ((kind === 'i2i' || kind === 'i2v') && !img) fail(400, '请先选一张图片。');
  if ((kind === 't2i' || kind === 't2v') && img) img = null;

  let inputPath: string | null = null;
  if (img) { inputPath = `inputs/${deps.uuid()}.${img.ext}`; await storage.upload(inputPath, img.bytes, img.mime); }

  let work: Work;
  try {
    work = await repo.rpc<Work>('ai_work_reserve', {
      p_kind: kind, p_prompt: prompt, p_author_name: who.name,
      p_classroom: who.classroom?.id ?? null, p_student: who.studentId, p_user: who.role === 'student' ? null : who.userId, p_input_path: inputPath,
    });
  } catch (e) {
    if (inputPath) await storage.remove([inputPath]).catch(() => {});
    dbError(e);
  }
  work = work!;

  if (kind === 'chat' || kind === 'vision') {
    await repo.updateWork(work.id, { status: 'running', message: 'AI 正在回答…' });
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 45_000);
    try {
      const imageDataUrl = img ? `data:${img.mime};base64,${bytesToB64(img.bytes)}` : undefined;
      const r = await providers.chat({ prompt, imageDataUrl, signal: ctrl.signal });
      await repo.updateWork(work.id, { status: 'done', message: '完成', output_text: r.text, output_type: 'text', model: r.model, completed_at: deps.now().toISOString() });
    } catch (e) {
      await repo.rpc('ai_work_refund', { p_work: work.id, p_message: (ctrl.signal.aborted ? '等了 45 秒还没回答，已停止。' : String((e as Error).message).slice(0, 120)) + ' 积分已退回。' });
    } finally { clearTimeout(timer); }
    return (await repo.work(work.id))!;
  }

  const model = MEDIA_MODEL[kind]!;
  const payload: Record<string, unknown> = { req_key: model, prompt, ...sizeFor(kind, img ? imageSize(img.bytes) : null) };
  if (kind === 't2v' || kind === 'i2v') payload.frames = 121;
  if (img) payload.binary_data_base64 = [bytesToB64(img.bytes)];
  let data: any;
  try { data = await providers.jimeng('CVSync2AsyncSubmitTask', payload); }
  catch (e) {
    const status = (e as { status?: number })?.status;
    if (status && [400, 401, 402, 403, 404, 413, 422, 429].includes(status)) {
      await repo.rpc('ai_work_refund', { p_work: work.id, p_message: status === 402 ? '模型平台余额不足，请联系老师。积分已退回。' : `提交失败（HTTP ${status}）。积分已退回。` });
    } else {
      await repo.updateWork(work.id, { status: 'unknown', model, message: '提交时网络中断，不确定平台是否收到。为避免重复扣费，没有自动重试。' });
    }
    return (await repo.work(work.id))!;
  }
  const taskId = data?.data?.task_id;
  if (data?.code !== 10000 || !taskId) {
    await repo.rpc('ai_work_refund', { p_work: work.id, p_message: jimengRefusal(Number(data?.code)) });
    return (await repo.work(work.id))!;
  }
  await repo.updateWork(work.id, { provider_task_id: String(taskId), model, status: 'running', message: kind.endsWith('v') ? '正在做视频，通常要 1～3 分钟。' : '正在画，通常半分钟左右。' });
  return (await repo.work(work.id))!;
}

// ---------- 身份 ----------
async function requireUser(req: Request) { if (!req.userId) fail(401, '请先登录健文社区账号。'); return req.userId!; }
// 读余额；第一次会建账号并按规则发赠送积分
const ensureBalance = (deps: Deps, req: Request, uid: string) => deps.repo.rpc<number>('ai_credit_ensure_account', { p_user: uid, p_ip_hash: req.ipHash ?? null });
async function requireStudent(deps: Deps, req: Request) {
  if (!req.studentToken) fail(401, '请先输入课堂口令。');
  const s = await deps.repo.studentByTokenHash(await deps.sha256(req.studentToken!));
  if (!s) fail(401, '请重新输入课堂口令。');
  const c = await deps.repo.classroomById(s!.classroom_id);
  if (!c || c.archived_at) fail(401, '这节课已经结束了。');
  return { student: s!, classroom: c! };
}
async function ownClassroom(deps: Deps, userId: string, id: unknown) {
  const c = typeof id === 'string' ? await deps.repo.classroomById(id) : null;
  if (!c) fail(404, '找不到这个课堂。');
  if (c!.teacher_id !== userId && !(await deps.repo.isAdmin(userId))) fail(403, '这不是你的课堂。');
  return c!;
}
async function newCode(deps: Deps): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const n = parseInt(deps.randomHex(4), 16) % 900000 + 100000;
    const code = String(n);
    if (!(await deps.repo.classroomByCode(code))) return code;
  }
  fail(500, '生成口令失败，请重试。');
  return '';
}

// ---------- 入口 ----------
export async function handle(req: Request, deps: Deps): Promise<Response> {
  try {
    return { status: 200, body: await route(req, deps) };
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, body: { error: e.message } };
    return { status: 500, body: { error: '服务出错了：' + String((e as Error)?.message || e).replace(/sk-[\w-]+/g, '[隐藏]').slice(0, 160) } };
  }
}

async function route(req: Request, deps: Deps): Promise<unknown> {
  const { repo } = deps;
  const b = req.body || {};
  const now = deps.now();

  switch (req.action) {
    // ===== 学生 =====
    case 'join': {
      const code = String(b.code || '').trim();
      const name = cleanText(b.name, 12).replace(/[<>]/g, '');
      if (!name) fail(400, '请写上你的名字或座号。');
      if (!/^\d{6}$/.test(code)) fail(400, '课堂口令是 6 位数字。');
      const c = await repo.classroomByCode(code);
      if (!c || c.archived_at) fail(404, '课堂口令不对，看看大屏幕上的口令。');
      const token = deps.randomHex(24);
      await repo.insertStudent({ classroom_id: c!.id, display_name: name, token_hash: await deps.sha256(token) });
      return { token, name, classroom: { title: c!.title } };
    }
    case 'student-state': {
      const { student, classroom } = await requireStudent(deps, req);
      if (now.getTime() - Date.parse(student.last_seen_at) > 10_000) await repo.updateStudent(student.id, { last_seen_at: now.toISOString() });
      await advance(deps, { studentId: student.id }, 2);
      const tools = effectiveTools(classroom, now);
      const quotaLeft = {} as Record<Tool, number>;
      for (const t of TOOLS) quotaLeft[t] = tools[t].open ? Math.max(0, tools[t].quota - (await repo.countActiveWorks(student.id, t, tools[t].round))) : 0;
      const shared = await repo.sharedByClassroom(classroom.id);
      const urls = shared.length ? await deps.storage.signedUrls(shared.map((s) => s.path), URL_TTL) : {};
      return {
        classroom: { title: classroom.title }, name: student.display_name,
        tools: Object.fromEntries(TOOLS.map((t) => [t, { open: tools[t].open, remainingMs: tools[t].remainingMs, quota: tools[t].quota, quotaLeft: quotaLeft[t], task: tools[t].task }])),
        shared: shared.map((s) => ({ id: s.id, url: urls[s.path] })),
        works: await present(deps, await repo.works({ studentId: student.id }, 12)),
        now: now.toISOString(),
      };
    }
    case 'student-rename': {
      const { student } = await requireStudent(deps, req);
      const name = cleanText(b.name, 12).replace(/[<>]/g, '');
      if (!name) fail(400, '名字不能为空。');
      await repo.updateStudent(student.id, { display_name: name });
      return { ok: true, name };
    }
    case 'student-create': {
      const { student, classroom } = await requireStudent(deps, req);
      const w = await create(deps, { role: 'student', userId: null, studentId: student.id, name: student.display_name, classroom }, b);
      return { work: (await present(deps, [w]))[0] };
    }

    // ===== 登录用户（老师 / 自学） =====
    case 'me': {
      const uid = await requireUser(req);
      const balance = await ensureBalance(deps, req, uid);
      const classes = (await repo.classroomsByTeacher(uid)).filter((c) => !c.archived_at);
      return { balance, prices: await repo.prices(), is_admin: await repo.isAdmin(uid), classrooms: classes.map((c) => ({ id: c.id, title: c.title, join_code: c.join_code, created_at: c.created_at })) };
    }
    case 'class-create': {
      const uid = await requireUser(req);
      await ensureBalance(deps, req, uid); // 老师账号在这里按网络规则建好；学生提交时只会建 0 余额账号
      const title = cleanText(b.title, 60) || '我的课堂';
      for (let i = 0; i < 3; i++) {
        try { const c = await repo.insertClassroom({ teacher_id: uid, title, join_code: await newCode(deps) }); return { classroom: { id: c.id, title: c.title, join_code: c.join_code } }; }
        catch (e) { if (!String((e as Error).message).includes('DUPLICATE')) throw e; }
      }
      fail(500, '创建失败，请重试。');
      return null;
    }
    case 'class-state': {
      const uid = await requireUser(req);
      const c = await ownClassroom(deps, uid, b.classroom_id);
      await advance(deps, { classroomId: c.id }, 3);
      const tools = effectiveTools(c, now);
      const students = await repo.studentsByClassroom(c.id);
      const works = await repo.works({ classroomId: c.id }, 120);
      const counts = new Map<string, number>(); for (const w of works) if (w.student_id) counts.set(w.student_id, (counts.get(w.student_id) || 0) + 1);
      const shared = await repo.sharedByClassroom(c.id);
      const urls = shared.length ? await deps.storage.signedUrls(shared.map((s) => s.path), URL_TTL) : {};
      return {
        classroom: { id: c.id, title: c.title, join_code: c.join_code, spend_limit: c.spend_limit },
        tools,
        students: students.map((s) => ({ id: s.id, name: s.display_name, online: now.getTime() - Date.parse(s.last_seen_at) < ONLINE_MS, count: counts.get(s.id) || 0 })),
        works: await present(deps, works, { teacher: true }),
        shared: shared.map((s) => ({ id: s.id, url: urls[s.path] })),
        spent: await repo.classroomSpent(c.id),
        balance: await ensureBalance(deps, req, uid),
        configured: deps.providers.configured(),
        now: now.toISOString(),
      };
    }
    case 'class-update': {
      const uid = await requireUser(req);
      const c = await ownClassroom(deps, uid, b.classroom_id);
      const patch: Partial<Classroom> = {};
      if (typeof b.title === 'string' && b.title.trim()) patch.title = b.title.trim().slice(0, 60);
      if (b.spend_limit === null || (Number.isInteger(b.spend_limit) && b.spend_limit >= 0)) patch.spend_limit = b.spend_limit;
      if (b.tool) {
        const t = b.tool as Tool; if (!TOOLS.includes(t)) fail(400, '没有这个功能。');
        const tools = { ...c.tools } as Record<Tool, ToolState>;
        const s: ToolState = { ...(tools[t] || { open: false, until: null, quota: 1, round: 0, task: '' }) };
        if (Number.isInteger(b.quota) && b.quota >= 1 && b.quota <= 20) s.quota = b.quota;
        if (typeof b.task === 'string') s.task = b.task.trim().slice(0, 120);
        if (b.open === true) { s.open = true; s.round = (s.round || 0) + 1; s.until = Number(b.minutes) > 0 ? new Date(now.getTime() + Math.min(Number(b.minutes), 60) * 60_000).toISOString() : null; }
        if (b.open === false) { s.open = false; s.until = null; }
        if (Number(b.addMinutes) > 0 && effectiveTools(c, now)[t].open) {
          const base = s.until ? Date.parse(s.until) : null;
          if (base) s.until = new Date(base + Math.min(Number(b.addMinutes), 30) * 60_000).toISOString();
        }
        tools[t] = s; patch.tools = tools;
      }
      if (b.close_all) { const tools = { ...c.tools } as Record<Tool, ToolState>; for (const t of TOOLS) tools[t] = { ...tools[t], open: false, until: null }; patch.tools = tools; }
      if (b.new_code) patch.join_code = await newCode(deps);
      if (b.archive) { patch.archived_at = now.toISOString(); const tools = { ...c.tools } as Record<Tool, ToolState>; for (const t of TOOLS) tools[t] = { ...tools[t], open: false, until: null }; patch.tools = tools; }
      if (b.clear_students) await repo.deleteStudentsByClassroom(c.id);
      const updated = Object.keys(patch).length ? await repo.updateClassroom(c.id, patch) : c;
      return { ok: true, join_code: updated.join_code };
    }
    case 'work-action': {
      const uid = await requireUser(req);
      const w = typeof b.work_id === 'string' ? await repo.work(b.work_id) : null;
      if (!w) fail(404, '找不到这个作品。');
      if (w!.classroom_id) await ownClassroom(deps, uid, w!.classroom_id);
      else if (w!.user_id !== uid) fail(403, '这不是你的作品。');
      const act = String(b.act);
      if (act === 'hide' || act === 'show') await repo.updateWork(w!.id, { hidden: act === 'hide' });
      else if (act === 'resume') { if (w!.status === 'waiting' && w!.provider_task_id) await repo.updateWork(w!.id, { status: 'running', created_at: now.toISOString(), message: '继续查询…' }); }
      else if (act === 'share') {
        if (!w!.classroom_id) fail(400, '只有课堂里的作品可以共享。');
        const src = w!.output_type === 'image' && w!.output_path ? w!.output_path : w!.input_path;
        if (!src) fail(400, '这个作品没有图片可以共享。');
        const bytes = await deps.storage.download(src!); const k = sniffImage(bytes) || { ext: 'png', mime: 'image/png' };
        const path = `shared/${w!.classroom_id}/${deps.uuid()}.${k.ext}`;
        await deps.storage.upload(path, bytes, k.mime);
        await repo.insertShared({ classroom_id: w!.classroom_id!, path });
      } else fail(400, '不支持的操作。');
      return { ok: true };
    }
    case 'shared-add': {
      const uid = await requireUser(req);
      const c = await ownClassroom(deps, uid, b.classroom_id);
      const img = parseImage(b.image); if (!img) fail(400, '请选一张图片。');
      const path = `shared/${c.id}/${deps.uuid()}.${img!.ext}`;
      await deps.storage.upload(path, img!.bytes, img!.mime);
      await repo.insertShared({ classroom_id: c.id, path });
      return { ok: true };
    }
    case 'shared-remove': {
      const uid = await requireUser(req);
      const c = await ownClassroom(deps, uid, b.classroom_id);
      const s = await repo.deleteShared(String(b.shared_id), c.id);
      if (s) await deps.storage.remove([s.path]).catch(() => {});
      return { ok: true };
    }
    case 'create': {
      const uid = await requireUser(req);
      await ensureBalance(deps, req, uid); // 先按网络规则建账号，再扣费，避免直接调用 create 绕过赠送限制
      let classroom: Classroom | null = null;
      if (b.classroom_id) classroom = await ownClassroom(deps, uid, b.classroom_id);
      const name = classroom ? '老师' : cleanText(b.author_name, 20) || '我';
      const w = await create(deps, { role: classroom ? 'teacher' : 'self', userId: uid, studentId: null, name, classroom }, b);
      return { work: (await present(deps, [w]))[0], balance: await ensureBalance(deps, req, uid) };
    }
    case 'my-works': {
      const uid = await requireUser(req);
      await advance(deps, { userId: uid, personal: true }, 3);
      return {
        works: await present(deps, await repo.works({ userId: uid, personal: true }, 30)),
        balance: await ensureBalance(deps, req, uid),
        prices: await repo.prices(),
      };
    }
    case 'selftest': {
      const uid = await requireUser(req);
      if (!(await repo.isAdmin(uid))) fail(403, '只有管理员可以检查。');
      const ipNote = `来源 IP 取自：${req.ipSource || '没有取到（同一网络限领不生效）'}。`;
      if (!deps.providers.configured()) return { ok: false, message: '还没有配置 WANJIE_API_KEY。' + ipNote };
      const t0 = Date.now();
      try { const r = await deps.providers.chat({ prompt: '用一句话说“你好，同学们”。', signal: AbortSignal.timeout(20_000) }); return { ok: true, message: `连接正常（${r.model}，${((Date.now() - t0) / 1000).toFixed(1)} 秒）：${r.text.slice(0, 40)}。${ipNote}` }; }
      catch (e) { return { ok: false, message: '连接失败：' + String((e as Error).message).slice(0, 120) + ' ' + ipNote }; }
    }
    case 'admin-grant': {
      const uid = await requireUser(req);
      if (!(await repo.isAdmin(uid))) fail(403, '只有管理员可以加积分。');
      const amount = Number(b.amount);
      if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) fail(400, '积分数量不对。');
      const target = typeof b.user_id === 'string' && b.user_id ? b.user_id : uid;
      const balance = await repo.rpc<number>('ai_credit_grant', { p_user: target, p_amount: amount, p_reason: 'grant', p_note: cleanText(b.note, 80) || '管理员发放', p_ref_type: null, p_ref_id: null });
      return { ok: true, balance };
    }
  }
  fail(400, '不支持的操作。');
  return null;
}
