/**
 * 工具箱页面 / 产品实验室
 * 集成提议功能：
 * 1. 展示个人产品与项目入口
 * 2. 保留社区共创反馈
 */

import React, { useState, useEffect } from 'react';
import { Dumbbell, FileText, Sparkles, ExternalLink, MessageSquarePlus, X, Send, User, MessageCircle, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { submitSuggestion, getAllSuggestions } from '../services/suggestionService';
import AppreciationCard from '../components/Common/AppreciationCard';
import type { Database } from '../lib/database.types';

type Suggestion = Database['public']['Tables']['suggestions']['Row'];

interface ToolCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  link?: string;
  onClick?: () => void;
  isExternal: boolean;
  color: string;
  status: 'active' | 'coming';
}

const ToolCardComponent: React.FC<{ tool: ToolCard }> = ({ tool }) => {
  const isActive = tool.status === 'active';

  const CardContent = () => (
    <div
      onClick={tool.onClick}
      className={`relative bg-white rounded-2xl shadow-sm overflow-hidden transition-all duration-300 ${
        isActive ? 'hover:shadow-xl hover:-translate-y-1 cursor-pointer' : 'opacity-75'
      }`}
    >
      <div className={`h-2 bg-gradient-to-r ${tool.color}`} />
      <div className="p-5 sm:p-6">
        <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white sm:h-16 sm:w-16 ${tool.color}`}>
          {tool.icon}
        </div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-base font-bold text-gray-800 sm:text-lg">{tool.title}</h3>
          {tool.isExternal && isActive && <ExternalLink className="w-4 h-4 text-gray-400" />}
        </div>
        <p className="text-gray-500 text-sm">{tool.description}</p>
        {!isActive && (
          <div className="mt-4">
            <span className="inline-block px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs">🚧 开发中</span>
          </div>
        )}
      </div>
    </div>
  );

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
  onSubmit: (title: string, description: string, category: 'fitness_tool' | 'learning_tool' | 'community' | 'other') => Promise<void>;
  isSubmitting: boolean;
}> = ({ isOpen, onClose, onSubmit, isSubmitting }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'fitness_tool' | 'learning_tool' | 'community' | 'other'>('other');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(title, description, category);
    setTitle('');
    setDescription('');
    setCategory('other');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">💡 提交新想法</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="简短描述你的想法..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">类别</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="fitness_tool">💪 健身工具</option>
              <option value="learning_tool">📚 学习工具</option>
              <option value="community">👥 社区功能</option>
              <option value="other">✨ 其他建议</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">详细描述</label>
            <textarea
              required
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
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
      </div>
    </div>
  );
};

const SuggestionItem: React.FC<{ suggestion: Suggestion }> = ({ suggestion }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLongText = suggestion.description.length > 60;

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-gray-100 text-gray-600',
      reviewing: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-purple-100 text-purple-700',
      rejected: 'bg-red-50 text-red-500',
    };
    
    const labels = {
      pending: '待处理',
      reviewing: '审核中',
      approved: '已采纳',
      in_progress: '开发中',
      completed: '已上线',
      rejected: '未采纳',
    };

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(styles as any)[status] || styles.pending}`}>
        {(labels as any)[status] || status}
      </span>
    );
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'fitness_tool': return '💪';
      case 'learning_tool': return '📚';
      case 'community': return '👥';
      default: return '✨';
    }
  };

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 hover:border-gray-200 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl" role="img" aria-label="category">{getCategoryIcon(suggestion.category || 'other')}</span>
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
      alert('请先登录后再提交建议');
      // window.location.href = '/login'; 
      return;
    }
    setIsModalOpen(true);
  };

  const handleSubmitSuggestion = async (title: string, description: string, category: any) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await submitSuggestion(title, description, category, user.id, user.nickname);
      setIsModalOpen(false);
      // 刷新列表
      fetchSuggestions();
      alert('建议提交成功！感谢你的反馈 🎉');
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      alert('提交失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tools: ToolCard[] = [
    {
      title: 'Jianwen OS',
      description: '我的个人主页、AI 分身和公开资料中心，适合快速了解我正在做什么。',
      icon: <Sparkles className="w-8 h-8" />,
      link: '/about',
      isExternal: false,
      color: 'from-cyan-500 to-blue-600',
      status: 'active',
    },
    {
      title: '问题星球',
      description: '粉丝提问、真人回答和群友帮答的内容社区，也是后续内容输出的选题池。',
      icon: <MessageCircle className="w-8 h-8" />,
      link: '/qa',
      isExternal: false,
      color: 'from-fuchsia-500 to-pink-600',
      status: 'active',
    },
    {
      title: 'Pull-up Index',
      description: '引体向上指数、1RM 估算等训练数据工具，服务健身方向的内容和咨询。',
      icon: <Dumbbell className="w-8 h-8" />,
      link: 'https://pullupindex.top',
      isExternal: true,
      color: 'from-green-500 to-emerald-600',
      status: 'active',
    },

    {
      title: 'MinuteMaster AI',
      description: 'AI 会议总结助手，将会议记录快速整理成结构化纪要和待办。',
      icon: <FileText className="w-8 h-8" />,
      link: 'https://minutemaster-ai-394979688664.us-west1.run.app',
      isExternal: true,
      color: 'from-blue-500 to-indigo-600',
      status: 'active',
    },
    {
      title: 'NutriLens AI',
      description: 'AI 食物识别与营养估算工具，用来辅助饮食记录和健身管理。',
      icon: <UtensilsCrossed className="w-8 h-8" />,
      link: 'https://nutrilens-ai-food-weight-nutrition-estimator-394979688664.us-west1.run.app',
      isExternal: true,
      color: 'from-orange-500 to-red-600',
      status: 'active',
    },
    {
      title: 'AI CoachLink',
      description: 'AI 健身计划助手，围绕目标、训练经验和可用时间生成训练建议。',
      icon: <Sparkles className="w-8 h-8" />,
      link: 'https://ai-coachlink-394979688664.us-west1.run.app',
      isExternal: true,
      color: 'from-violet-500 to-purple-600',
      status: 'active',
    },
  ];

  return (
    <div className="page-aurora min-h-screen pb-20">
      {/* Hero */}
      <div className="hero-cyber mb-6 rounded-2xl px-4 py-9 text-white sm:mb-8 sm:rounded-[2rem] sm:py-12">
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4 flex items-center justify-center gap-3 bg-gradient-to-r from-white via-cyan-100 to-fuchsia-100 bg-clip-text text-transparent">
            产品实验室
          </h1>
          <p className="text-base leading-7 text-slate-200 opacity-90 sm:text-lg">
            这里集中放我自己做的产品、实验项目和社区入口。好用的留下，没用的继续迭代。
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-1.5 sm:px-4">
        {/* 工具列表 */}
        <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:mb-16 lg:grid-cols-4 lg:gap-6">
          {tools.map((tool) => (
            <ToolCardComponent key={tool.title} tool={tool} />
          ))}
        </div>

        {/* 公开建议区 - 瀑布流布局 */}
        <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-4 shadow-sm backdrop-blur-sm sm:rounded-3xl md:p-8">
          <div className="mb-6 flex flex-col justify-between gap-4 border-b border-white/10 pb-4 md:mb-8 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-white sm:text-2xl">
                产品共创反馈
                <span className="hidden md:inline-block ml-3 text-sm font-normal text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  告诉我哪些产品值得继续做
                </span>
              </h2>
            </div>
          <button
              onClick={handleOpenModal}
              className="neon-button flex items-center gap-2 px-4 py-2 text-white rounded-xl transition-all active:scale-95"
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span>我有好点子</span>
            </button>
          </div>

          {isLoadingList ? (
            <div className="text-center py-12 text-gray-400">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              加载中...
            </div>
          ) : suggestions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suggestions.map((suggestion) => (
                <SuggestionItem key={suggestion.id} suggestion={suggestion} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              <p className="text-gray-500 mb-2">还没有人提议哦</p>
              <button 
                onClick={handleOpenModal}
                className="text-blue-600 font-medium hover:underline"
              >
                成为第一个提议的人
              </button>
            </div>
          )}
        </div>

        {/* 赞赏支持 */}
        <div className="mt-12">
          <AppreciationCard 
            title="工具好用吗？" 
            description="如果这些产品对你有帮助，欢迎赞赏支持我继续迭代。"
          />
        </div>
      </div>

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
