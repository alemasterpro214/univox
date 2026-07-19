import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { batchCheckPostExpiration } from "@/lib/post-utils";
import { getUserInterests } from "@/lib/recommendation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // 1) Get following IDs — single lightweight query
    const following = await prisma.follow.findMany({
      where: { followerId: session.user.id },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);

    // 2) Recupera gli interessi dell'utente calcolati gradualmente.
    // Gli interessi vengono aggiornati in background dalle API di
    // like/view/save e persistono nel database con un sistema di
    // confidenza che rallenta i cambiamenti man mano che si accumulano dati.
    const [userInterests, savedPostIds] = await Promise.all([
      getUserInterests(session.user.id, 20),
      prisma.savedPost
        .findMany({
          where: { playlist: { userId: session.user.id } },
          select: { postId: true },
        })
        .then((rows) => new Set(rows.map((r) => r.postId))),
    ]);

    const keywordWeights = new Map<string, number>(
      userInterests.map((interest) => [interest.keyword, interest.weight])
    );

    const topKeywords = Array.from(keywordWeights.entries());

    // 3) Fetch posts with DB pagination (not 200 then slice)
    const rawPosts = await prisma.post.findMany({
      where: {
        userId: { in: [session.user.id, ...followingIds] },
        isUnavailable: false,
      },
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true, isVerified: true } },
        media: { orderBy: { order: "asc" }, select: { id: true, url: true, type: true, order: true } },
        keywords: { select: { keyword: true } },
        _count: { select: { likes: true, comments: true, views: true, shares: true } },
        likes: { where: { userId: session.user.id }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      // Fetch enough posts for scoring + pagination window
      take: Math.min(skip + limit + 50, 200),
    });

    // 4) Batch expiration check (no N+1 re-queries)
    const checkedPosts = await batchCheckPostExpiration(rawPosts, session.user.id);

    // 5) Score and paginate in memory
    const scoredPosts = checkedPosts
      .filter((post): post is NonNullable<typeof post> => post !== null && !post.isUnavailable)
      .map((post) => {
        let score = 0;

        // Keyword scoring (only check top keywords)
        for (const [keyword, weight] of topKeywords) {
          if (post.keywords.some((k: { keyword: string }) => k.keyword === keyword)) {
            score += weight;
          }
        }

        if (post.userId === session.user.id) score += 2;
        if (followingIds.includes(post.userId)) score += 5;

        score += (post._count?.likes || 0) * 0.1;
        score += (post._count?.views || 0) * 0.01;

        return { post, score };
      });

    scoredPosts.sort((a, b) => b.score - a.score);

    const paginated = scoredPosts.slice(skip, skip + limit).map(({ post }) => ({
      id: post.id,
      caption: post.caption,
      location: post.location,
      isAiGenerated: post.isAiGenerated,
      isUnavailable: post.isUnavailable,
      expiresAt: post.expiresAt,
      keywords: post.keywords.map((k: { keyword: string }) => k.keyword),
      createdAt: post.createdAt,
      user: post.user,
      media: post.media,
      likedByMe: post.likes.length > 0,
      savedByMe: savedPostIds.has(post.id),
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      viewsCount: post._count.views,
      sharesCount: post._count.shares,
    }));

    return NextResponse.json(paginated);
  } catch (error) {
    console.error("Feed error:", error);
    return NextResponse.json({ error: "Errore nel caricamento del feed" }, { status: 500 });
  }
}
