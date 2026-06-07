import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Briefcase,
  Award,
  Camera,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Lightbulb,
  Loader,
  MapPin,
  MessageCircle,
  Medal,
  Phone,
  PlayCircle,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  askDigitalHuman,
  getPublicPersonalProfileBundle,
} from '../services/personalBrandService';
import type {
  DigitalHumanMessage,
  PersonalEntry,
  PersonalEntryType,
  PersonalFile,
  PersonalProfileBundle,
} from '../types/personalBrand';

const SECTION_ORDER: PersonalEntryType[] = [
  'resume',
  'paper',
  'venture',
  'project',
];

const CHAT_HISTORY_STORAGE_PREFIX = 'jianwen-personal-brand-chat';
const CHAT_HISTORY_MAX_MESSAGES = 40;
const CHAT_CONTEXT_MAX_MESSAGES = 20;

const SECTION_META: Record<
  PersonalEntryType,
  { title: string; icon: React.ComponentType<{ className?: string }> }
> = {
  resume: { title: '简历经历', icon: Briefcase },
  paper: { title: '论文成果', icon: GraduationCap },
  venture: { title: '创业项目', icon: Lightbulb },
  project: { title: '项目介绍', icon: FileText },
  custom: { title: '更多内容', icon: BookOpen },
};

const SOCIAL_LABELS: Record<string, string> = {
  website: '个人网站',
  github: 'GitHub',
  bilibili: 'B站',
  xiaohongshu: '小红书',
  zhihu: '知乎',
  linkedin: 'LinkedIn',
  douyin: '抖音',
};

const DEFAULT_SOCIAL_LINKS: Record<string, string> = {
  bilibili: 'https://space.bilibili.com/495933903',
};

const normalizeSocialUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname.includes('bilibili.com')) {
      parsedUrl.search = '';
      parsedUrl.hash = '';
    }
    return parsedUrl.toString();
  } catch {
    return url;
  }
};

const getSocialLabel = (key: string, url: string) => {
  if (key === 'website' && url.includes('baike.baidu.com')) return '百度百科';
  return SOCIAL_LABELS[key] || key;
};

const formatPeriod = (entry: PersonalEntry) => {
  if (!entry.startDate && !entry.endDate && !entry.isOngoing) return '';
  const end = entry.isOngoing ? '至今' : entry.endDate || '';
  return [entry.startDate, end].filter(Boolean).join(' - ');
};

const getFileExtension = (url: string) => {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split('.').pop()?.toLowerCase() || '';
  } catch {
    return url.split('?')[0].split('.').pop()?.toLowerCase() || '';
  }
};

const isImageFile = (file: PersonalFile) => {
  const extension = getFileExtension(file.fileUrl);
  return Boolean(
    file.mimeType?.startsWith('image/') ||
      ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(extension),
  );
};

const isVideoFile = (file: PersonalFile) => {
  const extension = getFileExtension(file.fileUrl);
  return Boolean(
    file.mimeType?.startsWith('video/') ||
      ['mp4', 'webm', 'mov', 'm4v'].includes(extension),
  );
};

const getSocialLinks = (socialLinks: Record<string, string>) =>
  Object.entries({ ...DEFAULT_SOCIAL_LINKS, ...socialLinks })
    .filter(([, url]) => Boolean(url))
    .map(([key, url]) => ({
      key,
      label: getSocialLabel(key, url),
      url: normalizeSocialUrl(url),
    }));

const getChatHistoryKey = (profileId: string, slug: string) =>
  `${CHAT_HISTORY_STORAGE_PREFIX}:${slug || profileId}`;

const getWelcomeMessage = (bundle: PersonalProfileBundle): DigitalHumanMessage => ({
  role: 'assistant',
  content:
    bundle.profile.aiWelcomeMessage ||
    '你好，我已经接入了这位作者的公开资料，你可以直接问我。',
});

