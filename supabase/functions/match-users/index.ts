import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface MatchRequest {
  userId: string;
  preferences?: {
    groups?: string[];
    professions?: string[];
    specialties?: string[];
    fitnessInterests?: string[];
    learningInterests?: string[];
    ageRange?: { min: number; max: number };
    location?: string;
    radius?: number;
  };
  limit?: number;
}

interface UserProfile {
  id: string;
  nickname: string;
  bio: string;
  group_identity: string;
  profession: string;
  group_nickname: string;
  specialties: string[];
  fitness_interests: string[];
  learning_interests: string[];
  birth_year: number;
  location: string;
  status: string;
  last_active_at: string;
  match_score: number;
  is_verified: boolean;
  is_public: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { userId, preferences = {}, limit = 20 }: MatchRequest = await req.json()

    if (!userId) {
      throw new Error('User ID is required')
    }

    // 获取用户自己的资料
    const { data: currentUser, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !currentUser) {
      throw new Error('User not found')
    }

    // 获取用户的匹配偏好（如果存在）
    const { data: userPreferences } = await supabase
      .from('match_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    // 合并用户偏好和请求偏好
    const finalPreferences = {
      groups: preferences.groups || userPreferences?.preferred_groups || [],
      professions: preferences.professions || userPreferences?.preferred_professions || [],
      specialties: preferences.specialties || userPreferences?.preferred_specialties || [],
      fitnessInterests: preferences.fitnessInterests || userPreferences?.preferred_fitness_interests || [],
      learningInterests: preferences.learningInterests || userPreferences?.preferred_learning_interests || [],
      ageRange: preferences.ageRange || {
        min: userPreferences?.age_range_min || 18,
        max: userPreferences?.age_range_max || 100
      },
      location: preferences.location || userPreferences?.location_preference,
      radius: preferences.radius || userPreferences?.match_radius || 50
    }

    // 获取已连接的用户ID（避免重复推荐）
    const { data: connections } = await supabase
      .from('user_connections')
      .select('to_user_id')
      .eq('from_user_id', userId)

    const connectedUserIds = connections?.map(c => c.to_user_id) || []

    // 构建匹配查询
    let query = supabase
      .from('profiles')
      .select('*')
      .eq('is_public', true)
      .neq('id', userId) // 排除自己
      .eq('status', 'active') // 只匹配活跃用户

    // 排除已连接的用户
    if (connectedUserIds.length > 0) {
      query = query.not('id', 'in', `(${connectedUserIds.join(',')})`)
    }

    // 应用年龄过滤
    const currentYear = new Date().getFullYear()
    if (finalPreferences.ageRange.min > 18) {
      query = query.lte('birth_year', currentYear - finalPreferences.ageRange.min)
    }
    if (finalPreferences.ageRange.max < 100) {
      query = query.gte('birth_year', currentYear - finalPreferences.ageRange.max)
    }

    const { data: candidates, error: queryError } = await query.limit(100) // 获取更多候选人用于计算匹配度

    if (queryError) {
      throw queryError
    }

    // 计算匹配分数
    const scoredCandidates = candidates?.map((candidate: UserProfile) => {
      let score = 0
      let reasons: string[] = []

      // 群身份匹配 (权重: 15分)
      if (finalPreferences.groups.length > 0 && candidate.group_identity) {
        if (finalPreferences.groups.includes(candidate.group_identity)) {
          score += 15
          reasons.push(`同在${candidate.group_identity}`)
        }
      } else if (currentUser.group_identity === candidate.group_identity) {
        score += 10
        reasons.push(`同群身份`)
      }

      // 专业匹配 (权重: 12分)
      if (finalPreferences.professions.length > 0 && candidate.profession) {
        if (finalPreferences.professions.includes(candidate.profession)) {
          score += 12
          reasons.push(`专业相关`)
        }
      } else if (currentUser.profession === candidate.profession) {
        score += 8
        reasons.push(`同专业`)
      }

      // 擅长领域匹配 (权重: 每个匹配3分，最多15分)
      const specialtyMatches = candidate.specialties?.filter(s => 
        finalPreferences.specialties.includes(s) || currentUser.specialties?.includes(s)
      ) || []
      if (specialtyMatches.length > 0) {
        const specialtyScore = Math.min(specialtyMatches.length * 3, 15)
        score += specialtyScore
        reasons.push(`${specialtyMatches.length}个共同擅长领域`)
      }

      // 健身爱好匹配 (权重: 每个匹配2分，最多10分)
      const fitnessMatches = candidate.fitness_interests?.filter(f => 
        finalPreferences.fitnessInterests.includes(f) || currentUser.fitness_interests?.includes(f)
      ) || []
      if (fitnessMatches.length > 0) {
        const fitnessScore = Math.min(fitnessMatches.length * 2, 10)
        score += fitnessScore
        reasons.push(`${fitnessMatches.length}个共同健身爱好`)
      }

      // 学习兴趣匹配 (权重: 每个匹配2分，最多10分)
      const learningMatches = candidate.learning_interests?.filter(l => 
        finalPreferences.learningInterests.includes(l) || currentUser.learning_interests?.includes(l)
      ) || []
      if (learningMatches.length > 0) {
        const learningScore = Math.min(learningMatches.length * 2, 10)
        score += learningScore
        reasons.push(`${learningMatches.length}个共同学习兴趣`)
      }

      // 活跃度加分 (权重: 最多5分)
      const lastActive = new Date(candidate.last_active_at)
      const daysSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceActive <= 1) {
        score += 5
        reasons.push('最近很活跃')
      } else if (daysSinceActive <= 7) {
        score += 3
        reasons.push('本周活跃')
      } else if (daysSinceActive <= 30) {
        score += 1
        reasons.push('本月活跃')
      }

      // 验证用户加分 (权重: 3分)
      if (candidate.is_verified) {
        score += 3
        reasons.push('已验证用户')
      }

      // 个人资料完整度加分 (权重: 最多5分)
      let completeness = 0
      if (candidate.bio && candidate.bio.length > 10) completeness += 1
      if (candidate.profession) completeness += 1
      if (candidate.specialties && candidate.specialties.length > 0) completeness += 1
      if (candidate.fitness_interests && candidate.fitness_interests.length > 0) completeness += 1
      if (candidate.learning_interests && candidate.learning_interests.length > 0) completeness += 1
      
      score += completeness
      if (completeness >= 4) {
        reasons.push('资料完整')
      }

      return {
        ...candidate,
        matchScore: score,
        matchReasons: reasons,
        commonInterests: {
          specialties: specialtyMatches,
          fitnessInterests: fitnessMatches,
          learningInterests: learningMatches
        }
      }
    }) || []

    // 按匹配分数排序并限制结果数量
    const topMatches = scoredCandidates
      .filter(candidate => candidate.matchScore > 0) // 只返回有匹配度的用户
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit)

    // 记录匹配活动
    if (topMatches.length > 0) {
      await supabase
        .from('community_activities')
        .insert({
          user_id: userId,
          activity_type: 'match_request',
          metadata: {
            matches_found: topMatches.length,
            preferences_used: finalPreferences,
            top_score: topMatches[0]?.matchScore || 0
          }
        })
    }

    return new Response(
      JSON.stringify({
        success: true,
        matches: topMatches,
        total: topMatches.length,
        preferences: finalPreferences
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Match users error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})