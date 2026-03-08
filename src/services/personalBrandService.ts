import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import {
  createEmptyPersonalProfile,
  type DigitalHumanMessage,
  type PersonalEntry,
  type PersonalFile,
  type PersonalLink,
  type PersonalProfile,
  type PersonalProfileBundle,
} from '../types/personalBrand';

type PersonalProfileRow = Database['public']['Tables']['personal_profiles']['Row'];
type PersonalEntryRow = Database['public']['Tables']['personal_entries']['Row'];
type PersonalFileRow = Database['public']['Tables']['personal_files']['Row'];

const PERSONAL_FILES_BUCKET = 'personal-files';

const mapProfileRow = (row: PersonalProfileRow): PersonalProfile => ({
  id: row.id,
  ownerId: row.owner_id,
  slug: row.slug,
  displayName: row.display_name,
  headline: row.headline || '',
  intro: row.intro || '',
  longBio: row.long_bio || '',
  location: row.location || '',
  emailPublic: row.email_public || '',
  wechatPublic: row.wechat_public || '',
  socialLinks: (row.social_links as Record<string, string>) || {},
  expertise: row.expertise || [],
  aiEnabled: row.ai_enabled,
  aiWelcomeMessage: row.ai_welcome_message || '',
  aiSystemPrompt: row.ai_system_prompt || '',
  isPublic: row.is_public,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapLinks = (value: unknown): PersonalLink[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item): item is PersonalLink =>
        Boolean(
          item &&
            typeof item === 'object' &&
            'label' in item &&
            'url' in item &&
            typeof (item as { label: unknown }).label === 'string' &&
            typeof (item as { url: unknown }).url === 'string',
        ),
    )
    .map((item) => ({
      label: item.label,
      url: item.url,
    }));
};

