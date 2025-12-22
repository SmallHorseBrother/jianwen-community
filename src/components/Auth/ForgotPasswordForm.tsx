/**
 * 忘记密码表单 - 通过手机号 + 数学验证码重置密码
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
      setError('请完成数学验证码');
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 py-12 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">密码重置成功！</h2>
          <p className="text-gray-600 mb-6">
            您的密码已成功重置，请使用新密码登录。
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
          >
            返回登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* 返回按钮 */}
          <Link
            to="/login"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回登录
          </Link>

          {/* 标题 */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">忘记密码</h1>
            <p className="text-gray-600 mt-2">
              {step === 'verify' ? '输入您的手机号验证身份' : '设置新密码'}
            </p>
          </div>

          {/* 步骤指示器 */}
          <div className="flex items-center justify-center mb-8">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 'verify' ? 'bg-blue-600 text-white' : 'bg-green-500 text-white'
            }`}>
              {step === 'verify' ? '1' : '✓'}
            </div>
            <div className={`w-16 h-1 ${step === 'reset' ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 'reset' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              2
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* 步骤1：验证手机号 */}
          {step === 'verify' && (
            <form onSubmit={handleVerifyPhone} className="space-y-6">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  手机号
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="请输入注册时使用的手机号"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <MathCaptcha onVerify={setCaptchaValid} />

              <button
                type="submit"
                disabled={isLoading || !captchaValid}
                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                {isLoading ? '验证中...' : '下一步'}
              </button>
            </form>
          )}

          {/* 步骤2：设置新密码 */}
          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
                正在为手机号 <strong>{phone}</strong> 重置密码
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  新密码
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="请输入新密码（至少6位）"
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  确认密码
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="请再次输入新密码"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('verify')}
                  className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
                >
                  上一步
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
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
