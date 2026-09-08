# Quality Gate

La V28 introduce un quality gate leggero per intercettare gli errori prima del push su Vercel.

## Comandi principali

```bash
npm run doctor
```

Controllo rapido non bloccante sull'ambiente locale e sulla struttura modulare.

```bash
npm run quality
```

Controllo pre-commit consigliato. Esegue:

1. `check:architecture`
2. `typecheck`

```bash
npm run predeploy
```

Controllo completo prima del push/deploy. Esegue:

1. verifica variabili ambiente essenziali;
2. quality gate;
3. build Next.js.

## Controlli architetturali

Lo script `scripts/check-architecture.mjs` verifica che:

- `src/modules` sia presente;
- `@/modules/*` punti a `./src/modules/*` in `tsconfig.json`;
- i wrapper storici in `lib/` puntino a moduli esistenti;
- i moduli non importino dal routing `src/app`;
- i domain module restino privi di dipendenze da Prisma, React, Next.js e `NextResponse`;
- le API route non importino componenti dal presentation layer;
- ogni cartella di migration Prisma contenga `migration.sql`.

Gli avvisi non bloccano il comando, ma indicano aree da pulire nelle prossime versioni.

## Controllo ambiente

Lo script `scripts/check-env.mjs` legge anche `.env` e `.env.local` se presenti.

Variabili richieste in modalità bloccante:

- `DATABASE_URL`
- `AUTH_SECRET`

Variabili consigliate o condizionali:

- `BLOB_READ_WRITE_TOKEN`
- `NEXT_PUBLIC_APP_URL`
- `YOUTUBE_PLAYLIST_ID`

Per un controllo non bloccante:

```bash
node scripts/check-env.mjs --soft
```

## Workflow consigliato

Prima di ogni patch o push:

```bash
git status
npm run quality
npm run build
```

Prima di un deploy importante:

```bash
npm run predeploy
git add .
git commit -m "..."
git push origin main
```

Se `npm run build` passa in locale, Vercel dovrebbe intercettare molti meno errori TypeScript al push.

## Test di integrazione PostgreSQL

I test veloci di dominio (`npm test`) non richiedono database e restano parte di
`npm run modernization`. I flussi che coinvolgono Prisma/PostgreSQL si eseguono
separatamente:

```bash
cp .env.test.example .env.test.local
# compila TEST_DATABASE_URL e, se disponibile, TEST_DIRECT_URL
npm run test:integration
```

Il runner **non usa mai `DATABASE_URL` come fallback**. Crea uno schema PostgreSQL
temporaneo `torneo_it_*`, applica l'intera catena `prisma migrate deploy`, esegue i
test e infine elimina lo schema con `CASCADE`. Questo consente di usare anche un
database/branch Neon dedicato ai test senza toccare le tabelle applicative.

Per una verifica completa prima di un merge importante:

```bash
npm run quality:integration
```

Per conservare temporaneamente lo schema in caso di errore e ispezionarlo:

```bash
KEEP_TEST_SCHEMA=1 npm run test:integration
```

## CI GitHub

La workflow `.github/workflows/quality.yml` esegue su ogni push a `main` e su ogni pull request:

1. installazione pulita con Node 22;
2. PostgreSQL 16 isolato;
3. generazione Prisma e migration;
4. `npm run modernization`;
5. `npm run test:integration`;
6. `npm run typecheck`;
7. `npm run build`.

Per riprodurre la stessa sequenza in locale, con `TEST_DATABASE_URL` e `TEST_DIRECT_URL` configurati:

```bash
npm run ci
```
