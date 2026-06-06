import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Lock,
  MapPin,
  MessageCircle,
  Search,
  Share2,
  Sparkles,
  Target,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getPublicPartnerProfileById } from '../services/partnerService';
import type { PartnerProfile } from '../services/partnerService';
import { formatGroupIdentity } from '../utils/profileUtils';
import { getPartnerGradient, sharePartnerProfile } from '../utils/partnerShare';

const PartnerSharePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      if (!id) {
        setError('名片链接无效');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const data = await getPublicPartnerProfileById(id);
        if (!mounted) return;
        setProfile(data);
        if (!data) setError('这张伙伴名片暂时不可访问');
      } catch (loadError) {
        console.error('加载伙伴名片失败:', loadError);
        if (mounted) setError('加载伙伴名片失败，请稍后重试');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [id]);

  const shareFromPath = location.pathname;
  const gradient = useMemo(() => (profile ? getPartnerGradient(profile.id) : 'from-blue-400 to-indigo-500'), [profile]);
  const socialLinks = profile?.social_links as Record<string, string> | null;
  const visibleSocialLinks = socialLinks
    ? Object.entries(socialLinks).filter(([, value]) => Boolean(value))
    : [];

  const handleShare = async () => {
    if (!profile) return;

    try {
      await sharePartnerProfile(profile);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (shareError: unknown) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      console.error('分享伙伴名片失败:', shareError);
    }
  };

  if (loading) {
    return (
      <div className="page-aurora min-h-screen px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
          <p className="mt-4 text-slate-300">正在打开伙伴名片...</p>
        </div>
      </div>
    );
  }

  if (!profile || error) {
    return (
      <div className="page-aurora min-h-screen px-4 py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-700 bg-slate-900/75 p-8 text-center shadow-xl">
          <Users className="mx-auto h-12 w-12 text-slate-500" />
          <h1 className="mt-4 text-2xl font-bold text-white">名片不可访问</h1>
          <p className="mt-2 text-slate-300">{error || '这张伙伴名片不存在或已关闭公开展示'}</p>
          <Link
            to="/community"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700"
          >
            <Search className="h-4 w-4" />
            去社区找伙伴
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-aurora min-h-screen px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link to="/community" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-100 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            返回社区广场
          </Link>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
          >
            {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            {copied ? '已复制分享文案' : '分享这张名片'}
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
            <div className={`h-28 bg-gradient-to-r ${gradient}`} />
            <div className="px-6 pb-6">
              <div className="-mt-14 flex flex-wrap items-end gap-4">
                <div className="h-28 w-28 rounded-full bg-slate-950 p-1 shadow-xl">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.nickname} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-4xl font-bold text-white`}>
                      {profile.nickname?.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 pb-2">
                  <h1 className="break-words text-3xl font-black text-white">{profile.nickname}</h1>
                  {profile.group_nickname && (
                    <span className="mt-2 inline-flex rounded-lg bg-white/10 px-3 py-1 text-sm text-slate-200">
                      {profile.group_nickname}
                    </span>
                  )}
                </div>
              </div>

              {formatGroupIdentity(profile.group_identity) && (
                <p className="mt-4 flex items-center gap-2 text-slate-300">
                  <MapPin className="h-4 w-4 text-cyan-200" />
                  {formatGroupIdentity(profile.group_identity)}
                </p>
              )}

              {profile.bio && <p className="mt-4 whitespace-pre-wrap text-slate-200">{profile.bio}</p>}

              {profile.tags && profile.tags.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {profile.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-purple-400/10 px-3 py-1 text-sm font-medium text-purple-100 ring-1 ring-purple-300/20">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {profile.skills_offering && (
                  <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-4">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
                      <Sparkles className="h-4 w-4" />
                      我能提供
                    </h2>
                    <p className="mt-2 whitespace-pre-wrap text-emerald-50">{profile.skills_offering}</p>
                  </div>
                )}
                {profile.skills_seeking && (
                  <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-4">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                      <Target className="h-4 w-4" />
                      我正在寻找
                    </h2>
                    <p className="mt-2 whitespace-pre-wrap text-amber-50">{profile.skills_seeking}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            {user ? (
              <section id="contact" className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 shadow-xl backdrop-blur-xl">
                <h2 className="text-lg font-bold text-white">联系 TA</h2>
                <p className="mt-1 text-sm text-slate-300">已登录，可查看这张公开名片的联系方式。</p>
                {profile.wechat_id ? (
                  <div className="mt-4 rounded-xl bg-cyan-400/10 p-4 ring-1 ring-cyan-300/20">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
                      <MessageCircle className="h-4 w-4" />
                      微信号
                    </h3>
                    <p className="mt-2 break-all font-mono text-cyan-50">{profile.wechat_id}</p>
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl bg-white/5 p-4 text-sm text-slate-300">TA 暂未填写微信号。</p>
                )}

                {visibleSocialLinks.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-slate-200">社交链接</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {visibleSocialLinks.map(([key, value]) => (
                        <a
                          key={key}
                          href={value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/15"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {key}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            ) : (
              <section className="rounded-2xl border border-cyan-300/20 bg-cyan-950/45 p-5 shadow-xl backdrop-blur-xl">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300/15 text-cyan-100">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">注册后继续连接</h2>
                    <p className="mt-1 text-sm text-cyan-50/80">先看名片核心信息。想联系 TA、查看微信和社交链接，注册后会自动回到这里。</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <Link
                    to="/register"
                    state={{ from: shareFromPath }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-cyan-400"
                  >
                    <UserPlus className="h-4 w-4" />
                    我也想加入
                  </Link>
                  <Link
                    to="/login"
                    state={{ from: shareFromPath }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
                  >
                    已有账号登录
                  </Link>
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 shadow-xl backdrop-blur-xl">
              <h2 className="text-lg font-bold text-white">继续发现伙伴</h2>
              <p className="mt-1 text-sm text-slate-300">去社区广场按标签、技能和需求找更多同路人。</p>
              <Link
                to="/community"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-50"
              >
                <Search className="h-4 w-4" />
                打开找伙伴
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default PartnerSharePage;
