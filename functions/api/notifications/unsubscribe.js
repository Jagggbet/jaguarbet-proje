// unsubscribe.js

import { verify, decode } from '@tsndr/cloudflare-worker-jwt';

export async function onRequestPost(context) {
    const { DB, JWT_SECRET } = context.env;
    if (!DB || !JWT_SECRET) return new Response(null, { status: 500 });

    try {
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) return new Response(null, { status: 401 });
        const token = authHeader.substring(7);
        if (!await verify(token, JWT_SECRET)) return new Response(null, { status: 401 });
        
        const { payload } = decode(token);
        const userId = payload.sub;

        // Frontend'den gelen abonelik endpoint'ini al
        const { endpoint } = await context.request.json();
        if (!endpoint) return new Response(null, { status: 400 });

        // VeritabanÄ±ndan bu aboneliÄŸi sil
        // Not: Subscription objeleri bÃ¼yÃ¼k olduÄŸu iÃ§in, sadece endpoint'e gÃ¶re arama yapmak yerine
        // tÃ¼m subscription objesini alÄ±p karÅŸÄ±laÅŸtÄ±rmak daha gÃ¼venli olabilir ama bu da Ã§alÄ±ÅŸÄ±r.
        const allSubscriptions = await DB.prepare('SELECT id, subscription FROM PushSubscriptions WHERE user_id = ?').bind(userId).all();

        for (const sub of allSubscriptions.results) {
            const parsedSub = JSON.parse(sub.subscription);
            if (parsedSub.endpoint === endpoint) {
                await DB.prepare('DELETE FROM PushSubscriptions WHERE id = ?').bind(sub.id).run();
                break;
            }
        }

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error) {
        console.error("Abonelik silme hatasÄ±:", error);
        return new Response(null, { status: 500 });
    }
}
