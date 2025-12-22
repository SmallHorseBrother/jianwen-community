/**
 * Q&A 详情页 - 单个问答展示
 * 支持马健文回答 + 群友帮答
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Eye, Tag, Share2, Star, User, Send, Users, Trash2 } from 'lucide-react';
import { getQuestionById, getCommunityAnswers, submitCommunityAnswer, deleteCommunityAnswer } from '../services/questionService';
import { useAuth } from '../contexts/AuthContext';
import type { Database } from '../lib/database.types';

type Question = Database['public']['Tables']['questions']['Row'];
type CommunityAnswer = Database['public']['Tables']['community_answers']['Row'];

const QADetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  const [question, setQuestion] = useState<Question | null>(null);
  const [communityAnswers, setCommunityAnswers] = useState<CommunityAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  
  // 回答表单
  const [answerContent, setAnswerContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      loadData(id);
    }
  }, [id]);

  const loadData = async (questionId: string) => {
    try {
      setLoading(true);
      const [questionData, answersData] = await Promise.all([
        getQuestionById(questionId),
        getCommunityAnswers(questionId)
      ]);
      setQuestion(questionData);
      setCommunityAnswers(answersData);
    } catch (error) {
      console.error('加载问答失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    // 生成分享文案：品牌 + 问题标题 + 状态 + 链接
    const shareText = question 
      ? `【健文社区】\n「${question.content.length > 50 ? question.content.substring(0, 50) + '...' : question.content}」\n\n${question.answer ? '✅ 马健文已回答' : '⏳ 等待回答'}${(question.community_answer_count ?? 0) > 0 ? ` · ${question.community_answer_count}条群友帮答` : ''}\n👉 ${url}`
      : url;
    
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('textarea');
      input.value = shareText;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || !answerContent.trim()) return;

    setSubmitting(true);
    try {
      const newAnswer = await submitCommunityAnswer(id, answerContent.trim(), user.id, user.nickname);
      setCommunityAnswers(prev => [...prev, newAnswer]);
      setAnswerContent('');
    } catch (error) {
      console.error('提交回答失败:', error);
      alert('提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnswer = async (answerId: string) => {
    if (!confirm('确定要删除这条回答吗？')) return;
    
    try {
      await deleteCommunityAnswer(answerId);
      setCommunityAnswers(prev => prev.filter(a => a.id !== answerId));
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请稍后重试');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const renderMarkdown = (text: string) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    
    return lines.map((line, index) => {
      if (line.startsWith('### ')) {
        return <h3 key={index} className="text-lg font-bold mt-4 mb-2">{line.slice(4)}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={index} className="text-xl font-bold mt-6 mb-3">{line.slice(3)}</h2>;
      }
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-2xl font-bold mt-6 mb-3">{line.slice(2)}</h1>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={index} className="ml-4">{line.slice(2)}</li>;
      }
      if (/^\d+\. /.test(line)) {
        return <li key={index} className="ml-4 list-decimal">{line.replace(/^\d+\. /, '')}</li>;
      }
      if (!line.trim()) {
        return <br key={index} />;
      }
      
      let processed = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded">$1</code>');
      
      return (
        <p 
          key={index} 
          className="mb-2"
          dangerouslySetInnerHTML={{ __html: processed }}
        />
      );
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-500 mt-3">加载中...</p>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg mb-4">问答不存在或已被删除</p>
          <Link to="/" className="text-blue-600 hover:text-blue-700 font-medium">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pb-12">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>返回</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition"
          >
            <Share2 className="w-5 h-5" />
            <span>{copied ? '已复制!' : '分享'}</span>
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <article className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* 问题区 */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 md:p-8">
            {question.is_featured && (
              <div className="flex items-center gap-1 text-yellow-300 text-sm mb-3">
                <Star className="w-4 h-4 fill-current" />
                <span>精选问答</span>
              </div>
            )}
            <h1 className="text-xl md:text-2xl font-bold leading-relaxed">
              {question.content}
            </h1>
            <div className="flex flex-wrap items-center gap-4 mt-4 text-blue-100 text-sm">
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {question.is_anonymous ? '匿名用户' : question.asker_nickname || '用户'}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(question.created_at)}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {question.view_count} 次浏览
              </span>
            </div>
          </div>

          {/* 马健文回答区 */}
          {question.answer && (
            <div className="p-6 md:p-8 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                  马
                </div>
                <div>
                  <p className="font-medium text-gray-800">马健文</p>
                  <p className="text-sm text-gray-500">
                    回答于 {question.answered_at ? formatDate(question.answered_at) : '未知'}
                  </p>
                </div>
              </div>

              <div className="prose prose-blue max-w-none text-gray-700 leading-relaxed">
                {renderMarkdown(question.answer)}
              </div>
            </div>
          )}

          {/* 群友帮答区 */}
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-bold text-gray-800">
                群友帮答
                {communityAnswers.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({communityAnswers.length} 条回答)
                  </span>
                )}
              </h2>
            </div>

            {/* 群友回答列表 */}
            {communityAnswers.length > 0 ? (
              <div className="space-y-4 mb-6">
                {communityAnswers.map((answer) => (
                  <div key={answer.id} className="bg-orange-50 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-orange-200 rounded-full flex items-center justify-center text-orange-700 text-sm font-medium">
                          {answer.user_nickname.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{answer.user_nickname}</p>
                          <p className="text-xs text-gray-500">{formatDate(answer.created_at)}</p>
                        </div>
                      </div>
                      {user?.id === answer.user_id && (
                        <button
                          onClick={() => handleDeleteAnswer(answer.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="删除回答"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                      {answer.content}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-xl mb-6">
                <p className="text-gray-400 text-sm">暂无群友回答</p>
                <p className="text-gray-400 text-xs mt-1">成为第一个帮助解答的人吧！</p>
              </div>
            )}

            {/* 提交回答表单 */}
            {isAuthenticated ? (
              <form onSubmit={handleSubmitAnswer} className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">💬 我来回答</p>
                <textarea
                  value={answerContent}
                  onChange={(e) => setAnswerContent(e.target.value)}
                  placeholder="分享你的见解和经验..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none text-sm"
                />
                <div className="flex justify-end mt-3">
                  <button
                    type="submit"
                    disabled={submitting || !answerContent.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition"
                  >
                    {submitting ? '提交中...' : (
                      <>
                        <Send className="w-4 h-4" />
                        提交回答
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-6 bg-gray-50 rounded-xl">
                <p className="text-gray-500 text-sm mb-2">登录后可以参与回答</p>
                <Link
                  to="/login"
                  className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                >
                  去登录
                </Link>
              </div>
            )}
          </div>

          {/* 标签 */}
          {question.tags && question.tags.length > 0 && (
            <div className="px-6 md:px-8 pb-6 border-t border-gray-100 pt-6">
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="w-4 h-4 text-gray-400" />
                {question.tags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/?tag=${tag}`}
                    className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm hover:bg-blue-100 transition"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* 底部提示 */}
        <div className="text-center mt-8">
          <p className="text-gray-500 text-sm mb-3">还有问题想问？</p>
          <Link
            to="/"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition"
          >
            去提问
          </Link>
        </div>
      </div>
    </div>
  );
};

export default QADetail;
