/**
 * 全局页脚组件
 * 包含赞赏入口和版权信息
 */

import React from 'react';
import { Heart, ExternalLink } from 'lucide-react';
import AppreciationCard from '../Common/AppreciationCard';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative z-10 mt-auto border-t border-cyan-300/10 bg-slate-950/50 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* 赞赏区域 */}
        <div className="mb-5 flex flex-col items-center sm:mb-6">
          <AppreciationCard mode="button" title="请我喝杯咖啡" />
        </div>

        {/* 分割线 */}
        <div className="border-t border-cyan-300/10 pt-6">
          <div className="flex flex-col items-center justify-between gap-3 text-center text-xs text-slate-400 sm:text-sm md:flex-row">
            <div className="flex items-center gap-1">
              Made with <Heart className="w-4 h-4 text-pink-500 fill-pink-500" /> by 小马哥
            </div>
            
            <div className="flex items-center gap-4">
              <a 
                href="https://space.bilibili.com/495933903" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-cyan-300 transition-colors"
              >
                B站: 枭马葛
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            
            <div>
              © {currentYear} 健文社区
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
