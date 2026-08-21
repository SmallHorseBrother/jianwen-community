/**
 * 全局页脚组件
 * 包含赞赏入口和版权信息
 */

import React from 'react';
import { ArrowUpRight, Heart } from 'lucide-react';
import AppreciationCard from '../Common/AppreciationCard';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <span className="site-brand-mark"><span>J</span><i /></span>
          <div><strong>健文社区</strong><p>让问题被看见，让行动留下证据。</p></div>
        </div>
        <div className="site-footer-support">
          <span>支持这个长期实验</span>
          <AppreciationCard mode="button" title="请我喝杯咖啡" />
        </div>
        <a href="https://space.bilibili.com/495933903" target="_blank" rel="noopener noreferrer" className="site-footer-link">
          B站 · 枭马葛 <ArrowUpRight />
        </a>
      </div>
      <div className="site-footer-meta">
        <span>© {currentYear} JIANWEN COMMUNITY</span>
        <span>Made with <Heart /> by 小马哥</span>
        <span><i /> COMMUNITY ONLINE</span>
      </div>
    </footer>
  );
};

export default Footer;
