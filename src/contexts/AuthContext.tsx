import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase, getCurrentSession, getUserProfile, createUserProfile, updateUserProfile } from '../lib/supabase.ts';
import { User, AuthState } from '../types';
import { withTimeout, TIMEOUT_CONFIG, isTimeoutError } from '../lib/timeoutManager';
import { clearAuthCache, validateSessionCache, hasSessionInCache } from '../lib/cacheManager';
import { getGlobalQueue } from '../lib/operationQueue';
import { AuthStatus } from '../types/authState';
import { logOperationStart, logStateChange, logError, logNetworkRequest, logWarning } from '../lib/authLogger';

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

  // Use ref to track if we're in manual login to prevent listener interference
  const isManualLoginRef = useRef(false);
  const operationQueue = getGlobalQueue();

  const mapProfileToUser = (profile: any): User => ({
    id: profile.id,
    phone: profile.phone || '',
    nickname: profile.nickname,
    bio: profile.bio || '',
    avatar: profile.avatar_url ?? undefined,
    powerData: {
      bench: profile.bench_press || 0,
      squat: profile.squat || 0,
      deadlift: profile.deadlift || 0,
    },
    isPublic: profile.is_public,
    groupIdentity: profile.group_identity ?? undefined,
    profession: profile.profession ?? undefined,
    groupNickname: profile.group_nickname ?? undefined,
    specialties: profile.specialties || [],
    fitnessInterests: profile.fitness_interests || [],
    learningInterests: profile.learning_interests || [],
    socialLinks: (profile.social_links as { [key: string]: string }) || {},
    createdAt: new Date(profile.created_at),
  });

  // 初始化会话并监听认证变化
  useEffect(() => {
    let isMounted = true;

    const hydrateSession = async () => {
      logOperationStart('hydrateSession');
      
      try {
        // Validate cache first
        const cacheValidation = await validateSessionCache();
        
        if (!cacheValidation.isValid) {
          logWarning('Invalid cache detected during hydration', { reason: cacheValidation.reason });
          if (cacheValidation.hasSession) {
            // Clear corrupted cache
            clearAuthCache('corrupted_session');
          }
          setState({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }

        // Get current session
        const session = await getCurrentSession();
        if (!isMounted) return;

        if (session?.user) {
          try {
            logNetworkRequest('getUserProfile', 'profiles', 'pending', { userId: session.user.id });
            
            // Add timeout protection to profile loading
            const profile = await withTimeout(
              getUserProfile(session.user.id),
              TIMEOUT_CONFIG.INITIALIZATION,
              'hydration-profile-load'
            );
            
            if (!isMounted) return;

            if (profile) {
              const user: User = mapProfileToUser(profile);
              logNetworkRequest('getUserProfile', 'profiles', 'success');
              setState({ user, isAuthenticated: true, isLoading: false });
            } else {
              // Session exists but no profile - inconsistent state
              logWarning('Session exists but profile not found');
              clearAuthCache('missing_profile');
              setState({ user: null, isAuthenticated: false, isLoading: false });
            }
          } catch (err) {
            logError(err, 'hydration-profile-load');
            
            // Handle timeout or network errors
            if (isTimeoutError(err) || (err instanceof Error && err.message.includes('network'))) {
              clearAuthCache('network_error');
            }
            
            setState({ user: null, isAuthenticated: false, isLoading: false });
          }
        } else {
          setState({ user: null, isAuthenticated: false, isLoading: false });
        }
      } catch (err) {
        logError(err, 'hydrateSession');
        clearAuthCache('corrupted_session');
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    };

    hydrateSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      logStateChange(AuthStatus.IDLE, AuthStatus.IDLE, `auth-state-change-${event}`, { 
        hasSession: !!session,
        isManualLogin: isManualLoginRef.current 
      });

      if (!isMounted) return;

      // Skip listener updates during manual login to prevent race conditions
      if (isManualLoginRef.current && event === 'SIGNED_IN') {
        logWarning('Skipping auth state listener during manual login');
        return;
      }

      // Handle logout events
      if (event === 'SIGNED_OUT') {
        setState({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      // Handle sign-in events from listener (e.g., token refresh)
      if (session?.user && event !== 'SIGNED_IN') {
        try {
          const profile = await withTimeout(
            getUserProfile(session.user.id),
            TIMEOUT_CONFIG.PROFILE_LOAD,
            'listener-profile-load'
          );
          
          if (!isMounted) return;

          if (profile) {
            const user: User = mapProfileToUser(profile);
            setState({ user, isAuthenticated: true, isLoading: false });
          } else {
            setState({ user: null, isAuthenticated: false, isLoading: false });
          }
        } catch (error) {
          logError(error, 'listener-profile-load');
          setState({ user: null, isAuthenticated: false, isLoading: false });
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (phone: string, password: string) => {
    // Use operation queue to prevent concurrent login attempts
    return operationQueue.enqueue(async () => {
      logOperationStart('login', { phone });
      
      try {
        // Set manual login flag to prevent listener interference
        isManualLoginRef.current = true;

        // Set loading state
        setState(prev => ({ ...prev, isLoading: true }));

        const email = `${phone}@jianwen.community`;
        
        logNetworkRequest('signInWithPassword', 'auth', 'pending');

        // Add timeout protection to login
        const { data, error } = await withTimeout(
          supabase.auth.signInWithPassword({ email, password }),
          TIMEOUT_CONFIG.LOGIN,
          'login-auth'
        );

        if (error) {
          logError(error, 'login-auth');
          setState(prev => ({ ...prev, isLoading: false }));
          isManualLoginRef.current = false;
          throw error;
        }

        if (!data.user) {
          const err = new Error('登录失败：未返回用户数据');
          logError(err, 'login-auth');
          setState(prev => ({ ...prev, isLoading: false }));
          isManualLoginRef.current = false;
          throw err;
        }

        logNetworkRequest('signInWithPassword', 'auth', 'success', { userId: data.user.id });

        // Load user profile with timeout protection
        try {
          logNetworkRequest('getUserProfile', 'profiles', 'pending', { userId: data.user.id });
          
          const profile = await withTimeout(
            getUserProfile(data.user.id),
            TIMEOUT_CONFIG.PROFILE_LOAD,
            'login-profile-load'
          );

          if (!profile) {
            throw new Error('未找到用户资料');
          }
          
          const user: User = mapProfileToUser(profile);
          
          logNetworkRequest('getUserProfile', 'profiles', 'success');

          // Atomic state update
          setState({
            user,
            isAuthenticated: true,
            isLoading: false,
          });

          logOperationStart('login-complete', { userId: user.id });
          
          // Reset manual login flag after a short delay
          setTimeout(() => {
            isManualLoginRef.current = false;
          }, 500);
          
        } catch (profileError) {
          logError(profileError, 'login-profile-load');
          
          // Clear cache and sign out on profile load failure
          clearAuthCache('profile_load_failed');
          await supabase.auth.signOut();
          
          setState({ user: null, isAuthenticated: false, isLoading: false });
          isManualLoginRef.current = false;
          
          if (isTimeoutError(profileError)) {
            throw new Error('加载用户资料超时，请检查网络后重试');
          }
          throw new Error('登录失败：无法加载用户资料，请稍后重试');
        }

      } catch (error: any) {
        logError(error, 'login');
        setState(prev => ({ ...prev, isLoading: false }));
        isManualLoginRef.current = false;
        throw error;
      }
    }, 'login');
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
    return operationQueue.enqueue(async () => {
      logOperationStart('logout');
      
      try {
        // Clear local state first
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
        
        // Clear cache
        clearAuthCache('logout');
        
        const { error } = await supabase.auth.signOut();
        if (error) {
          logError(error, 'logout');
          throw error;
        }
        
        logOperationStart('logout-complete');
      } catch (error: any) {
        logError(error, 'logout');
        // Even if logout fails, clear local state
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    }, 'logout');
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
        bio: updatedProfile.bio || '',
        avatar: updatedProfile.avatar_url ?? undefined,
        powerData: {
          bench: updatedProfile.bench_press || 0,
          squat: updatedProfile.squat || 0,
          deadlift: updatedProfile.deadlift || 0,
        },
        isPublic: updatedProfile.is_public,
        groupIdentity: updatedProfile.group_identity ?? undefined,
        profession: updatedProfile.profession ?? undefined,
        groupNickname: updatedProfile.group_nickname ?? undefined,
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