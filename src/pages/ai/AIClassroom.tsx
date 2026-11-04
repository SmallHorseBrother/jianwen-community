import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Coins, MonitorUp, Plus, Upload, Users, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { useAuth } from '../../contexts/AuthContext';
import AILayout from './AILayout';
import { classroomApi, mmss, readImage, TOOL_NAMES, type Me, type TeacherState, type Tool } from '../../features/aiClassroom/api';
import { Lightbox, TOOL_ICONS, ToolPanel, WorkCard, useInterval, useStableShared, useStableWorks } from '../../features/aiClassroom/components';
import BuyCredits from '../../features/aiClassroom/BuyCredits';

const TOOL_HINT: Record<Tool, string> = { chat: '文字问答，可以加图片', image: '文字画图、照片改图，约半分钟', video: '5 秒视频，要等 1～3 分钟' };
const TOOLS: Tool[] = ['chat', 'image', 'video'];

// ---------- 课堂列表 ----------
const ClassroomList: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [buying, setBuying] = useState(false);
  const loadMe = useCallback(() => { classroomApi.me().then(setMe).catch((e) => setError(e.message)); }, []);
  useEffect(() => { if (user && isAuthenticated) loadMe(); }, [user, isAuthenticated, loadMe]);
  if (!user || !isAuthenticated) return <div className="cw-page"><div className="cw-empty-card"><h1>AI 课堂</h1><p>老师登录健文社区账号后，就能创建课堂、开关学生能用的 AI 功能。学生不需要注册，用 6 位口令进入。</p><Link to="/login" className="jw-action">登录 <ArrowRight /></Link></div></div>;
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try { const r = await classroomApi.createClassroom(title.trim() || '我的课堂'); navigate(`/ai/classroom/${r.classroom.id}`); }
    catch (err) { setError((err as Error).message); }
  };
  return (
    <div className="cw-page">
      <header className="page-heading"><div><h1>AI 课堂</h1><p>老师控制开关，学生在自己的设备上用 AI。</p></div>{me && <div className="cw-head-credits"><span className="cw-balance"><Coins aria-hidden="true" />{me.balance} 积分</span><button type="button" className="jw-action secondary" onClick={() => setBuying(true)}>买积分</button></div>}</header>
      {error && <p className="cw-msg bad">{error}</p>}
      <form className="cw-create" onSubmit={create}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="课堂名称，比如：府学小学 第2课" />
        <button className="jw-action" type="submit"><Plus aria-hidden="true" />新建课堂</button>
      </form>
      <div className="cw-class-list">
        {me?.classrooms.map((c) => (
          <Link key={c.id} to={`/ai/classroom/${c.id}`} className="cw-class-item"><div><b>{c.title}</b><span>口令 {c.join_code} · {new Date(c.created_at).toLocaleDateString('zh-CN')}</span></div><ArrowRight aria-hidden="true" /></Link>
        ))}
        {me && me.classrooms.length === 0 && <p className="cw-muted">还没有课堂。新建一个，上课时把口令投到大屏上。</p>}
      </div>
      {me && <section className="cw-prices"><h2>积分价格</h2><div>{me.prices.map((p) => <span key={p.kind}>{p.label}<b>{p.credits}</b></span>)}</div><p className="cw-muted">课堂里学生的消耗都记在老师账上。生成失败会自动退回积分。</p></section>}
      {buying && <BuyCredits prices={me?.prices} onClose={() => setBuying(false)} onPaid={loadMe} />}
    </div>
  );
};

