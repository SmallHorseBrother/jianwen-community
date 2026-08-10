import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Clipboard,
  Compass,
  CreditCard,
  Gauge,
  LockKeyhole,
  QrCode,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Workflow,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  capabilityLevels,
  learningGoals,
  personalityAxes,
  personalityProfiles,
  type CapabilityTrack,
  type LearningGoal,
  type PersonalityAxis,
} from '../features/aiAssessment/catalog';

type Stage = 'home' | 'capability-track' | 'capability-questions' | 'capability-goal' | 'personality-questions' | 'result';
type Provider = 'wechat' | 'alipay';
type Report = {
  headline: string;
  overview: string;
  strengths: string[];
  risks: string[];
  nextSteps: string[];
  courseRecommendations?: string[];
  combinedPortrait?: string;
};
type Attempt = {
  id: string;
  kind: 'capability' | 'personality';
  track: CapabilityTrack | null;
  learning_goal: LearningGoal | null;
  total_score: number | null;
  ability_level: number | null;
  personality_code: string | null;
  dimension_scores: Record<string, number>;
  report: Report;
  report_status: 'pending' | 'ready' | 'fallback' | 'failed';
  share_token: string | null;
  created_at: string;
  assessment_version?: string;
  framework_version?: string;
  scoring_version?: string;
  result_status?: 'legacy' | 'provisional' | 'final' | 'invalidated';
  evidence_grade?: 'self_report' | 'screening' | 'diagnostic' | 'certified' | 'profile';
  requires_reassessment?: boolean;
  competency_scores?: Record<string, number>;
  gate_status?: Record<string, unknown>;
};
type AssessmentStatus = { capability: Attempt | null; personality: Attempt | null; legacy_capability_available?: boolean };
type PACFDimension = 'M' | 'F' | 'T' | 'V' | 'C' | 'S';
type PACFPublicOption = { id: string; text: string };
type PACFPublicItem = {
  id: string;
  competency_id: string;
  dimension: PACFDimension;
  type: 'objective' | 'scenario';
  stem: string;
  options: PACFPublicOption[];
};
type PACFQuickForm = {
  instrument: {
    id: string;
    framework_version: string;
    title: string;
    evidence_grade: 'screening';
    item_count: number;
    dimensions: Record<PACFDimension, { label: string; description: string }>;
  };
  items: PACFPublicItem[];
};
type AIStyleAxis = 'explore' | 'create' | 'reason' | 'partner';
type AIStyleLikertItem = { id: string; kind: 'likert'; axis: AIStyleAxis; statement: string };
type AIStyleForcedItem = { id: string; kind: 'forced_choice'; axis: AIStyleAxis; prompt: string; options: Array<{ id: 'first' | 'second'; text: string }> };
type AIStyleItem = AIStyleLikertItem | AIStyleForcedItem;
type AIStyleForm = {
  instrument: {
    id: string;
    framework_version: 'ai-usage-style-v1';
    title: string;
    item_count: number;
    scored_item_count: number;
    scale: { min: number; max: number; labels: string[] };
    axes: Record<AIStyleAxis, {
      first: { code: string; label: string; english: string; description: string };
      second: { code: string; label: string; english: string; description: string };
    }>;
  };
  items: AIStyleItem[];
};
type PaymentStatus = {
  membership: { level: 'starter' | 'application' | 'practice'; access_status: 'pending_payment' | 'active' | 'revoked'; display_id: string | null } | null;
  route: { level: 'starter' | 'application' | 'practice'; group_name: string; description: string } | null;
  latest_order: { order_no: string; provider: Provider; status: string; expires_at: string; wechat_code_url: string | null } | null;
  group_qr_url: string | null;
  qr_ready: boolean;
  unlock_price_cents: number | null;
  unlock_price_label: string;
  payment_available: boolean;
  providers: { wechat: boolean; alipay: boolean };
};

const paymentPlaceholders: Record<'starter' | 'application' | 'practice', string> = {
  starter: '/images/ai-groups/starter-placeholder.webp',
  application: '/images/ai-groups/application-placeholder.webp',
  practice: '/images/ai-groups/practice-placeholder.webp',
};

const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
};

async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message || '服务暂时不可用';
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: unknown };
        if (typeof payload.error === 'string' && payload.error.trim()) message = payload.error;
      } catch {
        // Keep the SDK error when the response is not JSON.
      }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

async function ensureVisitorSession() {
  const { data: current } = await supabase.auth.getSession();
  if (current.session) return current.session;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.session) throw new Error(error?.message || '暂时无法创建游客身份');
  return data.session;
}

const money = (amountCents: number | null) => amountCents === null ? '—' : `¥${(amountCents / 100).toFixed(2)}`;

