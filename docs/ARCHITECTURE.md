# Architettura modulare

Il progetto resta un monolite Next.js, ma da questa versione viene orientato a un pattern **modular monolith**: un solo deploy, un solo database, ma confini chiari tra domini.

## Regola principale

`src/app` deve contenere routing, pagine e API route sottili. La logica riutilizzabile va spostata progressivamente in `src/modules`.

```text
src/
  app/              # routing Next.js e composizione pagine/API
  modules/          # domini applicativi
  shared/           # futuri helper cross-domain
  generated/        # Prisma client generato
lib/                # helper infrastrutturali condivisi non ancora assegnati a un dominio
```

## Moduli introdotti

```text
src/modules/auth/          # sessione server
src/modules/permissions/   # permessi e guardie server
src/modules/bookings/      # regole finestra prenotazioni
src/modules/fields/        # regole campi e slot
src/modules/referees/      # disponibilità, conflitti, ribilanciamento
src/modules/core/          # helper API/errori comuni
```

## Stato della compatibilità legacy

I wrapper temporanei in `lib/` usati durante la migrazione sono stati rimossi. Il codice deve importare direttamente dal modulo proprietario (`src/modules/<dominio>/...`). `lib/` resta solo per helper infrastrutturali o cross-domain che non hanno ancora un proprietario naturale.

## Direzione per le prossime versioni

1. rendere le API route sempre più sottili;
2. spostare i casi d'uso in `modules/*/application`;
3. spostare le regole pure in `modules/*/domain`;
4. centralizzare tutti i controlli ruolo/permesso in `modules/permissions`;
5. aggiungere audit log e test sulle regole pure.

## V20 - Application Services

Da V20 le API route devono diventare principalmente adapter HTTP: leggono parametri/body, chiamano un caso d'uso e traducono il risultato in JSON.

```text
src/modules/<dominio>/
  domain/          # validazioni e regole pure
  application/     # casi d'uso con Prisma, permessi già verificati dalle route o dal service
```

Primi casi d'uso estratti:

```text
src/modules/matches/application/
  match-scheduling.ts      # prenotazione slot, liberazione slot, cambio data
  match-officials.ts       # stato arbitri e override manuale
  save-match-result.ts     # salvataggio risultato, distinta, statistiche e sync playoff

src/modules/sponsors/
  domain/sponsor-input.ts
  application/sponsor-service.ts

src/modules/media/
  domain/media-input.ts
  application/media-service.ts
```

Le route interessate restano compatibili con gli endpoint esistenti, ma non contengono più la logica principale del dominio. Le prossime feature dovrebbero seguire questo schema invece di aggiungere ulteriore business logic dentro `src/app/api`.

## V21 - Presentation layer split

La cartella `src/app` deve restare il più possibile uno strato di routing Next.js. Le pagine e i componenti più legati al dominio vengono spostati in `src/modules/*/presentation`, mentre i file in `src/app` diventano wrapper sottili.

Esempi:

```txt
src/app/leagues/[leagueId]/media/page.tsx
  -> importa src/modules/media/presentation/MediaCenterPage.tsx

src/app/leagues/[leagueId]/creator/page.tsx
  -> importa src/modules/media/presentation/CreatorStudioPage.tsx

src/app/leagues/[leagueId]/sponsors/page.tsx
  -> importa src/modules/sponsors/presentation/SponsorsPage.tsx
```

Regola pratica per le prossime feature:

- `src/app/**/page.tsx`: routing, params, composizione minima.
- `src/app/api/**/route.ts`: request/response, parsing minimale, chiamata a un application service.
- `src/modules/*/domain`: regole pure.
- `src/modules/*/application`: casi d'uso e orchestrazione.
- `src/modules/*/presentation`: componenti React e pagine di dominio.

Questo mantiene il monolite semplice da deployare, ma impedisce che ogni nuova feature finisca direttamente nelle route Next.js.

## Roadmap architetturale successiva

