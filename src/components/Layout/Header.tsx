import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Brain, Users, Wrench, User, LogOut, AlertCircle,
  Menu, X, Settings, Sparkles, Bell
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { checkIsAdmin } from '../../services/questionService';
import NotificationBell from './NotificationBell';

const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // 检查是否是管理员
  useEffect(() => {
    const checkAdmin = async () => {
      if (user?.id) {
        const adminStatus = await checkIsAdmin(user.id);
        setIsAdmin(adminStatus);
      } else {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [user?.id]);

  // 检查用户资料完整度
  const isProfileIncomplete = user ? (
    (!user.groupIdentity && !user.profession) || 
    (!user.specialties || user.specialties.length === 0) &&
    (!user.fitnessInterests || user.fitnessInterests.length === 0) &&
    (!user.learningInterests || user.learningInterests.length === 0)
  ) : false;

  const navItems = [
    { to: '/about', label: '关于我', icon: Sparkles },
    { to: '/qa', label: '问题星球', icon: Brain },
    { to: '/community', label: '社区广场', icon: Users },
    { to: '/tools', label: '工具箱', icon: Wrench },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-cyan-300/10 bg-slate-950/55 shadow-2xl shadow-cyan-950/20 backdrop-blur-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          {/* Logo */}
          <Link to="/about" className="group flex items-center space-x-3">
            <div className="relative h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-fuchsia-500 p-[1px] shadow-lg shadow-cyan-500/30 sm:h-10 sm:w-10 sm:rounded-2xl">
              <div className="flex h-full w-full items-center justify-center rounded-xl bg-slate-950/70 sm:rounded-2xl">
                <Sparkles className="h-4 w-4 text-cyan-200 transition-transform group-hover:rotate-12 sm:h-5 sm:w-5" />
              </div>
            </div>
            <div className="leading-tight">
              <span className="block text-base font-black tracking-wide text-white sm:text-lg">马健文</span>
              <span className="hidden text-[11px] uppercase tracking-[0.28em] text-cyan-200/70 sm:block">Jianwen OS</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1 shadow-inner shadow-white/5">
            {navItems.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive(item.to)
                    ? 'bg-cyan-300/15 text-cyan-100 shadow-sm shadow-cyan-500/10 ring-1 ring-cyan-300/20'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            ))}

          </nav>

          {/* Right Side */}
          <div className="flex items-center space-x-3">
            {isAuthenticated ? (
              <div className="hidden md:flex items-center space-x-3">
                <NotificationBell
                  isAdmin={isAdmin}
                  includeProfileReminder={isProfileIncomplete}
                />
                <Link
                  to="/profile"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-xl transition-all ${
                    isProfileIncomplete 
                      ? 'text-yellow-200 hover:bg-yellow-300/10' 
                      : 'text-slate-300 hover:bg-white/10 hover:text-cyan-100'
                  }`}
                >
                  {isProfileIncomplete ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                  <span>{user?.nickname}</span>
                  {isProfileIncomplete && (
                    <span className="text-xs bg-yellow-300/15 text-yellow-100 px-2 py-0.5 rounded-full ring-1 ring-yellow-300/20">
                      待完善
                    </span>
                  )}
                </Link>
                <Link
                  to="/about/admin"
                  className={`flex items-center space-x-1 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive('/about/admin')
                      ? 'text-cyan-100 bg-cyan-300/15'
                      : 'text-slate-300 hover:text-cyan-100 hover:bg-white/10'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>主页后台</span>
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className={`flex items-center space-x-1 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      isActive('/admin')
                        ? 'text-fuchsia-100 bg-fuchsia-300/15'
                        : 'text-fuchsia-200 hover:bg-fuchsia-300/10'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span>管理</span>
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="flex items-center space-x-1 text-slate-400 hover:text-red-200 px-2 py-2 rounded-xl hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="neon-button hidden md:block px-4 py-2 rounded-xl transition-all text-sm font-semibold"
              >
                登录
              </Link>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-200 hover:bg-white/10"
            >
              {mobileMenuOpen ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <Menu className="h-5 w-5 sm:h-6 sm:w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-cyan-300/10">
            <nav className="space-y-1">
              {navItems.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-xl text-sm font-medium ${
                    isActive(item.to)
                      ? 'text-cyan-100 bg-cyan-300/15'
                      : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              ))}
              {isAuthenticated ? (
                <div className="pt-2 mt-2 border-t border-cyan-300/10">
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center space-x-2 px-4 py-3 text-sm text-slate-300 hover:bg-white/10 rounded-xl"
                  >
                    <User className="w-5 h-5" />
                    <span>我的资料</span>
                  </Link>
                  <Link
                    to="/notifications"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center space-x-2 px-4 py-3 text-sm text-slate-300 hover:bg-white/10 rounded-xl"
                  >
                    <Bell className="w-5 h-5" />
                    <span>通知中心</span>
                  </Link>
                  <Link
                    to="/about/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center space-x-2 px-4 py-3 text-sm text-slate-300 hover:bg-white/10 rounded-xl"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>主页后台</span>
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin/qa"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center space-x-2 px-4 py-3 text-sm text-fuchsia-200 hover:bg-fuchsia-300/10 rounded-xl"
                    >
                      <Settings className="w-5 h-5" />
                      <span>管理后台</span>
                    </Link>
                  )}
                  <button
                    onClick={() => { logout(); setMobileMenuOpen(false); }}
                    className="flex items-center space-x-2 px-4 py-3 text-sm text-red-200 hover:bg-red-500/10 w-full rounded-xl"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>退出登录</span>
                  </button>
                </div>
              ) : (
                <div className="pt-2 mt-2 border-t border-cyan-300/10">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="neon-button block mx-4 text-center py-3 rounded-xl font-semibold"
                  >
                    登录
                  </Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
