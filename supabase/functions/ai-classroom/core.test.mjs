// 本地测试：真实 Postgres（迁移 + RPC）+ 模拟模型平台 + 内存存储。
// 运行：node --experimental-strip-types supabase/functions/ai-classroom/core.test.mjs
// 需要环境变量 PGTEST="psql 连接参数"，并已执行迁移。
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { handle } from './core.ts';

const PSQL = (process.env.PGTEST || '-h /var/tmp -p 5499 -U postgres -d jw').split(' ');
const q = (sql) => {
  const out = execFileSync('psql', [...PSQL, '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return out;
};
const lit = (v) => v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : typeof v === 'object' ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb` : `'${String(v).replace(/'/g, "''")}'`;
const rows = (sql) => { const out = q(`with t as (${sql}) select coalesce(json_agg(t), '[]') from t`); return JSON.parse(out || '[]'); };
const one = (sql) => rows(sql)[0] || null;
const setClause = (patch) => Object.entries(patch).map(([k, v]) => `${k} = ${lit(v)}`).join(', ');
const where = (f) => [f.classroomId && `classroom_id = ${lit(f.classroomId)}`, f.studentId && `student_id = ${lit(f.studentId)}`, f.userId && `user_id = ${lit(f.userId)}`, f.personal && 'classroom_id is null'].filter(Boolean).join(' and ') || 'true';

const repo = {
  async rpc(fn, args) {
    const sig = Object.entries(args).map(([k, v]) => `${k} => ${lit(v)}${v === null ? '' : ''}`);
    try {
      const out = q(`select to_json(r) from (select ${fn}(${sig.join(', ')}) as r) x`);
      const v = JSON.parse(out);
      return v;
    } catch (e) { throw new Error(String(e.stderr || e.message)); }
  },
  async classroomsByTeacher(id) { return rows(`select * from ai_classrooms where teacher_id = ${lit(id)} order by created_at desc`); },
  async classroomById(id) { return one(`select * from ai_classrooms where id = ${lit(id)}`); },
  async classroomByCode(code) { return one(`select * from ai_classrooms where join_code = ${lit(code)}`); },
  async insertClassroom(r) { try { return one(`insert into ai_classrooms (teacher_id, title, join_code) values (${lit(r.teacher_id)}, ${lit(r.title)}, ${lit(r.join_code)}) returning *`); } catch (e) { throw new Error(String(e.stderr).includes('23505') || String(e.stderr).includes('duplicate') ? 'DUPLICATE' : String(e.stderr)); } },
  async updateClassroom(id, patch) { return one(`update ai_classrooms set ${setClause(patch)} where id = ${lit(id)} returning *`); },
  async insertStudent(r) { return one(`insert into ai_classroom_students (classroom_id, display_name, token_hash) values (${lit(r.classroom_id)}, ${lit(r.display_name)}, ${lit(r.token_hash)}) returning *`); },
  async studentByTokenHash(h) { return one(`select * from ai_classroom_students where token_hash = ${lit(h)}`); },
  async updateStudent(id, patch) { q(`update ai_classroom_students set ${setClause(patch)} where id = ${lit(id)}`); },
  async studentsByClassroom(id) { return rows(`select * from ai_classroom_students where classroom_id = ${lit(id)} order by created_at`); },
  async deleteStudentsByClassroom(id) { q(`delete from ai_classroom_students where classroom_id = ${lit(id)}`); },
  async work(id) { return one(`select * from ai_works where id = ${lit(id)}`); },
  async updateWork(id, patch) { q(`update ai_works set ${setClause(patch)} where id = ${lit(id)}`); },
  async works(f, limit) { return rows(`select * from ai_works where ${where(f)} order by created_at desc limit ${limit}`); },
  async pendingWorks(f, limit) { return rows(`select * from ai_works where ${where(f)} and status in ('queued','running') order by created_at limit ${limit}`); },
  async countActiveWorks(s, t, r) { return Number(q(`select count(*) from ai_works where student_id = ${lit(s)} and tool = ${lit(t)} and round = ${r} and status <> 'failed'`)); },
  async classroomSpent(id) { return Number(q(`select coalesce(sum(cost),0) from ai_works where classroom_id = ${lit(id)} and not refunded`)); },
  async sharedByClassroom(id) { return rows(`select * from ai_classroom_shared where classroom_id = ${lit(id)} order by created_at`); },
  async insertShared(r) { return one(`insert into ai_classroom_shared (classroom_id, path) values (${lit(r.classroom_id)}, ${lit(r.path)}) returning *`); },
  async deleteShared(id, cid) { return one(`delete from ai_classroom_shared where id = ${lit(id)} and classroom_id = ${lit(cid)} returning *`); },
  async prices() { return rows(`select kind, credits, label from ai_credit_prices order by credits`); },
  async isAdmin(id) { return !!one(`select 1 from profiles where id = ${lit(id)} and user_role in ('admin','super_admin')`); },
};

