import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clipboard,
  CreditCard,
  LockKeyhole,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type Level = 'starter' | 'application' | 'practice';
type Goal = 'office' | 'content' | 'learning' | 'product' | 'programming';
type Provider = 'wechat' | 'alipay';
type Stage = 'intro' | 'questions' | 'goal' | 'result';

type AccessStatus = {
  assessment: { score: number; level: Level; learning_goal: Goal; updated_at: string } | null;
  membership: { level: Level; access_status: 'pending_payment' | 'active' | 'revoked'; display_id: string | null } | null;
  route: { level: Level; group_name: string; description: string } | null;
  latest_order: { order_no: string; provider: Provider; status: string; expires_at: string; wechat_code_url: string | null } | null;
  group_qr_url: string | null;
  qr_ready: boolean;
  unlock_price_cents: number | null;
  unlock_price_label: string;
  payment_available: boolean;
  providers: { wechat: boolean; alipay: boolean };
};

const questions = [
  {
    title: '你目前使用 AI 工具的频率是？',
    options: [
      ['还没使用过，或只是偶然试一下', 0],
      ['偶尔在有需要时会用', 1],
      ['每周都会用，已是日常工具之一', 2],
    ],
  },
  {
    title: '让 AI 帮你完成任务时，你通常如何描述需求？',
    options: [
      ['想到什么就输入一句，看看它怎么回答', 0],
      ['会补充目的或想要的结果', 1],
      ['会写清背景、限制、输出格式，并根据结果继续调整', 2],
    ],
  },
  {
    title: 'AI 的第一次回答不够好时，你通常会？',
    options: [
      ['放弃或换别的方式', 0],
      ['再问一遍，换一种说法', 1],
      ['指出问题，补充信息或示例，让它迭代', 2],
    ],
  },
  {
    title: '面对 AI 给出的事实、数据或链接时，你会？',
    options: [
      ['通常直接采用', 0],
      ['重要内容会大致核对一下', 1],
      ['主动回到原始来源核验，再决定是否采用', 2],
    ],
  },
  {
    title: '你是否用 AI 完成过一个有明确交付物的真实任务？',
    options: [
      ['还没有', 0],
      ['做过一两次，例如写文案、整理资料或做表格', 1],
      ['经常用它完成工作流中的一整段任务', 2],
    ],
  },
  {
    title: '你如何选择 AI 工具？',
    options: [
      ['主要只知道一个聊天工具', 0],
      ['知道不同工具能做不同类型的事', 1],
      ['会按对话、搜索、图片、代码或自动化任务主动组合工具', 2],
    ],
  },
  {
    title: '你是否保存或复用过 AI 提示词、模板或工作流？',
    options: [
      ['没有，基本每次从零开始', 0],
      ['偶尔会收藏好用的提问方式', 1],
      ['有自己的模板、知识库或稳定流程', 2],
    ],
  },
  {
    title: '遇到隐私或敏感信息时，你对 AI 的使用方式是？',
    options: [
      ['还没有特别考虑过', 0],
      ['会尽量少输入敏感内容', 1],
      ['会脱敏、控制资料范围，并区分可公开与不可公开的信息', 2],
    ],
  },
] as const;

const goals: { value: Goal; label: string; description: string }[] = [
  { value: 'office', label: '办公提效', description: '写作、表格、汇报和重复工作' },
  { value: 'content', label: '内容创作', description: '选题、文案、图片和个人表达' },
  { value: 'learning', label: '学习研究', description: '阅读、整理知识和学习计划' },
  { value: 'product', label: '产品与创业', description: '调研、方案、原型和业务实践' },
  { value: 'programming', label: '编程自动化', description: '代码、Agent 和自动化工作流' },
];

const levelLabels: Record<Level, string> = {
  starter: 'AI 启蒙',
  application: 'AI 应用',
  practice: 'AI 实战',
};

const placeholderGroupImages: Record<Level, string> = {
  starter: '/images/ai-groups/starter-placeholder.webp',
  application: '/images/ai-groups/application-placeholder.webp',
  practice: '/images/ai-groups/practice-placeholder.webp',
};

