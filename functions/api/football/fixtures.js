// Dosya: functions/api/football/fixtures.js (SÜPER GÜÇLÜ ÖNBELLEKLEME VERSİYONU)

// Gol bildirim fonksiyonun burada (hiçbir değişiklik yok)
async function sendPushNotification(context, subscription, payload) {
    // ... senin mevcut, çalışan kodun ...
}

export async function onRequestGet(context) {
    const { env, waitUntil } = context;
    const { API_FOOTBALL_KEY, JAGUAR_STATS, DB } = env;

    if (!API_FOOTBALL_KEY) {
        return new Response(JSON.stringify({ error: "API key not configured." }), { status: 500 });
    }

    const url = new URL(context.request.url);
    const date = url.searchParams.get('date');
    const live = url.searchParams.get('live');
    
    let apiUrl;
    let cacheTtl; // Cache süresi (saniye)

    if (live === 'all') {
        apiUrl = 'https://v3.football.api-sports.io/fixtures?live=all';
        cacheTtl = 120; // 2 dakika
    } else if (date) {
        apiUrl = `https://v3.football.api-sports.io/fixtures?date=${date}`;
        const today = new Date().toISOString().split('T')[0];
        cacheTtl = (date < today) ? 86400 : 3600;
    } else {
        return new Response(JSON.stringify({ error: "A valid parameter (date or live) is required." }), { status: 400 });
    }

    // YENİ VE EN ÖNEMLİ KISIM: Cloudflare'e özel önbellekleme talimatları
    const cacheKey = new Request(apiUrl, {
        cf: {
            // Bu, Cloudflare'e cevabı ne olursa olsun önbelleğe almasını söyler
            cacheEverything: true, 
            // Ve bu süre boyunca saklamasını söyler
            cacheTtl: cacheTtl, 
        },
    });

    const cache = caches.default;
    let response = await cache.match(cacheKey);

    if (response) {
        // Önbellekten bulundu!
        let newHeaders = new Headers(response.headers);
        newHeaders.set("X-Cache-Status", "HIT");
        return new Response(response.body, {
            status: response.status,
            headers: newHeaders
        });
    }
    
    // Önbellekte yok (MISS), API'ye git
    try {
        const apiResponse = await fetch(apiUrl, { 
            headers: { 'x-apisports-key': API_FOOTBALL_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' }
        });

        if (!apiResponse.ok) {
            throw new Error(`API error: ${apiResponse.status}`);
        }
        
        // API'den gelen cevabı direkt olarak responseToCache yapıyoruz.
        const responseToCache = new Response(apiResponse.body, apiResponse);

        // YİNE EN ÖNEMLİ KISIM: Dönen cevabın başlıklarını manuel olarak ayarlıyoruz.
        responseToCache.headers.set('Cache-Control', `public, max-age=${cacheTtl}`);
        responseToCache.headers.set('Content-Type', 'application/json');

        // Gol bildirim mantığı için cevabı klonlayıp okumamız gerekiyor
        const dataToProcess = await responseToCache.clone().json();
        
        if (live === 'all' && dataToProcess.response && dataToProcess.response.length > 0 && DB && JAGUAR_STATS) {
            // ... (mevcut gol bildirim mantığın buraya gelecek, hiç değişmeden) ...
        }

        waitUntil(cache.put(cacheKey, responseToCache.clone()));
        
        return responseToCache;

    } catch (e) { 
        return new Response(JSON.stringify({ error: `Could not fetch fixtures: ${e.message}` }), { status: 500 }); 
    }
}