/**
 * 发布打卡弹窗
 * 支持图片上传
 */

import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Loader2, Send } from 'lucide-react';
import { createCheckIn, uploadCheckInImage } from '../../services/checkInService';

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
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && images.length === 0) return;

    setIsSubmitting(true);
    try {
      // 1. 上传图片
      const imageUrls: string[] = [];
      for (const file of images) {
        const url = await uploadCheckInImage(file);
        if (url) imageUrls.push(url);
      }

      // 2. 创建打卡
      await createCheckIn(content, imageUrls, userId);
      
      onSuccess();
    } catch (error: any) {
      console.error('发布失败', error);
      alert('发布失败: ' + (error.message || '请重试'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* 标题栏 */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">✨ 分享你的日常</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="今天做了什么？健身、学习还是生活感悟？..."
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
                      className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 底部工具栏 */}
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-100">
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
              disabled={isSubmitting || (!content.trim() && images.length === 0)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-95"
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
      </div>
    </div>
  );
};

export default CreateCheckInModal;
