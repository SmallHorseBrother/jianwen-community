/*
  # 社区卡片匹配功能完整数据库迁移

  1. 新增表
    - `user_connections` - 用户连接表（好友、关注等）
    - `match_preferences` - 匹配偏好设置
    - `community_activities` - 社区活动记录

  2. 扩展现有表
    - `profiles` 表添加更多社区字段

  3. 安全策略
    - 为所有新表启用 RLS
    - 设置适当的访问策略

  4. 索引优化
    - 为匹配查询添加性能索引
*/

-- 创建用户连接表（好友、关注等）
CREATE TABLE IF NOT EXISTS user_connections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  to_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  connection_type text NOT NULL CHECK (connection_type IN ('follow', 'friend', 'block', 'match')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(from_user_id, to_user_id, connection_type)
);

-- 创建匹配偏好设置表
CREATE TABLE IF NOT EXISTS match_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  preferred_groups text[] DEFAULT '{}', -- 偏好的群身份
  preferred_professions text[] DEFAULT '{}', -- 偏好的专业
  preferred_specialties text[] DEFAULT '{}', -- 偏好的擅长领域
  preferred_fitness_interests text[] DEFAULT '{}', -- 偏好的健身爱好
  preferred_learning_interests text[] DEFAULT '{}', -- 偏好的学习兴趣
  age_range_min integer DEFAULT 18,
  age_range_max integer DEFAULT 100,
  location_preference text, -- 地理位置偏好
  match_radius integer DEFAULT 50, -- 匹配半径（公里）
  is_active boolean DEFAULT true, -- 是否启用匹配
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 创建社区活动记录表
CREATE TABLE IF NOT EXISTS community_activities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('profile_view', 'connection_request', 'message_sent', 'group_join', 'event_attend')),
  target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  target_content_id uuid, -- 可以关联文章、活动等
  metadata jsonb DEFAULT '{}', -- 额外的活动数据
  created_at timestamptz DEFAULT now()
);

-- 为 profiles 表添加更多社区字段
DO $$ 
BEGIN
    -- 添加年龄字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'birth_year') THEN
        ALTER TABLE profiles ADD COLUMN birth_year integer;
    END IF;
    
    -- 添加地理位置字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'location') THEN
        ALTER TABLE profiles ADD COLUMN location text;
    END IF;
    
    -- 添加个人状态字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'status') THEN
        ALTER TABLE profiles ADD COLUMN status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'busy', 'away'));
    END IF;
    
    -- 添加最后活跃时间
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'last_active_at') THEN
        ALTER TABLE profiles ADD COLUMN last_active_at timestamptz DEFAULT now();
    END IF;
    
    -- 添加匹配分数字段（用于缓存）
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'match_score') THEN
        ALTER TABLE profiles ADD COLUMN match_score integer DEFAULT 0;
    END IF;
    
    -- 添加验证状态
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'is_verified') THEN
        ALTER TABLE profiles ADD COLUMN is_verified boolean DEFAULT false;
    END IF;
END $$;

-- 启用行级安全
ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_activities ENABLE ROW LEVEL SECURITY;

-- 用户连接表的安全策略
CREATE POLICY "用户可以查看自己的连接"
  ON user_connections
  FOR SELECT
  TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "用户可以创建连接"
  ON user_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "用户可以更新自己发起的连接"
  ON user_connections
  FOR UPDATE
  TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "用户可以删除自己的连接"
  ON user_connections
  FOR DELETE
  TO authenticated
  USING (from_user_id = auth.uid());

-- 匹配偏好表的安全策略
CREATE POLICY "用户可以查看自己的匹配偏好"
  ON match_preferences
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "用户可以管理自己的匹配偏好"
  ON match_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 社区活动表的安全策略
CREATE POLICY "用户可以查看相关的活动记录"
  ON community_activities
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR target_user_id = auth.uid());

CREATE POLICY "用户可以创建活动记录"
  ON community_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 创建性能优化索引
CREATE INDEX IF NOT EXISTS idx_user_connections_from_user ON user_connections(from_user_id);
CREATE INDEX IF NOT EXISTS idx_user_connections_to_user ON user_connections(to_user_id);
CREATE INDEX IF NOT EXISTS idx_user_connections_type ON user_connections(connection_type);
CREATE INDEX IF NOT EXISTS idx_user_connections_status ON user_connections(status);

CREATE INDEX IF NOT EXISTS idx_match_preferences_user ON match_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_match_preferences_active ON match_preferences(is_active);

CREATE INDEX IF NOT EXISTS idx_community_activities_user ON community_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_community_activities_target ON community_activities(target_user_id);
CREATE INDEX IF NOT EXISTS idx_community_activities_type ON community_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_community_activities_created ON community_activities(created_at);

-- 为 profiles 表添加新的索引
CREATE INDEX IF NOT EXISTS idx_profiles_group_identity ON profiles(group_identity);
CREATE INDEX IF NOT EXISTS idx_profiles_profession ON profiles(profession);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles(location);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON profiles(last_active_at);
CREATE INDEX IF NOT EXISTS idx_profiles_match_score ON profiles(match_score);
CREATE INDEX IF NOT EXISTS idx_profiles_specialties ON profiles USING gin(specialties);
CREATE INDEX IF NOT EXISTS idx_profiles_fitness_interests ON profiles USING gin(fitness_interests);
CREATE INDEX IF NOT EXISTS idx_profiles_learning_interests ON profiles USING gin(learning_interests);

-- 创建更新时间触发器
CREATE TRIGGER update_user_connections_updated_at
  BEFORE UPDATE ON user_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_match_preferences_updated_at
  BEFORE UPDATE ON match_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 创建自动更新最后活跃时间的触发器
CREATE OR REPLACE FUNCTION update_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles 
  SET last_active_at = now() 
  WHERE id = auth.uid();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 在用户活动时自动更新最后活跃时间
CREATE TRIGGER update_last_active_trigger
  AFTER INSERT ON community_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_last_active();