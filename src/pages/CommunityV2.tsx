/**
 * 社区广场 V2.0 - 社交名片墙
 * 点击名片可查看完整社交手册
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, Search, Sparkles, Target, 
  MessageCircle, X, ExternalLink, MapPin
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

const CommunityV2: React.FC = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_public', true)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('加载用户失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProfiles = profiles.filter((profile) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      profile.nickname?.toLowerCase().includes(query) ||
      profile.group_nickname?.toLowerCase().includes(query) ||
      profile.group_identity?.toLowerCase().includes(query) ||
      profile.tags?.some((tag) => tag.toLowerCase().includes(query)) ||
      profile.skills_offering?.toLowerCase().includes(query) ||
      profile.skills_seeking?.toLowerCase().includes(query)
    );
  });

  // 生成渐变色
  const getGradient = (id: string) => {
    const gradients = [
      'from-blue-400 to-indigo-500',
      'from-purple-400 to-pink-500',
      'from-green-400 to-teal-500',
      'from-orange-400 to-red-500',
      'from-cyan-400 to-blue-500',
      'from-pink-400 to-rose-500',
    ];
    const index = id.charCodeAt(0) % gradients.length;
    return gradients[index];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            🤝 社区广场
          </h1>
          <p className="text-purple-100 text-lg max-w-2xl mx-auto">
            找到志同道合的伙伴，看看大家都在做什么、需要什么
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 搜索栏 */}
        <div className="mb-8">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索昵称、标签、技能..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition shadow-sm"
            />
          </div>
        </div>

        {/* 名片墙 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-500 mt-3">加载中...</p>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {searchQuery ? '没有找到匹配的用户' : '暂无公开的用户资料'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProfiles.map((profile) => (
              <div
                key={profile.id}
                onClick={() => setSelectedProfile(profile)}
                className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden group"
              >
                {/* 头部渐变 */}
                <div className={`h-16 bg-gradient-to-r ${getGradient(profile.id)}`} />
                
                {/* 头像 */}
                <div className="px-5 -mt-8">
                  <div className="w-16 h-16 rounded-full bg-white p-1 shadow-lg">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.nickname}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <div className={`w-full h-full rounded-full bg-gradient-to-br ${getGradient(profile.id)} flex items-center justify-center text-white text-xl font-bold`}>
                        {profile.nickname?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>
                </div>

                {/* 内容 */}
                <div className="p-5 pt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-800 text-lg">
                      {profile.nickname}
                    </h3>
                    {profile.group_nickname && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {profile.group_nickname}
                      </span>
                    )}
                  </div>

                  {profile.group_identity && (
                    <p className="text-sm text-gray-500 mb-2 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {profile.group_identity}
                    </p>
                  )}

                  {/* 标签 */}
                  {profile.tags && profile.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {profile.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                      {profile.tags.length > 4 && (
                        <span className="text-xs text-gray-400">
                          +{profile.tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 供需 */}
                  <div className="space-y-1.5 text-sm">
                    {profile.skills_offering && (
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-600 line-clamp-1">
                          {profile.skills_offering}
                        </span>
                      </div>
                    )}
                    {profile.skills_seeking && (
                      <div className="flex items-start gap-2">
                        <Target className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-600 line-clamp-1">
                          {profile.skills_seeking}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 底部提示 */}
        {!user && (
          <div className="text-center mt-12 p-6 bg-white rounded-xl shadow-sm">
            <p className="text-gray-600 mb-3">登录后可以创建自己的名片</p>
            <Link
              to="/login"
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded-lg transition"
            >
              去登录
            </Link>
          </div>
        )}
      </div>

      {/* 详情弹窗 */}
      {selectedProfile && (
        <ProfileModal
          profile={selectedProfile}
          isLoggedIn={!!user}
          onClose={() => setSelectedProfile(null)}
          gradient={getGradient(selectedProfile.id)}
        />
      )}
    </div>
  );
};

// 名片详情弹窗 - 完整版
const ProfileModal: React.FC<{
  profile: Profile;
  isLoggedIn: boolean;
  onClose: () => void;
  gradient: string;
}> = ({ profile, isLoggedIn, onClose, gradient }) => {
  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className={`h-24 bg-gradient-to-r ${gradient} relative`}>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 头像 */}
        <div className="px-6 -mt-12">
          <div className="w-24 h-24 rounded-full bg-white p-1 shadow-lg">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.nickname}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <div className={`w-full h-full rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-3xl font-bold`}>
                {profile.nickname?.charAt(0) || '?'}
              </div>
            )}
          </div>
        </div>

        {/* 内容 */}
        <div className="p-6 pt-4">
          {/* 名称和群昵称 */}
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold text-gray-800">{profile.nickname}</h2>
            {profile.group_nickname && (
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {profile.group_nickname}
              </span>
            )}
          </div>

          {/* 所属群组 */}
          {profile.group_identity && (
            <p className="text-gray-500 mb-3 flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {profile.group_identity}
            </p>
          )}

          {/* 简介 */}
          {profile.bio && (
            <p className="text-gray-600 mb-4">{profile.bio}</p>
          )}

          {/* 标签 */}
          {profile.tags && profile.tags.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">🏷️ 标签</h3>
              <div className="flex flex-wrap gap-2">
                {profile.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 供需关系 */}
          <div className="space-y-3 mb-4">
            {profile.skills_offering && (
              <div className="p-4 bg-green-50 rounded-xl">
                <h3 className="text-sm font-medium text-green-700 mb-1 flex items-center gap-1">
                  <Sparkles className="w-4 h-4" />
                  我能提供
                </h3>
                <p className="text-green-800">{profile.skills_offering}</p>
              </div>
            )}
            {profile.skills_seeking && (
              <div className="p-4 bg-orange-50 rounded-xl">
                <h3 className="text-sm font-medium text-orange-700 mb-1 flex items-center gap-1">
                  <Target className="w-4 h-4" />
                  我正在寻找
                </h3>
                <p className="text-orange-800">{profile.skills_seeking}</p>
              </div>
            )}
          </div>

          {/* 微信号 (仅登录用户可见) */}
          {isLoggedIn && profile.wechat_id && (
            <div className="p-4 bg-blue-50 rounded-xl mb-4">
              <h3 className="text-sm font-medium text-blue-700 mb-1 flex items-center gap-1">
                <MessageCircle className="w-4 h-4" />
                微信号
              </h3>
              <p className="text-blue-800 font-mono">{profile.wechat_id}</p>
            </div>
          )}

          {/* 社交链接 */}
          {profile.social_links && Object.keys(profile.social_links as object).length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">🔗 社交链接</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(profile.social_links as Record<string, string>).map(([key, value]) => (
                  value && (
                    <a
                      key={key}
                      href={value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {key}
                    </a>
                  )
                ))}
              </div>
            </div>
          )}

          {/* 未登录提示 */}
          {!isLoggedIn && profile.wechat_id && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">
                <Link to="/login" className="text-blue-600 hover:underline">登录</Link>
                {' '}后可查看微信号
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommunityV2;
