import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import AppreciationCard from '../Common/AppreciationCard';

const Footer: React.FC = () => (
  <footer className="site-footer">
    <strong>健文社区</strong>
    <span>© {new Date().getFullYear()} · 学习与训练，持续发生</span>
    <div><AppreciationCard mode="button" title="支持社区" /><Link to="/guide">使用指南 <ArrowUpRight size={18} /></Link></div>
  </footer>
);
export default Footer;
