import React, { useState } from 'react';
import { User, Phone, Shield, Save, Edit3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Profile: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    nickname: user?.nickname || '',
    bio: user?.bio || '',
    bench: user?.powerData.bench || 0,
    squat: user?.powerData.squat || 0,
    deadlift: user?.powerData.deadlift || 0,
    isPublic: user?.isPublic || true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await updateProfile({
      nickname: formData.nickname,
      bio: formData.bio,
      powerData: {
        bench: formData.bench,
        squat: formData.squat,
        deadlift: formData.deadlift,
      },
      isPublic: formData.isPublic,
    });
    
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      nickname: user?.nickname || '',
      bio: user?.bio || '',
      bench: user?.powerData.bench || 0,
      squat: user?.powerData.squat || 0,
      deadlift: user?.powerData.deadlift || 0,
      isPublic: user?.isPublic || true,
    });
    setIsEditing(false);
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">个人资料</h1>
              <p className="text-gray-600">管理您的个人信息和隐私设置</p>
            </div>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              <span>编辑</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-1" />
                手机号
              </label>
              <input
                type="tel"
                value={user.phone}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                昵称
              </label>
              <input
                type="text"
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                disabled={!isEditing}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                  isEditing ? 'focus:outline-none focus:ring-2 focus:ring-blue-500' : 'bg-gray-50'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              个人简介
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              disabled={!isEditing}
              rows={3}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                isEditing ? 'focus:outline-none focus:ring-2 focus:ring-blue-500' : 'bg-gray-50'
              }`}
              placeholder="介绍一下自己..."
            />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">力量数据 (kg)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  卧推
                </label>
                <input
                  type="number"
                  value={formData.bench}
                  onChange={(e) => setFormData({ ...formData, bench: Number(e.target.value) })}
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                    isEditing ? 'focus:outline-none focus:ring-2 focus:ring-blue-500' : 'bg-gray-50'
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  深蹲
                </label>
                <input
                  type="number"
                  value={formData.squat}
                  onChange={(e) => setFormData({ ...formData, squat: Number(e.target.value) })}
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                    isEditing ? 'focus:outline-none focus:ring-2 focus:ring-blue-500' : 'bg-gray-50'
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  硬拉
                </label>
                <input
                  type="number"
                  value={formData.deadlift}
                  onChange={(e) => setFormData({ ...formData, deadlift: Number(e.target.value) })}
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                    isEditing ? 'focus:outline-none focus:ring-2 focus:ring-blue-500' : 'bg-gray-50'
                  }`}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={formData.isPublic}
                onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                disabled={!isEditing}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-700">公开我的个人卡片</span>
              </div>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-7">
              其他用户可以在大佬卡片墙中看到您的信息
            </p>
          </div>

          {isEditing && (
            <div className="flex space-x-4">
              <button
                type="submit"
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>保存更改</span>
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default Profile;