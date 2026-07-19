import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password", 10);

  const usersData = [
    {
      username: "mario_rossi",
      email: "mario@example.com",
      name: "Mario Rossi",
      passwordHash,
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=mario",
    },
    {
      username: "giulia_verdi",
      email: "giulia@example.com",
      name: "Giulia Verdi",
      passwordHash,
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=giulia",
    },
    {
      username: "luca_bianchi",
      email: "luca@example.com",
      name: "Luca Bianchi",
      passwordHash,
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=luca",
    },
  ];

  for (const data of usersData) {
    await prisma.user.upsert({
      where: { username: data.username },
      update: {},
      create: data,
    });
  }

  const users = await prisma.user.findMany();

  const samplePosts = [
    {
      caption: "Primo post su InstaClone! 🚀",
      media: ["https://images.unsplash.com/photo-1506744038136-7289e0604d9d?w=600&h=600&fit=crop"],
    },
    {
      caption: "Una giornata fantastica ☀️",
      media: ["https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=600&h=600&fit=crop"],
    },
    {
      caption: "Nuovo progetto in arrivo 💻",
      media: ["https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=600&fit=crop"],
    },
  ];

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    for (const post of samplePosts) {
      await prisma.post.create({
        data: {
          userId: user.id,
          caption: post.caption,
          media: {
            create: post.media.map((url, idx) => ({
              url,
              type: "image",
              order: idx,
            })),
          },
        },
      });
    }
  }

  console.log("Seed completato");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
