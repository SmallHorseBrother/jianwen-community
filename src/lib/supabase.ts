import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// 清理可能损坏的本地 Supabase 会话键，避免登录时卡住
export function clearLocalSupabaseAuth() {
  try {
    const projectRef = new URL(supabaseUrl).host.split('.')[0];
    const keyPrefix = `sb-${projectRef}-`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(keyPrefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    // 忽略清理失败
    console.warn('clearLocalSupabaseAuth failed:', err);
  }
}

// 辅助函数：获取当前用户
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

// 辅助函数：获取用户资料
export const getUserProfile = async (userId: string) => {
  console.log('Getting profile for user:', userId);
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  console.log('Profile query result:', data, error);
  if (error) {
    // 如果没有找到用户资料，返回 null 而不是抛出错误
    if (error.code === 'PGRST116') {
      console.log('No profile found for user:', userId);
      return null;
    }
    console.error('Profile query error:', error);
    throw error;
  }
  return data;
};

// 辅助函数：更新用户资料
export const updateUserProfile = async (userId: string, updates: any) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// 辅助函数：创建用户资料
export const createUserProfile = async (profile: any) => {
  const { data, error } = await supabase
    .from('profiles')
    .insert(profile)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};