La prossima estrazione dovrebbe riguardare le pagine ancora grandi:

- `calendar/page.tsx` -> `src/modules/matches/presentation`;
- `teams/[teamId]/page.tsx` -> `src/modules/teams/presentation`;
- `matches/[matchId]/result-form.tsx` -> `src/modules/matches/presentation`;
- statistiche interne -> componenti più piccoli dentro `src/modules/stats/presentation`.

Solo dopo questo passaggio conviene iniziare il lavoro prestazionale più serio: cache lato server, loading states più granulari, lazy loading dei manager admin e ottimizzazione delle query Prisma.

## V22 - Match, team e player page split

Da V22 anche le pagine operative più grandi vengono estratte dal routing Next.js e spostate nel presentation layer dei rispettivi domini.

```txt
src/modules/matches/presentation/
  CalendarPage.tsx
  MatchPage.tsx
  MatchResultForm.tsx

src/modules/teams/presentation/
  TeamsPage.tsx
  TeamDetailPage.tsx

src/modules/players/presentation/
  PlayersPage.tsx
  PlayerDetailPage.tsx
```

I file in `src/app/leagues/[leagueId]/...` restano come wrapper minimi. Questo riduce il rischio che il routing Next.js diventi il punto in cui finiscono insieme UI, stato React, business logic e chiamate API.

Regola pratica da V22 in poi:

- una pagina di dominio complessa nasce in `src/modules/<dominio>/presentation`;
- `src/app` espone solo la route pubblica;
- i vecchi file wrapper possono restare finché non viene completato il refactor dell'intera area;
- le future ottimizzazioni performance vanno applicate nei moduli, non direttamente nelle route.

## V23 — Performance Layer

La V23 introduce una regola pratica: le ottimizzazioni devono migliorare la velocità percepita senza mischiare nuovamente routing, logica di dominio e componenti UI.

### Principi

- Le pagine in `src/app` possono avere `loading.tsx` dedicati, ma la UI riutilizzabile del caricamento resta in `src/modules/core/presentation`.
- Le fetch client molto ripetute e poco sensibili, come le impostazioni pubbliche del torneo, passano da `cachedJson()` in `src/modules/core/client-cache.ts`.
- I dati operativi che cambiano spesso, come risultati, media, sponsor e impostazioni admin, restano caricati con `no-store` o tramite `authFetch`.
- I blocchi admin più pesanti sono caricati in modo lazy con `next/dynamic`, così la pagina admin mostra prima il contenuto principale e poi i moduli secondari.
- Le immagini caricate direttamente con `<img>` devono avere almeno `loading="lazy"` e `decoding="async"`, salvo contenuti above-the-fold esplicitamente eager.

### Cache client

`cachedJson()` deduplica le richieste GET concorrenti e conserva il risultato per pochi secondi. È pensata per dati di cornice come nome, branding e configurazione leggera del torneo. Non va usata per scritture, risultati live, salvataggi o dati che devono essere sempre freschi.

### Prossimi interventi performance

- Spostare progressivamente le pagine più lette a server components con dati iniziali già pronti.
- Ridurre le query Prisma delle dashboard con select più piccoli.
- Aggiungere paginazione reale a media, giocatori e calendario quando i dati aumentano.
- Valutare storage dedicato per media pesanti, con thumbnail generate a monte.

## V24 - League, Playoffs and Content presentation split

The remaining high-traffic page implementations have been moved out of `src/app` and into feature modules:

- `src/modules/leagues/presentation/LeagueHubPage.tsx`
- `src/modules/leagues/presentation/LeagueHomePage.tsx`
- `src/modules/playoffs/presentation/PlayoffsPage.tsx`
- `src/modules/playoffs/presentation/BracketView.tsx`
- `src/modules/playoffs/presentation/SeriesCard.tsx`
- `src/modules/playoffs/presentation/PlayoffSetup.tsx`
- `src/modules/stats/presentation/LeagueTablePage.tsx`
- `src/modules/videos/presentation/VideosPage.tsx`

