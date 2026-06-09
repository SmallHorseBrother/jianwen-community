/**
 * 打卡卡片组件
 * 展示用户打卡内容、图片、点赞和评论
 */

import React, { useState } from 'react';
import { Loader2, Heart, MessageCircle, Pencil, Send, Share2, Trash2, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  toggleLike,
  addComment,
  updateCheckIn,
  deleteCheckIn,
  CheckIn,
  CheckInComment,
} from '../../services/checkInService';
import CheckInShareModal from './CheckInShareModal';

interface CheckInCardProps {
  checkIn: CheckIn;
  onUpdate: () => void; // 状态更新回调
  highlighted?: boolean;
}

const CheckInCard: React.FC<CheckInCardProps> = ({ checkIn, onUpdate, highlighted = false }) => {
  const { user } = useAuth();
  const [isCommenting, setIsCommenting] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [replyTarget, setReplyTarget] = useState<CheckInComment | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(checkIn.content || '');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 判断当前用户是否已点赞
  const isLiked = checkIn.likes?.some(like => like.user_id === user?.id);
  const likesCount = checkIn.likes?.length || 0;
  const commentsCount = checkIn.comments?.length || 0;
  const canShareCheckIn = Boolean(user?.id && checkIn.user_id === user.id);
  const canManageCheckIn = Boolean(user?.id && checkIn.user_id === user.id);
  const sortedComments = [...(checkIn.comments || [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

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
      await addComment(
        checkIn.id,
        user.id,
        commentContent.trim(),
        replyTarget ? { commentId: replyTarget.id, userId: replyTarget.user_id } : null
      );
      setCommentContent('');
      setReplyTarget(null);
      setIsCommenting(false);
      onUpdate(); // 刷新数据
    } catch (error) {
      console.error('评论失败', error);
      alert('评论失败，请重试');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleOpenComment = () => {
    if (!user) {
      alert('请先登录');
      return;
    }
    setReplyTarget(null);
    setIsCommenting(true);
  };

  const handleReply = (comment: CheckInComment) => {
    if (!user) {
      alert('请先登录');
      return;
    }
    setReplyTarget(comment);
    setIsCommenting(true);
  };

  const handleCancelReply = () => {
    setReplyTarget(null);
    setCommentContent('');
  };

  const handleStartEdit = () => {
    setEditContent(checkIn.content || '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditContent(checkIn.content || '');
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!user) {
      alert('请先登录');
      return;
    }
    if (!editContent.trim() && !(checkIn.image_urls?.length)) {
      alert('打卡内容不能为空');
      return;
    }

    setSavingEdit(true);
    try {
      await updateCheckIn(checkIn.id, user.id, editContent.trim());
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('编辑打卡失败', error);
      alert('编辑失败: ' + getErrorMessage(error));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!user) {
      alert('请先登录');
      return;
    }
    const confirmed = window.confirm('确定删除这条打卡吗？删除后无法恢复。');
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteCheckIn(checkIn.id, user.id);
      onUpdate();
    } catch (error) {
      console.error('删除打卡失败', error);
      alert('删除失败: ' + getErrorMessage(error));
    } finally {
      setDeleting(false);
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
    <div
      id={`check-in-${checkIn.id}`}
      className={`mb-3 rounded-xl bg-white p-4 transition-all sm:mb-4 sm:rounded-2xl sm:p-5 ${
        highlighted
          ? 'border-2 border-cyan-300 shadow-xl shadow-cyan-200/40 ring-4 ring-cyan-100'
          : 'border border-gray-100 shadow-sm hover:shadow-md'
      }`}
    >
      {/* 头部：用户信息 */}
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white">
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
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate font-bold text-gray-900">{checkIn.profiles?.nickname}</h3>
            {checkIn.profiles?.group_nickname && (
              <span className="shrink-0 rounded bg-gray-50 px-1.5 py-0.5 text-xs text-gray-400">
                {checkIn.profiles.group_nickname}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">{formatDate(checkIn.created_at)} · 坚持打卡</p>
        </div>
        {canManageCheckIn && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={handleStartEdit}
              disabled={isEditing || deleting}
              className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="编辑打卡"
              title="编辑打卡"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || savingEdit}
              className="rounded-full p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="删除打卡"
              title="删除打卡"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>

      {/* 内容 */}
      <div className="mb-4">
        {isEditing ? (
          <div className="space-y-3">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-28 w-full resize-y rounded-xl border border-blue-100 bg-blue-50/40 px-3 py-2 text-sm leading-7 text-gray-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 sm:text-base"
              autoFocus
              disabled={savingEdit}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={savingEdit}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit || (!editContent.trim() && !(checkIn.image_urls?.length))}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingEdit && <Loader2 className="h-4 w-4 animate-spin" />}
                保存
              </button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-7 text-gray-800 sm:text-base">{checkIn.content}</p>
        )}
      </div>

      {/* 图片网格 */}
      {checkIn.image_urls && checkIn.image_urls.length > 0 && (
        <div className={`mb-4 grid gap-1.5 sm:gap-2 ${
          checkIn.image_urls.length === 1 ? 'grid-cols-1 sm:max-w-sm' : 
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
        <div className="flex flex-wrap items-center gap-3 sm:gap-6">
          <button 
            type="button"
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
            type="button"
            onClick={() => (isCommenting && !replyTarget ? setIsCommenting(false) : handleOpenComment())}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors text-sm"
          >
            <MessageCircle className="w-5 h-5" />
            <span>{commentsCount > 0 ? commentsCount : '评论'}</span>
          </button>

          {canShareCheckIn && (
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 text-gray-500 hover:text-cyan-300 transition-colors text-sm"
            >
              <Share2 className="w-5 h-5" />
              <span>分享图</span>
            </button>
          )}
        </div>
      </div>

      {/* 评论区 */}
      {(isCommenting || commentsCount > 0) && (
        <div className="animate-in fade-in slide-in-from-top-2 mt-4 rounded-xl bg-gray-50 p-2.5 sm:p-3">
          {sortedComments.length > 0 && (
            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto custom-scrollbar">
              {sortedComments.map((comment) => (
                <div key={comment.id} className="group flex items-start gap-2">
                  <div className="flex-1 min-w-0 text-sm leading-relaxed">
                    <span className="font-bold text-gray-800 whitespace-nowrap">
                      {comment.profiles?.nickname || '群友'}
                    </span>
                    {comment.reply_to_profile && (
                      <>
                        <span className="mx-1 text-gray-400">回复</span>
                        <span className="font-bold text-gray-800 whitespace-nowrap">
                          {comment.reply_to_profile.nickname || '群友'}
                        </span>
                      </>
                    )}
                    <span className="text-gray-400">：</span>
                    <span className="text-gray-600 break-words">{comment.content}</span>
                  </div>
                  {user && comment.user_id !== user.id && (
                    <button
                      type="button"
                      onClick={() => handleReply(comment)}
                      className="shrink-0 text-xs text-gray-400 opacity-0 transition-opacity hover:text-blue-600 group-hover:opacity-100"
                    >
                      回复
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isCommenting && (
            <div className="space-y-2">
              {replyTarget && (
                <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs text-gray-500">
                  <span>
                    回复 <span className="font-semibold text-gray-700">{replyTarget.profiles?.nickname || '群友'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCancelReply}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    aria-label="取消回复"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <form onSubmit={handleComment} className="flex gap-2">
                <input
                  type="text"
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  placeholder={replyTarget ? `回复 ${replyTarget.profiles?.nickname || '群友'}...` : '写下你的鼓励...'}
                  className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  disabled={!user}
                />
                <button
                  type="submit"
                  disabled={!commentContent.trim() || submittingComment}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  aria-label={replyTarget ? '发送回复' : '发送评论'}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {showShareModal && canShareCheckIn && (
        <CheckInShareModal
          checkIn={checkIn}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '请重试';
}

export default CheckInCard;
