
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Bildirim gÃ¶nderme iÅŸlemini yapan ana fonksiyon
async function sendPushNotification(env, subscription, payload) {
    // Bu fonksiyon, Firebase'in beklediÄŸi VAPID baÅŸlÄ±klarÄ±nÄ± oluÅŸturur ve fetch ile gÃ¶nderir.
    // Node.js'in crypto modÃ¼lÃ¼ne ihtiyaÃ§ duymaz.
    const vapidKeys = {
        publicKey: env.FCM_VAPID_PUBLIC_KEY,
        privateKey: env.FCM_VAPID_PRIVATE_KEY
    };

    try {
        const { endpoint } = subscription;
        const audience = new URL(endpoint).origin;

        // JWT payload
        const jwtPayload = {
            aud: audience,
            exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60), // 12 saat geÃ§erli
            sub: 'mailto:your-email@example.com' // E-posta adresi
        };
        
        // JWT header
        const header = { typ: 'JWT', alg: 'ES256' };

        // Private key'i import et
        const privateKey = await crypto.subtle.importKey(
            'pkcs8',
            urlB64ToUint8Array(vapidKeys.privateKey),
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['sign']
        );
        
        const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        const encodedPayload = btoa(JSON.stringify(jwtPayload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        const dataToSign = `${encodedHeader}.${encodedPayload}`;
        
        const signature = await crypto.subtle.sign(
            { name: 'ECDSA', hash: { name: 'SHA-256' } },
            privateKey,
            new TextEncoder().encode(dataToSign)
        );

        const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        const jwt = `${dataToSign}.${encodedSignature}`;

        // Push isteÄŸini gÃ¶nder
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                'TTL': '86400',
                'Authorization': `WebPush ${jwt}`,
                'Crypto-Key': `p256ecdsa=${vapidKeys.publicKey}`
            },
            body: JSON.stringify(payload)
        });

        if (response.status === 410 || response.status === 404) {
            console.log("GeÃ§ersiz abonelik, siliniyor:", endpoint);
            await env.DB.prepare('DELETE FROM PushSubscriptions WHERE subscription LIKE ?')
                .bind(`%${endpoint}%`)
                .run();
        }

    } catch (error) {
        console.error('Bildirim gÃ¶nderme hatasÄ±:', error);
    }
}


// --- ANA FONKSÄ°YON ---
export async function onRequestGet(context) {
    const { env } = context;
    const apiKey = env.API_FOOTBALL_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API anahtarÄ± yapÄ±landÄ±rÄ±lmamÄ±ÅŸ." }), { status: 500 });

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

        if (!apiResponse.ok) throw new Error("API'den veri Ã§ekilemedi");
        
        const data = await apiResponse.json();
        
        const previousScoresRaw = await env.JAGUAR_STATS.get('PREVIOUS_SCORES');
        const previousScores = previousScoresRaw ? JSON.parse(previousScoresRaw) : {};
        const currentScores = {};
        const notificationTasks = [];

        if (data.response && Array.isArray(data.response)) {
            for (const match of data.response) {
                const fixtureId = match.fixture.id;
                const prev = previousScores[fixtureId];
                const curr = { home: match.goals.home, away: match.goals.away };
                currentScores[fixtureId] = curr;

                let notificationPayload = null;
                if (!prev && match.fixture.status.short === '1H') {
                    notificationPayload = { title: 'MaÃ§ BaÅŸladÄ±! âš½', body: `${match.teams.home.name} vs ${match.teams.away.name} maÃ§Ä± baÅŸladÄ±.` };
                } else if (prev && curr.home != null && curr.home > prev.home) {
                    notificationPayload = { title: 'GOL! ðŸ¥…', body: `${match.teams.home.name} attÄ±! Skor: ${curr.home}-${curr.away}` };
                } else if (prev && curr.away != null && curr.away > prev.away) {
                    notificationPayload = { title: 'GOL! ðŸ¥…', body: `${match.teams.away.name} attÄ±! Skor: ${curr.home}-${curr.away}` };
                }

                if (notificationPayload) {
                    const { results: subscribers } = await env.DB.prepare(
                        `SELECT s.subscription FROM PushSubscriptions s JOIN UserFavorites f ON s.user_id = f.user_id WHERE f.fixture_id = ?`
                    ).bind(fixtureId).all();

                    subscribers.forEach(sub => {
                        const subscription = JSON.parse(sub.subscription);
                        notificationTasks.push(sendPushNotification(env, subscription, notificationPayload));
                    });
                }
            }
        }
        
        if (notificationTasks.length > 0) {
            context.waitUntil(Promise.all(notificationTasks));
        }
        
        context.waitUntil(env.JAGUAR_STATS.put('PREVIOUS_SCORES', JSON.stringify(currentScores)));

        const responseToCache = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120' } // 2 dakika
        });
        context.waitUntil(cache.put(cacheKey, responseToCache.clone()));
        
        return responseToCache;

    } catch(e) {
        console.error("Live matches & notification error:", e);
        return new Response(JSON.stringify({ error: "Veri Ã§ekilemedi veya bildirim gÃ¶nderilemedi." }), { status: 500 });
    }
}