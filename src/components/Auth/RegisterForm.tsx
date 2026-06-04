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
      setError('请完成安全验证');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Submitting registration form...', { phone, nickname });
      await register(phone, password, nickname);
      console.log('Registration successful, navigating to profile onboarding...');
      navigate('/profile?flow=register', { replace: true, state: { from } });
    } catch (err) {
      console.error('Registration form error:', err);
      setError(err instanceof Error ? err.message : '注册失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-shell flex items-center justify-center px-4 py-10">
      <div className="auth-card max-w-md w-full space-y-8 p-7 sm:p-8">
        <div className="text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">Jianwen Community</p>
          <h2 className="auth-title text-3xl">加入我们</h2>
          <p className="auth-subtitle mt-2">创建您的健学社区账户</p>
          <div className="auth-info mt-4 p-3 text-sm">
            温馨提示：如果注册按钮无响应，请尝试更换浏览器或切换网络环境
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="nickname" className="auth-label">
                昵称
              </label>
              <div className="auth-input-wrap">
                <User className="auth-input-icon" />
                <input
                  id="nickname"
                  type="text"
                  required
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="auth-input block pl-10 pr-3"
                  placeholder="请输入昵称"
                />
              </div>
            </div>

            <div>
              <label htmlFor="phone" className="auth-label">
                手机号
              </label>
              <div className="auth-input-wrap">
                <Phone className="auth-input-icon" />
                <input
                  id="phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="auth-input block pl-10 pr-3"
                  placeholder="请输入手机号"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="auth-label">
                密码
              </label>
              <div className="auth-input-wrap">
                <Lock className="auth-input-icon" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input block pl-10 pr-11"
                  placeholder="至少6位密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition hover:text-cyan-200"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
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
            <div className="auth-alert p-3 text-center text-sm">{error}</div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="neon-button group relative w-full flex justify-center py-3 px-4 text-sm font-semibold rounded-xl focus:outline-none disabled:opacity-50"
            >
              {isLoading ? '注册中...' : '注册'}
            </button>
          </div>

          <div className="text-center">
            <span className="auth-subtitle text-sm">
              已有账户？
              <Link to="/login" className="auth-link ml-1">
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
