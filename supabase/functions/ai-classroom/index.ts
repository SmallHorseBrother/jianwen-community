// AI 课堂工作台 Edge Function
// 部署后在 Function 设置里关闭 “Verify JWT”（学生不登录，用课堂口令换来的令牌访问）。
// 需要的 Secrets：WANJIE_API_KEY（万界数据密钥）。可选：WANJIE_API_BASE、AI_CLASSROOM_CHAT_MODEL、AI_CLASSROOM_VISION_MODEL。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handle, type Classroom, type Deps, type Repo, type Shared, type Student, type Work, type WorkFilter } from './core.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-class-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const env = (k: string) => Deno.env.get(k)?.trim() || '';
function keyFromDict(name: string) {
  try { const v = JSON.parse(env(name) || '{}'); return typeof v.default === 'string' ? v.default : ''; } catch { return ''; }
}
const SUPABASE_URL = env('SUPABASE_URL');
const SECRET = keyFromDict('SUPABASE_SECRET_KEYS') || env('SUPABASE_SERVICE_ROLE_KEY');
const PUBLISHABLE = keyFromDict('SUPABASE_PUBLISHABLE_KEYS') || env('SUPABASE_ANON_KEY');
const BUCKET = 'ai-classroom';
const db = createClient(SUPABASE_URL, SECRET, { auth: { autoRefreshToken: false, persistSession: false } });

function check<T>(r: { data: T; error: { message: string; code?: string } | null }): T {
  if (r.error) throw new Error(r.error.code === '23505' ? 'DUPLICATE' : r.error.message);
  return r.data;
}
function applyFilter<Q extends { eq: Function; is: Function }>(q: Q, f: WorkFilter): Q {
  if (f.classroomId) q = q.eq('classroom_id', f.classroomId);
  if (f.studentId) q = q.eq('student_id', f.studentId);
  if (f.userId) q = q.eq('user_id', f.userId);
  if (f.personal) q = q.is('classroom_id', null);
  return q;
}

const repo: Repo = {
  async rpc(fn, args) { return check(await db.rpc(fn, args)) as any; },
  async classroomsByTeacher(id) { return check(await db.from('ai_classrooms').select('*').eq('teacher_id', id).order('created_at', { ascending: false }).limit(50)) as Classroom[]; },
  async classroomById(id) { return check(await db.from('ai_classrooms').select('*').eq('id', id).maybeSingle()) as Classroom | null; },
  async classroomByCode(code) { return check(await db.from('ai_classrooms').select('*').eq('join_code', code).maybeSingle()) as Classroom | null; },
  async insertClassroom(row) { return check(await db.from('ai_classrooms').insert(row).select('*').single()) as Classroom; },
  async updateClassroom(id, patch) { return check(await db.from('ai_classrooms').update(patch).eq('id', id).select('*').single()) as Classroom; },
  async insertStudent(row) { return check(await db.from('ai_classroom_students').insert(row).select('*').single()) as Student; },
  async studentByTokenHash(hash) { return check(await db.from('ai_classroom_students').select('*').eq('token_hash', hash).maybeSingle()) as Student | null; },
  async updateStudent(id, patch) { check(await db.from('ai_classroom_students').update(patch).eq('id', id)); },
  async studentsByClassroom(id) { return check(await db.from('ai_classroom_students').select('*').eq('classroom_id', id).order('created_at').limit(200)) as Student[]; },
  async deleteStudentsByClassroom(id) { check(await db.from('ai_classroom_students').delete().eq('classroom_id', id)); },
  async work(id) { return check(await db.from('ai_works').select('*').eq('id', id).maybeSingle()) as Work | null; },
  async updateWork(id, patch) { check(await db.from('ai_works').update(patch).eq('id', id)); },
  async works(f, limit) { return check(await applyFilter(db.from('ai_works').select('*'), f).order('created_at', { ascending: false }).limit(limit)) as Work[]; },
  async pendingWorks(f, limit) { return check(await applyFilter(db.from('ai_works').select('*'), f).in('status', ['queued', 'running']).order('created_at').limit(limit)) as Work[]; },
  async countActiveWorks(studentId, tool, round) {
    const r = await db.from('ai_works').select('id', { count: 'exact', head: true }).eq('student_id', studentId).eq('tool', tool).eq('round', round).neq('status', 'failed');
    if (r.error) throw new Error(r.error.message); return r.count || 0;
  },
  async classroomSpent(id) {
    const rows = check(await db.from('ai_works').select('cost').eq('classroom_id', id).eq('refunded', false).limit(5000)) as Array<{ cost: number }>;
    return rows.reduce((a, r) => a + (r.cost || 0), 0);
  },
  async sharedByClassroom(id) { return check(await db.from('ai_classroom_shared').select('*').eq('classroom_id', id).order('created_at')) as Shared[]; },
  async insertShared(row) { return check(await db.from('ai_classroom_shared').insert(row).select('*').single()) as Shared; },
  async deleteShared(id, classroomId) { return check(await db.from('ai_classroom_shared').delete().eq('id', id).eq('classroom_id', classroomId).select('*').maybeSingle()) as Shared | null; },
  async prices() { return check(await db.from('ai_credit_prices').select('kind, credits, label').order('credits')) as any; },
  async isAdmin(id) {
    const p = check(await db.from('profiles').select('user_role').eq('id', id).maybeSingle()) as { user_role?: string } | null;
    return ['admin', 'super_admin'].includes(p?.user_role || '');
  },
};

