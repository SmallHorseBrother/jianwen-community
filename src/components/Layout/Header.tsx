import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  Bell,
  Bot,
  Brain,
  Home,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  User,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { checkIsAdmin } from '../../services/questionService';
import NotificationBell from './NotificationBell';

const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      setIsAdmin(user?.id ? await checkIsAdmin(user.id) : false);
    };
    void checkAdmin();
  }, [user?.id]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  const isProfileIncomplete = user ? (
    (!user.groupIdentity && !user.profession)
    || ((!user.specialties || user.specialties.length === 0)
      && (!user.fitnessInterests || user.fitnessInterests.length === 0)
      && (!user.learningInterests || user.learningInterests.length === 0))
  ) : false;

  const navItems = [
    { to: '/', label: '首页', icon: Home, activePath: '/', exact: true },
    { to: '/qa', label: '问题星球', icon: Brain, activePath: '/qa' },
    { to: '/community?tab=partners', label: '找伙伴', icon: Users, activePath: '/community', activeTab: 'partners' },
    { to: '/community?tab=moments', label: '动态', icon: Activity, activePath: '/community', activeTab: 'moments' },
    { to: '/tools', label: '实验室', icon: Wrench, activePath: '/tools' },
    { to: '/ai', label: 'AI 成长', icon: Bot, activePath: '/ai' },
    { to: '/about', label: '关于', icon: Sparkles, activePath: '/about' },
  ];

  const currentCommunityTab = new URLSearchParams(location.search).get('tab') || 'moments';
  const isNavActive = (item: typeof navItems[number]) => {
    if (item.exact) return location.pathname === item.activePath;
    if (item.activeTab) {
      return location.pathname.startsWith(item.activePath) && currentCommunityTab === item.activeTab;
    }
    return location.pathname.startsWith(item.activePath);
  };

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="site-brand" aria-label="健文社区首页">
          <span className="site-brand-mark"><span>J</span><i /></span>
          <span className="site-brand-copy"><strong>健文社区</strong><small>IDEAS INTO MOTION</small></span>
        </Link>

        <nav className="site-nav" aria-label="主导航">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={isNavActive(item) ? 'site-nav-item is-active' : 'site-nav-item'}
            >
              <item.icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="site-header-actions">
          {isAuthenticated ? (
            <>
              <div className="site-notification"><NotificationBell isAdmin={isAdmin} includeProfileReminder={isProfileIncomplete} /></div>
              <Link to="/profile" className={isProfileIncomplete ? 'site-avatar is-warning' : 'site-avatar'} aria-label="个人资料">
                {isProfileIncomplete ? <AlertCircle /> : <User />}
                <span>{user?.nickname?.slice(0, 1) || '我'}</span>
              </Link>
              {isAdmin && <Link to="/admin" className="site-icon-button" aria-label="管理后台"><Settings /></Link>}
              <button type="button" onClick={logout} className="site-icon-button" aria-label="退出登录"><LogOut /></button>
            </>
          ) : (
            <Link to="/login" className="site-login-button"><span>进入社区</span><i /></Link>
          )}
          <button
            type="button"
            className="site-menu-button"
            aria-label={mobileMenuOpen ? '关闭导航' : '打开导航'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="site-mobile-panel">
          <nav aria-label="移动端主导航">
            {navItems.map((item, index) => (
              <Link key={item.to} to={item.to} className={isNavActive(item) ? 'is-active' : ''}>
                <span className="site-mobile-index">0{index + 1}</span>
                <item.icon aria-hidden="true" />
                <strong>{item.label}</strong>
              </Link>
            ))}
          </nav>
          {isAuthenticated ? (
            <div className="site-mobile-account">
              <Link to="/profile"><User />我的资料</Link>
              <Link to="/notifications"><Bell />通知中心</Link>
              <Link to="/about/admin"><Sparkles />主页后台</Link>
              {isAdmin && <Link to="/admin"><Settings />管理后台</Link>}
              <button type="button" onClick={logout}><LogOut />退出登录</button>
            </div>
          ) : (
            <Link to="/login" className="site-mobile-login">登录并加入社区</Link>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