const files = new Map();
const storage = {
  async upload(p, b) { files.set(p, b); },
  async download(p) { if (!files.has(p)) throw new Error('not found'); return files.get(p); },
  async signedUrls(ps) { return Object.fromEntries(ps.map((p) => [p, `https://store.test/${p}?sig=1`])); },
  async remove(ps) { ps.forEach((p) => files.delete(p)); },
};

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000500000002d00806000000', 'hex'); // 1280x720 头
const tasks = new Map(); let n = 0;
const calls = [];
const providers = {
  configured: () => true,
  async chat({ prompt, imageDataUrl }) { calls.push(['chat', prompt]); if (prompt.includes('坏掉')) throw new Error('模型服务返回 HTTP 500'); return { text: imageDataUrl ? '我看到一张图片。' : `回答：${prompt}`, model: imageDataUrl ? 'qwen3-vl-flash' : 'qwen-flash' }; },
  async jimeng(action, p) {
    calls.push([action, p.req_key, p.width, p.height]);
    if (action === 'CVSync2AsyncSubmitTask') {
      if (p.prompt.includes('审核')) return { code: 50412, message: 'Risk' };
      if (p.prompt.includes('断网')) throw Object.assign(new Error('timeout'), {});
      if (p.prompt.includes('没钱')) throw Object.assign(new Error('HTTP 402'), { status: 402 });
      const id = 't' + (++n); tasks.set(id, { polls: 0, video: p.req_key.includes('2v'), fail: p.prompt.includes('生成失败') }); return { code: 10000, data: { task_id: id } };
    }
    const t = tasks.get(p.task_id); t.polls++;
    if (t.polls < 2) return { code: 10000, data: { status: 'generating' } };
    if (t.fail) return { code: 10000, data: { status: 'failed' } };
    if (t.video) return { code: 10000, data: { status: 'done', video_url: 'https://cdn.test/v.mp4' } };
    return { code: 10000, data: { status: 'done', binary_data_base64: [PNG.toString('base64')] } };
  },
  async download() { return { bytes: new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]), contentType: 'video/mp4' }; },
};

let clock = Date.now();
const deps = { repo, storage, providers, now: () => new Date(clock), uuid: randomUUID, randomHex: (k) => randomBytes(k).toString('hex'), sha256: async (t) => createHash('sha256').update(t).digest('hex') };
const call = (action, body = {}, who = {}) => handle({ action, body, userId: who.user || null, studentToken: who.token || null }, deps);
const ok = async (p) => { const r = await p; if (r.status !== 200) throw new Error(`HTTP ${r.status}: ${JSON.stringify(r.body)}`); return r.body; };
const err = async (p, status) => { const r = await p; assert.equal(r.status, status, JSON.stringify(r.body)); return r.body.error; };
const balance = (u) => Number(q(`select balance from ai_credit_accounts where user_id = ${lit(u)}`));
const tick = (ms) => { clock += ms; q(`update ai_works set last_polled_at = last_polled_at - interval '${Math.ceil(ms / 1000)} seconds' where last_polled_at is not null`); };

const T = randomUUID(), U = randomUUID(), ADMIN = randomUUID();
q(`insert into auth.users (id) values (${lit(T)}), (${lit(U)}), (${lit(ADMIN)})`);
q(`insert into profiles (id, user_role) values (${lit(ADMIN)}, 'admin')`);
const pass = (m) => console.log('PASS ' + m);

// ---- 老师建课堂 ----
await err(call('me'), 401); pass('未登录不能用老师功能');
let me = await ok(call('me', {}, { user: T }));
assert.equal(me.balance, 100); pass('老师首次进入送 100 积分');
await ok(call('admin-grant', { user_id: T, amount: 1000 }, { user: ADMIN }));
await err(call('admin-grant', { user_id: T, amount: 1000 }, { user: U }), 403); pass('只有管理员能加积分');
const { classroom } = await ok(call('class-create', { title: '五年级 AI 课' }, { user: T }));
assert.match(classroom.join_code, /^\d{6}$/); pass('创建课堂，6 位口令');
await err(call('class-state', { classroom_id: classroom.id }, { user: U }), 403); pass('别人看不了这个课堂');

