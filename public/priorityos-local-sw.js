const DB_NAME = 'priorityos.local.files.v1';
const STORE_NAME = 'moodboard';
const DB_VERSION = 1;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Local file database could not be opened.'));
  });
}

function readFile(id) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Local image could not be read.'));
  }));
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith('/api/moodboard/image/')) return;
  const id = decodeURIComponent(url.pathname.split('/').pop() || '');
  if (!id) return;

  event.respondWith((async () => {
    try {
      const stored = await readFile(id);
      if (!stored?.blob) return new Response('Not found', {status: 404});
      return new Response(stored.blob, {
        status: 200,
        headers: {
          'Content-Type': stored.type || stored.blob.type || 'application/octet-stream',
          'Cache-Control': 'no-store'
        }
      });
    } catch (error) {
      return new Response('Local image unavailable', {status: 500});
    }
  })());
});
