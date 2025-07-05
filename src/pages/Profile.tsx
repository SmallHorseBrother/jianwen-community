import React, { useState } from 'react';
import { User, Phone, Shield, Save, Edit3, Users, BookOpen, Trophy, Heart, Plus, X, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  GROUP_IDENTITIES, 
  PROFESSIONS, 
  SPECIALTIES, 
  FITNESS_INTERESTS, 
  LEARNING_INTERESTS 
} from '../types';

const Profile: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    nickname: user?.nickname || '',
    bio: user?.bio || '',
    bench: user?.powerData.bench || 0,
    squat: user?.powerData.squat || 0,
    deadlift: user?.powerData.deadlift || 0,
    isPublic: user?.isPublic ?? true,
    // 社区卡片相关字段
    groupIdentity: user?.groupIdentity || '',
    profession: user?.profession || '',
    groupNickname: user?.groupNickname || '',
    specialties: user?.specialties || [],
    fitnessInterests: user?.fitnessInterests || [],
    learningInterests: user?.learningInterests || [],
    socialLinks: user?.socialLinks || {},
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
      // 社区卡片相关字段
      groupIdentity: formData.groupIdentity,
      profession: formData.profession,
      groupNickname: formData.groupNickname,
      specialties: formData.specialties,
      fitnessInterests: formData.fitnessInterests,
      learningInterests: formData.learningInterests,
      socialLinks: formData.socialLinks,
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
      isPublic: user?.isPublic ?? true,
      // 社区卡片相关字段
      groupIdentity: user?.groupIdentity || '',
      profession: user?.profession || '',
      groupNickname: user?.groupNickname || '',
      specialties: user?.specialties || [],
      fitnessInterests: user?.fitnessInterests || [],
      learningInterests: user?.learningInterests || [],
      socialLinks: user?.socialLinks || {},
    });
    setIsEditing(false);
  };

  // 计算个人卡片完整度
  const calculateCompleteness = () => {
    let score = 0;
    let total = 10;
    
    if (user?.nickname) score += 1;
    if (user?.bio && user.bio.length > 10) score += 1;
    if (user?.groupIdentity) score += 2; // 群身份很重要
    if (user?.profession) score += 1;
    if (user?.specialties && user.specialties.length > 0) score += 1;
    if (user?.fitnessInterests && user.fitnessInterests.length > 0) score += 1;
    if (user?.learningInterests && user.learningInterests.length > 0) score += 1;
    if (user?.powerData && (user.powerData.bench > 0 || user.powerData.squat > 0 || user.powerData.deadlift > 0)) score += 1;
    if (user?.groupNickname) score += 1;
    
    return { score, total, percentage: Math.round((score / total) * 100) };
  };

  const completeness = calculateCompleteness();
  const isProfileComplete = completeness.percentage >= 70; // 70%以上算完整

  // 添加标签到数组
  const addTag = (field: 'specialties' | 'fitnessInterests' | 'learningInterests', value: string) => {
    if (value && !formData[field].includes(value)) {
      setFormData(prev => ({
        ...prev,
        [field]: [...prev[field], value]
      }));
    }
  };

  // 从数组中删除标签
  const removeTag = (field: 'specialties' | 'fitnessInterests' | 'learningInterests', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter(item => item !== value)
    }));
  };

  // 更新社交链接
  const updateSocialLink = (platform: string, url: string) => {
    setFormData(prev => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        [platform]: url
      }
    }));
  };

  // 删除社交链接
  const removeSocialLink = (platform: string) => {
    setFormData(prev => ({
      ...prev,
      socialLinks: Object.fromEntries(
        Object.entries(prev.socialLinks).filter(([key]) => key !== platform)
      )
    }));
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto">
      {/* 个人卡片完整度提示 */}
      <div className={`mb-6 p-4 rounded-xl border-2 ${
        isProfileComplete 
          ? 'bg-green-50 border-green-200' 
          : 'bg-yellow-50 border-yellow-200'
      }`}>
        <div className="flex items-center space-x-3">
          {isProfileComplete ? (
            <CheckCircle className="w-6 h-6 text-green-600" />
          ) : (
            <AlertCircle className="w-6 h-6 text-yellow-600" />
          )}
          <div className="flex-1">
            <h3 className={`font-semibold ${
              isProfileComplete ? 'text-green-900' : 'text-yellow-900'
            }`}>
              个人卡片完整度：{completeness.percentage}%
            </h3>
            <p className={`text-sm ${
              isProfileComplete ? 'text-green-700' : 'text-yellow-700'
            }`}>
              {isProfileComplete 
                ? '🎉 你的个人卡片已经很完整了！其他用户可以在大佬卡片墙中找到你，你也可以使用匹配功能寻找志同道合的伙伴。'
                : '⚠️ 完善你的个人卡片信息，让其他用户更容易找到你！建议至少填写群身份、专业领域和兴趣爱好。'
              }
            </p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  isProfileComplete ? 'bg-green-500' : 'bg-yellow-500'
                }`}
                style={{ width: `${completeness.percentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

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

          {/* 社区卡片信息 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2" />
              社区卡片信息
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  群身份 <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-500 ml-1">（必填，用于匹配同群用户）</span>
                </label>
                <select
                  value={formData.groupIdentity}
                  onChange={(e) => setFormData({ ...formData, groupIdentity: e.target.value })}
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                    isEditing ? 'focus:outline-none focus:ring-2 focus:ring-blue-500' : 'bg-gray-50'
                  }`}
                >
                  <option value="">请选择群身份</option>
                  {GROUP_IDENTITIES.map(identity => (
                    <option key={identity} value={identity}>{identity}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  专业领域
                </label>
                <select
                  value={formData.profession}
                  onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                    isEditing ? 'focus:outline-none focus:ring-2 focus:ring-blue-500' : 'bg-gray-50'
                  }`}
                >
                  <option value="">请选择专业领域</option>
                  {PROFESSIONS.map(profession => (
                    <option key={profession} value={profession}>{profession}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                群昵称
                <span className="text-xs text-gray-500 ml-1">（帮助群友认识你）</span>
              </label>
              <input
                type="text"
                value={formData.groupNickname}
                onChange={(e) => setFormData({ ...formData, groupNickname: e.target.value })}
                disabled={!isEditing}
                placeholder="您在群里的昵称"
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                  isEditing ? 'focus:outline-none focus:ring-2 focus:ring-blue-500' : 'bg-gray-50'
                }`}
              />
            </div>

            {/* 擅长领域 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Trophy className="w-4 h-4 inline mr-1" />
                擅长领域
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.specialties.map((specialty, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                  >
                    {specialty}
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => removeTag('specialties', specialty)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {isEditing && (
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      addTag('specialties', e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">添加擅长领域</option>
                  {SPECIALTIES.filter(s => !formData.specialties.includes(s)).map(specialty => (
                    <option key={specialty} value={specialty}>{specialty}</option>
                  ))}
                </select>
              )}
            </div>

            {/* 健身爱好 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Heart className="w-4 h-4 inline mr-1" />
                健身爱好
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.fitnessInterests.map((interest, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full"
                  >
                    {interest}
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => removeTag('fitnessInterests', interest)}
                        className="ml-1 text-green-600 hover:text-green-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {isEditing && (
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      addTag('fitnessInterests', e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">添加健身爱好</option>
                  {FITNESS_INTERESTS.filter(i => !formData.fitnessInterests.includes(i)).map(interest => (
                    <option key={interest} value={interest}>{interest}</option>
                  ))}
                </select>
              )}
            </div>

            {/* 学习兴趣 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <BookOpen className="w-4 h-4 inline mr-1" />
                学习兴趣
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.learningInterests.map((interest, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full"
                  >
                    {interest}
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => removeTag('learningInterests', interest)}
                        className="ml-1 text-purple-600 hover:text-purple-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {isEditing && (
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      addTag('learningInterests', e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">添加学习兴趣</option>
                  {LEARNING_INTERESTS.filter(i => !formData.learningInterests.includes(i)).map(interest => (
                    <option key={interest} value={interest}>{interest}</option>
                  ))}
                </select>
              )}
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
              开启后，其他用户可以在大佬卡片墙中看到您的信息，也可以通过匹配功能找到您
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