/**
 * 社区广场 V2.0
 * 通过 URL 固定展示社区动态或找伙伴，入口由全局导航区分。
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Search, ExternalLink, Camera, Share2, Check
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { Database } from '../lib/database.types';
import { formatGroupIdentity, calculateProfileCompleteness } from '../utils/profileUtils';
import { getPartnerSharePath, sharePartnerProfile } from '../utils/partnerShare';
import { getCheckInById, getCheckIns, CheckIn } from '../services/checkInService';
import { getPublicPartnerProfiles } from '../services/partnerService';

// 组件
import CheckInCard from '../components/Community/CheckInCard';
import CreateCheckInModal from '../components/Community/CreateCheckInModal';
import Leaderboard from '../components/Community/Leaderboard';
import Dialog from '../components/Common/Dialog';

type Profile = Database['public']['Tables']['profiles']['Row'];
type LoadCheckInsOptions = {
  showLoading?: boolean;
};

const CommunityV2: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const targetCheckInId = searchParams.get('checkIn');
  const tabParam = searchParams.get('tab');
  
  // Tab 状态
  const [activeTab, setActiveTab] = useState<'moments' | 'partners'>(
    tabParam === 'partners' ? 'partners' : 'moments',
  );
  
  // 打卡相关状态
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loadingCheckIns, setLoadingCheckIns] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'feed' | 'ranking'>('feed');
  const [rankingRevision, setRankingRevision] = useState(0);

  // 伙伴相关状态
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [partnerCategory, setPartnerCategory] = useState('全部');
  const [visiblePartnerCount, setVisiblePartnerCount] = useState(24);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [copiedProfileId, setCopiedProfileId] = useState<string | null>(null);

  // 加载打卡列表
  const loadCheckIns = useCallback(async ({ showLoading = true }: LoadCheckInsOptions = {}) => {
    try {
      if (showLoading) {
        setLoadingCheckIns(true);
      }
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
      if (showLoading) {
        setLoadingCheckIns(false);
      }
    }
  }, [targetCheckInId]);

  // 加载用户列表
  const loadProfiles = useCallback(async () => {
    try {
      setLoadingProfiles(true);
      const data = await getPublicPartnerProfiles();
      setProfiles(data);
    } catch (error) {
      console.error('加载用户失败:', error);
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    if (activeTab === 'moments') {
      loadCheckIns();
    } else {
      loadProfiles();
    }
  }, [activeTab, loadCheckIns, loadProfiles]);

  useEffect(() => {
    if (targetCheckInId) {
      setActiveTab('moments');
      return;
    }

    if (tabParam === 'partners' || tabParam === 'moments') {
      setActiveTab(tabParam);
    }
  }, [tabParam, targetCheckInId]);

  useEffect(() => {
    if (!targetCheckInId || loadingCheckIns) return;

    const targetElement = document.getElementById(`check-in-${targetCheckInId}`);
    if (!targetElement) return;

    window.setTimeout(() => {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [targetCheckInId, loadingCheckIns, checkIns]);

  const refreshCheckIns = () => {
    void loadCheckIns({ showLoading: false });
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
    const sortedProfiles = profiles.filter((profile) => partnerCategory === '全部' || profile.tags?.some((tag) => tag.includes(partnerCategory))).sort((a, b) => {
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
  }, [profiles, searchQuery, partnerCategory]);

  const isPartnersView = activeTab === 'partners';
  const openCheckIn = () => user ? setShowCreateModal(true) : window.location.assign('/login');

  return (
    <div className="redesign-community">
      <header className={isPartnersView ? 'page-heading' : 'page-heading community-heading'}>
        <div><h1>{isPartnersView ? '找伙伴' : '社区'}</h1><p>{isPartnersView ? '技能互补，一起向前。' : '今天也有进步。'}</p></div>
        {isPartnersView ? <Link to={user ? '/profile' : '/login'} className="jw-action">完善我的名片</Link> : <button type="button" onClick={openCheckIn} className="jw-action"><Camera /> 发布打卡</button>}
      </header>
      {activeTab === 'moments' && <>
        <div className="community-mobile-tabs" role="tablist" aria-label="社区内容" onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 'feed' : event.key === 'End' ? 'ranking' : mobilePanel === 'feed' ? 'ranking' : 'feed';
          setMobilePanel(next);
          document.getElementById(`community-${next}-tab`)?.focus();
        }}>
          <button type="button" id="community-feed-tab" role="tab" tabIndex={mobilePanel === 'feed' ? 0 : -1} aria-selected={mobilePanel === 'feed'} aria-controls="community-feed" onClick={() => setMobilePanel('feed')}>打卡</button>
          <button type="button" id="community-ranking-tab" role="tab" tabIndex={mobilePanel === 'ranking' ? 0 : -1} aria-selected={mobilePanel === 'ranking'} aria-controls="community-ranking" onClick={() => setMobilePanel('ranking')}>打卡排行榜</button>
        </div>
        <div className="community-layout" data-panel={mobilePanel}>
          <aside id="community-ranking" className="community-ranking"><Leaderboard revision={rankingRevision} /></aside>
          <section id="community-feed" className="community-feed" aria-label="社区打卡">
            {loadingCheckIns ? <p className="py-12 text-center" role="status">正在加载打卡…</p> : checkIns.length === 0 ? <div className="py-16 text-center"><h2 className="text-2xl font-bold mb-6">还没有打卡</h2><button type="button" onClick={openCheckIn} className="jw-action">发布第一条打卡</button></div> : checkIns.map((checkIn) => <CheckInCard key={checkIn.id} checkIn={checkIn} onUpdate={refreshCheckIns} highlighted={checkIn.id === targetCheckInId} />)}
          </section>
        </div>
      </>}
      {activeTab === 'partners' && <>
        <div className="partner-toolbar"><label className="partner-search"><Search aria-hidden="true" /><input aria-label="搜索伙伴" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setVisiblePartnerCount(24); }} placeholder="搜索昵称、标签、技能" /></label></div>
        <div className="partner-category-filter" aria-label="按伙伴标签筛选">{['全部','科研','考研','健身','创业'].map((category) => <button type="button" key={category} aria-pressed={partnerCategory === category} onClick={() => { setPartnerCategory(category); setVisiblePartnerCount(24); }}>{category}</button>)}</div>
        {loadingProfiles ? <p className="py-12 text-center" role="status">正在加载伙伴…</p> : filteredProfiles.length === 0 ? <p className="py-12 text-center">{searchQuery ? '没有找到匹配的伙伴，试试其他关键词。' : '暂无公开的伙伴名片。'}</p> : <div className="partner-grid">{filteredProfiles.slice(0, visiblePartnerCount).map((profile) => <ProfileCard key={profile.id} profile={profile} onSelect={() => setSelectedProfile(profile)} onShare={() => handleShareProfile(profile)} shareCopied={copiedProfileId === profile.id} />)}</div>}
        {!loadingProfiles && visiblePartnerCount < filteredProfiles.length && <div className="py-8 text-center"><button type="button" className="jw-action secondary" onClick={() => setVisiblePartnerCount((count) => count + 24)}>查看更多伙伴</button></div>}
      </>}

      {/* 弹窗组件 */}
      {showCreateModal && user && (
        <CreateCheckInModal 
          userId={user.id} 
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadCheckIns();
            setRankingRevision((value) => value + 1);
          }}
        />
      )}

      {selectedProfile && (
        <ProfileModal
          profile={selectedProfile}
          isLoggedIn={!!user}
          onClose={() => setSelectedProfile(null)}
          onShare={() => handleShareProfile(selectedProfile)}
          shareCopied={copiedProfileId === selectedProfile.id}
        />
      )}
    </div>
  );
};

