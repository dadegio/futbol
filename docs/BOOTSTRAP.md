# Bootstrap account iniziali

L'endpoint `POST /api/setup` serve esclusivamente al bootstrap iniziale, quando la tabella utenti è ancora vuota.

## Sviluppo locale

Se `SETUP_SECRET` non è configurato e `NODE_ENV` non è `production`, è sufficiente:

```bash
curl -X POST http://localhost:3000/api/setup
```

La risposta contiene le credenziali temporanee create per:

- Super Admin;
- capitani delle squadre attive;
- arbitri attivi.

Le password vengono generate casualmente: conservarle in modo sicuro e cambiarle dopo il primo accesso.

## Produzione

In produzione `SETUP_SECRET` è obbligatorio. La richiesta deve includere l'header `x-setup-secret`:

```bash
curl -X POST https://example.com/api/setup \
  -H "x-setup-secret: $SETUP_SECRET"
```

L'operazione è transazionale: se una creazione fallisce, nessun account parziale viene mantenuto. Se esiste già almeno un utente, l'endpoint risponde con `409` e non crea nulla.

Non committare mai password generate, `SETUP_SECRET` o risposte reali dell'endpoint nel repository.
