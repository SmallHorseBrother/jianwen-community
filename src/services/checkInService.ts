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
        reply_to_profile?: Database["public"]["Tables"]["profiles"]["Row"] | null;
    };

export type CheckInLike =
    & Database["public"]["Tables"]["check_in_likes"]["Row"]
    & {
        profiles?: Database["public"]["Tables"]["profiles"]["Row"];
    };

export interface UserCheckInStats {
    totalCount: number;
    currentStreak: number;
    longestStreak: number;
    monthCount: number;
}

type LeaderboardProfile = Pick<
    Database["public"]["Tables"]["profiles"]["Row"],
    "nickname" | "avatar_url" | "group_nickname"
>;

type LeaderboardRow = {
    user_id: string;
    profiles: LeaderboardProfile | null;
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
 * 编辑自己的打卡内容。
 */
export async function updateCheckIn(
    checkInId: string,
    userId: string,
    content: string,
) {
    const { data, error } = await supabase
        .from("check_ins")
        .update({
            content,
            updated_at: new Date().toISOString(),
        })
        .eq("id", checkInId)
        .eq("user_id", userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * 删除自己的打卡。
 */
export async function deleteCheckIn(checkInId: string, userId: string) {
    const { error } = await supabase
        .from("check_ins")
        .delete()
        .eq("id", checkInId)
        .eq("user_id", userId);

    if (error) throw error;
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

    return hydrateCommentReplyProfiles(data || []);
}

/**
 * 根据通知或分享链接定位单条打卡。
 */
export async function getCheckInById(checkInId: string) {
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
        .eq("id", checkInId)
        .single();

    if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
    }

    const [hydrated] = await hydrateCommentReplyProfiles([data]);
    return hydrated;
}

/**
 * 获取用户打卡统计，用于分享图和个人成长展示。
 */
export async function getUserCheckInStats(userId: string): Promise<UserCheckInStats> {
    const { data, error, count } = await supabase
        .from("check_ins")
        .select("created_at", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) throw error;

    const dateKeys = Array.from(new Set((data || []).map((item) => toChinaDateKey(item.created_at)))).sort();
    const todayKey = toChinaDateKey(new Date().toISOString());
    const monthPrefix = todayKey.slice(0, 7);

    return {
        totalCount: count || data?.length || 0,
        currentStreak: calculateCurrentStreak(dateKeys, todayKey),
        longestStreak: calculateLongestStreak(dateKeys),
        monthCount: dateKeys.filter((key) => key.startsWith(monthPrefix)).length,
    };
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
    replyTo?: { commentId: string; userId: string } | null,
) {
    const insertPayload = {
        check_in_id: checkInId,
        user_id: userId,
        content,
        parent_comment_id: replyTo?.commentId ?? null,
        reply_to_user_id: replyTo?.userId ?? null,
    };

    const { data, error } = await supabase
        .from("check_in_comments")
        .insert(insertPayload)
        .select(`
      *,
      profiles:user_id (*)
    `)
        .single();

    if (error && isMissingReplyColumnError(error)) {
        const { data: fallbackData, error: fallbackError } = await supabase
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

        if (fallbackError) throw fallbackError;
        return fallbackData;
    }

    if (error) throw error;
    return data;
}

function isMissingReplyColumnError(error: { message?: string; code?: string }) {
    const message = error.message || "";
    return (
        error.code === "PGRST204" ||
        message.includes("parent_comment_id") ||
        message.includes("reply_to_user_id")
    );
}

async function hydrateCommentReplyProfiles<T extends CheckIn>(checkIns: T[]): Promise<T[]> {
    const replyUserIds = new Set<string>();

    checkIns.forEach((checkIn) => {
        checkIn.comments?.forEach((comment) => {
            if (comment.reply_to_user_id) replyUserIds.add(comment.reply_to_user_id);
        });
    });

    if (replyUserIds.size === 0) return checkIns;

    const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .in("id", Array.from(replyUserIds));

    if (error) {
        console.warn("回复用户资料加载失败:", error);
        return checkIns;
    }

    const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));

    return checkIns.map((checkIn) => ({
        ...checkIn,
        comments: checkIn.comments?.map((comment) => ({
            ...comment,
            reply_to_profile: comment.reply_to_user_id ? profilesById.get(comment.reply_to_user_id) || null : null,
        })),
    }));
}

function toChinaDateKey(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

function addDays(dateKey: string, days: number) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function calculateCurrentStreak(sortedDateKeys: string[], todayKey: string) {
    const dates = new Set(sortedDateKeys);
    const startKey = dates.has(todayKey) ? todayKey : addDays(todayKey, -1);
    if (!dates.has(startKey)) return 0;

    let streak = 0;
    let cursor = startKey;
    while (dates.has(cursor)) {
        streak += 1;
        cursor = addDays(cursor, -1);
    }
    return streak;
}

function calculateLongestStreak(sortedDateKeys: string[]) {
    let longest = 0;
    let current = 0;
    let previous: string | null = null;

    for (const key of sortedDateKeys) {
        current = previous && addDays(previous, 1) === key ? current + 1 : 1;
        longest = Math.max(longest, current);
        previous = key;
    }

    return longest;
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
    const counts: Record<string, { count: number; user: LeaderboardProfile }> = {};

    (data as LeaderboardRow[] | null)?.forEach((item) => {
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
