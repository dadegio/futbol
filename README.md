# FUTBOL / FUTPOLI gestionale torneo

Applicazione Next.js per la gestione del torneo amatoriale FUTPOLI: leghe, squadre, giocatori, calendario, risultati, classifiche, statistiche e area admin.

## Regole FUTPOLI recepite nel codice

- Formula campionato: girone unico con andata e ritorno.
- Il numero di squadre non è prefissato: il calendario viene calcolato usando
  tutte le squadre attive presenti nel torneo e gestisce anche i numeri dispari.
- Rosa massima: 14 giocatori per squadra.
- Distinta gara obbligatoria: ogni squadra deve avere almeno 8 giocatori autorizzati.
- Un giocatore è utilizzabile in distinta solo se risulta autorizzato e con documentazione minima completa.
- Quota giocatore: 0,50 € per ogni presenza in distinta.
- Arbitro: 20,00 € a partita, quindi 10,00 € per squadra.
- Certificato medico non obbligatorio: resta gestita la dichiarazione sanitaria nel modulo unico.
- Wildcard: campo tracciato a livello giocatore, ma regola sportiva finale ancora da decidere.

## Area admin torneo

Per gli admin è disponibile la pagina:

```txt
/leagues/[leagueId]/admin
```

La pagina è organizzata come centro di controllo a sezioni:

- Panoramica: stato rose, avanzamento campionato, quote e costi;
- Identità grafica e privacy/annunci;
- Competizione e playoff;
- Campi e slot;
- Arbitri;
- Sponsor;
- Media e creator;
- Registro attività.

Viene montato solo il modulo attivo, evitando di caricare contemporaneamente tutte le aree amministrative.

## Stato amministrativo giocatore

Ogni giocatore ha uno stato:

- `PENDING` = da completare;
- `IN_REVIEW` = in verifica;
- `AUTHORIZED` = autorizzato;
- `BLOCKED` = bloccato;
- `SUSPENDED` = squalificato;
- `RETIRED` = ritirato.

Per poter essere selezionato in distinta, un giocatore deve avere:

- stato `AUTHORIZED`;
- modulo firmato;
- consenso privacy;
- consenso foto interna/riconoscimento;
- dichiarazione salute/responsabilità personale.

La liberatoria media/foto pubblica resta tracciata ma non blocca la presenza in distinta, perché serve per contenuti pubblici e promozionali.

## Distinta gara e statistiche

La pagina partita permette di:

- selezionare i giocatori presenti in distinta;
- controllare il minimo tassativo di 8 giocatori per squadra;
- impedire la selezione di giocatori non autorizzati;
- inserire risultato, gol e assist;
- salvare presenze e statistiche in modo separato.

Le presenze non sono più dedotte dalle statistiche: un giocatore può avere presenza anche con 0 gol e 0 assist.

## Database Prisma

Modelli principali:

- `League`
- `Team`
- `Player`
- `Match`
- `MatchSheetPlayer`
- `MatchPlayerStat`
- `PlayoffSeries`
- `User`

La migration `20260626211500_futpoli_admin_rules` aggiunge:

- enum `PlayerStatus`;
- campi documentali/admin sul giocatore;
- campo `refereeCostCents` sulla partita;
- tabella `MatchSheetPlayer` per la distinta gara.

## Riutilizzo e rimozione delle squadre

Durante la creazione di un torneo l'admin può cercare e selezionare tutte le
squadre già registrate, comprese quelle rimosse da un torneo precedente. Nel
nuovo torneo vengono copiati profilo, stemma, descrizione e rosa completa; lo
storico delle partite resta invece nel torneo di origine.

Dalla pagina Squadre l'admin può rimuovere una squadra dal torneo:

- una squadra completamente vuota viene eliminata definitivamente;
- una squadra con profilo, rosa, account o storico viene solo disattivata e
  resta disponibile per un riutilizzo successivo;
- gli incontri futuri ancora vuoti vengono rimossi automaticamente;
- se la squadra è già collegata a un tabellone playoff, occorre prima eliminare
  o reimpostare i playoff per non compromettere il bracket.

La migration `20260807150000_add_team_tournament_membership` aggiunge il campo
`Team.activeInLeague`, usato per distinguere le squadre attive da quelle
conservate nel catalogo.

## Campi, prenotazioni, arbitri e sponsor