// ---- 学生进入 ----
await err(call('join', { code: '000000', name: '3号' }), 404); pass('错误口令被拒绝');
const j = await ok(call('join', { code: classroom.join_code, name: '3号' }));
const S = { token: j.token };
const j2 = await ok(call('join', { code: classroom.join_code, name: '7号' }));
let st = await ok(call('student-state', {}, S));
assert.equal(st.tools.image.open, false); pass('没开放时学生看到全部关闭');
await err(call('student-create', { kind: 't2i', prompt: '一只猫' }, S), 403); pass('关闭时学生提交被拒绝');
await err(call('student-create', { kind: 't2i', prompt: '一只猫' }, { token: 'bad' }), 401); pass('假令牌被拒绝');

// ---- 老师开放画图 5 分钟、每人 2 次 ----
await ok(call('class-update', { classroom_id: classroom.id, tool: 'image', open: true, minutes: 5, quota: 2, task: '画一个游戏主角' }, { user: T }));
st = await ok(call('student-state', {}, S));
assert.equal(st.tools.image.open, true); assert.equal(st.tools.image.quotaLeft, 2); assert.equal(st.tools.image.task, '画一个游戏主角'); pass('开放后学生看到画图、任务和次数');
const before = balance(T);
let w = (await ok(call('student-create', { kind: 't2i', prompt: '戴红围巾的小机器人' }, S))).work;
assert.equal(w.status, 'running'); assert.equal(balance(T), before - 10); pass('学生画图：扣老师 10 积分，任务已提交');
assert.deepEqual(calls.at(-1).slice(0, 4), ['CVSync2AsyncSubmitTask', 'jimeng_t2i_v40', 1280, 720]);
// 照片改图（上传）
const img = 'data:image/png;base64,' + PNG.toString('base64');
const w2 = (await ok(call('student-create', { kind: 'i2i', prompt: '保留机器人，背景换成月球', image: img }, S))).work;
assert.ok(w2.input); pass('照片改图：原图已存，返回签名链接');
await err(call('student-create', { kind: 't2i', prompt: '第三次' }, S), 429); pass('第 3 次被限次');
await err(call('student-create', { kind: 't2v', prompt: '视频' }, S), 403); pass('没开放的做视频被拒绝');
// 轮询推进
tick(4000); await ok(call('student-state', {}, S)); tick(4000); st = await ok(call('student-state', {}, S));
const done = st.works.filter((x) => x.status === 'done');
assert.equal(done.length, 2); assert.ok(done[0].file.startsWith('https://store.test/outputs/')); pass('页面轮询推进：两张图都完成并存进存储');
// 审核不通过 → 退积分、不占次数
const j3 = await ok(call('join', { code: classroom.join_code, name: '11号' }));
const b3 = balance(T);
w = (await ok(call('student-create', { kind: 't2i', prompt: '这段没过审核' }, { token: j3.token }))).work;
assert.equal(w.status, 'failed'); assert.ok(w.refunded); assert.equal(balance(T), b3); assert.match(w.message, /安全审核/); pass('平台审核拒绝：显示原因，积分退回');
st = await ok(call('student-state', {}, { token: j3.token })); assert.equal(st.tools.image.quotaLeft, 2); pass('失败的不占次数');
// 生成失败 → 退
w = (await ok(call('student-create', { kind: 't2i', prompt: '生成失败的图' }, { token: j3.token }))).work;
tick(4000); await ok(call('student-state', {}, { token: j3.token })); tick(4000); st = await ok(call('student-state', {}, { token: j3.token }));
assert.equal(st.works.find((x) => x.id === w.id).status, 'failed'); assert.ok(st.works.find((x) => x.id === w.id).refunded); pass('平台生成失败：自动退积分');
// 网络中断 → unknown，不退不重试
w = (await ok(call('student-create', { kind: 't2i', prompt: '断网的图' }, { token: j3.token }))).work;
assert.equal(w.status, 'unknown'); assert.equal(w.refunded, false); pass('提交时断网：标记“不确定”，不自动重试');

// ---- 共享图片，学生不上传直接改 ----
const cs = await ok(call('class-state', { classroom_id: classroom.id }, { user: T }));
const firstImg = cs.works.find((x) => x.type === 'image');
await ok(call('work-action', { work_id: firstImg.id, act: 'share' }, { user: T }));
st = await ok(call('student-state', {}, { token: j2.token }));
assert.equal(st.shared.length, 1); pass('老师共享图片，学生能看到');
w = (await ok(call('student-create', { kind: 'i2i', prompt: '只把围巾改成蓝色', ref: st.shared[0].id }, { token: j2.token }))).work;
assert.equal(w.status, 'running'); assert.ok(w.input); pass('学生用老师共享的图改图');

