import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

export type PartnerProfile = Database['public']['Tables']['profiles']['Row'];

export const getPublicPartnerProfiles = async (): Promise<PartnerProfile[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_public', true)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getPublicPartnerProfileById = async (id: string): Promise<PartnerProfile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .eq('is_public', true)
    .maybeSingle();

  if (error) throw error;
  return data;
};