const normalizeStoredMessages = (value: unknown): DigitalHumanMessage[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (message): message is DigitalHumanMessage =>
        Boolean(
          message &&
            typeof message === 'object' &&
            'role' in message &&
            'content' in message &&
            ((message as { role: unknown }).role === 'user' ||
              (message as { role: unknown }).role === 'assistant') &&
            typeof (message as { content: unknown }).content === 'string' &&
            (message as { content: string }).content.trim(),
        ),
    )
    .slice(-CHAT_HISTORY_MAX_MESSAGES);
};

const loadStoredMessages = (key: string): DigitalHumanMessage[] => {
  try {
    return normalizeStoredMessages(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch (storageError) {
    console.warn('读取数字人历史对话失败:', storageError);
    return [];
  }
};

const saveStoredMessages = (key: string, nextMessages: DigitalHumanMessage[]) => {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(nextMessages.slice(-CHAT_HISTORY_MAX_MESSAGES)),
    );
  } catch (storageError) {
    console.warn('保存数字人历史对话失败:', storageError);
  }
};

const PublicSection: React.FC<{
  entryType: PersonalEntryType;
  entries: PersonalEntry[];
}> = ({ entryType, entries }) => {
  if (entries.length === 0) return null;

  const meta = SECTION_META[entryType];
  const Icon = meta.icon;

  return (
    <section className="about-panel p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="about-icon">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="about-panel-title text-xl">{meta.title}</h2>
          <p className="about-panel-muted text-sm mt-1">公开展示给社区和数字人的核心内容</p>
        </div>
      </div>

      <div className="space-y-5">
        {entries.map((entry) => (
          <article key={entry.id} className="about-subpanel p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="about-panel-title text-lg">{entry.title || '未命名内容'}</h3>
                {(entry.subtitle || entry.organization) && (
                  <p className="about-panel-muted text-sm mt-1">
                    {[entry.subtitle, entry.organization].filter(Boolean).join(' | ')}
                  </p>
                )}
              </div>
              {formatPeriod(entry) && (
                <span className="about-panel-muted text-sm whitespace-nowrap">{formatPeriod(entry)}</span>
              )}
            </div>

            {entry.summary && <p className="about-panel-copy mt-3 leading-7">{entry.summary}</p>}
            {entry.content && <p className="about-panel-muted mt-3 text-sm leading-7 whitespace-pre-wrap">{entry.content}</p>}

            {entry.highlights.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {entry.highlights.map((item) => (
                  <span
                    key={item}
                    className="about-chip px-3 py-1 text-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>
            )}

            {entry.links.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {entry.links.map((link) => (
                  <a
                    key={`${entry.id}-${link.url}`}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="about-link inline-flex items-center gap-1.5 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
};

const FileCard: React.FC<{ file: PersonalFile }> = ({ file }) => (
  <a
    href={file.fileUrl}
    target="_blank"
    rel="noreferrer"
    className="about-subpanel block p-4 transition hover:border-cyan-200/35 hover:bg-slate-800/80"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="about-panel-title flex items-center gap-2 font-medium">
          <FileText className="w-4 h-4 text-cyan-300 flex-shrink-0" />
          <span className="truncate">{file.title}</span>
        </div>
        {file.description && <p className="about-panel-muted mt-2 text-sm leading-6">{file.description}</p>}
      </div>
      <Download className="w-4 h-4 text-slate-400 flex-shrink-0" />
    </div>
  </a>
);

const AchievementMediaWall: React.FC<{ files: PersonalFile[] }> = ({ files }) => {
  const mediaFiles = files.filter((file) => isImageFile(file) || isVideoFile(file)).slice(0, 12);
  const hasMedia = mediaFiles.length > 0;

  return (
    <section className="about-panel overflow-hidden">
      <div className="p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="about-icon">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h2 className="about-panel-title text-xl">奖状奖牌影像墙</h2>
                <p className="about-panel-muted text-sm mt-1">证书、奖牌、比赛现场、训练视频和内容作品都可以在这里聚合</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="about-subpanel px-4 py-3">
              <div className="about-panel-title text-2xl">100+</div>
              <div className="about-panel-muted text-xs mt-1">奖状奖牌</div>
            </div>
            <div className="about-subpanel px-4 py-3">
              <div className="about-panel-title text-2xl">4</div>
              <div className="about-panel-muted text-xs mt-1">成长阶段</div>
            </div>
            <div className="about-subpanel px-4 py-3">
              <div className="about-panel-title text-2xl">{hasMedia ? mediaFiles.length : '待传'}</div>
              <div className="about-panel-muted text-xs mt-1">精选素材</div>
            </div>
          </div>
        </div>
      </div>

      {hasMedia ? (
        <div className="about-media-grid border-t border-slate-700/50 p-4 md:p-6">
          {mediaFiles.map((file, index) => {
            const isVideo = isVideoFile(file);
            return (
              <a
                key={file.id}
                href={file.fileUrl}
                target="_blank"
                rel="noreferrer"
                className={`about-media-card ${index === 0 ? 'about-media-card-featured' : ''}`}
              >
                {isVideo ? (
                  <video src={file.fileUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                ) : (
                  <img src={file.fileUrl} alt={file.title} className="h-full w-full object-cover" loading="lazy" />
                )}
                <div className="about-media-overlay">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    {isVideo ? <PlayCircle className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                    <span className="line-clamp-1">{file.title}</span>
                  </div>
                  {file.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-200">{file.description}</p>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="border-t border-slate-700/50 p-5 md:p-6">
          <div className="about-evidence-empty">
            <div className="about-icon">
              <Medal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="about-panel-title text-lg">证据库待补充真实素材</h3>
              <p className="about-panel-muted mt-2 text-sm leading-6">
                后台上传公开的奖状、奖牌、比赛照片或视频后，这里会自动变成影像墙；现在先作为成就档案的收纳入口。
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const ContactPanel: React.FC<{ wechatPublic?: string }> = ({ wechatPublic }) => (
  <section className="about-panel p-6 md:p-8">
    <div className="flex items-center gap-3 mb-5">
      <div className="about-icon">
        <Phone className="w-5 h-5" />
      </div>
      <div>
        <h2 className="about-panel-title text-xl">加粉丝群与线上咨询</h2>
        <p className="about-panel-muted text-sm mt-1">看完经历后，如果方向匹配，再来聊具体问题</p>
      </div>
    </div>

    <div className="space-y-4 about-panel-copy leading-7">
      <div className="about-subpanel p-4">
        <div className="about-panel-muted text-sm">粉丝群 / 联系微信</div>
        <div className="about-panel-title text-lg mt-1">
          {wechatPublic || 'HLG53589'}
        </div>
        <div className="about-panel-muted text-sm mt-1">添加时请备注：社区 + 你的来意（咨询/学习/健身）</div>
      </div>

      <div className="about-subpanel p-4">
        <div className="about-panel-muted text-sm">线上教学 / 咨询方向</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            '健身训练咨询',
            '学习方法咨询',
            '高考咨询',
            '保研咨询',
            '科研方向咨询',
            '数学咨询',
            'AI 咨询',
            '自动化相关咨询',
          ].map((item) => (
            <span key={item} className="about-chip px-3 py-1 text-sm">
              {item}
            </span>
          ))}
        </div>
        <div className="about-panel-muted mt-3 text-sm">
          适合有明确目标的人群：可按你当前阶段给出路线、方法和执行建议。
        </div>
      </div>

      <div className="about-rate-box p-4">
        <div className="text-sm font-medium text-amber-200">咨询费用</div>
        <div className="text-2xl font-bold text-amber-100 mt-1">300 元 / 小时</div>
        <div className="text-sm text-amber-100/85 mt-1">
          默认线上进行，可先简要说明问题，我会先判断是否匹配再约时间。
        </div>
      </div>
    </div>
  </section>
);

const CollaborationPanel: React.FC = () => (
  <section className="about-panel p-6 md:p-8">
    <div className="flex items-center gap-3 mb-5">
      <div className="about-icon">
        <Sparkles className="w-5 h-5" />
      </div>
      <div>
        <h2 className="about-panel-title text-xl">合作招募</h2>
        <p className="about-panel-muted text-sm mt-1">如果你认可上面的方向，欢迎并肩做长期有价值的事</p>
      </div>
    </div>

    <div className="space-y-4">
      <article className="about-subpanel p-5">
        <h3 className="about-panel-title text-lg">
          北大 AI 博士招募自媒体合伙人，共创「学习 x 健身」IP
        </h3>
        <p className="about-panel-muted mt-2 text-sm leading-7">
          你将深度参与内容策划、拍摄剪辑、账号运营增长，和我一起做从 0 到 1 的内容创业。以收益分成为主，长期优秀伙伴可提供股权/期权激励。
        </p>
        <div className="about-panel-copy mt-3 text-sm">
          投递方式：简历 + 作品集发送至 <span className="font-medium">jianwen_ma@stu.pku.edu.cn</span>
        </div>
        <a
          href="https://www.wolai.com/kHD63uJ2BxtdVcXTTXiqx7"
          target="_blank"
          rel="noreferrer"
          className="about-link mt-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ExternalLink className="w-4 h-4" />
          查看自媒体合伙人详情
        </a>
      </article>

      <article className="about-subpanel p-5">
        <h3 className="about-panel-title text-lg">助理岗位（兼创业支持 & 自媒体运营）</h3>
        <p className="about-panel-muted mt-2 text-sm leading-7">
          岗位覆盖会议纪要整理、社群运营、时间管理提醒、材料处理、基础剪辑与信息调研，目标是成为我长期可信赖的创业与内容协作伙伴。
        </p>
        <div className="about-panel-copy mt-3 text-sm">
          优先考虑：对创业/自媒体有热情、执行力强、沟通靠谱、保密意识强的同学。
        </div>
        <a
          href="https://www.wolai.com/3McxtZTTow99yns9Q8AbH9"
          target="_blank"
          rel="noreferrer"
          className="about-link mt-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ExternalLink className="w-4 h-4" />
          查看助理岗位详情
        </a>
      </article>

      <article className="about-subpanel p-5">
        <h3 className="about-panel-title text-lg">技术合伙人招募（小程序 / 网页 / App）</h3>
        <p className="about-panel-muted mt-2 text-sm leading-7">
          我们正在做学习 x 健身方向的长期创业项目，欢迎有创业想法、愿意长期投入、执行力强的技术伙伴加入。你将深度参与产品研发和技术路线共建。
        </p>
        <div className="about-panel-copy mt-3 text-sm leading-7">
          核心要求：有较多可投入时间；具备扎实开发基础（小程序 / Web / App 至少一到两端有实战）；学习能力强；关注并积极使用最新 AI 工具；懂得使用 AI Agent（如 OpenClaw 等）提升研发效率。
          <br />
          加分项：在北京，95后或00后（00后优先）；对内容创业和 AI 原生产品有强烈兴趣。
        </div>
        <div className="about-panel-copy mt-3 text-sm">
          投递方式：简历 + 作品 / GitHub 发送至 <span className="font-medium">jianwen_ma@stu.pku.edu.cn</span>
        </div>
      </article>
    </div>
  </section>
);

const PersonalBrandPublic: React.FC = () => {
  const [bundle, setBundle] = useState<PersonalProfileBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<DigitalHumanMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [answering, setAnswering] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadBundle = async () => {
      try {
        setLoading(true);
        const publicBundle = await getPublicPersonalProfileBundle();
        setBundle(publicBundle);
        if (publicBundle?.profile.aiEnabled) {
          const historyKey = getChatHistoryKey(
            publicBundle.profile.id,
            publicBundle.profile.slug,
          );
          const storedMessages = loadStoredMessages(historyKey);
          setMessages(storedMessages.length > 0 ? storedMessages : [getWelcomeMessage(publicBundle)]);
        }
      } catch (loadError) {
        console.error('加载个人主页失败:', loadError);
        setError('加载个人主页失败，请稍后重试。');
      } finally {
        setLoading(false);
      }
    };

    loadBundle();
  }, []);

  useEffect(() => {
    if (!bundle?.profile.aiEnabled || messages.length === 0) return;

    saveStoredMessages(
      getChatHistoryKey(bundle.profile.id, bundle.profile.slug),
      messages,
    );
  }, [bundle?.profile.aiEnabled, bundle?.profile.id, bundle?.profile.slug, messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [answering, messages]);

  const groupedEntries = useMemo(() => {
    const groups = new Map<PersonalEntryType, PersonalEntry[]>();
    SECTION_ORDER.forEach((key) => groups.set(key, []));

    (bundle?.entries || []).forEach((entry) => {
      const existing = groups.get(entry.entryType) || [];
      existing.push(entry);
      groups.set(entry.entryType, existing);
    });

    return groups;
  }, [bundle]);

  const socialLinks = useMemo(
    () => getSocialLinks(bundle?.profile.socialLinks || {}),
    [bundle?.profile.socialLinks],
  );

  const handleAsk = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!bundle?.profile.aiEnabled || !question.trim() || answering) return;

    const userMessage: DigitalHumanMessage = {
      role: 'user',
      content: question.trim(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setQuestion('');

    try {
      setAnswering(true);
      const response = await askDigitalHuman({
        slug: bundle.profile.slug,
        messages: nextMessages.slice(-CHAT_CONTEXT_MAX_MESSAGES),
      });

      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: response.answer,
        },
      ]);
    } catch (chatError) {
      console.error('数字人回答失败:', chatError);
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: '抱歉，当前数字人暂时不可用，请稍后再试。',
        },
      ]);
    } finally {
      setAnswering(false);
    }
  };

  const handleClearChat = () => {
    if (!bundle) return;

    const welcomeMessages = [getWelcomeMessage(bundle)];
    setMessages(welcomeMessages);
    setQuestion('');
    saveStoredMessages(
      getChatHistoryKey(bundle.profile.id, bundle.profile.slug),
      welcomeMessages,
    );
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-300">
          <Loader className="w-5 h-5 animate-spin" />
          加载个人主页中...
        </div>
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-slate-50">个人主页暂不可用</h1>
        <p className="mt-3 text-slate-300">{error || '当前还没有公开的个人主页内容。'}</p>
      </div>
    );
  }

  return (
    <div className="about-page space-y-8">
      <section className="hero-cyber rounded-[1.5rem] text-white">
        <div className="relative z-10 px-6 py-10 md:px-10 md:py-14">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/12 px-4 py-1.5 text-sm font-medium text-cyan-50 mb-5 shadow-lg shadow-cyan-950/20">
                <Sparkles className="w-4 h-4" />
                关于我与 AI 分身
              </div>
              <h1 className="text-4xl md:text-6xl font-black tracking-normal text-white">
                {bundle.profile.displayName || '未命名主页'}
              </h1>
              {bundle.profile.headline && (
                <p className="mt-4 text-lg md:text-xl font-medium text-cyan-50">{bundle.profile.headline}</p>
              )}
              {bundle.profile.intro && (
                <p className="mt-5 max-w-3xl text-base text-slate-100 leading-8 whitespace-pre-wrap">
                  {bundle.profile.intro}
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3 text-sm text-cyan-100">
                {bundle.profile.location && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/12 px-3 py-1.5">
                    <MapPin className="w-4 h-4" />
                    {bundle.profile.location}
                  </span>
                )}
                {bundle.profile.expertise.map((item) => (
                  <span key={item} className="rounded-full border border-white/15 bg-white/12 px-3 py-1.5">
                    {item}
                  </span>
                ))}
              </div>

              {socialLinks.length > 0 && (
                <div className="mt-6">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/60">
                    重要链接
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {socialLinks.slice(0, 8).map((link) => (
                      <a
                        key={link.key}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/12 px-4 py-2 text-sm font-medium text-cyan-50 transition hover:bg-cyan-300/18"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full border border-white/15 bg-white/12 px-4 py-2 text-slate-50">
                  这里是 AI 分身即时回答，不会自动进入公开问答广场
                </span>
                <Link
                  to="/qa"
                  className="rounded-full border border-cyan-300/35 bg-cyan-300/12 px-4 py-2 font-medium text-cyan-50 hover:bg-cyan-300/18 transition"
                >
                  想提交真人回答的问题，去公开问答
                </Link>
              </div>
            </div>

            <div className="about-hero-proof">
              <div className="about-hero-proof-top">
                <Award className="h-6 w-6 text-amber-200" />
                <div>
                  <div className="text-sm text-cyan-100/80">成就档案</div>
                  <div className="text-4xl font-black text-white">100+</div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  ['学业竞赛', '奖状奖牌'],
                  ['科研论文', '公开成果'],
                  ['健身内容', '千万播放'],
                  ['AI 创业', '产品实践'],
                ].map(([title, value]) => (
                  <div key={title} className="rounded-2xl border border-white/12 bg-white/10 p-4">
                    <div className="text-xs text-cyan-100/75">{title}</div>
                    <div className="mt-1 text-sm font-semibold text-white">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-4 text-sm leading-6 text-amber-50">
                小学、中学、本科、博士阶段的奖状和奖牌可以在这一页被串成一条完整成长线。
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-8 items-start">
        <div className="space-y-8">
          {bundle.profile.longBio && (
            <section className="about-panel p-6 md:p-8">
              <h2 className="about-panel-title text-xl mb-4">基础信息</h2>
              <p className="about-panel-copy leading-8 whitespace-pre-wrap">{bundle.profile.longBio}</p>
            </section>
          )}

          {SECTION_ORDER.map((entryType) => (
            <PublicSection
              key={entryType}
              entryType={entryType}
              entries={groupedEntries.get(entryType) || []}
            />
          ))}

          <AchievementMediaWall files={bundle.files} />

          {bundle.files.length > 0 && (
            <section className="about-panel p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="about-icon">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="about-panel-title text-xl">附件资料</h2>
                  <p className="about-panel-muted text-sm mt-1">简历、论文、项目说明书等文件</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bundle.files.map((file) => (
                  <FileCard key={file.id} file={file} />
                ))}
              </div>
            </section>
          )}

          <ContactPanel wechatPublic={bundle.profile.wechatPublic} />
          <CollaborationPanel />
        </div>

        <aside className="xl:sticky xl:top-24">
          <div className="about-chat-shell">
            <div className="about-chat-head px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-slate-50 font-semibold">
                    <MessageCircle className="w-5 h-5 text-cyan-300" />
                    和我的 AI 分身聊聊
                  </div>
                  <div className="about-panel-muted mt-1 text-xs">本机保留历史</div>
                </div>
                {bundle.profile.aiEnabled && messages.length > 1 && (
                  <button
                    type="button"
                    onClick={handleClearChat}
                    className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-slate-600/70 text-slate-300 transition hover:border-cyan-300/40 hover:bg-slate-800 hover:text-cyan-100"
                    aria-label="清空历史对话"
                    title="清空历史对话"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="about-panel-muted mt-2 text-sm leading-6">
                这里会基于公开资料即时回答关于经历、论文、创业和项目的问题，不代表我本人实时在线，也不会自动发布到公开问答广场。
              </p>
            </div>

            {bundle.profile.aiEnabled ? (
              <>
                <div className="p-5 space-y-4 max-h-[32rem] overflow-y-auto">
                  {messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={message.role === 'assistant' ? 'flex justify-start' : 'flex justify-end'}
                    >
                      <div
                        className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-7 ${
                          message.role === 'assistant'
                            ? 'about-chat-assistant'
                            : 'about-chat-user'
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}
                  {answering && (
                    <div className="flex justify-start">
                      <div className="about-chat-assistant rounded-2xl px-4 py-3 text-sm flex items-center gap-2">
                        <Loader className="w-4 h-4 animate-spin" />
                        数字人思考中...
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleAsk} className="border-t border-slate-700/60 p-4">
                  <div className="flex gap-3">
                    <textarea
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      rows={3}
                      placeholder="例如：你最值得讲的一段创业经历是什么？如果我想看真人公开回答，请去公开问答页提交。"
                      className="flex-1 rounded-2xl border border-slate-600/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    />
                    <button
                      type="submit"
                      disabled={answering || !question.trim()}
                      className="self-end inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-500 text-slate-950 transition hover:bg-cyan-300 disabled:bg-slate-700 disabled:text-slate-400"
                      aria-label="发送问题"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="about-panel-muted p-6 text-sm">当前未开启数字人问答。</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default PersonalBrandPublic;
