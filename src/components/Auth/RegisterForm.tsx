import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Phone, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import MathCaptcha from '../Common/MathCaptcha';

const RegisterForm: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 获取用户原本想要访问的页面
  const from = location.state?.from || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phone || !password || !nickname) {
      setError('请填写所有必填项');
      return;
    }

    if (password.length < 6) {
      setError('密码长度至少6位');
      return;
    }

    if (!isCaptchaValid) {
      setError('请完成数学验证码');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Submitting registration form...', { phone, nickname });
      await register(phone, password, nickname);
      console.log('Registration successful, navigating to login...');
      navigate('/login');
    } catch (err) {
      console.error('Registration form error:', err);
      setError(err instanceof Error ? err.message : '注册失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">加入我们</h2>
          <p className="mt-2 text-gray-600">创建您的健学社区账户</p>
          <div className="mt-4 text-sm text-gray-500 bg-blue-50 p-3 rounded-lg">
            温馨提示：如果注册按钮无响应，请尝试更换浏览器或切换网络环境
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">
                昵称
              </label>
              <div className="mt-1 relative">
                <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  id="nickname"
                  type="text"
                  required
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="pl-10 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入昵称"
                />
              </div>
            </div>

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
                  placeholder="至少6位密码"
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
              {isLoading ? '注册中...' : '注册'}
            </button>
          </div>

          <div className="text-center">
            <span className="text-sm text-gray-600">
              已有账户？
              <Link to="/login" className="text-blue-600 hover:text-blue-500 ml-1">
                立即登录
              </Link>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterForm;