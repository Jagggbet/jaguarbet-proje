// service-worker.js (ANA DİZİNDE OLMALI)

self.addEventListener('push', event => {
    const data = event.data.json();
    const title = data.title || 'JaguarBet';
    const options = {
        body: data.body,
        icon: '/icon-192x192.png', // Bu ikonları daha sonra ekleyebiliriz
        badge: '/badge-72x72.png'
    };
    event.waitUntil(self.registration.showNotification(title, options));
});