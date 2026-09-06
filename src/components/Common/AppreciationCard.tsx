/**
 * 赞赏码组件
 * 显示微信赞赏二维码，支持不同显示模式
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
          type="button"
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
          type="button"
          onClick={() => setShowModal(true)}
          className={`inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-red-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:scale-105 hover:from-pink-600 hover:to-red-600 hover:shadow-xl sm:px-5 sm:text-base ${className}`}
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
    <div className={`rounded-2xl border border-pink-100 bg-gradient-to-br from-pink-50 to-orange-50 p-4 sm:p-6 ${className}`}>
      <div className="flex flex-col items-center gap-4 sm:gap-6 md:flex-row">
        <div className="flex-shrink-0">
          <img
            src="/appreciation-qr.png"
            alt="赞赏码"
            className="h-32 w-32 rounded-xl shadow-md sm:h-40 sm:w-40"
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
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-black/70 p-4 overscroll-contain"
      onClick={onClose}
      role="presentation"
    >
      <div
        aria-labelledby="appreciation-dialog-title"
        aria-modal="true"
        className="relative my-auto w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 grid h-11 w-11 touch-manipulation place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          aria-label="关闭赞赏码"
          autoFocus
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="text-center">
          <h3 id="appreciation-dialog-title" className="mb-4 flex items-center justify-center gap-2 pr-8 text-xl font-bold text-gray-800">
            <Heart className="w-6 h-6 text-pink-500" />
            感谢支持
          </h3>
          
          <img
            src="/appreciation-qr.png"
            alt="赞赏码"
            className="mx-auto aspect-square h-auto w-full max-w-56 rounded-xl object-contain shadow-lg"
          />
          
          <p className="text-gray-600 mt-4">
            如果觉得有帮助，欢迎赞赏支持~
          </p>
          <p className="text-sm text-gray-400 mt-2 italic">
            "只管去做，你的潜力超乎你的想象"
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AppreciationCard;