const mapEntryRow = (row: PersonalEntryRow): PersonalEntry => ({
  id: row.id,
  profileId: row.profile_id,
  entryType: row.entry_type,
  title: row.title,
  subtitle: row.subtitle || '',
  organization: row.organization || '',
  startDate: row.start_date || '',
  endDate: row.end_date || '',
  isOngoing: row.is_ongoing,
  summary: row.summary || '',
  content: row.content || '',
  highlights: row.highlights || [],
  links: mapLinks(row.links),
  sortOrder: row.sort_order,
  isPublic: row.is_public,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapFileRow = (row: PersonalFileRow): PersonalFile => ({
  id: row.id,
  profileId: row.profile_id,
  entryId: row.entry_id || undefined,
  title: row.title,
  description: row.description || '',
  filePath: row.file_path,
  fileUrl: row.file_url,
  mimeType: row.mime_type || '',
  sizeBytes: row.size_bytes || 0,
  extractedText: row.extracted_text || '',
  isPublic: row.is_public,
  useForAi: row.use_for_ai,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toProfilePayload = (profile: PersonalProfile) => ({
  id: profile.id || crypto.randomUUID(),
  owner_id: profile.ownerId,
  slug: profile.slug,
  display_name: profile.displayName,
  headline: profile.headline,
  intro: profile.intro,
  long_bio: profile.longBio,
  location: profile.location || null,
  email_public: profile.emailPublic || null,
  wechat_public: profile.wechatPublic || null,
  social_links: profile.socialLinks,
  expertise: profile.expertise,
  ai_enabled: profile.aiEnabled,
  ai_welcome_message: profile.aiWelcomeMessage,
  ai_system_prompt: profile.aiSystemPrompt,
  is_public: profile.isPublic,
});

const toEntryPayload = (entry: PersonalEntry, profileId: string) => ({
  id: entry.id || crypto.randomUUID(),
  profile_id: profileId,
  entry_type: entry.entryType,
  title: entry.title,
  subtitle: entry.subtitle || null,
  organization: entry.organization || null,
  start_date: entry.startDate || null,
  end_date: entry.endDate || null,
  is_ongoing: entry.isOngoing,
  summary: entry.summary || null,
  content: entry.content || null,
  highlights: entry.highlights,
  links: entry.links,
  sort_order: entry.sortOrder,
  is_public: entry.isPublic,
});

export const getPersonalProfileBundleByOwner = async (
  ownerId: string,
): Promise<PersonalProfileBundle> => {
  const { data: profileData, error: profileError } = await supabase
    .from('personal_profiles')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profileData) {
    return {
      profile: createEmptyPersonalProfile(ownerId),
      entries: [],
      files: [],
    };
  }

  const [entriesResult, filesResult] = await Promise.all([
    supabase
      .from('personal_entries')
      .select('*')
      .eq('profile_id', profileData.id)
      .order('entry_type', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase
      .from('personal_files')
      .select('*')
      .eq('profile_id', profileData.id)
      .order('created_at', { ascending: false }),
  ]);

  if (entriesResult.error) throw entriesResult.error;
  if (filesResult.error) throw filesResult.error;

  return {
    profile: mapProfileRow(profileData),
    entries: entriesResult.data.map(mapEntryRow),
    files: filesResult.data.map(mapFileRow),
  };
};

export const getPublicPersonalProfileBundle = async (
  slug?: string,
): Promise<PersonalProfileBundle | null> => {
  let query = supabase
    .from('personal_profiles')
    .select('*')
    .eq('is_public', true)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (slug) {
    query = query.eq('slug', slug);
  }

  const { data: profileList, error: profileError } = await query;
  if (profileError) throw profileError;

  const profileData = profileList?.[0];
  if (!profileData) return null;

  const [entriesResult, filesResult] = await Promise.all([
    supabase
      .from('personal_entries')
      .select('*')
      .eq('profile_id', profileData.id)
      .eq('is_public', true)
      .order('entry_type', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase
      .from('personal_files')
      .select('*')
      .eq('profile_id', profileData.id)
      .eq('is_public', true)
      .order('created_at', { ascending: false }),
  ]);

  if (entriesResult.error) throw entriesResult.error;
  if (filesResult.error) throw filesResult.error;

  return {
    profile: mapProfileRow(profileData),
    entries: entriesResult.data.map(mapEntryRow),
    files: filesResult.data.map(mapFileRow),
  };
};

export const savePersonalProfile = async (
  profile: PersonalProfile,
): Promise<PersonalProfile> => {
  const payload = toProfilePayload(profile);

  const { data, error } = await supabase
    .from('personal_profiles')
    .upsert(payload)
    .select('*')
    .single();

  if (error) throw error;

  return mapProfileRow(data);
};

export const replacePersonalEntries = async (
  profileId: string,
  entries: PersonalEntry[],
): Promise<PersonalEntry[]> => {
  const normalizedEntries = entries
    .filter((entry) => entry.title.trim() || entry.summary.trim() || entry.content.trim())
    .map((entry, index) => ({
      ...entry,
      sortOrder: index + 1,
    }));

  const { data: existingRows, error: existingError } = await supabase
    .from('personal_entries')
    .select('id')
    .eq('profile_id', profileId);

  if (existingError) throw existingError;

  const incomingIds = normalizedEntries.map((entry) => entry.id).filter(Boolean);
  const deleteIds = (existingRows || [])
    .map((row) => row.id)
    .filter((id) => !incomingIds.includes(id));

  if (deleteIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('personal_entries')
      .delete()
      .in('id', deleteIds);

    if (deleteError) throw deleteError;
  }

  if (normalizedEntries.length === 0) return [];

  const { data, error } = await supabase
    .from('personal_entries')
    .upsert(normalizedEntries.map((entry) => toEntryPayload(entry, profileId)))
    .select('*');

  if (error) throw error;

  return data.map(mapEntryRow);
};

export const uploadPersonalFile = async (
  file: File,
  ownerId: string,
): Promise<{ filePath: string; fileUrl: string }> => {
  const extension = file.name.split('.').pop() || 'bin';
  const filePath = `${ownerId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(PERSONAL_FILES_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(PERSONAL_FILES_BUCKET).getPublicUrl(filePath);

  return {
    filePath,
    fileUrl: data.publicUrl,
  };
};

export const savePersonalFileRecord = async (
  input: Omit<PersonalFile, 'createdAt' | 'updatedAt'>,
): Promise<PersonalFile> => {
  const { data, error } = await supabase
    .from('personal_files')
    .upsert({
      id: input.id || crypto.randomUUID(),
      profile_id: input.profileId,
      entry_id: input.entryId || null,
      title: input.title,
      description: input.description || null,
      file_path: input.filePath,
      file_url: input.fileUrl,
      mime_type: input.mimeType || null,
      size_bytes: input.sizeBytes || null,
      extracted_text: input.extractedText || null,
      is_public: input.isPublic,
      use_for_ai: input.useForAi,
    })
    .select('*')
    .single();

  if (error) throw error;

  return mapFileRow(data);
};

export const deletePersonalFileRecord = async (file: PersonalFile): Promise<void> => {
  const { error: dbError } = await supabase
    .from('personal_files')
    .delete()
    .eq('id', file.id);

  if (dbError) throw dbError;

  if (file.filePath) {
    const { error: storageError } = await supabase.storage
      .from(PERSONAL_FILES_BUCKET)
      .remove([file.filePath]);

    if (storageError) {
      console.error('删除存储文件失败:', storageError);
    }
  }
};

export const askDigitalHuman = async (params: {
  slug: string;
  messages: DigitalHumanMessage[];
}) => {
  const { data, error } = await supabase.functions.invoke('personal-brain-chat', {
    body: params,
  });

  if (error) throw error;

  return data as { answer: string };
};