const money = (amountCents: number | null) => amountCents === null
  ? '—'
  : `¥${(amountCents / 100).toFixed(2)}`;

const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

async function invokePayment(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('ai-group-payment', { body });
  if (error) {
    let message = error.message || '支付服务暂时不可用';
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: unknown };
        if (typeof payload.error === 'string' && payload.error.trim()) message = payload.error;
      } catch {
        // Keep the SDK message if the response is not JSON or its body is unavailable.
      }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

type AssessmentRpcClient = {
  rpc: (
    functionName: 'submit_ai_assessment',
    args: { p_answers: number[]; p_learning_goal: Goal },
  ) => Promise<{ error: { message: string } | null }>;
};

const AIAssessment: React.FC = () => {
  const { user, isLoading } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('intro');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(8).fill(null));
  const [goal, setGoal] = useState<Goal | null>(null);
  const [access, setAccess] = useState<AccessStatus | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const [paymentQr, setPaymentQr] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState('');

  const loadStatus = useCallback(async () => {
    if (!userId) return null;
    const data = await invokePayment({ action: 'status' }) as AccessStatus;
    setAccess(data);
    return data;
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setIsBusy(true);
    loadStatus()
      .then((data) => {
        if (data?.assessment) setStage('result');
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : '加载测评记录失败'))
      .finally(() => setIsBusy(false));
  }, [loadStatus, userId]);

  useEffect(() => {
    const codeUrl = access?.latest_order?.wechat_code_url;
    if (!codeUrl) {
      setPaymentQr(null);
      return;
    }
    QRCode.toDataURL(codeUrl, { width: 360, margin: 1, errorCorrectionLevel: 'M' })
      .then(setPaymentQr)
      .catch(() => setError('生成微信支付二维码失败，请刷新后重试'));
  }, [access?.latest_order?.wechat_code_url]);

  const scorePreview = useMemo(
    () => answers.reduce((total, answer) => total + (answer ?? 0), 0),
    [answers],
  );

  const startAssessment = () => {
    if (!user) {
      navigate('/login', { state: { from: '/tools/ai-assessment' } });
      return;
    }
    setError('');
    setStage('questions');
  };

  const selectAnswer = (value: number) => {
    const updated = [...answers];
    updated[questionIndex] = value;
    setAnswers(updated);
  };

  const nextQuestion = () => {
    if (answers[questionIndex] === null) return;
    if (questionIndex === questions.length - 1) {
      setStage('goal');
      return;
    }
    setQuestionIndex((index) => index + 1);
  };

  const submitAssessment = async () => {
    if (!goal || answers.some((answer) => answer === null)) return;
    setIsBusy(true);
    setError('');
    try {
      const assessmentClient = supabase as unknown as AssessmentRpcClient;
      const { error: submitError } = await assessmentClient.rpc('submit_ai_assessment', {
        p_answers: answers,
        p_learning_goal: goal,
      });
      if (submitError) throw submitError;
      await loadStatus();
      setStage('result');
    } catch (submitError) {
      setError(errorMessage(submitError, '提交测评失败，请稍后重试'));
    } finally {
      setIsBusy(false);
    }
  };

  const createPayment = async (provider: Provider) => {
    setIsBusy(true);
    setError('');
    try {
      const data = await invokePayment({ action: 'create-order', provider }) as {
        alipay_payment_url?: string | null;
      };
      if (provider === 'alipay' && data.alipay_payment_url) {
        window.location.assign(data.alipay_payment_url);
        return;
      }
      await loadStatus();
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : '创建支付订单失败，请稍后重试');
    } finally {
      setIsBusy(false);
    }
  };

  const syncPayment = async () => {
    if (!access?.latest_order?.order_no) return;
    setIsBusy(true);
    setError('');
    try {
      const data = await invokePayment({ action: 'sync-order', order_no: access.latest_order.order_no }) as AccessStatus;
      setAccess(data);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : '未能确认支付状态，请稍后再试');
    } finally {
      setIsBusy(false);
    }
  };

  const copyIdentity = async () => {
    const identity = access?.membership?.display_id;
    if (!identity) return;
    try {
      await navigator.clipboard.writeText(identity);
      setCopyMessage('已复制');
    } catch {
      setCopyMessage('请长按复制');
    }
    window.setTimeout(() => setCopyMessage(''), 1800);
  };

  const currentQuestion = questions[questionIndex];
  const isUnlocked = access?.membership?.access_status === 'active';
  const displayedLevel = isUnlocked && access?.membership
    ? access.membership.level
    : access?.assessment?.level;
  const groupImageUrl = access?.group_qr_url
    || (isUnlocked && displayedLevel ? placeholderGroupImages[displayedLevel] : null);
  const isGroupImagePlaceholder = Boolean(groupImageUrl && !access?.group_qr_url);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-300">正在加载…</div>;
  }

  return (
    <main className="page-aurora min-h-screen px-3 py-6 pb-16 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => navigate('/tools')}
          className="mb-5 inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-cyan-200"
        >
          <ArrowLeft className="h-4 w-4" /> 返回产品实验室
        </button>

        <section className="overflow-hidden rounded-3xl border border-cyan-200/40 bg-slate-950/85 text-slate-100 shadow-xl shadow-cyan-950/30 backdrop-blur-xl">
          <div className="bg-gradient-to-br from-slate-950 via-cyan-950 to-blue-950 px-6 py-9 text-white sm:px-10 sm:py-12">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
              <BrainCircuit className="h-7 w-7 text-cyan-100" />
            </div>
            <p className="mb-2 text-xs font-bold tracking-[0.2em] text-cyan-200">AI LEARNING SERIES · 第一课预告</p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">AI 学习起点测评</h1>
            <p className="mt-3 max-w-2xl leading-7 text-slate-200">
              这不是考试。用 3 分钟找到你当前最适合的学习起点，并匹配后续的学习群。
            </p>
          </div>

          <div className="p-5 sm:p-8">
            {error && (
              <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            {stage === 'intro' && (
              <div className="space-y-7">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ['1', '完成测评', '8 个真实使用场景'],
                    ['2', '获得起点', '看到适合你的学习路线'],
                    ['3', '解锁进群', '支付后领取专属 ID 与二维码'],
                  ].map(([number, title, description]) => (
                    <div key={number} className="rounded-2xl border border-white/15 bg-slate-900/80 p-4">
                      <span className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-cyan-600 text-xs font-black text-white">{number}</span>
                      <p className="font-bold text-white">{title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-950/60 px-4 py-4 text-sm leading-6 text-cyan-100">
                  <ShieldCheck className="mr-2 inline h-4 w-4" />
                  测评和结果完全免费。只有你决定进入对应学习群时，才需要支付入群权益并领取唯一群昵称。
                </div>
                <button onClick={startAssessment} className="neon-button flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-semibold text-white disabled:opacity-50" disabled={isBusy}>
                  {user ? '开始免费测评' : '登录后开始免费测评'} <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {stage === 'questions' && (
              <div>
                <div className="mb-7 flex items-center justify-between text-sm">
                  <span className="font-semibold text-cyan-300">第 {questionIndex + 1} / {questions.length} 题</span>
                  <span className="text-slate-300">如实选择即可，没有标准答案</span>
                </div>
                <div className="mb-7 h-2 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all" style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} />
                </div>
                <h2 className="text-xl font-bold leading-8 text-white sm:text-2xl">{currentQuestion.title}</h2>
                <div className="mt-6 space-y-3">
                  {currentQuestion.options.map(([label, value]) => {
                    const selected = answers[questionIndex] === value;
                    return (
                      <button
                        key={label}
                        onClick={() => selectAnswer(value)}
                        className={`w-full rounded-2xl border px-4 py-4 text-left text-sm leading-6 transition sm:px-5 ${selected
                          ? 'border-cyan-300 bg-cyan-400/20 text-white ring-2 ring-cyan-300/25'
                          : 'border-slate-500 bg-slate-900/75 text-slate-100 hover:border-cyan-300 hover:bg-cyan-950/50'}`}
                      >
                        <span className={`mr-3 inline-flex h-5 w-5 align-middle items-center justify-center rounded-full border ${selected ? 'border-cyan-300 bg-cyan-500 text-white' : 'border-slate-400'}`}>
                          {selected && <CheckCircle2 className="h-4 w-4" />}
                        </span>
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-8 flex justify-between gap-3">
                  <button onClick={() => questionIndex === 0 ? setStage('intro') : setQuestionIndex((index) => index - 1)} className="rounded-xl border border-slate-500 px-4 py-3 text-sm font-semibold text-slate-200 hover:border-slate-300 hover:bg-white/10">
                    上一题
                  </button>
                  <button onClick={nextQuestion} disabled={answers[questionIndex] === null} className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:from-cyan-500 hover:to-blue-600 disabled:cursor-not-allowed disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-400 disabled:opacity-100">
                    {questionIndex === questions.length - 1 ? '选择学习目标' : '下一题'}
                  </button>
                </div>
              </div>
            )}

            {stage === 'goal' && (
              <div>
                <p className="text-sm font-bold tracking-widest text-cyan-300">最后一步</p>
                <h2 className="mt-2 text-2xl font-black text-white">你最希望 AI 帮你解决什么？</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">它不影响你的基础分组，只帮助我安排后续案例和作业。</p>
                <p className="mt-3 text-sm font-semibold text-cyan-200">当前基础分预览：{scorePreview} / 16 · 仅用于匹配学习起点</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {goals.map((item) => (
                    <button key={item.value} onClick={() => setGoal(item.value)} className={`rounded-2xl border p-4 text-left transition ${goal === item.value ? 'border-cyan-300 bg-cyan-400/20 ring-2 ring-cyan-300/25' : 'border-slate-500 bg-slate-900/75 hover:border-cyan-300 hover:bg-cyan-950/50'}`}>
                      <p className="font-bold text-white">{item.label}</p>
                      <p className="mt-1 text-sm text-slate-300">{item.description}</p>
                    </button>
                  ))}
                </div>
                <div className="mt-8 flex justify-between gap-3">
                  <button onClick={() => setStage('questions')} className="rounded-xl border border-slate-500 px-4 py-3 text-sm font-semibold text-slate-200 hover:border-slate-300 hover:bg-white/10">返回</button>
                  <button onClick={submitAssessment} disabled={!goal || isBusy} className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-700 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-400">
                    {isBusy ? '正在生成结果…' : '查看我的学习起点'}
                  </button>
                </div>
              </div>
            )}

            {stage === 'result' && access?.assessment && access.route && (
              <div className="space-y-6">
                <div className="rounded-3xl bg-gradient-to-br from-cyan-950/80 via-slate-900 to-blue-950/80 p-5 ring-1 ring-cyan-300/25 sm:p-7">
                  <p className="text-sm font-semibold text-cyan-300">你的当前学习起点</p>
                  <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="text-3xl font-black text-white">{displayedLevel ? levelLabels[displayedLevel] : 'AI 学习路线'}</h2>
                      <p className="mt-2 max-w-xl leading-7 text-slate-200">{access.route.description}</p>
                    </div>
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-bold text-slate-100 shadow-sm">基础分 {access.assessment.score} / 16</span>
                  </div>
                </div>

                {isUnlocked ? (
                  <section className="rounded-3xl border border-emerald-300/30 bg-emerald-950/35 p-5 sm:p-7">
                    <div className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-300" />
                      <div>
                        <h3 className="text-lg font-black text-emerald-100">已解锁：{access.route.group_name}</h3>
                        <p className="mt-1 text-sm leading-6 text-emerald-100/90">请保存你的唯一 ID。入群后，把微信群昵称修改为该 ID，管理员会以此核验。</p>
                      </div>
                    </div>
                    <button onClick={copyIdentity} className="mt-5 flex w-full items-center justify-between rounded-2xl border border-emerald-300/30 bg-slate-950/60 px-4 py-4 text-left transition hover:border-emerald-300/70">
                      <span><span className="block text-xs font-semibold text-emerald-300">你的唯一入群 ID</span><strong className="mt-1 block text-xl tracking-wide text-white">{access.membership?.display_id}</strong></span>
                      <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-300"><Clipboard className="h-4 w-4" />{copyMessage || '复制'}</span>
                    </button>
                    {groupImageUrl ? (
                      <div className="mt-6 text-center">
                        <img src={groupImageUrl} alt={isGroupImagePlaceholder ? `${access.route.group_name}临时占位图` : `${access.route.group_name}二维码`} className="mx-auto aspect-square w-full max-w-xs rounded-2xl bg-[#ffffff] object-cover p-3 shadow-sm" />
                        {isGroupImagePlaceholder ? (
                          <p className="mt-3 text-sm text-amber-200">当前是临时占位图，暂不可扫码；正式群二维码发来后会直接替换。</p>
                        ) : (
                          <p className="mt-3 text-sm text-emerald-100">扫码进群后，请立即将群昵称改为 <strong>{access.membership?.display_id}</strong>。</p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-5 rounded-2xl bg-white/10 p-4 text-sm leading-6 text-emerald-100"><QrCode className="mr-1 inline h-4 w-4" /> 已确认入群权益，群二维码正在由管理员配置。请稍后刷新本页。</div>
                    )}
                  </section>
                ) : (
                  <section className="rounded-3xl border border-white/15 bg-slate-900/70 p-5 shadow-sm sm:p-7">
                    <div className="flex gap-3">
                      <LockKeyhole className="mt-0.5 h-6 w-6 shrink-0 text-cyan-300" />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black text-white">解锁 {access.route.group_name}</h3>
                          <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">{access.unlock_price_label} {money(access.unlock_price_cents)}</span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-200">解锁后系统会生成唯一入群 ID，并只向你展示对应群的二维码。</p>
                      </div>
                    </div>

                    {paymentQr && access.latest_order?.status === 'created' ? (
                      <div className="mt-6 rounded-2xl bg-slate-950 p-5 text-center text-white">
                        <p className="font-bold">请使用微信扫描二维码支付 {money(access.unlock_price_cents)}</p>
                        <img src={paymentQr} alt="微信支付二维码" className="mx-auto mt-4 w-full max-w-[220px] rounded-xl bg-[#ffffff] p-2" />
                        <p className="mt-3 text-xs text-slate-300">支付完成后，点击下方按钮领取唯一 ID。</p>
                        <button onClick={syncPayment} disabled={isBusy} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${isBusy ? 'animate-spin' : ''}`} />我已支付，刷新结果</button>
                      </div>
                    ) : access.payment_available ? (
                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        <button onClick={() => createPayment('wechat')} disabled={!access.providers.wechat || isBusy} className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-left transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
                          <span><strong className="block text-emerald-950">微信支付</strong><span className="mt-1 block text-sm text-emerald-800">{access.unlock_price_label} · {money(access.unlock_price_cents)}</span></span>
                          <WalletCards className="h-6 w-6 text-emerald-600" />
                        </button>
                        <button onClick={() => createPayment('alipay')} disabled={!access.providers.alipay || isBusy} className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-left transition hover:border-blue-400 disabled:cursor-not-allowed disabled:opacity-50">
                          <span><strong className="block text-blue-950">支付宝</strong><span className="mt-1 block text-sm text-blue-800">{access.unlock_price_label} · {money(access.unlock_price_cents)}</span></span>
                          <CreditCard className="h-6 w-6 text-blue-600" />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-6 rounded-2xl bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900"><Sparkles className="mr-1 inline h-4 w-4" /> 你的测评结果已保存。支付通道正在配置中，开放后可在此直接领取入群权益。</div>
                    )}
                    <p className="mt-5 text-xs leading-5 text-slate-300">二维码为私密入群凭证。请勿转发；即使二维码被转发，管理员也会按唯一入群 ID 核验成员身份。</p>
                  </section>
                )}

                <button onClick={() => { setAnswers(Array(8).fill(null)); setGoal(null); setQuestionIndex(0); setStage('questions'); }} className="w-full text-sm font-semibold text-slate-300 transition hover:text-cyan-200">重新进行测评</button>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

export default AIAssessment;
