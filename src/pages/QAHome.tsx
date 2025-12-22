/**
 * Q&A 主页 - 马健文的数字大脑
 * 左侧: 向我提问
 * 右侧: 问答列表
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Search, Tag, Star, ChevronRight, Send, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getPublishedQuestions, submitQuestion, getAllTags } from '../services/questionService';
import AppreciationCard from '../components/Common/AppreciationCard';
import type { Database } from '../lib/database.types';

type Question = Database['public']['Tables']['questions']['Row'];

const QAHome: React.FC = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [featuredQuestions, setFeaturedQuestions] = useState<Question[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 20;

  // 提问表单状态
  const [questionContent, setQuestionContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedTag, searchQuery]);

  const loadData = async (isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const currentOffset = isLoadMore ? offset : 0;

      const [questionsResult, featuredResult, tagsResult] = await Promise.all([
        getPublishedQuestions({ 
          limit: PAGE_SIZE, 
          offset: currentOffset,
          tag: selectedTag || undefined,
          searchQuery: searchQuery || undefined 
        }),
        // Only fetch featured and tags on initial load
        !isLoadMore ? getPublishedQuestions({ featuredOnly: true, limit: 5 }) : Promise.resolve(null),
        !isLoadMore ? getAllTags() : Promise.resolve(null),
      ]);

      if (isLoadMore) {
        setQuestions(prev => [...prev, ...questionsResult.questions]);
      } else {
        setQuestions(questionsResult.questions);
        if (featuredResult) setFeaturedQuestions(featuredResult.questions);
        if (tagsResult) setTags(tagsResult);
      }

      // Check if there are more questions
      setHasMore(currentOffset + questionsResult.questions.length < questionsResult.total);
      setOffset(currentOffset + questionsResult.questions.length);

    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    loadData(true);
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionContent.trim()) return;

    try {
      setSubmitting(true);
      await submitQuestion(questionContent.trim(), {
        isAnonymous,
        askerId: user?.id,
        askerNickname: user?.nickname || '用户',
      });
      setQuestionContent('');
      setSubmitSuccess(true);
      // 提交成功后刷新列表
      loadData();
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (error) {
      console.error('提交问题失败:', error);
      alert('提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            🧠 马健文的数字大脑
          </h1>
          <p className="text-blue-100 text-lg max-w-2xl mx-auto">
            有问题？尽管问！这里是我的公开知识库，你的问题可能帮助更多人。
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧: 提问区 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-4">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-blue-600" />
                向我提问
              </h2>

              {user ? (
                <form onSubmit={handleSubmitQuestion}>
                  <textarea
                    value={questionContent}
                    onChange={(e) => setQuestionContent(e.target.value)}
                    placeholder="输入你的问题...&#10;&#10;例如：考研如何平衡学习和健身？"
                    className="w-full h-32 p-4 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    maxLength={500}
                  />
                  <div className="flex items-center justify-between mt-3">
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      匿名提问
                    </label>
                    <span className="text-xs text-gray-400">
                      {questionContent.length}/500
                    </span>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || !questionContent.trim()}
                    className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 px-4 rounded-xl transition flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <span className="animate-spin">⏳</span>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        提交问题
                      </>
                    )}
                  </button>
                  {submitSuccess && (
                    <p className="mt-3 text-green-600 text-sm text-center">
                      ✅ 问题已提交，等待回答中...
                    </p>
                  )}
                </form>
              ) : (
                <div className="text-center py-6">
                  <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-4">登录后即可提问</p>
                  <Link
                    to="/login"
                    className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition"
                  >
                    去登录
                  </Link>
                </div>
              )}

              {/* 热门标签 */}
              {tags.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-1">
                    <Tag className="w-4 h-4" />
                    热门话题
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {tags.slice(0, 10).map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                        className={`px-3 py-1 rounded-full text-sm transition ${
                          selectedTag === tag
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 赞赏入口 */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <AppreciationCard mode="compact" />
              </div>
            </div>
          </div>

          {/* 右侧: 问答列表 */}
          <div className="lg:col-span-2">
            {/* 搜索栏 */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索问答..."
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* 精选问答 */}
            {featuredQuestions.length > 0 && !selectedTag && !searchQuery && (
              <div className="mb-8">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  精选问答
                </h2>
                <div className="grid gap-4">
                  {featuredQuestions.map((q) => (
                    <Link
                      key={q.id}
                      to={`/qa/${q.id}`}
                      className="block bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4 hover:shadow-md transition"
                    >
                      <p className="font-medium text-gray-800 line-clamp-2">{q.content}</p>
                      <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                        <span>{formatDate(q.answered_at || q.created_at)}</span>
                        {q.tags?.slice(0, 2).map((tag) => (
                          <span key={tag} className="text-yellow-600">#{tag}</span>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 问答列表 */}
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">
                {selectedTag ? `#${selectedTag} 相关问答` : '知识广场'}
              </h2>

              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-gray-500 mt-3">加载中...</p>
                </div>
              ) : questions.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl">
                  <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">
                    {searchQuery ? '没有找到相关问答' : '暂无问答，快来提第一个问题吧！'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {questions.map((q) => (
                    <Link
                      key={q.id}
                      to={`/qa/${q.id}`}
                      className={`block rounded-xl p-5 hover:shadow-lg transition group ${
                        q.status === 'pending' 
                          ? 'bg-yellow-50 border-2 border-yellow-200 border-dashed' 
                          : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-800 group-hover:text-blue-600 transition line-clamp-2">
                              {q.content}
                            </p>
                            {q.status === 'pending' && (
                              <span className="flex-shrink-0 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                                ⏳ 待回答
                              </span>
                            )}
                          </div>
                          {q.answer ? (
                            <p className="text-gray-500 text-sm mt-2 line-clamp-2">
                              {q.answer.replace(/[#*`]/g, '').substring(0, 100)}...
                            </p>
                          ) : (
                            <p className="text-yellow-600 text-sm mt-2 italic">
                              期待马健文的回答...
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-3 text-sm text-gray-400">
                            <span>{q.is_anonymous ? '匿名' : q.asker_nickname || '用户'}</span>
                            <span>·</span>
                            <span>{formatDate(q.answered_at || q.created_at)}</span>
                            <span>👁 {q.view_count}</span>
                            {(q.community_answer_count ?? 0) > 0 && (
                              <span className="text-orange-500">💬 {q.community_answer_count} 条帮答</span>
                            )}
                            {q.tags?.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-blue-500">#{tag}</span>
                            ))}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* 加载更多按钮 */}
              {questions.length > 0 && hasMore && (
                <div className="mt-8 text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-6 py-2 bg-white border border-gray-200 text-gray-600 rounded-full hover:bg-gray-50 hover:border-blue-300 hover:text-blue-600 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                  >
                    {loadingMore ? (
                      <>
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-blue-600 rounded-full animate-spin"></div>
                        加载中...
                      </>
                    ) : (
                      <>
                        加载更多
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QAHome;
