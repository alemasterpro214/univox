import { prisma } from "../src/lib/prisma";

async function main() {
  const username = "NotAlexAgain";

  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user) {
    console.log(
      `Utente ${username} non trovato. Registrati con questo username per attivare il ruolo OWNER.`
    );
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: "OWNER" },
  });
  console.log(`Ruolo OWNER assegnato a ${username}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
