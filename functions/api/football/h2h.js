// functions/api/football/h2h.js
export async function onRequestGet(context) {
    const { env } = context;
    const apiKey = env.API_FOOTBALL_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API anahtarı eksik" }), { status: 500 });

    const url = new URL(context.request.url);
    const h2h = url.searchParams.get('h2h');
    if (!h2h) return new Response(JSON.stringify({ error: "H2H parametresi gerekli" }), { status: 400 });

    const apiUrl = `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${h2h}&last=10`;
    
    // YENİ EKLENDİ: Önbellekleme mantığı
    const cache = caches.default;
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

        const cacheableResponse = new Response(apiResponse.body, apiResponse);
        // H2H verisi değişmeyeceği için uzun süre önbellekte tutabiliriz.
        cacheableResponse.headers.set("Cache-Control", `public, max-age=86400`); // 1 gün
        
        context.waitUntil(cache.put(cacheKey, cacheableResponse.clone()));
        
        return cacheableResponse;

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}