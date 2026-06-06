/**
 * 社区广场 V2.0 
 * Tab 1: 看动态 (Check-ins) - 默认
 * Tab 2: 找伙伴 (Profiles)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Users, Search, Sparkles, Target, 
  MessageCircle, X, ExternalLink, MapPin, 
  Camera, Activity, Share2, Check, Lock, UserPlus
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { Database } from '../lib/database.types';
import type { User as AppUser } from '../types';
import { formatGroupIdentity, calculateProfileCompleteness } from '../utils/profileUtils';
import { getPartnerGradient, getPartnerSharePath, sharePartnerProfile } from '../utils/partnerShare';
import { getCheckInById, getCheckIns, CheckIn } from '../services/checkInService';
import { getPublicPartnerProfiles } from '../services/partnerService';

// 组件
import CheckInCard from '../components/Community/CheckInCard';
import CreateCheckInModal from '../components/Community/CreateCheckInModal';
import Leaderboard from '../components/Community/Leaderboard';

type Profile = Database['public']['Tables']['profiles']['Row'];

const CommunityV2: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const targetCheckInId = searchParams.get('checkIn');
  
  // Tab 状态
  const [activeTab, setActiveTab] = useState<'moments' | 'partners'>('moments');
  
  // 打卡相关状态
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loadingCheckIns, setLoadingCheckIns] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // 伙伴相关状态
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [copiedProfileId, setCopiedProfileId] = useState<string | null>(null);

  // 初始化加载
  useEffect(() => {
    if (activeTab === 'moments') {
      loadCheckIns();
    } else {
      loadProfiles();
    }
  }, [activeTab, targetCheckInId]);

  useEffect(() => {
    if (targetCheckInId) {
      setActiveTab('moments');
    }
  }, [targetCheckInId]);

  useEffect(() => {
    if (!targetCheckInId || loadingCheckIns) return;

    const targetElement = document.getElementById(`check-in-${targetCheckInId}`);
    if (!targetElement) return;

    window.setTimeout(() => {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [targetCheckInId, loadingCheckIns, checkIns]);

  // 加载打卡列表
  const loadCheckIns = async () => {
    try {
      setLoadingCheckIns(true);
      const data = await getCheckIns(20);
      let nextCheckIns = data || [];

      if (targetCheckInId && !nextCheckIns.some((checkIn) => checkIn.id === targetCheckInId)) {
        const targetCheckIn = await getCheckInById(targetCheckInId);
        if (targetCheckIn) {
          nextCheckIns = [targetCheckIn, ...nextCheckIns];
        }
      }

      setCheckIns(nextCheckIns);
    } catch (error) {
      console.error('加载打卡失败', error);
    } finally {
      setLoadingCheckIns(false);
    }
  };

  // 加载用户列表
  const loadProfiles = async () => {
    try {
      setLoadingProfiles(true);
      const data = await getPublicPartnerProfiles();
      setProfiles(data);
    } catch (error) {
      console.error('加载用户失败:', error);
    } finally {
      setLoadingProfiles(false);
    }
  };

  const handleShareProfile = async (profile: Profile) => {
    try {
      await sharePartnerProfile(profile);
      setCopiedProfileId(profile.id);
      window.setTimeout(() => setCopiedProfileId(null), 1800);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('分享伙伴名片失败:', error);
    }
  };

  // 伙伴搜索过滤
  const filteredProfiles = useMemo(() => {
    const sortedProfiles = [...profiles].sort((a, b) => {
      return calculateProfileCompleteness(b) - calculateProfileCompleteness(a);
    });
    
    if (!searchQuery) return sortedProfiles;
    const query = searchQuery.toLowerCase();
    return sortedProfiles.filter((profile) => {
      const groupText = formatGroupIdentity(profile.group_identity);
      return (
        profile.nickname?.toLowerCase().includes(query) ||
        profile.group_nickname?.toLowerCase().includes(query) ||
        groupText.toLowerCase().includes(query) ||
        profile.tags?.some((tag) => tag.toLowerCase().includes(query)) ||
        profile.skills_offering?.toLowerCase().includes(query) ||
        profile.skills_seeking?.toLowerCase().includes(query)
      );
    });
  }, [profiles, searchQuery]);

  return (
    <div className="page-aurora min-h-screen pb-16 sm:pb-20">
      {/* 顶部导航与Hero */}
      <div className="sticky top-14 z-10 -mx-2.5 border-b border-cyan-300/10 bg-slate-950/72 shadow-2xl shadow-cyan-950/20 backdrop-blur-2xl sm:top-16 sm:mx-0">
        <div className="mx-auto max-w-6xl px-2.5 sm:px-4">
          <div className="flex items-center justify-between py-3 sm:py-4">
            <h1 className="text-xl font-black text-white hidden md:block">社区广场</h1>
            
            {/* Tab 切换 */}
            <div className="mx-auto flex w-full max-w-sm rounded-2xl bg-white/10 p-1 ring-1 ring-white/10 md:mx-0 md:w-auto">
              <button
                onClick={() => setActiveTab('moments')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all sm:gap-2 sm:px-6 ${
                  activeTab === 'moments' 
                    ? 'bg-cyan-300/15 text-cyan-100 shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Activity className="w-4 h-4" />
                看动态
              </button>
              <button
                onClick={() => setActiveTab('partners')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all sm:gap-2 sm:px-6 ${
                  activeTab === 'partners' 
                    ? 'bg-fuchsia-300/15 text-fuchsia-100 shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                找伙伴
              </button>
            </div>

            {/* 发布按钮 (仅在动态Tab显示) */}
            {activeTab === 'moments' && (
              <button
                onClick={() => user ? setShowCreateModal(true) : alert('请先登录')}
                className="neon-button hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              >
                <Camera className="w-4 h-4" />
                发布打卡
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-1.5 py-4 sm:px-4 sm:py-6">
        {/* ==================== 动态 Tab ==================== */}
        {activeTab === 'moments' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-8">
            {/* 左侧：动态流 */}
            <div className="lg:col-span-2">
              {/* 移动端发布入口 */}
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/65 p-3 shadow-sm md:hidden" onClick={() => user ? setShowCreateModal(true) : alert('请先登录')}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                   <UserAvatar user={user} />
                </div>
                <div className="flex h-10 flex-1 items-center rounded-full bg-white/8 px-4 text-sm text-slate-400">
                  分享今天的健身/学习心得...
                </div>
                <div className="text-cyan-200">
                  <Camera className="w-6 h-6" />
                </div>
              </div>

              {loadingCheckIns ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-gray-500 mt-3">加载动态中...</p>
                </div>
              ) : checkIns.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
                  <Activity className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">暂无动态</h3>
                  <p className="text-gray-500 mb-6">快来发布第一条打卡，抢占沙发！</p>
                  <button
                    onClick={() => user ? setShowCreateModal(true) : alert('请先登录')}
                    className="bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition"
                  >
                    发布打卡
                  </button>
                </div>
              ) : (
                <div className="space-y-4 sm:space-y-6">
                  {checkIns.map((checkIn) => (
                    <CheckInCard 
                      key={checkIn.id} 
                      checkIn={checkIn} 
                      onUpdate={loadCheckIns} 
                      highlighted={checkIn.id === targetCheckInId}
                    />
                  ))}
                  
                  <p className="py-6 text-center text-sm text-slate-400 sm:py-8">
                    - 只管去做，你的潜力超乎你的想象 -
                  </p>
                </div>
              )}
            </div>

            {/* 右侧：排行榜 */}
            <div className="hidden lg:block lg:col-span-1">
               <Leaderboard />
               
               {/* 社区公约简略版 */}
               <div className="bg-white rounded-2xl p-4 mt-6 border border-gray-100 text-sm text-gray-500 shadow-sm">
                 <h4 className="font-bold text-gray-700 mb-2">社区小贴士</h4>
                 <ul className="space-y-1 list-disc list-inside">
                   <li>鼓励互助，友善评论</li>
                   <li>打卡不分健身或学习，贵在坚持</li>
                   <li>严禁广告或违规内容</li>
                 </ul>
               </div>
            </div>
          </div>
        )}

        {/* ==================== 伙伴 Tab ==================== */}
        {activeTab === 'partners' && (
          <div>
            {/* 搜索栏 */}
            <div className="mb-5 sm:mb-6">
              <div className="relative mx-auto max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索昵称、标签、技能..."
                  className="w-full rounded-xl border border-white/10 bg-slate-950/65 py-3 pl-12 pr-4 text-slate-100 shadow-sm transition placeholder:text-slate-500 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* 名片列表 */}
            {loadingProfiles ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-gray-500 mt-3">加载伙伴中...</p>
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  {searchQuery ? '没有找到匹配的用户' : '暂无公开的用户资料'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
                {filteredProfiles.map((profile) => (
                  <ProfileCard 
                    key={profile.id} 
                    profile={profile} 
                    onSelect={() => setSelectedProfile(profile)} 
                    onShare={() => handleShareProfile(profile)}
                    gradient={getPartnerGradient(profile.id)}
                    shareCopied={copiedProfileId === profile.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 弹窗组件 */}
      {showCreateModal && user && (
        <CreateCheckInModal 
          userId={user.id} 
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadCheckIns();
          }}
        />
      )}

      {selectedProfile && (
        <ProfileModal
          profile={selectedProfile}
          isLoggedIn={!!user}
          onClose={() => setSelectedProfile(null)}
          onShare={() => handleShareProfile(selectedProfile)}
          gradient={getPartnerGradient(selectedProfile.id)}
          shareCopied={copiedProfileId === selectedProfile.id}
        />
      )}
    </div>
  );
};

// 小组件：名片卡片
const ProfileCard: React.FC<{
  profile: Profile;
  onSelect: () => void;
  onShare: () => void;
  gradient: string;
  shareCopied: boolean;
}> = ({ profile, onSelect, onShare, gradient, shareCopied }) => (
  <div
    onClick={onSelect}
    className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden group"
  >
    <div className={`h-16 bg-gradient-to-r ${gradient}`} />
    <div className="px-5 -mt-8">
      <div className="w-16 h-16 rounded-full bg-white p-1 shadow-lg">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.nickname} className="w-full h-full rounded-full object-cover" />
        ) : (
          <div className={`w-full h-full rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xl font-bold`}>
            {profile.nickname?.charAt(0)}
          </div>
        )}
      </div>
    </div>
    <div className="p-5 pt-2">
      <div className="flex items-start gap-2 mb-1">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-gray-800 text-lg truncate">{profile.nickname}</h3>
        </div>
        {profile.group_nickname && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded shrink-0">{profile.group_nickname}</span>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onShare();
          }}
          className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition hover:bg-purple-50 hover:text-purple-600"
          aria-label="分享伙伴名片"
          title="分享伙伴名片"
        >
          {shareCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
        </button>
      </div>
      {formatGroupIdentity(profile.group_identity) && (
        <p className="text-sm text-gray-500 mb-2 flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {formatGroupIdentity(profile.group_identity)}
        </p>
      )}
      {profile.tags && profile.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {profile.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full text-xs">{tag}</span>
          ))}
        </div>
      )}
      <div className="space-y-1.5 text-sm">
        {profile.skills_offering && (
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
            <span className="text-gray-600 line-clamp-1">{profile.skills_offering}</span>
          </div>
        )}
        {profile.skills_seeking && (
          <div className="flex items-start gap-2">
            <Target className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
            <span className="text-gray-600 line-clamp-1">{profile.skills_seeking}</span>
          </div>
        )}
      </div>
    </div>
  </div>
);

