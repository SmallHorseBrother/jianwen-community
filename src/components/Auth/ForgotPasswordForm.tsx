/**
 * 忘记密码表单 - 通过手机号 + 安全验证重置密码
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, Lock, Eye, EyeOff, AlertCircle, ArrowLeft, Check } from 'lucide-react';
import MathCaptcha from '../Common/MathCaptcha';
import { checkPhoneExists, supabase } from '../../lib/supabase';

type Step = 'verify' | 'reset' | 'success';

const ForgotPasswordForm: React.FC = () => {
  const navigate = useNavigate();
  
  // 步骤状态
  const [step, setStep] = useState<Step>('verify');
  
  // 表单状态
  const [phone, setPhone] = useState('');
  const [captchaValid, setCaptchaValid] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // UI 状态
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 步骤1：验证手机号
  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phone) {
      setError('请输入手机号');
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入有效的手机号');
      return;
    }

    if (!captchaValid) {
      setError('请完成安全验证');
      return;
    }

    setIsLoading(true);
    try {
      const { exists } = await checkPhoneExists(phone);
      
      if (!exists) {
        setError('该手机号未注册，请先注册账号');
        return;
      }

      // 验证通过，进入设置新密码步骤
      setStep('reset');
    } catch (err: any) {
      setError(err.message || '验证失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 步骤2：设置新密码
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword) {
      setError('请输入新密码');
      return;
    }

    if (newPassword.length < 6) {
      setError('密码长度至少6位');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsLoading(true);
    try {
      // 调用数据库 RPC 函数重置密码
      const { data, error: rpcError } = await supabase.rpc('reset_user_password', {
        user_phone: phone,
        new_password: newPassword
      });

      if (rpcError) {
        throw new Error(rpcError.message || '密码重置失败');
      }

      // 检查返回结果
      if (data && !data.success) {
        throw new Error(data.error || '密码重置失败');
      }

      setStep('success');
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || '密码重置失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };


  // 成功页面
  if (step === 'success') {
    return (
      <div className="auth-shell flex items-center justify-center py-12 px-4">
        <div className="auth-card max-w-md w-full p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-950/35">
            <Check className="w-8 h-8 text-emerald-200" />
          </div>
          <h2 className="auth-title mb-2 text-2xl">密码重置成功！</h2>
          <p className="auth-subtitle mb-6">
            您的密码已成功重置，请使用新密码登录。
          </p>
          <button
            onClick={() => navigate('/login')}
            className="neon-button w-full py-3 px-4 font-semibold rounded-xl transition-all"
          >
            返回登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="auth-card p-7 sm:p-8">
          {/* 返回按钮 */}
          <Link
            to="/login"
            className="auth-subtitle mb-6 inline-flex items-center text-sm transition hover:text-cyan-200"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回登录
          </Link>

          {/* 标题 */}
          <div className="text-center mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">Account Recovery</p>
            <h1 className="auth-title text-2xl">忘记密码</h1>
            <p className="auth-subtitle mt-2">
              {step === 'verify' ? '输入您的手机号验证身份' : '设置新密码'}
            </p>
          </div>

          {/* 步骤指示器 */}
          <div className="flex items-center justify-center mb-8">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 'verify' ? 'auth-step-active' : 'auth-step-done'
            }`}>
              {step === 'verify' ? '1' : '✓'}
            </div>
            <div className={`h-1 w-16 ${step === 'reset' ? 'bg-cyan-500' : 'bg-slate-700'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 'reset' ? 'auth-step-active' : 'auth-step'
            }`}>
              2
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="auth-alert mb-4 flex items-center p-3">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* 步骤1：验证手机号 */}
          {step === 'verify' && (
            <form onSubmit={handleVerifyPhone} className="space-y-6">
              <div>
                <label htmlFor="phone" className="auth-label mb-1">
                  手机号
                </label>
                <div className="auth-input-wrap">
                  <Phone className="auth-input-icon" />
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="请输入注册时使用的手机号"
                    className="auth-input pl-10 pr-4"
                  />
                </div>
              </div>

              <MathCaptcha onVerify={setCaptchaValid} />

              <button
                type="submit"
                disabled={isLoading || !captchaValid}
                className="neon-button w-full py-3 px-4 font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? '验证中...' : '下一步'}
              </button>
            </form>
          )}

          {/* 步骤2：设置新密码 */}
          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="auth-info p-3 text-sm">
                正在为手机号 <strong>{phone}</strong> 重置密码
              </div>

              <div>
                <label htmlFor="newPassword" className="auth-label mb-1">
                  新密码
                </label>
                <div className="auth-input-wrap">
                  <Lock className="auth-input-icon" />
                  <input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="请输入新密码（至少6位）"
                    className="auth-input pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-cyan-200"
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="auth-label mb-1">
                  确认密码
                </label>
                <div className="auth-input-wrap">
                  <Lock className="auth-input-icon" />
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="请再次输入新密码"
                    className="auth-input pl-10 pr-4"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('verify')}
                  className="flex-1 rounded-xl border border-slate-600/70 px-4 py-3 font-medium text-slate-200 transition hover:border-cyan-300/50 hover:bg-cyan-950/30"
                >
                  上一步
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="neon-button flex-1 py-3 px-4 font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? '重置中...' : '重置密码'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordForm;
