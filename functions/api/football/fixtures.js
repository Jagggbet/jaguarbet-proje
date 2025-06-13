// Dosya: functions/api/football/fixtures.js (SÜPER GÜÇLÜ ÖNBELLEKLEME VERSİYONU)

// Gol bildirim fonksiyonun burada (hiçbir değişiklik yok)
async function sendPushNotification(2 dakika dolana kadar bu hafızadakini ver."

Bu, `DYNAMIC` sorununu çözmenin en garantili yoludur.

**Son Adım: Son Test**

Bu yeni, daha güçlü kuralı Cloudflare'de oluşturcontext, subscription, payload) {
    // ... senin mevcut, çalışan kodun ...
}

export async function onRequestGet(context) {
    const { env, waitUntil } = context;
    const { API_FOOTBALL_KEY, JAGUAR_STATS, DB } = env;

    if (!API_FOOTBALL_KEY) {
        return new Response(JSON.stringify({ error: "API key not configured." }), { status: 500 });
    }

    const url = new URL(context.request.url);
    const date = url.searchParams.getup kaydettikten sonra, lütfen birkaç dakika bekle ve `curl -I "https://rusakh.store/api/football/fixtures?live=all"` testini tekrar yap.

Bu sefer `cf-cache-status: HIT` görmemiz gerekiyor. Eğer hala `DYNAMIC` görüyorsak, bu çok nadir bir durumdur ve Cloudflare panelindeki başka bir ayarın (örneğin "Bypass Cache on Cookie" gibi) bunu ezdiği anlamına gelir,('date');
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
            // Bu, Cloudflare'e cevabı ne o zaman o ayarı bulmamız gerekir. Ama bu kuralın sorunu çözme ihtimali çok yüksektir.