// 小组件：名片详情弹窗
const ProfileModal: React.FC<{
  profile: Profile;
  isLoggedIn: boolean;
  onClose: () => void;
  onShare: () => void;
  gradient: string;
  shareCopied: boolean;
}> = ({ profile, isLoggedIn, onClose, onShare, gradient, shareCopied }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
    <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <div className={`h-24 bg-gradient-to-r ${gradient} relative`}>
        <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="px-6 -mt-12">
        <div className="w-24 h-24 rounded-full bg-white p-1 shadow-lg">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.nickname} className="w-full h-full rounded-full object-cover" />
          ) : (
            <div className={`w-full h-full rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-3xl font-bold`}>
              {profile.nickname?.charAt(0)}
            </div>
          )}
        </div>
      </div>
      <div className="p-6 pt-4">
        <div className="flex items-start gap-3 mb-1">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold text-gray-800 break-words">{profile.nickname}</h2>
            {profile.group_nickname && <span className="inline-flex mt-1 text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{profile.group_nickname}</span>}
          </div>
          <button
            type="button"
            onClick={onShare}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 transition hover:bg-purple-100"
            aria-label="分享伙伴名片"
            title="分享伙伴名片"
          >
            {shareCopied ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
          </button>
        </div>
        {formatGroupIdentity(profile.group_identity) && (
          <p className="text-gray-500 mb-3 flex items-center gap-1"><MapPin className="w-4 h-4" /> {formatGroupIdentity(profile.group_identity)}</p>
        )}
        {profile.bio && <p className="text-gray-600 mb-4">{profile.bio}</p>}
        {profile.tags && profile.tags.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">🏷️ 标签</h3>
            <div className="flex flex-wrap gap-2">
              {profile.tags.map(tag => <span key={tag} className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-sm">{tag}</span>)}
            </div>
          </div>
        )}
        <div className="space-y-3 mb-4">
          {profile.skills_offering && (
            <div className="p-4 bg-green-50 rounded-xl">
              <h3 className="text-sm font-medium text-green-700 mb-1 flex items-center gap-1"><Sparkles className="w-4 h-4" /> 我能提供</h3>
              <p className="text-green-800">{profile.skills_offering}</p>
            </div>
          )}
          {profile.skills_seeking && (
            <div className="p-4 bg-orange-50 rounded-xl">
              <h3 className="text-sm font-medium text-orange-700 mb-1 flex items-center gap-1"><Target className="w-4 h-4" /> 我正在寻找</h3>
              <p className="text-orange-800">{profile.skills_seeking}</p>
            </div>
          )}
        </div>
        {isLoggedIn && profile.wechat_id && (
          <div className="p-4 bg-blue-50 rounded-xl mb-4">
            <h3 className="text-sm font-medium text-blue-700 mb-1 flex items-center gap-1"><MessageCircle className="w-4 h-4" /> 微信号</h3>
            <p className="text-blue-800 font-mono">{profile.wechat_id}</p>
          </div>
        )}
        {isLoggedIn && profile.social_links && Object.keys(profile.social_links as object).length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">社交链接</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(profile.social_links as Record<string, string>).map(([key, value]) => value && (
                <a key={key} href={value} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition">
                  <ExternalLink className="w-3 h-3" /> {key}
                </a>
              ))}
            </div>
          </div>
        )}
        {!isLoggedIn && (
          <div className="mt-5 rounded-xl border border-cyan-200/40 bg-cyan-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
                <Lock className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-cyan-900">注册后查看联系方式</h3>
                <p className="mt-1 text-sm text-cyan-800">加入社区后可查看微信号、社交链接，并继续完善自己的伙伴名片。</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to="/register"
                    state={{ from: getPartnerSharePath(profile.id) }}
                    className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
                  >
                    <UserPlus className="w-4 h-4" />
                    注册加入
                  </Link>
                  <Link
                    to="/login"
                    state={{ from: getPartnerSharePath(profile.id) }}
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-cyan-700 ring-1 ring-cyan-200 transition hover:bg-cyan-50"
                  >
                    已有账号登录
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);

const UserAvatar: React.FC<{ user: AppUser | null }> = ({ user }) => {
  if (user?.avatar) {
    return <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />;
  }
  return <span className="font-bold text-gray-400">{user?.nickname?.charAt(0) || '?'}</span>;
};

export default CommunityV2;