// ---------- 老师控制台 ----------
const ClassroomConsole: React.FC<{ id: string }> = ({ id }) => {
  const [s, setS] = useState<TeacherState | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<'wall' | 'demo'>('wall');
  const [demoTool, setDemoTool] = useState<Tool>('chat');
  const [filter, setFilter] = useState<'all' | Tool>('all');
  const [showHidden, setShowHidden] = useState(false);
  const [lb, setLb] = useState<number | null>(null);
  const [projector, setProjector] = useState(false);
  const [qr, setQr] = useState('');
  const [tasks, setTasks] = useState<Partial<Record<Tool, string>>>({});
  const [clock, setClock] = useState(Date.now());
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [note, setNote] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [prices, setPrices] = useState<Me['prices']>([]);
  const [buying, setBuying] = useState(false);

  const refresh = useCallback(async () => {
    try { const r = await classroomApi.classState(id); setS(r); setFetchedAt(Date.now()); setError(''); }
    catch (e) { setError((e as Error).message); }
  }, [id]);
  useEffect(() => { void refresh(); classroomApi.me().then((m) => { setIsAdmin(m.is_admin); setPrices(m.prices); }).catch(() => {}); }, [refresh]);
  useInterval(() => { void refresh(); }, 3000);
  useInterval(() => setClock(Date.now()), 1000);

  const joinUrl = `${window.location.origin}/class`;
  const joinCode = s?.classroom.join_code;
  useEffect(() => { if (joinCode) QRCode.toDataURL(`${joinUrl}?code=${joinCode}`, { margin: 1, width: 360 }).then(setQr).catch(() => setQr('')); }, [joinCode, joinUrl]);

  const works = useStableWorks(s?.works);
  const shared = useStableShared(s?.shared);
  const visible = useMemo(() => works.filter((w) => (filter === 'all' || w.tool === filter) && (showHidden || !w.hidden)), [works, filter, showHidden]);
  const update = async (patch: Record<string, unknown>) => { try { await classroomApi.updateClass(id, patch); await refresh(); } catch (e) { setError((e as Error).message); } };
  const twice = (key: string, fn: () => void) => { if (note === key) { setNote(''); fn(); } else { setNote(key); window.setTimeout(() => setNote((n) => (n === key ? '' : n)), 3000); } };

  if (!s) return <div className="cw-page"><p role="status">{error || '正在打开课堂…'}</p></div>;
  const online = s.students.filter((x) => x.online).length;
  const left = (t: Tool) => (s.tools[t].remainingMs != null ? s.tools[t].remainingMs! - (clock - fetchedAt) : null);

  return (
    <div className="cw-console">
      <header className="cw-console-head">
        <div><Link to="/ai/classroom" className="cw-back">← 我的课堂</Link><h1>{s.classroom.title}</h1></div>
        <div className="cw-join-info">学生打开 <b>{joinUrl.replace(/^https?:\/\//, '')}</b> 口令 <b className="cw-code">{s.classroom.join_code}</b></div>
        <button type="button" className="jw-action" onClick={() => setProjector(true)}><MonitorUp aria-hidden="true" />投屏口令</button>
      </header>
      {error && <p className="cw-msg bad">{error}</p>}
      {!s.configured && <p className="cw-msg bad">服务端还没有配置模型密钥（WANJIE_API_KEY），生成会失败。</p>}

      <div className="cw-layout">
        <aside className="cw-controls">
          <h2>开放给学生</h2>
          {TOOLS.map((t) => {
            const ts = s.tools[t]; const l = left(t);
            return (
              <div key={t} className={`cw-tool-card ${ts.open ? 'is-open' : ''}`}>
                <div className="cw-tc-head"><span className="cw-tc-icon">{TOOL_ICONS[t]}</span><div><b>{TOOL_NAMES[t]}</b><small>{TOOL_HINT[t]}</small></div>
                  <span className="cw-tc-state">{ts.open ? (l != null ? <>开放中<b>{mmss(l)}</b></> : '开放中 · 不限时') : '已关闭'}</span></div>
                <input className="cw-tc-task" maxLength={120} placeholder="给学生的任务（可选），比如：拍讲台上的水杯，改成太空版"
                  value={tasks[t] ?? ts.task} onChange={(e) => setTasks({ ...tasks, [t]: e.target.value })}
                  onBlur={() => { if (tasks[t] !== undefined && tasks[t] !== ts.task) void update({ tool: t, task: tasks[t] }); }} />
                <div className="cw-tc-row"><span>每人每轮</span>
                  <select value={ts.quota} onChange={(e) => void update({ tool: t, quota: Number(e.target.value) })}>{[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n} 次</option>)}</select></div>
                <div className="cw-tc-row">
                  {ts.open ? <>
                    {l != null && <button type="button" className="cw-mini" onClick={() => void update({ tool: t, addMinutes: 2 })}>+2 分钟</button>}
                    <button type="button" className="cw-danger" onClick={() => void update({ tool: t, open: false })}>关闭</button>
                  </> : <>
                    {[3, 5, 10].map((m) => <button key={m} type="button" className="cw-open" onClick={() => void update({ tool: t, open: true, minutes: m, task: tasks[t] ?? ts.task })}>开放 {m} 分钟</button>)}
                    <button type="button" className="cw-mini" onClick={() => void update({ tool: t, open: true, minutes: 0, task: tasks[t] ?? ts.task })}>不限时</button>
                  </>}
                </div>
              </div>
            );
          })}
          <button type="button" className="cw-danger big" onClick={() => void update({ close_all: true })}>全部关闭</button>

          <div className="cw-side"><h3>共享图片 <small>学生改图时可以直接选</small></h3>
            <div className="cw-shared">{shared.map((x) => <figure key={x.id}><img src={x.url} alt="" /><button type="button" onClick={() => void classroomApi.sharedRemove(id, x.id).then(refresh)} aria-label="不再共享"><X /></button></figure>)}</div>
            <label className="cw-mini cw-upload"><Upload aria-hidden="true" />上传图片<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { const img = await readImage(f); await classroomApi.sharedAdd(id, img.dataUrl); await refresh(); } catch (err) { setError((err as Error).message); } }} /></label>
          </div>
          <div className="cw-side"><h3><Users aria-hidden="true" />学生 <small>{online} 人在线 / 共 {s.students.length} 人</small></h3>
            <div className="cw-students">{s.students.map((x) => <span key={x.id} className={x.online ? 'on' : ''}>{x.name}<i>{x.count}</i></span>)}{s.students.length === 0 && <small className="cw-muted">还没有学生进入。</small>}</div>
          </div>
          <div className="cw-side"><h3><Coins aria-hidden="true" />积分</h3>
            <p>账户余额 <b>{s.balance}</b>{'　'}本节课已用 <b>{s.spent}</b></p>
            <div className="cw-tc-row"><button type="button" className="cw-mini" onClick={() => setBuying(true)}><Coins aria-hidden="true" />买积分</button></div>
            <div className="cw-tc-row"><span>本节课上限</span>
              <select value={s.classroom.spend_limit ?? ''} onChange={(e) => void update({ spend_limit: e.target.value === '' ? null : Number(e.target.value) })}>
                <option value="">不限</option>{[200, 500, 1000, 2000, 5000].map((n) => <option key={n} value={n}>{n} 积分</option>)}</select></div>
            {isAdmin && <div className="cw-tc-row"><button type="button" className="cw-mini" onClick={() => void classroomApi.selftest().then((r) => setError(r.message))}>检查模型连接</button><button type="button" className="cw-mini" onClick={() => void classroomApi.grant(1000).then(refresh)}>给自己加 1000 积分</button></div>}
          </div>
          <div className="cw-side cw-tc-row">
            <button type="button" className="cw-mini" onClick={() => twice('code', () => void update({ new_code: true }))}>{note === 'code' ? '再点一次确认' : '换口令'}</button>
            <button type="button" className="cw-mini" onClick={() => twice('clear', () => void update({ clear_students: true }))}>{note === 'clear' ? '再点一次确认' : '清空学生名单'}</button>
            <button type="button" className="cw-mini" onClick={() => twice('end', () => void update({ archive: true }).then(() => window.location.assign('/ai/classroom')))}>{note === 'end' ? '再点一次确认' : '结束这节课'}</button>
          </div>
        </aside>

        <section className="cw-main">
          <nav className="cw-tabs">
            <button type="button" className={view === 'wall' ? 'on' : ''} onClick={() => setView('wall')}>作品墙</button>
            <button type="button" className={view === 'demo' ? 'on' : ''} onClick={() => setView('demo')}>老师演示</button>
          </nav>
          {view === 'wall' ? <>
            <div className="cw-filters">
              {(['all', ...TOOLS] as const).map((f) => <button key={f} type="button" className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f === 'all' ? '全部' : TOOL_NAMES[f]}</button>)}
              <label><input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />显示已隐藏</label>
            </div>
            <div className="cw-works">{visible.map((w, i) => <WorkCard key={w.id} work={w} teacher onZoom={() => setLb(i)} onAction={(act) => void classroomApi.workAction(w.id, act).then(refresh)} />)}</div>
            {visible.length === 0 && <p className="cw-muted cw-empty">还没有作品。开放一个功能，学生交上来的结果会出现在这里。</p>}
          </> : <>
            <p className="cw-muted">老师演示不受开关和次数限制，结果也会出现在作品墙上。</p>
            <nav className="cw-tabs small">{TOOLS.map((t) => <button key={t} type="button" className={demoTool === t ? 'on' : ''} onClick={() => setDemoTool(t)}>{TOOL_ICONS[t]}{TOOL_NAMES[t]}</button>)}</nav>
            <ToolPanel key={demoTool} tool={demoTool} shared={shared} info="老师演示 · 不限次数" onSubmit={async (p) => { await classroomApi.create({ ...p, classroom_id: id }); await refresh(); }} />
          </>}
        </section>
      </div>

      {lb != null && <Lightbox works={visible} index={lb} onIndex={setLb} onClose={() => setLb(null)} />}
      {buying && <BuyCredits prices={prices} onClose={() => setBuying(false)} onPaid={() => void refresh()} />}
      {projector && (
        <div className="cw-projector" role="dialog" aria-modal="true" onClick={() => setProjector(false)}>
          <div><p>打开网址</p><h1>{joinUrl.replace(/^https?:\/\//, '')}</h1><p>课堂口令</p><h1 className="cw-code">{s.classroom.join_code}</h1>{qr && <img src={qr} alt="扫码进入课堂" />}<small>点任意处关闭</small></div>
        </div>
      )}
    </div>
  );
};

const AIClassroom: React.FC = () => {
  const { id } = useParams();
  const { user, isAuthenticated, isLoading } = useAuth();
  return <AILayout>{isLoading ? <p className="cw-page" role="status">正在读取登录状态…</p> : id && user && isAuthenticated ? <ClassroomConsole id={id} /> : <ClassroomList />}</AILayout>;
};

export default AIClassroom;
