export type PersonalEntryType =
  | 'resume'
  | 'paper'
  | 'venture'
  | 'project'
  | 'custom';

export interface PersonalLink {
  label: string;
  url: string;
}

export interface PersonalProfile {
  id: string;
  ownerId: string;
  slug: string;
  displayName: string;
  headline: string;
  intro: string;
  longBio: string;
  location?: string;
  emailPublic?: string;
  wechatPublic?: string;
  socialLinks: Record<string, string>;
  expertise: string[];
  aiEnabled: boolean;
  aiWelcomeMessage: string;
  aiSystemPrompt: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalEntry {
  id: string;
  profileId: string;
  entryType: PersonalEntryType;
  title: string;
  subtitle: string;
  organization: string;
  startDate?: string;
  endDate?: string;
  isOngoing: boolean;
  summary: string;
  content: string;
  highlights: string[];
  links: PersonalLink[];
  sortOrder: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalFile {
  id: string;
  profileId: string;
  entryId?: string;
  title: string;
  description: string;
  filePath: string;
  fileUrl: string;
  mimeType?: string;
  sizeBytes?: number;
  extractedText: string;
  isPublic: boolean;
  useForAi: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalProfileBundle {
  profile: PersonalProfile;
  entries: PersonalEntry[];
  files: PersonalFile[];
}

export interface DigitalHumanMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const PERSONAL_ENTRY_TYPE_LABELS: Record<PersonalEntryType, string> = {
  resume: '简历',
  paper: '论文',
  venture: '创业项目',
  project: '项目介绍',
  custom: '自定义',
};

export const createEmptyPersonalProfile = (ownerId: string): PersonalProfile => {
  const now = new Date().toISOString();

  return {
    id: '',
    ownerId,
    slug: 'my-about',
    displayName: '',
    headline: '',
    intro: '',
    longBio: '',
    location: '',
    emailPublic: '',
    wechatPublic: '',
    socialLinks: {},
    expertise: [],
    aiEnabled: true,
    aiWelcomeMessage: '你好，我是这个页面主人的数字分身，你可以直接问我关于经历、论文、项目和创业的问题。',
    aiSystemPrompt:
      '你是站点主人的数字分身。请基于提供的公开资料回答，优先准确、具体、诚实。如果资料里没有明确依据，请直接说明不知道，不要编造。',
    isPublic: true,
    createdAt: now,
    updatedAt: now,
  };
};

export const createEmptyPersonalEntry = (
  profileId: string,
  entryType: PersonalEntryType,
  sortOrder: number,
): PersonalEntry => {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    profileId,
    entryType,
    title: '',
    subtitle: '',
    organization: '',
    startDate: '',
    endDate: '',
    isOngoing: false,
    summary: '',
    content: '',
    highlights: [],
    links: [],
    sortOrder,
    isPublic: true,
    createdAt: now,
    updatedAt: now,
  };
};
