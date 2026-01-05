/**
 * Service Worker for IOOPS Push Notifications
 * Handles browser push notifications even when the page is closed
 */

// Service Worker version (increment when updating)
const SW_VERSION = '1.0.0';

console.log(`[Service Worker] Version ${SW_VERSION} loaded`);

// Install event - fired when service worker is first installed
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - fired when service worker takes control
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  // Claim all clients immediately
  event.waitUntil(clients.claim());
});

// Push event - fired when a push notification is received
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');

  if (!event.data) {
    console.warn('[Service Worker] Push event has no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('[Service Worker] Push data:', data);

    const options = {
      body: data.body,
      icon: data.icon || '/images/ioops-logo.png',
      badge: data.badge || '/images/badge-icon.png',
      tag: data.tag || 'ioops-notification',
      data: data.data || {},
      requireInteraction: true, // Keep visible until user interacts
      vibrate: [200, 100, 200], // Vibration pattern for mobile devices
      actions: [
        { action: 'view', title: 'View Details', icon: '/images/view-icon.png' },
        { action: 'close', title: 'Dismiss', icon: '/images/close-icon.png' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (error) {
    console.error('[Service Worker] Error showing notification:', error);
  }
});

// Notification click event - fired when user clicks on a notification
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'close') {
    // User clicked "Dismiss" - just close the notification
    return;
  }

  // User clicked "View Details" or the notification body
  const urlToOpen = event.notification.data.url || 'https://www.ioops.org/recipient-verification';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Check if there's already a window open with the URL
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }

      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Notification close event - fired when notification is closed without clicking
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notification closed:', event.notification.tag);
  // Could send analytics here if needed
});

// Message event - for communication between page and service worker
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
