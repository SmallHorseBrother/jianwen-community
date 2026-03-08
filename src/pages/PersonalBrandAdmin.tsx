import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Briefcase,
  FilePlus2,
  GraduationCap,
  Lightbulb,
  Loader,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  deletePersonalFileRecord,
  getPersonalProfileBundleByOwner,
  replacePersonalEntries,
  savePersonalFileRecord,
  savePersonalProfile,
  uploadPersonalFile,
} from '../services/personalBrandService';
import { extractTextFromFile } from '../services/fileTextExtraction';
import {
  createEmptyPersonalEntry,
  PERSONAL_ENTRY_TYPE_LABELS,
  type PersonalEntry,
  type PersonalEntryType,
  type PersonalFile,
  type PersonalLink,
  type PersonalProfile,
} from '../types/personalBrand';

const SOCIAL_FIELDS = ['website', 'github', 'linkedin', 'xiaohongshu', 'bilibili', 'zhihu'];

const ENTRY_TYPE_ICONS: Record<
  PersonalEntryType,
  React.ComponentType<{ className?: string }>
> = {
  resume: Briefcase,
  paper: GraduationCap,
  venture: Lightbulb,
  project: FilePlus2,
  custom: BookOpen,
};

const parseLineItems = (value: string) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

const parseLinkLines = (value: string): PersonalLink[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, url] = line.split('|').map((part) => part.trim());
      return {
        label: label || url || '链接',
        url: url || label || '',
      };
    })
    .filter((link) => link.url);

const formatLinkLines = (links: PersonalLink[]) =>
  links.map((link) => `${link.label}|${link.url}`).join('\n');

const sortEntries = (entries: PersonalEntry[]) =>
  [...entries].sort((a, b) => a.sortOrder - b.sortOrder);

