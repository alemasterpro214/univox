import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { batchCheckPostExpiration, calculateRelevanceScore, sortPostsByRelevance } from "@/lib/post-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const type = searchParams.get("type") || "posts";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "30");
    const skip = (page - 1) * limit;

    const query = q.toLowerCase().trim();

    // Users search (lightweight)
    if (type === "users") {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: query } },
            { name: { contains: query } },
          ],
        },
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true,
          isVerified: true,
          _count: { select: { followers: true } },
        },
        orderBy: { followers: { _count: "desc" } },
        take: 5,
      });
      return NextResponse.json({ users });
    }

    // Posts search — avoid N+1 by batch checking expiration
    const [searchUsers, posts, userSavedPosts] = await Promise.all([
      query
        ? prisma.user.findMany({
            where: {
              OR: [
                { username: { contains: query } },
                { name: { contains: query } },
              ],
            },
            select: {
              id: true,
              username: true,
              name: true,
              avatar: true,
              isVerified: true,
              _count: { select: { followers: true } },
            },
            orderBy: { followers: { _count: "desc" } },
            take: 5,
          })
        : Promise.resolve([]),
      prisma.post.findMany({
        where: {
          isUnavailable: false,
          visibility: "public",
          ...(query
            ? {
                OR: [
                  { caption: { contains: query } },
                  { location: { contains: query } },
                  { user: { username: { contains: query } } },
                  { keywords: { some: { keyword: { contains: query } } } },
                ],
              }
            : {}),
        },
        include: {
          user: { select: { id: true, username: true, name: true, avatar: true, isVerified: true } },
          media: { orderBy: { order: "asc" }, select: { id: true, url: true, type: true, order: true } },
          keywords: { select: { keyword: true } },
          _count: { select: { likes: true, comments: true, views: true, shares: true } },
          likes: session?.user?.id
            ? { where: { userId: session.user.id }, select: { id: true } }
            : false,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      session?.user?.id
        ? prisma.savedPost.findMany({
            where: { playlist: { userId: session.user.id } },
            select: { postId: true },
          })
        : Promise.resolve([] as { postId: string }[]),
    ]);

    const savedPostIds = new Set(userSavedPosts.map((s) => s.postId));

    // Batch expiration check (no N+1)
    const checkedPosts = await batchCheckPostExpiration(posts, session?.user?.id);

    const validPosts = checkedPosts.filter(
      (post): post is NonNullable<typeof post> => post !== null && !post.isUnavailable
    );

    const scoredPosts = sortPostsByRelevance(validPosts, query).slice(skip, skip + limit);

    const formatted = scoredPosts.map((post) => ({
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
      likedByMe: post.likes && post.likes.length > 0,
      savedByMe: savedPostIds.has(post.id),
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      viewsCount: post._count.views,
      sharesCount: post._count.shares,
      relevanceScore: calculateRelevanceScore(post, query),
    }));

    return NextResponse.json({ users: searchUsers, posts: formatted });
  } catch (error) {
    console.error("Explore error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}
