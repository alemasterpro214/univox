import { prisma } from "./prisma";
import { unlink } from "fs/promises";
import { join } from "path";

/**
 * Batch check expiration for an array of posts that already have their data loaded.
 * Instead of re-querying each post individually (N+1), we check in-memory
 * and only expire the ones that need it.
 */
export async function batchCheckPostExpiration(posts: any[], userId?: string) {
  const now = new Date();
  const expired = posts.filter(
    (p) => p.expiresAt && new Date(p.expiresAt) < now && !p.isUnavailable
  );

  // Early return if nothing to expire — avoids unnecessary map allocation
  if (expired.length === 0) return posts;

  // Batch expire: delete media and mark unavailable
  const expiredIds = expired.map((p) => p.id);

  // Delete media files (but not synchronously - let them fail gracefully)
  const allMedia = await prisma.postMedia.findMany({
    where: { postId: { in: expiredIds } },
    select: { postId: true, url: true },
  });

  for (const media of allMedia) {
    try {
      const filepath = join(process.cwd(), "public", media.url);
      await unlink(filepath);
    } catch {
      // File may not exist, that's fine
    }
  }

  // Batch delete media records and mark posts unavailable
  await Promise.all([
    prisma.postMedia.deleteMany({ where: { postId: { in: expiredIds } } }),
    prisma.post.updateMany({
      where: { id: { in: expiredIds } },
      data: { isUnavailable: true },
    }),
  ]);

  // Return posts with in-memory state updated (no re-query)
  return posts.map((p) =>
    p.expiresAt && new Date(p.expiresAt) < now
      ? { ...p, isUnavailable: true, media: [] }
      : p
  );
}

/**
 * Legacy single-post expiration check — used by individual post detail endpoints.
 * Only re-queries when the post is actually expired and needs media cleanup.
 */
export async function checkPostExpiration(postId: string, userId?: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      media: true,
      user: true,
      keywords: true,
      _count: { select: { likes: true, comments: true, views: true, shares: true } },
      likes: userId ? { where: { userId }, select: { id: true } } : undefined,
    },
  });

  if (!post || post.isUnavailable) return post;

  const now = new Date();
  if (post.expiresAt && post.expiresAt < now) {
    return await expirePostMedia(post.id, userId);
  }

  return post;
}

async function expirePostMedia(postId: string, userId?: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { media: true },
  });

  if (!post) return null;

  for (const media of post.media) {
    try {
      const filepath = join(process.cwd(), "public", media.url);
      await unlink(filepath);
    } catch {
      // ignore
    }
  }

  await prisma.postMedia.deleteMany({ where: { postId } });

  return await prisma.post.update({
    where: { id: postId },
    data: { isUnavailable: true },
    include: {
      media: true,
      user: true,
      keywords: true,
      _count: { select: { likes: true, comments: true, views: true, shares: true } },
      likes: userId ? { where: { userId }, select: { id: true } } : undefined,
    },
  });
}

export function getDefaultExpirationDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 21);
  return date;
}

export function calculateRelevanceScore(post: any, query: string) {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const terms = q.split(/\s+/).filter(Boolean);
  let score = 0;

  const caption = (post.caption || "").toLowerCase();
  const username = (post.user?.username || "").toLowerCase();
  const name = (post.user?.name || "").toLowerCase();
  const keywords =
    post.keywords?.map((k: any) =>
      typeof k === "string" ? k : k.keyword
    ).map((k: string) => k.toLowerCase()) || [];

  for (const term of terms) {
    if (username.includes(term) || name.includes(term)) score += 15;
    if (caption.includes(term)) score += 10;
    if (keywords.some((k: string) => k.includes(term))) score += 20;
    if (keywords.some((k: string) => k === term)) score += 30;
  }

  const likes = post._count?.likes || post.likesCount || 0;
  const comments = post._count?.comments || post.commentsCount || 0;
  const views = post._count?.views || post.viewsCount || 0;
  const shares = post._count?.shares || post.sharesCount || 0;

  score += likes * 0.5 + comments * 1 + views * 0.05 + shares * 2;

  return score;
}

export function sortPostsByRelevance(posts: any[], query: string) {
  return [...posts].sort(
    (a, b) => calculateRelevanceScore(b, query) - calculateRelevanceScore(a, query)
  );
}

export function sortPostsBySortOption(posts: any[], sort: string) {
  const sorted = [...posts];
  switch (sort) {
    case "oldest":
      return sorted.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    case "most_viewed":
      return sorted.sort(
        (a, b) =>
          (b.viewsCount || b._count?.views || 0) -
          (a.viewsCount || a._count?.views || 0)
      );
    case "least_viewed":
      return sorted.sort(
        (a, b) =>
          (a.viewsCount || a._count?.views || 0) -
          (b.viewsCount || b._count?.views || 0)
      );
    case "newest":
    default:
      return sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }
}
