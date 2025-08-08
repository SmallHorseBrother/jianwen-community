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
            console.log('Fetching user profile for:', session.user.id);
            const profile = await getUserProfile(session.user.id);
            
            if (profile) {
              console.log('Profile loaded successfully:', profile.nickname);
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
            } else {
              console.log('Profile not found for user:', session.user.id);
              // Profile not found, which might be okay if user just signed up
              // The register function is responsible for creating the profile.
              setState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
              });
            }
          } catch (error) {
            console.error('获取用户资料失败:', error);
            // 如果是网络错误或临时错误，保持认证状态但清除用户数据
            // 这样用户可以重试而不需要重新登录
            setState({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } else {
          console.log('No session, clearing auth state');
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
      
      // 设置加载状态
      setState(prev => ({ ...prev, isLoading: true }));
      
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
        setState(prev => ({ ...prev, isLoading: false }));
        throw error;
      }

      if (data.user) {
        console.log('Login successful, user ID:', data.user.id);

        // 直接获取并设置用户资料，避免依赖 onAuthStateChange 可能的网络失败
        try {
          const profile = await getUserProfile(data.user.id);
          if (!profile) {
            throw new Error('未找到用户资料');
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
        } catch (profileError) {
          console.error('获取登录用户资料失败:', profileError);
          // 若获取资料失败则强制登出，提示用户重试
          await supabase.auth.signOut();
          setState({ user: null, isAuthenticated: false, isLoading: false });
          throw new Error('登录失败：无法加载用户资料，请稍后重试');
        }
      } else {
        console.log('Login returned no user data');
        setState(prev => ({ ...prev, isLoading: false }));
        throw new Error('登录失败：未返回用户数据');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      throw new Error(error.message || '登录失败');
    }
  };

  const register = async (phone: string, password: string, nickname: string) => {
    try {
      const email = `${phone}@jianwen.community`;
      
      // 1. 先尝试注册账号
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined,
        },
      });
      if (signUpError) {
        throw signUpError;
      }
      if (!signUpData.user) {
        throw new Error('注册失败');
      }

      // 2. 注册后立即登录，确保获取 session，避免 RLS 拒绝 profile 插入
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        throw signInError;
      }
      if (!signInData.session) {
        console.warn('注册后未获取到 session，可能需要邮箱确认');
      }

      // 3. 创建用户资料
      await createUserProfile({
        id: signUpData.user.id,
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

      console.log('Registration & profile creation completed successfully');
    } catch (error: any) {
      if (error.message && (error.message.includes('User already registered') || 
          error.message.includes('duplicate key value violates unique constraint "profiles_phone_key"'))) {
        throw new Error('该手机号已被注册，请使用其他手机号或直接登录');
      }
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