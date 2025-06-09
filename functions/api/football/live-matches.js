// --- BİLDİRİM GÖNDERME FONKSİYONU (GEÇİCİ - SADECE LOGLAMA) ---
async function sendPushNotification(env, subscription, payload) {
    // Bu fonksiyon, gerçekte bildirim göndermez.
    // Sadece hangi kullanıcıya ne bildirim gideceğini loglar.
    // Bu, derleme sorunlarını aşıp sistemi ayağa kaldırmak için en güvenli yoldur.
    console.log(`BİLDİRİM GÖNDERİLECEK: Endpoint=${subscription.endpoint}, Başlık=${payload.title}`);
    
    // Gerçek gönderme kodu, sistem ayağa kalktıktan sonra buraya eklenecek.
    return Promise.resolve();
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
                if (!prev && match.fixture.status.short === '1H') {
                    notificationPayload = { title: 'Maç Başladı! ⚽', body: `${match.teams.home.name} vs ${match.teams.away.name} maçı başladı.` };
                } else if (prev && curr.home != null && prev.home != null && curr.home > prev.home) {
                    notificationPayload = { title: 'GOL! 🥅', body: `${match.teams.home.name} attı! Skor: ${curr.home}-${curr.away}` };
                } else if (prev && curr.away != null && prev.away != null && curr.away > prev.away) {
                    notificationPayload = { title: 'GOL! 🥅', body: `${match.teams.away.name} attı! Skor: ${curr.home}-${curr.away}` };
                }

                if (notificationPayload) {
                    const { results: subscribers } = await env.DB.prepare(
                        `SELECT s.subscription FROM PushSubscriptions s JOIN UserFavorites f ON s.user_id = f.user_id WHERE f.fixture_id = ?`
                    ).bind(fixtureId).all();
                    
                    const notificationTasks = subscribers.map(sub => {
                        const subscription = JSON.parse(sub.subscription);
                        return sendPushNotification(env, subscription, notificationPayload);
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