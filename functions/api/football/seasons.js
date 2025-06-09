
export async function onRequestGet(context) {
    const apiKey = context.env.API_FOOTBALL_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API anahtarÄ± yapÄ±landÄ±rÄ±lmamÄ±ÅŸ." }), { status: 500 });
    const apiUrl = 'https://v3.football.api-sports.io/seasons';
    const cache = caches.default;
    const cacheKey = new Request(apiUrl, context.request);
    let response = await cache.match(cacheKey);
    if (response) return response;
    try {
        response = await fetch(apiUrl, { headers: { 'x-apisports-key': apiKey, 'x-rapidapi-host': 'v3.football.api-sports.io' } });
        if (!response.ok) throw new Error(`API hatasÄ±: ${response.status}`);
        response = new Response(response.body, response);
        response.headers.set("Cache-Control", "public, max-age=86400");
        context.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
    } catch (e) { return new Response(JSON.stringify({ error: `Sezonlar Ã§ekilemedi: ${e.message}` }), { status: 500 }); }
}