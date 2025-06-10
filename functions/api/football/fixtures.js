// functions/api/football/fixtures.js

import { verify, decode } from '@tsndr/cloudflare-worker-jwt';

// YENİ EKLENDİ: Bildirim gönderme fonksiyonu
async function sendPushNotification(context, subscription, payload) {
    const { FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY, FCM_VAPID_PUBLIC_KEY } = context.env;
    const subscriptionData = JSON.parse(subscription.subscription);
    
    // Google API için JWT oluşturma
    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const claim = {
        iss: FCM_CLIENT_EMAIL,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now
    };
    
    const signedJwt = await sign({ ...claim, header }, FCM_PRIVATE_KEY);

    // Google'dan Access Token al
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signedJwt}`
    });
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // FCM'e bildirim gönderme isteği
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;
    const fcmPayload = {
        message: {
            token: subscriptionData.keys.p256dh, // Bu kısım subscription objesine göre değişebilir, genellikle token kullanılır
            notification: {
                title: payload.title,
                body: payload.body,
            },
            webpush: {
                fcm_options: {
                    link: "https://jaguarbet-proje.pages.dev/"
                },
                headers: {
                    Urgency: "high",
                    TTL: "86400"
                },
                notification: {
                    badge: "/badge.png",
                    icon: "/icon-192x192.png",
                    ...payload
                }
            }
        }
    };
    
    // Gerçek push isteği
    return fetch(fcmEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(fcmPayload)
    });
}


export async function onRequestGet(context) {
    const { env } = context;
    // DEĞİŞTİ: Gerekli tüm ortam değişkenlerini al
    const { API_FOOTBALL_KEY, JAGUAR_STATS, DB } = env;

    if (!API_FOOTBALL_KEY) {
        return new Response(JSON.stringify({ error: "API anahtarı yapılandırılmamış." }), { status: 500 });
    }

    const url = new URL(context.request.url);
    const date = url.searchParams.get('date');
    const live = url.searchParams.get('live');
    
    let apiUrl = 'https://v3.football.api-sports.io/fixtures';
    let params = new URLSearchParams();
    let cacheDuration = 86400;

    if (live === 'all') {
        params.set('live', 'all');
        cacheDuration = 15;
    } else if (date) {
        params.set('date', date);
        const today = new Date().toISOString().split('T')[0];
        if (date < today) cacheDuration = 604800;
        else cacheDuration = 3600;
    } else {
        return new Response(JSON.stringify({ error: "Geçerli parametre (date veya live) gerekli." }), { status: 400 });
    }

    apiUrl = `${apiUrl}?${params.toString()}`;

    const cache = caches.default;
    const cacheKey = new Request(apiUrl);
    
    let response = await cache.match(cacheKey);
    if (response) {
        return response;
    }

    try {
        const apiResponse = await fetch(apiUrl, { 
            headers: { 'x-apisports-key': API_FOOTBALL_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' } 
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            throw new Error(`API hatası: ${apiResponse.status} - ${errorText}`);
        }
        
        const data = await apiResponse.json();
        
        // YENİ EKLENDİ: Gol tespiti ve bildirim mantığı (sadece canlı maçlar için)
        if (live === 'all' && data.response && data.response.length > 0) {
            const previousScoresText = await JAGUAR_STATS.get('live_scores');
            const previousScores = previousScoresText ? JSON.parse(previousScoresText) : {};
            const currentScores = {};
            const notificationPromises = [];

            for (const match of data.response) {
                const id = match.fixture.id;
                const homeGoals = match.goals.home;
                const awayGoals = match.goals.away;
                currentScores[id] = { home: homeGoals, away: awayGoals };

                if (previousScores[id] && (homeGoals !== previousScores[id].home || awayGoals !== previousScores[id].away)) {
                    // Gol oldu!
                    const { results: favoritedUsers } = await DB.prepare('SELECT user_id FROM UserFavorites WHERE fixture_id = ?').bind(id).all();

                    if (favoritedUsers && favoritedUsers.length > 0) {
                        const userIds = favoritedUsers.map(u => u.user_id);
                        const placeholders = userIds.map(() => '?').join(',');
                        
                        const { results: subscriptions } = await DB.prepare(`SELECT * FROM PushSubscriptions WHERE user_id IN (${placeholders})`).bind(...userIds).all();
                        
                        subscriptions.forEach(sub => {
                            const payload = {
                                title: "⚽ GOL!",
                                body: `${match.teams.home.name} ${homeGoals} - ${awayGoals} ${match.teams.away.name}`
                            };
                            notificationPromises.push(sendPushNotification(context, sub, payload));
                        });
                    }
                }
            }
            // KV'ye yeni skorları yaz ve bildirimleri gönder
            context.waitUntil(JAGUAR_STATS.put('live_scores', JSON.stringify(currentScores)));
            context.waitUntil(Promise.all(notificationPromises));
        }


        const responseToCache = new Response(JSON.stringify(data), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': `public, max-age=${cacheDuration}`
            }
        });

        context.waitUntil(cache.put(cacheKey, responseToCache.clone()));
        return responseToCache;

    } catch (e) { 
        return new Response(JSON.stringify({ error: `Maçlar çekilemedi: ${e.message}` }), { status: 500 }); 
    }
}