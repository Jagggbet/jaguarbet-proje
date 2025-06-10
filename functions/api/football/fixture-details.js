// functions/api/football/fixture-details.js
export async function onRequestGet(context) {
    const { env } = context;
    const apiKey = env.API_FOOTBALL_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API anahtarı eksik" }), { status: 500 });

    const url = new URL(context.request.url);
    const fixtureId = url.searchParams.get('id');
    if (!fixtureId) return new Response(JSON.stringify({ error: "Maç ID'si gerekli" }), { status: 400 });

    // DEĞİŞTİ: Artık tek bir endpoint'ten tüm bilgileri istiyoruz.
    const apiUrl = `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`;
    
    const cache = caches.default;
    // Önbellek anahtarını URL'den oluşturuyoruz ki her maçın detayı ayrı cache'lensin
    const cacheKey = new Request(apiUrl, context.request); 
    let response = await cache.match(cacheKey);

    if (response) {
        return response;
    }

    try {
        const apiResponse = await fetch(apiUrl, { 
            headers: { 'x-apisports-key': apiKey, 'x-rapidapi-host': 'v3.football.api-sports.io' } 
        });

        if (!apiResponse.ok) {
            throw new Error(`API hatası: ${apiResponse.status}`);
        }
        
        const data = await apiResponse.json();
        const status = data.response[0]?.fixture.status.short;
        
        // Bitmiş maçların detayı daha uzun süre önbellekte kalabilir.
        const finishedStatus = ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'PST', 'AWD', 'WO'];
        const cacheDuration = finishedStatus.includes(status) ? 86400 : 60; // Bitti: 1 gün, Canlı/Gelecek: 1 dakika

        const cacheableResponse = new Response(JSON.stringify(data), {
            headers: { 
                'Content-Type': 'application/json',
                "Cache-Control": `public, max-age=${cacheDuration}`
            }
        });
        
        context.waitUntil(cache.put(cacheKey, cacheableResponse.clone()));
        
        return cacheableResponse;

    } catch (e) {
        console.error("Fixture details fetch error:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}