import { prisma } from "./prisma";

export type InterestAction = "view" | "like" | "save";

const ACTION_WEIGHTS: Record<InterestAction, number> = {
  view: 0.2,
  like: 1.0,
  save: 1.5,
};

const BASE_ALPHA = 0.2;

function calculateAlpha(confidence: number): number {
  // Learning rate che diminuisce man mano che la confidenza cresce.
  // In questo modo gli interessi cambiano rapidamente all'inizio e
  // sempre più lentamente quando abbiamo abbastanza dati.
  return BASE_ALPHA / (1 + 0.1 * confidence);
}

function calculateNewWeight(oldWeight: number, actionWeight: number, confidence: number) {
  const alpha = calculateAlpha(confidence);
  return oldWeight + alpha * (actionWeight - oldWeight);
}

/**
 * Aggiorna gli interessi di un utente in base alle keyword di un post.
 * L'aggiornamento è asincrono e non deve essere awaited nel flusso principale
 * delle API per non rallentare le risposte.
 */
export async function updateUserInterests(
  userId: string,
  postId: string,
  action: InterestAction
) {
  try {
    const actionWeight = ACTION_WEIGHTS[action];

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        keywords: { select: { keyword: true } },
      },
    });

    if (!post || post.keywords.length === 0) return;

    const keywords = post.keywords.map((k) => k.keyword);

    // Leggi gli interessi esistenti per calcolare i nuovi pesi
    const existingInterests = await prisma.userInterest.findMany({
      where: { userId, keyword: { in: keywords } },
    });

    const interestMap = new Map(existingInterests.map((i) => [i.keyword, i]));

    for (const keyword of keywords) {
      const existing = interestMap.get(keyword);

      if (existing) {
        const newWeight = calculateNewWeight(
          existing.weight,
          actionWeight,
          existing.confidence
        );

        await prisma.userInterest.update({
          where: { id: existing.id },
          data: {
            weight: newWeight,
            confidence: { increment: 1 },
          },
        });
      } else {
        await prisma.userInterest.create({
          data: {
            userId,
            keyword,
            weight: actionWeight * BASE_ALPHA,
            confidence: 1,
          },
        });
      }
    }
  } catch (error) {
    console.error("[recommendation] updateUserInterests error:", error);
  }
}

/**
 * Recupera i top interessi di un utente ordinati per peso.
 */
export async function getUserInterests(userId: string, take: number = 20) {
  return prisma.userInterest.findMany({
    where: { userId },
    orderBy: { weight: "desc" },
    take,
  });
}
