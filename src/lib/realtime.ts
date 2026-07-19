import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function createAdminClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseServiceKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Supabase service role key or URL not configured. Server-side realtime broadcasts disabled.");
    }
    return null;
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

export const supabaseAdmin = createAdminClient();

export async function emitToRoom(
  room: string,
  event: string,
  payload: unknown
): Promise<void> {
  if (!supabaseAdmin) {
    return;
  }

  const channel = supabaseAdmin.channel(room, {
    config: {
      broadcast: { ack: false },
    },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Realtime subscribe timeout"));
      }, 5000);

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "CLOSED" || status === "TIMED_OUT") {
          clearTimeout(timeout);
          reject(new Error(`Realtime subscribe failed: ${status}`));
        }
      });
    });

    await channel.send({
      type: "broadcast",
      event,
      payload,
    });
  } catch (error) {
    console.error("Realtime broadcast error:", error);
  } finally {
    channel.unsubscribe();
  }
}

export async function emitToUser(
  userId: string,
  event: string,
  payload: unknown
): Promise<void> {
  return emitToRoom(`user:${userId}`, event, payload);
}

export async function emitToConversation(
  conversationId: string,
  event: string,
  payload: unknown
): Promise<void> {
  return emitToRoom(`chat:${conversationId}`, event, payload);
}

export async function emitToPost(
  postId: string,
  event: string,
  payload: unknown
): Promise<void> {
  return emitToRoom(`post:${postId}`, event, payload);
}

export async function emitToCall(
  callId: string,
  event: string,
  payload: unknown
): Promise<void> {
  return emitToRoom(`call:${callId}`, event, payload);
}
