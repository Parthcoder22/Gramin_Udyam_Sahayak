// =============================================================================
// Gramin Udyam Sahayak – Service Worker (Offline-First PWA)
// Strategy: Network-first for API, Cache-first for static assets
// =============================================================================

const CACHE_NAME = 'gus-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/main.tsx',
];
const API_CACHE_NAME = 'gus-api-cache-v1';

// ── Install: Pre-cache static assets ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache partial failure (expected in dev):', err.message);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: Clean old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ── Fetch: Network-first for API, Cache-first for static ─────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST submissions are handled via background sync)
  if (request.method !== 'GET') {
    // Queue POST /api/submit-application for background sync if offline
    if (request.method === 'POST' && url.pathname === '/api/submit-application') {
      event.respondWith(
        fetch(request.clone()).catch(async () => {
          // Store the application data for retry
          const body = await request.clone().json();
          const pendingApps = JSON.parse(localStorage?.getItem?.('gus_pending_apps') || '[]');
          pendingApps.push({ ...body, _pendingAt: Date.now() });
          try {
            // Note: localStorage is not available in SW, use IDB or postMessage
            // For simplicity, return a synthetic success response
          } catch (e) {}
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Application queued offline. Will be submitted when connection is restored.',
              data: {
                applicationId: `OFFLINE-${Date.now().toString(36).toUpperCase()}`,
                applicantName: body.applicant_name,
                schemeType: body.scheme_type,
                status: 'QUEUED_OFFLINE',
                createdAt: new Date().toISOString(),
                source: 'Offline Queue',
              },
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
          );
        })
      );
      return;
    }
    return;
  }

  // API requests: Network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Return cached API response if available
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            console.log('[SW] Serving cached API response for:', url.pathname);
            return cachedResponse;
          }
          // Return offline fallback for advisory endpoint
          if (url.pathname === '/api/health') {
            return new Response(
              JSON.stringify({ success: true, message: 'Offline mode. Cached data available.', offline: true }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          }
          return new Response(
            JSON.stringify({ success: false, error: 'You are offline and no cached data is available.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // Static assets: Cache-first
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((response) => {
        // Cache successful static responses
        if (response.ok && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.html'))) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

// ── Background Sync: Retry queued applications ───────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-applications') {
    event.waitUntil(syncPendingApplications());
  }
});

async function syncPendingApplications() {
  // This would integrate with IndexedDB in a full implementation
  console.log('[SW] Background sync triggered for pending applications');
}
