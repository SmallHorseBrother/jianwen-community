import React, { useState } from 'react';
import { BrainCircuit, Menu, X } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';

const navigation = [
  { to: '/ai', label: '成长总览', end: true },
  { to: '/ai/exams', label: '考试大厅' },
  { to: '/ai/roadmap', label: '学习路径' },
  { to: '/ai/projects', label: '作品档案' },
];

const AILayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    <Layout>
      <div className="ai-hub-shell">
        <header className="ai-hub-subnav">
          <Link to="/ai" className="ai-demo-brand" aria-label="AI成长中心首页">
            <span className="ai-demo-brand-mark"><BrainCircuit size={22} strokeWidth={2.3} /></span>
            <span><strong>AI 成长中心</strong><small>测评 · 学习 · 实战 · 复测</small></span>
          </Link>
          <nav className="ai-hub-subnav-links" aria-label="AI成长中心导航">
            {navigation.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => isActive ? 'is-active' : undefined}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ai-hub-subnav-actions">
            <span className="ai-demo-pill">Beta</span>
            <button type="button" className="ai-demo-menu-button" aria-label={open ? '关闭导航' : '打开导航'} onClick={() => setOpen(!open)}>
              {open ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </header>
        {open && (
          <nav className="ai-hub-mobile-nav" aria-label="AI成长中心移动端导航">
            {navigation.map((item) => <Link key={item.to} to={item.to} onClick={() => setOpen(false)}>{item.label}</Link>)}
          </nav>
        )}
        {children}
      </div>
    </Layout>
  );
};

export default AILayout;
