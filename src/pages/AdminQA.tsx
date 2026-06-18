/**
 * Q&A 管理后台 - 回答问题
 * 仅管理员可访问
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageCircle, Check, X, Star, Trash2, 
  Clock, CheckCircle, XCircle, Filter, Save,
  AlertTriangle, Loader2, Network
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  checkIsAdmin,
  getAllQuestions,
  answerQuestion,
  updateQuestionStatus,
  toggleFeatured,
  deleteQuestions,
  getRelatedQuestionsForAdmin,
  QUESTION_TOPICS,
  normalizeQuestionTopic,
} from '../services/questionService';
import type { AdminRelatedQuestion } from '../services/questionService';
import type { Database, QuestionStatus } from '../lib/database.types';

type Question = Database['public']['Tables']['questions']['Row'];
type AdminSort = 'latest' | 'same' | 'source' | 'high_unanswered';

const AdminQA: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filterStatus, setFilterStatus] = useState<QuestionStatus | 'all'>('pending');
  const [filterTopic, setFilterTopic] = useState<string>('all');
  const [sortMode, setSortMode] = useState<AdminSort>('high_unanswered');
  
  // 编辑状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAnswer, setEditAnswer] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editTopic, setEditTopic] = useState<string>('其他');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [relatedDeleteItems, setRelatedDeleteItems] = useState<AdminRelatedQuestion[]>([]);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState<Set<string>>(new Set());
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      loadQuestions();
    }
  }, [isAdmin, filterStatus]);

  const checkAdminAccess = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    const adminStatus = await checkIsAdmin(user.id);
    setIsAdmin(adminStatus);
    setLoading(false);
    
    if (!adminStatus) {
      alert('您没有管理员权限');
      navigate('/');
    }
  };

  const loadQuestions = async () => {
    try {
      const data = await getAllQuestions(filterStatus === 'all' ? undefined : filterStatus);
      setQuestions(data);
    } catch (error) {
      console.error('加载问题失败:', error);
    }
  };

  const handleStartEdit = (question: Question) => {
    setEditingId(question.id);
    setEditAnswer(question.answer || '');
    setEditTags(question.tags?.join(', ') || '');
    setEditTopic(normalizeQuestionTopic(question.topic));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditAnswer('');
    setEditTags('');
    setEditTopic('其他');
  };

  const handleSaveAnswer = async (questionId: string) => {
    if (!editAnswer.trim()) {
      alert('请输入回答内容');
      return;
    }

    try {
      setSaving(true);
      const tags = editTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t);
      
      await answerQuestion(questionId, editAnswer.trim(), tags, {
        topic: editTopic,
      });
      await loadQuestions();
      handleCancelEdit();
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleIgnore = async (questionId: string) => {
    if (!confirm('确定要忽略这个问题吗？')) return;
    
    try {
      await updateQuestionStatus(questionId, 'ignored');
      await loadQuestions();
    } catch (error) {
      console.error('操作失败:', error);
    }
  };

  const handleOpenDeleteReview = async (question: Question) => {
    setDeleteTarget(question);
    setRelatedDeleteItems([]);
    setSelectedDeleteIds(new Set([question.id]));
    setDeleteError(null);
    setDeleteLoading(true);

    try {
      const related = await getRelatedQuestionsForAdmin(question.id, 12);
      setRelatedDeleteItems(related);
    } catch (error) {
      console.error('加载相似问题失败:', error);
      setDeleteError('相似问题加载失败，可以只删除当前问题，或稍后重试。');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCloseDeleteReview = () => {
    if (deleteSaving) return;
    setDeleteTarget(null);
    setRelatedDeleteItems([]);
    setSelectedDeleteIds(new Set());
    setDeleteError(null);
  };

  const handleToggleDeleteSelection = (questionId: string) => {
    if (questionId === deleteTarget?.id) return;
    setSelectedDeleteIds((current) => {
      const next = new Set(current);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  const handleSelectAllRelated = () => {
    if (!deleteTarget) return;
    setSelectedDeleteIds(new Set([
      deleteTarget.id,
      ...relatedDeleteItems.map((item) => item.question.id),
    ]));
  };

  const handleClearRelated = () => {
    if (!deleteTarget) return;
    setSelectedDeleteIds(new Set([deleteTarget.id]));
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    const idsToDelete = Array.from(selectedDeleteIds);
    if (!confirm(`确定要删除选中的 ${idsToDelete.length} 个问题吗？此操作不可恢复。`)) return;

    try {
      setDeleteSaving(true);
      await deleteQuestions(idsToDelete);
      handleCloseDeleteReview();
      await loadQuestions();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
    } finally {
      setDeleteSaving(false);
    }
  };

  const handleToggleFeatured = async (question: Question) => {
    try {
      await toggleFeatured(question.id, !question.is_featured);
      await loadQuestions();
    } catch (error) {
      console.error('操作失败:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatScore = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '--';
    return `${Math.round(value * 100)}%`;
  };

  const getStatusBadge = (status: QuestionStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="flex items-center gap-1 text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full text-xs">
            <Clock className="w-3 h-3" />
            待回答
          </span>
        );
      case 'published':
        return (
          <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs">
            <CheckCircle className="w-3 h-3" />
            已发布
          </span>
        );
      case 'ignored':
        return (
          <span className="flex items-center gap-1 text-gray-500 bg-gray-100 px-2 py-1 rounded-full text-xs">
            <XCircle className="w-3 h-3" />
            已忽略
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const pendingCount = questions.filter((q) => q.status === 'pending').length;
  const visibleQuestions = questions
    .filter((question) => filterTopic === 'all' || normalizeQuestionTopic(question.topic) === filterTopic)
    .sort((left, right) => {
      if (sortMode === 'same') {
        return (right.same_question_count || 0) - (left.same_question_count || 0);
      }
      if (sortMode === 'source') {
        return (right.source_count || 0) - (left.source_count || 0);
      }
      if (sortMode === 'high_unanswered') {
        const leftScore =
          (left.answer ? 0 : 100000) +
          (left.audience_value === 'high' ? 10000 : 0) +
          (left.same_question_count || 0) * 100 +
          (left.source_count || 0);
        const rightScore =
          (right.answer ? 0 : 100000) +
          (right.audience_value === 'high' ? 10000 : 0) +
          (right.same_question_count || 0) * 100 +
          (right.source_count || 0);
        return rightScore - leftScore;
      }
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
  const selectedRelatedCount = relatedDeleteItems.filter((item) =>
    selectedDeleteIds.has(item.question.id),
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-blue-600" />
              Q&A 管理后台
            </h1>
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-sm px-3 py-1 rounded-full">
                {pendingCount} 条待回答
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* 筛选器 */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500">筛选:</span>
          {(['all', 'pending', 'published', 'ignored'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1 rounded-full text-sm transition ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {status === 'all' ? '全部' : 
               status === 'pending' ? '待回答' :
               status === 'published' ? '已发布' : '已忽略'}
            </button>
          ))}
          <select
            value={filterTopic}
            onChange={(event) => setFilterTopic(event.target.value)}
            className="px-3 py-1 rounded-full text-sm bg-white text-gray-600 border border-gray-200"
          >
            <option value="all">全部分类</option>
            {QUESTION_TOPICS.map((topic) => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as AdminSort)}
            className="px-3 py-1 rounded-full text-sm bg-white text-gray-600 border border-gray-200"
          >
            <option value="high_unanswered">高价值未回答</option>
            <option value="same">同问最多</option>
            <option value="source">来源最多</option>
            <option value="latest">最新提交</option>
          </select>
        </div>

        {/* 问题列表 */}
        {visibleQuestions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">暂无问题</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleQuestions.map((question) => (
              <div
                key={question.id}
                className="bg-white rounded-xl shadow-sm overflow-hidden"
              >
                {/* 问题头部 */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{question.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                        <span>
                          {question.is_anonymous ? '匿名' : question.asker_nickname || '用户'}
                        </span>
                        <span>{formatDate(question.created_at)}</span>
                        {getStatusBadge(question.status)}
                        {question.is_featured && (
                          <span className="flex items-center gap-1 text-yellow-500">
                            <Star className="w-3 h-3 fill-current" />
                            精选
                          </span>
                        )}
                        <span className="text-blue-500">#{normalizeQuestionTopic(question.topic)}</span>
                        <span>同问 {question.same_question_count || 0}</span>
                        <span>来源 {question.source_count || 1}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 编辑区域 */}
                {editingId === question.id ? (
                  <div className="p-4 bg-blue-50">
                    <textarea
                      value={editAnswer}
                      onChange={(e) => setEditAnswer(e.target.value)}
                      placeholder="输入回答内容 (支持 Markdown)..."
                      className="w-full h-48 p-4 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="mt-3">
                      <select
                        value={editTopic}
                        onChange={(e) => setEditTopic(e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                      >
                        {QUESTION_TOPICS.map((topic) => (
                          <option key={topic} value={topic}>{topic}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editTags}
                        onChange={(e) => setEditTags(e.target.value)}
                        placeholder="标签 (用逗号分隔，如: 考研, 健身, 时间管理)"
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                      <button
                        onClick={() => handleSaveAnswer(question.id)}
                        disabled={saving}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition"
                      >
                        <Save className="w-4 h-4" />
                        {saving ? '保存中...' : '发布回答'}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : question.answer ? (
                  <div className="p-4 bg-gray-50">
                    <p className="text-sm text-gray-500 mb-2">回答:</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{question.answer}</p>
                  </div>
                ) : null}

                {/* 操作按钮 */}
                <div className="px-4 py-3 bg-gray-50 flex items-center gap-2">
                  {question.status === 'pending' && editingId !== question.id && (
                    <>
                      <button
                        onClick={() => handleStartEdit(question)}
                        className="flex items-center gap-1 text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition text-sm"
                      >
                        <Check className="w-4 h-4" />
                        回答
                      </button>
                      <button
                        onClick={() => handleIgnore(question.id)}
                        className="flex items-center gap-1 text-gray-500 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition text-sm"
                      >
                        <X className="w-4 h-4" />
                        忽略
                      </button>
                    </>
                  )}
                  {question.status === 'published' && (
                    <>
                      <button
                        onClick={() => handleStartEdit(question)}
                        className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition text-sm"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleToggleFeatured(question)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition text-sm ${
                          question.is_featured
                            ? 'text-yellow-600 hover:bg-yellow-50'
                            : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${question.is_featured ? 'fill-current' : ''}`} />
                        {question.is_featured ? '取消精选' : '设为精选'}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleOpenDeleteReview(question)}
                    className="flex items-center gap-1 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition text-sm ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 px-4 py-6 overflow-y-auto">
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-red-600 font-semibold">
                  <AlertTriangle className="w-5 h-5" />
                  删除前复核相似问题
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  相似问题按 embedding 相似度优先排序，可选择一起删除。
                </p>
              </div>
              <button
                onClick={handleCloseDeleteReview}
                disabled={deleteSaving}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="border border-red-100 bg-red-50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked
                    readOnly
                    className="mt-1 rounded border-red-300 text-red-600 focus:ring-red-500"
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-red-600 bg-white px-2 py-0.5 rounded-full">
                        当前要删除
                      </span>
                      {getStatusBadge(deleteTarget.status)}
                      <span className="text-xs text-gray-500">
                        同问 {deleteTarget.same_question_count || 0} · 来源 {deleteTarget.source_count || 1}
                      </span>
                    </div>
                    <p className="mt-2 font-medium text-gray-900">{deleteTarget.content}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Network className="w-4 h-4 text-blue-500" />
                  <span>发现 {relatedDeleteItems.length} 个相似问题，已选 {selectedRelatedCount} 个相似项</span>
                </div>
                {relatedDeleteItems.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSelectAllRelated}
                      className="text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition"
                    >
                      全选相似
                    </button>
                    <button
                      onClick={handleClearRelated}
                      className="text-sm text-gray-500 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition"
                    >
                      只删当前
                    </button>
                  </div>
                )}
              </div>

              {deleteError && (
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  {deleteError}
                </div>
              )}

              {deleteLoading ? (
                <div className="py-10 flex items-center justify-center text-gray-500 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  正在读取相似问题
                </div>
              ) : relatedDeleteItems.length === 0 ? (
                <div className="py-8 text-center text-gray-500 bg-gray-50 rounded-lg">
                  没有找到语义相似问题
                </div>
              ) : (
                <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                  {relatedDeleteItems.map(({ question, embeddingScore, graphScore, score, edge }) => {
                    const selected = selectedDeleteIds.has(question.id);
                    return (
                      <label
                        key={question.id}
                        className={`block border rounded-lg p-3 cursor-pointer transition ${
                          selected
                            ? 'border-red-200 bg-red-50'
                            : 'border-gray-100 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => handleToggleDeleteSelection(question.id)}
                            className="mt-1 rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              <span className="font-semibold text-blue-600">
                                embedding {formatScore(embeddingScore)}
                              </span>
                              <span>综合 {formatScore(score)}</span>
                              <span>边分 {formatScore(graphScore)}</span>
                              {edge.reason && <span>{edge.reason}</span>}
                              {getStatusBadge(question.status)}
                            </div>
                            <p className="mt-1 text-sm text-gray-900">{question.content}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              <span>#{normalizeQuestionTopic(question.topic)}</span>
                              <span>同问 {question.same_question_count || 0}</span>
                              <span>来源 {question.source_count || 1}</span>
                              <span>{formatDate(question.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                将删除 {selectedDeleteIds.size} 个问题，删除后语义连线会随外键同步清理。
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCloseDeleteReview}
                  disabled={deleteSaving}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleteSaving || selectedDeleteIds.size === 0}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition"
                >
                  {deleteSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deleteSaving ? '删除中' : `确认删除 ${selectedDeleteIds.size} 个`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminQA;
