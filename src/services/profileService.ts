import { supabase } from '../lib/supabase';
import { User } from '../types';

// 获取所有公开的用户资料
export const getPublicProfiles = async (): Promise<User[]> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(profile => ({
      id: profile.id,
      phone: profile.phone || '',
      nickname: profile.nickname,
      bio: profile.bio || '',
      avatar: profile.avatar_url,
      powerData: {
        bench: profile.bench_press || 0,
        squat: profile.squat || 0,
        deadlift: profile.deadlift || 0,
      },
      isPublic: profile.is_public,
      groupIdentity: profile.group_identity,
      profession: profile.profession,
      groupNickname: profile.group_nickname,
      specialties: profile.specialties || [],
      fitnessInterests: profile.fitness_interests || [],
      learningInterests: profile.learning_interests || [],
      socialLinks: (profile.social_links as { [key: string]: string }) || {},
      createdAt: new Date(profile.created_at),
    }));
  } catch (error) {
    console.error('Error fetching public profiles:', error);
    throw error;
  }
};

// 根据兴趣匹配用户
export const findMatchingProfiles = async (
  userId: string,
  specialties: string[] = [],
  fitnessInterests: string[] = [],
  learningInterests: string[] = []
): Promise<User[]> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_public', true)
      .neq('id', userId); // 排除自己

    if (error) throw error;

    // 计算匹配度并排序
    const profilesWithScore = data.map(profile => {
      let score = 0;
      const profileSpecialties = profile.specialties || [];
      const profileFitnessInterests = profile.fitness_interests || [];
      const profileLearningInterests = profile.learning_interests || [];

      // 计算擅长领域匹配度
      specialties.forEach(specialty => {
        if (profileSpecialties.includes(specialty)) score += 3;
      });

      // 计算健身爱好匹配度
      fitnessInterests.forEach(interest => {
        if (profileFitnessInterests.includes(interest)) score += 2;
      });

      // 计算学习兴趣匹配度
      learningInterests.forEach(interest => {
        if (profileLearningInterests.includes(interest)) score += 2;
      });

      return {
        profile,
        score
      };
    })
    .filter(item => item.score > 0) // 只返回有匹配的用户
    .sort((a, b) => b.score - a.score) // 按匹配度降序排列
    .slice(0, 20); // 最多返回20个结果

    return profilesWithScore.map(item => ({
      id: item.profile.id,
      phone: item.profile.phone || '',
      nickname: item.profile.nickname,
      bio: item.profile.bio || '',
      avatar: item.profile.avatar_url,
      powerData: {
        bench: item.profile.bench_press || 0,
        squat: item.profile.squat || 0,
        deadlift: item.profile.deadlift || 0,
      },
      isPublic: item.profile.is_public,
      groupIdentity: item.profile.group_identity,
      profession: item.profile.profession,
      groupNickname: item.profile.group_nickname,
      specialties: item.profile.specialties || [],
      fitnessInterests: item.profile.fitness_interests || [],
      learningInterests: item.profile.learning_interests || [],
      socialLinks: (item.profile.social_links as { [key: string]: string }) || {},
      createdAt: new Date(item.profile.created_at),
    }));
  } catch (error) {
    console.error('Error finding matching profiles:', error);
    throw error;
  }
};

// 根据群身份搜索用户
export const searchProfilesByGroup = async (groupIdentity: string): Promise<User[]> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_public', true)
      .eq('group_identity', groupIdentity)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(profile => ({
      id: profile.id,
      phone: profile.phone || '',
      nickname: profile.nickname,
      bio: profile.bio || '',
      avatar: profile.avatar_url,
      powerData: {
        bench: profile.bench_press || 0,
        squat: profile.squat || 0,
        deadlift: profile.deadlift || 0,
      },
      isPublic: profile.is_public,
      groupIdentity: profile.group_identity,
      profession: profile.profession,
      groupNickname: profile.group_nickname,
      specialties: profile.specialties || [],
      fitnessInterests: profile.fitness_interests || [],
      learningInterests: profile.learning_interests || [],
      socialLinks: (profile.social_links as { [key: string]: string }) || {},
      createdAt: new Date(profile.created_at),
    }));
  } catch (error) {
    console.error('Error searching profiles by group:', error);
    throw error;
  }
};

// 获取用户统计信息
export const getProfileStats = async () => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('group_identity, profession, specialties, fitness_interests, learning_interests')
      .eq('is_public', true);

    if (error) throw error;

    const stats = {
      totalUsers: data.length,
      groupCounts: {} as { [key: string]: number },
      professionCounts: {} as { [key: string]: number },
      topSpecialties: {} as { [key: string]: number },
      topFitnessInterests: {} as { [key: string]: number },
      topLearningInterests: {} as { [key: string]: number },
    };

    data.forEach(profile => {
      // 统计群身份
      if (profile.group_identity) {
        stats.groupCounts[profile.group_identity] = (stats.groupCounts[profile.group_identity] || 0) + 1;
      }

      // 统计专业
      if (profile.profession) {
        stats.professionCounts[profile.profession] = (stats.professionCounts[profile.profession] || 0) + 1;
      }

      // 统计擅长领域
      (profile.specialties || []).forEach((specialty: string) => {
        stats.topSpecialties[specialty] = (stats.topSpecialties[specialty] || 0) + 1;
      });

      // 统计健身爱好
      (profile.fitness_interests || []).forEach((interest: string) => {
        stats.topFitnessInterests[interest] = (stats.topFitnessInterests[interest] || 0) + 1;
      });

      // 统计学习兴趣
      (profile.learning_interests || []).forEach((interest: string) => {
        stats.topLearningInterests[interest] = (stats.topLearningInterests[interest] || 0) + 1;
      });
    });

    return stats;
  } catch (error) {
    console.error('Error getting profile stats:', error);
    throw error;
  }
};