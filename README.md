# PriorityOS

PriorityOS is a Vercel-ready version of the Priority Manager prototype with:

- the original dark liquid-glass frontend aesthetic preserved
- Google Calendar OAuth connection
- server-side Calendar event creation, priority updates, and event deletion
- Vercel Blob persistence per connected Google account
- a local-first development mode for testing the UI without a Google account or Vercel Blob
- Capacitor scaffolding for a native Android shell

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` for the normal hosted-style development experience.

### Local mode

Local mode can be opened with:

```text
http://localhost:3000/dashboard?local=1
```

When running on `localhost` or `127.0.0.1`, the landing page also detects local mode automatically.

Local mode:

- uses browser `localStorage` for PriorityOS workspace state
- keeps Business and Personal workspaces separate
- keeps statistics, habits, tasks, notes, and calendar data locally
- stores Mood Board image binaries in browser IndexedDB
- serves saved local Mood Board images through the local service worker
- preserves the same dashboard UI and components used by production
- disables Google Calendar import because there is no Google connection
- does not change the normal `/dashboard` production behavior

To reset local structured data, remove the `priorityos.local.state.v1` local-storage entry for the site. Mood Board image files are stored separately in the browser's IndexedDB database `priorityos.local.files.v1`.

## Phase 3: Android shell

Capacitor is now configured as the native Android boundary around the existing PriorityOS UI. The browser implementation remains the reference local-first implementation; native storage can be moved behind the same storage adapter in a later step without rewriting the dashboard.

### Bootstrap the Android project

Run these commands once from the repository root:

```bash
npm install
npx cap add android
npm run cap:sync
```

The generated `android/` project should be committed to Git so Android Studio can open and build the app.

Open it with:

```bash
npm run cap:open
```

### Fast Android UI development

Keep Next.js running in another terminal:

```bash
npm run dev
```

For the Android emulator, point Capacitor at the host machine's Next.js server:

```bash
set CAPACITOR_SERVER_URL=http://10.0.2.2:3000/?local=1
npm run cap:sync
npm run cap:open
```

On macOS/Linux, use:

```bash
CAPACITOR_SERVER_URL=http://10.0.2.2:3000/?local=1 npm run cap:sync
```

The `?local=1` flag is intentional: it keeps the Android shell on PriorityOS's local storage path and prevents Google/Vercel dependencies from being used during development.

### Phase 3 storage boundary

The current architecture is:

```text
PriorityOS UI
    ↓
storageClient.js
    ├── browser localStorage + IndexedDB
    └── future Capacitor native storage
```

Do not replace the working browser IndexedDB implementation yet. The next native-storage step can add Capacitor Filesystem/SQLite behind this boundary, then the app can become fully offline without changing the dashboard components.

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

The client storage adapter sits between the dashboard UI and those server APIs. Production continues to use the existing API routes, while local mode switches the dashboard to browser-local state.

## Deployment

Push to GitHub, import the repo into Vercel, set the environment variables, connect Blob storage, then deploy.
