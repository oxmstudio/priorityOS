# PriorityOS

PriorityOS is a Vercel-ready version of the Priority Manager prototype with:

- the original dark liquid-glass frontend aesthetic preserved
- Google Calendar OAuth connection
- server-side Calendar event creation, priority updates, and event deletion
- Vercel Blob persistence per connected Google account
- local browser fallback before Calendar is connected

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Required environment variables

Create these in Vercel Project Settings → Environment Variables:

```bash
BLOB_READ_WRITE_TOKEN=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-vercel-domain.vercel.app/api/auth/callback
NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
APP_SESSION_SECRET=
```

Generate `APP_SESSION_SECRET` with:

```bash
openssl rand -base64 32
```

## Vercel Blob setup

1. In Vercel, open the project.
2. Go to Storage.
3. Create or connect a Blob store.
4. Vercel should add `BLOB_READ_WRITE_TOKEN` to the project automatically.

The app stores state as JSON under `priorityos/<hashed-google-email>.json`.

## Google Calendar OAuth setup

1. Open Google Cloud Console.
2. Create or select a project.
3. Enable the Google Calendar API.
4. Configure the OAuth consent screen.
5. Create OAuth Client credentials for a **Web application**.
6. Add this Authorized redirect URI:

```text
https://your-vercel-domain.vercel.app/api/auth/callback
```

For local testing, also add:

```text
http://localhost:3000/api/auth/callback
```

The app requests only profile/email identity plus `calendar.events`, which lets it create, patch, and delete events it manages.

## What changed from the prototype

The original single-file prototype attempted to call a calendar assistant directly from the browser. This version keeps secrets server-side:

- `/api/auth/google` starts OAuth
- `/api/auth/callback` stores encrypted Google tokens in an HttpOnly cookie
- `/api/auth/status` checks the connection
- `/api/state` reads/writes PriorityOS state in Vercel Blob
- `/api/calendar/events` creates, updates, and deletes Google Calendar events

## Deployment

Push to GitHub, import the repo into Vercel, set the environment variables, connect Blob storage, then deploy.
