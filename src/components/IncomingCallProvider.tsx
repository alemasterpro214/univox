"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSocket } from "@/components/SocketProvider";
import { startRingtone, stopRingtone, isRinging } from "@/lib/call-sound";
import { useTranslation } from "@/lib/i18n";
import { Phone, PhoneOff } from "lucide-react";

interface CallUser {
  id: string;
  username: string;
  avatar: string;
}

export interface IncomingCallData {
  id: string;
  conversationId: string;
  callerId: string;
  type: "audio" | "video";
  status: string;
  caller: CallUser;
}

interface IncomingCallContextType {
  incomingCall: IncomingCallData | null;
  clearIncomingCall: () => void;
}

const IncomingCallContext = createContext<IncomingCallContextType>({
  incomingCall: null,
  clearIncomingCall: () => {},
});

export function IncomingCallProvider({ children }: { children: React.ReactNode }) {
  const { socket } = useSocket();
  const router = useRouter();
  const { t } = useTranslation();
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);

  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data: { call: IncomingCallData }) => {
      if (!data?.call) return;
      setIncomingCall(data.call);
      if (!isRinging()) {
        startRingtone();
      }
    };

    const handleCallEnded = () => {
      stopRingtone();
      setIncomingCall(null);
    };

    socket.on("call:incoming", handleIncomingCall);
    socket.on("call:ended", handleCallEnded);
    socket.on("call:declined", handleCallEnded);

    return () => {
      socket.off("call:incoming", handleIncomingCall);
      socket.off("call:ended", handleCallEnded);
      socket.off("call:declined", handleCallEnded);
      stopRingtone();
    };
  }, [socket]);

  const clearIncomingCall = useCallback(() => {
    stopRingtone();
    setIncomingCall(null);
  }, []);

  const acceptCall = useCallback(() => {
    if (!incomingCall) return;
    stopRingtone();
    router.push(`/messages/${incomingCall.conversationId}?call=${incomingCall.id}`);
    setIncomingCall(null);
  }, [incomingCall, router]);

  const declineCall = useCallback(() => {
    if (!incomingCall) return;
    stopRingtone();
    socket?.emit("call:decline", { callId: incomingCall.id });
    setIncomingCall(null);
  }, [incomingCall, socket]);

  return (
    <IncomingCallContext.Provider value={{ incomingCall, clearIncomingCall }}>
      {children}
      {incomingCall && (
        <div className="fixed top-4 right-4 z-[110] w-80 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-2xl p-4 animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Image
                src={incomingCall.caller.avatar || "/default-avatar.png"}
                alt={incomingCall.caller.username}
                width={48}
                height={48}
                className="rounded-full object-cover bg-muted/20"
              />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-card animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">
                {incomingCall.caller.username}
              </p>
              <p className="text-xs text-muted truncate">
                {t("call.incomingCall")}
              </p>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={declineCall}
              className="flex-1 py-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 font-medium text-sm transition flex items-center justify-center gap-2"
            >
              <PhoneOff size={18} />
              {t("call.decline")}
            </button>
            <button
              onClick={acceptCall}
              className="flex-1 py-2 rounded-xl bg-green-500/10 text-green-500 hover:bg-green-500/20 font-medium text-sm transition flex items-center justify-center gap-2"
            >
              <Phone size={18} />
              {t("call.accept")}
            </button>
          </div>
        </div>
      )}
    </IncomingCallContext.Provider>
  );
}

export function useIncomingCall() {
  return useContext(IncomingCallContext);
}
