/**
 * 打卡卡片组件
 * 展示用户打卡内容、图片、点赞和评论
 */

import React, { useState } from 'react';
import { Heart, MessageCircle, X, Image as ImageIcon, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { toggleLike, addComment, CheckIn } from '../../services/checkInService';

interface CheckInCardProps {
  checkIn: CheckIn;
  onUpdate: () => void; // 状态更新回调
}

const CheckInCard: React.FC<CheckInCardProps> = ({ checkIn, onUpdate }) => {
  const { user } = useAuth();
  const [isCommenting, setIsCommenting] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);

  // 判断当前用户是否已点赞
  const isLiked = checkIn.likes?.some(like => like.user_id === user?.id);
  const likesCount = checkIn.likes?.length || 0;
  const commentsCount = checkIn.comments?.length || 0;

  // 处理点赞
  const handleLike = async () => {
    if (!user) {
      alert('请先登录');
      return;
    }
    
    // 乐观UI更新 (Optimistic UI) 暂不实现，简单起见直接调接口刷新
    setLikeAnimating(true);
    try {
      await toggleLike(checkIn.id, user.id);
      onUpdate(); // 刷新数据
    } catch (error) {
      console.error('点赞失败', error);
    } finally {
      setTimeout(() => setLikeAnimating(false), 500);
    }
  };

  // 处理评论提交
  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !commentContent.trim()) return;

    setSubmittingComment(true);
    try {
      await addComment(checkIn.id, user.id, commentContent.trim());
      setCommentContent('');
      setIsCommenting(false);
      onUpdate(); // 刷新数据
    } catch (error) {
      console.error('评论失败', error);
      alert('评论失败，请重试');
    } finally {
      setSubmittingComment(false);
    }
  };

  // 格式化时间
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000; // 秒

    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4 hover:shadow-md transition-shadow">
      {/* 头部：用户信息 */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white overflow-hidden flex-shrink-0">
          {checkIn.profiles?.avatar_url ? (
            <img 
              src={checkIn.profiles.avatar_url} 
              alt={checkIn.profiles.nickname} 
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="font-bold">{checkIn.profiles?.nickname?.charAt(0)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900">{checkIn.profiles?.nickname}</h3>
            {checkIn.profiles?.group_nickname && (
              <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                {checkIn.profiles.group_nickname}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">{formatDate(checkIn.created_at)} · 坚持打卡</p>
        </div>
      </div>

      {/* 内容 */}
      <div className="mb-4">
        <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{checkIn.content}</p>
      </div>

      {/* 图片网格 */}
      {checkIn.image_urls && checkIn.image_urls.length > 0 && (
        <div className={`grid gap-2 mb-4 ${
          checkIn.image_urls.length === 1 ? 'grid-cols-1 max-w-sm' : 
          checkIn.image_urls.length === 2 ? 'grid-cols-2' : 
          'grid-cols-3'
        }`}>
          {checkIn.image_urls.map((url, index) => (
            <div 
              key={index} 
              className={`relative rounded-xl overflow-hidden bg-gray-100 ${
                checkIn.image_urls?.length === 1 ? 'aspect-auto' : 'aspect-square'
              }`}
            >
              <img 
                src={url} 
                alt={`check-in-${index}`} 
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                onClick={() => window.open(url, '_blank')} // 简单的大图预览
              />
            </div>
          ))}
        </div>
      )}

      {/* 操作栏 */}
      <div className="flex items-center justify-between border-t border-gray-50 pt-3">
        <div className="flex items-center gap-6">
          <button 
            onClick={handleLike}
            className={`flex items-center gap-1.5 transition-all text-sm group ${
              isLiked ? 'text-pink-500 font-medium' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <div className={`relative ${likeAnimating ? 'scale-125' : 'scale-100'} transition-transform`}>
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            </div>
            <span>{likesCount > 0 ? likesCount : '点赞'}</span>
          </button>
          
          <button 
            onClick={() => setIsCommenting(!isCommenting)}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors text-sm"
          >
            <MessageCircle className="w-5 h-5" />
            <span>{commentsCount > 0 ? commentsCount : '评论'}</span>
          </button>
        </div>
      </div>

      {/* 评论区 */}
      {(isCommenting || commentsCount > 0) && (
        <div className="mt-4 bg-gray-50 rounded-xl p-3 animate-in fade-in slide-in-from-top-2">
          {checkIn.comments && checkIn.comments.length > 0 && (
            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto custom-scrollbar">
              {checkIn.comments.map((comment) => (
                <div key={comment.id} className="flex gap-2">
                  <span className="font-bold text-gray-800 text-sm whitespace-nowrap">
                    {comment.profiles?.nickname}:
                  </span>
                  <span className="text-gray-600 text-sm">{comment.content}</span>
                </div>
              ))}
            </div>
          )}

          {isCommenting && (
            <form onSubmit={handleComment} className="flex gap-2">
              <input
                type="text"
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                placeholder="写下你的鼓励..."
                className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                disabled={!user}
              />
              <button 
                type="submit"
                disabled={!commentContent.trim() || submittingComment}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default CheckInCard;