const legacyDimensionLabels: Record<string, string> = {
  cognition: 'AI认知', usage: 'AI使用', communication: 'AI沟通',
  verification: 'AI验证', creation: 'AI创造', systems: 'AI系统',
};
const pacfDimensionLabels: Record<PACFDimension, string> = {
  M: 'AI心智模型', F: '任务定义与沟通', T: '工具与信息素养',
  V: '核验、安全与责任', C: '创造与执行', S: '工作流与系统思维',
};
const pacfLevels = [
  { title: 'AI观察者', summary: '正在建立对 AI 的基本认识和安全边界。' },
  { title: 'AI辅助使用者', summary: '可以在指导下完成低风险的简单任务。' },
  { title: 'AI独立操作者', summary: '能够独立完成常见真实任务并检查结果。' },
  { title: 'AI协作者', summary: '能够拆解复杂任务，与 AI 多轮协作并保留判断。' },
  { title: 'AI系统构建者', summary: '具备工作流、Agent、评测和可靠性意识。' },
  { title: 'AI变革推动者', summary: '具备推动团队 AI 化的系统视角；仍需应用实验室认证。' },
] as const;
const aiStyleProfiles: Record<string, { name: string; tagline: string }> = {
  ECRP: { name: 'AI好奇发明家', tagline: '探索新可能，理解它，并与 AI 一起把想法做出来。' },
  ECRD: { name: 'AI实验导演', tagline: '理解新能力后设定方向，再让 AI 扩大执行范围。' },
  ECAP: { name: 'AI创意冲刺者', tagline: '通过快速尝试，把新想法迅速变成可见成果。' },
  ECAD: { name: 'AI原型启动者', tagline: '敢于探索，并让 AI 快速推动新原型落地。' },
  EORP: { name: 'AI流程侦察员', tagline: '不断寻找更好的效率方法，同时保持人在回路。' },
  EORD: { name: 'AI自动化开拓者', tagline: '探索自动化可能，理解后再设计委托方式。' },
  EOAP: { name: 'AI效率实验家', tagline: '用快速实验发现马上能够节省时间的新方法。' },
  EOAD: { name: 'AI运营探索者', tagline: '快速尝试工具，并把合适的重复工作交给系统。' },
  SCRP: { name: 'AI深度匠人', tagline: '深入掌握方法，在持续共创中打磨高质量成果。' },
  SCRD: { name: 'AI产品架构师', tagline: '先理解和设计，再让 AI 稳定推进创造过程。' },
  SCAP: { name: 'AI实用创作者', tagline: '用熟悉的方法快速做出真实、可用的新成果。' },
  SCAD: { name: 'AI生产构建者', tagline: '把创造方法沉淀成可重复运行的生产系统。' },
  SORP: { name: 'AI流程分析师', tagline: '细致理解现有工作，并与 AI 共同持续改善。' },
  SORD: { name: 'AI系统规划师', tagline: '设计清晰、稳定、可解释的 AI 优化流程。' },
  SOAP: { name: 'AI稳健优化师', tagline: '用务实协作稳步改善每天正在发生的工作。' },
  SOAD: { name: 'AI运营编排者', tagline: '把成熟方法变成边界清楚、可持续运行的委托系统。' },
};
const styleConfidenceLabels: Record<string, string> = {
  balanced: '两侧平衡', slight: '略有倾向', moderate: '较明显倾向', clear: '清晰倾向',
};
const aiStyleAxisDefinitions: Record<AIStyleAxis, { first: string; second: string }> = {
  explore: { first: '探索 Explore', second: '系统化 Systematize' },
  create: { first: '创造 Create', second: '优化 Optimize' },
  reason: { first: '理解 Reason', second: '行动 Act' },
  partner: { first: '共创 Partner', second: '委托 Delegate' },
};

