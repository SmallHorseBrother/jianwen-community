import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  ChevronRight,
  Heart,
  Loader2,
  MessageCircle,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import {
  fetchNotifications,
  markNotificationRead,
  markNotificationsRead,
  NotificationItem,
  NotificationKind,
} from "../../services/notificationService";

interface NotificationBellProps {
  isAdmin?: boolean;
  includeProfileReminder?: boolean;
}

const iconByKind: Record<NotificationKind, React.ComponentType<{ className?: string }>> = {
  profile_incomplete: ShieldCheck,
  connection_request: UserPlus,
  question_answered: MessageCircle,
  community_answer: MessageCircle,
  check_in_like: Heart,
  check_in_comment: MessageCircle,
  admin_pending: ShieldCheck,
};

const formatTime = (value: string) => {
  const date = new Date(value);
  const diff = (Date.now() - date.getTime()) / 1000;

  if (Number.isNaN(date.getTime())) return "";
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;

  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
};

const NotificationBell: React.FC<NotificationBellProps> = ({
  isAdmin = false,
  includeProfileReminder = false,
}) => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    if (!user?.id || !isAuthenticated) return;

    setLoading(true);
    try {
      const summary = await fetchNotifications(user.id, {
        includeProfileReminder,
        isAdmin,
        limit: 8,
      });
      setItems(summary.items);
      setUnreadCount(summary.unreadCount);
    } catch (error) {
      console.warn("通知加载失败:", error);
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, [user?.id, isAuthenticated, isAdmin, includeProfileReminder, location.pathname]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  if (!isAuthenticated || !user?.id) return null;

  const markAllRead = () => {
    markNotificationsRead(user.id, items.map((item) => item.id));
    setItems((current) => current.map((item) => ({ ...item, unread: false })));
    setUnreadCount(0);
  };

  const handleItemClick = (item: NotificationItem) => {
    markNotificationRead(user.id, item.id);
    setItems((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id ? { ...currentItem, unread: false } : currentItem,
      ),
    );
    setUnreadCount((current) => Math.max(0, current - (item.unread ? 1 : 0)));
    setOpen(false);
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition-all hover:bg-white/10 hover:text-cyan-100"
        aria-label="通知中心"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white ring-2 ring-slate-950">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-cyan-300/15 bg-slate-950/95 shadow-2xl shadow-cyan-950/30 backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-white">通知中心</h2>
              <p className="text-xs text-slate-400">{unreadCount > 0 ? `${unreadCount} 条未读` : "暂无未读"}</p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={items.length === 0 || unreadCount === 0}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="全部标为已读"
            >
              <CheckCheck className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载通知...
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                暂时没有新通知
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {items.map((item) => {
                  const Icon = iconByKind[item.kind];
                  return (
                    <Link
                      key={item.id}
                      to={item.href}
                      onClick={() => handleItemClick(item)}
                      className="flex gap-3 px-4 py-3 transition hover:bg-white/[0.06]"
                    >
                      <div
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          item.unread ? "bg-cyan-300/15 text-cyan-100" : "bg-white/5 text-slate-400"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="line-clamp-1 text-sm font-medium text-white">{item.title}</p>
                          <span className="shrink-0 text-[11px] text-slate-500">{formatTime(item.createdAt)}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{item.body}</p>
                      </div>
                      {item.unread && <span className="mt-2 h-2 w-2 rounded-full bg-cyan-300" />}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1 border-t border-white/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/10"
          >
            查看全部
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
