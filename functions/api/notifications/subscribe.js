// subscribe.js


// functions/api/notifications/subscribe.js
import { verify, decode } from '@tsndr/cloudflare-worker-jwt';

export async function onRequestPost(context) {
    const { DB, JWT_SECRET } = context.env;
    if (!DB || !JWT_SECRET) return new Response(JSON.stringify({ error: "Sunucu yapÄ±landÄ±rmasÄ± eksik." }), { status: 500 });

    try {
        // KullanÄ±cÄ± kimliÄŸini doÄŸrula
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) return new Response(null, { status: 401 });
        const token = authHeader.substring(7);
        if (!await verify(token, JWT_SECRET)) return new Response(null, { status: 401 });
        
        const { payload } = decode(token);
        const userId = payload.sub;

        // Abonelik bilgisini al
        const subscription = await context.request.json();
        const subscriptionString = JSON.stringify(subscription);

        // VeritabanÄ±na kaydet
        await DB.prepare('INSERT INTO PushSubscriptions (user_id, subscription) VALUES (?, ?) ON CONFLICT(subscription) DO NOTHING')
            .bind(userId, subscriptionString)
            .run();

        return new Response(JSON.stringify({ success: true }), { status: 201 });
    } catch (error) {
        console.error("Abonelik hatasÄ±:", error);
        return new Response(JSON.stringify({ error: "Abonelik kaydedilemedi." }), { status: 500 });
    }
}