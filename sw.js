const CACHE_NAME = 'cadence-v1';
const BASE = '/cadence/';

const ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500;600;700&display=swap',
];

// ─── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH — cache-first pour les assets, network-first pour Drive API ────────
self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  // Laisse passer les appels Drive/Google
  if (url.includes('googleapis.com') || url.includes('accounts.google.com')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => caches.match(BASE + 'index.html'));
    })
  );
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
let notifTimer = null;

function scheduleNext(hour, minute) {
  if (notifTimer) clearTimeout(notifTimer);
  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const delay = next.getTime() - now.getTime();

  notifTimer = setTimeout(() => {
    self.registration.showNotification('Cadence 🎵', {
      body: 'Ta session de pratique t\'attend !',
      icon: BASE + 'icon-192.png',
      badge: BASE + 'icon-192.png',
      tag: 'practice-reminder',
      renotify: true,
      requireInteraction: false,
      vibrate: [200, 100, 200],
      actions: [{ action: 'open', title: 'Ouvrir' }],
    });
    // Replanifie pour le lendemain
    scheduleNext(hour, minute);
  }, delay);
}

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SCHEDULE_NOTIF') {
    if (e.data.enabled) {
      scheduleNext(e.data.hour, e.data.minute);
    } else {
      if (notifTimer) { clearTimeout(notifTimer); notifTimer = null; }
    }
  }
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const c = cs.find(c => c.url.includes('/cadence/'));
      if (c) return c.focus();
      return clients.openWindow(BASE);
    })
  );
});
