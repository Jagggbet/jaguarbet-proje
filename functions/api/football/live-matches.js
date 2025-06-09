// web-push kütüphanesini kullanmadan VAPID imzası oluşturan yardımcı fonksiyonlar
// Bu fonksiyonlar, standart Web Crypto API'sini kullanır ve Cloudflare Workers ile %100 uyumludur.

// Base64 URL kodlamasını Uint8Array'e çevirir.
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// VAPID imzası için JWT başlığını ve taleplerini oluşturur.
async function createVapidJwt(audience, privateKey) {
    const jwtHeader = { typ: 'JWT', alg: 'ES256' };
    const jwtPayload = {
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60), // 12 saat geçerli
        sub: 'mailto:admin@jaguarbet.proje' // Proje sahibinin e-postası (zorunlu)
    };

    const headerB64 = btoa(JSON.stringify(jwtHeader)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payloadB64 = btoa(JSON.stringify(jwtPayload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const unsignedToken = `${headerB64}.${payloadB64}`;

    // Cloudflare'in crypto API'sini kullanarak imzayı oluştur
    const key = await crypto.subtle.importKey(
        'jwk',
        {
            crv: 'P-256',
            kty: 'EC',
            x: 'BOzoVFsxnzU90fasi3I3w92kqpLBEGpbN2D2aSd7b1FJsC9M0bqxcsXtzGjHmLqM09MHTfW_-t3Mh1RdPRoq7VY'.replace(/-/g, '+').replace(/_/g, '/'),
            y: 'BOzoVFsxnzU90fasi3I3w92kqpLBEGpbN2D2aSd7b1FJsC9M0bqxcsXtzGjHmLqM09MHTfW_-t3Mh1RdPRoq7VY'.slice(44).replace(/-/g, '+').replace(/_/g, '/'), // Public key 'den Y değeri alınır
            d: privateKey.replace(/-/g, '+').replace(/_/g, '/')
        },
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign']
    );
    
    const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        key,
        new TextEncoder().encode(unsignedToken)
    );

    const signatureB64 = btoa(String.fromCharCode.apply(null, new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    return `${unsignedToken}.${signatureB64}`;
}


/**
 * Belirtilen aboneliğe bir push bildirimi gönderir.
 * @param {object} env - Cloudflare ortam değişkenleri.
 * @param {object} subscription - Tarayıcıdan gelen push abonelik nesnesi.
 * @param {object} payload - Bildirim başlığı ve içeriği ({ title, body }).
 */
async function sendPushNotification(env, subscription, payload) {
    const { FCM_VAPID_PUBLIC_KEY, FCM_VAPID_PRIVATE_KEY } = env;

    if (!FCM_VAPID_PUBLIC_KEY || !FCM_VAPID_PRIVATE_KEY) {
        console.error("VAPID anahtarları Cloudflare'de ayarlanmamış.");
        return;
    }

    const fcmEndpoint = subscription.endpoint;
    const audience = new URL(fcmEndpoint).origin;

    const vapidJwt = await createVapidJwt(audience, FCM_VAPID_PRIVATE_KEY);
    
    const pushPayload = JSON.stringify({
        notification: {
            title: payload.title,
            body: payload.body,
            icon: "https://jaguarbet.proje/favicon.ico", // Sitenizin ikonu
            click_action: "https://jaguarbet.proje" // Tıklandığında açılacak link
        }
    });

    try {
        const response = await fetch(fcmEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'TTL': '86400', // 1 gün boyunca denesin
                'Authorization': `vapid t=${vapidJwt}, k=${FCM_VAPID_PUBLIC_KEY}`,
                'Content-Encoding': 'aesgcm' // Modern tarayıcılar için
            },
            body: pushPayload
        });

        if (!response.ok) {
            console.error(`Bildirim gönderme hatası (${response.status}):`, await response.text());
        } else {
            console.log("Bildirim başarıyla gönderildi.");
        }
    } catch (e) {
        console.error("Bildirim gönderilirken fetch hatası:", e);
    }
}


// --- ANA FONKSİYON ---
export async function onRequestGet(context) {
    const { env } = context;
    const apiKey = env.API_FOOTBALL_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API anahtarı yapılandırılmamış." }), { status: 500 });

    const apiUrl = 'https://v3.football.api-sports.io/fixtures?live=all';
    const cache = caches.default;
    const cacheKey = new Request(apiUrl);

    let response = await cache.match(cacheKey);
    if (response) {
        return response;
    }

    try {
        const apiResponse = await fetch(apiUrl, {
            headers: { 'x-apisports-key': apiKey, 'x-rapidapi-host': 'v3.football.api-sports.io' }
        });

        if (!apiResponse.ok) throw new Error(`API Hatası: ${apiResponse.status}`);
        
        const data = await apiResponse.json();
        
        const previousScoresRaw = await env.JAGUAR_STATS.get('PREVIOUS_SCORES');
        const previousScores = previousScoresRaw ? JSON.parse(previousScoresRaw) : {};
        const currentScores = {};
        
        if (data.response && Array.isArray(data.response)) {
            for (const match of data.response) {
                const fixtureId = match.fixture.id;
                const prev = previousScores[fixtureId];
                const curr = { home: match.goals.home, away: match.goals.away };
                currentScores[fixtureId] = curr;

                let notificationPayload = null;
                if (prev && curr.home != null && prev.home != null && curr.home > prev.home) {
                    notificationPayload = { title: 'GOL! ⚽', body: `${match.teams.home.name} attı! Skor: ${curr.home}-${curr.away}` };
                } else if (prev && curr.away != null && prev.away != null && curr.away > prev.away) {
                    notificationPayload = { title: 'GOL! ⚽', body: `${match.teams.away.name} attı! Skor: ${curr.home}-${curr.away}` };
                }

                if (notificationPayload) {
                    const { results: subscribers } = await env.DB.prepare(
                        `SELECT s.subscription FROM PushSubscriptions s JOIN UserFavorites f ON s.user_id = f.user_id WHERE f.fixture_id = ?`
                    ).bind(fixtureId).all();
                    
                    const notificationTasks = subscribers.map(sub => {
                        try {
                            const subscriptionObject = JSON.parse(sub.subscription);
                            return sendPushNotification(env, subscriptionObject, notificationPayload);
                        } catch (e) {
                            console.error("Geçersiz abonelik formatı:", sub.subscription);
                            return Promise.resolve();
                        }
                    });

                    if (notificationTasks.length > 0) {
                       context.waitUntil(Promise.all(notificationTasks));
                    }
                }
            }
        }
        
        context.waitUntil(env.JAGUAR_STATS.put('PREVIOUS_SCORES', JSON.stringify(currentScores)));

        const responseToCache = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120' }
        });
        context.waitUntil(cache.put(cacheKey, responseToCache.clone()));
        
        return responseToCache;

    } catch(e) {
        console.error("Live matches error:", e.message);
        return new Response(JSON.stringify({ error: "Veri çekilemedi." }), { status: 500 });
    }
}