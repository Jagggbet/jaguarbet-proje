// Bu fonksiyon, bir maçın ID'sini alarak tüm detaylarını (event, stats, lineup) çeker.
export async function onRequestGet(context) {
    const { env } = context;
    const apiKey = env.API_FOOTBALL_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API anahtarı eksik" }), { status: 500 });

    const url = new URL(context.request.url);
    const fixtureId = url.searchParams.get('id');
    if (!fixtureId) return new Response(JSON.stringify({ error: "Maç ID'si gerekli" }), { status: 400 });

    const apiUrl = `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`;
    
    const cache = caches.default;
    const cacheKey = new Request(apiUrl);
    let response = await cache.match(cacheKey);
    if (response) return response;

    try {
        response = await fetch(apiUrl, { headers: { 'x-apisports-key': apiKey, 'x-rapidapi-host': 'v3.football.api-sports.io' } });
        if (!response.ok) throw new Error(`API hatası: ${response.status}`);
        
        const cacheableResponse = new Response(response.body, response);
        // Canlı maçlar için kısa, bitmiş maçlar için uzun önbellek
        const data = await cacheableResponse.clone().json();
        const status = data.response[0]?.fixture.status.short;
        const finishedStatus = ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'PST', 'AWD', 'WO'];
        const cacheDuration = finishedStatus.includes(status) ? 86400 : 60; // Bitti: 1 gün, Canlı: 1 dakika
        
        cacheableResponse.headers.set("Cache-Control", `public, max-age=${cacheDuration}`);
        context.waitUntil(cache.put(cacheKey, cacheableResponse.clone()));
        
        return cacheableResponse;

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}