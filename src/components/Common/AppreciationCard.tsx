/**
 * 赞赏码组件
 * 显示微信赞赏二维码，支持不同显示模式
 */

import React, { useState } from 'react';
import { Heart, X } from 'lucide-react';

interface AppreciationCardProps {
  /** 显示模式: inline=页面内嵌, button=按钮点击弹窗, compact=紧凑按钮 */
  mode?: 'inline' | 'button' | 'compact';
  /** 自定义标题 */
  title?: string;
  /** 自定义描述 */
  description?: string;
  /** 自定义类名 */
  className?: string;
}

const AppreciationCard: React.FC<AppreciationCardProps> = ({
  mode = 'inline',
  title = '请我喝杯咖啡 ☕',
  description = '如果觉得有帮助，欢迎赞赏支持~',
  className = '',
}) => {
  const [showModal, setShowModal] = useState(false);

  // 紧凑按钮模式
  if (mode === 'compact') {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className={`inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-pink-500 transition-colors ${className}`}
        >
          <Heart className="w-4 h-4" />
          赞赏
        </button>
        {showModal && <AppreciationModal onClose={() => setShowModal(false)} />}
      </>
    );
  }

  // 按钮弹窗模式
  if (mode === 'button') {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className={`inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-red-500 text-white px-5 py-2.5 rounded-xl font-medium hover:from-pink-600 hover:to-red-600 transition-all shadow-lg hover:shadow-xl hover:scale-105 ${className}`}
        >
          <Heart className="w-5 h-5" />
          {title}
        </button>
        {showModal && <AppreciationModal onClose={() => setShowModal(false)} />}
      </>
    );
  }

  // 内嵌模式
  return (
    <div className={`bg-gradient-to-br from-pink-50 to-orange-50 rounded-2xl p-6 border border-pink-100 ${className}`}>
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="flex-shrink-0">
          <img
            src="/appreciation-qr.png"
            alt="赞赏码"
            className="w-40 h-40 rounded-xl shadow-md"
          />
        </div>
        <div className="text-center md:text-left">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 justify-center md:justify-start">
            <Heart className="w-5 h-5 text-pink-500" />
            {title}
          </h3>
          <p className="text-gray-600 mt-2">{description}</p>
          <p className="text-sm text-gray-400 mt-3">
            "只管去做，你的潜力超乎你的想象"
          </p>
        </div>
      </div>
    </div>
  );
};

// 赞赏弹窗
const AppreciationModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-sm w-full p-6 relative animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="text-center">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2 justify-center mb-4">
            <Heart className="w-6 h-6 text-pink-500" />
            感谢支持
          </h3>
          
          <img
            src="/appreciation-qr.png"
            alt="赞赏码"
            className="w-56 h-56 mx-auto rounded-xl shadow-lg"
          />
          
          <p className="text-gray-600 mt-4">
            如果觉得有帮助，欢迎赞赏支持~
          </p>
          <p className="text-sm text-gray-400 mt-2 italic">
            "只管去做，你的潜力超乎你的想象"
          </p>
        </div>
      </div>
    </div>
  );
};

export default AppreciationCard;
