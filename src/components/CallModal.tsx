"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useSocket } from "@/components/SocketProvider";
import { useMediaDevices } from "@/lib/useMediaDevices";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Users,
  X,
} from "lucide-react";

interface CallUser {
  id: string;
  username: string;
  avatar: string;
}

export interface CallData {
  id: string;
  conversationId: string;
  callerId: string;
  type: "audio" | "video";
  status: string;
  caller: CallUser;
  participants: CallParticipant[];
}

type CallParticipant = {
  userId: string;
  status: string;
  user: CallUser;
};

interface Member {
  user: CallUser;
}

interface CallModalProps {
  conversationId: string;
  members: Member[];
  currentUserId: string;
  incomingCall?: CallData | null;
  onClose: () => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export default function CallModal({
  conversationId,
  members,
  currentUserId,
  incomingCall,
  onClose,
}: CallModalProps) {
  const { data: session } = useSession();
  const { socket } = useSocket();
  const [callType, setCallType] = useState<"audio" | "video">(incomingCall?.type || "video");
  const { devices, permission: mediaPermission, requestPermissions } = useMediaDevices(callType === "video");

  const [call, setCall] = useState<CallData | null>(incomingCall || null);
  const [callStatus, setCallStatus] = useState<"preparing" | "ringing" | "connecting" | "active" | "ended">(
    incomingCall ? "ringing" : "preparing"
  );
  const [invitees, setInvitees] = useState<string[]>(
    members.filter((m) => m.user.id !== currentUserId).map((m) => m.user.id)
  );
  const defaultAudioDevice =
    devices.find((d) => d.kind === "audioinput")?.deviceId || "";
  const defaultVideoDevice =
    devices.find((d) => d.kind === "videoinput")?.deviceId || "";
  const [audioDevice, setAudioDevice] = useState<string>(defaultAudioDevice);
  const [videoDevice, setVideoDevice] = useState<string>(defaultVideoDevice);

  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const offersSentRef = useRef<Set<string>>(new Set());
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [duration, setDuration] = useState(0);
  const durationRef = useRef<NodeJS.Timeout | null>(null);

  const sessionUser = session?.user as { username?: string; name?: string; image?: string; avatar?: string } | undefined;
  const currentUser = members.find((m) => m.user.id === currentUserId)?.user || {
    id: currentUserId,
    username: sessionUser?.username || sessionUser?.name || "Tu",
    avatar: sessionUser?.image || sessionUser?.avatar || "",
  };

  const otherMembers = members.filter((m) => m.user.id !== currentUserId);

  const getOrCreatePeer = useCallback((userId: string): RTCPeerConnection => {
    if (peersRef.current[userId]) return peersRef.current[userId];

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current[userId] = pc;

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStreams((prev) => ({ ...prev, [userId]: stream }));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        setCall((currentCall) => {
          if (currentCall) {
            socket?.emit("call:ice-candidate", {
              callId: currentCall.id,
              targetUserId: userId,
              candidate: event.candidate,
            });
          }
          return currentCall;
        });
      }
    };

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    return pc;
  }, [socket]);

  const endCallLocal = useCallback(() => {
    setCallStatus("ended");
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setRemoteStreams({});
    setTimeout(onClose, 1500);
  }, [onClose]);

  // Get local media stream
  useEffect(() => {
    let mounted = true;
    async function getLocalStream() {
      try {
        const constraints: MediaStreamConstraints = {
          audio: audioDevice ? { deviceId: { exact: audioDevice } } : true,
          video: callType === "video" ? (videoDevice ? { deviceId: { exact: videoDevice } } : true) : false,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Failed to get local stream", err);
      }
    }
    getLocalStream();
    return () => {
      mounted = false;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [audioDevice, videoDevice, callType]);

  // Listen for socket events
  useEffect(() => {
    if (!socket) return;

    const handleUpdated = ({ call: updated }: { call: CallData }) => {
      setCall(updated);
    };

    const handleParticipantJoined = async ({ callId, userId }: { callId: string; userId: string }) => {
      if (!call || call.id !== callId || userId === currentUserId) return;
      if (currentUserId > userId && !offersSentRef.current.has(userId)) {
        offersSentRef.current.add(userId);
        const pc = getOrCreatePeer(userId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket?.emit("call:offer", { callId, targetUserId: userId, sdp: offer });
      }
    };

    const handleEnded = ({ callId }: { callId: string }) => {
      if (call && call.id === callId) {
        endCallLocal();
      }
    };

    const handleOffer = async ({
      callId,
      fromUserId,
      sdp,
    }: {
      callId: string;
      fromUserId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      if (!call || call.id !== callId) return;
      if (peersRef.current[fromUserId]) return;
      const pc = getOrCreatePeer(fromUserId);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("call:answer", { callId, targetUserId: fromUserId, sdp: answer });
    };

    const handleAnswer = async ({
      callId,
      fromUserId,
      sdp,
    }: {
      callId: string;
      fromUserId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      if (!call || call.id !== callId) return;
      const pc = peersRef.current[fromUserId];
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    };

    const handleIceCandidate = async ({
      callId,
      fromUserId,
      candidate,
    }: {
      callId: string;
      fromUserId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      if (!call || call.id !== callId) return;
      const pc = peersRef.current[fromUserId];
      if (!pc) return;
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    };

    socket.on("call:updated", handleUpdated);
    socket.on("call:participant-joined", handleParticipantJoined);
    socket.on("call:ended", handleEnded);
    socket.on("call:offer", handleOffer);
    socket.on("call:answer", handleAnswer);
    socket.on("call:ice-candidate", handleIceCandidate);

    return () => {
      socket.off("call:updated", handleUpdated);
      socket.off("call:participant-joined", handleParticipantJoined);
      socket.off("call:ended", handleEnded);
      socket.off("call:offer", handleOffer);
      socket.off("call:answer", handleAnswer);
      socket.off("call:ice-candidate", handleIceCandidate);
    };
  }, [socket, call, currentUserId, endCallLocal, getOrCreatePeer]);

  // Duration timer
  useEffect(() => {
    if (callStatus === "active") {
      durationRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } else if (durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }
    return () => {
      if (durationRef.current) clearInterval(durationRef.current);
    };
  }, [callStatus]);

  async function startCall(type: "audio" | "video") {
    setCallType(type);
    const granted = await requestPermissions();
    if (!granted) return;
    const res = await fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        type,
        invitedUserIds: invitees,
      }),
    });

    if (!res.ok) return;

    const data = await res.json();
    setCall(data);
    setCallStatus("connecting");
    socket?.emit("call:join", data.id);

    const joined = (data.participants || [])
      .filter((p: CallParticipant) => p.status === "joined" && p.userId !== currentUserId)
      .map((p: CallParticipant) => p.userId);

    for (const userId of joined) {
      if (currentUserId > userId && !offersSentRef.current.has(userId)) {
        offersSentRef.current.add(userId);
        const pc = getOrCreatePeer(userId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket?.emit("call:offer", { callId: data.id, targetUserId: userId, sdp: offer });
      }
    }
  }

  async function acceptCall() {
    if (!call) return;
    const res = await fetch("/api/calls", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callId: call.id, action: "accept" }),
    });

    if (!res.ok) return;

    const data = await res.json();
    setCall(data);
    setCallStatus("connecting");
    socket?.emit("call:join", call.id);

    const joined = (data.participants || [])
      .filter((p: CallParticipant) => p.status === "joined" && p.userId !== currentUserId)
      .map((p: CallParticipant) => p.userId);

    for (const userId of joined) {
      if (currentUserId > userId && !offersSentRef.current.has(userId)) {
        offersSentRef.current.add(userId);
        const pc = getOrCreatePeer(userId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket?.emit("call:offer", { callId: call.id, targetUserId: userId, sdp: offer });
      }
    }
  }

  async function declineCall() {
    if (!call) return;
    await fetch("/api/calls", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callId: call.id, action: "decline" }),
    });
    endCallLocal();
  }

  async function endCall() {
    if (!call) return;
    await fetch("/api/calls", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callId: call.id, action: "end" }),
    });
    socket?.emit("call:end", { callId: call.id });
    endCallLocal();
  }

  function toggleMute() {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    });
  }

  function toggleVideo() {
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
      setIsVideoOff(!track.enabled);
    });
  }

  function toggleSpeaker() {
    setIsSpeakerOn((prev) => {
      const next = !prev;
      Object.values(remoteVideoRefs.current).forEach((el) => {
        if (el) el.muted = !next;
      });
      return next;
    });
  }

  function formatDuration(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  const audioDevices = devices.filter((d) => d.kind === "audioinput");
  const videoDevices = devices.filter((d) => d.kind === "videoinput");

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
            <Phone size={20} className="text-accent" />
          </div>
          <div>
            <h2 className="font-semibold text-white">
              {callStatus === "ringing" ? "Chiamata in arrivo" : "Chiamata in corso"}
            </h2>
            {callStatus === "active" && (
              <p className="text-sm text-zinc-400">{formatDuration(duration)}</p>
            )}
          </div>
        </div>
        <button onClick={endCall} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition">
          <X size={20} className="text-white" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4 overflow-y-auto">
        {callStatus === "preparing" && (
          <div className="w-full max-w-md space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-white mb-2">Avvia una chiamata</h3>
              <p className="text-zinc-400 text-sm">Seleziona chi invitare e le preferenze audio/video</p>
            </div>
            {(mediaPermission === "denied" || mediaPermission === "unknown") && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-200 text-sm">
                Permessi microfono/camera negati. Abilita i permessi dal browser per usare le chiamate.
              </div>
            )}

            {/* Invitees selection */}
            {otherMembers.length > 1 && (
              <div className="bg-zinc-900/50 rounded-2xl p-4 space-y-3">
                <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <Users size={16} /> Chi invitare
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {otherMembers.map((m) => (
                    <label
                      key={m.user.id}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={invitees.includes(m.user.id)}
                        onChange={(e) =>
                          setInvitees((prev) =>
                            e.target.checked
                              ? [...prev, m.user.id]
                              : prev.filter((id) => id !== m.user.id)
                          )
                        }
                        className="w-5 h-5 rounded accent-accent"
                      />
                      <Image
                        src={m.user.avatar || "/default-avatar.png"}
                        alt={m.user.username}
                        width={32}
                        height={32}
                        className="rounded-full object-cover"
                      />
                      <span className="text-white text-sm">{m.user.username}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Device selection */}
            <div className="bg-zinc-900/50 rounded-2xl p-4 space-y-3">
              <h4 className="text-sm font-medium text-zinc-300">Dispositivi</h4>
              <div className="space-y-2">
                <label className="text-xs text-zinc-500">Microfono</label>
                <select
                  value={audioDevice || defaultAudioDevice}
                  onChange={(e) => setAudioDevice(e.target.value)}
                  className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm"
                >
                  {audioDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-zinc-500">Telecamera</label>
                <select
                  value={videoDevice || defaultVideoDevice}
                  onChange={(e) => setVideoDevice(e.target.value)}
                  className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm"
                >
                  {videoDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Call type buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => startCall("audio")}
                disabled={mediaPermission === "denied"}
                className="flex-1 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition flex items-center justify-center gap-2"
              >
                <Phone size={20} /> Audio
              </button>
              <button
                onClick={() => startCall("video")}
                disabled={mediaPermission === "denied"}
                className="flex-1 py-3 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-accent-foreground font-semibold transition flex items-center justify-center gap-2"
              >
                <Video size={20} /> Video
              </button>
            </div>
          </div>
        )}

        {callStatus === "ringing" && call && (
          <div className="text-center space-y-6">
            <Image
              src={call.caller.avatar || "/default-avatar.png"}
              alt={call.caller.username}
              width={120}
              height={120}
              className="rounded-full object-cover mx-auto border-4 border-accent/30"
            />
            <div>
              <h3 className="text-2xl font-semibold text-white">{call.caller.username}</h3>
              <p className="text-zinc-400">Ti sta chiamando...</p>
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={declineCall}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition"
              >
                <PhoneOff size={28} />
              </button>
              <button
                onClick={acceptCall}
                className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition"
              >
                <Phone size={28} />
              </button>
            </div>
          </div>
        )}

        {(callStatus === "connecting" || callStatus === "active") && (
          <div className="w-full h-full flex flex-col gap-4">
            {/* Remote videos grid */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 min-h-0">
              {Object.entries(remoteStreams).map(([userId, stream]) => {
                const user = members.find((m) => m.user.id === userId)?.user || {
                  id: userId,
                  username: "Utente",
                  avatar: "",
                };
                return (
                  <div key={userId} className="relative rounded-2xl overflow-hidden bg-zinc-900 min-h-[200px]">
                    <video
                      ref={(el) => {
                        remoteVideoRefs.current[userId] = el;
                        if (el) {
                          el.srcObject = stream;
                          el.muted = !isSpeakerOn;
                        }
                      }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded-lg text-xs text-white">
                      {user.username}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Local video */}
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl overflow-hidden bg-zinc-800 self-end shrink-0 relative">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded-lg text-xs text-white">
                {currentUser.username}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {(callStatus === "connecting" || callStatus === "active") && (
        <div className="p-4 flex items-center justify-center gap-4 bg-black/50">
          <button
            onClick={toggleMute}
            className={`p-4 rounded-full transition ${isMuted ? "bg-red-500/20 text-red-500" : "bg-white/10 text-white hover:bg-white/20"}`}
          >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full transition ${isVideoOff ? "bg-red-500/20 text-red-500" : "bg-white/10 text-white hover:bg-white/20"}`}
          >
            {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>
          <button
            onClick={toggleSpeaker}
            className={`p-4 rounded-full transition ${!isSpeakerOn ? "bg-red-500/20 text-red-500" : "bg-white/10 text-white hover:bg-white/20"}`}
          >
            {isSpeakerOn ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>
          <button
            onClick={endCall}
            className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      )}
    </div>
  );
}
