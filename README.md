# 📱 InstaClone

Un clone funzionale di Instagram costruito con **Next.js 14**, **TypeScript**, **Tailwind CSS**, **Prisma** e **SQLite**.

## 🚀 Funzionalità

- 🔐 Autenticazione con email/password (NextAuth)
- 🏠 Feed personalizzato
- ❤️ Like e commenti
- 👤 Profili utente
- 🔍 Esplora e ricerca
- 📷 Creazione post con upload immagini
- 💬 Messaggi diretti (DM)
- 🔔 Notifiche
- 📱 UI mobile-first responsive

## 🛠️ Installazione rapida con wget

```bash
# Scarica e installa
cd /tmp
wget -O install-instaclone.sh https://raw.githubusercontent.com/tuo-username/instaclone/main/install.sh
bash install-instaclone.sh
```

Oppure manualmente:

```bash
git clone https://github.com/tuo-username/instaclone.git
cd instaclone
npm install
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

Credenziali demo:
- Email: `mario@example.com`
- Password: `password`

## 🌐 Esporre pubblicamente senza port-forwarding

### Opzione 1: Dominio proprio con Cloudflare Tunnel Permanente (migliore)

Se possiedi un dominio (es. `unyvox.com`), questa è la soluzione ideale: l'URL sarà sempre lo stesso, senza redirect visibili e senza port forwarding.

> **Nota:** sostituisci `unyvox.com` con il tuo dominio reale.

```bash
chmod +x setup-cloudflare-tunnel.sh start-permanent.sh

# Configura il tunnel permanente (una sola volta)
DOMAIN=unyvox.com ./setup-cloudflare-tunnel.sh

# Avvia server + tunnel permanente
./start-permanent.sh
```

**Requisiti:**
- Account Cloudflare gratuito
- Dominio proprio con nameserver su Cloudflare
- `cloudflared` installato

### Opzione 2: Script automatico con URL stabile su GitHub Pages

Questa opzione crea un tunnel Cloudflare temporaneo e un URL stabile gratuito su GitHub Pages che reindirizza automaticamente al tunnel attuale. Non richiede port forwarding né carta di credito.

```bash
chmod +x start-public.sh setup-github-redirect.sh

# Solo la prima volta: crea il redirect stabile su GitHub Pages
# (richiede un account GitHub gratuito e un Personal Access Token)
# Crea il token qui: https://github.com/settings/tokens (scope "repo")
export GITHUB_USERNAME="il_tuo_username"
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
./setup-github-redirect.sh

# Avvia il server e il tunnel
./start-public.sh
```

L'URL stabile sarà del tipo `https://TUO-USERNAME.github.io/unyvox-redirect` e si aggiorna automaticamente quando il tunnel Cloudflare cambia.

### Opzione 2: Script automatico (LocalTunnel o ngrok)

```bash
chmod +x start-public.sh
./start-public.sh
```

Lo script avvia l'app e crea automaticamente un tunnel pubblico.

### Opzione 3: LocalTunnel manuale

```bash
npm install -g localtunnel
npm run dev
# In un altro terminale
npx lt --port 3000
```

Otterrai un URL pubblico tipo `https://abc123.loca.lt`.

### Opzione 4: ngrok manuale

```bash
npm install -g ngrok
ngrok http 3000
```

### Opzione 5: Deploy permanente su Vercel

1. Crea un database PostgreSQL su [Supabase](https://supabase.com) o [Neon](https://neon.tech)
2. Copia `.env.example` in `.env` e imposta `DATABASE_URL` con il tuo database PostgreSQL
3. Esegui lo script di deploy:

```bash
chmod +x deploy-vercel.sh
./deploy-vercel.sh
```

4. Imposta `NEXTAUTH_SECRET` e `NEXTAUTH_URL` nelle variabili d'ambiente di Vercel
5. Esegui `npx vercel --prod`

## 📁 Struttura del progetto

```
instaclone/
├── prisma/             # Schema e seed del database
├── src/
│   ├── app/            # Pagine Next.js App Router
│   ├── components/     # Componenti React riutilizzabili
│   ├── lib/            # Configurazioni (Prisma, Auth)
│   └── types/          # Tipi TypeScript
├── public/             # Asset statici
└── ...
```

## 📝 Note

- Il database di default è SQLite (`dev.db`) per semplicità locale.
- Per la produzione si consiglia PostgreSQL.
- Le immagini caricate vengono salvate in `public/uploads/`.

## 📄 Licenza

MIT
