import React from 'react';
import { Check, ChevronRight, Clock3, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLearningDashboard } from '../../features/aiLearning/useLearningDashboard';
import AILayout from './AILayout';

const AIRoadmap: React.FC = () => {
  const { data, error, loading } = useLearningDashboard();
  return (
    <AILayout>
      <main className="ai-learning-page">
        <div className="ai-demo-container">
          <div className="ai-learning-page-head"><span>MY ROADMAP</span><h1>我的7天学习地图</h1><p>完成一个步骤，才解锁下一步；每一步都留下可复核证据。</p></div>
          {loading ? <div className="ai-learning-panel">正在加载学习地图…</div> : error ? <div className="ai-learning-alert is-error">{error}</div> : !data?.path.enrolled ? (
            <div className="ai-learning-panel"><h2>尚未领取路径</h2><p>从学习首页领取免费路径；游客需先登录正式账号。</p><Link className="ai-demo-primary-button" to="/ai">返回学习首页</Link></div>
          ) : (
            <div className="ai-learning-roadmap-list">
              {data.path.steps.map((step) => {
                const target = step.step_type === 'project' ? '/ai/practice' : `/ai/learn/${step.id}`;
                return (
                  <article key={step.id} className={`ai-learning-roadmap-item ${step.status === 'completed' ? 'is-complete' : ''} ${step.locked ? 'is-locked' : ''}`}>
                    <div className="ai-learning-day">DAY {step.day_no}</div>
                    <div className="ai-learning-status-icon">{step.status === 'completed' ? <Check /> : step.locked ? <LockKeyhole /> : <ChevronRight />}</div>
                    <div className="ai-learning-roadmap-copy"><small>{step.module_code} · {step.step_type}</small><h2>{step.title}</h2><p>{step.summary}</p><span><Clock3 size={14} /> {step.estimated_minutes}分钟</span></div>
                    {!step.locked ? <Link to={target} className="ai-demo-secondary-button">{step.status === 'completed' ? '复习' : '开始'}</Link> : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </AILayout>
  );
};

export default AIRoadmap;
