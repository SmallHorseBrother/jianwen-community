import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

export type PartnerProfile = Database['public']['Tables']['profiles']['Row'];

const PUBLIC_PARTNER_PROFILE_COLUMNS = `
  id,
  nickname,
  bio,
  avatar_url,
  bench_press,
  squat,
  deadlift,
  is_public,
  group_identity,
  profession,
  group_nickname,
  specialties,
  fitness_interests,
  learning_interests,
  tags,
  skills_offering,
  skills_seeking,
  age,
  gender,
  created_at,
  updated_at
`;

const getPartnerProfileColumns = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session ? '*' : PUBLIC_PARTNER_PROFILE_COLUMNS;
};

export const getPublicPartnerProfiles = async (): Promise<PartnerProfile[]> => {
  const columns = await getPartnerProfileColumns();
  const { data, error } = await supabase
    .from('profiles')
    .select(columns)
    .eq('is_public', true)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []) as PartnerProfile[];
};

export const getPublicPartnerProfileById = async (id: string): Promise<PartnerProfile | null> => {
  const columns = await getPartnerProfileColumns();
  const { data, error } = await supabase
    .from('profiles')
    .select(columns)
    .eq('id', id)
    .eq('is_public', true)
    .maybeSingle();

  if (error) throw error;
  return data as PartnerProfile | null;
};
