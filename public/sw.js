// Service Worker for SUNOMSI - Caching and Offline Support

const CACHE_NAME = 'sunomsi-v6'; // Bumped version to force update
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-96x96.png',
  '/apple-touch-icon.png',
  '/logo.svg',
  '/web-app-manifest-192x192.png',
  '/web-app-manifest-512x512.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(PRECACHE_URLS);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  // Claim any clients immediately, so they don't wait for a reload
  event.waitUntil(self.clients.claim());

  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache, falling back to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip non-http(s) requests
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  // 1. Handle Navigation Requests (HTML) - Network First, Fallback to Cache
  // This ensures users always get the latest version of the page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone and cache the fresh version
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        })
        .catch(() => {
          // If network fails, try to get from cache
          return caches.match(event.request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If not in cache, show offline page
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }

  // 2. Handle API requests - Network First, Fallback to Cache (if appropriate)
  // For now, we'll keep API requests Network Only or Network First to ensure data freshness
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // 3. Handle Static Assets (Images, CSS, JS) - Cache First, Fallback to Network
  // These usually have hashes in filenames or don't change often
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached response if found
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise, fetch from network
        return fetch(event.request)
          .then((response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response for caching
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Optional: Return placeholder image for failed image requests
          });
      })
  );
});

// Background sync for failed requests when coming back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-requests') {
    event.waitUntil(processPendingRequests());
  }
});

// Process any pending requests that failed while offline
async function processPendingRequests() {
  const cache = await caches.open('pending-requests');
  const requests = await cache.keys();

  return Promise.all(
    requests.map(async (request) => {
      try {
        const response = await fetch(request);
        await cache.delete(request);
        return response;
      } catch (error) {
        console.error('Failed to process pending request:', error);
        throw error; // Will retry on next sync event
      }
    })
  );
}

// Push notification event listener
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const title = data.title || 'SUNOMSI';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/web-app-manifest-192x192.png',
    badge: '/web-app-manifest-192x192.png',
    vibrate: [200, 100, 200],
    tag: data.type || 'general',
    requireInteraction: false,
    data: {
      type: data.type,
      chatId: data.chatId,
      taskId: data.taskId,
      url: data.url || '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data;
  let url = '/';

  // Route based on notification type
  if (data.type === 'message' && data.chatId) {
    url = `/messages/${data.chatId}`;
  } else if (data.type === 'comment' && data.taskId) {
    url = `/tasks/${data.taskId}`;
  } else if (data.type === 'application' && data.taskId) {
    url = `/tasks/${data.taskId}`;
  } else if (data.url) {
    url = data.url;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window/tab open with the target URL
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }

        // If no matching client, open a new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

