// @ts-nocheck
/* global firebase, importScripts, self */

importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

const isLocal =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1';
const apiBase = isLocal ? 'http://localhost:5001/api' : `${self.location.origin}/api`;

try {
  importScripts(`${apiBase}/config/firebase-sw.js`);
} catch (error) {
  console.error('Failed to load Firebase service worker config', error);
}

let messaging = null;
try {
  if (firebase && firebase.apps && firebase.apps.length) {
    messaging = firebase.messaging();
  }
} catch (error) {
  console.error('Failed to initialize Firebase messaging in service worker', error);
}

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    const notification = payload.notification || {};
    const data = payload.data || {};
    const title = notification.title || data.title || 'New Blog Published';
    const options = {
      body: notification.body || data.body || 'A new article has been posted. Click to read.',
      icon: notification.icon || '/tej-logo-android-chrome-192x192.png',
      badge: notification.badge || '/tej-logo-32x32.png',
      image: notification.image,
      data: {
        url: data.url || payload.fcmOptions?.link || '/'
      }
    };

    self.registration.showNotification(title, options);
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  const absoluteUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client && 'navigate' in client) {
          return client.navigate(absoluteUrl).then(() => client.focus());
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(absoluteUrl);
      }

      return undefined;
    })
  );
});