Gli slot settimanali sono definiti in `src/modules/fields/domain/field-slots.ts`. Gli intervalli
20:00–22:00 sono configurati come due partite da un'ora, con inizio alle 20:00
e alle 21:00.

La generazione del calendario offre due modalità:

- solo accoppiamenti, con prenotazione successiva da parte dei capitani;
- assegnazione automatica dei campi fissi a partire da data e ora selezionate.

Il calendario usa tutte le squadre attive presenti nel torneo, senza richiedere
un numero prefissato. Sono necessarie almeno due squadre; con un numero dispari
lo scheduler inserisce automaticamente il turno di riposo.

La data di inizio è modificabile in entrambe le modalità. Ogni giornata viene
collegata a una specifica settimana e, dalla pagina di una partita, sono
mostrati esclusivamente i sette slot di quella settimana. Admin e capitani
delle due squadre possono prenotare o cambiare uno slot; il server rifiuta sia
gli slot di settimane diverse sia le doppie prenotazioni.

Ogni partita ha un solo arbitro, selezionato dall'elenco gestito nella pagina
admin del torneo. Sebastiano Marcato, Yuri Caridi e Mohamed El Orche vengono
aggiunti automaticamente e distribuiti a rotazione quando si genera il
calendario. L'admin può aggiungere o disattivare arbitri e generare credenziali
temporanee casuali. Il ruolo `REFEREE` può modificare risultato, distinta, gol
e assist soltanto per le partite che gli sono state assegnate; non può gestire
calendario, campi, utenti o impostazioni.

Per il logo sponsor è sufficiente aggiungere `public/sponsor-logo.png`. In
alternativa si possono impostare:

```env
NEXT_PUBLIC_SPONSOR_NAME="Nome sponsor"
NEXT_PUBLIC_SPONSOR_LOGO_URL="/sponsor-logo.png"
NEXT_PUBLIC_SPONSOR_URL="https://campingbar.it/"
```

Se il file non è ancora presente, il sito mostra automaticamente un segnaposto.
Il logo compare nella home, nell'overview del torneo, nel calendario e nel
Match Center. In assenza della variabile URL, il collegamento usa direttamente
`https://campingbar.it/`.

## Playlist YouTube

La sezione Video accetta sia l'URL completo sia il solo ID della playlist.
Anche un valore copiato da YouTube con il parametro `&si=...` viene ripulito
automaticamente. Il player della playlist resta disponibile anche quando il
feed XML usato per costruire l'elenco laterale non risponde.

## Sviluppo

```bash
npm ci
DIRECT_URL="postgresql://..." npm run build
npm run dev
```

Il progetto usa Prisma 7 con client generato in `src/generated/prisma`.

Per il bootstrap iniziale degli account vedere `docs/BOOTSTRAP.md`.

## V27 — Hardening leggero

La V27 aggiunge un primo livello di sicurezza applicativa senza migration:

- security headers globali e `Cache-Control: no-store` sulle API;
- rate limiting leggero su login, setup e upload;
- validazione centralizzata dei file caricati;
- blocco upload SVG come immagini;
- normalizzazione username in minuscolo per i nuovi utenti;
- password minima 8 caratteri per i nuovi utenti e per reset password;
- messaggi di errore login più sicuri, senza dettagli interni.

## Quality gate pre-deploy

La V28 aggiunge controlli locali per ridurre gli errori scoperti solo su Vercel.

Comandi utili:

```bash
npm run doctor         # controllo rapido, non blocca se mancano env locali
npm run modernization  # architettura + service checks + test dominio + TypeScript
npm run build          # build production Next.js
npm run predeploy      # env + quality gate + build
```

Workflow consigliato prima del push:

```bash
npm run modernization
npm run build
git add .
git commit -m "..."
git push origin main
```

Il documento completo è in `docs/QUALITY_GATE.md`.

### Test PostgreSQL end-to-end

Per verificare migration, transazioni Prisma, risultati, statistiche, classifica e
playoff usa un database PostgreSQL dedicato ai test:

```bash
cp .env.test.example .env.test.local
# configura TEST_DATABASE_URL e opzionalmente TEST_DIRECT_URL
npm run test:integration
```

Ogni esecuzione usa uno schema temporaneo isolato e lo elimina al termine. Il runner
non ripiega mai su `DATABASE_URL`, così un comando di test non può usare per errore
il database normale dell'applicazione.
