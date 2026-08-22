import React from 'react';
import { Check, ChevronRight, Clock3, Compass, LockKeyhole, Map, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLearningDashboard } from '../../features/aiLearning/useLearningDashboard';
import AILayout from './AILayout';

const AIRoadmap: React.FC = () => {
  const { data, error, loading } = useLearningDashboard();
  return (
    <AILayout>
      <main className="ai-learning-page">
        <div className="ai-demo-container">
          <div className="ai-learning-page-head"><span>MY AI ROADMAP</span><h1>从当前位置，到真正能做成事。</h1><p>先完成一条可执行的7天路径，再沿Level 0—4课程地图补齐能力；专项卷用于确认每个模块是否真的掌握。</p></div>
          {loading ? <div className="ai-learning-panel">正在加载成长路线…</div> : error ? <div className="ai-learning-alert is-error">{error}</div> : <>
            <section className="ai-route-library">
              <div className="ai-hub-section-title"><div><span><Map /> 五阶段课程地图</span><h2>完整成长路径，不只是一张7天清单</h2></div><p>高亮阶段来自你的综合能力卷。Level 5在这里使用Level 4组织路线继续积累真实证据。</p></div>
              <div className="ai-route-levels">{data?.route_library.map((route) => <article key={route.level} className={route.recommended ? 'is-recommended' : ''}><header><span>LEVEL {route.level}</span>{route.recommended ? <strong><Target /> 当前建议</strong> : null}</header><h3>{route.title}</h3><small>{route.group_code === 'beginner' ? '起步阶段' : route.group_code === 'application' ? '应用阶段' : '进阶阶段'} · {route.modules.length}个模块</small><div>{route.modules.map((module) => <span key={module.code} title={module.learning_outcome}>{module.code} · {module.title}</span>)}</div></article>)}</div>
            </section>

            <section className="ai-actionable-path">
              <div className="ai-hub-section-title"><div><span><Compass /> 当前可执行路径</span><h2>{data?.path.title}</h2></div><p>{data?.path.summary}</p></div>
              {!data?.path.enrolled ? <div className="ai-learning-panel"><h2>尚未领取7天启动路径</h2><p>先完成综合能力卷并登录正式账号，即可保存学习进度。你仍可在考试大厅免费完成A—F专项卷。</p><div className="ai-result-actions"><Link className="ai-demo-primary-button" to="/ai">前往成长总览</Link><Link className="ai-demo-secondary-button" to="/ai/exams">先做专项卷</Link></div></div> : <div className="ai-learning-roadmap-list">{data.path.steps.map((step) => { const target = step.step_type === 'project' ? '/ai/practice' : `/ai/learn/${step.id}`; return <article key={step.id} className={`ai-learning-roadmap-item ${step.status === 'completed' ? 'is-complete' : ''} ${step.locked ? 'is-locked' : ''}`}><div className="ai-learning-day">DAY {step.day_no}</div><div className="ai-learning-status-icon">{step.status === 'completed' ? <Check /> : step.locked ? <LockKeyhole /> : <ChevronRight />}</div><div className="ai-learning-roadmap-copy"><small>{step.module_code} · {step.step_type}</small><h2>{step.title}</h2><p>{step.summary}</p><span><Clock3 size={14} /> {step.estimated_minutes}分钟</span></div>{!step.locked ? <Link to={target} className="ai-demo-secondary-button">{step.status === 'completed' ? '复习' : '开始'}</Link> : null}</article>; })}</div>}
            </section>
          </>}
        </div>
      </main>
    </AILayout>
  );
};

export default AIRoadmap;
