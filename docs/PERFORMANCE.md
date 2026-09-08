# Performance checklist

## Prima linea

- La home torneo deve usare `/api/leagues/[leagueId]/overview`.
- Le pagine pubbliche possono usare cache CDN breve.
- Le pagine admin, upload, login, audit e mutation devono restare `no-store`.

## Database

Indici aggiunti nella V31:

- `Match(leagueId, seriesId, date)`
- `Match(leagueId, seriesId, round)`
- `Sponsor(leagueId, active, sortOrder)`
- `MediaItem(leagueId, status, createdAt)`
- `MediaItem(leagueId, featured, createdAt)`
- `MediaItem(leagueId, type, status)`
- `Player(teamId, status)`

## Media

In produzione configurare sempre:

```text
BLOB_READ_WRITE_TOKEN
```

Senza token, gli upload funzionano in locale ma non sono persistenti su Vercel.

## Comandi

```bash
npm run modernization
npm run quality
npm run build
```
