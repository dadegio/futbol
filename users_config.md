Instructions to create accounts:

Run the migration locally (Prisma needs network access to download its engine):

```bash
npx prisma migrate dev --name add_user_auth
```

Start the dev server:

```bash
npm run dev
```

Seed the accounts (one-time only):

```bash
curl -X POST http://localhost:3000/api/setup
```

The response will be a JSON table with all generated credentials, something like:

```json
{
  "admin": {
    "username": "admin",
    "password": "***"
  },
  "captains": [
    { "username": "roma", "password": "***", "team": "Roma" },
    { "username": "juventus", "password": "***", "team": "Juventus" }
  ]
}
```

The captain username is the URL-slugified version of the team name (lowercase, spaces → hyphens).

### Security reminder

Change the admin password immediately after first login if the app is public-facing.
