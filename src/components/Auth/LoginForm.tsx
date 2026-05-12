import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Phone, Lock, Eye, EyeOff, AlertCircle, Info } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import MathCaptcha from '../Common/MathCaptcha';

// 检测浏览器兼容性
function detectBrowserIssues(): string[] {
  const issues: string[] = [];
  
  // 检测浏览器类型
  const ua = navigator.userAgent;
  const isIE = ua.indexOf('MSIE') > -1 || ua.indexOf('Trident/') > -1;
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isOldBrowser = !window.crypto || !window.crypto.subtle;
  
  if (isIE) {
    issues.push('不支持 IE 浏览器');
  }
  
  if (isOldBrowser) {
    issues.push('浏览器版本过旧');
  }
  
  // 检测隐私模式（简单检测）
  try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
  } catch (e) {
    issues.push('可能处于隐私模式');
  }
  
  return issues;
}

const LoginForm: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);
  const [browserIssues, setBrowserIssues] = useState<string[]>([]);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 获取用户原本想要访问的页面
  const from = location.state?.from || '/';

  // 检测浏览器兼容性
  useEffect(() => {
    const issues = detectBrowserIssues();
    setBrowserIssues(issues);
  }, []);

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
      await login(phone, password);
      console.log('Login successful, navigating to:', from);
      
      // 登录成功后立即导航
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error('Login failed:', err);
      setIsLoading(false);

      // 提供更详细的错误信息
      if (err.message && err.message.includes('Invalid login credentials')) {
        setError('手机号或密码错误，请检查后重试');
      } else if (err.message && err.message.includes('Email not confirmed')) {
        setError('账户未激活，请联系管理员');
      } else if (err.message && err.message.includes('timeout') || err.message.includes('超时')) {
        setError('登录超时，可能是网络较慢或服务器正在启动，请稍后重试');
        setShowTroubleshooting(true);
      } else if (err.message && err.message.includes('网络')) {
        setError('网络连接异常，请稍后重试');
        setShowTroubleshooting(true);
      } else if (err.message && err.message.includes('资料')) {
        setError('获取用户资料失败，已自动清理缓存，请重试');
        setShowTroubleshooting(true);
      } else {
        setError(err.message || '登录失败，请稍后重试');
        setShowTroubleshooting(true);
      }
    }
  };

  // Removed debug functions - now handled by enhanced logging in AuthContext

  return (
    <div className="auth-shell flex items-center justify-center px-4 py-10">
      <div className="glass-panel max-w-md w-full space-y-8 p-8 rounded-3xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">欢迎回来</h2>
          <p className="mt-2 text-gray-600">登录您的健学社区账户</p>
          
          {/* 浏览器兼容性警告 */}
          {browserIssues.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">浏览器兼容性提示：</p>
                  <ul className="mt-1 list-disc list-inside">
                    {browserIssues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                  <p className="mt-2">建议使用 Chrome、Edge 或 Firefox 最新版本</p>
                </div>
              </div>
            </div>
          )}
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
            <div className="space-y-3">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
              
              {/* 故障排除提示 */}
              {showTroubleshooting && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-left">
                  <div className="flex items-start">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-2">遇到登录问题？试试这些方法：</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>等待 15 秒后重试（服务器可能正在启动）</li>
                        <li>切换到 Chrome 或 Edge 浏览器</li>
                        <li>检查网络连接，尝试切换网络</li>
                        <li>关闭隐私/无痕模式</li>
                        <li>如仍无法登录，尝试使用其他设备</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="neon-button group relative w-full flex justify-center py-3 px-4 text-sm font-semibold rounded-xl focus:outline-none disabled:opacity-50"
            >
              {isLoading ? '登录中...' : '登录'}
            </button>
          </div>

          <div className="text-center space-y-2">
            <div>
              <span className="text-sm text-gray-600">
                还没有账户？
                <Link to="/register" className="text-blue-600 hover:text-blue-500 ml-1">
                  立即注册
                </Link>
              </span>
            </div>
            <div>
              <Link to="/forgot-password" className="text-sm text-gray-500 hover:text-blue-600">
                忘记密码？
              </Link>
            </div>
          </div>
        </form>
        
        {/* 推荐浏览器提示 */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 text-center">
            💡 为获得最佳体验，推荐使用 Chrome、Edge 或 Firefox 最新版本
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
