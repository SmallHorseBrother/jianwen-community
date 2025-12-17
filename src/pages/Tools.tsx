/**
 * 工具箱页面
 * 集成提议功能：
 * 1. 原有工具列表
 * 2. 新增"提议"按钮/卡片
 * 3. 公开的提议列表
 */

import React, { useState, useEffect } from 'react';
import { Dumbbell, FileText, Sparkles, ExternalLink, MessageSquarePlus, X, Send, User, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { submitSuggestion, getAllSuggestions } from '../services/suggestionService';
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
      <div className="p-6">
        <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center text-white mb-4`}>
          {tool.icon}
        </div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-lg font-bold text-gray-800">{tool.title}</h3>
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
      
      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{suggestion.description}</p>
      
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
      title: '健身工具',
      description: '引体向上指数计算、1RM估算等健身相关工具',
      icon: <Dumbbell className="w-8 h-8" />,
      link: 'https://pullupindex.top',
      isExternal: true,
      color: 'from-green-500 to-emerald-600',
      status: 'active',
    },

    {
      title: '会议/长文总结',
      description: 'AI 驱动的会议记录和长文章智能总结',
      icon: <FileText className="w-8 h-8" />,
      link: '/tools/summary',
      isExternal: false,
      color: 'from-blue-500 to-indigo-600',
      status: 'coming',
    },
    {
      title: 'AI 助手',
      description: '更多 AI 工具正在开发中...',
      icon: <Sparkles className="w-8 h-8" />,
      link: '/tools/ai',
      isExternal: false,
      color: 'from-purple-500 to-pink-600',
      status: 'coming',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 pb-20">
      {/* Hero */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white py-12 px-4 shadow-lg mb-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 flex items-center justify-center gap-3">
            <span role="img" aria-label="tools">🛠️</span> 工具箱
          </h1>
          <p className="text-indigo-100 text-lg opacity-90">
            实用工具集合，提升你的效率与体验
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        {/* 工具列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {tools.map((tool) => (
            <ToolCardComponent key={tool.title} tool={tool} />
          ))}
        </div>

        {/* 公开建议区 - 瀑布流布局 */}
        <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-6 md:p-8 border border-white/60 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-gray-100 pb-4">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-800">
                社区心声
                <span className="hidden md:inline-block ml-3 text-sm font-normal text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  大家正在期待这些功能
                </span>
              </h2>
            </div>
            <button
              onClick={handleOpenModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm hover:shadow-md active:scale-95"
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
