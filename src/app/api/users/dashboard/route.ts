import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const userId = session.user.id;

    const posts = await prisma.post.findMany({
      where: { userId },
      include: {
        _count: {
          select: { likes: true, comments: true, views: true, shares: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalPosts = posts.length;
    const totalLikes = posts.reduce((sum, post) => sum + post._count.likes, 0);
    const totalComments = posts.reduce((sum, post) => sum + post._count.comments, 0);
    const totalViews = posts.reduce((sum, post) => sum + post._count.views, 0);
    const totalShares = posts.reduce((sum, post) => sum + post._count.shares, 0);

    const followersCount = await prisma.follow.count({
      where: { followingId: userId },
    });

    const followingCount = await prisma.follow.count({
      where: { followerId: userId },
    });

    const formattedPosts = posts.map((post) => ({
      id: post.id,
      caption: post.caption,
      createdAt: post.createdAt,
      likes: post._count.likes,
      comments: post._count.comments,
      views: post._count.views,
      shares: post._count.shares,
    }));

    return NextResponse.json({
      totalPosts,
      totalLikes,
      totalComments,
      totalViews,
      totalShares,
      followersCount,
      followingCount,
      posts: formattedPosts,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}
