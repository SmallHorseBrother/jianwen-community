/**
 * Q&A 提问箱服务
 * 马健文的数字大脑 - 核心功能
 */

import { supabase } from "../lib/supabase";
import type { Database, QuestionStatus } from "../lib/database.types";

type Question = Database["public"]["Tables"]["questions"]["Row"];
type QuestionInsert = Database["public"]["Tables"]["questions"]["Insert"];
type QuestionUpdate = Database["public"]["Tables"]["questions"]["Update"];

// ==================== 用户端功能 ====================

/**
 * 提交问题
 */
export const submitQuestion = async (
  content: string,
  options?: {
    isAnonymous?: boolean;
    askerId?: string;
    askerNickname?: string;
    tags?: string[];
  },
): Promise<Question> => {
  const { data, error } = await supabase
    .from("questions")
    .insert({
      content,
      is_anonymous: options?.isAnonymous ?? false,
      asker_id: options?.isAnonymous ? null : options?.askerId,
      asker_nickname: options?.isAnonymous
        ? "匿名用户"
        : options?.askerNickname,
      tags: options?.tags ?? [],
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * 获取问答列表 (知识广场)
 * 显示所有未被忽略的问题（包括待回答和已发布）
 */
export const getPublishedQuestions = async (options?: {
  limit?: number;
  offset?: number;
  tag?: string;
  searchQuery?: string;
  featuredOnly?: boolean;
}): Promise<{ questions: Question[]; total: number }> => {
  let query = supabase
    .from("questions")
    .select("*", { count: "exact" })
    .neq("status", "ignored") // 排除被忽略的，显示 pending 和 published
    .order("created_at", { ascending: false }); // 按提问时间排序

  if (options?.featuredOnly) {
    // 精选只显示已发布的
    query = query.eq("is_featured", true).eq("status", "published");
  }

  if (options?.tag) {
    query = query.contains("tags", [options.tag]);
  }

  if (options?.searchQuery) {
    query = query.or(
      `content.ilike.%${options.searchQuery}%,answer.ilike.%${options.searchQuery}%`,
    );
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(
      options.offset,
      options.offset + (options.limit || 10) - 1,
    );
  }

  const { data, error, count } = await query;

  if (error) throw error;
  return { questions: data || [], total: count || 0 };
};

/**
 * 获取单个问答详情
 */
export const getQuestionById = async (id: string): Promise<Question | null> => {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  // 增加浏览次数
  await supabase
    .from("questions")
    .update({ view_count: (data.view_count || 0) + 1 })
    .eq("id", id);

  return data;
};

/**
 * 获取用户自己提的问题
 */
export const getMyQuestions = async (userId: string): Promise<Question[]> => {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("asker_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * 获取所有已使用的标签
 */
export const getAllTags = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from("questions")
    .select("tags")
    .eq("status", "published");

  if (error) throw error;

  const tagSet = new Set<string>();
  data?.forEach((q) => q.tags?.forEach((tag: string) => tagSet.add(tag)));
  return Array.from(tagSet).sort();
};

// ==================== 管理员功能 ====================

/**
 * 检查用户是否是管理员
 * 使用 profiles.user_role 字段判断，支持 'admin' 和 'super_admin' 两种角色
 */
export const checkIsAdmin = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_role")
    .eq("id", userId)
    .single();

  if (error) return false;
  return data?.user_role === "admin" || data?.user_role === "super_admin";
};

/**
 * 获取待回答的问题列表 (管理员)
 */
export const getPendingQuestions = async (): Promise<Question[]> => {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * 获取所有问题 (管理员)
 */
export const getAllQuestions = async (
  status?: QuestionStatus,
): Promise<Question[]> => {
  let query = supabase
    .from("questions")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
};

/**
 * 回答问题 (管理员)
 */
export const answerQuestion = async (
  questionId: string,
  answer: string,
  tags?: string[],
): Promise<Question> => {
  const updateData: QuestionUpdate = {
    answer,
    status: "published",
    answered_at: new Date().toISOString(),
  };

  if (tags) {
    updateData.tags = tags;
  }

  const { data, error } = await supabase
    .from("questions")
    .update(updateData)
    .eq("id", questionId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * 更新问题状态 (管理员)
 */
export const updateQuestionStatus = async (
  questionId: string,
  status: QuestionStatus,
): Promise<Question> => {
  const { data, error } = await supabase
    .from("questions")
    .update({ status })
    .eq("id", questionId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * 设置/取消精选 (管理员)
 */
export const toggleFeatured = async (
  questionId: string,
  isFeatured: boolean,
): Promise<Question> => {
  const { data, error } = await supabase
    .from("questions")
    .update({ is_featured: isFeatured })
    .eq("id", questionId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * 删除问题 (管理员)
 */
export const deleteQuestion = async (questionId: string): Promise<void> => {
  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", questionId);

  if (error) throw error;
};

/**
 * 更新问题内容 (管理员)
 */
export const updateQuestion = async (
  questionId: string,
  updates: QuestionUpdate,
): Promise<Question> => {
  const { data, error } = await supabase
    .from("questions")
    .update(updates)
    .eq("id", questionId)
    .select()
    .single();

  if (error) throw error;
  return data;
};