// ---- 到时间自动关 / 全部关闭 ----
tick(6 * 60_000);
st = await ok(call('student-state', {}, S)); assert.equal(st.tools.image.open, false); pass('开放时间到，自动关闭');
await ok(call('class-update', { classroom_id: classroom.id, tool: 'chat', open: true, minutes: 0, quota: 3 }, { user: T }));
w = (await ok(call('student-create', { kind: 'chat', prompt: '用三句话介绍机械臂' }, S))).work;
assert.equal(w.status, 'done'); assert.match(w.text, /回答/); pass('问 AI：直接得到回答');
w = (await ok(call('student-create', { kind: 'chat', prompt: '这张图里有什么', image: img }, S))).work;
assert.equal(w.kind, 'vision'); pass('问 AI 加图片：走识图模型');
w = (await ok(call('student-create', { kind: 'chat', prompt: '坏掉的问题' }, S))).work;
assert.equal(w.status, 'failed'); assert.ok(w.refunded); pass('模型报错：退积分');
await ok(call('class-update', { classroom_id: classroom.id, close_all: true }, { user: T }));
st = await ok(call('student-state', {}, S)); assert.ok(Object.values(st.tools).every((t) => !t.open)); pass('全部关闭');

// ---- 老师演示：视频（不受开关），视频下载到存储 ----
w = (await ok(call('create', { classroom_id: classroom.id, kind: 'i2v', prompt: '机器人挥手', image: img }, { user: T }))).work;
assert.equal(w.cost, 60); assert.equal(calls.at(-1)[1], 'jimeng_i2v_first_v30');
tick(4000); await ok(call('class-state', { classroom_id: classroom.id }, { user: T })); tick(4000);
const cs2 = await ok(call('class-state', { classroom_id: classroom.id }, { user: T }));
const vid = cs2.works.find((x) => x.id === w.id); assert.equal(vid.type, 'video'); assert.match(vid.file, /outputs\/.*\.mp4/); pass('老师演示视频：完成并存到存储');
assert.ok(cs2.students.length === 3 && cs2.students.some((s) => s.count > 0)); pass('老师看到学生名单和提交数');
assert.ok(cs2.spent > 0); pass('老师看到本节课花了多少积分');
// 隐藏
await ok(call('work-action', { work_id: vid.id, act: 'hide' }, { user: T }));
assert.equal((await ok(call('class-state', { classroom_id: classroom.id }, { user: T }))).works.find((x) => x.id === vid.id).hidden, true); pass('隐藏作品');
// 预算
await ok(call('class-update', { classroom_id: classroom.id, spend_limit: cs2.spent }, { user: T }));
await err(call('create', { classroom_id: classroom.id, kind: 't2i', prompt: '超预算' }, { user: T }), 402); pass('课堂预算用完会拦住');
// 平台余额不足 HTTP 402 → 退
await ok(call('class-update', { classroom_id: classroom.id, spend_limit: null }, { user: T }));
w = (await ok(call('create', { classroom_id: classroom.id, kind: 't2i', prompt: '没钱了' }, { user: T }))).work;
assert.equal(w.status, 'failed'); assert.ok(w.refunded); pass('模型平台余额不足：退积分并提示');
// 换口令后旧学生仍在、新口令可进
const nc = await ok(call('class-update', { classroom_id: classroom.id, new_code: true }, { user: T }));
assert.notEqual(nc.join_code, classroom.join_code); await err(call('join', { code: classroom.join_code, name: 'x' }), 404); pass('换口令后旧口令失效');
// 结束课堂
await ok(call('class-update', { classroom_id: classroom.id, archive: true }, { user: T }));
await err(call('student-state', {}, S), 401); pass('课堂结束后学生令牌失效');

// ---- 自学用户 ----
me = await ok(call('me', {}, { user: U })); assert.equal(me.balance, 100);
let r = await ok(call('create', { kind: 't2i', prompt: '一辆西瓜校车' }, { user: U }));
assert.equal(r.balance, 90); pass('自学：扣自己的积分');
tick(4000); await ok(call('my-works', {}, { user: U })); tick(4000);
const mw = await ok(call('my-works', {}, { user: U })); assert.equal(mw.works[0].status, 'done'); pass('自学：作品完成');
q(`update ai_credit_accounts set balance = 5 where user_id = ${lit(U)}`);
await err(call('create', { kind: 't2i', prompt: '没积分' }, { user: U }), 402); pass('自学：积分不够被拦住');
assert.equal(Number(q(`select count(*) from ai_works where prompt = '没积分'`)), 0); pass('积分不够时不留下作品记录');
// 账本与余额一致
for (const u of [T]) assert.equal(Number(q(`select sum(delta) from ai_credit_ledger where user_id = ${lit(u)}`)), balance(u));
pass('老师账户：流水合计 = 余额');
console.log('ALL CORE TESTS PASSED');
