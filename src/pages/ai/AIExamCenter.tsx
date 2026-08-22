import React from 'react';
import { ArrowRight, BrainCircuit, CheckCircle2, ClipboardCheck, FlaskConical, Layers3, Palette, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useExamCatalog } from '../../features/aiExams/useExamCatalog';
import AILayout from './AILayout';

const AIExamCenter: React.FC = () => {
  const { data, loading, error } = useExamCatalog();
  return (
    <AILayout>
      <main className="ai-hub-page">
        <section className="ai-hub-heading">
          <span>AI EXAM HALL · BETA</span>
          <h1>一套综合摸底，六套专项卷。</h1>
          <p>综合卷回答“你目前在哪”；A—F专项卷回答“具体哪里会、哪里还不会”。题做得越多，学习建议越具体。</p>
        </section>

        {error ? <div className="ai-learning-alert is-error">{error}</div> : null}
        <section className="ai-exam-system-map" aria-label="考试体系说明">
          <article><BrainCircuit /><div><small>正式学习基线</small><h2>综合能力摸底卷</h2><p>32题，免费。输出Level 0—5、六维分数与学习路径。</p><Link to="/ai/exams/comprehensive">进入综合卷 <ArrowRight /></Link></div></article>
          <article><Palette /><div><small>不评价高低</small><h2>AI使用风格画像</h2><p>36题，免费。识别你探索、创造、推理与协作的偏好。</p><Link to="/ai/exams/comprehensive">进入风格卷 <ArrowRight /></Link></div></article>
          <article className="is-wide"><Layers3 /><div><small>专项练习体系</small><h2>A—F 六套卷，共261道题与任务</h2><p>专项成绩用于学习诊断，不直接修改正式Level、群分流和已购权益。</p></div></article>
        </section>

        <section className="ai-exam-paper-section">
          <div className="ai-hub-section-title"><div><span><ClipboardCheck /> 专项卷目录</span><h2>把六套题真正做起来</h2></div><p>{data?.beta_notice || '正在读取题库状态…'}</p></div>
          {loading ? <div className="ai-learning-panel">正在读取六套卷子…</div> : (
            <div className="ai-exam-paper-grid">
              {data?.papers.map((paper) => (
                <article key={paper.code} className={`ai-exam-paper-card paper-${paper.code.toLowerCase()}`}>
                  <div className="ai-exam-paper-code">{paper.code}</div>
                  <div className="ai-exam-paper-body">
                    <div className="ai-exam-paper-meta"><span>{paper.item_count}{paper.code === 'F' ? '项任务' : '道专项题'}</span><span>免费Beta</span></div>
                    <h3>{paper.title}</h3><p>{paper.short}</p>
                    <div className="ai-exam-mode-row">{paper.modes.map((mode) => <span key={mode.id}>{mode.label} · {mode.count}</span>)}</div>
                    <div className="ai-exam-paper-foot"><span>{paper.completed_attempts ? <><CheckCircle2 /> 已完成{paper.completed_attempts}次</> : <><FlaskConical /> 尚未作答</>}</span><Link to={`/ai/exams/${paper.code.toLowerCase()}`}>查看卷子 <ArrowRight /></Link></div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="ai-exam-beta-note"><ShieldCheck /><div><strong>专项卷怎样使用？</strong><p>专项卷用于发现具体知识与实战短板，完成后会给出针对性的复习建议。正式Level仍以综合能力摸底卷为准。</p></div></aside>
      </main>
    </AILayout>
  );
};

export default AIExamCenter;
