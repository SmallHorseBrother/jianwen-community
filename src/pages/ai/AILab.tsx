import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Coins } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AILayout from './AILayout';
import { classroomApi, TOOL_NAMES, type Kind, type Price, type Tool, type Work } from '../../features/aiClassroom/api';
import { TOOL_ICONS, ToolPanel, WorkCard, useInterval, useStableWorks } from '../../features/aiClassroom/components';
import BuyCredits from '../../features/aiClassroom/BuyCredits';
import CreditLedger from '../../features/aiClassroom/CreditLedger';
import { pendingOrder, PURCHASE_TERMS } from '../../features/aiClassroom/shopModel';

// 自学用的 AI 实验室：和课堂同一套工具，扣自己的积分。
const TOOLS: Tool[] = ['chat', 'image', 'video'];

const AILab: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [tool, setTool] = useState<Tool>('chat');
  const [data, setData] = useState<{ works: Work[]; balance: number; prices: Price[] } | null>(null);
  const [error, setError] = useState('');
  const [buying, setBuying] = useState<{ resume: string | null } | null>(null);
  const [paidCount, setPaidCount] = useState(0);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const loggedIn = !!user && isAuthenticated;

  const refresh = useCallback(async () => {
    try { setData(await classroomApi.myWorks()); setError(''); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { if (loggedIn) void refresh(); }, [loggedIn, refresh]);
  const pending = data?.works.some((w) => w.status === 'queued' || w.status === 'running');
  useInterval(() => { void refresh(); }, loggedIn && pending ? 4000 : null);
  const works = useStableWorks(data?.works);
  const priceOf = (k: Kind) => data?.prices.find((p) => p.kind === k)?.credits;

  // 支付宝付完会跳回 /ai/lab?shop=return&out_trade_no=…：接着查这笔订单，然后把地址栏里的支付参数清掉
  useEffect(() => {
    if (!loggedIn || searchParams.get('shop') !== 'return') return;
    const orderNo = searchParams.get('out_trade_no') || pendingOrder.get();
    if (orderNo?.startsWith('SP')) setBuying({ resume: orderNo });
    navigate('/ai/lab', { replace: true });
  }, [loggedIn, searchParams, navigate]);

  const onPaid = useCallback(() => { setPaidCount((n) => n + 1); void refresh(); }, [refresh]);

  return (
    <AILayout>
      <div className="cw-page">
        <header className="page-heading">
          <div><h1>AI 实验室</h1><p>问 AI、画图、做视频。课上做过的实验，回家可以自己再做一遍。</p></div>
          {data && (
            <div className="cw-head-credits">
              <span className="cw-balance"><Coins aria-hidden="true" />{data.balance} 积分</span>
              <button type="button" className="jw-action secondary" onClick={() => setBuying({ resume: null })}>买积分</button>
            </div>
          )}
        </header>
        {isLoading ? <p role="status">正在读取登录状态…</p> : !loggedIn ? (
          <div className="cw-empty-card"><h2>登录后就能用</h2><p>新用户送体验积分（同一网络每天名额有限）。每次生成按次扣积分，生成失败会自动退回。</p><Link to="/login" className="jw-action">登录 <ArrowRight /></Link></div>
        ) : <>
          {error && <p className="cw-msg bad">{error}</p>}
          {data?.balance === 0 && <p className="cw-msg">现在没有积分了，点上面的“买积分”就能继续用。新用户赠送积分在同一网络每天名额有限，领完后新账号从 0 开始。</p>}
          <nav className="cw-tabs">{TOOLS.map((t) => <button key={t} type="button" className={tool === t ? 'on' : ''} onClick={() => setTool(t)}>{TOOL_ICONS[t]}{TOOL_NAMES[t]}</button>)}</nav>
          <ToolPanel key={tool} tool={tool} priceOf={priceOf} onSubmit={async (p) => { await classroomApi.create(p); await refresh(); }} />
          {works.length > 0 && <section className="cw-mine"><h2>我的作品</h2><div className="cw-works">{works.map((w) => <WorkCard key={w.id} work={w} />)}</div></section>}
          {user && <CreditLedger userId={user.id} refreshKey={`${paidCount}-${data?.balance ?? ''}`} />}
          {data && <p className="cw-muted cw-note">积分价格：{data.prices.map((p) => `${p.label} ${p.credits}`).join('　·　')}。{PURCHASE_TERMS}</p>}
        </>}
      </div>
      {buying && <BuyCredits prices={data?.prices} resumeOrderNo={buying.resume} onClose={() => setBuying(null)} onPaid={onPaid} />}
    </AILayout>
  );
};

export default AILab;
