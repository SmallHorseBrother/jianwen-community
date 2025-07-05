import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Dumbbell, BookOpen, User, LogOut, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();

  // 检查用户资料完整度
  const isProfileIncomplete = user && (!user.groupIdentity && !user.profession) || 
    (!user.specialties || user.specialties.length === 0) &&
    (!user.fitnessInterests || user.fitnessInterests.length === 0) &&
    (!user.learningInterests || user.learningInterests.length === 0);

  const navItems = [
    { to: '/', label: '首页', icon: null },
    { to: '/fitness', label: '健身', icon: Dumbbell },
    { to: '/learning', label: '学习', icon: BookOpen },
  ];

  return (
    <header className="bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">🦉</span>
            </div>
            <span className="text-xl font-bold text-gray-900">枭马葛社区</span>
          </Link>

          <nav className="hidden md:flex space-x-8">
            {navItems.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === item.to
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                {item.icon && <item.icon className="w-4 h-4" />}
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                <Link
                  to="/profile"
                  className={`flex items-center space-x-2 transition-colors ${
                    isProfileIncomplete 
                      ? 'text-yellow-600 hover:text-yellow-700' 
                      : 'text-gray-700 hover:text-blue-600'
                  }`}
                >
                  {isProfileIncomplete ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                  <span className="hidden sm:inline">{user?.nickname}</span>
                  {isProfileIncomplete && (
                    <span className="hidden md:inline text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                      待完善
                    </span>
                  )}
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center space-x-1 text-gray-500 hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">退出</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                登录
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;