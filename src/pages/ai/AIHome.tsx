import React, { useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, FileCheck2, Route, Target } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { aiLearningService } from '../../features/aiLearning/service';
import { useLearningDashboard } from '../../features/aiLearning/useLearningDashboard';
import AILayout from './AILayout';
import '../../features/aiMiracles/miracles.css';

const labels: Record<string, string> = {
  M: 'AI心智模型', F: '任务定义', T: '工具信息', V: '核验安全', C: '创造执行', S: '系统思维',
};

const AIHome: React.FC = () => {
  const { data, error, loading, refresh } = useLearningDashboard();
  const [enrolling, setEnrolling] = useState(false);
  const navigate = useNavigate();

  const startPath = async () => {
    if (!data) return;
    if (data.needs_assessment) { navigate('/ai/assessment'); return; }
    if (!data.account.can_enroll) { navigate('/login'); return; }
    if (!data.path.enrolled) {
      setEnrolling(true);
      try { await aiLearningService.enroll(); await refresh(); }
      finally { setEnrolling(false); }
    }
    navigate('/ai/roadmap');
  };

  const currentStep = data?.path.steps.find((step) => step.status !== 'completed' && !step.locked);
  const total = data?.path.steps.length || 0;
  const completed = data?.path.completed_count || 0;
  return <AILayout>
    <div className="redesign-learning">
      <header className="page-heading"><div><h1>AI 学习</h1><p>从一次测评，走到一个作品。</p></div><Link to="/ai/exams" className="jw-action secondary">考试大厅 <ArrowRight /></Link></header>
      <Link to="/ai/miracles" className="miracles-entry"><div><span className="miracles-entry-kicker"><BookOpen size={18} aria-hidden="true" />AI 创造的奇迹</span><h2>AI 已经帮人类做成了什么？</h2><p>探索真实案例、原始来源和研究边界。从一个问题，认识 AI 的可能。</p></div><ArrowRight aria-hidden="true" /></Link>
      {error && <div className="ai-learning-alert is-error" role="status">{error}</div>}
      <div className="learning-overview">
        <section className="learning-progress-panel"><span className="learning-panel-label">我的学习</span>
          {loading ? <p role="status" className="py-10">正在读取学习进度…</p> : data?.assessment ? <><div className="learning-level">L{data.assessment.ability_level}</div><h2>{data.assessment.level_title}</h2><p>已完成 {completed} / {total} 个学习步骤</p><progress aria-label="学习路径进度" value={completed} max={total || 1} /><div className="learning-dimensions">{Object.entries(data.assessment.dimension_scores).map(([key,value]) => <div key={key}><span>{labels[key]}</span><strong>{Math.round(value || 0)}</strong></div>)}</div></> : <><Target size={58} /><h2>从这里开始</h2><p>完成测评，找到适合你的学习路径。</p></>}
          <button type="button" className="jw-action" disabled={loading || enrolling || !data} onClick={() => void startPath()}>{enrolling ? '正在领取路径…' : data?.needs_assessment ? '开始 AI 测评' : data?.path.enrolled ? '继续学习' : '领取学习路径'}<ArrowRight /></button>
        </section>
        <section className="learning-next"><span className="learning-panel-label">接下来</span><h2>{currentStep?.title || data?.recommendation?.lesson.title || '先了解自己，再开始学习。'}</h2><p>{currentStep ? currentStep.summary : '测评定位能力，学习解决问题，作品记录进步。'}</p>
          {currentStep && <div className="learning-step-meta">约 {currentStep.estimated_minutes} 分钟 · 第 {currentStep.day_no} 天</div>}
          <div className="learning-next-links"><Link to="/ai/roadmap"><Route /><span>学习路径</span><ArrowRight /></Link><Link to="/ai/projects"><FileCheck2 /><span>作品档案</span><ArrowRight /></Link><Link to="/ai/exams"><CheckCircle2 /><span>测评与专项练习</span><ArrowRight /></Link></div>
        </section>
      </div>
    </div>
  </AILayout>;
};
export default AIHome;
