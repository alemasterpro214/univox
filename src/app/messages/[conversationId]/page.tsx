"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSocket } from "@/components/SocketProvider";
import { playNotificationSound } from "@/lib/sound";
import {
  ArrowLeft,
  Send,
  Trash2,
  Reply,
  X,
  Users,
  MoreVertical,
  ImageIcon,
  Mic,
  Play,
  Pause,
  Phone,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useIncomingCallFromUrl } from "@/lib/hooks/useIncomingCallFromUrl";

const GifPicker = dynamic(() => import("@/components/GifPicker"), { ssr: false });
const CallModal = dynamic(() => import("@/components/CallModal"), { ssr: false });
import type { CallData } from "@/components/CallModal";

interface Message {
  id: string;
  senderId: string;
  content: string;
  type: string;
  createdAt: string;
  isDeletedForAll: boolean;
  replyToId: string | null;
  sender: {
    id: string;
    username: string;
    avatar: string;
  };
  replyTo?: {
    id: string;
    content: string;
    sender: {
      id: string;
      username: string;
    };
  } | null;
}

interface ConversationData {
  id: string;
  type: string;
  name: string | null;
  members: {
    user: {
      id: string;
      username: string;
      avatar: string;
      status?: string;
      lastActiveAt?: string;
      activeConversationId?: string | null;
    };
  }[];
  messages: Message[];
}