const Avatar: React.FC<{ profile: Profile }> = ({ profile }) => <span className="ranking-avatar">{profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : profile.nickname?.slice(0,1) || '友'}</span>;

const ProfileCard: React.FC<{ profile: Profile; onSelect: () => void; onShare: () => void; shareCopied: boolean }> = ({ profile, onSelect, onShare, shareCopied }) => (
  <article className="partner-card">
    <div className="partner-card-heading"><Avatar profile={profile} /><button type="button" className="partner-open" onClick={onSelect}><h2>{profile.nickname}</h2></button><button type="button" className="partner-share" onClick={onShare} aria-label={shareCopied ? '链接已复制' : '分享伙伴名片'}>{shareCopied ? <Check /> : <Share2 />}</button></div>
    <div className="partner-capabilities"><div><h3>我能提供</h3><p>{profile.skills_offering || '还未填写'}</p></div><div><h3>我正在寻找</h3><p>{profile.skills_seeking || '还未填写'}</p></div></div>
    <div className="partner-card-bottom"><span>{profile.tags?.[0] && <span className="partner-tag">{profile.tags[0]}</span>}</span><button type="button" onClick={onSelect}>查看名片 <ExternalLink className="inline-block ml-2" /></button></div>
  </article>
);

const ProfileModal: React.FC<{ profile: Profile; isLoggedIn: boolean; onClose: () => void; onShare: () => void; shareCopied: boolean }> = ({ profile, isLoggedIn, onClose, onShare, shareCopied }) => (
  <Dialog title={profile.nickname || '伙伴名片'} onClose={onClose} className="partner-modal">
    <div className="partner-card-heading"><Avatar profile={profile} /><p>{formatGroupIdentity(profile.group_identity)}</p><button type="button" className="partner-share" onClick={onShare} aria-label="分享伙伴名片">{shareCopied ? <Check /> : <Share2 />}</button></div>
    {profile.group_nickname && <p className="partner-identity">群昵称 · {profile.group_nickname}</p>}
    {profile.bio && <p className="mt-6 whitespace-pre-wrap">{profile.bio}</p>}
    {!!profile.tags?.length && <div className="flex flex-wrap gap-2 mt-5">{profile.tags.map((tag) => <span key={tag} className="partner-tag">{tag}</span>)}</div>}
    <div className="partner-capabilities"><div><h3>我能提供</h3><p>{profile.skills_offering || '还未填写'}</p></div><div><h3>我正在寻找</h3><p>{profile.skills_seeking || '还未填写'}</p></div></div>
    {isLoggedIn ? <>
      {profile.wechat_id && <div className="contact-info"><h3>微信号</h3><p className="break-all">{profile.wechat_id}</p></div>}
      {profile.social_links && <div className="contact-links">{Object.entries(profile.social_links as Record<string,string>).filter(([,value]) => value).map(([key,value]) => <a key={key} href={value} target="_blank" rel="noopener noreferrer"><ExternalLink size={18} />{key}</a>)}</div>}
    </> : <div className="contact-info"><h3>登录后查看联系方式</h3><div className="contact-links"><Link to="/login" state={{ from: getPartnerSharePath(profile.id) }} className="jw-action">登录</Link><Link to="/register" state={{ from: getPartnerSharePath(profile.id) }}>注册加入社区</Link></div></div>}
  </Dialog>
);
export default CommunityV2;
