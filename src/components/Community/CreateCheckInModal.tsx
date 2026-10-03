/**
 * 发布打卡弹窗
 * 支持图片上传
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, Image as ImageIcon, Loader2, Send } from 'lucide-react';
import { createCheckIn, uploadCheckInImage } from '../../services/checkInService';
import { normalizeCheckInContent } from '../../utils/normalizeCheckInContent';
import Dialog from '../Common/Dialog';

interface CreateCheckInModalProps {
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
}

const CreateCheckInModal: React.FC<CreateCheckInModalProps> = ({ onClose, onSuccess, userId }) => {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string[]>([]);
  useEffect(() => { previewRef.current = previewUrls; }, [previewUrls]);
  useEffect(() => () => previewRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (images.length + newFiles.length > 4) {
        alert('最多只能上传 4 张图片');
        return;
      }
      
      setImages(prev => [...prev, ...newFiles]);
      
      // 生成预览
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setPreviewUrls(prev => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedContent = normalizeCheckInContent(content);
    if (!normalizedContent && images.length === 0) return;

    setIsSubmitting(true);
    try {
      // 1. 上传图片
      const imageUrls: string[] = [];
      for (const file of images) {
        const url = await uploadCheckInImage(file);
        if (url) imageUrls.push(url);
      }

      // 2. 创建打卡
      await createCheckIn(normalizedContent, imageUrls, userId);
      
      onSuccess();
    } catch (error: unknown) {
      console.error('发布失败', error);
      alert('发布失败: ' + (error instanceof Error ? error.message : '请重试'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog title="发布打卡" onClose={onClose} dismissDisabled={isSubmitting}>
        <form onSubmit={handleSubmit}>
          <div className="pb-6">
            <textarea
              aria-label="打卡内容"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="今天有什么进步？"
              className="w-full h-32 resize-none text-base border-none focus:ring-0 p-0 text-gray-700 placeholder:text-gray-400"
              autoFocus
            />

            {/* 图片预览区 */}
            {previewUrls.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-4">
                {previewUrls.map((url, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden group">
                    <img src={url} alt="preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      aria-label={`移除图片 ${index + 1}`} className="checkin-remove-image absolute top-1 right-1 w-8 h-8 flex items-center justify-center bg-black/70 text-white rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 底部工具栏 */}
          <div className="checkin-composer-actions flex items-center justify-between gap-3 py-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors px-3 py-2 rounded-lg hover:bg-blue-50"
            >
              <ImageIcon className="w-5 h-5" />
              <span className="text-sm font-medium">添加图片</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              multiple 
              accept="image/*"
              onChange={handleImageSelect}
            />

            <button
              type="submit"
              disabled={isSubmitting || (!normalizeCheckInContent(content) && images.length === 0)}
              className="jw-action disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  发布中...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  发布
                </>
              )}
            </button>
          </div>
        </form>
    </Dialog>
  );
};
export default CreateCheckInModal;
