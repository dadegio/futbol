# Operations checklist

Questa pagina raccoglie i controlli operativi da eseguire prima dell'inizio del torneo e dopo modifiche importanti.

## Deploy

Prima del push:

```bash
npm run modernization
npm run build
```

In produzione Vercel, `npm run build` applica automaticamente `prisma migrate deploy` **prima** di generare il Prisma Client e compilare Next.js. Le build Preview non applicano migration al database di produzione. Questo evita che un deploy del codice raggiunga un database rimasto alla migration precedente.

Dopo il push devono risultare verdi sia **GitHub Actions / Quality Gate** sia il deployment Vercel.

Il controllo di disponibilità minimale è esposto su:

```text
GET /api/health
```

Restituisce stato database, compatibilità minima dello schema (`schema: ok|outdated`), latenza e timestamp; non espone configurazione o credenziali. Se il DB risponde ma manca una migration richiesta dall'app, lo stato è `degraded` con `database: ok` e `schema: outdated`.

## Variabili e segreti

Non versionare mai credenziali. In locale usare file `.env*` ignorati da Git; in produzione usare le variabili ambiente di Vercel e, per la CI, GitHub Secrets quando necessari.

Variabili sensibili principali:

- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SECRET`
- `SETUP_SECRET`
- `BLOB_READ_WRITE_TOKEN`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- `GOOGLE_DRIVE_REFRESH_TOKEN`
- `TEST_DATABASE_URL`
- `TEST_DIRECT_URL`

`npm run check:hygiene` verifica i casi più comuni di file sensibili versionati accidentalmente.

## Lifecycle partita e migration V11

La release che introduce bozza/finalizzazione, rinvio/annullamento, MVP e pagamenti quote aggiunge una migration Prisma. Prima di rendere operative le nuove funzioni sul database di produzione:

```bash
npm run db:deploy
```

Il flusso risultato è: **salvataggio bozza → conferma distinta casa/ospite → finalizzazione**. Solo i risultati `FINAL` entrano in classifica, statistiche, quote presenza e dati pubblici. Un admin può riaprire un risultato definitivo; rinvio e annullamento liberano campo, slot e arbitro.

Prima del deploy verificare idealmente:

```bash
npm run modernization
npm run build
npm run test:integration
```

## Database

Prima dell'avvio del torneo:

1. verificare che le migration siano tutte applicate;
2. verificare nel provider PostgreSQL/Neon che backup o point-in-time recovery siano configurati secondo il piano utilizzato;
3. effettuare almeno una prova di ripristino su un branch/database non di produzione;
4. non usare il database reale per i test di integrazione.

I test di integrazione richiedono `TEST_DATABASE_URL` e usano uno schema temporaneo. In CI viene utilizzato il PostgreSQL effimero del job.

## Media

Lo storage è volutamente separato in due canali:

- **immagini pubbliche dell'app** (foto profilo giocatori, loghi squadre, sponsor e upload generici) → Cloudinary;
- **materiale dei creator** caricato dal Media Center → Google Drive, quando `MEDIA_STORAGE_PROVIDER=google_drive`.

Prisma/PostgreSQL conserva solo URL e metadati: non contiene i byte delle immagini o dei video. Gli URL Vercel Blob già presenti nel database continuano a funzionare e non richiedono una migrazione immediata.

Per le immagini pubbliche creare un account Cloudinary Free e configurare in Vercel:

```env
PUBLIC_IMAGE_STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Gli upload generici vengono ridimensionati entro 1600×1600 e convertiti in WebP qualità 82 prima del salvataggio, salvo SVG/GIF. Questo riduce molto il traffico rispetto alle foto originali da più MB. Se `PUBLIC_IMAGE_STORAGE_PROVIDER` non è `cloudinary`, Vercel Blob resta disponibile come fallback tramite `BLOB_READ_WRITE_TOKEN`. Le credenziali Cloudinary restano esclusivamente lato server.

Per i soli contenuti creator configurare Google Drive:

```env
MEDIA_STORAGE_PROVIDER=google_drive
GOOGLE_DRIVE_FOLDER_ID=...
GOOGLE_DRIVE_CLIENT_ID=...
GOOGLE_DRIVE_CLIENT_SECRET=...
GOOGLE_DRIVE_REFRESH_TOKEN=...
```

