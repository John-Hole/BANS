const CACHE_NAME = 'bans-player-v13';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './playlist.json',
  './icon.svg'
];

// Estensioni audio da intercettare e gestire
const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.ogg', '.mpeg'];

// Install Event - cache the application shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching application shell');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - clean up old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isAudio = AUDIO_EXTENSIONS.some(ext => url.pathname.toLowerCase().endsWith(ext));

  if (isAudio) {
    // Bypassa il Service Worker per i file audio per farli gestire nativamente dal browser
    return;
  } else {
    // Strategia standard Stale-While-Revalidate per i file dell'interfaccia
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then((cachedResponse) => {
        if (cachedResponse) {
          // Recupera aggiornamento in background per mantenere fresca la cache
          fetch(e.request)
            .then((networkResponse) => {
              if (networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
              }
            })
            .catch(() => {});
          return cachedResponse;
        }
        return fetch(e.request);
      })
    );
  }
});

// Gestione delle richieste audio con supporto Range Requests per compatibilità mobile (iOS/Safari)
async function handleAudioRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  let cachedResponse = await cache.match(request, { ignoreSearch: true });

  if (!cachedResponse) {
    console.log(`[Service Worker] File audio non in cache, recupero dal server: ${request.url}`);
    try {
      // Per poter salvare il file intero in cache, rimuoviamo l'header Range dalla richiesta di rete.
      // Se lasciamo l'header Range, il server potrebbe rispondere con un 206 Partial Content,
      // che non può essere memorizzato correttamente per riproduzioni offline con altri range.
      const cleanRequest = new Request(request.url, {
        method: 'GET',
        headers: new Headers()
      });
      
      const networkResponse = await fetch(cleanRequest);
      
      if (networkResponse.status === 200) {
        // Mettiamo il file intero in cache
        await cache.put(request, networkResponse.clone());
        cachedResponse = networkResponse;
      } else {
        // Se il server risponde diversamente da 200 (es. 206 o errore), facciamo fallback a fetch diretta
        return fetch(request);
      }
    } catch (err) {
      console.warn('[Service Worker] Errore di rete durante il fetch dell\'audio:', err);
      // Se siamo offline e il file non è in cache, restituiamo un errore standard di fetch
      return fetch(request);
    }
  }

  // Se c'è un header Range, dobbiamo rispondere con un 206 Partial Content affettando il blob memorizzato.
  // Questo è FONDAMENTALE per iOS Safari e cuffie bluetooth, che altrimenti rifiuterebbero la traccia.
  const rangeHeader = request.headers.get('Range');
  if (rangeHeader) {
    try {
      const blob = await cachedResponse.blob();
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const total = blob.size;
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;

      // Affetta il blob per estrarre la porzione di byte richiesta
      const chunk = blob.slice(start, end + 1);

      return new Response(chunk, {
        status: 206,
        statusText: 'Partial Content',
        headers: new Headers({
          'Content-Type': cachedResponse.headers.get('Content-Type') || 'audio/mpeg',
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Content-Length': chunk.size,
          'Accept-Ranges': 'bytes'
        })
      });
    } catch (err) {
      console.error('[Service Worker] Errore di range slicing, fallback su risposta intera:', err);
      return cachedResponse.clone();
    }
  }

  // Risposta intera se non c'è range header
  return cachedResponse.clone();
}
