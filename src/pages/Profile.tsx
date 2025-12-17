/**
 * 个人资料页 - V2.0 精简版
 * 无编辑模式，直接编辑，失去焦点自动保存
 */

import React, { useState, useCallback, useRef } from 'react';
import { Shield, ExternalLink, Plus, MessageCircle, Sparkles, Target, Users, X, Check, Loader, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { GROUP_IDENTITIES } from '../types';

// 预设标签
const PRESET_TAGS = [
  '健身', '考研', '程序员', '设计师', '力量举', 
  'INFP', 'INTJ', 'ENFP', '早起党', '夜猫子',
  '读书', '跑步', '游泳', '创业', '科研', '保研'
];

// 社交平台选项
const SOCIAL_PLATFORMS = [
  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/username' },
  { key: 'xiaohongshu', label: '小红书', placeholder: '小红书主页链接' },
  { key: 'bilibili', label: 'B站', placeholder: 'B站主页链接' },
  { key: 'zhihu', label: '知乎', placeholder: '知乎主页链接' },
  { key: 'weibo', label: '微博', placeholder: '微博主页链接' },
];

const Profile: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [customTag, setCustomTag] = useState('');
  const [newLinkPlatform, setNewLinkPlatform] = useState('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 防抖保存函数
  const debouncedSave = useCallback((updates: Partial<typeof user>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        await updateProfile(updates as any);
        setLastSaved(new Date());
      } catch (error) {
        console.error('保存失败:', error);
      } finally {
        setSaving(false);
      }
    }, 800); // 800ms 防抖
  }, [updateProfile]);

  // 立即保存函数
  const saveImmediately = useCallback(async (updates: Partial<typeof user>) => {
    try {
      setSaving(true);
      await updateProfile(updates as any);
      setLastSaved(new Date());
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setSaving(false);
    }
  }, [updateProfile]);

  // 更新字段
  const handleFieldChange = (field: string, value: any) => {
    debouncedSave({ [field]: value });
  };

  // 标签操作
  const addTag = (tag: string) => {
    if (tag && !user?.tags?.includes(tag)) {
      const newTags = [...(user?.tags || []), tag];
      saveImmediately({ tags: newTags });
    }
  };

  const removeTag = (tag: string) => {
    const newTags = (user?.tags || []).filter(t => t !== tag);
    saveImmediately({ tags: newTags });
  };

  // 群组操作
  const toggleGroup = (group: string) => {
    const currentGroups = user?.groupIdentity || [];
    const newGroups = currentGroups.includes(group)
      ? currentGroups.filter(g => g !== group)
      : [...currentGroups, group];
    saveImmediately({ groupIdentity: newGroups });
  };

  // 社交链接操作
  const updateSocialLink = (platform: string, url: string) => {
    const newLinks = { ...(user?.socialLinks || {}), [platform]: url };
    debouncedSave({ socialLinks: newLinks });
  };

  const removeSocialLink = (platform: string) => {
    const newLinks = Object.fromEntries(
      Object.entries(user?.socialLinks || {}).filter(([key]) => key !== platform)
    );
    saveImmediately({ socialLinks: newLinks });
  };

  const addNewLink = () => {
    if (newLinkPlatform && !user?.socialLinks?.[newLinkPlatform]) {
      const newLinks = { ...(user?.socialLinks || {}), [newLinkPlatform]: '' };
      saveImmediately({ socialLinks: newLinks });
      setNewLinkPlatform('');
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {/* 头部 */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.nickname} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-white text-2xl font-bold">{user.nickname?.charAt(0)}</span>
                )}
              </div>
              <div className="text-white">
                <h1 className="text-2xl font-bold">{user.nickname}</h1>
                {user.groupIdentity && user.groupIdentity.length > 0 && (
                  <p className="text-blue-100 text-sm mt-1">
                    📍 {user.groupIdentity.join('、')}
                  </p>
                )}
              </div>
            </div>
            {/* 保存状态指示器 */}
            <div className="flex items-center space-x-2 text-white/80 text-sm">
              {saving ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>保存中...</span>
                </>
              ) : lastSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>已保存</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* 表单 - 直接编辑模式 */}
        <div className="p-6 space-y-6">
          {/* 基础信息 */}
          <section>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2 text-blue-500" />
              基础信息
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">昵称</label>
                <input
                  type="text"
                  defaultValue={user.nickname}
                  onBlur={(e) => handleFieldChange('nickname', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">群昵称</label>
                <input
                  type="text"
                  defaultValue={user.groupNickname || ''}
                  onBlur={(e) => handleFieldChange('groupNickname', e.target.value)}
                  placeholder="方便群友认出你"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">个人简介</label>
              <textarea
                defaultValue={user.bio}
                onBlur={(e) => handleFieldChange('bio', e.target.value)}
                rows={2}
                placeholder="一句话介绍自己..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 所属群组 - 多选 */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">所属群组 (可多选)</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {GROUP_IDENTITIES.map(group => (
                  <label
                    key={group}
                    className={`flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition ${
                      user.groupIdentity?.includes(group)
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={user.groupIdentity?.includes(group) || false}
                      onChange={() => toggleGroup(group)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{group}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* 社交名片 */}
          <section className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2 text-purple-500" />
              社交名片
            </h3>

            {/* 个人标签 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">🏷️ 个人标签</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(user.tags || []).map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full"
                  >
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="ml-1.5 hover:text-purple-900">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {PRESET_TAGS.filter(t => !(user.tags || []).includes(t)).slice(0, 10).map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTag(tag)}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-purple-100 hover:text-purple-700 transition"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    placeholder="自定义标签"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (customTag.trim()) {
                          addTag(customTag.trim());
                          setCustomTag('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customTag.trim()) {
                        addTag(customTag.trim());
                        setCustomTag('');
                      }
                    }}
                    className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>

            {/* 我能提供 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Sparkles className="w-4 h-4 inline mr-1 text-green-500" />
                我能提供
              </label>
              <textarea
                defaultValue={user.skillsOffering || ''}
                onBlur={(e) => handleFieldChange('skillsOffering', e.target.value)}
                rows={2}
                placeholder="例如：Python辅导、深蹲纠错、论文润色..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* 我正在寻找 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Target className="w-4 h-4 inline mr-1 text-orange-500" />
                我正在寻找
              </label>
              <textarea
                defaultValue={user.skillsSeeking || ''}
                onBlur={(e) => handleFieldChange('skillsSeeking', e.target.value)}
                rows={2}
                placeholder="例如：早起搭子、健身伙伴、考研经验分享..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {/* 微信号 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MessageCircle className="w-4 h-4 inline mr-1 text-blue-500" />
                微信号
                <span className="text-xs text-gray-400 ml-1">(仅登录用户可见)</span>
              </label>
              <input
                type="text"
                defaultValue={user.wechatId || ''}
                onBlur={(e) => handleFieldChange('wechatId', e.target.value)}
                placeholder="方便群友私聊联系"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </section>

          {/* 社交链接 */}
          <section className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <ExternalLink className="w-5 h-5 mr-2 text-indigo-500" />
              社交链接
            </h3>

            <div className="space-y-3">
              {Object.entries(user.socialLinks || {}).map(([platform, url]) => {
                const platformInfo = SOCIAL_PLATFORMS.find(p => p.key === platform);
                return (
                  <div key={platform} className="flex items-center gap-2">
                    <span className="w-20 text-sm text-gray-600">{platformInfo?.label || platform}</span>
                    <input
                      type="url"
                      defaultValue={url}
                      onBlur={(e) => updateSocialLink(platform, e.target.value)}
                      placeholder={platformInfo?.placeholder || '链接地址'}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => removeSocialLink(platform)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <select
                value={newLinkPlatform}
                onChange={(e) => setNewLinkPlatform(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">选择平台</option>
                {SOCIAL_PLATFORMS.filter(p => !(user.socialLinks || {})[p.key]).map(platform => (
                  <option key={platform.key} value={platform.key}>{platform.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={addNewLink}
                disabled={!newLinkPlatform}
                className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 text-sm"
              >
                <Plus className="w-4 h-4" />
                添加
              </button>
            </div>
          </section>

          {/* 隐私设置 */}
          <section className="border-t pt-6">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={user.isPublic}
                onChange={(e) => saveImmediately({ isPublic: e.target.checked })}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-gray-600" />
                  <span className="font-medium text-gray-700">公开我的名片</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  开启后，其他用户可以在社区广场看到你的信息
                </p>
              </div>
            </label>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Profile;