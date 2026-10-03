import React from 'react';
import { BrainCircuit } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';

const navigation = [
  { to: '/ai', label: '学习总览', end: true },
  { to: '/ai/exams', label: '考试大厅' },
  { to: '/ai/roadmap', label: '学习路径' },
  { to: '/ai/projects', label: '作品档案' },
];

const AILayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <Layout>
      <div className="ai-hub-shell">
        <header className="ai-hub-subnav">
          <Link to="/ai" className="ai-demo-brand" aria-label="AI学习首页">
            <span className="ai-demo-brand-mark"><BrainCircuit size={22} strokeWidth={2.3} /></span>
            <span><strong>AI 学习</strong></span>
          </Link>
          <nav className="ai-hub-subnav-links" aria-label="AI学习导航">
            {navigation.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => isActive ? 'is-active' : undefined}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>
        {children}
      </div>
    </Layout>
  );
};

export default AILayout;
