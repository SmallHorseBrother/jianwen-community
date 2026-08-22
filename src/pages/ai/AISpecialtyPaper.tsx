import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Download, FileText, Layers3 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { aiExamService } from '../../features/aiExams/service';
import type { SpecialtyExamMode, SpecialtyPaperCode } from '../../features/aiExams/types';
import { useExamCatalog } from '../../features/aiExams/useExamCatalog';
import AILayout from './AILayout';

const validCodes = new Set(['A', 'B', 'C', 'D', 'E', 'F']);

const AISpecialtyPaper: React.FC = () => {
  const code = String(useParams().paperCode || '').toUpperCase() as SpecialtyPaperCode;
  const { data, loading, error } = useExamCatalog();
  const [busy, setBusy] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const navigate = useNavigate();
  const paper = data?.papers.find((entry) => entry.code === code);

  if (!validCodes.has(code)) return <AILayout><main className="ai-hub-page"><div className="ai-learning-panel">没有这套卷子。</div></main></AILayout>;

  const start = async (mode: SpecialtyExamMode, taskId?: string) => {
    setBusy(taskId || mode); setStartError(null);
    try {
      const session = await aiExamService.start(code, mode, taskId);
      navigate(`/ai/exams/${code.toLowerCase()}/session/${session.id}`);
    } catch (caught) {
      setStartError(caught instanceof Error ? caught.message : '暂时无法领取卷子');
    } finally { setBusy(null); }
  };

  return (
    <AILayout>
      <main className="ai-hub-page">
        <Link to="/ai/exams" className="ai-learning-back"><ArrowLeft /> 返回考试大厅</Link>
        {loading ? <div className="ai-learning-panel">正在读取卷子…</div> : error || !paper ? <div className="ai-learning-alert is-error">{error || '卷子不存在'}</div> : (
          <>
            <section className={`ai-paper-hero paper-${code.toLowerCase()}`}>
              <div className="ai-paper-hero-code">{code}</div><div><span>AI SPECIALTY PAPER · PRACTICE BETA</span><h1>{paper.title}</h1><p>{paper.short}</p><div><strong>{paper.item_count}</strong>{code === 'F' ? '项真实任务' : '道完整专项题'} · 免费开放 · 不改变正式Level</div></div>
            </section>
            {startError ? <div className="ai-learning-alert is-error">{startError}</div> : null}
            {code === 'F' ? (
              <section className="ai-practical-task-list">
                <div className="ai-hub-section-title"><div><span><Layers3 /> 实战任务包</span><h2>一次完成一项，逐步建立作品证据</h2></div><p>开始任务后可下载完整考生材料包；内部评分参考不会发送到浏览器。</p></div>
                {data?.f_tasks.map((task) => <article key={task.id}><div className="ai-task-index">{task.id}</div><div><h3>{task.title}</h3><p>{task.summary}</p><div>{task.deliverables.map((item) => <span key={item}>{item}</span>)}</div></div><button type="button" disabled={Boolean(busy)} onClick={() => void start('practical', task.id)}>{task.completed ? <CheckCircle2 /> : <Download />}{busy === task.id ? '正在领取…' : task.completed ? '再次挑战' : '领取任务'}</button></article>)}
              </section>
            ) : (
              <section className="ai-exam-mode-grid">
                <article><FileText /><small>推荐第一次作答</small><h2>标准卷 · 25题</h2><p>覆盖全部知识单元和四种题型；每次抽取不同选择题，适合40—55分钟完成。</p><ul><li>13道选择题</li><li>5道多选题</li><li>2道排序题</li><li>5道开放题</li></ul><button type="button" disabled={Boolean(busy)} onClick={() => void start('standard')}>{busy === 'standard' ? '正在组卷…' : '开始标准卷'} <ArrowRight /></button></article>
                <article className="is-full"><Layers3 /><small>题库完整挑战</small><h2>完整卷 · 50题</h2><p>一次完成本卷全部题目，适合系统复习、课程前后测或希望多做题的人。</p><ul><li>38道选择题</li><li>5道多选题</li><li>2道排序题</li><li>5道开放题</li></ul><button type="button" disabled={Boolean(busy)} onClick={() => void start('full')}>{busy === 'full' ? '正在组卷…' : '挑战完整卷'} <ArrowRight /></button></article>
              </section>
            )}
            <div className="ai-paper-history-note"><Clock3 /><span>本卷已完成 <strong>{paper.completed_attempts}</strong> 次。每次作答都会保留新的练习记录，不覆盖正式综合卷结果。</span></div>
          </>
        )}
      </main>
    </AILayout>
  );
};

export default AISpecialtyPaper;
