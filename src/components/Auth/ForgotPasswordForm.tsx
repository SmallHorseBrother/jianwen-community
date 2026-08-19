/** 密码找回：只有收到对应手机号的短信验证码后，服务端才会更新密码。 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Eye, EyeOff, Lock, Phone, Send, ShieldCheck } from 'lucide-react';
import MathCaptcha from '../Common/MathCaptcha';
import { supabase } from '../../lib/supabase';

type Step = 'verify' | 'reset' | 'success';

type ResetResponse = { message?: string; error?: string };

const invokePasswordReset = async (body: Record<string, string>): Promise<ResetResponse> => {
  const { data, error } = await supabase.functions.invoke<ResetResponse>('password-reset', { body });
  if (error || data?.error) {
    // Never display a database, network, or provider error directly to visitors.
    throw new Error(data?.error || '服务暂时不可用，请稍后再试');
  }
  return data || {};
};

const ForgotPasswordForm: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('verify');
  const [phone, setPhone] = useState('');
  const [captchaValid, setCaptchaValid] = useState(false);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const handlePhoneChange = (value: string) => {
    setPhone(value.replace(/\D/g, '').slice(0, 11));
    setCode('');
    setNotice('');
    setError('');
  };

  const handleSendCode = async () => {
    setError('');
    setNotice('');
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入有效的手机号');
      return;
    }
    if (!captchaValid) {
      setError('请先完成安全验证');
      return;
    }

    setIsSending(true);
    try {
      const response = await invokePasswordReset({ action: 'send_code', phone });
      setNotice(response.message || '验证码已发送，请注意查收');
      setCooldown(60);
      setStep('reset');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '验证码发送失败，请稍后再试');
    } finally {
      setIsSending(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code)) {
      setError('请输入 6 位短信验证码');
      return;
    }
    if (newPassword.length < 6) {
      setError('密码长度至少为 6 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsResetting(true);
    try {
      await invokePasswordReset({
        action: 'reset_password',
        phone,
        code,
        new_password: newPassword,
      });
      setStep('success');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '密码重置失败，请稍后再试');
    } finally {
      setIsResetting(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="auth-shell flex items-center justify-center px-4 py-12">
        <div className="auth-card max-w-md w-full p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-950/35">
            <Check className="h-8 w-8 text-emerald-200" />
          </div>
          <h1 className="auth-title text-2xl">密码重置成功</h1>
          <p className="auth-subtitle mt-3">请使用新密码登录健文社区。</p>
          <button onClick={() => navigate('/login')} className="neon-button mt-7 w-full rounded-xl px-4 py-3 font-semibold">
            返回登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell flex items-center justify-center px-4 py-12">
      <div className="auth-card max-w-md w-full p-7 sm:p-8">
        <Link to="/login" className="auth-subtitle mb-6 inline-flex items-center text-sm transition hover:text-cyan-200">
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回登录
        </Link>

        <div className="text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">Account Recovery</p>
          <h1 className="auth-title text-2xl">忘记密码</h1>
          <p className="auth-subtitle mt-2">验证手机号后设置新密码</p>
        </div>

        <div className="my-8 flex items-center justify-center">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${step === 'verify' ? 'auth-step-active' : 'auth-step-done'}`}>
            {step === 'verify' ? '1' : <Check className="h-4 w-4" />}
          </div>
          <div className={`h-1 w-16 ${step === 'reset' ? 'bg-cyan-500' : 'bg-slate-700'}`} />
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${step === 'reset' ? 'auth-step-active' : 'auth-step'}`}>2</div>
        </div>

        {error && <div className="auth-alert mb-4 p-3 text-sm">{error}</div>}
        {notice && <div className="auth-info mb-4 p-3 text-sm">{notice}</div>}

        {step === 'verify' ? (
          <div className="space-y-6">
            <div>
              <label htmlFor="phone" className="auth-label mb-1">手机号</label>
              <div className="auth-input-wrap">
                <Phone className="auth-input-icon" />
                <input id="phone" type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={(event) => handlePhoneChange(event.target.value)} placeholder="请输入注册手机号" className="auth-input pl-10 pr-4" />
              </div>
            </div>
            <MathCaptcha onVerify={setCaptchaValid} />
            <button type="button" onClick={handleSendCode} disabled={isSending || !captchaValid} className="neon-button w-full rounded-xl px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50">
              {isSending ? '发送中...' : '获取短信验证码'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div className="auth-info p-3 text-sm">验证码已发送至 {phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</div>
            <div>
              <label htmlFor="code" className="auth-label mb-1">短信验证码</label>
              <div className="flex gap-3">
                <div className="auth-input-wrap flex-1">
                  <ShieldCheck className="auth-input-icon" />
                  <input id="code" type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="输入 6 位验证码" className="auth-input pl-10 pr-3" />
                </div>
                <button type="button" onClick={handleSendCode} disabled={isSending || cooldown > 0} className="rounded-xl border border-cyan-300/40 px-3 text-sm font-medium text-cyan-100 disabled:opacity-50">
                  {isSending ? '发送中' : cooldown > 0 ? `${cooldown}s` : <><Send className="mr-1 inline h-4 w-4" />重发</>}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="newPassword" className="auth-label mb-1">新密码</label>
              <div className="auth-input-wrap">
                <Lock className="auth-input-icon" />
                <input id="newPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="至少 6 位" className="auth-input pl-10 pr-10" />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={showPassword ? '隐藏密码' : '显示密码'}>{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
              </div>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="auth-label mb-1">确认新密码</label>
              <div className="auth-input-wrap">
                <Lock className="auth-input-icon" />
                <input id="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入新密码" className="auth-input pl-10 pr-4" />
              </div>
            </div>
            <button type="submit" disabled={isResetting} className="neon-button w-full rounded-xl px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50">{isResetting ? '重置中...' : '重置密码'}</button>
            <button type="button" onClick={() => { setStep('verify'); setError(''); setNotice(''); }} className="w-full text-sm text-slate-300 transition hover:text-cyan-200">更换手机号</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordForm;
