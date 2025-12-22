/**
 * 头像上传服务
 * 处理用户头像的上传和更新
 */

import { supabase } from "../lib/supabase";

const AVATAR_BUCKET = "check-in-images"; // 复用打卡图片的 bucket

/**
 * 上传头像
 * @param file 图片文件
 * @param userId 用户ID
 * @returns 公开访问URL
 */
export async function uploadAvatar(
    file: File,
    userId: string,
): Promise<string | null> {
    try {
        // 1. 验证文件类型
        if (!file.type.startsWith("image/")) {
            throw new Error("只能上传图片文件");
        }

        // 2. 验证文件大小 (限制 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            throw new Error("图片大小不能超过 5MB");
        }

        // 3. 生成唯一文件名
        const fileExt = file.name.split(".").pop();
        const fileName = `avatars/${userId}_${Date.now()}.${fileExt}`;

        // 4. 上传到 Storage
        const { error: uploadError } = await supabase.storage
            .from(AVATAR_BUCKET)
            .upload(fileName, file, {
                cacheControl: "3600",
                upsert: true, // 允许覆盖
            });

        if (uploadError) {
            console.error("上传头像失败:", uploadError);
            throw uploadError;
        }

        // 5. 获取公开链接
        const { data } = supabase.storage
            .from(AVATAR_BUCKET)
            .getPublicUrl(fileName);

        return data.publicUrl;
    } catch (error: any) {
        console.error("Upload avatar error:", error);
        alert(error.message || "上传失败，请重试");
        return null;
    }
}

/**
 * 更新用户头像 URL 到数据库
 * @param userId 用户ID
 * @param avatarUrl 头像URL
 */
export async function updateUserAvatar(userId: string, avatarUrl: string) {
    const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", userId);

    if (error) throw error;
}
