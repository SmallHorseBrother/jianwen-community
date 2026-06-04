import { supabase } from "../lib/supabase";

export type NotificationKind =
  | "profile_incomplete"
  | "connection_request"
  | "question_answered"
  | "community_answer"
  | "check_in_like"
  | "check_in_comment"
  | "admin_pending";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  actorName?: string;
  unread: boolean;
}

export interface NotificationSummary {
  items: NotificationItem[];
  unreadCount: number;
}

interface ProfileLite {
  id: string;
  nickname: string | null;
  avatar_url?: string | null;
  group_nickname?: string | null;
}

interface FetchNotificationOptions {
  includeProfileReminder?: boolean;
  isAdmin?: boolean;
  limit?: number;
}

const READ_STORAGE_PREFIX = "jw_notifications_read";
const anySupabase = supabase as any;

const getReadStorageKey = (userId: string) => `${READ_STORAGE_PREFIX}_${userId}`;

export const getReadNotificationIds = (userId: string): Set<string> => {
  if (typeof window === "undefined") return new Set();

  try {
    const rawValue = window.localStorage.getItem(getReadStorageKey(userId));
    const parsed = rawValue ? (JSON.parse(rawValue) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
};

const saveReadNotificationIds = (userId: string, ids: Set<string>) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getReadStorageKey(userId), JSON.stringify([...ids]));
};

export const markNotificationRead = (userId: string, notificationId: string) => {
  const ids = getReadNotificationIds(userId);
  ids.add(notificationId);
  saveReadNotificationIds(userId, ids);
};

export const markNotificationsRead = (userId: string, notificationIds: string[]) => {
  const ids = getReadNotificationIds(userId);
  notificationIds.forEach((id) => ids.add(id));
  saveReadNotificationIds(userId, ids);
};

