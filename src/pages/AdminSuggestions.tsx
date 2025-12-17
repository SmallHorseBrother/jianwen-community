/**
 * 建议箱管理后台
 * 仅管理员可访问
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, Check, X, Trash2, 
  Filter, Clock, AlertCircle, PlayCircle, CheckCircle 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { checkIsAdmin } from '../services/questionService';
import { 
  getAllSuggestions, 
  updateSuggestionStatus, 
  deleteSuggestion 
} from '../services/suggestionService';
import type { Database } from '../lib/database.types';

type Suggestion = Database['public']['Tables']['suggestions']['Row'];
type SuggestionStatus = Database['public']['Tables']['suggestions']['Insert']['status'];

const AdminSuggestions: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [filterStatus, setFilterStatus] = useState<SuggestionStatus | 'all'>('all');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState('');

  // 检查权限
  useEffect(() => {
    const init = async () => {
      if (!user) {
        navigate('/login');
        return;
      }
      const admin = await checkIsAdmin(user.id);
      if (!admin) {
        navigate('/');
        return;
      }
      setIsAdmin(true);
      loadSuggestions();
    };
    init();
  }, [user, navigate]);

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      const data = await getAllSuggestions({ 
        status: filterStatus === 'all' ? undefined : filterStatus as Suggestion['status']
      });
      setSuggestions(data);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadSuggestions();
    }
  }, [filterStatus, isAdmin]);

  const handleStatusUpdate = async (id: string, newStatus: Suggestion['status']) => {
    try {
      await updateSuggestionStatus(id, newStatus);
      setSuggestions(suggestions.map(s => 
        s.id === id ? { ...s, status: newStatus } : s
      ));
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('更新状态失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定要删除这个建议吗？此操作不可逆。')) return;
    try {
      await deleteSuggestion(id);
      setSuggestions(suggestions.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to delete suggestion:', error);
      alert('删除失败');
    }
  };

  const handleSaveNote = async (id: string) => {
    try {
      // 保持当前状态，只更新备注
      const currentSuggestion = suggestions.find(s => s.id === id);
      if (!currentSuggestion) return;
      
      await updateSuggestionStatus(id, currentSuggestion.status, tempNote);
      setSuggestions(suggestions.map(s => 
        s.id === id ? { ...s, admin_notes: tempNote } : s
      ));
      setEditingNoteId(null);
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('保存备注失败');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { color: 'bg-gray-100 text-gray-600', icon: Clock, label: '待处理' },
      reviewing: { color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle, label: '审核中' },
      approved: { color: 'bg-green-100 text-green-700', icon: Check, label: '已采纳' },
      in_progress: { color: 'bg-blue-100 text-blue-700', icon: PlayCircle, label: '开发中' },
      completed: { color: 'bg-purple-100 text-purple-700', icon: CheckCircle, label: '已完成' },
      rejected: { color: 'bg-red-50 text-red-500', icon: X, label: '已拒绝' },
    };
    
    const { color, icon: Icon, label } = (config as any)[status] || config.pending;

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${color}`}>
        <Icon className="w-3 h-3" />
        {label}
      </span>
    );
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-blue-600" />
              建议箱管理
            </h1>
            <p className="text-gray-500 mt-1">
              由 {suggestions.length} 个建议需要处理
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => navigate('/')}
              className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-white"
            >
              返回首页
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex items-center gap-4 overflow-x-auto">
          <Filter className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <div className="flex gap-2">
            {[
              { id: 'all', label: '全部' },
              { id: 'pending', label: '待处理' },
              { id: 'reviewing', label: '审核中' },
              { id: 'approved', label: '已采纳' },
              { id: 'in_progress', label: '开发中' },
              { id: 'completed', label: '已完成' },
              { id: 'rejected', label: '已拒绝' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  filterStatus === tab.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map(item => (
              <div key={item.id} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      {getStatusBadge(item.status || 'pending')}
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                        {item.category}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mt-2">{item.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span>{item.user_nickname || '匿名'}</span>
                    <span>•</span>
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-4 text-gray-700 whitespace-pre-wrap">
                  {item.description}
                </div>

                {/* Admin Notes */}
                <div className="mb-4">
                  {editingNoteId === item.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tempNote}
                        onChange={(e) => setTempNote(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        placeholder="添加管理员回复..."
                      />
                      <button
                        onClick={() => handleSaveNote(item.id)}
                        className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingNoteId(null)}
                        className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-gray-900">管理员回复:</span>
                      {item.admin_notes ? (
                        <span className="text-gray-600">{item.admin_notes}</span>
                      ) : (
                        <span className="text-gray-400 italic">暂无回复</span>
                      )}
                      <button
                        onClick={() => {
                          setEditingNoteId(item.id);
                          setTempNote(item.admin_notes || '');
                        }}
                        className="text-blue-600 hover:text-blue-700 text-xs ml-2"
                      >
                        编辑
                      </button>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
                  <div className="flex gap-2 mr-auto">
                    {item.status !== 'approved' && item.status !== 'completed' && (
                      <button
                        onClick={() => handleStatusUpdate(item.id, 'approved')}
                        className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm hover:bg-green-100 flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> 采纳
                      </button>
                    )}
                    {item.status !== 'reviewing' && (
                      <button
                        onClick={() => handleStatusUpdate(item.id, 'reviewing')}
                        className="px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg text-sm hover:bg-yellow-100 flex items-center gap-1"
                      >
                        <AlertCircle className="w-3 h-3" /> 审核中
                      </button>
                    )}
                    {item.status === 'approved' && (
                      <button
                        onClick={() => handleStatusUpdate(item.id, 'in_progress')}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100 flex items-center gap-1"
                      >
                        <PlayCircle className="w-3 h-3" /> 开始开发
                      </button>
                    )}
                    {(item.status === 'in_progress' || item.status === 'approved') && (
                      <button
                        onClick={() => handleStatusUpdate(item.id, 'completed')}
                        className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm hover:bg-purple-100 flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" /> 标记完成
                      </button>
                    )}
                    {item.status !== 'rejected' && (
                      <button
                        onClick={() => handleStatusUpdate(item.id, 'rejected')}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> 拒绝
                      </button>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> 删除
                  </button>
                </div>
              </div>
            ))}

            {suggestions.length === 0 && (
              <div className="text-center py-12 text-gray-400 bg-white rounded-xl shadow-sm">
                没有找到相关建议
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSuggestions;