La route Media Center usa Drive solo quando `target.scope=media`: le foto profilo giocatore e i loghi squadra non vengono mai reindirizzati su Drive. La route proxy `/api/media/drive/<fileId>` legge i file con credenziali server e supporta anche le richieste `Range` per i video.

In sviluppo, in assenza di storage remoto, i fallback locali scrivono in `public/uploads` e `public/media`; entrambe le cartelle sono ignorate da Git.

## Blocco rosa e richieste capitano

La rosa di una squadra viene bloccata automaticamente al calcio d'inizio della sua prima partita `SCHEDULED`, oppure non appena esiste una partita `FINAL`. Prima del lock il capitano può continuare a gestire normalmente squadra e rosa. Dopo il lock, salvataggi, aggiunte, rimozioni e cambi numero del capitano creano una `TeamChangeRequest` in stato `PENDING`; la modifica reale viene applicata solo dopo approvazione dell'admin.

Le foto profilo dei giocatori fanno eccezione: upload, sostituzione, rimozione e inquadratura sono sempre riservati ad ADMIN/LEAGUE_ADMIN, anche prima dell'inizio del torneo. Le distinte partita restano indipendenti dal roster lock.


## Posticipo calendario senza rigenerazione

Dalla pagina **Calendario** un amministratore del torneo può usare **Posticipa calendario** per spostare in avanti il programma senza ricreare gli accoppiamenti. L'operazione:

- mantiene gli stessi record partita, quindi non cambia `homeTeamId`, `awayTeamId`, giornata, casa/trasferta o eventuali riferimenti interni;
- trasla tutte le settimane dalla giornata scelta dello stesso numero di settimane, preservando anche pause e intervalli già presenti nel calendario;
- libera data/ora, campo e prenotazione delle gare interessate, che dovranno essere riconfermati sulle nuove settimane;
- mantiene le distinte selezionate ma azzera le conferme;
- mantiene soltanto gli arbitri assegnati manualmente, mentre quelli automatici vengono ricalcolati quando le gare ricevono un nuovo slot;
- rifiuta l'operazione se nelle gare interessate esistono risultati, statistiche o stati `POSTPONED`/`CANCELLED`.

Per posticipare l'intero torneo selezionare **Giornata 1**. Per spostare solo la parte restante della stagione selezionare la prima giornata da ripianificare.

## Monitoraggio durante le giornate

Controllare almeno:

- `/api/health`;
- errori e deployment Vercel;
- Quality Gate dell'ultimo commit;
- Centro operativo Admin → Partite per gare senza slot, arbitro, distinta o risultato;
- Registro attività per modifiche amministrative recenti.

Per error monitoring centralizzato (ad es. Sentry o servizio equivalente), configurare il provider come intervento dedicato: non inserire DSN o token direttamente nel repository.

## Procedura di emergenza minima

Se una modifica rompe la produzione:

1. evitare modifiche manuali al database come prima risposta;
2. identificare l'ultimo deployment Vercel funzionante;
3. effettuare rollback del deployment o revert del commit;
4. correggere su branch locale;
5. eseguire `npm run modernization` e `npm run build`;
6. lasciare passare il Quality Gate prima del nuovo deploy.

## Reset dati partita

Gli amministratori del torneo possono riportare una partita allo stato precedente all'inserimento di distinta e risultato dalla pagina della gara. Il reset:

- elimina distinta, risultato, marcatori e assist;
- lascia invariati data, slot, campo e arbitro della gara corrente;
- aggiorna automaticamente classifica e statistiche perché i dati derivati vengono ricalcolati dal database;
- viene registrato nell'audit log;
- nei playoff viene bloccato se il turno successivo contiene già dati, per evitare di invalidare una gara già iniziata.

## Costo arbitro

Il costo arbitro è un'informazione operativa della singola gara e **non entra nei conteggi economici del torneo**. Dopo la prenotazione del campo e l'assegnazione dell'arbitro viene mostrato nella pagina partita/distinta:

- €15 per gli arbitri standard;
- €20 per Scoccimarro.

La gestione del pagamento resta direttamente a carico delle squadre coinvolte.
