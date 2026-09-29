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

Capacitor is configured as the native Android boundary around the existing PriorityOS UI. The browser implementation remains the reference local-first implementation; native storage can be moved behind the same storage adapter in a later step without rewriting the dashboard.

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

Then run:

```bash
npm run cap:dev
```

`cap:dev` configures Capacitor for the standard Android emulator host address (`10.0.2.2`), uses `?local=1`, and syncs the Android project. After that, open Android Studio with:

```bash
npm run cap:open
```

For a physical Android device, set the host address explicitly. For example:

```bash
set CAPACITOR_HOST=192.168.1.50
npm run cap:dev
```

On macOS/Linux:

```bash
CAPACITOR_HOST=192.168.1.50 npm run cap:dev
```

The `?local=1` flag is intentional: it keeps the Android shell on PriorityOS's local storage path and prevents Google/Vercel dependencies from being used during development.

### Standalone Android build

The installed Android app is local-first and does not require the Next.js development server, Vercel, Vercel Blob, or Google login for its core workspace data.

Native structured state is stored with Capacitor Filesystem, and Mood Board image files are stored in the app's native data directory. Browser local mode continues to use localStorage + IndexedDB.

Build the standalone web bundle and sync it into Android with:

```bash
npm run cap:build
npx cap sync android
```

For a directly installable debug APK:

```bash
npm run cap:apk
```

The APK is created at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

`cap:build` temporarily removes the server-only `app/api` tree while running the Next.js static export, then restores it before returning. This keeps the hosted Vercel API implementation intact while producing a self-contained native web bundle.

The normal development workflow remains:

```text
Windows PC
  ↓
Next.js dev server
  ↓
Capacitor live-reload Android shell
```

The production phone workflow is:

```text
PriorityOS source
  ↓
Next.js static native export
  ↓
Capacitor Android
  ↓
APK
  ↓
Android phone
```

The native app automatically enters local mode through `Capacitor.isNativePlatform()`, so `?local=1` is not required for the installed APK.

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
