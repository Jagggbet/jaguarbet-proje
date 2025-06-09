// set-favorites.js
import { verify, decode } from '@tsndr/cloudflare-worker-jwt';

export async function onRequestPost(context) {
    const { DB, JWT_SECRET } = context.env;
    if (!DB || !JWT_SECRET) return new Response(JSON.stringify({ error: "Sunucu yapÄ±landÄ±rmasÄ± eksik." }), { status: 500 });

     try {
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'GiriÅŸ yapmanÄ±z gerekiyor.' }), { status: 401 });
        
        const token = authHeader.substring(7);
        const isValid = await verify(token, JWT_SECRET);
        if (!isValid) return new Response(JSON.stringify({ error: 'GeÃ§ersiz token.' }), { status: 401 });

        const { payload } = decode(token);
        const userId = payload.sub;
        if (!userId) return new Response(JSON.stringify({ error: 'Token iÃ§inde kullanÄ±cÄ± kimliÄŸi yok.' }), { status: 400 });

        const favoriteIds = await context.request.json();
        if (!Array.isArray(favoriteIds)) return new Response(JSON.stringify({ error: 'GeÃ§ersiz veri formatÄ±.' }), { status: 400 });

        const stmts = [DB.prepare("DELETE FROM UserFavorites WHERE user_id = ?").bind(userId)];
        const insertStmt = DB.prepare("INSERT INTO UserFavorites (user_id, fixture_id) VALUES (?, ?)");
        favoriteIds.forEach(fixtureId => stmts.push(insertStmt.bind(userId, fixtureId)));
        
        await DB.batch(stmts);
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: "Favoriler kaydedilemedi.", details: e.message }), { status: 500 });
    }
}
