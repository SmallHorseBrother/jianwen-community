/**
 * 工具箱页面 / 产品实验室
 * 集成提议功能：
 * 1. 展示个人产品与项目入口
 * 2. 保留社区共创反馈
 */

import React, { useState, useEffect } from 'react';
import { Dumbbell, Sparkles, MessageSquarePlus, Send, User, MessageCircle, UtensilsCrossed, ArrowUpRight, GitBranch, BookOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { submitSuggestion, getAllSuggestions } from '../services/suggestionService';
import Dialog from '../components/Common/Dialog';
import type { Database } from '../lib/database.types';

type Suggestion = Database['public']['Tables']['suggestions']['Row'];
type SuggestionCategory = 'fitness_tool' | 'learning_tool' | 'community' | 'other';

interface ToolCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  link?: string;
  onClick?: () => void;
  isExternal: boolean;
  status: 'active' | 'coming';
}

const ToolCardComponent: React.FC<{ tool: ToolCard }> = ({ tool }) => {
  const isActive = tool.status === 'active';

  const CardContent = () => <article className="product-card">
    {tool.icon}<h2>{tool.title}</h2><p>{tool.description}</p><div className="product-card-footer"><span>{isActive ? '打开产品' : '开发中'}</span>{isActive && <ArrowUpRight />}</div>
  </article>;

  if (isActive && tool.link) {
    if (tool.isExternal) {
      return (
        <a href={tool.link} target="_blank" rel="noopener noreferrer">
          <CardContent />
        </a>
      );
    }
    return (
      <a href={tool.link}>
        <CardContent />
      </a>
    );
  }

  return <CardContent />;
};

const SuggestionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, description: string, category: SuggestionCategory) => Promise<boolean>;
  isSubmitting: boolean;
}> = ({ isOpen, onClose, onSubmit, isSubmitting }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'fitness_tool' | 'learning_tool' | 'community' | 'other'>('other');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!await onSubmit(title, description, category)) return;
    setTitle('');
    setDescription('');
    setCategory('other');
  };

  return (
    <Dialog title="提交产品建议" onClose={onClose} dismissDisabled={isSubmitting}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
            <input
              type="text"
              required
              aria-label="建议标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="简短描述你的想法..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">类别</label>
            <select
              aria-label="建议类别"
              value={category}
              onChange={(e) => setCategory(e.target.value as SuggestionCategory)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="fitness_tool">健身工具</option>
              <option value="learning_tool">学习工具</option>
              <option value="community">社区功能</option>
              <option value="other">其他建议</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">详细描述</label>
            <textarea
              required
              aria-label="建议详情"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="具体希望实现什么样的功能？为什么需要这个功能？"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="jw-action w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>正在提交...</>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  提交建议
                </>
              )}
            </button>
          </div>
        </form>
    </Dialog>
  );
};

const SuggestionItem: React.FC<{ suggestion: Suggestion }> = ({ suggestion }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLongText = suggestion.description.length > 60;

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-600',
      reviewing: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-purple-100 text-purple-700',
      rejected: 'bg-red-50 text-red-500',
    };
    
    const labels: Record<string, string> = {
      pending: '待处理',
      reviewing: '审核中',
      approved: '已采纳',
      in_progress: '开发中',
      completed: '已上线',
      rejected: '未采纳',
    };

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };


  return (
    <div className="suggestion-item">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <MessageCircle size={22} aria-hidden="true" />
          <h4 className="font-bold text-gray-900 line-clamp-1">{suggestion.title}</h4>
        </div>
        {getStatusBadge(suggestion.status || 'pending')}
      </div>
      
      <div className="mb-3">
        <p className={`text-gray-600 text-sm ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-3'}`}>
          {suggestion.description}
        </p>
        {isLongText && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="text-blue-600 text-xs mt-2 hover:underline focus:outline-none font-medium"
          >
            {isExpanded ? '收起 ▲' : '展开全文 ▼'}
          </button>
        )}
      </div>
      
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <User className="w-3 h-3" />
          <span>{suggestion.user_nickname || '匿名用户'}</span>
        </div>
        <span>{new Date(suggestion.created_at).toLocaleDateString()}</span>
      </div>

      {suggestion.admin_notes && (
        <div className="mt-3 pt-3 border-t border-gray-50 text-xs">
          <span className="font-semibold text-blue-600">管理员回复: </span>
          <span className="text-gray-600">{suggestion.admin_notes}</span>
        </div>
      )}
    </div>
  );
};

