# Migrazione Vercel Blob -> Cloudinary + Google Drive

Questa procedura migra i riferimenti ancora presenti nel database:

- asset pubblici (`League.brandLogoUrl`, `League.brandCoverUrl`, `Team.badgeUrl`, `Sponsor.logoUrl`, `Player.photoUrl`, `CreatorProfile.avatarUrl`) -> **Cloudinary**;
- contenuti del Media Center (`MediaItem.fileUrl`, `MediaItem.thumbnailUrl`) -> **Google Drive**.

Lo script aggiorna il database **solo dopo** che il nuovo upload è riuscito. In caso di errore, il vecchio URL resta invariato e la migrazione può essere rilanciata.

## Prerequisiti

Il file `.env` locale deve puntare allo stesso database da migrare e contenere:

```env
DATABASE_URL="..."
# oppure DIRECT_URL="..."

PUBLIC_IMAGE_STORAGE_PROVIDER="cloudinary"
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."

MEDIA_STORAGE_PROVIDER="google_drive"
GOOGLE_DRIVE_FOLDER_ID="..."
GOOGLE_DRIVE_CLIENT_ID="..."
GOOGLE_DRIVE_CLIENT_SECRET="..."
GOOGLE_DRIVE_REFRESH_TOKEN="..."
```

Non versionare mai i valori reali.

## 1. Inventario senza modifiche

```bash
npm run storage:migrate:blob
```

È un dry-run: conta i riferimenti Blob e non modifica file né database.

È possibile limitare il controllo:

```bash
npm run storage:migrate:blob -- --public-only
npm run storage:migrate:blob -- --media-only
```

## 2. Migrazione reale

Tutto:

```bash
npm run storage:migrate:blob -- --execute
```

Solo asset pubblici:

```bash
npm run storage:migrate:blob -- --execute --public-only
```

Solo Media Center:

```bash
npm run storage:migrate:blob -- --execute --media-only
```

Al termine lo script esegue anche un audit delle colonne testuali del database. Non eliminare il Blob Store finché il report non indica zero riferimenti residui e l'app non è stata verificata manualmente.

## Nota sul limite Vercel Blob Hobby

La migrazione deve poter leggere i byte dei vecchi Blob. Se il piano Hobby ha già raggiunto il limite di Blob Data Transfer, i download possono essere rifiutati anche se la lista dei file è ancora consultabile. In quel caso non forzare la cancellazione del vecchio store: attendi il ripristino dell'accesso, chiedi a Vercel un accesso temporaneo di export, oppure esegui la migrazione durante un periodo in cui il Blob Store è nuovamente leggibile.

## Verifica finale

Dopo la migrazione:

1. apri alcune squadre e giocatori e verifica che le immagini siano servite da `res.cloudinary.com`;
2. entra come creator e verifica che foto/video storici si aprano tramite `/api/media/drive/...`;
3. rilancia il dry-run; deve riportare zero riferimenti Vercel Blob;
4. soltanto dopo queste verifiche elimina o scollega il vecchio Blob Store.
