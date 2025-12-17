/**
 * Q&A 管理后台 - 回答问题
 * 仅管理员可访问
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageCircle, Check, X, Star, Trash2, 
  Clock, CheckCircle, XCircle, Filter, Save
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  checkIsAdmin,
  getAllQuestions,
  answerQuestion,
  updateQuestionStatus,
  toggleFeatured,
  deleteQuestion,
} from '../services/questionService';
import type { Database, QuestionStatus } from '../lib/database.types';

type Question = Database['public']['Tables']['questions']['Row'];

const AdminQA: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filterStatus, setFilterStatus] = useState<QuestionStatus | 'all'>('pending');
  
  // 编辑状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAnswer, setEditAnswer] = useState('');
  const [editTags, setEditTags] = useState('');
  const [saving, setSaving] = useState(false);

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
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditAnswer('');
    setEditTags('');
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
      
      await answerQuestion(questionId, editAnswer.trim(), tags);
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

  const handleDelete = async (questionId: string) => {
    if (!confirm('确定要删除这个问题吗？此操作不可恢复。')) return;
    
    try {
      await deleteQuestion(questionId);
      await loadQuestions();
    } catch (error) {
      console.error('删除失败:', error);
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
        <div className="flex items-center gap-2 mb-6">
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
        </div>

        {/* 问题列表 */}
        {questions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">暂无问题</p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((question) => (
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
                    onClick={() => handleDelete(question.id)}
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
    </div>
  );
};

export default AdminQA;
