export async function onRequestGet(context) {
    // Ortam değişkenlerinden public VAPID anahtarını al
    const { FCM_VAPID_PUBLIC_KEY } = context.env;

    // Eğer anahtar ayarlanmamışsa hata döndür
    if (!FCM_VAPID_PUBLIC_KEY) {
        console.error("FCM_VAPID_PUBLIC_KEY ortam değişkeni ayarlanmamış.");
        return new Response(JSON.stringify({ error: "Sunucu yapılandırması eksik." }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Anahtarı JSON formatında frontend'e gönder
    return new Response(JSON.stringify({ vapidPublicKey: FCM_VAPID_PUBLIC_KEY }), {
        headers: { 'Content-Type': 'application/json' }
    });
}