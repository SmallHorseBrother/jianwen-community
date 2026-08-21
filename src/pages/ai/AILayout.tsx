import React, { useState } from 'react';
import { BrainCircuit, Menu, X } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import VisualAtmosphere from '../../components/Common/VisualAtmosphere';

const navigation = [
  { to: '/ai', label: '学习首页', end: true },
  { to: '/ai/assessment', label: 'AI测评' },
  { to: '/ai/roadmap', label: '学习地图' },
  { to: '/ai/projects', label: '作品档案' },
  { to: '/community', label: '学习社区' },
];

const AILayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="ai-demo-shell ai-learning-shell">
      <VisualAtmosphere tone="paper" />
      <div className="site-scroll-progress" aria-hidden="true" />
      <header className="ai-demo-header">
        <div className="ai-demo-container ai-demo-nav">
          <Link to="/ai" className="ai-demo-brand" aria-label="健问 AI 首页">
            <span className="ai-demo-brand-mark"><BrainCircuit size={22} strokeWidth={2.3} /></span>
            <span><strong>健问 AI</strong><small>从测评到真正学会</small></span>
          </Link>
          <nav className="ai-demo-nav-links" aria-label="AI学习站导航">
            {navigation.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => isActive ? 'is-active' : undefined}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ai-demo-nav-actions">
            <span className="ai-demo-pill">7天学习内测</span>
            <Link to="/login" className="ai-demo-text-button">登录</Link>
            <button type="button" className="ai-demo-menu-button" aria-label={open ? '关闭导航' : '打开导航'} onClick={() => setOpen(!open)}>
              {open ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
        {open ? (
          <nav className="ai-demo-mobile-nav" aria-label="移动端导航">
            {navigation.map((item) => <Link key={item.to} to={item.to} onClick={() => setOpen(false)}>{item.label}</Link>)}
          </nav>
        ) : null}
      </header>
      {children}
      <footer className="ai-demo-footer">
        <div className="ai-demo-container"><strong>健问 AI</strong><span>每一次成长，都留下可以复核的证据。</span></div>
      </footer>
    </div>
  );
};

export default AILayout;
