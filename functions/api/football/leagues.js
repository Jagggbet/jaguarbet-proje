export async function onRequestGet(context) {
    const apiKey = context.env.API_FOOTBALL_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API anahtarı yapılandırılmamış." }), { status: 500 });
    
    const apiUrl = 'https://v3.football.api-sports.io/leagues';
    const cache = caches.default;
    const cacheKey = new Request(apiUrl);

    let response = await cache.match(cacheKey);
    if (response) return response;

    response = await fetch(apiUrl, { headers: { 'x-apisports-key': apiKey, 'x-rapidapi-host': 'v3.football.api-sports.io' } });
    
    if (!response.ok) return new Response(JSON.stringify({ error: "API'den ligler çekilemedi." }), { status: response.status });

    response = new Response(response.body, response);
    response.headers.set("Cache-Control", "public, max-age=86400"); // Strateji: 1 gün

    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
}