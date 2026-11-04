import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, classroomApi, mmss, studentToken, TOOL_NAMES, type StudentState, type Tool } from '../../features/aiClassroom/api';
import { TOOL_ICONS, ToolPanel, WorkCard, useInterval, useStableShared, useStableWorks } from '../../features/aiClassroom/components';

// 学生入口：课堂口令 + 名字，不需要注册。能用什么、用多久、交几次，都由老师控制。
const ClassJoin: React.FC = () => {
  const [params] = useSearchParams();
  const [hasToken, setHasToken] = useState(!!studentToken.get());
  const [state, setState] = useState<StudentState | null>(null);
  const [active, setActive] = useState<Tool | null>(null);
  const [offline, setOffline] = useState(false);
  const [code, setCode] = useState(params.get('code') || '');
  const [name, setName] = useState(() => { try { return localStorage.getItem('jw_class_name') || ''; } catch { return ''; } });
  const [joinMsg, setJoinMsg] = useState('');
  const [joining, setJoining] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [fetchedAt, setFetchedAt] = useState(Date.now());

  const refresh = async () => {
    if (!studentToken.get()) return;
    try { const s = await classroomApi.studentState(); setState(s); setFetchedAt(Date.now()); setOffline(false); }
    catch (e) {
      if (e instanceof ApiError && e.status === 401) { studentToken.clear(); setHasToken(false); setState(null); setJoinMsg(e.message); }
      else setOffline(true);
    }
  };
  useEffect(() => { void refresh(); }, [hasToken]);
  useInterval(() => { void refresh(); }, hasToken ? 4000 : null);
  useInterval(() => setClock(Date.now()), 1000);

  const join = async (e: React.FormEvent) => {
    e.preventDefault(); setJoining(true); setJoinMsg('');
    try {
      const r = await classroomApi.join(code.trim(), name.trim());
      studentToken.set(r.token); try { localStorage.setItem('jw_class_name', r.name); } catch { /* 忽略 */ }
      setHasToken(true);
    } catch (err) { setJoinMsg((err as Error).message); }
    finally { setJoining(false); }
  };

  const works = useStableWorks(state?.works);
  const shared = useStableShared(state?.shared);
  const open = state ? (Object.keys(state.tools) as Tool[]).filter((t) => state.tools[t].open) : [];
  const current = active && open.includes(active) ? active : open[0] || null;
  const ts = current && state ? state.tools[current] : null;
  const left = ts?.remainingMs != null ? ts.remainingMs - (clock - fetchedAt) : null;

  return (
    <div className="cw-student">
      <header className="cw-bar">
        <div className="cw-brand"><span className="cw-logo" />{state?.classroom.title || 'AI 课堂'}</div>
        {state && <div className="cw-me"><span>{state.name}</span><button type="button" onClick={() => { studentToken.clear(); setHasToken(false); setState(null); }}>退出</button></div>}
      </header>
      <main className="cw-student-main">
        {!hasToken && (
          <section className="cw-join">
            <h1>进入课堂</h1>
            <p>写上名字，再输入大屏幕上的 6 位课堂口令。</p>
            <form onSubmit={join}>
              <label>名字或座号<input value={name} onChange={(e) => setName(e.target.value)} maxLength={12} placeholder="比如：王小明 或 12号" autoComplete="off" /></label>
              <label>课堂口令<input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={6} placeholder="6 位数字" autoComplete="off" /></label>
              <button className="jw-action" type="submit" disabled={joining}>{joining ? '正在进入…' : '进入'}</button>
              {joinMsg && <p className="cw-msg bad" role="status">{joinMsg}</p>}
            </form>
          </section>
        )}
        {hasToken && !state && <p className="cw-loading" role="status">正在进入课堂…</p>}
        {state && open.length === 0 && (
          <section className="cw-closed"><span><Lock aria-hidden="true" /></span><h1>现在先听老师讲</h1><p>老师开放以后，这里会自动出现可以用的功能。</p></section>
        )}
        {state && current && ts && (
          <section>
            <nav className="cw-tabs">
              {open.map((t) => <button key={t} type="button" className={t === current ? 'on' : ''} onClick={() => setActive(t)}>{TOOL_ICONS[t]}{TOOL_NAMES[t]}</button>)}
              {left != null && <span className="cw-timer">开放时间还剩 <b>{mmss(left)}</b></span>}
            </nav>
            <ToolPanel
              key={current}
              tool={current}
              task={ts.task}
              shared={shared}
              info={<>这一轮还能交 <b>{ts.quotaLeft}</b> 次</>}
              disabled={ts.quotaLeft <= 0}
              disabledReason="这一轮的次数用完了。先看看结果哪里好、哪里不对，等老师下一轮开放。"
              onSubmit={async (p) => { await classroomApi.studentCreate(p); await refresh(); }}
            />
          </section>
        )}
        {state && works.length > 0 && (
          <section className="cw-mine"><h2>我的作品</h2><div className="cw-works">{works.map((w) => <WorkCard key={w.id} work={w} />)}</div></section>
        )}
      </main>
      {offline && <p className="cw-offline">网络连不上，正在重试…</p>}
    </div>
  );
};

export default ClassJoin;
