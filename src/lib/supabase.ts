import { createClient, type Session } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// 环境配置验证
if (!supabaseUrl || !supabaseAnonKey) {
	console.error('Missing Supabase environment variables');
	console.error('VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗ (missing)');
	console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓' : '✗ (missing)');

	// 在开发环境下提供更多调试信息
	if (import.meta.env.DEV) {
		console.warn('Please check your environment variables in .env file');
		console.warn('Expected format:');
		console.warn('VITE_SUPABASE_URL=https://your-project.supabase.co');
		console.warn('VITE_SUPABASE_ANON_KEY=your-anon-key');
	}
}

// 创建 Supabase 客户端，增加错误处理
let supabaseClient: ReturnType<typeof createClient<Database>>;

try {
	supabaseClient = createClient<Database>(supabaseUrl || '', supabaseAnonKey || '', {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			flowType: 'pkce',
			// 增加调试模式
			debug: import.meta.env.DEV,
		},
		// 添加全局超时设置
		global: {
			headers: {
				'X-Client-Info': 'jianwen-community-web',
			},
		},
	});

	// 验证客户端创建成功
	if (!supabaseClient) {
		throw new Error('Failed to create Supabase client');
	}

} catch (error) {
	console.error('Failed to initialize Supabase client:', error);
	// 创建一个基本的客户端作为fallback（可能无法正常工作）
	supabaseClient = createClient<Database>('', '', {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
		},
	});
}

export const supabase = supabaseClient;

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

export const getUserProfile = async (userId: string, retryCount = 0): Promise<ProfileRow | null> => {
	const maxRetries = 3; // 增加到 3 次重试，给 Supabase 冷启动更多时间
	console.log('[Supabase] Fetching profile for user:', userId, retryCount > 0 ? `(retry ${retryCount})` : '');
	const startTime = Date.now();
	
	try {
		const { data, error } = await supabase
			.from('profiles')
			.select('*')
			.eq('id', userId)
			.single();
		
		const duration = Date.now() - startTime;
		console.log('[Supabase] Profile query completed in', duration, 'ms');
		
		if (error) {
			console.error('[Supabase] Profile query error:', error);
			// 如果是 PGRST116 错误（没有找到行），返回 null
			if (error.code === 'PGRST116') {
				return null;
			}
			// 其他错误抛出，让调用者处理
			throw error;
		}
		
		console.log('[Supabase] Profile found:', data?.id);
		return data as ProfileRow;
	} catch (err) {
		const duration = Date.now() - startTime;
		console.error('[Supabase] Profile fetch failed after', duration, 'ms:', err);
		
		// 如果还有重试次数，等待后重试
		if (retryCount < maxRetries) {
			const waitTime = (retryCount + 1) * 2000; // 递增等待时间: 2s, 4s, 6s
			console.log(`[Supabase] Retrying profile fetch in ${waitTime/1000} seconds...`);
			await new Promise(resolve => setTimeout(resolve, waitTime));
			return getUserProfile(userId, retryCount + 1);
		}
		
		throw err;
	}
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

// 连接测试函数
export const testSupabaseConnection = async (): Promise<{ success: boolean; error?: string }> => {
	try {
		// 尝试一个简单的查询来测试连接
		const { data, error } = await supabase
			.from('profiles')
			.select('count')
			.limit(1);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true };
	} catch (err: any) {
		return { success: false, error: err.message || 'Connection test failed' };
	}
};