`src/app` should now remain a thin Next.js routing layer. New feature UI should be placed in the owning module first, then exposed through a route wrapper.

## V25 - API and domain cleanup

La V25 prosegue il lavoro sugli application service: le API route più dense non devono contenere calcoli, transazioni lunghe o regole di dominio.

Nuovi service estratti:

```txt
src/modules/leagues/application/league-service.ts
src/modules/leagues/domain/league-input.ts

src/modules/stats/application/league-stats-service.ts
src/modules/stats/application/league-table-service.ts

src/modules/playoffs/application/playoff-service.ts
```

Le route coinvolte ora si limitano a:

1. leggere `params` e body JSON;
2. verificare i permessi con le guardie esistenti;
3. chiamare il service applicativo;
4. tradurre il risultato o l'errore in `NextResponse`.

Regola da mantenere: quando una route supera poche decine di righe o contiene una transazione Prisma rilevante, va creato un caso d'uso in `src/modules/<dominio>/application` invece di aggiungere altra logica dentro `src/app/api`.

## V26 — Audit Log

Le modifiche operative più sensibili vengono registrate nel modulo `src/modules/audit`.

- `domain/application`: scrittura e lettura log tramite `writeAuditLog` e `listAuditLogs`.
- `presentation`: pannello admin `AuditLogPanel` dentro la pagina amministrazione torneo.
- `api`: endpoint `GET /api/leagues/[leagueId]/audit` riservato ad Admin torneo/Super Admin.

Il log è volutamente non bloccante: se la scrittura dello storico fallisce, l'operazione principale non viene annullata. I metadati vengono sanificati per evitare di salvare password, token, secret o hash.

Eventi tracciati in questa fase:

- tornei creati, aggiornati, eliminati;
- prenotazioni campo create o liberate;
- data partita, arbitro e risultato modificati;
- sponsor creati, aggiornati, eliminati;
- contenuti media creati, aggiornati, eliminati;
- playoff creati, eliminati, avanzati o aggiornati;
- utenti creati, eliminati o password aggiornata.

## V27 hardening layer

La V27 aggiunge un primo livello trasversale di hardening, mantenendo invariati database e UI.

### Security headers

Le intestazioni di sicurezza vengono gestite in `next.config.ts` e applicate globalmente alle pagine. Le API rispondono con `Cache-Control: no-store` per evitare cache accidentale di risposte operative o dati autenticati.

### Rate limiting leggero

`src/modules/core/security/rate-limit.ts` contiene un rate limiter in memoria pensato per ridurre abuso e richieste ripetute su endpoint sensibili. È deliberatamente semplice: funziona bene come guardia base su singola istanza serverless, ma non sostituisce un rate limiter distribuito Redis/Upstash se l'app viene usata ad alto traffico.

Endpoint protetti in V27:

- login;
- upload immagini generico;
- upload media creator/admin.

### Upload validation

`src/modules/core/security/upload-validation.ts` centralizza:

- MIME type ammessi;
- dimensioni massime;
- normalizzazione nome file;
- blocco dei formati non previsti, compresi SVG caricati come immagini.

### User input

`src/modules/core/security/user-input.ts` centralizza normalizzazione username e policy password. I nuovi account usano username normalizzati in minuscolo e password minime da 8 caratteri.

## V28 — Quality Gate

La V28 aggiunge un livello di controllo pre-deploy senza modificare runtime, database o UI.

Nuovi script:

```txt
scripts/check-architecture.mjs
scripts/check-env.mjs
scripts/quality-gate.mjs
```

Nuovi comandi npm:

```txt
npm run doctor
npm run quality
npm run predeploy
npm run predeploy:full
```

Il quality gate verifica soprattutto i confini introdotti nelle versioni modulari:

- i wrapper legacy rimossi non devono essere reintrodotti;
- `@/modules/*` deve essere configurato correttamente;
- i domain module non devono dipendere da React, Next.js o Prisma;
- le API route non devono importare componenti dal presentation layer;
- le migration devono essere complete.

