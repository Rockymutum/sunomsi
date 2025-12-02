// Service Worker Killer
// This file replaces the old service worker and unregisters itself immediately.
// This is necessary to fix the "Response served by service worker has redirections" error on Safari.

self.addEventListener('install', () => {
  // Take control immediately
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  // Unregister this service worker
  self.registration.unregister()
    .then(() => {
      console.log('Service Worker unregistered successfully.');
      return self.clients.matchAll();
    })
    .then((clients) => {
      // Force reload all open tabs to clear the old SW control
      clients.forEach(client => client.navigate(client.url));
    });
});
