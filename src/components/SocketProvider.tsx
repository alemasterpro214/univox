"use client";

import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { createClient, RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { debugLog } from "@/lib/debug";

interface SocketLike {
  emit: (event: string, ...args: unknown[]) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback: (...args: any[]) => void) => void;
}

interface SocketContextType {
  socket: SocketLike | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Supabase URL or anon key not configured. Realtime features disabled.");
    }
    return null;
  }
  return createClient(url, key);
}

function extractRoomFromPayload(event: string, payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;

  const p = payload as Record<string, unknown>;

  if (event.startsWith("call:")) {
    if (typeof p.callId === "string") return `call:${p.callId}`;
  }
  if (event === "typing" || event === "new_message" || event === "message_deleted") {
    if (typeof p.conversationId === "string") return `chat:${p.conversationId}`;
  }
  if (event === "post_liked" || event === "post_commented") {
    if (typeof p.postId === "string") return `post:${p.postId}`;
  }
  if (event === "new_notification") {
    if (typeof p.userId === "string") return `user:${p.userId}`;
  }

  return null;
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<SupabaseClient | null>(null);
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const channelStatusRef = useRef<Map<string, string>>(new Map());
  const listenersRef = useRef<Map<string, Set<(...args: any[]) => void>>>(new Map());

  const updateConnectionState = useCallback(() => {
    const statuses = Array.from(channelStatusRef.current.values());
    const hasSubscribed = statuses.some((s) => s === "SUBSCRIBED");
    setIsConnected(hasSubscribed);
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !session) {
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      debugLog("Supabase client not configured");
      return;
    }
    clientRef.current = client;

    return () => {
      channelsRef.current.forEach((channel) => {
        channel.unsubscribe();
      });
      channelsRef.current.clear();
      channelStatusRef.current.clear();
      clientRef.current = null;
      setIsConnected(false);
    };
  }, [status, session]);

  const joinRoom = useCallback(
    (room: string) => {
      const client = clientRef.current;
      if (!client || channelsRef.current.has(room)) return;

      const channel = client.channel(room);
      channelsRef.current.set(room, channel);
      channelStatusRef.current.set(room, "SUBSCRIBING");
      updateConnectionState();

      channel.on("broadcast", { event: "*" }, (message: { event?: string; payload?: unknown }) => {
        const eventName = message.event;
        if (!eventName) return;
        const callbacks = listenersRef.current.get(eventName);
        if (callbacks) {
          callbacks.forEach((cb) => {
            try {
              cb(message.payload);
            } catch (err) {
              console.error("Realtime listener error:", err);
            }
          });
        }
      });

      channel.subscribe((subscriptionStatus) => {
        channelStatusRef.current.set(room, subscriptionStatus);
        updateConnectionState();
        if (subscriptionStatus === "SUBSCRIBED") {
          debugLog(`Joined room: ${room}`);
        }
      });
    },
    [updateConnectionState]
  );

  const leaveRoom = useCallback(
    (room: string) => {
      const channel = channelsRef.current.get(room);
      if (channel) {
        channel.unsubscribe();
        channelsRef.current.delete(room);
        channelStatusRef.current.delete(room);
        updateConnectionState();
      }
    },
    [updateConnectionState]
  );

  const socket = useMemo<SocketLike>(() => {
    return {
      emit: (event: string, ...args: unknown[]) => {
        if (event === "join_room") {
          const room = args[0] as string;
          if (typeof room === "string") joinRoom(room);
          return;
        }
        if (event === "leave_room") {
          const room = args[0] as string;
          if (typeof room === "string") leaveRoom(room);
          return;
        }

        const payload = args[0];
        const rooms = Array.from(channelsRef.current.keys());
        let targetRooms = rooms;

        const specificRoom = extractRoomFromPayload(event, payload);
        if (specificRoom && channelsRef.current.has(specificRoom)) {
          targetRooms = [specificRoom];
        } else {
          const prefix = event.startsWith("call:")
            ? "call:"
            : event === "typing" || event === "new_message" || event === "message_deleted"
            ? "chat:"
            : event === "post_liked" || event === "post_commented"
            ? "post:"
            : event === "new_notification"
            ? "user:"
            : null;

          if (prefix) {
            const matching = rooms.filter((r) => r.startsWith(prefix));
            if (matching.length > 0) targetRooms = matching;
          }
        }

        targetRooms.forEach((room) => {
          const channel = channelsRef.current.get(room);
          if (channel) {
            channel.send({ type: "broadcast", event, payload }).catch((err) => {
              console.error("Realtime send error:", err);
            });
          }
        });
      },
      on: (event: string, callback: (...args: any[]) => void) => {
        const set = listenersRef.current.get(event) || new Set();
        set.add(callback);
        listenersRef.current.set(event, set);
      },
      off: (event: string, callback: (...args: any[]) => void) => {
        const set = listenersRef.current.get(event);
        if (set) {
          set.delete(callback);
          if (set.size === 0) {
            listenersRef.current.delete(event);
          }
        }
      },
    };
  }, [joinRoom, leaveRoom]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
