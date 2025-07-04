import React, { createContext, useContext, useState, useEffect } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, getCurrentUser, getUserProfile, createUserProfile, updateUserProfile } from '../lib/supabase';
import { User, AuthState } from '../types';

interface AuthContextType extends AuthState {
  login: (phone: string, password: string) => Promise<void>;
  register: (phone: string, password: string, nickname: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // 监听认证状态变化
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          try {
            const profile = await getUserProfile(session.user.id);
            
            // 如果没有找到用户资料，设置为未认证状态
            if (!profile) {
              setState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
              });
              return;
            }
            
            const user: User = {
              id: profile.id,
              phone: profile.phone || '',
              nickname: profile.nickname,
              bio: profile.bio,
              avatar: profile.avatar_url,
              powerData: {
                bench: profile.bench_press,
                squat: profile.squat,
                deadlift: profile.deadlift,
              },
              isPublic: profile.is_public,
              createdAt: new Date(profile.created_at),
            };
            setState({
              user,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch (error) {
            console.error('获取用户资料失败:', error);
            setState({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } else {
          setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (phone: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // 使用手机号作为邮箱格式进行登录
      const email = `${phone}@jianwen.community`;
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // 用户资料会通过onAuthStateChange自动加载
    } catch (error: any) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw new Error(error.message || '登录失败');
    }
  };

  const register = async (phone: string, password: string, nickname: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // 使用手机号作为邮箱格式进行注册
      const email = `${phone}@jianwen.community`;
      
      // 注册用户
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined, // 禁用邮箱确认
        }
      });

      if (error) throw error;
      if (!data.user) throw new Error('注册失败');

      // 创建用户资料
      await createUserProfile({
        id: data.user.id,
        phone,
        nickname,
        bio: '',
        bench_press: 0,
        squat: 0,
        deadlift: 0,
        is_public: true,
      });

    } catch (error: any) {
      setState(prev => ({ ...prev, isLoading: false }));
      // 检查是否是用户已存在的错误
      if (error.message && (error.message.includes('User already registered') || 
          error.message.includes('duplicate key value violates unique constraint "profiles_phone_key"'))) {
        throw new Error('该手机号已被注册，请使用其他手机号或直接登录');
      }
      // 检查是否是数据库约束违反错误（错误代码 23505）
      if (error.code === '23505' && error.message.includes('profiles_phone_key')) {
        throw new Error('该手机号已被注册，请使用其他手机号或直接登录');
      }
      throw new Error(error.message || '注册失败');
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!state.user) return;
    
    try {
      const profileUpdates: any = {};
      
      if (updates.nickname) profileUpdates.nickname = updates.nickname;
      if (updates.bio !== undefined) profileUpdates.bio = updates.bio;
      if (updates.avatar !== undefined) profileUpdates.avatar_url = updates.avatar;
      if (updates.isPublic !== undefined) profileUpdates.is_public = updates.isPublic;
      
      if (updates.powerData) {
        if (updates.powerData.bench !== undefined) profileUpdates.bench_press = updates.powerData.bench;
        if (updates.powerData.squat !== undefined) profileUpdates.squat = updates.powerData.squat;
        if (updates.powerData.deadlift !== undefined) profileUpdates.deadlift = updates.powerData.deadlift;
      }

      const updatedProfile = await updateUserProfile(state.user.id, profileUpdates);
      
      // 更新本地状态
      const updatedUser: User = {
        ...state.user,
        nickname: updatedProfile.nickname,
        bio: updatedProfile.bio,
        avatar: updatedProfile.avatar_url,
        powerData: {
          bench: updatedProfile.bench_press,
          squat: updatedProfile.squat,
          deadlift: updatedProfile.deadlift,
        },
        isPublic: updatedProfile.is_public,
      };

      setState(prev => ({ ...prev, user: updatedUser }));
    } catch (error: any) {
      throw new Error(error.message || '更新资料失败');
    }
  };

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      register,
      logout,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};