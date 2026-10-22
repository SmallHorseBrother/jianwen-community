import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Coins } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AILayout from './AILayout';
import { classroomApi, TOOL_NAMES, type Kind, type Price, type Tool, type Work } from '../../features/aiClassroom/api';
import { TOOL_ICONS, ToolPanel, WorkCard, useInterval, useStableWorks } from '../../features/aiClassroom/components';

// 自学用的 AI 实验室：和课堂同一套工具，扣自己的积分。
const TOOLS: Tool[] = ['chat', 'image', 'video'];

const AILab: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [tool, setTool] = useState<Tool>('chat');
  const [data, setData] = useState<{ works: Work[]; balance: number; prices: Price[] } | null>(null);
  const [error, setError] = useState('');
  const loggedIn = !!user && isAuthenticated;

  const refresh = useCallback(async () => {
    try { setData(await classroomApi.myWorks()); setError(''); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { if (loggedIn) void refresh(); }, [loggedIn, refresh]);
  const pending = data?.works.some((w) => w.status === 'queued' || w.status === 'running');
  useInterval(() => { void refresh(); }, loggedIn && pending ? 4000 : null);
  const works = useStableWorks(data?.works);
  const priceOf = (k: Kind) => data?.prices.find((p) => p.kind === k)?.credits;

  return (
    <AILayout>
      <div className="cw-page">
        <header className="page-heading">
          <div><h1>AI 实验室</h1><p>问 AI、画图、做视频。课上做过的实验，回家可以自己再做一遍。</p></div>
          {data && <span className="cw-balance"><Coins aria-hidden="true" />{data.balance} 积分</span>}
        </header>
        {isLoading ? <p role="status">正在读取登录状态…</p> : !loggedIn ? (
          <div className="cw-empty-card"><h2>登录后就能用</h2><p>新用户送体验积分。每次生成按次扣积分，生成失败会自动退回。</p><Link to="/login" className="jw-action">登录 <ArrowRight /></Link></div>
        ) : <>
          {error && <p className="cw-msg bad">{error}</p>}
          <nav className="cw-tabs">{TOOLS.map((t) => <button key={t} type="button" className={tool === t ? 'on' : ''} onClick={() => setTool(t)}>{TOOL_ICONS[t]}{TOOL_NAMES[t]}</button>)}</nav>
          <ToolPanel key={tool} tool={tool} priceOf={priceOf} onSubmit={async (p) => { await classroomApi.create(p); await refresh(); }} />
          {works.length > 0 && <section className="cw-mine"><h2>我的作品</h2><div className="cw-works">{works.map((w) => <WorkCard key={w.id} work={w} />)}</div></section>}
          {data && <p className="cw-muted cw-note">积分价格：{data.prices.map((p) => `${p.label} ${p.credits}`).join('　·　')}</p>}
        </>}
      </div>
    </AILayout>
  );
};

export default AILab;
