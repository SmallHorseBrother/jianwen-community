import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  Heart,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { checkIsAdmin } from "../services/questionService";
import {
  fetchNotifications,
  markNotificationRead,
  markNotificationsRead,
  NotificationItem,
  NotificationKind,
} from "../services/notificationService";

type NotificationFilter = "all" | "unread" | "qa" | "community" | "admin";

const iconByKind: Record<NotificationKind, React.ComponentType<{ className?: string }>> = {
  profile_incomplete: ShieldCheck,
  connection_request: UserPlus,
  question_answered: MessageCircle,
  community_answer: MessageCircle,
  check_in_like: Heart,
  check_in_comment: MessageCircle,
  admin_pending: ShieldCheck,
};

const filterOptions: Array<{ value: NotificationFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "unread", label: "未读" },
  { value: "qa", label: "问答" },
  { value: "community", label: "社区" },
  { value: "admin", label: "管理" },
];

const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isQaNotification = (kind: NotificationKind) =>
  kind === "question_answered" || kind === "community_answer";

const isCommunityNotification = (kind: NotificationKind) =>
  kind === "connection_request" || kind === "check_in_like" || kind === "check_in_comment";

const Notifications: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");

  const isProfileIncomplete = user
    ? ((!user.groupIdentity && !user.profession) ||
      ((!user.specialties || user.specialties.length === 0) &&
        (!user.fitnessInterests || user.fitnessInterests.length === 0) &&
        (!user.learningInterests || user.learningInterests.length === 0)))
    : false;

  const loadNotifications = async (mode: "initial" | "refresh" = "initial") => {
    if (!user?.id) return;

    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);

    try {
      const adminStatus = await checkIsAdmin(user.id);
      setIsAdmin(adminStatus);
      const summary = await fetchNotifications(user.id, {
        isAdmin: adminStatus,
        includeProfileReminder: isProfileIncomplete,
        limit: 80,
      });
      setItems(summary.items);
    } catch (error) {
      console.warn("通知中心加载失败:", error);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, [user?.id]);

  const unreadCount = items.filter((item) => item.unread).length;

  const filteredItems = useMemo(() => {
    if (activeFilter === "unread") return items.filter((item) => item.unread);
    if (activeFilter === "qa") return items.filter((item) => isQaNotification(item.kind));
    if (activeFilter === "community") return items.filter((item) => isCommunityNotification(item.kind));
    if (activeFilter === "admin") return items.filter((item) => item.kind === "admin_pending");
    return items;
  }, [activeFilter, items]);

  const markAllRead = () => {
    if (!user?.id) return;
    markNotificationsRead(user.id, items.map((item) => item.id));
    setItems((current) => current.map((item) => ({ ...item, unread: false })));
  };

  const handleItemClick = (item: NotificationItem) => {
    if (!user?.id) return;
    markNotificationRead(user.id, item.id);
    setItems((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id ? { ...currentItem, unread: false } : currentItem,
      ),
    );
  };

  return (
    <div className="min-h-screen space-y-6 pb-12 text-slate-100">
      <section className="rounded-2xl border border-cyan-300/10 bg-white/[0.04] px-5 py-6 shadow-2xl shadow-cyan-950/20 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-sm font-semibold text-cyan-100">
              <Bell className="h-4 w-4" />
              消息与通知
            </div>
            <h1 className="text-2xl font-black text-white sm:text-3xl">通知中心</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              汇总问答回复、群友互动、伙伴请求、打卡评论点赞和管理待办。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadNotifications("refresh")}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              刷新
            </button>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-300/15 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCheck className="h-4 w-4" />
              全部已读
            </button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] p-1">
          {filterOptions
            .filter((option) => option.value !== "admin" || isAdmin)
            .map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setActiveFilter(option.value)}
                className={`min-w-fit rounded-xl px-4 py-2 text-sm font-medium transition ${
                  activeFilter === option.value
                    ? "bg-cyan-300/15 text-cyan-100"
                    : "text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
        </div>
        <div className="text-sm text-slate-400">
          {unreadCount > 0 ? `${unreadCount} 条未读` : "没有未读通知"}
        </div>
      </section>

      <section>
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            正在加载通知...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-16 text-center">
            <Bell className="mx-auto mb-4 h-10 w-10 text-slate-500" />
            <h2 className="text-lg font-semibold text-white">这里暂时很安静</h2>
            <p className="mt-2 text-sm text-slate-400">有新的问答、互动或请求时，会出现在这里。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const Icon = iconByKind[item.kind];
              return (
                <Link
                  key={item.id}
                  to={item.href}
                  onClick={() => handleItemClick(item)}
                  className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/20 hover:bg-white/[0.07]"
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      item.unread ? "bg-cyan-300/15 text-cyan-100" : "bg-white/5 text-slate-400"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <h2 className="text-sm font-semibold text-white sm:text-base">{item.title}</h2>
                      <span className="text-xs text-slate-500">{formatTime(item.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
                  </div>
                  {item.unread && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-300" />}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default Notifications;
