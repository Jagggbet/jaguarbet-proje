// Bu fonksiyon, bir maçın ID'sini alarak tüm detaylarını (event, stats, lineup) çeker.
export async function onRequestGet(context) {
    const { env } = context;
    const apiKey = env.API_FOOTBALL_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API anahtarı eksik" }), { status: 500 });

    const url = new URL(context.request.url);
    const fixtureId = url.searchParams.get('id');
    if (!fixtureId) return new Response(JSON.stringify({ error: "Maç ID'si gerekli" }), { status: 400 });

    // Tek bir istekte birden fazla detayı çekiyoruz
    const apiUrl = `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`;
    
    // API-Football'da tek bir fikstürün detayları sık değişmez, önbellekleyebiliriz.
    const cache = caches.default;
    const cacheKey = new Request(apiUrl);
    let response = await cache.match(cacheKey);
    if (response) return response;

    try {
        response = await fetch(apiUrl, { headers: { 'x-apisports-key': apiKey } });
        if (!response.ok) throw new Error(`API hatası: ${response.status}`);
        
        const data = await response.json();
        // Kadro ve istatistiklerin olup olmadığını kontrol et ve ek istekler yap (eğer gerekiyorsa)
        // Şimdilik sadece ana fikstür bilgisini döndürüyoruz. Gerekirse genişletilebilir.
        // API'nin ?id= parametresi zaten event, lineup, stats gibi temel bilgileri veriyor.

        const cacheableResponse = new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
        cacheableResponse.headers.set("Cache-Control", "public, max-age=3600"); // 1 saat önbellek
        context.waitUntil(cache.put(cacheKey, cacheableResponse.clone()));
        
        return cacheableResponse;

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}