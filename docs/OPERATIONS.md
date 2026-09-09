# Operations checklist

Questa pagina raccoglie i controlli operativi da eseguire prima dell'inizio del torneo e dopo modifiche importanti.

## Deploy

Prima del push:

```bash
npm run modernization
npm run build
```

Dopo il push devono risultare verdi sia **GitHub Actions / Quality Gate** sia il deployment Vercel.

Il controllo di disponibilità minimale è esposto su:

```text
GET /api/health
```

Restituisce solamente stato database, latenza e timestamp; non espone configurazione o credenziali.

## Variabili e segreti

Non versionare mai credenziali. In locale usare file `.env*` ignorati da Git; in produzione usare le variabili ambiente di Vercel e, per la CI, GitHub Secrets quando necessari.

Variabili sensibili principali:

- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SECRET`
- `SETUP_SECRET`
- `BLOB_READ_WRITE_TOKEN`
- `TEST_DATABASE_URL`
- `TEST_DIRECT_URL`

`npm run check:hygiene` verifica i casi più comuni di file sensibili versionati accidentalmente.

## Database

Prima dell'avvio del torneo:

1. verificare che le migration siano tutte applicate;
2. verificare nel provider PostgreSQL/Neon che backup o point-in-time recovery siano configurati secondo il piano utilizzato;
3. effettuare almeno una prova di ripristino su un branch/database non di produzione;
4. non usare il database reale per i test di integrazione.

I test di integrazione richiedono `TEST_DATABASE_URL` e usano uno schema temporaneo. In CI viene utilizzato il PostgreSQL effimero del job.

## Media

In produzione gli upload devono utilizzare Vercel Blob. L'assenza di `BLOB_READ_WRITE_TOKEN` deve essere trattata come errore di configurazione, non come fallback verso il filesystem di Vercel.

Prima di cancellare vecchi file da `public/uploads`, verificare che nessun record del database li referenzi ancora.

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
