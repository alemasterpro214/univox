import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDefaultExpirationDate, checkPostExpiration } from "@/lib/post-utils";
import { moderateText, applyStrike, checkUserRestrictions } from "@/lib/moderation";
import { z } from "zod";

const createPostSchema = z.object({
  caption: z.string().default(""),
  location: z.string().default(""),
  isAiGenerated: z.boolean().default(false),
  visibility: z.enum(["public", "private", "close_friends"]).default("public"),
  media: z.array(
    z.object({
      url: z.string(),
      type: z.enum(["image", "video"]).default("image"),
    })
  ).default([]),
  keywords: z.array(z.string().min(1)).min(1).max(20),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const where: any = { isUnavailable: false };
    if (userId) where.userId = userId;

    const posts = await prisma.post.findMany({
      where,
      include: {
        user: true,
        media: { orderBy: { order: "asc" } },
        keywords: true,
        _count: { select: { likes: true, comments: true, views: true, shares: true } },
        likes: session?.user?.id ? { where: { userId: session.user.id } } : undefined,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    const checkedPosts = await Promise.all(
      posts.map((post) => checkPostExpiration(post.id, session?.user?.id))
    );

    const formatted = checkedPosts.filter((post): post is NonNullable<typeof post> => post !== null).map((post) => ({
      id: post.id,
      caption: post.caption,
      location: post.location,
      isAiGenerated: post.isAiGenerated,
      isUnavailable: post.isUnavailable,
      expiresAt: post.expiresAt,
      keywords: post.keywords.map((k) => k.keyword),
      createdAt: post.createdAt,
      user: post.user,
      media: post.media,
      likedByMe: post.likes && post.likes.length > 0,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      viewsCount: post._count.views,
      sharesCount: post._count.shares,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Get posts error:", error);
    return NextResponse.json({ error: "Errore nel caricamento dei post" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const restrictions = await checkUserRestrictions(session.user.id);
    if (restrictions.banned) {
      return NextResponse.json({ error: "Account bannato" }, { status: 403 });
    }
    if (!restrictions.canPost) {
      return NextResponse.json({ error: "Non puoi pubblicare contenuti al momento" }, { status: 403 });
    }

    const body = await req.json();
    const data = createPostSchema.parse(body);

    if (!data.caption.trim() && data.media.length === 0) {
      return NextResponse.json({ error: "Il post deve contenere almeno un testo o un media" }, { status: 400 });
    }

    const moderation = await moderateText(data.caption);
    if (moderation.flagged) {
      const result = await applyStrike(session.user.id, moderation.reason || "Contenuto inappropriato");
      return NextResponse.json(
        {
          error: "Contenuto non appropriato rilevato",
          reason: moderation.reason,
          strike: result?.strike,
          banned: !!result?.bannedAt,
        },
        { status: 403 }
      );
    }

    const validVisibilities = ["public", "private", "close_friends"];
    const visibility = validVisibilities.includes(data.visibility) ? data.visibility : "public";

    let expiresAt: Date | undefined = data.expiresAt ? new Date(data.expiresAt) : undefined;
    if (!expiresAt) {
      expiresAt = getDefaultExpirationDate();
    }

    const maxExpiration = new Date();
    maxExpiration.setDate(maxExpiration.getDate() + 21);
    if (expiresAt > maxExpiration) {
      expiresAt = maxExpiration;
    }

    const uniqueKeywords = Array.from(new Set(data.keywords.map((k) => k.toLowerCase().trim()))).filter(Boolean);

    const post = await prisma.post.create({
      data: {
        userId: session.user.id,
        caption: data.caption,
        location: data.location,
        isAiGenerated: data.isAiGenerated,
        visibility,
        expiresAt,
        media: {
          create: data.media.map((m, i) => ({ ...m, order: i })),
        },
        keywords: {
          create: uniqueKeywords.map((keyword) => ({ keyword })),
        },
      },
      include: { media: true, user: true, keywords: true },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("Create post error:", error);
    return NextResponse.json({ error: "Errore nella creazione del post" }, { status: 500 });
  }
}
