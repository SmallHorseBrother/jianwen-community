import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

export type CheckIn = Database["public"]["Tables"]["check_ins"]["Row"] & {
    profiles?: Database["public"]["Tables"]["profiles"]["Row"];
    likes_count?: number[];
    comments_count?: number[];
    user_has_liked?: boolean;
    comments?: CheckInComment[];
    likes?: CheckInLike[];
};

export type CheckInComment =
    & Database["public"]["Tables"]["check_in_comments"]["Row"]
    & {
        profiles?: Database["public"]["Tables"]["profiles"]["Row"];
    };

export type CheckInLike =
    & Database["public"]["Tables"]["check_in_likes"]["Row"]
    & {
        profiles?: Database["public"]["Tables"]["profiles"]["Row"];
    };

const BUCKET_NAME = "check-in-images";

/**
 * 上传图片到 Storage
 */
export async function uploadCheckInImage(file: File): Promise<string | null> {
    try {
        // 1. 生成文件名
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}_${
            Math.random().toString(36).substring(2, 9)
        }.${fileExt}`;
        const filePath = `${fileName}`;

        // 2. 上传
        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file);

        if (uploadError) {
            console.error("上传图片失败:", uploadError);
            throw uploadError;
        }

        // 3. 获取公开链接
        const { data } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        return data.publicUrl;
    } catch (error) {
        console.error("Upload error:", error);
        return null;
    }
}

/**
 * 发布打卡
 */
export async function createCheckIn(
    content: string,
    imageUrls: string[] = [],
    userId: string,
) {
    const { data, error } = await supabase
        .from("check_ins")
        .insert({
            user_id: userId,
            content,
            image_urls: imageUrls,
            category: "daily",
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * 获取打卡列表
 */
export async function getCheckIns(limit = 20) {
    // 第一步：获取打卡数据和关联的用户信息
    const { data, error } = await supabase
        .from("check_ins")
        .select(`
      *,
      profiles:user_id (*),
      likes:check_in_likes(*),
      comments:check_in_comments(
        *,
        profiles:user_id(*)
      )
    `)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw error;

    // 处理返回数据，增加 computed fields
    // 注意：实际项目中通常应该用 SQL View 或 Function 来处理这些计数和状态，
    // 为了简化 MVP，我们在前端/Service 层处理。
    // 注意：Supabase JS 客户端会自动把关联表的数据嵌套进来

    return data || [];
}

/**
 * 点赞/取消点赞
 */
export async function toggleLike(checkInId: string, userId: string) {
    // 1. 检查是否已赞
    const { data: existingLike } = await supabase
        .from("check_in_likes")
        .select("id")
        .eq("check_in_id", checkInId)
        .eq("user_id", userId)
        .single();

    if (existingLike) {
        // 取消点赞
        const { error } = await supabase
            .from("check_in_likes")
            .delete()
            .eq("id", existingLike.id);
        if (error) throw error;
        return "unliked";
    } else {
        // 点赞
        const { error } = await supabase
            .from("check_in_likes")
            .insert({
                check_in_id: checkInId,
                user_id: userId,
            });
        if (error) throw error;
        return "liked";
    }
}

/**
 * 发表评论
 */
export async function addComment(
    checkInId: string,
    userId: string,
    content: string,
) {
    const { data, error } = await supabase
        .from("check_in_comments")
        .insert({
            check_in_id: checkInId,
            user_id: userId,
            content,
        })
        .select(`
      *,
      profiles:user_id (*)
    `)
        .single();

    if (error) throw error;
    return data;
}

/**
 * 获取活跃排行榜 (本月打卡次数 Top 10)
 * 说明：由于 Supabase Client 端做复杂聚合较难，这里用简单的计数查询模拟，
 * 或者在将来写一个 Database Function `get_active_users_ranking`.
 * MVP 阶段：直接拉取最近打卡记录并在前端聚合。
 */
export async function getLeaderboard() {
    // 获取最近 200 条打卡来计算排名（MVP 简化版）
    const { data, error } = await supabase
        .from("check_ins")
        .select(`
      user_id,
      profiles:user_id (nickname, avatar_url, group_nickname)
    `)
        .order("created_at", { ascending: false })
        .limit(200);

    if (error) throw error;

    // 聚合计数
    const counts: Record<string, { count: number; user: any }> = {};

    data?.forEach((item: any) => {
        if (!item.profiles) return;
        const uid = item.user_id;
        if (!counts[uid]) {
            counts[uid] = { count: 0, user: item.profiles };
        }
        counts[uid].count++;
    });

    // 排序
    const sorted = Object.values(counts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // 取前10

    return sorted;
}
