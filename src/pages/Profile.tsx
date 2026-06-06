/**
 * 个人资料页 - 注册引导流程
 * 注册后进入分步骤资料完善；除昵称外，每一步都可以跳过。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ExternalLink,
  Loader,
  MessageCircle,
  Plus,
  Shield,
  Sparkles,
  Target,
  User,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { GROUP_IDENTITIES, User as UserType } from '../types';
import { uploadAvatar, updateUserAvatar } from '../services/avatarService';

const PRESET_TAGS = [
  '健身', '考研', '程序员', '设计师', '力量举',
  'INFP', 'INTJ', 'ENFP', '早起党', '夜猫子',
  '读书', '跑步', '游泳', '创业', '科研', '保研',
];

const SOCIAL_PLATFORMS = [
  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/username' },
  { key: 'xiaohongshu', label: '小红书', placeholder: '小红书主页链接' },
  { key: 'bilibili', label: 'B站', placeholder: 'B站主页链接' },
  { key: 'zhihu', label: '知乎', placeholder: '知乎主页链接' },
  { key: 'weibo', label: '微博', placeholder: '微博主页链接' },
];

type ProfileFormState = {
  nickname: string;
  groupNickname: string;
  bio: string;
  age: string;
  gender: string;
  groupIdentity: string[];
  tags: string[];
  skillsOffering: string;
  skillsSeeking: string;
  wechatId: string;
  socialLinks: Record<string, string>;
  isPublic: boolean;
};

const createFormState = (user: UserType | null): ProfileFormState => ({
  nickname: user?.nickname || '',
  groupNickname: user?.groupNickname || '',
  bio: user?.bio || '',
  age: user?.age ? String(user.age) : '',
  gender: user?.gender || '',
  groupIdentity: user?.groupIdentity || [],
  tags: user?.tags || [],
  skillsOffering: user?.skillsOffering || '',
  skillsSeeking: user?.skillsSeeking || '',
  wechatId: user?.wechatId || '',
  socialLinks: user?.socialLinks || {},
  isPublic: user?.isPublic ?? true,
});

const steps = [
  {
    title: '基础资料',
    description: '让群友先认出你是谁。',
    icon: User,
    optional: false,
  },
  {
    title: '群组与标签',
    description: '选择身份和兴趣，方便被社区发现。',
    icon: Users,
    optional: true,
  },
  {
    title: '供需名片',
    description: '写下你能提供什么、正在寻找什么。',
    icon: Sparkles,
    optional: true,
  },
  {
    title: '联系方式',
    description: '决定公开范围，也可以补充社交链接。',
    icon: Shield,
    optional: true,
  },
] as const;

const Profile: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isRegisterFlow = searchParams.get('flow') === 'register';

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<ProfileFormState>(() => createFormState(user));
  const [customTag, setCustomTag] = useState('');
  const [newLinkPlatform, setNewLinkPlatform] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setFormData(createFormState(user));
  }, [user?.id]);

  const completion = useMemo(() => {
    const checks = [
      Boolean(formData.nickname.trim()),
      Boolean(formData.bio.trim()),
      formData.groupIdentity.length > 0,
      formData.tags.length > 0,
      Boolean(formData.skillsOffering.trim()),
      Boolean(formData.skillsSeeking.trim()),
      Boolean(formData.wechatId.trim()),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [formData]);

  if (!user) return null;

  const finishTarget = (() => {
    const from = (location.state as { from?: string } | null)?.from;
    if (!from || from === '/' || from === '/register' || from === '/login' || from === '/profile') {
      return '/community';
    }
    return from;
  })();

  const updateField = <K extends keyof ProfileFormState>(field: K, value: ProfileFormState[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addTag = (tag: string) => {
    const normalized = tag.trim();
    if (!normalized || formData.tags.includes(normalized)) return;
    updateField('tags', [...formData.tags, normalized]);
  };

  const removeTag = (tag: string) => {
    updateField('tags', formData.tags.filter(item => item !== tag));
  };

  const toggleGroup = (group: string) => {
    updateField(
      'groupIdentity',
      formData.groupIdentity.includes(group)
        ? formData.groupIdentity.filter(item => item !== group)
        : [...formData.groupIdentity, group],
    );
  };

  const updateSocialLink = (platform: string, url: string) => {
    updateField('socialLinks', {
      ...formData.socialLinks,
      [platform]: url,
    });
  };

  const removeSocialLink = (platform: string) => {
    const nextLinks = Object.fromEntries(
      Object.entries(formData.socialLinks).filter(([key]) => key !== platform),
    );
    updateField('socialLinks', nextLinks);
  };

  const addNewLink = () => {
    if (!newLinkPlatform || formData.socialLinks[newLinkPlatform] !== undefined) return;
    updateSocialLink(newLinkPlatform, '');
    setNewLinkPlatform('');
  };

  const buildUpdatesForStep = (stepIndex: number): Partial<UserType> => {
    if (stepIndex === 0) {
      return {
        nickname: formData.nickname.trim(),
        groupNickname: formData.groupNickname.trim(),
        bio: formData.bio.trim(),
        age: formData.age ? Number(formData.age) : null,
        gender: formData.gender || null,
      };
    }

    if (stepIndex === 1) {
      return {
        groupIdentity: formData.groupIdentity,
        tags: formData.tags,
      };
    }

    if (stepIndex === 2) {
      return {
        skillsOffering: formData.skillsOffering.trim(),
        skillsSeeking: formData.skillsSeeking.trim(),
        wechatId: formData.wechatId.trim(),
      };
    }

    return {
      socialLinks: Object.fromEntries(
        Object.entries(formData.socialLinks)
          .map(([platform, url]) => [platform, url.trim()])
          .filter(([, url]) => url),
      ),
      isPublic: formData.isPublic,
    };
  };

  const saveStep = async (stepIndex: number) => {
    if (stepIndex === 0 && !formData.nickname.trim()) {
      setError('昵称不能为空');
      return false;
    }

    const ageValue = Number(formData.age);
    if (stepIndex === 0 && formData.age && (Number.isNaN(ageValue) || ageValue < 10 || ageValue > 120)) {
      setError('年龄需要在 10 到 120 之间，也可以留空跳过');
      return false;
    }

    setError('');
    setSaving(true);
    try {
      await updateProfile(buildUpdatesForStep(stepIndex));
      setLastSaved(new Date());
      return true;
    } catch (saveError) {
      console.error('保存资料失败:', saveError);
      setError(saveError instanceof Error ? saveError.message : '保存失败，请稍后重试');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const goNext = async () => {
    const ok = await saveStep(currentStep);
    if (!ok) return;

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      return;
    }

    if (isRegisterFlow) {
      navigate(finishTarget, { replace: true });
    }
  };

  const skipStep = () => {
    setError('');
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      return;
    }

    if (isRegisterFlow) {
      navigate(finishTarget, { replace: true });
    }
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);
    setError('');
    try {
      const avatarUrl = await uploadAvatar(file, user.id);
      if (avatarUrl) {
        await updateUserAvatar(user.id, avatarUrl);
        await updateProfile({ avatar: avatarUrl });
        setLastSaved(new Date());
      }
    } catch (uploadError) {
      console.error('上传头像失败:', uploadError);
      setError(uploadError instanceof Error ? uploadError.message : '上传头像失败，请稍后重试');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const current = steps[currentStep];
  const StepIcon = current.icon;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl px-2.5 py-4 text-gray-900 sm:px-4 sm:py-6">
      <div className="min-w-0 overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="bg-gradient-to-r from-blue-600 via-cyan-600 to-emerald-500 px-4 py-6 text-white sm:px-6 sm:py-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                  disabled={uploadingAvatar}
                />
                <label htmlFor="avatar-upload" className="block cursor-pointer">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white/20 ring-4 ring-white/30 transition hover:ring-white/50">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.nickname} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-3xl font-bold">{formData.nickname.charAt(0) || '你'}</span>
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-blue-500 shadow-lg">
                    {uploadingAvatar ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </div>
                </label>
              </div>

              <div>
                <p className="text-sm font-medium text-cyan-50/90">
                  {isRegisterFlow ? '注册资料完善' : '个人资料'}
                </p>
                <h1 className="mt-1 text-2xl font-bold">
                  {isRegisterFlow ? '把你的社区名片搭起来' : '编辑你的社区名片'}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
                  只需要先填关键内容，暂时不想回答的部分可以跳过，之后随时回来补。
                </p>
              </div>
            </div>

            <div className="min-w-0 sm:min-w-40">
              <div className="flex items-center justify-between text-sm text-white/85">
                <span>资料完整度</span>
                <span>{completion}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all"
                  style={{ width: `${completion}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-end gap-2 text-sm text-white/85">
                {saving ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    <span>保存中...</span>
                  </>
                ) : lastSaved ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>已保存</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 gap-0 md:grid-cols-[240px_1fr]">
          <aside className="border-b border-gray-200 bg-gray-50 p-4 md:border-b-0 md:border-r">
            <div className="space-y-2">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const active = index === currentStep;
                const done = index < currentStep;

                return (
                  <button
                    key={step.title}
                    type="button"
                    onClick={() => setCurrentStep(index)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : done
                          ? 'bg-white text-blue-700 hover:bg-blue-50'
                          : 'text-gray-600 hover:bg-white'
                    }`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      active ? 'bg-white/20' : done ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{step.title}</span>
                      {step.optional && <span className="block text-xs opacity-75">可跳过</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="min-w-0 p-4 sm:p-7">
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <StepIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{current.title}</h2>
                <p className="mt-1 text-sm text-gray-500">{current.description}</p>
              </div>
            </div>

            {error && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {currentStep === 0 && (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">昵称</label>
                    <input
                      type="text"
                      value={formData.nickname}
                      onChange={event => updateField('nickname', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="大家会这样称呼你"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">群昵称</label>
                    <input
                      type="text"
                      value={formData.groupNickname}
                      onChange={event => updateField('groupNickname', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="可选，方便群友认出你"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">年龄</label>
                    <input
                      type="number"
                      min="10"
                      max="120"
                      value={formData.age}
                      onChange={event => updateField('age', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="可跳过"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">性别</label>
                    <select
                      value={formData.gender}
                      onChange={event => updateField('gender', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">不显示</option>
                      <option value="男">男</option>
                      <option value="女">女</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">个人简介</label>
                  <textarea
                    value={formData.bio}
                    onChange={event => updateField('bio', event.target.value)}
                    rows={4}
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="一句话介绍自己。比如：正在备考，也在练深蹲。"
                  />
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="mb-3 block text-sm font-medium text-gray-700">所属群组</label>
                  <div className="grid min-w-0 grid-cols-[repeat(2,minmax(0,1fr))] gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {GROUP_IDENTITIES.map(group => (
                      <label
                        key={group}
                        className={`flex min-w-0 cursor-pointer items-start gap-2 rounded-lg border p-3 transition ${
                          formData.groupIdentity.includes(group)
                            ? 'border-blue-300 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.groupIdentity.includes(group)}
                          onChange={() => toggleGroup(group)}
                          className="mt-0.5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="min-w-0 break-words text-sm leading-5">{group}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-3 block text-sm font-medium text-gray-700">个人标签</label>
                  <div className="mb-3 flex min-h-9 min-w-0 flex-wrap gap-2">
                    {formData.tags.length > 0 ? (
                      formData.tags.map(tag => (
                        <span key={tag} className="inline-flex max-w-full min-w-0 items-center rounded-full bg-purple-100 px-3 py-1 text-sm leading-5 text-purple-700">
                          <span className="min-w-0 break-words">{tag}</span>
                          <button type="button" onClick={() => removeTag(tag)} className="ml-2 shrink-0 hover:text-purple-950" aria-label={`移除 ${tag}`}>
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400">还没有选择标签</span>
                    )}
                  </div>

                  <div className="mb-3 grid min-w-0 grid-cols-[repeat(2,minmax(0,1fr))] gap-2 sm:flex sm:flex-wrap">
                    {PRESET_TAGS.filter(tag => !formData.tags.includes(tag)).map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => addTag(tag)}
                        className="min-w-0 rounded-full bg-gray-100 px-2.5 py-2 text-center text-sm leading-5 text-gray-600 transition hover:bg-purple-100 hover:text-purple-700 sm:px-3 sm:py-1"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>

                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={customTag}
                      onChange={event => setCustomTag(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addTag(customTag);
                          setCustomTag('');
                        }
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      placeholder="自定义标签"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        addTag(customTag);
                        setCustomTag('');
                      }}
                      className="inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-purple-700 sm:w-auto sm:px-4"
                    >
                      <Plus className="h-4 w-4" />
                      添加
                    </button>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-5">
                <div>
                  <label className="mb-1 flex items-center text-sm font-medium text-gray-700">
                    <Sparkles className="mr-1 h-4 w-4 text-green-500" />
                    我能提供
                  </label>
                  <textarea
                    value={formData.skillsOffering}
                    onChange={event => updateField('skillsOffering', event.target.value)}
                    rows={4}
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="例如：Python 辅导、深蹲纠错、论文润色、资料整理..."
                  />
                </div>

                <div>
                  <label className="mb-1 flex items-center text-sm font-medium text-gray-700">
                    <Target className="mr-1 h-4 w-4 text-orange-500" />
                    我正在寻找
                  </label>
                  <textarea
                    value={formData.skillsSeeking}
                    onChange={event => updateField('skillsSeeking', event.target.value)}
                    rows={4}
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    placeholder="例如：早起搭子、健身伙伴、考研经验分享、项目协作..."
                  />
                </div>

                <div>
                  <label className="mb-1 flex items-center text-sm font-medium text-gray-700">
                    <MessageCircle className="mr-1 h-4 w-4 text-blue-500" />
                    微信号
                    <span className="ml-1 text-xs text-gray-400">仅登录用户可见，可跳过</span>
                  </label>
                  <input
                    type="text"
                    value={formData.wechatId}
                    onChange={event => updateField('wechatId', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="方便群友联系你"
                  />
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <input
                    type="checkbox"
                    checked={formData.isPublic}
                    onChange={event => updateField('isPublic', event.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    <span className="flex items-center gap-2 font-medium text-gray-800">
                      <Shield className="h-4 w-4 text-gray-600" />
                      公开我的名片
                    </span>
                    <span className="mt-1 block text-sm text-gray-500">
                      开启后，其他用户可以在社区广场看到你的公开资料。
                    </span>
                  </span>
                </label>

                <div>
                  <h3 className="mb-3 flex items-center text-sm font-medium text-gray-700">
                    <ExternalLink className="mr-1 h-4 w-4 text-indigo-500" />
                    社交链接
                  </h3>

                  <div className="space-y-3">
                    {Object.entries(formData.socialLinks).map(([platform, url]) => {
                      const platformInfo = SOCIAL_PLATFORMS.find(item => item.key === platform);
                      return (
                        <div key={platform} className="flex items-center gap-2">
                          <span className="w-20 text-sm text-gray-600">{platformInfo?.label || platform}</span>
                          <input
                            type="url"
                            value={url}
                            onChange={event => updateSocialLink(platform, event.target.value)}
                            placeholder={platformInfo?.placeholder || '链接地址'}
                            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                          <button
                            type="button"
                            onClick={() => removeSocialLink(platform)}
                            className="rounded-lg p-2 text-red-500 transition hover:bg-red-50"
                            aria-label={`删除 ${platformInfo?.label || platform}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      value={newLinkPlatform}
                      onChange={event => setNewLinkPlatform(event.target.value)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">选择平台</option>
                      {SOCIAL_PLATFORMS.filter(platform => formData.socialLinks[platform.key] === undefined).map(platform => (
                        <option key={platform.key} value={platform.key}>{platform.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addNewLink}
                      disabled={!newLinkPlatform}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:bg-gray-300"
                    >
                      <Plus className="h-4 w-4" />
                      添加链接
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 flex min-w-0 flex-col-reverse gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0 || saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <ArrowLeft className="h-4 w-4" />
                上一步
              </button>

              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                {current.optional && (
                  <button
                    type="button"
                    onClick={skipStep}
                    disabled={saving}
                    className="w-full rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 sm:w-auto"
                  >
                    {isLastStep ? '跳过并完成' : '跳过本步'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={goNext}
                  disabled={saving}
                  className="inline-flex w-full max-w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
                >
                  {saving ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : isLastStep ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {isLastStep ? (isRegisterFlow ? '完成注册' : '保存资料') : '保存并继续'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
