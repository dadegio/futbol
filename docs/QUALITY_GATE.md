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
