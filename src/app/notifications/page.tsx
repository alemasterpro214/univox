"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import BottomNav from "@/components/BottomNav";
import { useSocket } from "@/components/SocketProvider";
import { playNotificationSound } from "@/lib/sound";
import { Heart, MessageCircle, UserPlus } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function Notifications() {
  const { t } = useTranslation();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const { socket } = useSocket();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => setNotifications(data));
  }, [status, router]);

  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification: any) => {
      if (!notification) return;
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notification.id)) return prev;
        playNotificationSound();
        return [{ ...notification, id: notification.id || Date.now().toString(), read: false }, ...prev];
      });
    };

    socket.on("new_notification", handleNewNotification);

    return () => {
      socket.off("new_notification", handleNewNotification);
    };
  }, [socket]);

  const getIcon = (type: string) => {
    switch (type) {
      case "like":
        return <Heart size={20} className="text-red-500" />;
      case "comment":
        return <MessageCircle size={20} className="text-blue-500" />;
      case "follow":
        return <UserPlus size={20} className="text-green-500" />;
      case "message":
        return <MessageCircle size={20} className="text-purple-500" />;
      default:
        return <Heart size={20} />;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 lg:pr-16">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center">
          <h1 className="font-semibold text-lg">{t("notifications.title")}</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            <p>{t("notifications.empty")}</p>
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
                src={notification.fromUser?.avatar || "/default-avatar.png"}
                alt={notification.fromUser?.username || "Utente"}
                width={40}
                height={40}
                unoptimized={notification.fromUser?.avatar?.includes("svg") || notification.fromUser?.avatar?.startsWith("/uploads/")}
                className="rounded-full object-cover bg-muted/20"
              />
              <div className="flex-1">
                <p className="text-sm">
                  {notification.fromUser && (
                    <span className="font-semibold mr-1">
                      {notification.fromUser.username}
                    </span>
                  )}
                  {notification.type === "like" && t("notifications.liked")}
                  {notification.type === "comment" && t("notifications.commented")}
                  {notification.type === "follow" && t("notifications.followed")}
                  {notification.type === "message" && t("notifications.sentMessage")}
                </p>
              </div>
              <div>{getIcon(notification.type)}</div>
            </div>
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
}
