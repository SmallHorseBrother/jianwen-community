import { supabase } from '../lib/supabase';

// 获取公开的用户资料列表（用于大佬卡片墙）
export const getPublicProfiles = async (search?: string) => {
  let query = supabase
    .from('profiles')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`nickname.ilike.%${search}%,bio.ilike.%${search}%`);
  }

  const { data, error } = await query;
  
  if (error) throw error;
  
  return data?.map(profile => ({
    id: profile.id,
    nickname: profile.nickname,
    bio: profile.bio,
    avatar: profile.avatar_url,
    powerData: {
      bench: profile.bench_press,
      squat: profile.squat,
      deadlift: profile.deadlift,
    },
    createdAt: new Date(profile.created_at),
  }));
};

// 获取用户统计数据
export const getUserStats = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, is_public, created_at');

  if (error) throw error;

  const totalUsers = data?.length || 0;
  const publicUsers = data?.filter(p => p.is_public).length || 0;
  
  return {
    totalUsers,
    publicUsers,
    privateUsers: totalUsers - publicUsers,
  };
};