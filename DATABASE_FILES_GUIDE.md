# 数据库文件使用指南

## 📁 文件概览

### 🎯 使用场景判断

**如果你是全新项目（数据库为空）**：
- 使用 `setup_database.sql` + `SUPABASE_SETUP.md`

**如果你已有项目但缺少社区字段**：
- 使用 `supabase/scripts/execute_supabase_update.sql`

## 📄 文件详细说明

### 1. 📋 `setup_database.sql` - 完整数据库初始化
- **🎯 用途**: 从零开始创建完整的数据库结构
- **📦 包含内容**:
  - ✅ 创建 `profiles` 表（包含**所有字段**，包括社区字段）
  - ✅ 创建 `articles` 表
  - ✅ 设置所有安全策略（RLS）
  - ✅ 创建触发器和索引
  - ✅ 智能检查（不会重复创建）

- **🔧 使用场景**:
  - 全新的Supabase项目
  - 数据库完全为空
  - 需要完整的数据库结构

### 2. 📖 `SUPABASE_SETUP.md` - 原始设置指南
- **🎯 用途**: 指导如何使用 `setup_database.sql`
- **📝 内容**:
  - 解决422注册错误的步骤
  - 数据库初始化流程
  - 表结构说明

### 3. 🚀 `supabase/scripts/execute_supabase_update.sql` - 增量更新脚本
- **🎯 用途**: 为已有数据库添加社区字段
- **📦 包含内容**:
  - ✅ 只添加缺失的社区字段
  - ✅ 智能检查（不会重复添加）
  - ✅ 自动验证结果
  - ✅ 详细执行日志

- **🔧 使用场景**:
  - 已有 `profiles` 表但缺少社区字段
  - 需要升级现有数据库
  - 增量更新

### 4. 📋 `supabase/scripts/SUPABASE_UPDATE_GUIDE.md` - 更新指南
- **🎯 用途**: 指导如何使用增量更新脚本
- **📝 内容**:
  - 详细的操作步骤
  - 故障排除指南
  - 验证清单

## 🛠️ 如何选择使用哪个文件？

### 💡 判断流程：

1. **检查你的数据库状态**：
   - 登录 Supabase 控制台
   - 查看 Table Editor
   - 检查是否有 `profiles` 表

2. **根据情况选择**：

   **情况A：没有任何表** 
   ```
   使用: setup_database.sql
   指南: SUPABASE_SETUP.md
   ```

   **情况B：有profiles表但缺少字段**
   ```
   使用: supabase/scripts/execute_supabase_update.sql
   指南: supabase/scripts/SUPABASE_UPDATE_GUIDE.md
   ```

   **情况C：完全不确定**
   ```
   使用: setup_database.sql (安全选择)
   说明: 这个脚本有智能检查，不会破坏现有数据
   ```

## 🎯 推荐使用方式

### 最简单的方式：
1. **直接使用 `setup_database.sql`**
2. **在 Supabase SQL Editor 中执行**
3. **脚本会自动检查和创建所需的一切**

### 为什么推荐 `setup_database.sql`：
- ✅ 包含完整的数据库结构
- ✅ 智能检查，不会重复创建
- ✅ 一次性解决所有问题
- ✅ 无论数据库是否为空都能正常工作

## ⚠️ 重要说明

- **所有脚本都是在 Supabase Web控制台的SQL Editor中执行的**
- **不是 CLI 迁移文件**
- **执行前建议备份数据**
- **脚本包含安全检查，可重复执行**

## 🚀 快速开始

**最快的方式**：
1. 打开 `setup_database.sql`
2. 复制全部内容
3. 在 Supabase SQL Editor 中粘贴执行
4. 完成！ 