const RadarChart: React.FC<{ scores: Record<string, number>; labels?: Record<string, string> }> = ({ scores, labels }) => {
  const dimensions = (['M', 'F', 'T', 'V', 'C', 'S'].every((key) => key in scores)
    ? ['M', 'F', 'T', 'V', 'C', 'S']
    : ['cognition', 'usage', 'communication', 'verification', 'creation', 'systems']);
  const resolvedLabels = labels || (dimensions[0] === 'M' ? pacfDimensionLabels : legacyDimensionLabels);
  const point = (index: number, radius: number) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / dimensions.length;
    return `${50 + Math.cos(angle) * radius},${50 + Math.sin(angle) * radius}`;
  };
  const valuePoints = dimensions.map((dimension, index) => point(index, (Math.max(0, Math.min(100, scores[dimension] || 0)) / 100) * 34)).join(' ');
  const outerPoints = dimensions.map((_, index) => point(index, 34)).join(' ');
  return (
    <div className="grid items-center gap-5 sm:grid-cols-[220px_1fr]">
      <svg viewBox="0 0 100 100" role="img" aria-label="AI能力六维雷达图" className="mx-auto w-full max-w-[220px]">
        {[11, 23, 34].map((radius) => <polygon key={radius} points={dimensions.map((_, index) => point(index, radius)).join(' ')} fill="none" stroke="rgba(148,163,184,.28)" strokeWidth="0.7" />)}
        {dimensions.map((_, index) => <line key={index} x1="50" y1="50" x2={point(index, 34).split(',')[0]} y2={point(index, 34).split(',')[1]} stroke="rgba(148,163,184,.22)" strokeWidth="0.7" />)}
        <polygon points={outerPoints} fill="none" stroke="rgba(34,211,238,.45)" strokeWidth="0.8" />
        <polygon points={valuePoints} fill="rgba(34,211,238,.25)" stroke="#22d3ee" strokeWidth="1.5" />
      </svg>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
        {dimensions.map((dimension) => (
          <div key={dimension}>
            <div className="flex justify-between gap-2 text-xs"><span className="text-slate-300">{resolvedLabels[dimension]}</span><strong className="text-cyan-200">{scores[dimension] || 0}</strong></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${scores[dimension] || 0}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ReportPanel: React.FC<{ report: Report; aiGenerated: boolean }> = ({ report, aiGenerated }) => (
  <section className="rounded-3xl border border-white/15 bg-slate-900/70 p-5 sm:p-7">
    <div className="flex flex-wrap items-center gap-2">
      <Sparkles className="h-5 w-5 text-cyan-300" />
      <h3 className="text-xl font-black text-white">{report.headline}</h3>
      <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-slate-300">{aiGenerated ? 'AI个性化分析' : '规则分析'}</span>
    </div>
    <p className="mt-3 leading-7 text-slate-200">{report.overview}</p>
    {report.combinedPortrait && <p className="mt-4 rounded-2xl border border-violet-300/20 bg-violet-950/40 p-4 text-sm leading-6 text-violet-100">完整画像：{report.combinedPortrait}</p>}
    <div className="mt-6 grid gap-5 sm:grid-cols-2">
      <div><h4 className="font-bold text-emerald-300">你的优势</h4><ul className="mt-2 space-y-2 text-sm leading-6 text-slate-200">{report.strengths.map((item) => <li key={item}>• {item}</li>)}</ul></div>
      <div><h4 className="font-bold text-amber-300">需要留意</h4><ul className="mt-2 space-y-2 text-sm leading-6 text-slate-200">{report.risks.map((item) => <li key={item}>• {item}</li>)}</ul></div>
    </div>
    <div className="mt-5"><h4 className="font-bold text-cyan-300">下一步行动</h4><ol className="mt-2 space-y-2 text-sm leading-6 text-slate-200">{report.nextSteps.map((item, index) => <li key={item}>{index + 1}. {item}</li>)}</ol></div>
  </section>
);

const StyleResultPanel: React.FC<{ attempt: Attempt }> = ({ attempt }) => {
  if (attempt.framework_version !== 'ai-usage-style-v1') {
    const profile = personalityProfiles[attempt.personality_code || 'DOAH'];
    return <section className="rounded-3xl bg-gradient-to-br from-violet-950/80 via-slate-900 to-blue-950/80 p-5 ring-1 ring-violet-300/25 sm:p-7"><div className="mb-5 rounded-2xl border border-amber-300/30 bg-amber-950/40 px-4 py-3 text-sm leading-6 text-amber-100">这是旧版 AI 人格画像，轴和分数不能换算为新版使用风格；结果仍保留供你回看。</div><p className="text-sm font-semibold text-violet-300">旧版AI人格画像</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-3xl font-black text-white">{profile.name}</h2><p className="mt-2 text-slate-100">{profile.tagline}</p></div><span className="rounded-full border border-violet-300/30 bg-violet-400/15 px-4 py-2 text-xl font-black tracking-widest text-violet-100">{attempt.personality_code}</span></div><div className="mt-7 grid gap-3 sm:grid-cols-2">{(Object.keys(personalityAxes) as PersonalityAxis[]).map((axis) => { const value = attempt.dimension_scores[axis] || 0; const def = personalityAxes[axis]; const left = value <= 0; return <div key={axis} className="rounded-2xl bg-white/5 p-4"><div className="flex justify-between text-sm"><span className={left ? 'font-bold text-violet-200' : 'text-slate-400'}>{def.left}</span><span className={!left ? 'font-bold text-blue-200' : 'text-slate-400'}>{def.right}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-gradient-to-r from-violet-400 via-slate-700 to-blue-400"><div className="h-full w-1 bg-white" style={{ marginLeft: `${Math.max(2, Math.min(98, 50 + (value / 14) * 48))}%` }} /></div></div>; })}</div></section>;
  }

  const profile = aiStyleProfiles[attempt.personality_code || 'ECRP'];
  const confidence = (attempt.gate_status?.axis_confidence || {}) as Record<AIStyleAxis, string>;
  return (
    <section className="rounded-3xl bg-gradient-to-br from-violet-950/80 via-slate-900 to-blue-950/80 p-5 ring-1 ring-violet-300/25 sm:p-7">
      <div className="rounded-2xl border border-violet-300/25 bg-violet-950/45 px-4 py-3 text-sm leading-6 text-violet-100">AI 使用风格 Beta 描述你当前偏好的协作方式，不表示能力高低，也不是心理诊断。</div>
      <p className="mt-5 text-sm font-semibold text-violet-300">你的AI使用风格</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-3xl font-black text-white">{profile.name}</h2><p className="mt-2 text-slate-100">{profile.tagline}</p></div><span className="rounded-full border border-violet-300/30 bg-violet-400/15 px-4 py-2 text-xl font-black tracking-widest text-violet-100">{attempt.personality_code}</span></div>
      <div className="mt-7 space-y-4">{(Object.keys(aiStyleAxisDefinitions) as AIStyleAxis[]).map((axis) => { const score = Math.max(0, Math.min(100, attempt.dimension_scores[axis] || 0)); const definition = aiStyleAxisDefinitions[axis]; return <div key={axis} className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-start justify-between gap-4 text-sm"><span className={score >= 50 ? 'font-bold text-violet-100' : 'text-slate-300'}>{definition.first} · {Math.round(score)}</span><span className={score < 50 ? 'text-right font-bold text-blue-100' : 'text-right text-slate-300'}>{Math.round(100 - score)} · {definition.second}</span></div><div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-blue-500/55"><div className="h-full bg-violet-400" style={{ width: `${score}%` }} /><div className="absolute inset-y-0 left-1/2 w-px bg-white/70" /></div><p className="mt-2 text-xs text-slate-300">{styleConfidenceLabels[confidence[axis]] || '偏好程度待解释'}</p></div>; })}</div>
    </section>
  );
};

const AIAssessment: React.FC = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('home');
  const [track, setTrack] = useState<CapabilityTrack>('daily');
  const [goal, setGoal] = useState<LearningGoal | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [capabilityForm, setCapabilityForm] = useState<PACFQuickForm | null>(null);
  const [capabilityAnswers, setCapabilityAnswers] = useState<(string | null)[]>([]);
  const [styleForm, setStyleForm] = useState<AIStyleForm | null>(null);
  const [styleAnswers, setStyleAnswers] = useState<Array<number | string | null>>([]);
  const [history, setHistory] = useState<AssessmentStatus>({ capability: null, personality: null });
  const [currentAttempt, setCurrentAttempt] = useState<Attempt | null>(null);
  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [paymentQr, setPaymentQr] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSharedResult, setIsSharedResult] = useState(false);

  const loadPayment = useCallback(async () => {
    const data = await invokeFunction<PaymentStatus>('ai-group-payment', { action: 'status' });
    setPayment(data);
    return data;
  }, []);

  const loadHistory = useCallback(async () => {
    const data = await invokeFunction<AssessmentStatus>('ai-assessment-engine', { action: 'status' });
    setHistory(data);
    return data;
  }, []);

  useEffect(() => {
    const shareToken = new URLSearchParams(window.location.search).get('share');
    if (shareToken) {
      setIsBusy(true);
      invokeFunction<{ attempt: Attempt }>('ai-assessment-engine', { action: 'shared-result', share_token: shareToken })
        .then(({ attempt }) => { setCurrentAttempt(attempt); setIsSharedResult(true); setStage('result'); })
        .catch((loadError) => setError(errorMessage(loadError, '无法打开分享结果')))
        .finally(() => setIsBusy(false));
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      loadHistory().catch(() => undefined);
    });
  }, [loadHistory]);

  useEffect(() => {
    const codeUrl = payment?.latest_order?.wechat_code_url;
    if (!codeUrl) { setPaymentQr(null); return; }
    QRCode.toDataURL(codeUrl, { width: 360, margin: 1, errorCorrectionLevel: 'M' })
      .then(setPaymentQr)
      .catch(() => setError('生成微信支付二维码失败，请刷新后重试'));
  }, [payment?.latest_order?.wechat_code_url]);

  const startCapability = async (selectedTrack: CapabilityTrack) => {
    setIsBusy(true); setError(''); setNotice('');
    try {
      await ensureVisitorSession();
      const form = await invokeFunction<PACFQuickForm>('ai-assessment-engine', { action: 'pacf-quick-form' });
      if (!form.items?.length || form.items.length !== form.instrument.item_count) throw new Error('能力测评题目加载不完整');
      setTrack(selectedTrack);
      setQuestionIndex(0);
      setCapabilityForm(form);
      setCapabilityAnswers(Array(form.items.length).fill(null));
      setGoal(null);
      setStage('capability-questions');
    } catch (loadError) {
      setError(errorMessage(loadError, '能力测评加载失败，请稍后重试'));
    } finally { setIsBusy(false); }
  };

  const startPersonality = async () => {
    setIsBusy(true); setError(''); setNotice('');
    try {
      await ensureVisitorSession();
      const form = await invokeFunction<AIStyleForm>('ai-assessment-engine', { action: 'ai-style-form' });
      if (!form.items?.length || form.items.length !== form.instrument.item_count) throw new Error('AI 使用风格题目加载不完整');
      setQuestionIndex(0);
      setStyleForm(form);
      setStyleAnswers(Array(form.items.length).fill(null));
      setStage('personality-questions');
    } catch (loadError) {
      setError(errorMessage(loadError, 'AI 使用风格测评加载失败，请稍后重试'));
    } finally { setIsBusy(false); }
  };

  const nextCapability = () => {
    if (capabilityAnswers[questionIndex] === null) return;
    if (questionIndex === (capabilityForm?.items.length || 0) - 1) setStage('capability-goal');
    else setQuestionIndex((index) => index + 1);
  };

  const nextPersonality = async () => {
    if (styleAnswers[questionIndex] === null) return;
    if (questionIndex < (styleForm?.items.length || 0) - 1) { setQuestionIndex((index) => index + 1); return; }
    await submitPersonality();
  };

  const submitCapability = async () => {
    if (!goal || !capabilityForm || capabilityAnswers.some((answer) => answer === null)) return;
    setIsBusy(true);
    setError('');
    const responses = capabilityForm.items.map((item, index) => ({ item_id: item.id, option_id: capabilityAnswers[index] as string }));
    try {
      await ensureVisitorSession();
      const { attempt } = await invokeFunction<{ attempt: Attempt }>('ai-assessment-engine', {
        action: 'submit-pacf-quick', responses, track, learning_goal: goal,
      });
      setCurrentAttempt(attempt);
      setHistory((value) => ({ ...value, capability: attempt }));
      await loadPayment();
    } catch (submitError) {
      setError(errorMessage(submitError, '提交失败，请稍后重试'));
      return;
    } finally {
      setIsBusy(false);
    }
    setStage('result');
  };

  const submitPersonality = async () => {
    if (!styleForm || styleAnswers.some((answer) => answer === null)) return;
    setIsBusy(true);
    setError('');
    const responses = styleForm.items.map((item, index) => ({ item_id: item.id, value: styleAnswers[index] as number | string }));
    try {
      await ensureVisitorSession();
      const { attempt } = await invokeFunction<{ attempt: Attempt }>('ai-assessment-engine', { action: 'submit-ai-style', responses });
      setCurrentAttempt(attempt);
      setHistory((value) => ({ ...value, personality: attempt }));
    } catch (submitError) {
      setError(errorMessage(submitError, '提交失败，请稍后重试'));
      return;
    } finally {
      setIsBusy(false);
    }
    setStage('result');
  };

  const openLatest = async (kind: 'capability' | 'personality') => {
    const attempt = history[kind];
    if (!attempt) return;
    setCurrentAttempt(attempt);
    setIsSharedResult(false);
    if (kind === 'capability') {
      setIsBusy(true);
      await loadPayment().catch((loadError) => setError(errorMessage(loadError, '支付状态加载失败')));
      setIsBusy(false);
    }
    setStage('result');
  };

  const shareResult = async () => {
    if (!currentAttempt) return;
    const isNewStyle = currentAttempt.framework_version === 'ai-usage-style-v1';
    const profile = currentAttempt.personality_code
      ? (isNewStyle ? aiStyleProfiles[currentAttempt.personality_code] : personalityProfiles[currentAttempt.personality_code])
      : null;
    const levelDefinition = currentAttempt.framework_version === 'pacf-1.0.0'
      ? pacfLevels[currentAttempt.ability_level || 0]
      : capabilityLevels[currentAttempt.ability_level || 0];
    const title = currentAttempt.kind === 'capability'
      ? `我的AI能力：Level ${currentAttempt.ability_level} · ${levelDefinition.title}`
      : `我的AI使用风格：${profile?.name || currentAttempt.personality_code}`;
    const url = currentAttempt.share_token ? `${window.location.origin}${window.location.pathname}?share=${currentAttempt.share_token}` : window.location.href;
    try {
      const usedNativeShare = Boolean(navigator.share && currentAttempt.share_token);
      if (usedNativeShare) await navigator.share({ title, text: `${title}，来测测你的AI画像。`, url });
      else await navigator.clipboard.writeText(`${title}\n${url}`);
      setNotice(usedNativeShare ? '分享面板已打开' : '结果链接已复制');
    } catch (shareError) {
      if ((shareError as Error)?.name !== 'AbortError') setError('分享失败，请稍后重试');
    }
  };

  const createPayment = async (provider: Provider) => {
    setIsBusy(true); setError('');
    try {
      await ensureVisitorSession();
      const data = await invokeFunction<{ alipay_payment_url?: string | null }>('ai-group-payment', { action: 'create-order', provider });
      if (provider === 'alipay' && data.alipay_payment_url) { window.location.assign(data.alipay_payment_url); return; }
      await loadPayment();
    } catch (paymentError) {
      setError(errorMessage(paymentError, '创建支付订单失败，请稍后重试'));
    } finally { setIsBusy(false); }
  };

  const syncPayment = async () => {
    if (!payment?.latest_order?.order_no) return;
    setIsBusy(true); setError('');
    try {
      const data = await invokeFunction<PaymentStatus>('ai-group-payment', { action: 'sync-order', order_no: payment.latest_order.order_no });
      setPayment(data);
    } catch (syncError) { setError(errorMessage(syncError, '未能确认支付状态')); }
    finally { setIsBusy(false); }
  };

  const currentCapabilityQuestion = capabilityForm?.items[questionIndex];
  const currentPersonalityQuestion = styleForm?.items[questionIndex];
  const isUnlocked = payment?.membership?.access_status === 'active';
  const groupImageUrl = payment?.group_qr_url || (isUnlocked && payment?.membership?.level ? paymentPlaceholders[payment.membership.level] : null);

  return (
    <main className="page-aurora min-h-screen px-3 py-6 pb-16 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <button onClick={() => stage === 'home' ? navigate('/tools') : setStage('home')} className="mb-5 inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-cyan-200"><ArrowLeft className="h-4 w-4" />{stage === 'home' ? '返回产品实验室' : '返回AI画像首页'}</button>
        <section className="overflow-hidden rounded-3xl border border-cyan-200/40 bg-slate-950/90 text-slate-100 shadow-xl shadow-cyan-950/30 backdrop-blur-xl">
          <div className="bg-gradient-to-br from-slate-950 via-cyan-950 to-blue-950 px-6 py-8 text-white sm:px-10 sm:py-11">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20"><BrainCircuit className="h-7 w-7 text-cyan-100" /></div>
            <p className="mb-2 text-xs font-bold tracking-[0.2em] text-cyan-200">YOUR AI PORTRAIT · 个人AI画像</p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">你是谁，你在哪，下一步去哪</h1>
            <p className="mt-3 max-w-2xl leading-7 text-slate-100">使用风格测评发现你习惯怎样与 AI 工作，能力测评定位当前等级。两套测试完全免费，无需登录；只有决定进群时才需要付费。</p>
          </div>
          <div className="p-5 sm:p-8">
            {error && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
            {notice && <div className="mb-5 rounded-2xl border border-cyan-300/20 bg-cyan-950/60 px-4 py-3 text-sm leading-6 text-cyan-100">{notice}</div>}

            {stage === 'home' && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <article className="rounded-3xl border border-cyan-300/25 bg-gradient-to-br from-cyan-950/70 to-slate-900 p-6">
                    <Gauge className="h-8 w-8 text-cyan-300" /><p className="mt-5 text-xs font-bold tracking-widest text-cyan-300">PACF v1 快速筛查 · 约15分钟</p><h2 className="mt-2 text-2xl font-black text-white">AI能力等级测评</h2><p className="mt-3 text-sm leading-6 text-slate-300">30道知识与真实情境题，得到Level 0–5、六维雷达图和下一步成长路线。</p>
                    <button onClick={() => setStage('capability-track')} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 font-bold text-slate-950">开始能力测评 <ArrowRight className="h-4 w-4" /></button>
                    {history.capability && <button onClick={() => openLatest('capability')} className="mt-3 w-full text-sm font-semibold text-cyan-200">查看最近结果</button>}
                    {!history.capability && history.legacy_capability_available && <p className="mt-3 text-center text-xs leading-5 text-amber-200">旧版结果已安全归档，请完成新版测评获得当前能力画像。</p>}
                  </article>
                  <article className="rounded-3xl border border-violet-300/25 bg-gradient-to-br from-violet-950/70 to-slate-900 p-6">
                    <Compass className="h-8 w-8 text-violet-300" /><p className="mt-5 text-xs font-bold tracking-widest text-violet-300">Beta · 约6分钟</p><h2 className="mt-2 text-2xl font-black text-white">AI使用风格画像</h2><p className="mt-3 text-sm leading-6 text-slate-200">28道行为偏好题，得到四条连续风格轴、平衡提示和专属四字母画像。</p>
                    <button onClick={startPersonality} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-400 px-4 py-3 font-bold text-slate-950">开始风格测评 <ArrowRight className="h-4 w-4" /></button>
                    {history.personality && <button onClick={() => openLatest('personality')} className="mt-3 w-full text-sm font-semibold text-violet-200">查看最近结果</button>}
                  </article>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-200"><ShieldCheck className="mr-2 inline h-4 w-4 text-emerald-300" />规则负责稳定计算；大模型只负责解释。风格不分高低，也不代表能力，能力可以通过实践持续升级。</div>
              </div>
            )}

            {stage === 'capability-track' && (
              <div><p className="text-sm font-bold tracking-widest text-cyan-300">选择成长场景</p><h2 className="mt-2 text-2xl font-black text-white">你更希望把AI用在哪里？</h2><p className="mt-2 text-slate-300">两个场景使用完全相同的30道题和同一标尺；选择只影响报告建议，不影响题目与分数。</p>
                <div className="mt-7 grid gap-4 sm:grid-cols-2">
                  <button onClick={() => startCapability('daily')} className="rounded-2xl border border-white/15 bg-slate-900 p-5 text-left transition hover:border-cyan-300"><Compass className="h-6 w-6 text-cyan-300" /><strong className="mt-3 block text-lg text-white">生活探索版</strong><span className="mt-2 block text-sm leading-6 text-slate-300">适合零基础、学生和希望先改善学习与日常生活的人。</span></button>
                  <button onClick={() => startCapability('work')} className="rounded-2xl border border-white/15 bg-slate-900 p-5 text-left transition hover:border-cyan-300"><Workflow className="h-6 w-6 text-cyan-300" /><strong className="mt-3 block text-lg text-white">工作创造版</strong><span className="mt-2 block text-sm leading-6 text-slate-300">适合职场人、创作者、产品经理和创业者。</span></button>
                </div>
              </div>
            )}

            {stage === 'capability-questions' && currentCapabilityQuestion && (
              <div><div className="mb-6 flex justify-between gap-3 text-sm"><span className="font-semibold text-cyan-300">第 {questionIndex + 1} / {capabilityForm?.items.length} 题</span><span className="text-right text-slate-300">{capabilityForm?.instrument.dimensions[currentCapabilityQuestion.dimension].label}</span></div><div className="mb-7 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-cyan-500 to-blue-600" style={{ width: `${((questionIndex + 1) / (capabilityForm?.items.length || 1)) * 100}%` }} /></div>
                <h2 className="text-xl font-bold leading-8 text-white sm:text-2xl">{currentCapabilityQuestion.stem}</h2><div className="mt-6 space-y-3">{currentCapabilityQuestion.options.map((option) => { const selected = capabilityAnswers[questionIndex] === option.id; return <button key={option.id} onClick={() => setCapabilityAnswers((items) => items.map((item, index) => index === questionIndex ? option.id : item))} className={`w-full rounded-2xl border px-4 py-4 text-left text-base leading-7 transition ${selected ? 'border-cyan-300 bg-cyan-400/20 text-white ring-2 ring-cyan-300/20' : 'border-slate-500 bg-slate-900/75 text-slate-100 hover:border-cyan-400'}`}><span className="mr-3 font-black text-cyan-300">{option.id}</span>{option.text}</button>; })}</div>
                <div className="mt-8 flex justify-between"><button onClick={() => questionIndex === 0 ? setStage('capability-track') : setQuestionIndex((index) => index - 1)} className="rounded-xl border border-slate-500 px-4 py-3 text-sm font-semibold text-slate-100">上一题</button><button onClick={nextCapability} disabled={capabilityAnswers[questionIndex] === null} className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-40">{questionIndex === (capabilityForm?.items.length || 1) - 1 ? '选择成长方向' : '下一题'}</button></div>
              </div>
            )}

            {stage === 'capability-goal' && (
              <div><p className="text-sm font-bold tracking-widest text-cyan-300">最后一步</p><h2 className="mt-2 text-2xl font-black text-white">你最希望AI帮你解决什么？</h2><p className="mt-2 text-sm leading-6 text-slate-300">不影响等级，只用于生成更贴近你的成长建议和课程路线。</p><div className="mt-6 grid gap-3 sm:grid-cols-2">{learningGoals.map((item) => <button key={item.value} onClick={() => setGoal(item.value)} className={`rounded-2xl border p-4 text-left ${goal === item.value ? 'border-cyan-300 bg-cyan-400/20' : 'border-slate-600 bg-slate-900/75'}`}><strong className="text-white">{item.label}</strong><span className="mt-1 block text-sm text-slate-300">{item.description}</span></button>)}</div><div className="mt-8 flex justify-between"><button onClick={() => { setQuestionIndex(Math.max(0, (capabilityForm?.items.length || 1) - 1)); setStage('capability-questions'); }} className="rounded-xl border border-slate-500 px-4 py-3 text-sm font-semibold text-slate-100">返回</button><button onClick={submitCapability} disabled={!goal || isBusy} className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-40">{isBusy ? '正在分析…' : '生成能力报告'}</button></div></div>
            )}

            {stage === 'personality-questions' && currentPersonalityQuestion && (
              <div><div className="mb-6 flex justify-between gap-3 text-sm"><span className="font-semibold text-violet-300">第 {questionIndex + 1} / {styleForm?.items.length} 题</span><span className="text-slate-300">没有正确答案 · 请按真实习惯选择</span></div><div className="mb-7 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${((questionIndex + 1) / (styleForm?.items.length || 1)) * 100}%` }} /></div>
                {currentPersonalityQuestion.kind === 'likert' ? <>
                  <h2 className="text-xl font-bold leading-9 text-white sm:text-2xl">{currentPersonalityQuestion.statement}</h2>
                  <div className="mt-8 rounded-2xl border border-white/15 bg-slate-900/75 p-4 sm:p-5"><div className="flex justify-between gap-4 text-xs font-semibold text-violet-200"><span>非常不同意</span><span>看情况</span><span className="text-right">非常同意</span></div><div className="mt-4 grid grid-cols-7 gap-2">{Array.from({ length: 7 }, (_, index) => index + 1).map((value) => <button key={value} aria-label={styleForm?.instrument.scale.labels[value - 1]} onClick={() => setStyleAnswers((items) => items.map((item, index) => index === questionIndex ? value : item))} className={`aspect-square rounded-full border text-sm font-black transition sm:text-base ${styleAnswers[questionIndex] === value ? 'border-violet-200 bg-violet-400 text-slate-950 ring-4 ring-violet-400/20' : 'border-slate-500 bg-slate-950 text-slate-100 hover:border-violet-300'}`}>{value}</button>)}</div><p className="mt-4 min-h-6 text-center text-sm font-semibold text-violet-100">{typeof styleAnswers[questionIndex] === 'number' ? styleForm?.instrument.scale.labels[(styleAnswers[questionIndex] as number) - 1] : '请选择 1–7 中最符合你的程度'}</p></div>
                </> : <>
                  <p className="text-xs font-bold tracking-widest text-violet-300">实验题 · 不计入本次风格分数</p><h2 className="mt-2 text-xl font-bold leading-9 text-white sm:text-2xl">{currentPersonalityQuestion.prompt}</h2><div className="mt-7 grid gap-3 sm:grid-cols-2">{currentPersonalityQuestion.options.map((option) => <button key={option.id} onClick={() => setStyleAnswers((items) => items.map((item, index) => index === questionIndex ? option.id : item))} className={`rounded-2xl border p-5 text-left text-base leading-7 transition ${styleAnswers[questionIndex] === option.id ? 'border-violet-200 bg-violet-400/25 text-white ring-2 ring-violet-300/20' : 'border-slate-500 bg-slate-900/80 text-slate-100 hover:border-violet-300'}`}>{option.text}</button>)}</div>
                </>}
                <div className="mt-8 flex justify-between"><button onClick={() => questionIndex === 0 ? setStage('home') : setQuestionIndex((index) => index - 1)} className="rounded-xl border border-slate-500 px-4 py-3 text-sm font-semibold text-slate-100">上一题</button><button onClick={nextPersonality} disabled={styleAnswers[questionIndex] === null || isBusy} className="rounded-xl bg-violet-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-40">{isBusy ? '正在分析…' : questionIndex === (styleForm?.items.length || 1) - 1 ? '生成风格报告' : '下一题'}</button></div>
              </div>
            )}

            {stage === 'result' && currentAttempt && (
              <div className="space-y-6">
                {currentAttempt.kind === 'capability' ? (() => { const isPACF = currentAttempt.framework_version === 'pacf-1.0.0'; const level = (isPACF ? pacfLevels : capabilityLevels)[currentAttempt.ability_level || 0]; return (
                  <section className="rounded-3xl bg-gradient-to-br from-cyan-950/80 via-slate-900 to-blue-950/80 p-5 ring-1 ring-cyan-300/25 sm:p-7">
                    <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm leading-6 ${isPACF ? 'border-cyan-300/25 bg-cyan-950/55 text-cyan-100' : 'border-amber-300/30 bg-amber-950/40 text-amber-100'}`}>{isPACF ? 'PACF v1 快速筛查（试测版）：用于能力定位与学习建议，不等同于正式认证。' : '这是旧版自评结果，分数含义与 PACF v1 不同，不能换算；建议重新完成新版测评。'}</div>
                    <p className="text-sm font-semibold text-cyan-300">你的AI能力等级</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-3xl font-black text-white">Level {currentAttempt.ability_level} · {level.title}</h2><p className="mt-2 text-slate-100">{level.summary}</p></div><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-bold text-white">{currentAttempt.total_score} / {isPACF ? 100 : 90}</span></div><div className="mt-7"><RadarChart scores={currentAttempt.dimension_scores} /></div>
                  </section>
                  ); })()
                : <StyleResultPanel attempt={currentAttempt} />}

                <ReportPanel report={currentAttempt.report} aiGenerated={currentAttempt.report_status === 'ready'} />

                {!isSharedResult && currentAttempt.kind === 'capability' && payment?.route && (
                  isUnlocked ? <section className="rounded-3xl border border-emerald-300/30 bg-emerald-950/35 p-5 sm:p-7"><h3 className="text-lg font-black text-emerald-100">已解锁：{payment.route.group_name}</h3><p className="mt-2 text-sm text-emerald-100">进群后请把群昵称改为下面的四位ID。</p><button onClick={() => navigator.clipboard.writeText(payment.membership?.display_id || '')} className="mt-4 flex w-full items-center justify-between rounded-2xl bg-slate-950/60 px-4 py-4"><strong className="text-2xl tracking-[0.25em] text-white">{payment.membership?.display_id}</strong><span className="inline-flex items-center gap-1 text-sm text-emerald-300"><Clipboard className="h-4 w-4" />复制ID</span></button>{groupImageUrl ? <div className="mt-5 text-center"><img src={groupImageUrl} alt={`${payment.route.group_name}二维码`} className="mx-auto aspect-square w-full max-w-xs rounded-2xl bg-white object-cover p-3" /><p className="mt-3 text-sm text-emerald-100">扫码进群，并将群昵称改为 {payment.membership?.display_id}。</p></div> : <p className="mt-5 rounded-2xl bg-white/10 p-4 text-sm"><QrCode className="mr-2 inline h-4 w-4" />群二维码正在配置，请稍后刷新。</p>}</section>
                  : <section className="rounded-3xl border border-white/15 bg-slate-900/70 p-5 sm:p-7"><div className="flex gap-3"><LockKeyhole className="h-6 w-6 text-cyan-300" /><div><h3 className="text-lg font-black text-white">解锁 {payment.route.group_name}</h3><p className="mt-1 text-sm text-slate-300">{payment.unlock_price_label} {money(payment.unlock_price_cents)} · 支付后显示四位ID和对应群二维码。</p></div></div>{paymentQr && payment.latest_order?.status === 'created' ? <div className="mt-6 rounded-2xl bg-slate-950 p-5 text-center"><p className="font-bold">微信扫码支付 {money(payment.unlock_price_cents)}</p><img src={paymentQr} alt="微信支付二维码" className="mx-auto mt-4 w-full max-w-[220px] rounded-xl bg-white p-2" /><button onClick={syncPayment} disabled={isBusy} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950"><RefreshCw className={`h-4 w-4 ${isBusy ? 'animate-spin' : ''}`} />我已支付，刷新结果</button></div> : payment.payment_available ? <div className="mt-6 grid gap-3 sm:grid-cols-2"><button onClick={() => createPayment('wechat')} disabled={!payment.providers.wechat || isBusy} className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-4 text-left text-emerald-950 disabled:opacity-40"><span><strong className="block">微信支付</strong><span className="text-sm">{money(payment.unlock_price_cents)}</span></span><WalletCards className="h-6 w-6" /></button><button onClick={() => createPayment('alipay')} disabled={!payment.providers.alipay || isBusy} className="flex items-center justify-between rounded-2xl bg-blue-50 px-4 py-4 text-left text-blue-950 disabled:opacity-40"><span><strong className="block">支付宝</strong><span className="text-sm">{money(payment.unlock_price_cents)}</span></span><CreditCard className="h-6 w-6" /></button></div> : <p className="mt-5 text-sm text-amber-200">支付通道暂不可用，请稍后刷新。</p>}</section>
                )}

                <div className="grid gap-3 sm:grid-cols-3"><button onClick={shareResult} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/40 px-4 py-3 text-sm font-bold text-cyan-100"><Share2 className="h-4 w-4" />分享结果</button><button onClick={() => currentAttempt.kind === 'capability' ? startPersonality() : setStage('capability-track')} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-white">完成另一套测评</button><button onClick={() => { setIsSharedResult(false); window.history.replaceState(null, '', window.location.pathname); setStage('home'); }} className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950">返回AI画像首页</button></div>
              </div>
            )}

            {isBusy && stage !== 'capability-goal' && stage !== 'personality-questions' && <div className="py-10 text-center text-slate-300"><RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin" />正在加载…</div>}
          </div>
        </section>
      </div>
    </main>
  );
};

export default AIAssessment;
