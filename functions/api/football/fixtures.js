// Dosya: functions/api/football/fixtures.js (TEMİZLENMİŞ VE NİHAİ VERSİYON)

// Gol bildirim fonksiyonu burada (hiçbir değişiklik yok, sadece yorumlar temizlendi)
async function sendPushNotification(context, subscription, payload) {
    const { FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY } = context.env;
    if (!FCM_PROJECT_ID || !FCM_CLIENT_EMAIL || !FCM_PRIVATE_KEY) {
        console.error("FCM environment variables are not set.");
        return;
    }
    const subscriptionData = JSON.parse(subscription.subscription);
    
    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const claim = { iss: FCM_CLIENT_EMAIL, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now };
    
    const signedJwt = await sign({ ...claim, header }, FCM_PRIVATE_KEY);
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signedJwt}`
    });
    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
        console.error("Failed to get a Google API access token:", tokenData);
        return;
    }
    const accessToken = tokenData.access_token;

    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;
    const fcmPayload = {
        message: {
            token: subscriptionData.endpoint.split('/').pop(),
            webpush: {
                notification: {
                    title: payload.title,
                    body: payload.body,
                    icon: "https://rusakh.store/favicon.ico",
                }
            },
            fcm_options: {
                 analytics_label: "goal_notification"
            }
        }
    };
    
    return fetch(fcmEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify(fcmPayload)
    });
}


export async function onRequestGet(context) {
    const { env, waitUntil } = context;
    const { API_FOOTBALL_KEY, JAGUAR_STATS, DB } = env;

    if (!API_FOOTBALL_KEY) {
        return new Response(JSON.stringify({ error: "API key not configured." }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const url = new URL(context.request.url);
    const date = url.searchParams.get('date');
    const live = url.searchParams.get('live');
    
    let apiUrl;
    let cacheTtl; 

    if (live === 'all') {
        apiUrl = 'https://v3.football.api-sports.io/fixtures?live=all';
        cacheTtl = 120; // 2 minutes
    } else if (date) {
        apiUrl = `https://v3.football.api-sports.io/fixtures?date=${date}`;
        const today = new Date().toISOString().split('T')[0];
        cacheTtl = (date < today) ? 86400 : 3600; // Past: 1 day, Future: 1 hour
    } else {
        return new Response(JSON.stringify({ error: "A valid parameter (date or live) is required." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const cacheKey = new Request(apiUrl);
    const cache = caches.default;
    
    let response = await cache.match(cacheKey);

    if (response) {
        let newHeaders = new Headers(response.headers);
        newHeaders.set("X-Cache-Status", "HIT");
        return new Response(response.body, { status: response.status, headers: newHeaders });
    }
    
    try {
        const apiResponse = await fetch(apiUrl, { 
            headers: { 'x-apisports-key': API_FOOTBALL_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' }
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            throw new Error(`API error: ${apiResponse.status} - ${errorText}`);
        }
        
        const data = await apiResponse.json();
        
        if (live === 'all' && data.response && data.response.length > 0 && DB && JAGUAR_STATS) {
            const previousScoresText = await JAGUAR_STATS.get('live_scores');
            const previousScores = previousScoresText ? JSON.parse(previousScoresText) : {};
            const currentScores = {};
            const notificationPromises = [];

            for (const match of data.response) {
                const id = match.fixture.id;
                currentScores[id] = { home: match.goals.home, away: match.goals.away };

                if (previousScores[id] && (match.goals.home !== previousScores[id].home || match.goals.away !== previousScores[id].away)) {
                    const { results: favoritedUsers } = await DB.prepare('SELECT user_id FROM UserFavorites WHERE fixture_id = ?').bind(id).all();
                    if (favoritedUsers && favoritedUsers.length > 0) {
                        const userIds = favoritedUsers.map(u => u.user_id);
                        const placeholders = userIds.map(() => '?').join(',');
                        const { results: subscriptions } = await DB.prepare(`SELECT * FROM PushSubscriptions WHERE user_id IN (${placeholders})`).bind(...userIds).all();
                        
                        subscriptions.forEach(sub => {
                            const payload = { title: "⚽ GOL!", body: `${match.teams.home.name} ${match.goals.home} - ${match.goals.away} ${match.teams.away.name}` };
                            notificationPromises.push(sendPushNotification(context, sub, payload));
                        });
                    }
                }
            }
            waitUntil(JAGUAR_STATS.put('live_scores', JSON.stringify(currentScores)));
            if (notificationPromises.length > 0) {
               waitUntil(Promise.all(notificationPromises));
            }
        }

        const responseToCache = new Response(JSON.stringify(data), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': `public, max-age=${cacheTtl}`
            }
        });

        waitUntil(cache.put(cacheKey, responseToCache.clone()));
        
        return responseToCache;

    } catch (e) { 
        return new Response(JSON.stringify({ error: `Could not fetch fixtures: ${e.message}` }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        }); 
    }
}