const PersonalBrandAdmin: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<PersonalProfile | null>(null);
  const [entries, setEntries] = useState<PersonalEntry[]>([]);
  const [files, setFiles] = useState<PersonalFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadBundle = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const bundle = await getPersonalProfileBundleByOwner(user.id);
        setProfile(bundle.profile);
        setEntries(sortEntries(bundle.entries));
        setFiles(bundle.files);
      } catch (error) {
        console.error('加载数字主页后台失败:', error);
        setMessage('加载失败，请刷新后重试。');
      } finally {
        setLoading(false);
      }
    };

    loadBundle();
  }, [user?.id]);

  const groupedEntries = useMemo(() => {
    const groups = new Map<PersonalEntryType, PersonalEntry[]>();

    (['resume', 'paper', 'venture', 'project', 'custom'] as PersonalEntryType[]).forEach(
      (type) => groups.set(type, []),
    );

    entries.forEach((entry) => {
      groups.set(entry.entryType, [...(groups.get(entry.entryType) || []), entry]);
    });

    return groups;
  }, [entries]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">请先登录</h1>
        <p className="mt-3 text-gray-600">登录后才能编辑你的个人主页和数字人资料。</p>
        <Link
          to="/login"
          className="inline-flex mt-6 rounded-xl bg-blue-600 text-white px-5 py-3 font-medium hover:bg-blue-700 transition"
        >
          去登录
        </Link>
      </div>
    );
  }

  if (loading || !profile) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-gray-500">
        <Loader className="w-5 h-5 animate-spin mr-2" />
        加载数字主页后台中...
      </div>
    );
  }

  const updateProfileField = <K extends keyof PersonalProfile>(key: K, value: PersonalProfile[K]) => {
    setProfile((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateEntry = (entryId: string, updater: (entry: PersonalEntry) => PersonalEntry) => {
    setEntries((current) =>
      current.map((entry) => (entry.id === entryId ? updater(entry) : entry)),
    );
  };

  const addEntry = (entryType: PersonalEntryType) => {
    setEntries((current) => [
      ...current,
      createEmptyPersonalEntry(profile.id, entryType, current.length + 1),
    ]);
  };

  const removeEntry = (entryId: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
  };

  const persistProfile = async () => {
    if (!profile || !user?.id) return null;

    const savedProfile = await savePersonalProfile({
      ...profile,
      ownerId: user.id,
      slug: profile.slug.trim() || 'my-about',
    });

    setProfile(savedProfile);
    return savedProfile;
  };

  const handleSaveAll = async () => {
    if (!profile) return;

    try {
      setSaving(true);
      setMessage('');
      const savedProfile = await persistProfile();
      if (!savedProfile) return;

      const savedEntries = await replacePersonalEntries(
        savedProfile.id,
        entries.map((entry, index) => ({
          ...entry,
          profileId: savedProfile.id,
          sortOrder: index + 1,
        })),
      );

      setEntries(sortEntries(savedEntries));
      setMessage('已保存个人主页与内容结构。');
    } catch (error) {
      console.error('保存个人主页失败:', error);
      setMessage('保存失败，请检查必填项或稍后再试。');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
    defaultTitle: string,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    try {
      setUploading(true);
      setMessage('');

      const savedProfile = await persistProfile();
      if (!savedProfile) return;

      const extractedText = await extractTextFromFile(file);
      const uploaded = await uploadPersonalFile(file, user.id);
      const record = await savePersonalFileRecord({
        id: '',
        profileId: savedProfile.id,
        entryId: '',
        title: defaultTitle || file.name,
        description: '',
        filePath: uploaded.filePath,
        fileUrl: uploaded.fileUrl,
        mimeType: file.type,
        sizeBytes: file.size,
        extractedText,
        isPublic: true,
        useForAi: true,
      });

      setFiles((current) => [record, ...current]);
      setMessage(
        extractedText
          ? '附件上传成功，系统已自动提取可供数字人使用的正文摘要。'
          : '附件上传成功，但该文件类型暂未自动提取正文，可稍后手动补充 AI 摘要。',
      );
      event.target.value = '';
    } catch (error) {
      console.error('上传附件失败:', error);
      setMessage('附件上传失败，请稍后重试。');
    } finally {
      setUploading(false);
    }
  };

  const updateFile = (fileId: string, updater: (file: PersonalFile) => PersonalFile) => {
    setFiles((current) => current.map((file) => (file.id === fileId ? updater(file) : file)));
  };

  const handleSaveFile = async (file: PersonalFile) => {
    try {
      const saved = await savePersonalFileRecord({
        id: file.id,
        profileId: file.profileId,
        entryId: file.entryId,
        title: file.title,
        description: file.description,
        filePath: file.filePath,
        fileUrl: file.fileUrl,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        extractedText: file.extractedText,
        isPublic: file.isPublic,
        useForAi: file.useForAi,
      });
      setFiles((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setMessage(`附件「${saved.title}」已保存。`);
    } catch (error) {
      console.error('保存附件失败:', error);
      setMessage('附件保存失败，请稍后再试。');
    }
  };

  const handleDeleteFile = async (file: PersonalFile) => {
    try {
      await deletePersonalFileRecord(file);
      setFiles((current) => current.filter((item) => item.id !== file.id));
      setMessage(`附件「${file.title}」已删除。`);
    } catch (error) {
      console.error('删除附件失败:', error);
      setMessage('删除附件失败，请稍后再试。');
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] overflow-hidden bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 text-white">
        <div className="px-6 py-10 md:px-10 md:py-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-blue-100 mb-4">
                <Sparkles className="w-4 h-4" />
                个人主页后台
              </div>
              <h1 className="text-3xl font-bold">打造你的公开介绍与数字分身</h1>
              <p className="mt-3 text-blue-100 max-w-3xl leading-7">
                这里维护展示页内容、简历/论文/创业项目、附件资料，以及数字人的系统提示词。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/about"
                className="inline-flex items-center rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-medium hover:bg-white/15 transition"
              >
                查看公开页
              </Link>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-white text-blue-900 px-5 py-3 font-semibold disabled:opacity-60"
              >
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                保存全部
              </button>
            </div>
          </div>
        </div>
      </section>

      {message && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 text-blue-700 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">基础信息</h2>
          <p className="text-sm text-gray-500 mt-1">这些字段控制你的公开介绍页头图和个人资料基础内容。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            value={profile.displayName}
            onChange={(event) => updateProfileField('displayName', event.target.value)}
            placeholder="展示名称"
            className="rounded-2xl border border-gray-200 px-4 py-3"
          />
          <input
            value={profile.slug}
            onChange={(event) => updateProfileField('slug', event.target.value)}
            placeholder="slug，例如 ma-jianwen"
            className="rounded-2xl border border-gray-200 px-4 py-3"
          />
          <input
            value={profile.headline}
            onChange={(event) => updateProfileField('headline', event.target.value)}
            placeholder="一句话标题，例如 创业者 / 研究者 / 开发者"
            className="rounded-2xl border border-gray-200 px-4 py-3 md:col-span-2"
          />
          <input
            value={profile.location || ''}
            onChange={(event) => updateProfileField('location', event.target.value)}
            placeholder="所在地"
            className="rounded-2xl border border-gray-200 px-4 py-3"
          />
          <input
            value={profile.emailPublic || ''}
            onChange={(event) => updateProfileField('emailPublic', event.target.value)}
            placeholder="公开邮箱"
            className="rounded-2xl border border-gray-200 px-4 py-3"
          />
          <input
            value={profile.wechatPublic || ''}
            onChange={(event) => updateProfileField('wechatPublic', event.target.value)}
            placeholder="公开微信或联系备注"
            className="rounded-2xl border border-gray-200 px-4 py-3 md:col-span-2"
          />
        </div>

        <textarea
          value={profile.intro}
          onChange={(event) => updateProfileField('intro', event.target.value)}
          rows={4}
          placeholder="头图下方的简介，适合写你是谁、在做什么、希望被怎样认识。"
          className="w-full rounded-2xl border border-gray-200 px-4 py-3"
        />

        <textarea
          value={profile.longBio}
          onChange={(event) => updateProfileField('longBio', event.target.value)}
          rows={6}
          placeholder="更完整的个人介绍，可写成长经历、研究兴趣、创业理念等。"
          className="w-full rounded-2xl border border-gray-200 px-4 py-3"
        />

        <textarea
          value={profile.expertise.join('\n')}
          onChange={(event) => updateProfileField('expertise', parseLineItems(event.target.value))}
          rows={4}
          placeholder="擅长标签，每行一个，例如：AI 产品&#10;创业&#10;论文写作"
          className="w-full rounded-2xl border border-gray-200 px-4 py-3"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SOCIAL_FIELDS.map((field) => (
            <input
              key={field}
              value={profile.socialLinks[field] || ''}
              onChange={(event) =>
                updateProfileField('socialLinks', {
                  ...profile.socialLinks,
                  [field]: event.target.value,
                })
              }
              placeholder={`${field} 链接`}
              className="rounded-2xl border border-gray-200 px-4 py-3"
            />
          ))}
        </div>

        <label className="flex items-center gap-3 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={profile.isPublic}
            onChange={(event) => updateProfileField('isPublic', event.target.checked)}
            className="rounded"
          />
          公开这份个人主页
        </label>
      </section>

      <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">内容结构</h2>
            <p className="text-sm text-gray-500 mt-1">为简历、论文、创业、项目等内容分别添加条目。</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(PERSONAL_ENTRY_TYPE_LABELS) as PersonalEntryType[]).map((entryType) => (
              <button
                key={entryType}
                type="button"
                onClick={() => addEntry(entryType)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" />
                添加{PERSONAL_ENTRY_TYPE_LABELS[entryType]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {(Object.keys(PERSONAL_ENTRY_TYPE_LABELS) as PersonalEntryType[]).map((entryType) => {
            const Icon = ENTRY_TYPE_ICONS[entryType];
            const sectionEntries = groupedEntries.get(entryType) || [];

            return (
              <div key={entryType} className="rounded-3xl border border-gray-100 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-700">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{PERSONAL_ENTRY_TYPE_LABELS[entryType]}</h3>
                    <p className="text-sm text-gray-500">按时间或重要程度排序填写即可。</p>
                  </div>
                </div>

                {sectionEntries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 text-center">
                    这一栏还没有内容，点上面的按钮新增即可。
                  </div>
                ) : (
                  <div className="space-y-5">
                    {sectionEntries.map((entry) => (
                      <div key={entry.id} className="rounded-2xl bg-gray-50 border border-gray-100 p-4 space-y-4">
                        <div className="flex justify-between items-start gap-4">
                          <div className="text-sm text-gray-500">
                            {PERSONAL_ENTRY_TYPE_LABELS[entry.entryType]}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeEntry(entry.id)}
                            className="inline-flex items-center gap-1 text-sm text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                            删除
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input
                            value={entry.title}
                            onChange={(event) =>
                              updateEntry(entry.id, (current) => ({ ...current, title: event.target.value }))
                            }
                            placeholder="标题"
                            className="rounded-2xl border border-gray-200 px-4 py-3"
                          />
                          <input
                            value={entry.organization}
                            onChange={(event) =>
                              updateEntry(entry.id, (current) => ({
                                ...current,
                                organization: event.target.value,
                              }))
                            }
                            placeholder="机构 / 项目主体 / 期刊"
                            className="rounded-2xl border border-gray-200 px-4 py-3"
                          />
                          <input
                            value={entry.subtitle}
                            onChange={(event) =>
                              updateEntry(entry.id, (current) => ({ ...current, subtitle: event.target.value }))
                            }
                            placeholder="副标题 / 角色"
                            className="rounded-2xl border border-gray-200 px-4 py-3"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              value={entry.startDate || ''}
                              onChange={(event) =>
                                updateEntry(entry.id, (current) => ({
                                  ...current,
                                  startDate: event.target.value,
                                }))
                              }
                              placeholder="开始时间 2024-01"
                              className="rounded-2xl border border-gray-200 px-4 py-3"
                            />
                            <input
                              value={entry.endDate || ''}
                              onChange={(event) =>
                                updateEntry(entry.id, (current) => ({
                                  ...current,
                                  endDate: event.target.value,
                                }))
                              }
                              placeholder="结束时间 2024-12"
                              className="rounded-2xl border border-gray-200 px-4 py-3"
                            />
                          </div>
                        </div>

                        <label className="flex items-center gap-3 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={entry.isOngoing}
                            onChange={(event) =>
                              updateEntry(entry.id, (current) => ({
                                ...current,
                                isOngoing: event.target.checked,
                              }))
                            }
                            className="rounded"
                          />
                          仍在进行中
                        </label>

                        <textarea
                          value={entry.summary}
                          onChange={(event) =>
                            updateEntry(entry.id, (current) => ({ ...current, summary: event.target.value }))
                          }
                          rows={3}
                          placeholder="摘要，展示页最先看到的内容。"
                          className="w-full rounded-2xl border border-gray-200 px-4 py-3"
                        />

                        <textarea
                          value={entry.content}
                          onChange={(event) =>
                            updateEntry(entry.id, (current) => ({ ...current, content: event.target.value }))
                          }
                          rows={5}
                          placeholder="详细内容，可写方法、成果、里程碑、你在其中负责什么。"
                          className="w-full rounded-2xl border border-gray-200 px-4 py-3"
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <textarea
                            value={entry.highlights.join('\n')}
                            onChange={(event) =>
                              updateEntry(entry.id, (current) => ({
                                ...current,
                                highlights: parseLineItems(event.target.value),
                              }))
                            }
                            rows={4}
                            placeholder="亮点，每行一个。"
                            className="w-full rounded-2xl border border-gray-200 px-4 py-3"
                          />
                          <textarea
                            value={formatLinkLines(entry.links)}
                            onChange={(event) =>
                              updateEntry(entry.id, (current) => ({
                                ...current,
                                links: parseLinkLines(event.target.value),
                              }))
                            }
                            rows={4}
                            placeholder="外部链接，每行一个，格式：名称|URL"
                            className="w-full rounded-2xl border border-gray-200 px-4 py-3"
                          />
                        </div>

                        <label className="flex items-center gap-3 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={entry.isPublic}
                            onChange={(event) =>
                              updateEntry(entry.id, (current) => ({
                                ...current,
                                isPublic: event.target.checked,
                              }))
                            }
                            className="rounded"
                          />
                          对外公开这条内容
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">附件资料</h2>
            <p className="text-sm text-gray-500 mt-1">
              可上传简历、论文 PDF、项目说明等。当前 MVP 默认用公开链接展示下载。
            </p>
          </div>

          <label className="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-3 cursor-pointer hover:bg-blue-700 transition">
            {uploading ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            上传附件
            <input
              type="file"
              className="hidden"
              onChange={(event) => handleUploadFile(event, '')}
              disabled={uploading}
            />
          </label>
        </div>

        {files.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
            还没有附件，上传后可以补充描述和 AI 摘要。
          </div>
        ) : (
          <div className="space-y-5">
            {files.map((file) => (
              <div key={file.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <a
                    href={file.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {file.title || '未命名附件'}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDeleteFile(file)}
                    className="inline-flex items-center gap-1 text-sm text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                    删除
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    value={file.title}
                    onChange={(event) =>
                      updateFile(file.id, (current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="附件标题"
                    className="rounded-2xl border border-gray-200 px-4 py-3"
                  />
                  <input
                    value={file.mimeType || ''}
                    onChange={(event) =>
                      updateFile(file.id, (current) => ({ ...current, mimeType: event.target.value }))
                    }
                    placeholder="文件类型"
                    className="rounded-2xl border border-gray-200 px-4 py-3"
                  />
                </div>

                <textarea
                  value={file.description}
                  onChange={(event) =>
                    updateFile(file.id, (current) => ({ ...current, description: event.target.value }))
                  }
                  rows={3}
                  placeholder="文件描述，展示给访客看的简介。"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3"
                />

                <textarea
                  value={file.extractedText}
                  onChange={(event) =>
                    updateFile(file.id, (current) => ({ ...current, extractedText: event.target.value }))
                  }
                  rows={5}
                  placeholder="供数字人使用的文件摘要或摘录文本。建议把论文摘要、项目摘要、简历要点粘贴到这里。"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3"
                />

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-5">
                    <label className="flex items-center gap-3 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={file.isPublic}
                        onChange={(event) =>
                          updateFile(file.id, (current) => ({
                            ...current,
                            isPublic: event.target.checked,
                          }))
                        }
                        className="rounded"
                      />
                      在公开页显示这个附件
                    </label>
                    <label className="flex items-center gap-3 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={file.useForAi}
                        onChange={(event) =>
                          updateFile(file.id, (current) => ({
                            ...current,
                            useForAi: event.target.checked,
                          }))
                        }
                        className="rounded"
                      />
                      允许数字人使用这份附件
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSaveFile(file)}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium hover:bg-white"
                  >
                    <Save className="w-4 h-4" />
                    保存附件信息
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">数字人设置</h2>
          <p className="text-sm text-gray-500 mt-1">这里控制问答入口开关、欢迎语和系统人设。</p>
        </div>

        <label className="flex items-center gap-3 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={profile.aiEnabled}
            onChange={(event) => updateProfileField('aiEnabled', event.target.checked)}
            className="rounded"
          />
          开启数字人问答
        </label>

        <textarea
          value={profile.aiWelcomeMessage}
          onChange={(event) => updateProfileField('aiWelcomeMessage', event.target.value)}
          rows={3}
          placeholder="数字人第一句话"
          className="w-full rounded-2xl border border-gray-200 px-4 py-3"
        />

        <textarea
          value={profile.aiSystemPrompt}
          onChange={(event) => updateProfileField('aiSystemPrompt', event.target.value)}
          rows={6}
          placeholder="系统提示词，例如希望它如何回答、强调什么、哪些内容不能编造。"
          className="w-full rounded-2xl border border-gray-200 px-4 py-3"
        />
      </section>
    </div>
  );
};

export default PersonalBrandAdmin;