Regola pratica: prima del push usare `npm run modernization` e `npm run build`; prima di un deploy importante usare `npm run predeploy`.

## V29 — Admin Presentation Split

La V29 completa la pulizia delle ultime route UI corpose segnalate dal quality gate, spostando anche l'amministrazione globale e l'amministrazione torneo nel presentation layer modulare.

Nuovi file principali:

```txt
src/modules/admin/presentation/AdminUsersPage.tsx
src/modules/admin/presentation/LeagueAdminPage.tsx
```

Le route pubbliche restano in `src/app`, ma sono wrapper minimi:

```txt
src/app/admin/users/page.tsx
src/app/leagues/[leagueId]/admin/page.tsx
```

Da questa versione le nuove schermate admin non dovrebbero nascere direttamente dentro `src/app`: la route espone l'URL, mentre stato React, fetch client e composizione UI vanno in `src/modules/admin/presentation` o nel modulo proprietario della feature.

## V30-V33 modernization

La chiusura del refactor segue quattro regole operative:

1. le pagine pubbliche ad alto traffico devono preferire endpoint aggregati, come `/api/leagues/[leagueId]/overview`, invece di comporre molti endpoint nel browser;
2. le route API devono restare sottili e delegare a service in `src/modules/*/application`;
3. le query più frequenti devono avere indici Prisma espliciti e migration dedicate;
4. upload e storage devono passare da adapter applicativi, così Vercel Blob, filesystem locale e futuri provider restano intercambiabili.

### Performance

- `league-overview-service.ts` prepara i dati minimi per la home torneo in una sola chiamata.
- `league-schedule-service.ts` contiene lettura, creazione manuale e generazione calendario.
- `publicApiCacheHeaders()` consente cache CDN breve per endpoint pubblici senza toccare le API admin.

### Storage media

- `media-storage.ts` centralizza upload, validazione, nomi sicuri e fallback locale.
- In produzione va configurato `BLOB_READ_WRITE_TOKEN`: il fallback locale serve solo per sviluppo.

## V34 — API boundary e sessioni HttpOnly

La V34 chiude il primo ciclo del modular monolith imponendo un confine esplicito tra routing HTTP e accesso dati.

### Regola API

Da questa versione `src/app/api/**/route.ts` **non può importare Prisma direttamente**. Ogni route deve:

1. leggere parametri, query string e body;
2. applicare le guardie di autorizzazione;
3. chiamare un application service del modulo proprietario;
4. tradurre risultato ed errori in `NextResponse`.

Il controllo è automatico in `scripts/check-architecture.mjs`: un nuovo import di `@/lib/prisma` da una API route fa fallire il quality gate.

I principali casi d'uso ora vivono in:

```txt
src/modules/admin/application/
src/modules/auth/application/
src/modules/bookings/application/
src/modules/fields/application/
src/modules/matches/application/
src/modules/media/application/
src/modules/players/application/
src/modules/referees/application/
src/modules/teams/application/
```

### Sessione browser

La sessione primaria non viene più conservata in `localStorage`. Il login imposta il token firmato in un cookie:

```txt
HttpOnly
Secure in produzione
SameSite=Lax
Path=/
TTL 7 giorni
```

`getServerSession()` legge prima il cookie e mantiene temporaneamente il supporto `Authorization: Bearer` per migrare senza logout forzato le sessioni create dalle versioni precedenti. `/api/auth/me` converte automaticamente un Bearer legacy valido nel cookie HttpOnly e il client elimina poi il vecchio valore da `localStorage`.

Questa scelta permette ai futuri Server Components di conoscere la sessione senza dipendere dal browser e riduce l'esposizione del token a codice JavaScript lato client.

### Quality gate

- `npm run modernization` esegue i controlli architetturali e i controlli dei service V30-V33.
- `npm run quality` include anche il typecheck TypeScript.