const toSnippet = (value?: string | null, maxLength = 64) => {
  const text = (value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

const formatActorName = (profile?: ProfileLite | null, fallback = "群友") =>
  profile?.group_nickname || profile?.nickname || fallback;

const withReadState = (items: NotificationItem[], readIds: Set<string>) =>
  items.map((item) => ({
    ...item,
    unread: !readIds.has(item.id),
  }));

const fetchProfilesByIds = async (ids: string[]): Promise<Map<string, ProfileLite>> => {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("profiles")
    .select("id,nickname,avatar_url,group_nickname")
    .in("id", uniqueIds);

  if (error) throw error;
  return new Map((data || []).map((profile) => [profile.id, profile as ProfileLite]));
};

const fetchConnectionNotifications = async (userId: string): Promise<NotificationItem[]> => {
  const { data, error } = await anySupabase
    .from("user_connections")
    .select("id,from_user_id,connection_type,status,created_at")
    .eq("to_user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    console.warn("连接请求通知加载失败:", error);
    return [];
  }

  const rows = data || [];
  const profiles = await fetchProfilesByIds(rows.map((row: any) => row.from_user_id));

  return rows.map((row: any) => {
    const profile = profiles.get(row.from_user_id);
    const actorName = formatActorName(profile);
    return {
      id: `connection-${row.id}`,
      kind: "connection_request",
      title: "新的伙伴请求",
      body: `${actorName} 想和你建立社区连接。`,
      href: "/community",
      createdAt: row.created_at,
      actorName,
      unread: true,
    };
  });
};

const fetchQuestionNotifications = async (userId: string): Promise<NotificationItem[]> => {
  const { data: myQuestions, error: questionError } = await supabase
    .from("questions")
    .select("id,content,answer,status,answered_at,updated_at,created_at")
    .eq("asker_id", userId)
    .order("updated_at", { ascending: false })
    .limit(40);

  if (questionError) {
    console.warn("问题通知加载失败:", questionError);
    return [];
  }

  const questionRows = myQuestions || [];
  const answeredItems: NotificationItem[] = questionRows
    .filter((question) => question.status === "published" && question.answer)
    .slice(0, 8)
    .map((question) => ({
      id: `question-answered-${question.id}-${question.answered_at || question.updated_at}`,
      kind: "question_answered",
      title: "你的提问已回复",
      body: toSnippet(question.content, 72),
      href: `/qa/${question.id}`,
      createdAt: question.answered_at || question.updated_at || question.created_at,
      unread: true,
    }));

  const questionIds = questionRows.map((question) => question.id);
  if (questionIds.length === 0) return answeredItems;

  const { data: answers, error: answerError } = await supabase
    .from("community_answers")
    .select("id,question_id,user_id,user_nickname,content,created_at")
    .in("question_id", questionIds)
    .neq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (answerError) {
    console.warn("群友回答通知加载失败:", answerError);
    return answeredItems;
  }

  const questionById = new Map(questionRows.map((question) => [question.id, question]));
  const communityAnswerItems: NotificationItem[] = (answers || []).map((answer) => {
    const question = questionById.get(answer.question_id);
    return {
      id: `community-answer-${answer.id}`,
      kind: "community_answer",
      title: "你的问题有新回答",
      body: `${answer.user_nickname || "群友"}：${toSnippet(answer.content, 60)}`,
      href: `/qa/${answer.question_id}`,
      createdAt: answer.created_at,
      actorName: answer.user_nickname || "群友",
      unread: true,
      ...(question?.content ? { body: `${answer.user_nickname || "群友"} 回复「${toSnippet(question.content, 28)}」` } : {}),
    };
  });

  return [...answeredItems, ...communityAnswerItems];
};

const fetchCheckInNotifications = async (userId: string): Promise<NotificationItem[]> => {
  const { data: checkIns, error: checkInError } = await supabase
    .from("check_ins")
    .select("id,content,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (checkInError) {
    console.warn("打卡通知加载失败:", checkInError);
    return [];
  }

  const checkInRows = checkIns || [];
  const checkInIds = checkInRows.map((checkIn) => checkIn.id);
  if (checkInIds.length === 0) return [];

  const [likesResult, commentsResult] = await Promise.all([
    supabase
      .from("check_in_likes")
      .select("id,check_in_id,user_id,created_at")
      .in("check_in_id", checkInIds)
      .neq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("check_in_comments")
      .select("id,check_in_id,user_id,content,created_at")
      .in("check_in_id", checkInIds)
      .neq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  if (likesResult.error || commentsResult.error) {
    console.warn("打卡互动通知加载失败:", likesResult.error || commentsResult.error);
    return [];
  }

  const actorIds = [
    ...(likesResult.data || []).map((like) => like.user_id),
    ...(commentsResult.data || []).map((comment) => comment.user_id),
  ];
  const profiles = await fetchProfilesByIds(actorIds);
  const checkInById = new Map(checkInRows.map((checkIn) => [checkIn.id, checkIn]));

  const likeItems: NotificationItem[] = (likesResult.data || []).map((like) => {
    const actorName = formatActorName(profiles.get(like.user_id));
    const checkIn = checkInById.get(like.check_in_id);
    return {
      id: `check-in-like-${like.id}`,
      kind: "check_in_like",
      title: "有人点赞了你的打卡",
      body: `${actorName} 点赞了「${toSnippet(checkIn?.content, 36) || "你的打卡"}」`,
      href: `/community?checkIn=${like.check_in_id}`,
      createdAt: like.created_at,
      actorName,
      unread: true,
    };
  });

  const commentItems: NotificationItem[] = (commentsResult.data || []).map((comment) => {
    const actorName = formatActorName(profiles.get(comment.user_id));
    return {
      id: `check-in-comment-${comment.id}`,
      kind: "check_in_comment",
      title: "有人评论了你的打卡",
      body: `${actorName}：${toSnippet(comment.content, 60)}`,
      href: `/community?checkIn=${comment.check_in_id}`,
      createdAt: comment.created_at,
      actorName,
      unread: true,
    };
  });

  return [...likeItems, ...commentItems];
};

const fetchAdminNotifications = async (isAdmin?: boolean): Promise<NotificationItem[]> => {
  if (!isAdmin) return [];

  const { count, error } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (error || !count) return [];

  return [
    {
      id: `admin-pending-questions-${count}`,
      kind: "admin_pending",
      title: "有待处理提问",
      body: `当前还有 ${count} 个问题等待审核或回复。`,
      href: "/admin",
      createdAt: new Date().toISOString(),
      unread: true,
    },
  ];
};

export const fetchNotifications = async (
  userId: string,
  options?: FetchNotificationOptions,
): Promise<NotificationSummary> => {
  const readIds = getReadNotificationIds(userId);

  const [connections, questions, checkIns, adminItems] = await Promise.all([
    fetchConnectionNotifications(userId),
    fetchQuestionNotifications(userId),
    fetchCheckInNotifications(userId),
    fetchAdminNotifications(options?.isAdmin),
  ]);

  const profileReminder: NotificationItem[] = options?.includeProfileReminder
    ? [
        {
          id: `profile-incomplete-${userId}`,
          kind: "profile_incomplete",
          title: "完善社区名片",
          body: "补充群身份、标签和你能提供/正在寻找的内容后，别人更容易找到你。",
          href: "/profile",
          createdAt: new Date().toISOString(),
          unread: true,
        },
      ]
    : [];

  const items = withReadState(
    [...profileReminder, ...connections, ...questions, ...checkIns, ...adminItems],
    readIds,
  )
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, options?.limit || 40);

  return {
    items,
    unreadCount: items.filter((item) => item.unread).length,
  };
};
