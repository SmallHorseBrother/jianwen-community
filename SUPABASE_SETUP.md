# Supabase数据库设置说明

## 问题描述
当您看到注册失败的422错误时，这是因为数据库表结构还没有在您的Supabase项目中创建。

## 解决方案

### 步骤1：登录Supabase控制台
1. 打开浏览器，访问 [https://app.supabase.com](https://app.supabase.com)
2. 使用您的账号登录
3. 选择您的项目（URL应该包含 `dltotjjxhucysnezzzkc`）

### 步骤2：打开SQL编辑器
1. 在左侧导航栏中，点击 **SQL Editor** （SQL编辑器）
2. 点击 **New Query**（新查询）

### 步骤3：执行数据库设置脚本
1. 复制项目根目录中的 `setup_database.sql` 文件的全部内容
2. 将内容粘贴到SQL编辑器中
3. 点击 **Run**（运行）按钮执行脚本

### 步骤4：验证设置
执行完成后，您应该会看到：
- 创建了 `profiles` 表（用户资料表）
- 创建了 `articles` 表（文章表）
- 设置了相应的安全策略
- 显示 "Database setup completed successfully!" 消息

### 步骤5：测试注册功能
1. 返回到您的应用 (http://localhost:5174)
2. 尝试注册新用户
3. 现在应该能够成功注册了

## 可能遇到的问题

### 如果仍然出现错误
1. 确认您的Supabase项目URL和API密钥正确
2. 检查SQL脚本是否完全执行完成
3. 在Supabase控制台的 **Table Editor** 中确认表格已创建

### 如果需要重新设置
如果需要重新运行设置脚本，不用担心 - 脚本包含了 `IF NOT EXISTS` 和 `DROP IF EXISTS` 语句，可以安全地重复执行。

## 表结构说明

### profiles表（用户资料）
- `id`: 用户ID（关联auth.users）
- `phone`: 手机号
- `nickname`: 昵称
- `bio`: 个人简介
- `avatar_url`: 头像链接
- `bench_press`, `squat`, `deadlift`: 健身数据
- `is_public`: 是否公开资料

### articles表（文章）
- `id`: 文章ID
- `title`: 标题
- `content`: 内容
- `category`: 分类
- `type`: 类型（fitness/learning）
- `tags`: 标签
- `author_id`: 作者ID
- `is_published`: 是否发布

## 需要帮助？
如果在设置过程中遇到任何问题，请检查：
1. 网络连接是否正常
2. Supabase项目是否处于活跃状态
3. 是否有足够的权限执行SQL命令 