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
    <footer className="bg-gray-50 border-t border-gray-100 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 赞赏区域 */}
        <div className="flex flex-col items-center mb-6">
          <AppreciationCard mode="button" title="请我喝杯咖啡" />
        </div>

        {/* 分割线 */}
        <div className="border-t border-gray-200 pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              Made with <Heart className="w-4 h-4 text-pink-500 fill-pink-500" /> by 小马哥
            </div>
            
            <div className="flex items-center gap-4">
              <a 
                href="https://space.bilibili.com/495933903" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-blue-600 transition-colors"
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
