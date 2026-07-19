import { prisma } from "./prisma";
import { emitToUser } from "./realtime";

const NSFW_KEYWORDS = [
  "porn", "porno", "xxx", "nsfw",
  "gore", "brutal",
  "explicit", "hentai", "erotic",
];

export interface ModerationResult {
  flagged: boolean;
  reason?: string;
  confidence: number;
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, " ");
}

function keywordModerateText(text: string): ModerationResult {
  const normalized = normalizeText(text);
  const words = normalized.split(/\s+/).filter(Boolean);
  const found = words.filter((word) =>
    NSFW_KEYWORDS.some((kw) => word.includes(kw) || kw.includes(word))
  );

  if (found.length > 0) {
    return {
      flagged: true,
      reason: `Contenuto potenzialmente inappropriato rilevato: ${found.join(", ")}`,
      confidence: Math.min(found.length * 0.3 + 0.3, 0.95),
    };
  }

  return { flagged: false, confidence: 0 };
}

function keywordModerateFile(filename: string): ModerationResult {
  const normalized = normalizeText(filename);
  const found = NSFW_KEYWORDS.filter((kw) => normalized.includes(kw));

  if (found.length >= 2) {
    return {
      flagged: true,
      reason: `Nome file sospetto: ${found.join(", ")}`,
      confidence: Math.min(found.length * 0.3 + 0.4, 0.95),
    };
  }

  return { flagged: false, confidence: 0 };
}

interface OpenAIModerationResponse {
  results?: {
    flagged: boolean;
    categories: Record<string, boolean>;
    category_scores: Record<string, number>;
  }[];
}

async function callOpenAIModeration(input: any): Promise<OpenAIModerationResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input, model: "omni-moderation-latest" }),
    });

    if (!res.ok) {
      console.error("OpenAI moderation API error:", res.status, await res.text());
      return null;
    }

    return (await res.json()) as OpenAIModerationResponse;
  } catch (error) {
    console.error("OpenAI moderation fetch error:", error);
    return null;
  }
}

function parseOpenAIModeration(data: OpenAIModerationResponse | null): ModerationResult {
  if (!data || !data.results || data.results.length === 0) {
    return { flagged: false, confidence: 0 };
  }

  const result = data.results[0];
  if (!result.flagged) {
    return { flagged: false, confidence: 0 };
  }

  const flaggedCategories = Object.entries(result.categories)
    .filter(([, value]) => value)
    .map(([key]) => key);

  const score = Math.max(...Object.values(result.category_scores));

  return {
    flagged: true,
    reason: `Contenuto inappropriato rilevato: ${flaggedCategories.join(", ")}`,
    confidence: Math.min(score, 0.99),
  };
}

export async function moderateText(text: string): Promise<ModerationResult> {
  const keywordResult = keywordModerateText(text);
  if (keywordResult.flagged) return keywordResult;

  const openaiResult = await callOpenAIModeration(text);
  if (openaiResult) {
    return parseOpenAIModeration(openaiResult);
  }

  return { flagged: false, confidence: 0 };
}

export async function moderateFile(
  filename: string,
  _contentType: string
): Promise<ModerationResult> {
  const keywordResult = keywordModerateFile(filename);
  if (keywordResult.flagged) return keywordResult;

  return { flagged: false, confidence: 0 };
}

export async function moderateImage(imageDataUrl: string): Promise<ModerationResult> {
  const keywordResult = keywordModerateFile(imageDataUrl);
  if (keywordResult.flagged) return keywordResult;

  const openaiResult = await callOpenAIModeration([
    { type: "image_url", image_url: { url: imageDataUrl } },
  ]);

  if (openaiResult) {
    return parseOpenAIModeration(openaiResult);
  }

  return { flagged: false, confidence: 0 };
}

export async function applyStrike(userId: string, reason: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const now = new Date();
  const newStrikes = user.strikes + 1;

  let canPostUntil: Date | undefined;
  let canCommentUntil: Date | undefined;
  let canLikeUntil: Date | undefined;
  let canMessageUntil: Date | undefined;
  let bannedAt: Date | undefined;

  switch (newStrikes) {
    case 1:
      canPostUntil = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      break;
    case 2:
      canPostUntil = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      break;
    case 3:
      canPostUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      canCommentUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      canLikeUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      break;
    case 4:
      canPostUntil = new Date(now.getTime() + 182 * 24 * 60 * 60 * 1000);
      canCommentUntil = new Date(now.getTime() + 182 * 24 * 60 * 60 * 1000);
      canLikeUntil = new Date(now.getTime() + 182 * 24 * 60 * 60 * 1000);
      canMessageUntil = new Date(now.getTime() + 182 * 24 * 60 * 60 * 1000);
      break;
    case 5:
      bannedAt = now;
      break;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      strikes: newStrikes,
      lastStrikeAt: now,
      canPostUntil,
      canCommentUntil,
      canLikeUntil,
      canMessageUntil,
      bannedAt,
      banReason: bannedAt ? reason : undefined,
    },
  });

  return { user: updated, strike: newStrikes, bannedAt };
}

export async function checkUserRestrictions(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { banned: true, reason: "Utente non trovato" };

  if (user.bannedAt) {
    return { banned: true, reason: user.banReason || "Account bannato" };
  }

  const now = new Date();
  return {
    banned: false,
    canPost: !user.canPostUntil || user.canPostUntil <= now,
    canComment: !user.canCommentUntil || user.canCommentUntil <= now,
    canLike: !user.canLikeUntil || user.canLikeUntil <= now,
    canMessage: !user.canMessageUntil || user.canMessageUntil <= now,
    strikes: user.strikes,
  };
}

export async function banUser(userId: string, reason: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      conversationMembers: { include: { conversation: { include: { members: true } } } },
    },
  });

  if (!user) return null;

  // Notify other users in conversations
  const notifiedUserIds = new Set<string>();
  for (const membership of user.conversationMembers) {
    for (const member of membership.conversation.members) {
      if (member.userId !== userId) {
        notifiedUserIds.add(member.userId);
      }
    }
  }
  notifiedUserIds.forEach((uid) => {
    emitToUser(uid, "new_notification", {
      type: "ban",
      message: `${user.username} è stato bannato dalla piattaforma`,
    });
  });

  // Delete user content
  await prisma.$transaction([
    prisma.like.deleteMany({ where: { userId } }),
    prisma.comment.deleteMany({ where: { userId } }),
    prisma.savedPost.deleteMany({ where: { playlist: { userId } } }),
    prisma.playlist.deleteMany({ where: { userId } }),
    prisma.post.deleteMany({ where: { userId } }),
    prisma.message.deleteMany({ where: { senderId: userId } }),
    prisma.notification.deleteMany({ where: { OR: [{ userId }, { fromUserId: userId }] } }),
    prisma.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } }),
    prisma.followRequest.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  return user;
}
