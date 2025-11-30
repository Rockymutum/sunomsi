// Service Worker for SUNOMSI - Pinterest-like Instant Navigation
// Aggressive caching strategy for instant page loads

const CACHE_NAME = 'sunomsi-v6';
const OFFLINE_URL = '/offline.html';

// Precache essential routes and assets for instant navigation
const PRECACHE_URLS = [
  '/',
  '/discovery',
  '/workers',
  '/messages',
  '/profile',
  '/notifications',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-96x96.png',
  '/apple-touch-icon.png',
  '/logo.svg',
  '/web-app-manifest-192x192.png',
  '/web-app-manifest-512x512.png',
];

// Cache TTL for different resource types
const CACHE_TTL = {
  api: 5 * 60 * 1000, // 5 minutes
  images: 7 * 24 * 60 * 60 * 1000, // 7 days
  static: 30 * 24 * 60 * 60 * 1000, // 30 days
  pages: 10 * 60 * 1000, // 10 minutes for pages
};

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

// Activate event - clean up old caches and enable navigation preload
self.addEventListener('activate', (event) => {
  // Claim any clients immediately
  event.waitUntil(self.clients.claim());

  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Enable navigation preload if available
      self.registration.navigationPreload?.enable(),
    ])
  );
});

// Helper function to check if cache is expired
function isCacheExpired(cachedResponse, ttl) {
  if (!cachedResponse) return true;

  const cachedTime = cachedResponse.headers.get('sw-cache-time');
  if (!cachedTime) return true;

  return Date.now() - parseInt(cachedTime) > ttl;
}

// Helper function to add cache timestamp
function addCacheTimestamp(response) {
  const clonedResponse = response.clone();
  const headers = new Headers(clonedResponse.headers);
  headers.set('sw-cache-time', Date.now().toString());

  return new Response(clonedResponse.body, {
    status: clonedResponse.status,
    statusText: clonedResponse.statusText,
    headers: headers,
  });
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request, cacheName, ttl) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Fetch fresh data in background
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, addCacheTimestamp(response.clone()));
      }
      return response;
    })
    .catch(() => cachedResponse);

  // Return cached response if valid, otherwise wait for fetch
  if (cachedResponse && !isCacheExpired(cachedResponse, ttl)) {
    return cachedResponse;
  }

  return fetchPromise;
}

// Fetch event - Pinterest-like instant loading with aggressive caching
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip non-http(s) requests
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  // Aggressively cache Supabase storage images (avatars, task images, etc.)
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/storage/v1/object/public/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached image immediately - no revalidation needed for images
            return cachedResponse;
          }

          // Fetch and cache for future use
          return fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              // Clone and cache with long TTL
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(() => {
            // Return a placeholder if offline and no cache
            return new Response('', { status: 404 });
          });
        });
      })
    );
    return;
  }

  // Cache-first for Next.js static resources (instant loading)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Cache-first for Next.js data files (instant page transitions)
  if (url.pathname.startsWith('/_next/data/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Return cached immediately, update in background
        const fetchPromise = fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Handle API requests with stale-while-revalidate
  if (url.pathname.includes('/api/') || url.hostname.includes('supabase')) {
    event.respondWith(
      staleWhileRevalidate(event.request, CACHE_NAME, CACHE_TTL.api)
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Handle all other images with aggressive caching (cache-first for instant loading)
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Handle navigation requests - cache-first for instant page loads
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Check cache first for instant navigation
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(event.request);

          // Fetch in background to update cache
          const fetchPromise = fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(() => null);

          // Return cached response immediately if available
          if (cachedResponse) {
            // Update cache in background
            fetchPromise;
            return cachedResponse;
          }

          // If no cache, wait for network
          const networkResponse = await fetchPromise;
          if (networkResponse) {
            return networkResponse;
          }

          // Fallback to offline page
          return cache.match(OFFLINE_URL);
        } catch (error) {
          // If offline, show offline page
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(event.request);
          return cachedResponse || cache.match(OFFLINE_URL);
        }
      })()
    );
    return;
  }

  // For other requests, cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Update cache in background
          fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              const responseToCache = addCacheTimestamp(response.clone());
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
          }).catch(() => { });

          return cachedResponse;
        }

        return fetch(event.request)
          .then((response) => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone and cache the response
            const responseToCache = addCacheTimestamp(response.clone());
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // If both cache and network fail, show offline page for HTML requests
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return caches.match(OFFLINE_URL);
            }
          });
      })
  );
});

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-requests') {
    event.waitUntil(processPendingRequests());
  }
});

// Process pending requests
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
        throw error;
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
