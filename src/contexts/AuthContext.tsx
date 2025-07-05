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
        console.log('Auth state change:', event, session?.user?.id);
        
        if (session?.user) {
          try {
            let profile = await getUserProfile(session.user.id);
            
            // 如果没有找到用户资料，创建一个基本的资料
            if (!profile) {
              console.log('No profile found for user:', session.user.id, 'creating basic profile');
              try {
                // 从邮箱中提取手机号
                const email = session.user.email || '';
                const phone = email.replace('@jianwen.community', '');
                
                await createUserProfile({
                  id: session.user.id,
                  phone: phone,
                  nickname: `用户${phone.slice(-4)}`, // 使用手机号后四位作为昵称
                  bio: '',
                  bench_press: 0,
                  squat: 0,
                  deadlift: 0,
                  is_public: true,
                  group_identity: null,
                  profession: null,
                  group_nickname: null,
                  specialties: [],
                  fitness_interests: [],
                  learning_interests: [],
                  social_links: {},
                });
                
                // 重新获取创建的资料
                profile = await getUserProfile(session.user.id);
                console.log('Created and retrieved profile:', profile);
              } catch (createError) {
                console.error('Failed to create profile:', createError);
                setState({
                  user: null,
                  isAuthenticated: false,
                  isLoading: false,
                });
                return;
              }
            }
            
            if (!profile) {
              console.log('Still no profile after creation attempt');
              setState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
              });
              return;
            }
            
            console.log('Profile loaded:', profile);
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
              groupIdentity: profile.group_identity,
              profession: profile.profession,
              groupNickname: profile.group_nickname,
              specialties: profile.specialties || [],
              fitnessInterests: profile.fitness_interests || [],
              learningInterests: profile.learning_interests || [],
              socialLinks: (profile.social_links as { [key: string]: string }) || {},
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
          console.log('No session, setting unauthenticated');
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
    try {
      console.log('Attempting login with phone:', phone);
      // 使用手机号作为邮箱格式进行登录
      const email = `${phone}@jianwen.community`;
      console.log('Login email:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Login response:', { data, error });
      if (error) {
        console.error('Supabase login error:', error);
        throw error;
      }

      if (data.user) {
        console.log('Login successful, user ID:', data.user.id);
        // 用户资料会通过onAuthStateChange自动加载
      } else {
        console.log('Login returned no user data');
        throw new Error('登录失败：未返回用户数据');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || '登录失败');
    }
  };

  const register = async (phone: string, password: string, nickname: string) => {
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
        group_identity: null,
        profession: null,
        group_nickname: null,
        specialties: [],
        fitness_interests: [],
        learning_interests: [],
        social_links: {},
      });

    } catch (error: any) {
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
    try {
      // 先清除本地状态
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      console.error('退出登录失败:', error);
      // 即使退出失败，也清除本地状态
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!state.user) return;
    
    try {
      const profileUpdates: any = {};
      
      if (updates.nickname) profileUpdates.nickname = updates.nickname;
      if (updates.bio !== undefined) profileUpdates.bio = updates.bio;
      if (updates.avatar !== undefined) profileUpdates.avatar_url = updates.avatar;
      if (updates.isPublic !== undefined) profileUpdates.is_public = updates.isPublic;
      
      // 社区卡片相关字段
      if (updates.groupIdentity !== undefined) profileUpdates.group_identity = updates.groupIdentity;
      if (updates.profession !== undefined) profileUpdates.profession = updates.profession;
      if (updates.groupNickname !== undefined) profileUpdates.group_nickname = updates.groupNickname;
      if (updates.specialties !== undefined) profileUpdates.specialties = updates.specialties;
      if (updates.fitnessInterests !== undefined) profileUpdates.fitness_interests = updates.fitnessInterests;
      if (updates.learningInterests !== undefined) profileUpdates.learning_interests = updates.learningInterests;
      if (updates.socialLinks !== undefined) profileUpdates.social_links = updates.socialLinks;
      
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
        groupIdentity: updatedProfile.group_identity,
        profession: updatedProfile.profession,
        groupNickname: updatedProfile.group_nickname,
        specialties: updatedProfile.specialties || [],
        fitnessInterests: updatedProfile.fitness_interests || [],
        learningInterests: updatedProfile.learning_interests || [],
        socialLinks: (updatedProfile.social_links as { [key: string]: string }) || {},
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