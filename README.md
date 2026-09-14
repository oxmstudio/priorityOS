# PriorityOS

PriorityOS is a Vercel-ready version of the Priority Manager prototype with:

- the original dark liquid-glass frontend aesthetic preserved
- Google Calendar OAuth connection
- server-side Calendar event creation, priority updates, and event deletion
- Vercel Blob persistence per connected Google account
- a local-first development mode for testing the UI without a Google account or Vercel Blob

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` for the normal hosted-style development experience.

### Phase 1: visual local mode

Phase 1 adds a browser-only local mode so the UI can be developed and visually tested without connecting Google or relying on Vercel Blob.

Start the app with:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000/dashboard?local=1
```

Local mode:

- uses browser `localStorage` for PriorityOS workspace state
- keeps Business and Personal workspaces separate
- keeps statistics, habits, tasks, notes, and calendar data locally
- preserves the same dashboard UI and components used by production
- clearly labels the dashboard as `Local mode`
- disables Google Calendar import because there is no Google connection
- does not change the normal `/dashboard` production behavior

To reset the Phase 1 local data, open the browser developer tools and remove the `priorityos.local.state.v1` local-storage entry for `localhost`.

Mood Board image files remain on the existing server-backed image path during Phase 1. Local image/file storage is intentionally deferred to Phase 2 so the storage migration can be tested separately.

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

For local testing of the cloud-backed version, also add:

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

The Phase 1 client storage adapter now sits between the dashboard UI and those server APIs. Production continues to use the existing API routes, while `?local=1` switches the dashboard to browser-local state.

## Deployment

Push to GitHub, import the repo into Vercel, set the environment variables, connect Blob storage, then deploy.
