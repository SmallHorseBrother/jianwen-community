import { supabase } from '../lib/supabase';
import { User } from '../types';

export interface MatchPreferences {
  groups?: string[];
  professions?: string[];
  specialties?: string[];
  fitnessInterests?: string[];
  learningInterests?: string[];
  ageRange?: { min: number; max: number };
  location?: string;
  radius?: number;
}

export interface MatchedUser extends User {
  matchScore: number;
  matchReasons: string[];
  commonInterests: {
    specialties: string[];
    fitnessInterests: string[];
    learningInterests: string[];
  };
}

export interface UserConnection {
  id: string;
  fromUserId: string;
  toUserId: string;
  connectionType: 'follow' | 'friend' | 'block' | 'match';
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  createdAt: Date;
  updatedAt: Date;
  profile?: User;
}

// 获取匹配用户
export const findMatches = async (
  userId: string, 
  preferences?: MatchPreferences, 
  limit: number = 20
): Promise<MatchedUser[]> => {
  try {
    const { data, error } = await supabase.functions.invoke('match-users', {
      body: {
        userId,
        preferences,
        limit
      }
    });

    if (error) throw error;

    if (!data.success) {
      throw new Error(data.error || 'Failed to find matches');
    }

    return data.matches.map((match: any) => ({
      id: match.id,
      phone: match.phone || '',
      nickname: match.nickname,
      bio: match.bio || '',
      avatar: match.avatar_url,
      powerData: {
        bench: match.bench_press || 0,
        squat: match.squat || 0,
        deadlift: match.deadlift || 0,
      },
      isPublic: match.is_public,
      groupIdentity: match.group_identity,
      profession: match.profession,
      groupNickname: match.group_nickname,
      specialties: match.specialties || [],
      fitnessInterests: match.fitness_interests || [],
      learningInterests: match.learning_interests || [],
      socialLinks: (match.social_links as { [key: string]: string }) || {},
      createdAt: new Date(match.created_at),
      matchScore: match.matchScore,
      matchReasons: match.matchReasons,
      commonInterests: match.commonInterests
    }));
  } catch (error) {
    console.error('Error finding matches:', error);
    throw error;
  }
};

// 创建用户连接
export const createConnection = async (
  fromUserId: string,
  toUserId: string,
  connectionType: 'follow' | 'friend' | 'block' | 'match'
): Promise<UserConnection> => {
  try {
    const { data, error } = await supabase.functions.invoke('user-connections', {
      body: {
        action: 'create',
        fromUserId,
        toUserId,
        connectionType
      }
    });

    if (error) throw error;

    if (!data.success) {
      throw new Error(data.error || 'Failed to create connection');
    }

    return {
      id: data.connection.id,
      fromUserId: data.connection.from_user_id,
      toUserId: data.connection.to_user_id,
      connectionType: data.connection.connection_type,
      status: data.connection.status,
      createdAt: new Date(data.connection.created_at),
      updatedAt: new Date(data.connection.updated_at)
    };
  } catch (error) {
    console.error('Error creating connection:', error);
    throw error;
  }
};

// 更新连接状态
export const updateConnection = async (
  userId: string,
  connectionId: string,
  status: 'accepted' | 'rejected' | 'blocked'
): Promise<UserConnection> => {
  try {
    const { data, error } = await supabase.functions.invoke('user-connections', {
      body: {
        action: 'update',
        fromUserId: userId,
        connectionId,
        status
      }
    });

    if (error) throw error;

    if (!data.success) {
      throw new Error(data.error || 'Failed to update connection');
    }

    return {
      id: data.connection.id,
      fromUserId: data.connection.from_user_id,
      toUserId: data.connection.to_user_id,
      connectionType: data.connection.connection_type,
      status: data.connection.status,
      createdAt: new Date(data.connection.created_at),
      updatedAt: new Date(data.connection.updated_at)
    };
  } catch (error) {
    console.error('Error updating connection:', error);
    throw error;
  }
};

// 删除连接
export const deleteConnection = async (
  userId: string,
  toUserId: string
): Promise<void> => {
  try {
    const { data, error } = await supabase.functions.invoke('user-connections', {
      body: {
        action: 'delete',
        fromUserId: userId,
        toUserId
      }
    });

    if (error) throw error;

    if (!data.success) {
      throw new Error(data.error || 'Failed to delete connection');
    }
  } catch (error) {
    console.error('Error deleting connection:', error);
    throw error;
  }
};

// 获取用户连接列表
export const getUserConnections = async (userId: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('user-connections', {
      body: {
        action: 'list',
        fromUserId: userId
      }
    });

    if (error) throw error;

    if (!data.success) {
      throw new Error(data.error || 'Failed to get connections');
    }

    return data.connections;
  } catch (error) {
    console.error('Error getting connections:', error);
    throw error;
  }
};

// 保存匹配偏好
export const saveMatchPreferences = async (
  userId: string,
  preferences: MatchPreferences
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('match_preferences')
      .upsert({
        user_id: userId,
        preferred_groups: preferences.groups || [],
        preferred_professions: preferences.professions || [],
        preferred_specialties: preferences.specialties || [],
        preferred_fitness_interests: preferences.fitnessInterests || [],
        preferred_learning_interests: preferences.learningInterests || [],
        age_range_min: preferences.ageRange?.min || 18,
        age_range_max: preferences.ageRange?.max || 100,
        location_preference: preferences.location,
        match_radius: preferences.radius || 50,
        is_active: true
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error saving match preferences:', error);
    throw error;
  }
};

// 获取匹配偏好
export const getMatchPreferences = async (userId: string): Promise<MatchPreferences | null> => {
  try {
    const { data, error } = await supabase
      .from('match_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!data) return null;

    return {
      groups: data.preferred_groups || [],
      professions: data.preferred_professions || [],
      specialties: data.preferred_specialties || [],
      fitnessInterests: data.preferred_fitness_interests || [],
      learningInterests: data.preferred_learning_interests || [],
      ageRange: {
        min: data.age_range_min || 18,
        max: data.age_range_max || 100
      },
      location: data.location_preference,
      radius: data.match_radius || 50
    };
  } catch (error) {
    console.error('Error getting match preferences:', error);
    throw error;
  }
};

// 记录用户活动
export const recordActivity = async (
  userId: string,
  activityType: 'profile_view' | 'connection_request' | 'message_sent' | 'group_join' | 'event_attend',
  targetUserId?: string,
  metadata?: any
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('community_activities')
      .insert({
        user_id: userId,
        activity_type: activityType,
        target_user_id: targetUserId,
        metadata: metadata || {}
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error recording activity:', error);
    // 不抛出错误，因为活动记录失败不应该影响主要功能
  }
};