# Deploy su Vercel + Supabase

Questa guida spiega come deployare Unyvox su Vercel con database PostgreSQL su Supabase, ottenendo un URL pubblico fisso e gratuito.

## Requisiti

- Account gratuito su [Vercel](https://vercel.com)
- Account gratuito su [Supabase](https://supabase.com)
- Repository Git con il codice del progetto

## 1. Configura Supabase

1. Crea un nuovo progetto su Supabase.
2. Vai su **Project Settings > Database** e copia la **Connection string** (modalità "Transaction" o "Session").
3. Vai su **Project Settings > API** e copia:
   - `URL` -> `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` -> `SUPABASE_SERVICE_ROLE_KEY`

## 2. Configura le variabili d'ambiente su Vercel

Nel dashboard di Vercel, aggiungi le seguenti variabili d'ambiente:

```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
NEXTAUTH_URL=https://[TUO-PROGETTO].vercel.app
NEXTAUTH_SECRET=[GENERA_UNA_STRINGA_CASUALE_LUNGA]
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]
GIPHY_API_KEY=[OPZIONALE]
```

Per generare `NEXTAUTH_SECRET` puoi usare:

```bash
openssl rand -base64 32
```

## 3. Deploy

1. Collega il repository Git a Vercel.
2. Vercel rileverà automaticamente Next.js.
3. Prima del primo deploy, prepara il database eseguendo da locale (con `DATABASE_URL` puntando al tuo Supabase):
   ```bash
   npx prisma db push
   ```
   Questo creerà le tabelle sul database Supabase.
4. Al termine del deploy, l'app sarà disponibile su `https://[TUO-PROGETTO].vercel.app`.

## 5. Migrazione dati da SQLite (opzionale)

Se hai dati esistenti nel file SQLite `prisma/dev.db`, devi migrarli manualmente a Supabase. Puoi usare strumenti come:

- [pgloader](https://pgloader.io/)
- [DBeaver](https://dbeaver.io/)
- Esportazione/importazione CSV da Supabase Dashboard

## Note importanti

- Il piano gratuito di Vercel ha limiti di banda e risorse, ma è sufficiente per un uso personale.
- Il piano gratuito di Supabase ha limiti di spazio e connessioni, ma è sufficiente per un uso personale.
- I piani gratuiti possono cambiare nel tempo, ma sono stabili da anni.
- Le funzionalità real-time (chat, notifiche, chiamate) usano i **broadcast channels** di Supabase Realtime invece di Socket.io. Non è necessario abilitare il Postgres CDC/Realtime sulle singole tabelle.

## Troubleshooting

- Se il build fallisce con errori di Prisma, assicurati che `DATABASE_URL` sia corretto e che il database sia accessibile.
- Se le funzionalità real-time non funzionano, verifica che le variabili `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` siano corrette.
- Se vedi errori di connessione al database, assicurati di usare la connection string corretta da Supabase (non localhost).
