import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { aiLearningService } from '../../features/aiLearning/service';
import type { LearningStepDetail } from '../../features/aiLearning/types';
import AILayout from './AILayout';
import LearningMarkdown from './LearningMarkdown';

const AILearn: React.FC = () => {
  const { stepId = '' } = useParams();
  const [detail, setDetail] = useState<LearningStepDetail | null>(null);
  const [response, setResponse] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setError(null); setDetail(null); setResult(null);
    void aiLearningService.step(stepId).then(setDetail).catch((caught) => setError(caught instanceof Error ? caught.message : '步骤加载失败'));
  }, [stepId]);

  const submit = async () => {
    if (!detail) return;
    setBusy(true); setError(null);
    try {
      if (detail.step.step_type === 'mastery_check') {
        const output = await aiLearningService.submitMastery(Object.entries(answers).map(([item_id, value]) => ({ item_id, value })));
        setResult(`${output.result.label} · ${output.mastery_score}分。${output.result.note}`);
      } else {
        await aiLearningService.completeStep(detail.step.id, response);
        navigate('/ai/roadmap');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '提交失败');
    } finally { setBusy(false); }
  };

  return (
    <AILayout>
      <main className="ai-learning-page">
        <div className="ai-learning-reader">
          <Link to="/ai/roadmap" className="ai-learning-back"><ArrowLeft size={16} /> 返回学习地图</Link>
          {error ? <div className="ai-learning-alert is-error">{error}</div> : null}
          {!detail ? <div className="ai-learning-panel">正在载入学习内容…</div> : (
            <article className="ai-learning-content-card">
              <div className="ai-learning-content-meta">DAY {detail.step.day_no} · {detail.step.unit.module_code} · {detail.step.unit.estimated_minutes}分钟</div>
              <h1>{detail.step.unit.title}</h1><p className="ai-learning-summary">{detail.step.unit.summary}</p>
              <LearningMarkdown value={detail.step.unit.body_markdown} />
              {detail.step.step_type === 'mastery_check' ? (
                <div className="ai-learning-quiz">
                  {detail.step.config.questions?.map((question, index) => (
                    <fieldset key={question.id}><legend>{index + 1}. {question.prompt}</legend>{question.options.map((option) => <label key={option.id}><input type="radio" name={question.id} value={option.id} checked={answers[question.id] === option.id} onChange={() => setAnswers((value) => ({ ...value, [question.id]: option.id }))} />{option.text}</label>)}</fieldset>
                  ))}
                </div>
              ) : (
                <div className="ai-learning-response"><label htmlFor="learning-response">{detail.step.unit.metadata.response_prompt || '留下今天的学习证据'}</label><textarea id="learning-response" value={response} onChange={(event) => setResponse(event.target.value)} placeholder="写下你的判断、练习或修改结果…" /></div>
              )}
              {detail.preview ? <div className="ai-learning-alert">这是游客预览。登录后领取路径，才能保存进度。</div> : null}
              {result ? <div className="ai-learning-success" role="status"><CheckCircle2 /> <div><strong>路径已完成</strong><p>{result}</p></div></div> : (
                <button type="button" className="ai-demo-primary-button" disabled={busy || detail.preview} onClick={() => void submit()}>{busy ? '正在提交…' : detail.step.step_type === 'mastery_check' ? '提交掌握检查' : '完成并解锁下一步'} <ArrowRight size={17} /></button>
              )}
            </article>
          )}
        </div>
      </main>
    </AILayout>
  );
};

export default AILearn;
