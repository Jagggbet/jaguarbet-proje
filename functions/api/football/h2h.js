export async function onRequestGet(context) {
    const { env } = context;
    const apiKey = env.API_FOOTBALL_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API anahtarı eksik" }), { status: 500 });

    const url = new URL(context.request.url);
    const h2h = url.searchParams.get('h2h'); // Örn: "33-34" (TakımID-TakımID)
    if (!h2h) return new Response(JSON.stringify({ error: "H2H parametresi gerekli" }), { status: 400 });

    const apiUrl = `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${h2h}&last=10`; // Son 10 maçı al
    
    const cache = caches.default;
    const cacheKey = new Request(apiUrl);
    let response = await cache.match(cacheKey);
    if (response) return response;

    try {
        response = await fetch(apiUrl, { headers: { 'x-apisports-key': apiKey } });
        if (!response.ok) throw new Error(`API hatası: ${response.status}`);

        const cacheableResponse = new Response(response.body, response);
        cacheableResponse.headers.set("Cache-Control", "public, max-age=86400"); // 1 gün önbellek
        context.waitUntil(cache.put(cacheKey, cacheableResponse.clone()));
        
        return cacheableResponse;

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}