import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Brain, Users, Wrench, User, LogOut, AlertCircle, 
  Menu, X, ChevronDown, Dumbbell, BookOpen, Settings 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { checkIsAdmin } from '../../services/questionService';

const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [archiveMenuOpen, setArchiveMenuOpen] = useState(false);
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

  // V2.0 主导航
  const navItems = [
    { to: '/', label: '数字大脑', icon: Brain },
    { to: '/community', label: '社区广场', icon: Users },
    { to: '/tools', label: '工具箱', icon: Wrench },
  ];

  // 归档页面
  const archiveItems = [
    { to: '/fitness', label: '健身', icon: Dumbbell },
    { to: '/learning', label: '学习', icon: BookOpen },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">🧠</span>
            </div>
            <span className="text-xl font-bold text-gray-900">马健文</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.to)
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            ))}

            {/* 归档菜单 */}
            <div className="relative">
              <button
                onClick={() => setArchiveMenuOpen(!archiveMenuOpen)}
                onBlur={() => setTimeout(() => setArchiveMenuOpen(false), 150)}
                className="flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span>归档</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${archiveMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {archiveMenuOpen && (
                <div className="absolute top-full right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                  {archiveItems.map(item => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Right Side */}
          <div className="flex items-center space-x-3">
            {isAuthenticated ? (
              <div className="hidden md:flex items-center space-x-3">
                <Link
                  to="/profile"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                    isProfileIncomplete 
                      ? 'text-yellow-600 hover:bg-yellow-50' 
                      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                  }`}
                >
                  {isProfileIncomplete ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                  <span>{user?.nickname}</span>
                  {isProfileIncomplete && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                      待完善
                    </span>
                  )}
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive('/admin')
                        ? 'text-purple-600 bg-purple-50'
                        : 'text-purple-600 hover:bg-purple-50'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span>管理</span>
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="flex items-center space-x-1 text-gray-500 hover:text-red-600 px-2 py-2 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden md:block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                登录
              </Link>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100">
            <nav className="space-y-1">
              {navItems.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-lg text-sm font-medium ${
                    isActive(item.to)
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              ))}
              
              <div className="pt-2 mt-2 border-t border-gray-100">
                <p className="px-4 py-2 text-xs text-gray-400 uppercase">归档</p>
                {archiveItems.map(item => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center space-x-2 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>

              {isAuthenticated ? (
                <div className="pt-2 mt-2 border-t border-gray-100">
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center space-x-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <User className="w-5 h-5" />
                    <span>我的资料</span>
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin/qa"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center space-x-2 px-4 py-3 text-sm text-purple-600 hover:bg-purple-50"
                    >
                      <Settings className="w-5 h-5" />
                      <span>管理后台</span>
                    </Link>
                  )}
                  <button
                    onClick={() => { logout(); setMobileMenuOpen(false); }}
                    className="flex items-center space-x-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 w-full"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>退出登录</span>
                  </button>
                </div>
              ) : (
                <div className="pt-2 mt-2 border-t border-gray-100">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block mx-4 text-center bg-blue-600 text-white py-3 rounded-lg font-medium"
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