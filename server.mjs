import { createServer } from "http";
import { existsSync } from "fs";
import { execFileSync } from "child_process";
import next from "next";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

console.log("\n══════════════════════════════════════════════");
console.log("   🚀 Unyvox Server — Avvio...");
console.log("══════════════════════════════════════════════");

if (existsSync(".env")) {
  console.log("✅ .env trovato");
} else {
  console.warn("⚠️  .env NON trovato!");
}
if (existsSync(".env.local")) {
  console.log("✅ .env.local trovato");
}

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

function mask(val) {
  if (!val) return "(non impostato)";
  if (val.length < 8) return "(impostato, corto)";
  return val.slice(0, 4) + "…" + val.slice(-4);
}

console.log("\n📋 Variabili d'ambiente:");
console.log(`   • NODE_ENV: ${process.env.NODE_ENV || "(non impostato)"}`);
console.log(`   • NEXTAUTH_SECRET: ${mask(process.env.NEXTAUTH_SECRET)}`);
console.log(`   • NEXTAUTH_URL: ${process.env.NEXTAUTH_URL || "(non impostato)"}`);
console.log(`   • DATABASE_URL: ${mask(process.env.DATABASE_URL)}`);
console.log(`   • GIPHY_API_KEY: ${mask(process.env.GIPHY_API_KEY)}`);
console.log(`   • PORT: ${process.env.PORT || "3000"}`);
console.log(`   • HOSTNAME: ${process.env.HOSTNAME || "0.0.0.0"}`);

process.env.NODE_ENV = process.env.NODE_ENV || "development";
const dev = process.env.NODE_ENV !== "production";

if (!process.env.NEXTAUTH_SECRET) {
  console.error("");
  console.error("❌ ERRORE: NEXTAUTH_SECRET non è impostato!");
  console.error("   Aggiungilo al file .env o .env.local");
  process.exit(1);
}

const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

console.log("");
console.log(`🔌 Avvio su http://${hostname}:${port}`);

if (process.env.NODE_ENV === "production" && process.env.RUN_DB_PUSH === "true") {
  process.stderr.write("\n🗄️  [startup] Running prisma db push...\n");
  try {
    execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], { cwd: process.cwd(), stdio: "inherit" });
    process.stderr.write("✅ [startup] Database schema pushed\n");
  } catch (err) {
    process.stderr.write("❌ [startup] Prisma db push FAILED: " + err.message + "\n");
    process.exit(1);
  }
}

console.log("");
console.log("🗄️  Connessione al database...");
if (!global.prisma) {
  global.prisma = new PrismaClient();
}
const prisma = global.prisma;

async function connectDB() {
  try {
    await prisma.$connect();
    console.log("✅ Database connesso");
  } catch (err) {
    console.error("");
    console.error("❌ ERRORE: Impossibile connettersi al database:", err.message);
    process.exit(1);
  }
}

console.log("");
console.log("⚙️  Avvio Next.js...");

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  console.log("✅ Next.js pronto");
  await connectDB();

  const httpServer = createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error("❌ Next.js request handler error:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    });
  });

  httpServer
    .once("error", (err) => {
      console.error("");
      console.error("❌ ERRORE HTTP Server:", err.message);
      if (err.code === "EADDRINUSE") {
        console.error(`   La porta ${port} è già in uso da un altro processo.`);
      } else if (err.code === "EACCES") {
        console.error(`   Permessi insufficienti per la porta ${port}.`);
      }
      process.exit(1);
    })
    .listen(port, () => {
      console.log("");
      console.log("╔══════════════════════════════════════════╗");
      console.log(`║   ✅ Server in esecuzione!              ║`);
      console.log(`║   🌐 http://${hostname}:${port}                  ║`);
      if (process.env.GIPHY_API_KEY) {
        console.log("║   🎨 GIF: ✓ GIPHY configurato            ║");
      } else {
        console.log("║   ⚠️  GIF: GIPHY_API_KEY mancante       ║");
      }
      console.log(`║   📦 Ambiente: ${dev ? "Sviluppo" : "Produzione"}               ║`);
      console.log("╚══════════════════════════════════════════╝");
      console.log("");
    });
});
