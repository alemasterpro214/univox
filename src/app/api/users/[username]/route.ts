import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { batchCheckPostExpiration, sortPostsBySortOption } from "@/lib/post-utils";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const username = (await params).username;
    const { searchParams } = new URL(req.url);
    const sort = searchParams.get("sort") || "newest";
    const filter = searchParams.get("filter") || "available";

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        name: true,
        bio: true,
        website: true,
        avatar: true,
        role: true,
        isPrivate: true,
        isVerified: true,
        isBusiness: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    let isFollowing = false;
    if (session?.user?.id) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: session.user.id,
            followingId: user.id,
          },
        },
      });
      isFollowing = !!follow;
    }

    const isOwner = session?.user?.id === user.id;
    const showUnavailable = isOwner && filter === "unavailable";

    const rawPosts = await prisma.post.findMany({
      where: {
        userId: user.id,
        visibility: isOwner ? undefined : "public",
        isUnavailable: showUnavailable ? true : false,
      },
      include: {
        media: { orderBy: { order: "asc" }, select: { id: true, url: true, type: true, order: true } },
        keywords: { select: { keyword: true } },
        _count: { select: { likes: true, comments: true, views: true, shares: true } },
        likes: session?.user?.id
          ? { where: { userId: session.user.id }, select: { id: true } }
          : false,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // Batch expiration check (no N+1)
    const checkedPosts = await batchCheckPostExpiration(rawPosts, session?.user?.id);

    const validPosts = checkedPosts.filter(
      (post): post is NonNullable<typeof post> => post !== null
    );

    const postsWithCounts = validPosts.map((post) => ({
      ...post,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      viewsCount: post._count.views,
      sharesCount: post._count.shares,
      likedByMe: post.likes && post.likes.length > 0,
    }));

    const posts = sortPostsBySortOption(postsWithCounts, sort);

    // Batch count queries
    const [followersCount, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: user.id } }),
      prisma.follow.count({ where: { followerId: user.id } }),
    ]);

    return NextResponse.json({
      ...user,
      followersCount,
      followingCount,
      isFollowing,
      posts,
    });
  } catch (error) {
    console.error("User profile error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}
