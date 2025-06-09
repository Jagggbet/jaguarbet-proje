export async function onRequestGet(context) {
    const { env } = context;
    const apiKey = env.API_FOOTBALL_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: "API anahtarı yapılandırılmamış." }), { status: 500 });
    }

    const url = new URL(context.request.url);
    const date = url.searchParams.get('date');
    const live = url.searchParams.get('live');
    
    let apiUrl = 'https://v3.football.api-sports.io/fixtures';
    let params = new URLSearchParams();
    let cacheDuration = 86400; // Varsayılan: 1 gün

    if (live === 'all') {
        params.set('live', 'all');
        cacheDuration = 120; // Canlı maçlar için 2 dakika
    } else if (date) {
        params.set('date', date);
        const today = new Date().toISOString().split('T')[0];
        if (date < today) {
            cacheDuration = 604800; // Geçmiş maçlar için 1 hafta
        } else {
            cacheDuration = 3600; // Gelecek maçlar için 1 saat
        }
    } else {
        return new Response(JSON.stringify({ error: "Geçerli bir parametre (date veya live) gerekli." }), { status: 400 });
    }

    apiUrl = `${apiUrl}?${params.toString()}`;

    const cache = caches.default;
    const cacheKey = new Request(apiUrl);
    
    let response = await cache.match(cacheKey);
    if (response) {
        return response;
    }

    try {
        response = await fetch(apiUrl, { 
            headers: { 'x-apisports-key': apiKey, 'x-rapidapi-host': 'v3.football.api-sports.io' } 
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API hatası: ${response.status} - ${errorText}`);
        }
        
        const cacheableResponse = new Response(response.body, response);
        cacheableResponse.headers.set("Cache-Control", `public, max-age=${cacheDuration}`); 

        context.waitUntil(cache.put(cacheKey, cacheableResponse.clone()));
        return cacheableResponse;

    } catch (e) { 
        return new Response(JSON.stringify({ error: `Maçlar çekilemedi: ${e.message}` }), { status: 500 }); 
    }
}