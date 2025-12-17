/**
 * 建议箱服务
 * 处理用户建议的提交和管理
 */

import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type Suggestion = Database["public"]["Tables"]["suggestions"]["Row"];
type SuggestionInsert = Database["public"]["Tables"]["suggestions"]["Insert"];
type SuggestionUpdate = Database["public"]["Tables"]["suggestions"]["Update"];

// ==================== 用户端功能 ====================

/**
 * 提交建议
 */
export const submitSuggestion = async (
    title: string,
    description: string,
    category: SuggestionInsert["category"],
    userId?: string,
    nickname?: string,
): Promise<Suggestion> => {
    const { data, error } = await supabase
        .from("suggestions")
        .insert({
            title,
            description,
            category,
            user_id: userId,
            user_nickname: nickname,
            status: "pending",
        })
        .select()
        .single();

    if (error) throw error;
    return data;
};

/**
 * 获取我的建议
 */
export const getMySuggestions = async (
    userId: string,
): Promise<Suggestion[]> => {
    const { data, error } = await supabase
        .from("suggestions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
};

/**
 * 获取公开建议列表 (知识广场/公示区)
 * 也可以用于管理员查看列表
 */
export const getAllSuggestions = async (options?: {
    status?: SuggestionInsert["status"];
    category?: SuggestionInsert["category"];
    limit?: number;
}): Promise<Suggestion[]> => {
    let query = supabase
        .from("suggestions")
        .select("*")
        .order("created_at", { ascending: false });

    if (options?.status) {
        query = query.eq("status", options.status);
    }

    if (options?.category) {
        query = query.eq("category", options.category);
    }

    if (options?.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
};

// ==================== 管理员功能 ====================

/**
 * 更新建议状态 (管理员)
 */
export const updateSuggestionStatus = async (
    id: string,
    status: SuggestionInsert["status"],
    adminNotes?: string,
): Promise<Suggestion> => {
    const updates: SuggestionUpdate = {
        status,
        updated_at: new Date().toISOString(),
    };

    if (adminNotes !== undefined) {
        updates.admin_notes = adminNotes;
    }

    const { data, error } = await supabase
        .from("suggestions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

/**
 * 删除建议 (管理员)
 */
export const deleteSuggestion = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from("suggestions")
        .delete()
        .eq("id", id);

    if (error) throw error;
};
