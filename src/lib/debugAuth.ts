/**
 * Debug utilities for authentication issues
 * 
 * Run these in browser console to diagnose login problems
 */

import { supabase } from './supabase';

/**
 * Test database connection and profile query
 */
export async function debugProfileQuery(userId: string) {
  console.log('=== DEBUG: Profile Query Test ===');
  console.log('User ID:', userId);
  
  const startTime = Date.now();
  
  try {
    // Test 1: Simple count query
    console.log('Test 1: Simple count query...');
    const { count, error: countError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    console.log('Count result:', count, 'Error:', countError);
    
    // Test 2: Direct profile query
    console.log('Test 2: Direct profile query...');
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nickname, phone')
      .eq('id', userId)
      .single();
    
    const duration = Date.now() - startTime;
    
    console.log('Query duration:', duration, 'ms');
    console.log('Data:', data);
    console.log('Error:', error);
    
    if (error) {
      console.error('Profile query failed:', error.message);
      console.error('Error code:', error.code);
      console.error('Error details:', error.details);
      console.error('Error hint:', error.hint);
    }
    
    return { data, error, duration };
  } catch (err) {
    console.error('Exception:', err);
    return { data: null, error: err, duration: Date.now() - startTime };
  }
}

/**
 * Test current auth state
 */
export async function debugAuthState() {
  console.log('=== DEBUG: Auth State ===');
  
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('Session:', session ? 'exists' : 'none');
    console.log('Session error:', sessionError);
    
    if (session) {
      console.log('User ID:', session.user.id);
      console.log('User email:', session.user.email);
      console.log('Access token expires at:', new Date(session.expires_at! * 1000).toISOString());
      
      // Test profile query with this user
      await debugProfileQuery(session.user.id);
    }
    
    return { session, error: sessionError };
  } catch (err) {
    console.error('Exception:', err);
    return { session: null, error: err };
  }
}

/**
 * Test RLS policies
 */
export async function debugRLS() {
  console.log('=== DEBUG: RLS Policy Test ===');
  
  try {
    // Test 1: Query without auth
    console.log('Test 1: Query public profiles...');
    const { data: publicProfiles, error: publicError } = await supabase
      .from('profiles')
      .select('id, nickname, is_public')
      .eq('is_public', true)
      .limit(5);
    
    console.log('Public profiles:', publicProfiles?.length || 0);
    console.log('Public query error:', publicError);
    
    // Test 2: Check current user
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Current user:', user?.id || 'none');
    
    if (user) {
      console.log('Test 2: Query own profile...');
      const { data: ownProfile, error: ownError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      console.log('Own profile:', ownProfile ? 'found' : 'not found');
      console.log('Own profile error:', ownError);
    }
    
    return { success: true };
  } catch (err) {
    console.error('Exception:', err);
    return { success: false, error: err };
  }
}

// Export for browser console access
if (typeof window !== 'undefined') {
  (window as any).debugAuth = {
    debugProfileQuery,
    debugAuthState,
    debugRLS,
  };
}
