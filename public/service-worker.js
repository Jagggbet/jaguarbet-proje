// public/service-worker.js
self.addEventListener('push', event => {
    const data = event.data.json();
    console.log('Gelen Push Bildirimi:', data);

    const title = data.title || 'JaguarBet';
    const options = {
        body: data.body,
        icon: '/favicon.ico', // Sitenin logosu veya ikonu
        badge: '/badge.png'   // Bildirim panelinde görünecek küçük ikon (opsiyonel)
    };

    event.waitUntil(self.registration.showNotification(title, options));
});