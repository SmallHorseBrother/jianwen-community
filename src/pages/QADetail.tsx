/**
 * Q&A 详情页 - 单个问答展示
 * 方便分享到微信群
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Eye, Tag, Share2, Star, User } from 'lucide-react';
import { getQuestionById } from '../services/questionService';
import type { Database } from '../lib/database.types';

type Question = Database['public']['Tables']['questions']['Row'];

const QADetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) {
      loadQuestion(id);
    }
  }, [id]);

  const loadQuestion = async (questionId: string) => {
    try {
      setLoading(true);
      const data = await getQuestionById(questionId);
      setQuestion(data);
    } catch (error) {
      console.error('加载问答失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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

  // 简单的 Markdown 渲染 (支持基本格式)
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    
    // 处理换行
    const lines = text.split('\n');
    
    return lines.map((line, index) => {
      // 标题
      if (line.startsWith('### ')) {
        return <h3 key={index} className="text-lg font-bold mt-4 mb-2">{line.slice(4)}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={index} className="text-xl font-bold mt-6 mb-3">{line.slice(3)}</h2>;
      }
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-2xl font-bold mt-6 mb-3">{line.slice(2)}</h1>;
      }
      
      // 列表
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={index} className="ml-4">{line.slice(2)}</li>;
      }
      if (/^\d+\. /.test(line)) {
        return <li key={index} className="ml-4 list-decimal">{line.replace(/^\d+\. /, '')}</li>;
      }
      
      // 空行
      if (!line.trim()) {
        return <br key={index} />;
      }
      
      // 普通段落，处理加粗和斜体
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
          <Link
            to="/"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
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

      {/* 内容区 */}
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

          {/* 回答区 */}
          <div className="p-6 md:p-8">
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
              {renderMarkdown(question.answer || '')}
            </div>

            {/* 标签 */}
            {question.tags && question.tags.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-100">
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
          </div>
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
