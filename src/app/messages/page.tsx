"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { Heart, MessageCircle, UserPlus, UserCheck, UserX, Bell, Plus, Users, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function Messages() {
  const { t } = useTranslation();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"chat" | "requests">("chat");
  const [conversations, setConversations] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [followRequests, setFollowRequests] = useState<any[]>([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
    if (status === "authenticated") {
      loadConversations();
      loadNotifications();
      loadFollowRequests();
    }
  }, [status, router]);

  const loadConversations = () => {
    fetch("/api/messages")
      .then((res) => res.json())
      .then((data) => setConversations(Array.isArray(data) ? data : []));
  };

  const loadNotifications = () => {
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => setNotifications(Array.isArray(data) ? data : []));
  };

  const loadFollowRequests = () => {
    fetch("/api/follow-requests")
      .then((res) => res.json())
      .then((data) => setFollowRequests(Array.isArray(data) ? data : []));
  };

  const markNotificationsAsRead = async () => {
    try {
      const res = await fetch("/api/notifications", { method: "PATCH" });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read: true }))
        );
      }
    } catch (error) {
      console.error("Mark notifications as read error:", error);
    }
  };

  const handleFollowRequest = async (id: string, status: "accepted" | "rejected") => {
    const res = await fetch(`/api/follow-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      loadFollowRequests();
    }
  };

  const loadAvailableUsers = () => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setAvailableUsers(Array.isArray(data) ? data : []));
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const createGroup = async () => {
    if (selectedUsers.length < 2 || creatingGroup) return;
    setCreatingGroup(true);
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: selectedUsers, name: groupName.trim() || undefined }),
    });
    if (res.ok) {
      const data = await res.json();
      setShowGroupModal(false);
      setGroupName("");
      setSelectedUsers([]);
      router.push(`/messages/${data.id}`);
    }
    setCreatingGroup(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "like":
        return <Heart size={20} className="text-red-500" />;
      case "comment":
        return <MessageCircle size={20} className="text-blue-500" />;
      case "follow":
      case "follow_request":
        return <UserPlus size={20} className="text-green-500" />;
      case "follow_accepted":
        return <UserCheck size={20} className="text-green-500" />;
      case "share":
        return <MessageCircle size={20} className="text-purple-500" />;
      default:
        return <Bell size={20} className="text-zinc-400" />;
    }
  };

  const getNotificationText = (notification: any) => {      switch (notification.type) {
      case "like":
        return t("notifications.liked");
      case "comment":
        return t("notifications.commented");
      case "follow":
        return t("notifications.followed");
      case "follow_request":
        return t("messages.wantsToFollow");
      case "follow_accepted":
        return t("notifications.followed");
      case "share":
        return t("notifications.liked");
      default:
        return t("notifications.liked");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 lg:pr-16">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-semibold text-lg">{t("messages.title")}</h1>
          <button
            onClick={() => {
              setShowGroupModal(true);
              loadAvailableUsers();
            }}
            className="p-2 rounded-full hover:bg-accent/10 transition"
            aria-label={t("messages.createGroup")}
          >
            <Plus size={20} className="text-accent" />
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto flex border-b border-border">          <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-3 text-sm font-semibold transition ${
            activeTab === "chat"
              ? "text-accent border-b-2 border-accent"
              : "text-muted hover:text-foreground"
          }`}
        >
          {t("messages.tabChat")}
          {conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0) > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs bg-accent text-accent-foreground rounded-full">
              {conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab("requests");
            if (notifications.some((n) => !n.read)) {
              markNotificationsAsRead();
            }
          }}
          className={`flex-1 py-3 text-sm font-semibold transition ${
            activeTab === "requests"
              ? "text-accent border-b-2 border-accent"
              : "text-muted hover:text-foreground"
          }`}
        >
          {t("messages.tabRequests")}
          {activeTab !== "requests" &&
            (followRequests.length > 0 || notifications.some((n) => !n.read)) && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs bg-accent text-accent-foreground rounded-full">
                {followRequests.length + notifications.filter((n) => !n.read).length}
              </span>
            )}
        </button>
      </div>

      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl border border-border w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-lg">{t("messages.createGroup")}</h2>
              <button
                onClick={() => {
                  setShowGroupModal(false);
                  setSelectedUsers([]);
                  setGroupName("");
                }}
                className="p-2 rounded-full hover:bg-accent/10 transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={t("messages.groupName")}
                className="w-full bg-background text-foreground rounded-xl px-4 py-3 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted"
              />
              <p className="text-sm text-muted">{t("messages.selectUsers")}</p>
              <div className="space-y-2">
                {availableUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => toggleUserSelection(user.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ${
                      selectedUsers.includes(user.id)
                        ? "border-accent bg-accent/10"
                        : "border-border hover:border-accent/50"
                    }`}
                  >
                    <Image
                      src={user.avatar || "/default-avatar.png"}
                      alt={user.username}
                      width={36}
                      height={36}
                      className="rounded-full object-cover bg-muted/20"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{user.username}</p>
                    </div>
                    {selectedUsers.includes(user.id) && (
                      <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                        <Users size={12} className="text-accent-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-border">
              <button
                onClick={createGroup}
                disabled={selectedUsers.length < 2 || creatingGroup}
                className="w-full py-3 rounded-xl bg-accent text-accent-foreground font-semibold disabled:opacity-50 transition"
              >
                {creatingGroup ? t("messages.creating") : t("messages.createGroupBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-md mx-auto">
        {activeTab === "chat" ? (
          conversations.length === 0 ? (
          <div className="p-8 text-center text-muted">
            <p>{t("messages.emptyChat")}</p>
            <p className="text-sm mt-2">{t("messages.startConversation")}</p>
          </div>
          ) : (
            conversations.map((conversation) => {
              const isGroup = conversation.type === "group";
              const otherUser = conversation.members.find(
                (m: any) => m.user.id !== session?.user?.id
              )?.user;
              const lastMessage = conversation.messages[0];
              const displayName = isGroup
                ? conversation.name || t("messages.createGroup")
                : otherUser?.username;
              const displayAvatar = isGroup
                ? "/default-avatar.png"
                : otherUser?.avatar || "/default-avatar.png";

              return (
                <Link
                  key={conversation.id}
                  href={`/messages/${conversation.id}`}
                  className="flex items-center gap-4 p-4 border-b border-border hover:bg-muted/10 transition"
                >
                  <Image
                    src={displayAvatar}
                    alt={displayName}
                    width={48}
                    height={48}
                    unoptimized={displayAvatar?.includes("svg") || displayAvatar?.startsWith("/uploads/")}
                    className="rounded-full object-cover bg-muted/20"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{displayName}</p>
                    <p className="text-sm text-muted truncate">
                      {lastMessage?.sender?.username && (
                        <span className="font-medium mr-1">
                          {lastMessage.sender.username}:
                        </span>
                      )}
                      {lastMessage?.content || t("messages.noMessages")}
                    </p>
                  </div>
                  {conversation.unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs bg-accent text-accent-foreground rounded-full">
                      {conversation.unreadCount}
                    </span>
                  )}
                </Link>
              );
            })
          )
        ) : (
          <div>
            <h2 className="px-4 py-3 text-sm font-bold text-muted uppercase tracking-wider">
              {t("messages.followRequests")}
            </h2>
            {followRequests.length === 0 ? (
          <div className="p-8 text-center text-muted">
            <p>{t("messages.emptyRequests")}</p>
          </div>
            ) : (
              followRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center gap-4 p-4 border-b border-border"
                >
                  <Image
                    src={request.follower.avatar || "/default-avatar.png"}
                    alt={request.follower.username}
                    width={48}
                    height={48}
                    className="rounded-full object-cover bg-muted/20"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{request.follower.username}</p>
                    <p className="text-sm text-muted">{t("messages.wantsToFollow")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleFollowRequest(request.id, "accepted")}
                      className="p-2 rounded-full bg-green-500/20 text-green-500 hover:bg-green-500/30 transition"
                    >
                      <UserCheck size={20} />
                    </button>
                    <button
                      onClick={() => handleFollowRequest(request.id, "rejected")}
                      className="p-2 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500/30 transition"
                    >
                      <UserX size={20} />
                    </button>
                  </div>
                </div>
              ))
            )}

            <h2 className="px-4 py-3 text-sm font-bold text-muted uppercase tracking-wider border-t border-border">
              {t("notifications.title")}
            </h2>
            {notifications.length === 0 ? (
          <div className="p-8 text-center text-muted">
            <p>{t("messages.emptyNotifications")}</p>
          </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
              className={`flex items-center gap-4 p-4 border-b border-border ${
                !notification.read ? "bg-muted/10" : ""
              }`}
                >
                  <Image
                    src={notification.fromUser.avatar || "/default-avatar.png"}
                    alt={notification.fromUser.username}
                    width={40}
                    height={40}
                    className="rounded-full object-cover bg-muted/20"
                  />
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-semibold mr-1">
                        {notification.fromUser.username}
                      </span>
                      {getNotificationText(notification)}
                    </p>
                  </div>
                  <div>{getNotificationIcon(notification.type)}</div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
