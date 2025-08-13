import { createClient, type Session } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
	console.error('Missing Supabase environment variables VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient<Database>(supabaseUrl || '', supabaseAnonKey || '', {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
		flowType: 'pkce',
	},
});

export const getCurrentSession = async (): Promise<Session | null> => {
	const { data } = await supabase.auth.getSession();
	return data.session ?? null;
};

export const getCurrentUser = async () => {
	const { data, error } = await supabase.auth.getUser();
	if (error) return null;
	return data.user ?? null;
};

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export const getUserProfile = async (userId: string): Promise<ProfileRow | null> => {
	const { data, error } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', userId)
		.single();
	if (error) return null;
	return data as ProfileRow;
};

export const createUserProfile = async (profile: ProfileInsert): Promise<ProfileRow> => {
	const { data, error } = await supabase
		.from('profiles')
		.insert(profile)
		.select('*')
		.single();
	if (error) throw error;
	return data as ProfileRow;
};

export const updateUserProfile = async (userId: string, updates: ProfileUpdate): Promise<ProfileRow> => {
	const { data, error } = await supabase
		.from('profiles')
		.update(updates)
		.eq('id', userId)
		.select('*')
		.single();
	if (error) throw error;
	return data as ProfileRow;
};