export default function Conversation() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation();
  const params = useParams();
  const conversationId = params.conversationId as string;
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [swipedMessageId, setSwipedMessageId] = useState<string | null>(null);
  const [menuMessageId, setMenuMessageId] = useState<string | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [incomingCall, setIncomingCall] = useState<CallData | null>(null);
  const [barHeights] = useState<number[]>(() =>
    Array.from({ length: 20 }, () => Math.random() * 24 + 4)
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocket();
  const touchStartX = useRef<Record<string, number>>({});
  const touchStartY = useRef<Record<string, number>>({});
  const swipeOffsets = useRef<Record<string, number>>({});
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // --- Audio recording state ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingCanceled, setRecordingCanceled] = useState(false);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isCancelingRef = useRef(false);
  const recordingReadyRef = useRef(false);
  const pendingStopRef = useRef(false);
  // Stable waveform bar heights (generated once on mount)

  // --- Audio playback state ---
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  // --- Heartbeat for lastActiveAt and active conversation ---
  useEffect(() => {
    if (status !== "authenticated") return;
    const body = JSON.stringify({ conversationId });
    fetch("/api/users/me/heartbeat", { method: "POST", body }).catch(() => {});
    const interval = setInterval(() => {
      fetch("/api/users/me/heartbeat", { method: "POST", body }).catch(() => {});
    }, 60000);
    return () => {
      clearInterval(interval);
      // Clear active conversation when leaving the chat
      fetch("/api/users/me/heartbeat", {
        method: "POST",
        body: JSON.stringify({ conversationId: null }),
      }).catch(() => {});
    };
  }, [status, conversationId]);

  useIncomingCallFromUrl(conversationId, setIncomingCall);

  const loadConversation = useCallback(async () => {
    setLoading(true);
    setError(false);
    const res = await fetch(`/api/messages?conversationId=${conversationId}`);
    if (res.ok) {
      const data = await res.json();
      if (!data) {
        setError(true);
        setLoading(false);
        return;
      }
      setConversation(data);
      setMessages(data?.messages || []);
    } else {
      setError(true);
    }
    setLoading(false);
  }, [conversationId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
    if (status === "authenticated" && conversationId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadConversation();
    }
  }, [status, router, conversationId, loadConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket || !conversationId) return;

    const room = `chat:${conversationId}`;
    socket.emit("join_room", room);

    const handleNewMessage = (message: Message) => {
      if (!message) return;
      const isFromOther = message.senderId !== session?.user?.id;
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      if (isFromOther) {
        playNotificationSound();
      }
    };

    const handleMessageDeleted = (data: { messageId: string; forAll: boolean }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId ? { ...m, isDeletedForAll: true } : m
        )
      );
    };

    socket.on("new_message", handleNewMessage);
    socket.on("message_deleted", handleMessageDeleted);

    const handleIncomingCall = (data: { call: CallData }) => {
      if (data?.call?.conversationId === conversationId) {
        setIncomingCall(data.call);
      }
    };
    socket.on("call:incoming", handleIncomingCall);

    return () => {
      socket.emit("leave_room", room);
      socket.off("new_message", handleNewMessage);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("call:incoming", handleIncomingCall);
    };
  }, [socket, conversationId, session?.user?.id]);

  const sendGif = async (gifUrl: string) => {
    if (!conversation) return;
    const otherUser = conversation.members.find(
      (m) => m.user.id !== session?.user?.id
    )?.user;
    if (!otherUser) return;

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: otherUser?.id,
        content: gifUrl,
        type: "gif",
        replyToId: replyingTo?.id,
      }),
    });

    if (res.ok) {
      const savedMessage = await res.json();
      setReplyingTo(null);
      setShowGifPicker(false);
      setMessages((prev) =>
        prev.some((m) => m.id === savedMessage.id)
          ? prev
          : [...prev, savedMessage]
      );
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversation) return;

    const otherUser = conversation.members.find(
      (m) => m.user.id !== session?.user?.id
    )?.user;

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: otherUser?.id,
        content: newMessage,
        replyToId: replyingTo?.id,
      }),
    });

    if (res.ok) {
      const savedMessage = await res.json();
      setNewMessage("");
      setReplyingTo(null);
      setMessages((prev) =>
        prev.some((m) => m.id === savedMessage.id)
          ? prev
          : [...prev, savedMessage]
      );
    }
  };

  const deleteMessage = async (messageId: string, forAll: boolean) => {
    const res = await fetch(`/api/messages/${messageId}?forAll=${forAll}`, {
      method: "DELETE",
    });
    if (res.ok) {
      if (forAll) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, isDeletedForAll: true } : m
          )
        );
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
      setMenuMessageId(null);
    }
  };

  // --- Swipe to reply with animation ---
  const handleTouchStart = (messageId: string, e: React.TouchEvent) => {
    touchStartX.current[messageId] = e.touches[0].clientX;
    touchStartY.current[messageId] = e.touches[0].clientY;
    swipeOffsets.current[messageId] = 0;
  };

  const handleTouchMove = (messageId: string, e: React.TouchEvent) => {
    if (touchStartX.current[messageId] === undefined) return;
    const diffX = e.touches[0].clientX - touchStartX.current[messageId];
    const diffY = e.touches[0].clientY - (touchStartY.current[messageId] || 0);
    // Ignore vertical scroll
    if (Math.abs(diffY) > Math.abs(diffX)) return;

    // Clamp the swipe offset between -80 and 0
    const offset = Math.max(-80, Math.min(0, diffX));
    swipeOffsets.current[messageId] = offset;

    // Apply transform directly to the DOM element for smooth animation
    const el = messageRefs.current[messageId];
    if (el) {
      el.style.transform = `translateX(${offset}px)`;
      el.style.transition = offset < -5 ? "none" : "transform 0.2s ease-out";
    }

    if (offset <= -60) {
      setSwipedMessageId(messageId);
    } else {
      setSwipedMessageId(null);
    }
  };

  const handleTouchEnd = (messageId: string) => {
    // Reset the visual position with animation
    const el = messageRefs.current[messageId];
    if (el) {
      el.style.transform = "translateX(0)";
      el.style.transition = "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)";
    }

    delete touchStartX.current[messageId];
    delete touchStartY.current[messageId];

    const wasSwiped = swipeOffsets.current[messageId] !== undefined && swipeOffsets.current[messageId] <= -60;
    delete swipeOffsets.current[messageId];

    if (wasSwiped) {
      const message = messages.find((m) => m.id === messageId);
      if (message) {
        setReplyingTo(message);
      }
    }
    setSwipedMessageId(null);
  };

  // --- Audio recording ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      isCancelingRef.current = false;
      setRecordingCanceled(false);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks on the stream
        stream.getTracks().forEach((track) => track.stop());

        if (isCancelingRef.current || audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await sendAudioMessage(audioBlob);
      };

      mediaRecorder.start();
      recordingReadyRef.current = true;
      setIsRecording(true);
      setRecordingDuration(0);

      // If release happened before recorder was ready, stop now
      if (pendingStopRef.current) {
        pendingStopRef.current = false;
        if (isCancelingRef.current) {
          cancelRecording();
        } else {
          stopRecording();
        }
        return;
      }

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecordingDuration(0);
  };

  const cancelRecording = () => {
    isCancelingRef.current = true;
    setRecordingCanceled(true);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecordingDuration(0);
  };

  const sendAudioMessage = async (audioBlob: Blob) => {
    if (!conversation) return;

    const otherUser = conversation.members.find(
      (m) => m.user.id !== session?.user?.id
    )?.user;
    if (!otherUser) return;

    // Upload audio file
    const formData = new FormData();
    formData.append("file", audioBlob, `audio_${Date.now()}.webm`);

    const uploadRes = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!uploadRes.ok) {
      console.error("Audio upload failed");
      return;
    }

    const { url } = await uploadRes.json();

    // Send as message
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: otherUser.id,
        content: url,
        type: "audio",
        replyToId: replyingTo?.id,
      }),
    });

    if (res.ok) {
      const savedMessage = await res.json();
      setReplyingTo(null);
      setMessages((prev) =>
        prev.some((m) => m.id === savedMessage.id)
          ? prev
          : [...prev, savedMessage]
      );
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const toggleAudioPlayback = (messageId: string, url: string) => {
    if (playingAudioId === messageId) {
      // Pause
      const audio = audioRefs.current[messageId];
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setPlayingAudioId(null);
    } else {
      // Pause any other playing audio
      if (playingAudioId && audioRefs.current[playingAudioId]) {
        audioRefs.current[playingAudioId]?.pause();
        audioRefs.current[playingAudioId]!.currentTime = 0;
      }

      // Play this one
      const audio = new Audio(url);
      audioRefs.current[messageId] = audio;
      audio.onended = () => setPlayingAudioId(null);
      audio.play().catch(() => setPlayingAudioId(null));
      setPlayingAudioId(messageId);
    }
  };

  const isGroup = conversation?.type === "group";
  const currentUserId = session?.user?.id;

  const headerUser = isGroup
    ? null
    : conversation?.members.find((m) => m.user.id !== currentUserId)?.user;

  function getLastActiveDisplay(
    user: { status?: string; lastActiveAt?: string; activeConversationId?: string | null } | undefined
  ): string {
    if (!user) return "";
    const lastActiveAt = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
    // eslint-disable-next-line react-hooks/purity
    const diffMs = Date.now() - lastActiveAt;
    const isOnline = user.status === "ONLINE" && diffMs < 120000;

    if (isOnline) {
      if (user.activeConversationId === conversationId) {
        return t("messages.activeInChat");
      }
      return t("messages.activeOnSocial");
    }

    if (!user.lastActiveAt) return t("messages.lastActiveLongAgo");
    const date = new Date(user.lastActiveAt);
    return t("messages.lastAccess", {
      date: date.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      time: date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  }

  // Handle mic release: if not canceled, stop and send
  const handleMicRelease = () => {
    if (!recordingReadyRef.current) {
      // Recorder not ready yet — queue the stop
      pendingStopRef.current = true;
      return;
    }
    if (!isCancelingRef.current) {
      stopRecording();
    }
  };

  // Check if touch moved to cancel area during recording
  function handleRecordingTouchMove(e: React.TouchEvent) {
    if (!isRecording) return;
    const touch = e.touches[0];
    const screenHeight = window.innerHeight;
    // Swipe up to cancel: if finger is in the top 30% of the screen
    if (touch.clientY < screenHeight * 0.3) {
      isCancelingRef.current = true;
      setRecordingCanceled(true);
    } else {
      isCancelingRef.current = false;
      setRecordingCanceled(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24 lg:pr-16">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center gap-4">
          <Link
            href="/messages"
            className="text-foreground hover:text-accent transition"
          >
            <ArrowLeft size={24} />
          </Link>
          {headerUser ? (
            <div className="flex items-center gap-3 flex-1">
              <Image
                src={headerUser.avatar || "/default-avatar.png"}
                alt={headerUser.username}
                width={36}
                height={36}
                unoptimized={headerUser.avatar?.includes("svg") || headerUser.avatar?.startsWith("/uploads/")}
                className="rounded-full object-cover bg-muted/20"
              />
              <div>
                <p className="font-semibold text-sm">{headerUser.username}</p>
                <p className="text-xs text-muted">{getLastActiveDisplay(headerUser)}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-1">
              <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
                <Users size={20} className="text-accent" />
              </div>
              <div>
                <p className="font-semibold text-sm">
                  {conversation?.name || t("messages.createGroup")}
                </p>
                <p className="text-xs text-muted">
                  {conversation?.members.length || 0} {t("messages.participants")}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={() => setShowCallModal(true)}
            className="p-2 rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition"
            aria-label="Avvia chiamata"
          >
            <Phone size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 min-h-[calc(100vh-140px)]">
        {error ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-zinc-400 mb-4">
              {t("messages.conversationNotFound")}
            </p>
            <button
              onClick={() => router.push("/messages")}
              className="px-6 py-2 rounded-full bg-pink-500 text-white font-semibold hover:bg-pink-600 transition"
            >
              {t("messages.backToMessages")}
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500" />
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isMe = message.senderId === currentUserId;
              return (
                <div key={message.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div
                    ref={(el) => { messageRefs.current[message.id] = el; }}
                    className="relative max-w-[85%]"
                    style={{ transition: "transform 0.2s ease-out" }}
                    onTouchStart={(e) => handleTouchStart(message.id, e)}
                    onTouchMove={(e) => handleTouchMove(message.id, e)}
                    onTouchEnd={() => handleTouchEnd(message.id)}
                  >
                    {swipedMessageId === message.id && (
                      <div className="absolute -left-10 top-1/2 -translate-y-1/2 text-accent transition-all duration-200">
                        <Reply size={20} />
                      </div>
                    )}
                    {(!isMe || isGroup) && (
                      <div className="flex items-center gap-2 mb-1">
                        <Image
                          src={message.sender.avatar || "/default-avatar.png"}
                          alt={message.sender.username}
                          width={20}
                          height={20}
                          unoptimized={message.sender.avatar?.includes("svg") || message.sender.avatar?.startsWith("/uploads/")}
                          className="rounded-full object-cover bg-muted/20"
                        />
                        <span className="text-xs font-medium text-muted">
                          {message.sender.username}
                        </span>
                      </div>
                    )}
                    {message.replyTo && (
                      <div className="mb-1 p-2 rounded-lg bg-accent/10 border-l-2 border-accent">
                        <p className="text-xs font-medium text-accent">
                          {message.replyTo.sender.username}
                        </p>
                        <p className="text-xs text-muted line-clamp-1">
                          {message.replyTo.content}
                        </p>
                      </div>
                    )}
                    <div
                      className={`px-4 py-2 rounded-2xl text-sm relative max-w-xs ${
                        isMe
                          ? "bg-accent text-accent-foreground rounded-br-none"
                          : "bg-card text-foreground rounded-bl-none"
                      }`}
                    >
                      {message.type === "gif" && !message.isDeletedForAll ? (
                        <>
                          <Image
                            src={message.content}
                            alt="GIF"
                            width={240}
                            height={160}
                            unoptimized
                            className="rounded-lg w-full max-w-[240px] h-auto"
                          />
                          <p className="text-[10px] opacity-70 mt-1">
                            {new Date(message.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </>
                      ) : message.type === "audio" && !message.isDeletedForAll ? (
                        <div className="flex items-center gap-3 min-w-[180px]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAudioPlayback(message.id, message.content);
                            }}
                            className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center hover:bg-accent/30 transition shrink-0"
                          >
                            {playingAudioId === message.id ? (
                              <Pause size={18} className="text-accent" />
                            ) : (
                              <Play size={18} className="text-accent" />
                            )}
                          </button>
                          <div className="flex-1 h-1 bg-muted/30 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                playingAudioId === message.id
                                  ? "bg-accent animate-pulse"
                                  : "bg-muted/50"
                              }`}
                              style={{
                                width: playingAudioId === message.id ? "60%" : "40%",
                              }}
                            />
                          </div>
                          <span className="text-[10px] opacity-70 shrink-0">
                            {new Date(message.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      ) : (
                        <p>
                          {message.isDeletedForAll
                            ? t("messages.messageDeleted")
                            : message.content}
                        </p>
                      )}
                      {message.type !== "gif" && message.type !== "audio" && (
                        <p className="text-[10px] opacity-70 mt-1">
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                      {!message.isDeletedForAll && (
                        <button
                          onClick={() =>
                            setMenuMessageId(
                              menuMessageId === message.id ? null : message.id
                            )
                          }
                          className="absolute -top-2 -right-2 p-1 rounded-full bg-card border border-border opacity-70 hover:opacity-100 focus:opacity-100 transition md:opacity-0 md:hover:opacity-100 md:focus:opacity-100"
                          aria-label={t("messages.messageOptions")}
                        >
                          <MoreVertical size={12} />
                        </button>
                      )}
                      {menuMessageId === message.id && (
                        <div className="absolute right-0 top-6 z-50 bg-card border border-border rounded-xl shadow-lg p-2 min-w-[160px]">
                          <button
                            onClick={() => {
                              setReplyingTo(message);
                              setMenuMessageId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-accent/10 transition"
                          >
                            <Reply size={16} />
                            {t("common.reply")}
                          </button>
                          <button
                            onClick={() => deleteMessage(message.id, false)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-accent/10 transition"
                          >
                            <Trash2 size={16} />
                            {t("messages.deleteForMe")}
                          </button>
                          {isMe && (
                            <button
                              onClick={() => deleteMessage(message.id, true)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-red-500 hover:bg-red-500/10 transition"
                            >
                              <Trash2 size={16} />
                              {t("messages.deleteForAll")}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      <form
        onSubmit={isRecording ? (e) => e.preventDefault() : sendMessage}
        className="fixed bottom-0 left-0 right-0 lg:right-16 bg-background/90 backdrop-blur-md border-t border-border p-3"
      >
        <div className="max-w-md mx-auto flex flex-col gap-2">
          {replyingTo && (
            <div className="flex items-center justify-between bg-accent/10 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-accent">
                  {t("messages.replyTo")} {replyingTo.sender.username}
                </p>
                <p className="text-xs text-muted truncate">
                  {replyingTo.content}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="p-1 hover:bg-accent/20 rounded-full transition"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="flex gap-2 relative">
            {showGifPicker && (
              <div className="absolute bottom-full right-0 mb-2 z-50">
                <GifPicker
                  onSelect={sendGif}
                  onClose={() => setShowGifPicker(false)}
                />
              </div>
            )}

            {isRecording ? (
              // --- Recording UI ---
              <div
                className="flex-1 flex items-center gap-3 bg-red-500/10 rounded-full px-4 py-2"
                onTouchMove={handleRecordingTouchMove}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-medium text-red-500">
                    {formatDuration(recordingDuration)}
                  </span>
                </div>
                <div className="flex-1 flex items-center gap-1">
                  {barHeights.map((height, i) => (
                    <div
                      key={i}
                      className="w-1 bg-red-400 rounded-full animate-pulse"
                      style={{
                        height: `${height}px`,
                        animationDelay: `${i * 0.08}s`,
                        opacity: 0.6 + height / 28 * 0.4,
                      }}
                    />
                  ))}
                </div>
                {recordingCanceled ? (
                  <span className="text-xs text-red-500 font-medium">
                    {t("messages.slideToCancel")}
                  </span>
                ) : (
                  <span className="text-xs text-muted">
                    {t("messages.recording")}
                  </span>
                )}
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="p-2 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500/30 transition"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowGifPicker((prev) => !prev)}
                  className="p-3 rounded-full bg-card text-foreground hover:bg-muted/20 border border-border transition"
                  title={t("messages.gif")}
                >
                  <ImageIcon size={20} />
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={t("messages.messageInputPlaceholder")}
                  className="flex-1 bg-card text-foreground rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted"
                />
                {newMessage.trim() ? (
                  <button
                    type="submit"
                    className="p-3 rounded-full bg-pink-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-pink-600 transition"
                  >
                    <Send size={20} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onMouseDown={startRecording}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      startRecording();
                    }}
                    onMouseUp={handleMicRelease}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      handleMicRelease();
                    }}
                    onTouchCancel={cancelRecording}
                    className="p-3 rounded-full bg-card text-foreground hover:bg-muted/20 border border-border transition"
                    title={t("messages.audio")}
                  >
                    <Mic size={20} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </form>

      {(showCallModal || incomingCall) && (
        <CallModal
          conversationId={conversationId}
          members={conversation?.members || []}
          currentUserId={session?.user?.id || ""}
          incomingCall={incomingCall}
          onClose={() => {
            setShowCallModal(false);
            setIncomingCall(null);
          }}
        />
      )}
    </div>
  );
}