const Tools: React.FC = () => {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [submissionFeedback, setSubmissionFeedback] = useState('');

  const fetchSuggestions = async () => {
    try {
      const data = await getAllSuggestions({ limit: 20 });
      setSuggestions(data);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const handleOpenModal = () => {
    if (!user) {
      // 如果未登录，提示或跳转
      window.location.assign('/login');
      // window.location.href = '/login'; 
      return;
    }
    setSubmissionFeedback('');
    setIsModalOpen(true);
  };

  const handleSubmitSuggestion = async (title: string, description: string, category: SuggestionCategory) => {
    if (!user) return false;
    setIsSubmitting(true);
    try {
      await submitSuggestion(title, description, category, user.id, user.nickname);
      setIsModalOpen(false);
      // 刷新列表
      fetchSuggestions();
      setSubmissionFeedback('建议已提交，谢谢你的反馈。');
      return true;
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      alert('提交失败，请稍后重试');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const tools: ToolCard[] = [
    {
      title: '人脉星图',
      description: '从群友的自我介绍出发，发现共同方向、资源与合作机会。',
      icon: <GitBranch className="w-8 h-8" />,
      link: '/network',
      isExternal: false,
      status: 'active',
    },
    {
      title: '食探',
      description: '拍照记录饮食，了解热量与营养。',
      icon: <UtensilsCrossed className="w-8 h-8" />,
      link: 'https://healthymax.cn/',
      isExternal: true,
      status: 'active',
    },
    {
      title: '教链',
      description: '连接教练与学员，让训练计划与反馈更顺畅。',
      icon: <Sparkles className="w-8 h-8" />,
      link: 'https://coachlink.fit/',
      isExternal: true,
      status: 'active',
    },
    {
      title: 'Pull-up Index',
      description: '记录引体向上，量化训练表现。已接入教链。',
      icon: <Dumbbell className="w-8 h-8" />,
      link: 'https://pullupindex.top/',
      isExternal: true,
      status: 'active',
    },
    {
      title: 'AI 创造的奇迹',
      description: '按时间和领域探索 AI 解决真实问题的案例，附原始来源与研究边界。开源共创。',
      icon: <BookOpen className="w-8 h-8" />,
      link: '/ai/miracles',
      isExternal: false,
      status: 'active',
    },
  ];

  return (
    <div className="redesign-products">
      <header className="page-heading"><div><h1>产品</h1><p>把想法做成好用的东西。</p></div><button type="button" onClick={handleOpenModal} className="jw-action"><MessageSquarePlus />提个建议</button></header>
      <div className="products-grid">{tools.map((tool) => <ToolCardComponent key={tool.title} tool={tool} />)}</div>
      {submissionFeedback && <p className="py-4" role="status">{submissionFeedback}</p>}
      <section className="product-feedback"><div className="product-feedback-heading"><h2>产品共创反馈</h2><button type="button" className="jw-action secondary" onClick={handleOpenModal}>我有好点子</button></div>
        {isLoadingList ? <p className="py-12 text-center" role="status">正在加载反馈…</p> : suggestions.length ? <div className="grid grid-cols-1 md:grid-cols-2 gap-5">{suggestions.map((suggestion) => <SuggestionItem key={suggestion.id} suggestion={suggestion} />)}</div> : <p className="py-12 text-center">还没有产品反馈，欢迎留下你的建议。</p>}
      </section>
      <SuggestionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitSuggestion}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default Tools;