const storage: Deps['storage'] = {
  async upload(path, bytes, contentType) { check(await db.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true })); },
  async download(path) { const blob = check(await db.storage.from(BUCKET).download(path)) as Blob; return new Uint8Array(await blob.arrayBuffer()); },
  async signedUrls(paths, ttl) {
    const rows = check(await db.storage.from(BUCKET).createSignedUrls(paths, ttl)) as Array<{ path: string; signedUrl: string }>;
    return Object.fromEntries(rows.filter((r) => r.signedUrl).map((r) => [r.path, r.signedUrl]));
  },
  async remove(paths) { check(await db.storage.from(BUCKET).remove(paths)); },
};

const API_BASE = (env('WANJIE_API_BASE') || 'https://maas-openapi.wanjiedata.com/api').replace(/\/$/, '');
const SYSTEM = [
  '你是 AI 课堂里的助手，用自然、简短的中文回答，一般不超过200字。',
  '事实不确定就直接说不确定，不编造；创作内容要说明是创作。',
  '看图时只说能看见的内容，推测要说明是推测。你不能联网搜索，也不能执行代码。',
  '不要索取或记录姓名、住址、电话、照片、账号和密码。内容必须适合中小学生。',
].join('');
const providers: Deps['providers'] = {
  configured: () => !!env('WANJIE_API_KEY'),
  async chat({ prompt, imageDataUrl, signal }) {
    const model = imageDataUrl ? env('AI_CLASSROOM_VISION_MODEL') || 'qwen3-vl-flash' : env('AI_CLASSROOM_CHAT_MODEL') || 'qwen-flash';
    const content = imageDataUrl ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageDataUrl } }] : prompt;
    const r = await fetch(`${API_BASE}/v1/chat/completions`, {
      method: 'POST', signal,
      headers: { Authorization: 'Bearer ' + env('WANJIE_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content }], max_tokens: 600, enable_thinking: false }),
    });
    let data: any; try { data = await r.json(); } catch { throw new Error(`模型服务没有返回可读取的结果（HTTP ${r.status}）。`); }
    if (!r.ok || data.error) throw new Error(({ 401: '模型密钥无效或过期。', 402: '模型平台余额不足。', 429: '请求太多，稍等再试。' } as Record<number, string>)[r.status] || `模型服务返回 HTTP ${r.status}`);
    const text = String(data.choices?.[0]?.message?.content || '').trim();
    if (!text) throw new Error('模型这次没有返回文字，请换个说法再试。');
    return { text, model: data.model || model };
  },
  async jimeng(action, payload) {
    const r = await fetch(`${API_BASE}/jimeng/v1?Action=${action}&Version=2022-08-31`, {
      method: 'POST', signal: AbortSignal.timeout(30_000),
      headers: { Authorization: 'Bearer ' + env('WANJIE_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status });
    return r.json();
  },
  async download(url) {
    const u = new URL(url); if (u.protocol !== 'https:') throw new Error('不安全的地址');
    const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!r.ok) throw new Error('下载失败 HTTP ' + r.status);
    return { bytes: new Uint8Array(await r.arrayBuffer()), contentType: r.headers.get('content-type') || '' };
  },
};

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const deps: Deps = {
  repo, storage, providers,
  now: () => new Date(),
  uuid: () => crypto.randomUUID(),
  randomHex: (n) => hex(crypto.getRandomValues(new Uint8Array(n)).buffer),
  sha256: async (t) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))),
};

async function userIdFrom(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  if (token === PUBLISHABLE) return null; // 只带了公开 key，相当于没登录
  const client = createClient(SUPABASE_URL, PUBLISHABLE, { global: { headers: { Authorization: auth } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) return null;
  return data.user.id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: '只支持 POST' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });
  let body: Record<string, any> = {};
  try {
    const raw = await req.text();
    if (raw.length > 9_000_000) return new Response(JSON.stringify({ error: '提交的内容太大（图片请小于 6MB）。' }), { status: 413, headers: { ...cors, 'Content-Type': 'application/json' } });
    body = raw ? JSON.parse(raw) : {};
  } catch { return new Response(JSON.stringify({ error: '请求格式不对。' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }); }
  const out = await handle({ action: String(body.action || ''), body, userId: await userIdFrom(req), studentToken: req.headers.get('x-class-token') }, deps);
  return new Response(JSON.stringify(out.body), { status: out.status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
});
