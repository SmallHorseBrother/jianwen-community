import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Briefcase,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Lightbulb,
  Loader,
  MapPin,
  MessageCircle,
  Send,
  Sparkles,
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
  'custom',
];

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

const formatPeriod = (entry: PersonalEntry) => {
  if (!entry.startDate && !entry.endDate && !entry.isOngoing) return '';
  const end = entry.isOngoing ? '至今' : entry.endDate || '';
  return [entry.startDate, end].filter(Boolean).join(' - ');
};

const PublicSection: React.FC<{
  entryType: PersonalEntryType;
  entries: PersonalEntry[];
}> = ({ entryType, entries }) => {
  if (entries.length === 0) return null;

  const meta = SECTION_META[entryType];
  const Icon = meta.icon;

  return (
    <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{meta.title}</h2>
          <p className="text-sm text-gray-500">公开展示给社区和数字人的核心内容</p>
        </div>
      </div>

      <div className="space-y-5">
        {entries.map((entry) => (
          <article key={entry.id} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{entry.title || '未命名内容'}</h3>
                {(entry.subtitle || entry.organization) && (
                  <p className="text-sm text-gray-600 mt-1">
                    {[entry.subtitle, entry.organization].filter(Boolean).join(' | ')}
                  </p>
                )}
              </div>
              {formatPeriod(entry) && (
                <span className="text-sm text-gray-500 whitespace-nowrap">{formatPeriod(entry)}</span>
              )}
            </div>

            {entry.summary && <p className="mt-3 text-gray-700 leading-7">{entry.summary}</p>}
            {entry.content && <p className="mt-3 text-sm text-gray-600 leading-7 whitespace-pre-wrap">{entry.content}</p>}

            {entry.highlights.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {entry.highlights.map((item) => (
                  <span
                    key={item}
                    className="px-3 py-1 rounded-full bg-white border border-gray-200 text-sm text-gray-700"
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
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
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
    className="block rounded-2xl border border-gray-200 bg-white p-4 hover:shadow-md transition"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-gray-900 font-medium">
          <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="truncate">{file.title}</span>
        </div>
        {file.description && <p className="mt-2 text-sm text-gray-600 leading-6">{file.description}</p>}
      </div>
      <Download className="w-4 h-4 text-gray-400 flex-shrink-0" />
    </div>
  </a>
);

const PersonalBrandPublic: React.FC = () => {
  const [bundle, setBundle] = useState<PersonalProfileBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<DigitalHumanMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [answering, setAnswering] = useState(false);

  useEffect(() => {
    const loadBundle = async () => {
      try {
        setLoading(true);
        const publicBundle = await getPublicPersonalProfileBundle();
        setBundle(publicBundle);
        if (publicBundle?.profile.aiEnabled) {
          setMessages([
            {
              role: 'assistant',
              content:
                publicBundle.profile.aiWelcomeMessage ||
                '你好，我已经接入了这位作者的公开资料，你可以直接问我。',
            },
          ]);
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
        messages: nextMessages,
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

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader className="w-5 h-5 animate-spin" />
          加载个人主页中...
        </div>
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">个人主页暂不可用</h1>
        <p className="mt-3 text-gray-600">{error || '当前还没有公开的个人主页内容。'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] overflow-hidden bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 text-white">
        <div className="px-6 py-10 md:px-10 md:py-14">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-blue-100 mb-5">
              <Sparkles className="w-4 h-4" />
              关于我与 AI 分身
            </div>
            <h1 className="text-3xl md:text-5xl font-bold">{bundle.profile.displayName || '未命名主页'}</h1>
            {bundle.profile.headline && (
              <p className="mt-4 text-lg md:text-xl text-blue-100">{bundle.profile.headline}</p>
            )}
            {bundle.profile.intro && (
              <p className="mt-5 max-w-3xl text-blue-50/90 leading-8 whitespace-pre-wrap">
                {bundle.profile.intro}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3 text-sm text-blue-100">
              {bundle.profile.location && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                  <MapPin className="w-4 h-4" />
                  {bundle.profile.location}
                </span>
              )}
              {bundle.profile.expertise.map((item) => (
                <span key={item} className="rounded-full bg-white/10 px-3 py-1.5">
                  {item}
                </span>
              ))}
            </div>

            {Object.entries(bundle.profile.socialLinks).length > 0 && (
              <div className="mt-6 flex flex-wrap gap-3">
                {Object.entries(bundle.profile.socialLinks).map(([label, url]) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm hover:bg-white/15 transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {label}
                  </a>
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-white/10 px-4 py-2 text-blue-50">
                这里是 AI 分身即时回答，不会自动进入公开问答广场
              </span>
              <Link
                to="/qa"
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-white hover:bg-white/15 transition"
              >
                想提交真人回答的问题，去公开问答
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-8 items-start">
        <div className="space-y-8">
          {bundle.profile.longBio && (
            <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">基础信息</h2>
              <p className="text-gray-700 leading-8 whitespace-pre-wrap">{bundle.profile.longBio}</p>
            </section>
          )}

          {SECTION_ORDER.map((entryType) => (
            <PublicSection
              key={entryType}
              entryType={entryType}
              entries={groupedEntries.get(entryType) || []}
            />
          ))}

          {bundle.files.length > 0 && (
            <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">附件资料</h2>
                  <p className="text-sm text-gray-500">简历、论文、项目说明书等文件</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bundle.files.map((file) => (
                  <FileCard key={file.id} file={file} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="xl:sticky xl:top-24">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-2 text-gray-900 font-semibold">
                <MessageCircle className="w-5 h-5 text-blue-600" />
                和我的 AI 分身聊聊
              </div>
              <p className="mt-2 text-sm text-gray-600">
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
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}
                  {answering && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl px-4 py-3 text-sm bg-gray-100 text-gray-600 flex items-center gap-2">
                        <Loader className="w-4 h-4 animate-spin" />
                        数字人思考中...
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleAsk} className="border-t border-gray-100 p-4">
                  <div className="flex gap-3">
                    <textarea
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      rows={3}
                      placeholder="例如：你最值得讲的一段创业经历是什么？如果我想看真人公开回答，请去公开问答页提交。"
                      className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={answering || !question.trim()}
                      className="self-end inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white disabled:bg-gray-300 transition"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="p-6 text-sm text-gray-500">当前未开启数字人问答。</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default PersonalBrandPublic;
