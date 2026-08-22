import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Download, FileCheck2, Flag, ListChecks } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { aiExamService } from '../../features/aiExams/service';
import type { SpecialtyExamItem, SpecialtyExamResult, SpecialtyExamSession } from '../../features/aiExams/types';
import AILayout from './AILayout';

type AnswerValue = string | string[];

const answerText = (value: unknown) => Array.isArray(value) ? value.join('、') : String(value ?? '');

const AISpecialtyExam: React.FC = () => {
  const { sessionId = '', paperCode = '' } = useParams();
  const [session, setSession] = useState<SpecialtyExamSession | null>(null);
  const [materialUrl, setMaterialUrl] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<SpecialtyExamResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setError(null);
    void aiExamService.session(sessionId).then((payload) => {
      setSession(payload.session); setMaterialUrl(payload.material_url);
      if (payload.session.status === 'completed' && payload.session.result) setResult(payload.session.result);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : '考试加载失败'));
  }, [sessionId]);

  const items = useMemo(() => session?.presentation.items || [], [session]);
  const task = session?.presentation.task;
  const current = items[index];
  const answeredCount = useMemo(() => items.filter((item) => Object.prototype.hasOwnProperty.call(answers, item.id)).length, [answers, items]);

  const setAnswer = (itemId: string, value: AnswerValue) => setAnswers((state) => ({ ...state, [itemId]: value }));
  const toggleMulti = (itemId: string, option: string) => {
    const value = Array.isArray(answers[itemId]) ? answers[itemId] as string[] : [];
    setAnswer(itemId, value.includes(option) ? value.filter((entry) => entry !== option) : [...value, option]);
  };

  const submit = async () => {
    if (!session) return;
    setBusy(true); setError(null);
    try {
      const responses = session.paper_code === 'F'
        ? [{ item_id: task?.id || session.presentation.task?.id || '', value: String(answers[task?.id || ''] || '') }]
        : items.map((item) => ({ item_id: item.id, value: answers[item.id] }));
      const output = await aiExamService.submit(session.id, responses);
      setSession(output.session); setResult(output.result); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (caught) { setError(caught instanceof Error ? caught.message : '交卷失败'); }
    finally { setBusy(false); }
  };

  const renderQuestion = (item: SpecialtyExamItem) => {
    if (item.item_type === 'choice') return <div className="ai-specialty-options">{item.options?.map((option) => <label key={option.id} className={answers[item.id] === option.id ? 'is-selected' : ''}><input type="radio" name={item.id} checked={answers[item.id] === option.id} onChange={() => setAnswer(item.id, option.id)} /><strong>{option.id}</strong><span>{option.text}</span></label>)}</div>;
    if (item.item_type === 'multi_select') return <div className="ai-specialty-options">{item.options?.map((option) => { const selected = Array.isArray(answers[item.id]) && (answers[item.id] as string[]).includes(option.id); return <label key={option.id} className={selected ? 'is-selected' : ''}><input type="checkbox" checked={selected} onChange={() => toggleMulti(item.id, option.id)} /><strong>{option.id}</strong><span>{option.text}</span></label>; })}</div>;
    if (item.item_type === 'ordering') return <div className="ai-ordering-answer"><div className="ai-ordering-source">{item.options?.map((option) => <span key={option.id}><strong>{option.id}</strong>{option.text}</span>)}</div><label>按顺序填写字母，例如 B,E,C,A,D<input value={typeof answers[item.id] === 'string' ? answers[item.id] as string : ''} onChange={(event) => setAnswer(item.id, event.target.value.toUpperCase())} placeholder="输入你的顺序" /></label></div>;
    return <label className="ai-open-answer"><span>开放题：写出你的判断、理由和验证动作</span><textarea value={typeof answers[item.id] === 'string' ? answers[item.id] as string : ''} onChange={(event) => setAnswer(item.id, event.target.value)} placeholder="不奖励堆字数，更看重结构、证据和行动。" /></label>;
  };

  if (error && !session) return <AILayout><main className="ai-hub-page"><div className="ai-learning-alert is-error">{error}</div></main></AILayout>;
  if (!session) return <AILayout><main className="ai-hub-page"><div className="ai-learning-panel">正在打开卷子…</div></main></AILayout>;

  return (
    <AILayout>
      <main className="ai-hub-page ai-exam-runner-page">
        <Link to={`/ai/exams/${paperCode}`} className="ai-learning-back"><ArrowLeft /> 返回{session.paper_code}卷说明</Link>
        {error ? <div className="ai-learning-alert is-error">{error}</div> : null}

        {result ? (
          <section className="ai-specialty-result">
            <div className={`ai-specialty-result-hero paper-${session.paper_code.toLowerCase()}`}><span>{session.paper_code}卷 · {session.mode === 'full' ? '完整卷' : session.mode === 'standard' ? '标准卷' : '实战任务'}</span><h1>{result.label || task?.title || `${session.paper_code}卷结果`}</h1><div><strong>{result.percent ?? result.score ?? 0}</strong><small>/ 100</small></div><p>专项练习结果不会改变正式Level和群权益，但会进入你的学习诊断记录。</p></div>
            {result.feedback ? <article className="ai-practical-feedback"><FileCheck2 /><div><small>{result.feedback.source === 'llm' ? 'AI量规反馈' : '规则反馈'}</small><h2>{result.feedback.overview}</h2><div><section><h3>做得好的地方</h3><ul>{result.feedback.strengths.map((entry) => <li key={entry}>{entry}</li>)}</ul></section><section><h3>下一轮改进</h3><ul>{result.feedback.improvements.map((entry) => <li key={entry}>{entry}</li>)}</ul></section></div><p><Flag /> 下一步：{result.feedback.next_action}</p></div></article> : null}
            {result.reviews?.length ? <div className="ai-specialty-review-list"><div className="ai-hub-section-title"><div><span><ListChecks /> 逐题复盘</span><h2>答案、解析与开放题自评</h2></div><p>客观题计入上方分数；开放题展示量规，暂不冒充精确机器评分。</p></div>{result.reviews.map((review, reviewIndex) => <details key={review.item_id}><summary><span>{reviewIndex + 1}. {review.prompt}</span><strong>{review.score === null ? '开放题自评' : `${review.score}/${review.max_score}`}</strong></summary><div><p><b>你的答案：</b>{answerText(review.user_answer)}</p>{review.standard_answer ? <p><b>标准答案：</b>{review.standard_answer}</p> : null}<p><b>解析：</b>{review.rationale}</p>{review.reference_answer ? <p><b>参考方向：</b>{review.reference_answer}</p> : null}{review.rubric ? <pre>{review.rubric}</pre> : null}</div></details>)}</div> : null}
            <div className="ai-result-actions"><Link to={`/ai/exams/${session.paper_code.toLowerCase()}`} className="ai-demo-primary-button">再做一套</Link><Link to="/ai/exams" className="ai-demo-secondary-button">返回考试大厅</Link></div>
          </section>
        ) : session.paper_code === 'F' && task ? (
          <section className="ai-practical-runner">
            <div className="ai-practical-runner-head"><span>{task.id} · F卷真实任务</span><h1>{task.title}</h1><p>{task.summary}</p></div>
            <div className="ai-practical-runner-grid"><article><h2>本次需要交付</h2><ul>{task.deliverables.map((entry) => <li key={entry}><CheckCircle2 />{entry}</li>)}</ul>{materialUrl ? <a href={materialUrl} target="_blank" rel="noreferrer"><Download /> 下载完整考生材料包（1小时有效）</a> : task.id !== 'F10' ? <p className="ai-learning-alert">材料地址生成失败，请刷新重试。</p> : null}</article><label><span>粘贴或整理你的最终提交</span><textarea value={String(answers[task.id] || '')} onChange={(event) => setAnswer(task.id, event.target.value)} placeholder="至少300字。请包含交付物、核验、自检、修改和未完成项；不要提交真实密钥或个人敏感信息。" /><small>{String(answers[task.id] || '').length} / 至少300字</small><button type="button" disabled={busy || String(answers[task.id] || '').trim().length < 300} onClick={() => void submit()}>{busy ? '正在按量规分析…' : '提交实战作品'} <ArrowRight /></button></label></div>
          </section>
        ) : current ? (
          <section className="ai-specialty-runner">
            <header><div><span>{session.paper_code}卷 · {session.mode === 'full' ? '完整卷' : '标准卷'}</span><h1>{session.presentation.paper.title}</h1></div><div><strong>{index + 1}</strong> / {items.length}</div></header>
            <div className="ai-specialty-progress"><span style={{ width: `${(index + 1) / items.length * 100}%` }} /></div>
            <article><div className="ai-question-meta"><span>{current.unit_code} · {current.unit_title}</span><span>{current.item_type === 'choice' ? '单选题' : current.item_type === 'multi_select' ? '多选题' : current.item_type === 'ordering' ? '排序题' : '开放题'}</span></div><h2>{current.prompt}</h2>{current.code ? <pre><code>{current.code}</code></pre> : null}{renderQuestion(current)}<button type="button" className="ai-skip-question" onClick={() => setAnswer(current.id, '暂时不会')}>这题暂时不会，保留真实水平</button></article>
            <footer><button type="button" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}><ArrowLeft /> 上一题</button><span>已答 {answeredCount}/{items.length}</span>{index < items.length - 1 ? <button type="button" onClick={() => setIndex((value) => Math.min(items.length - 1, value + 1))}>下一题 <ArrowRight /></button> : <button type="button" className="is-submit" disabled={busy || answeredCount !== items.length} onClick={() => void submit()}>{busy ? '正在阅卷…' : '交卷并看解析'} <FileCheck2 /></button>}</footer>
          </section>
        ) : <div className="ai-learning-panel">卷子内容为空，请重新领取。</div>}
      </main>
    </AILayout>
  );
};

export default AISpecialtyExam;
