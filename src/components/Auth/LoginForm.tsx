import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Phone, Lock, Eye, EyeOff, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, testSupabaseConnection } from '../../lib/supabase';
import MathCaptcha from '../Common/MathCaptcha';

const LoginForm: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 获取用户原本想要访问的页面
  const from = location.state?.from || '/';
  
  // 调试信息
  console.log('LoginForm - Location state:', location.state);
  console.log('LoginForm - Redirect to:', from);
  console.log('LoginForm - isAuthenticated:', isAuthenticated, 'authLoading:', authLoading);

  // 监听认证状态变化，登录成功后自动导航
  useEffect(() => {
    console.log('LoginForm - Auth state changed:', { 
      isAuthenticated, 
      authLoading, 
      isLoading,
      currentPath: location.pathname,
      targetPath: from
    });
    
    // 如果已经认证且不在加载中，且当前在登录页面，则导航
    if (isAuthenticated && !authLoading && location.pathname === '/login') {
      console.log('LoginForm - User authenticated, preparing navigation to:', from);
      
      // 重置本地 loading 状态
      if (isLoading) {
        setIsLoading(false);
      }
      
      // 使用 setTimeout 确保状态更新完成后再导航
      const timer = setTimeout(() => {
        try {
          console.log('LoginForm - Executing navigation to:', from);
          navigate(from, { replace: true });
          console.log('LoginForm - Navigation executed successfully');
        } catch (navError) {
          console.error('LoginForm - Navigation error:', navError);
          // 如果导航失败，尝试使用 window.location 作为备用方案
          console.log('LoginForm - Trying fallback navigation with window.location');
          try {
            window.location.href = from;
          } catch (fallbackError) {
            console.error('LoginForm - Fallback navigation also failed:', fallbackError);
          }
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, authLoading, isLoading, navigate, from, location.pathname]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phone || !password) {
      setError('请填写手机号和密码');
      return;
    }

    if (!isCaptchaValid) {
      setError('请完成数学验证码');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Starting login process...');
      console.log('LoginForm - Before login, isAuthenticated:', isAuthenticated);
      
      await login(phone, password);
      
      console.log('LoginForm - Login function completed successfully');
      console.log('LoginForm - Waiting for auth state update and navigation...');
      
      // 不在这里直接导航，让 useEffect 监听 isAuthenticated 变化后自动导航
      // 这样可以确保状态完全同步后再导航
      
    } catch (err: any) {
      console.error('Login failed:', err);
      setIsLoading(false);

      // 提供更详细的错误信息
      if (err.message && err.message.includes('Invalid login credentials')) {
        setError('手机号或密码错误，请检查后重试');
      } else if (err.message && err.message.includes('Email not confirmed')) {
        setError('账户未激活，请联系管理员');
      } else if (err.message && err.message.includes('timeout')) {
        setError('网络连接超时，请检查网络后重试');
      } else if (err.message && err.message.includes('网络')) {
        setError('网络连接异常，请稍后重试');
      } else if (err.message && err.message.includes('资料')) {
        setError('获取用户资料失败，已自动清理缓存，请重试');
      } else {
        setError(err.message || '登录失败，请稍后重试');
      }

      // 如果是网络相关错误，建议用户清除缓存
      if (err.message && (
        err.message.includes('timeout') ||
        err.message.includes('网络') ||
        err.message.includes('资料')
      )) {
        setTimeout(() => {
          if (!error.includes('清除缓存')) {
            setError(prev => prev + '\n\n如果问题持续，请尝试清除浏览器缓存后重试');
          }
        }, 2000);
      }
    }
    // 注意：不在 finally 中设置 setIsLoading(false)
    // 因为登录成功后，isLoading 应该由认证状态控制
  };

  const handleDebug = async () => {
    console.log('=== DEBUG INFO ===');

    // 测试环境变量
    console.log('Environment variables:');
    console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? '✓' : '✗');
    console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓' : '✗');

    // 测试数据库连接
    console.log('Testing database connection...');
    const connectionTest = await testSupabaseConnection();
    if (connectionTest.success) {
      console.log('✓ Database connection successful');
    } else {
      console.error('✗ Database connection failed:', connectionTest.error);
    }

    // 检查认证状态
    console.log('Checking auth state...');
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Get session error:', error);
      } else {
        console.log('Current session:', session?.user ? '✓ exists' : '✗ none');
        if (session?.user) {
          console.log('User ID:', session.user.id);
          console.log('User email:', session.user.email);
        }
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    }

    // 检查 localStorage
    console.log('Checking localStorage...');
    const keys = Object.keys(localStorage).filter(key => key.includes('supabase') || key.startsWith('sb-'));
    console.log('Supabase localStorage keys:', keys);

    console.log('=== END DEBUG ===');
  };

  const handleClearStorage = () => {
    console.log('Clearing browser storage...');
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  const handleRetryLogin = async () => {
    console.log('Retrying login...');
    setError('');
    setIsLoading(false);
    // 重置验证码状态
    setIsCaptchaValid(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">欢迎回来</h2>
          <p className="mt-2 text-gray-600">登录您的健学社区账户</p>
          <div className="mt-4 text-sm text-gray-500 bg-blue-50 p-3 rounded-lg">
            温馨提示：如果登录按钮无响应，请尝试更换浏览器或切换网络环境
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                手机号
              </label>
              <div className="mt-1 relative">
                <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  id="phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入手机号"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                密码
              </label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 h-5 w-5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            <div>
              <MathCaptcha onVerify={setIsCaptchaValid} />
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading || authLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {(isLoading || authLoading) ? '登录中...' : '登录'}
            </button>
          </div>

          <div className="text-center">
            <span className="text-sm text-gray-600">
              还没有账户？
              <Link to="/register" className="text-blue-600 hover:text-blue-500 ml-1">
                立即注册
              </Link>
            </span>
          </div>
        </form>
        
        {/* 调试按钮 */}
        <div className="mt-4 text-center space-y-2">
          <button
            onClick={handleDebug}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center space-x-1"
          >
            <Settings className="w-3 h-3" />
            <span>调试信息</span>
          </button>
          <div className="flex justify-center space-x-4">
            <button
              onClick={handleRetryLogin}
              className="text-xs text-blue-400 hover:text-blue-600 flex items-center justify-center space-x-1"
            >
              <span>重试登录</span>
            </button>
            <button
              onClick={handleClearStorage}
              className="text-xs text-red-400 hover:text-red-600 flex items-center justify-center space-x-1"
            >
              <span>清除缓存</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;