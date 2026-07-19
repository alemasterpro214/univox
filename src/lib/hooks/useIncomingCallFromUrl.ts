"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { CallData } from "@/components/CallModal";

export function useIncomingCallFromUrl(
  conversationId: string,
  setIncomingCall: (call: CallData | null) => void
) {
  const searchParams = useSearchParams();
  const callId = searchParams.get("call");

  useEffect(() => {
    if (!callId) return;
    let mounted = true;
    fetch(`/api/calls?callId=${encodeURIComponent(callId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data) {
          setIncomingCall(data);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [callId, setIncomingCall]);
}
