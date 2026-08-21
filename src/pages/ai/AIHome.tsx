import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, FileCheck2, Route, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { aiLearningService } from '../../features/aiLearning/service';
import { useLearningDashboard } from '../../features/aiLearning/useLearningDashboard';
import AILayout from './AILayout';

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

  return (
    <AILayout>
      <main>
        <section className="ai-demo-hero">
          <div className="ai-demo-container ai-demo-hero-grid">
            <div className="ai-demo-hero-copy">
              <div className="ai-demo-eyebrow"><span /> 测评结果已经接入学习路径</div>
              <h1>不只是测出水平，<br /><em>更要真正学会。</em></h1>
              <p className="ai-demo-lead">根据你的真实测评短板，只推荐一个必补能力、一节核心内容和一个能留下证据的作品任务。</p>
              {error ? <div className="ai-learning-alert is-error">{error}</div> : null}
              <div className="ai-demo-hero-actions">
                <button type="button" className="ai-demo-primary-button" disabled={loading || enrolling} onClick={() => void startPath()}>
                  {loading ? '正在读取测评…' : enrolling ? '正在领取路径…' : data?.needs_assessment ? '先完成AI测评' : data?.path.enrolled ? '继续我的学习路径' : '领取免费7天路径'} <ArrowRight size={18} />
                </button>
                <Link to="/ai/assessment" className="ai-demo-secondary-button">查看或重新测评</Link>
              </div>
              <div className="ai-demo-proof-row">
                <span><CheckCircle2 size={16} /> 真实测评定位</span>
                <span><CheckCircle2 size={16} /> F01作品反馈</span>
                <span><CheckCircle2 size={16} /> 路径掌握检查</span>
              </div>
            </div>

            <div className="ai-demo-report-card" aria-label="AI能力报告摘要">
              {loading ? <div className="ai-learning-empty">正在读取你的最近一次能力结果…</div> : data?.assessment ? (
                <>
                  <div className="ai-demo-report-topline"><span>最近一次测评 · {new Date(data.assessment.created_at).toLocaleDateString('zh-CN')}</span><Sparkles size={16} /></div>
                  <div className="ai-demo-level-row">
                    <div className="ai-demo-level-orbit"><span>L{data.assessment.ability_level}</span></div>
                    <div><small>当前AI能力等级</small><h2>{data.assessment.level_title}</h2><p>学习路线不会修改你的正式等级或群权益</p></div>
                  </div>
                  <div className="ai-demo-ability-list">
                    {Object.entries(data.assessment.dimension_scores).map(([key, value]) => (
                      <div className="ai-demo-ability" key={key}><div><span>{labels[key]}</span><strong>{Math.round(value || 0)}</strong></div><div className="ai-demo-progress-track"><span style={{ width: `${value || 0}%` }} /></div></div>
                    ))}
                  </div>
                  {data.recommendation ? <div className="ai-demo-focus-note"><ShieldCheck size={20} /><div><small>现在最值得补</small><strong>{data.recommendation.gate.label}：{data.recommendation.gate.reason}</strong></div></div> : null}
                </>
              ) : <div className="ai-learning-empty"><Target size={30} /><h2>还没有当前能力基线</h2><p>先完成免费AI能力测评，我们再给出学习路线。</p></div>}
            </div>
          </div>
        </section>

        <section className="ai-demo-section ai-demo-roadmap-section">
          <div className="ai-demo-container">
            <div className="ai-demo-section-heading"><div><span className="ai-demo-kicker"><Route size={15} /> 第一条纵向闭环</span><h2>{data?.path.title || '7天完成第一个真实AI任务'}</h2><p>{data?.path.summary || '从认识边界到提交真实作品。'}</p></div></div>
            <div className="ai-learning-three-grid">
              <article><ShieldCheck /><small>一个必补能力</small><h3>{data?.recommendation?.gate.label || '核验、安全与责任'}</h3><p>{data?.recommendation?.gate.reason || '先修复影响后续成长的基础闸门。'}</p></article>
              <article><Route /><small>一个核心内容</small><h3>{data?.recommendation?.lesson.title || '把模糊想法改成任务契约'}</h3><p>学完立即练习，不面对一整墙课程。</p></article>
              <article><FileCheck2 /><small>一个真实作品</small><h3>{data?.recommendation?.project.title || 'F01模糊需求到可验收交付物'}</h3><p>提交后获得结构化AI反馈并进入作品档案。</p></article>
            </div>
          </div>
        </section>
      </main>
    </AILayout>
  );
};

export default AIHome;
