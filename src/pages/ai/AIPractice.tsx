import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileCheck2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { aiLearningService } from '../../features/aiLearning/service';
import type { LearningStepDetail, ProjectFeedback } from '../../features/aiLearning/types';
import AILayout from './AILayout';
import LearningMarkdown from './LearningMarkdown';

const AIPractice: React.FC = () => {
  const [detail, setDetail] = useState<LearningStepDetail | null>(null);
  const [submission, setSubmission] = useState('');
  const [url, setUrl] = useState('');
  const [feedback, setFeedback] = useState<ProjectFeedback | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void aiLearningService.step('AI7-S7').then(setDetail).catch((caught) => setError(caught instanceof Error ? caught.message : '任务加载失败')); }, []);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const output = await aiLearningService.submitProject(submission, url);
      setFeedback(output.feedback); setSource(output.feedback_source);
    } catch (caught) { setError(caught instanceof Error ? caught.message : '作品提交失败'); }
    finally { setBusy(false); }
  };

  return (
    <AILayout>
      <main className="ai-learning-page">
        <div className="ai-learning-reader ai-learning-reader-wide">
          <Link to="/ai/roadmap" className="ai-learning-back"><ArrowLeft size={16} /> 返回学习地图</Link>
          {error ? <div className="ai-learning-alert is-error">{error}</div> : null}
          {!detail ? <div className="ai-learning-panel">正在载入F01材料…</div> : (
            <>
              <article className="ai-learning-content-card"><div className="ai-learning-content-meta">DAY 7 · F01-LITE · 真实作品</div><h1>{detail.step.unit.title}</h1><LearningMarkdown value={detail.step.unit.body_markdown} /><div className="ai-learning-materials"><h2>考生材料</h2>{detail.step.unit.metadata.materials?.map((material) => <details key={material.name}><summary>{material.name}</summary><p>{material.content}</p></details>)}</div></article>
              <article className="ai-learning-content-card"><h2><FileCheck2 size={22} /> 提交你的完整作品</h2><p className="ai-learning-summary">建议使用Markdown小标题区分任务理解、初稿、终稿、验收清单和变更记录。</p><textarea className="ai-learning-project-editor" value={submission} onChange={(event) => setSubmission(event.target.value)} placeholder="在这里粘贴完整作品（300—12000字）…" /><input className="ai-learning-url-input" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="可选：作品链接" /><button type="button" className="ai-demo-primary-button" disabled={busy} onClick={() => void submit()}>{busy ? '正在生成反馈…' : '提交作品并获得反馈'}</button></article>
              {feedback ? <article className="ai-learning-feedback-card" role="status"><div className="ai-learning-feedback-score"><strong>{feedback.total_score}</strong><span>/ 100</span></div><div><small>{source === 'llm' ? 'AI教练反馈' : '规则反馈（模型暂不可用）'}</small><h2>{feedback.overview}</h2><div className="ai-learning-feedback-columns"><section><h3>做得好的地方</h3><ul>{feedback.strengths.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h3>下一轮改进</h3><ul>{feedback.improvements.map((item) => <li key={item}>{item}</li>)}</ul></section></div><p><CheckCircle2 size={16} /> 下一步：{feedback.next_action}</p><Link className="ai-demo-primary-button" to="/ai/learn/AI7-S8">完成掌握检查</Link></div></article> : null}
            </>
          )}
        </div>
      </main>
    </AILayout>
  );
};

export default AIPractice;
