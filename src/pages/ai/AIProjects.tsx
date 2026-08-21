import React, { useEffect, useState } from 'react';
import { FileCheck2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { aiLearningService } from '../../features/aiLearning/service';
import type { LearningProject } from '../../features/aiLearning/types';
import AILayout from './AILayout';

const AIProjects: React.FC = () => {
  const [projects, setProjects] = useState<LearningProject[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void aiLearningService.projects().then((value) => setProjects(value.projects)).catch((caught) => setError(caught instanceof Error ? caught.message : '作品加载失败')); }, []);
  return (
    <AILayout><main className="ai-learning-page"><div className="ai-demo-container"><div className="ai-learning-page-head"><span>PORTFOLIO</span><h1>我的AI作品档案</h1><p>等级是一张快照，作品才是你真正能做成什么的证据。</p></div>{error ? <div className="ai-learning-alert is-error">{error}</div> : null}{projects.length ? <div className="ai-learning-project-list">{projects.map((project) => <article key={project.id}><FileCheck2 /><div><small>{project.task_code} · {new Date(project.submitted_at).toLocaleDateString('zh-CN')}</small><h2>第一个可验收AI交付物</h2><p>{project.feedback_summary}</p><span>{project.feedback?.feedback_payload.total_score ?? '—'}分 · {project.status}</span></div></article>)}</div> : <div className="ai-learning-panel"><h2>还没有作品</h2><p>完成7天路径中的F01任务后，作品会出现在这里。</p><Link className="ai-demo-primary-button" to="/ai/roadmap">查看学习地图</Link></div>}</div></main></AILayout>
  );
};

export default AIProjects;
