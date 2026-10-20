import React, { useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Phone, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import MathCaptcha from '../Common/MathCaptcha';
import { useAttemptLimiter } from '../../hooks/useAttemptLimiter';
import {
  isValidMainlandPhone,
  normalizePhone,
  MAX_NICKNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '../../lib/authValidation';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 60_000;
const MIN_FILL_MS = 1500;

const RegisterForm: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);
  const openedAtRef = useRef(Date.now());
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { lockedSeconds, recordFailure, recordSuccess } = useAttemptLimiter(
    'jw_register_lock',
    MAX_FAILED_ATTEMPTS,
    LOCK_DURATION_MS,
  );

  // 获取用户原本想要访问的页面
  const from = location.state?.from || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (lockedSeconds > 0) {
      setError(`尝试次数过多，请 ${lockedSeconds} 秒后再试`);
      return;
    }

    // 蜜罐字段只有脚本会填；提交过快也不是真人操作
    if (honeypot || Date.now() - openedAtRef.current < MIN_FILL_MS) {
      setError('提交过于频繁，请稍后再试');
      return;
    }

    const cleanPhone = normalizePhone(phone);
    const cleanNickname = nickname.trim();

    if (!cleanPhone || !password || !cleanNickname) {
      setError('请填写所有必填项');
      return;
    }

    if (!isValidMainlandPhone(cleanPhone)) {
      setError('请输入有效的11位手机号');
      return;
    }

    if (cleanNickname.length > MAX_NICKNAME_LENGTH) {
      setError(`昵称不能超过${MAX_NICKNAME_LENGTH}个字符`);
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`密码长度至少${MIN_PASSWORD_LENGTH}位`);
      return;
    }

    if (!isCaptchaValid) {
      setError('请完成安全验证');
      return;
    }

    setIsLoading(true);
    try {
      await register(cleanPhone, password, cleanNickname);
      recordSuccess();
      navigate('/profile?flow=register', { replace: true, state: { from } });
    } catch (err) {
      recordFailure();
      setError(err instanceof Error ? err.message : '注册失败，请重试');
    } finally {
      setIsLoading(false);
      // 每次提交后都要重新完成滑块，避免一次验证后无限提交
      setIsCaptchaValid(false);
      setCaptchaKey((key) => key + 1);
    }
  };

  return (
    <div className="auth-shell flex items-center justify-center px-4 py-10">
      <div className="auth-card max-w-md w-full space-y-8 p-7 sm:p-8">
        <div className="text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">Jianwen Community</p>
          <h2 className="auth-title text-3xl">加入我们</h2>
          <p className="auth-subtitle mt-2">创建您的健文社区账户</p>
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
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={11}
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  className="auth-input block pl-10 pr-3"
                  placeholder="请输入11位手机号"
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
              <MathCaptcha key={captchaKey} onVerify={setIsCaptchaValid} />
            </div>

            {/* 蜜罐：真人看不到也不会填 */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
              <label htmlFor="website">网站</label>
              <input
                id="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="auth-alert p-3 text-center text-sm">{error}</div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading || lockedSeconds > 0}
              className="neon-button group relative w-full flex justify-center py-3 px-4 text-sm font-semibold rounded-xl focus:outline-none disabled:opacity-50"
            >
              {isLoading ? '注册中...' : lockedSeconds > 0 ? `请 ${lockedSeconds} 秒后再试` : '注册'}
            </button>
          </div>

          <div className="text-center">
            <span className="auth-subtitle text-sm">
              已有账户？
              <Link to="/login" state={{ from }} className="auth-link ml-1">
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
