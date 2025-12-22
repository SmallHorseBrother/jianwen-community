/**
 * 解析可能被多次序列化的 groupIdentity 数据
 * 数据库中的 group_identity 可能因为多次保存而被嵌套序列化成 JSON 字符串
 */
export const parseGroupIdentity = (data: any): string[] => {
    if (!data) return [];

    // 如果已经是数组，直接返回有效项
    if (Array.isArray(data)) {
        return data.filter((g) =>
            typeof g === "string" && g.trim() && !g.startsWith("[")
        );
    }

    // 如果是字符串，尝试解析
    if (typeof data === "string") {
        let current = data.trim();

        // 如果不是 JSON 格式，直接作为单个值返回
        if (!current.startsWith("[") && !current.startsWith('"')) {
            return current ? [current] : [];
        }

        // 递归解析嵌套的 JSON 字符串
        let maxIterations = 10; // 防止无限循环
        while (maxIterations > 0) {
            try {
                const parsed = JSON.parse(current);

                if (Array.isArray(parsed)) {
                    // 检查是否是有效的字符串数组
                    const validItems = parsed.filter(
                        (g) =>
                            typeof g === "string" && g.trim() &&
                            !g.startsWith("["),
                    );
                    if (validItems.length > 0) {
                        return validItems;
                    }
                    // 如果数组元素还是嵌套的，继续解析
                    if (parsed.length > 0 && typeof parsed[0] === "string") {
                        current = parsed[0];
                    } else {
                        return [];
                    }
                } else if (typeof parsed === "string") {
                    current = parsed;
                } else {
                    return [];
                }
            } catch {
                // 不是有效的 JSON，作为单个值返回
                return current && !current.includes("[") ? [current] : [];
            }
            maxIterations--;
        }
    }

    return [];
};

/**
 * 将群组数组格式化为显示字符串
 */
export const formatGroupIdentity = (data: any): string => {
    const groups = parseGroupIdentity(data);
    return groups.length > 0 ? groups.join("、") : "";
};

/**
 * 计算用户资料完善度分数
 * 用于排序，分数越高资料越完善
 */
export const calculateProfileCompleteness = (profile: {
    nickname?: string | null;
    bio?: string | null;
    group_identity?: any;
    group_nickname?: string | null;
    tags?: string[] | null;
    skills_offering?: string | null;
    skills_seeking?: string | null;
    wechat_id?: string | null;
    social_links?: any;
    avatar_url?: string | null;
}): number => {
    let score = 0;

    // 基础信息 (权重高)
    if (profile.nickname) score += 10;
    if (profile.bio && profile.bio.length > 0) score += 15;
    if (profile.avatar_url) score += 10;

    // 群组信息
    const groups = parseGroupIdentity(profile.group_identity);
    if (groups.length > 0) score += 15;
    if (profile.group_nickname) score += 5;

    // 社交名片核心信息 (权重高)
    if (profile.tags && profile.tags.length > 0) {
        score += 10 + Math.min(profile.tags.length * 2, 10);
    }
    if (profile.skills_offering && profile.skills_offering.length > 0) {
        score += 15;
    }
    if (profile.skills_seeking && profile.skills_seeking.length > 0) {
        score += 10;
    }

    // 联系方式
    if (profile.wechat_id) score += 10;

    // 社交链接
    const links = profile.social_links;
    if (links && typeof links === "object") {
        const linkCount = Object.values(links).filter((v) =>
            v && String(v).trim()
        ).length;
        score += Math.min(linkCount * 5, 15);
    }

    return score;
};
