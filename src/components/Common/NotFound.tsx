import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ArrowLeft, AlertCircle } from 'lucide-react';

const NotFound: React.FC = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg text-center">
        <div className="space-y-4">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-4xl font-bold text-gray-900">404</h1>
          <h2 className="text-xl font-semibold text-gray-700">页面未找到</h2>
          <p className="text-gray-600">
            抱歉，您访问的页面不存在或已被移除。
          </p>
          
          {/* 调试信息 */}
          <div className="bg-gray-50 p-4 rounded-lg text-left">
            <p className="text-sm text-gray-600 mb-2">
              <strong>当前路径:</strong> {location.pathname}
            </p>
            <p className="text-sm text-gray-600">
              <strong>完整URL:</strong> {window.location.href}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Home className="w-4 h-4 mr-2" />
            返回首页
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回上页
          </button>
        </div>

        <div className="mt-8 text-sm text-gray-500">
          <p>如果您认为这是一个错误，请联系技术支持。</p>
        </div>
      </div>
    </div>
  );
};

export default NotFound; 