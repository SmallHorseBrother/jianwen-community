# Supabase数据库更新指南

## 概述
本指南将帮助你使用MCP功能和SQL脚本来更新Supabase数据库，添加社区个人信息卡片系统所需的字段。

## 当前数据库状态分析

通过MCP功能检查，我们发现：

### 已存在的表：
1. **profiles表** - 用户资料表（需要扩展）
2. **articles表** - 文章表（已完整）
3. **tasks表** - 任务表（额外存在）

### profiles表当前字段：
- ✅ id, phone, nickname, bio, avatar_url
- ✅ bench_press, squat, deadlift, is_public
- ✅ created_at, updated_at

### 需要添加的字段：
- ❌ group_identity（群身份）
- ❌ profession（专业领域）
- ❌ group_nickname（群昵称）
- ❌ specialties（擅长领域数组）
- ❌ fitness_interests（健身爱好数组）
- ❌ learning_interests（学习兴趣数组）
- ❌ social_links（社交链接JSON）

## 更新步骤

### 步骤1：备份数据（重要！）
在进行任何数据库更改之前，建议先备份现有数据：

```sql
-- 备份profiles表数据
SELECT * FROM profiles;
```

### 步骤2：执行更新脚本
1. 登录到你的Supabase项目控制台
2. 导航到 **SQL编辑器** 页面
3. 创建一个新的SQL查询
4. 复制并粘贴 `execute_supabase_update.sql` 文件的内容
5. 点击 **Run** 按钮执行脚本

### 步骤3：验证更新结果
1. 脚本会自动验证结果，无需额外步骤
2. 检查执行结果中的验证信息
3. 确保看到所有 "✅ 已添加字段" 的成功消息

### 步骤4：测试应用
1. 重启你的React应用
2. 测试用户注册和登录功能
3. 测试Profile页面的新字段编辑功能
4. 测试社区卡片墙功能

## 更新内容详解

### 新增字段说明：

| 字段名 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| group_identity | text | 群身份（学习一群、学习二群、健身一群、健身二群等） | NULL |
| profession | text | 专业领域（程序员、设计师、学生等） | NULL |
| group_nickname | text | 群昵称 | NULL |
| specialties | text[] | 擅长领域数组 | '{}' |
| fitness_interests | text[] | 健身爱好数组 | '{}' |
| learning_interests | text[] | 学习兴趣数组 | '{}' |
| social_links | jsonb | 社交链接JSON对象 | '{}' |

### 安全策略更新：
- 保持现有的RLS策略
- 确保公开用户资料的访问策略正确
- 用户只能编辑自己的资料

## 故障排除

### 常见问题：

1. **权限错误**
   - 确保你是Supabase项目的所有者或管理员
   - 检查你的角色权限

2. **字段已存在错误**
   - 脚本使用了 `IF NOT EXISTS` 检查，应该不会出现此问题
   - 如果出现，可能是字段名冲突

3. **数据类型错误**
   - 确保PostgreSQL版本支持所有使用的数据类型
   - 特别是 `text[]` 和 `jsonb` 类型

4. **应用连接问题**
   - 更新后重启应用
   - 检查环境变量配置
   - 清除浏览器缓存

## 回滚方案

如果需要回滚更改：

```sql
-- 移除新增字段（谨慎使用！）
ALTER TABLE profiles 
DROP COLUMN IF EXISTS group_identity,
DROP COLUMN IF EXISTS profession,
DROP COLUMN IF EXISTS group_nickname,
DROP COLUMN IF EXISTS specialties,
DROP COLUMN IF EXISTS fitness_interests,
DROP COLUMN IF EXISTS learning_interests,
DROP COLUMN IF EXISTS social_links;
```

## 验证成功标志

更新成功后，你应该看到：

1. ✅ 验证脚本显示所有7个新字段
2. ✅ 字段类型正确（text, text[], jsonb）
3. ✅ 默认值设置正确
4. ✅ 字段注释已添加
5. ✅ RLS策略正常工作
6. ✅ 应用可以正常读写新字段

## 下一步

数据库更新完成后，你可以：

1. 测试个人资料编辑功能
2. 测试社区卡片墙功能
3. 测试用户匹配功能
4. 开始使用完整的社区个人信息卡片系统

## 联系支持

如果遇到任何问题，可以：
1. 检查Supabase项目的日志
2. 查看SQL编辑器的错误消息
3. 参考Supabase官方文档 