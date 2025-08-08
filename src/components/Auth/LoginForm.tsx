import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Phone, Lock, Eye, EyeOff, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, clearLocalSupabaseAuth } from '../../lib/supabase';
import MathCaptcha from '../Common/MathCaptcha';

const LoginForm: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 获取用户原本想要访问的页面
  const from = location.state?.from || '/';
  
  // 调试信息
  console.log('LoginForm - Location state:', location.state);
  console.log('LoginForm - Redirect to:', from);

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

    if (isLoading) return;
    setIsLoading(true);
    try {
      const withTimeout = <T,>(p: Promise<T>, ms: number, msg: string) =>
        new Promise<T>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error(msg)), ms);
          p.then((v) => { clearTimeout(t); resolve(v); })
           .catch((err) => { clearTimeout(t); reject(err); });
        });

      await withTimeout(login(phone, password), 16000, '登录超时，请重试');
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err.message && err.message.includes('Invalid login credentials')) {
        setError('手机号或密码错误，请检查后重试');
      } else if (err.message && err.message.includes('Email not confirmed')) {
        setError('账户未激活，请联系管理员');
      } else {
        setError(err.message || '登录失败，请检查账号密码');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDebug = async () => {
    console.log('=== DEBUG INFO ===');
    console.log('Testing database connection...');
    
    try {
      const { error } = await supabase.from('profiles').select('count').limit(1);
      if (error) {
        console.error('Database connection failed:', error);
      } else {
        console.log('Database connection successful');
      }
    } catch (err) {
      console.error('Database test failed:', err);
    }
    
    console.log('Listing all users...');
    try {
      const { data, error } = await supabase.from('profiles').select('id, phone, nickname, created_at').limit(10);
      if (error) {
        console.error('User query failed:', error);
      } else {
        console.log('Users:', data);
      }
    } catch (err) {
      console.error('User query failed:', err);
    }
    
    console.log('=== END DEBUG ===');
  };

  const handleClearStorage = async () => {
    console.log('Clearing browser storage...');
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {}
    clearLocalSupabaseAuth();
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
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? '登录中...' : '登录'}
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