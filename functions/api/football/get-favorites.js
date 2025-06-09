import { verify, decode } from '@tsndr/cloudflare-worker-jwt';

export async function onRequestGet(context) {
    const { DB, JWT_SECRET } = context.env;
    if (!DB || !JWT_SECRET) return new Response(JSON.stringify({ error: "Sunucu yapılandırması eksik." }), { status: 500 });

    try {
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) return new Response(JSON.stringify([]), { status: 200 });

        const token = authHeader.substring(7);
        const isValid = await verify(token, JWT_SECRET);
        if (!isValid) return new Response(JSON.stringify({ error: 'Geçersiz token.' }), { status: 401 });

        const { payload } = decode(token);
        const userId = payload.sub;
        if (!userId) return new Response(JSON.stringify({ error: 'Token içinde kullanıcı kimliği yok.' }), { status: 400 });

        const { results } = await DB.prepare("SELECT fixture_id FROM UserFavorites WHERE user_id = ?").bind(userId).all();
        const favoriteIds = results.map(row => row.fixture_id);

        return new Response(JSON.stringify(favoriteIds), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: "Favoriler alınamadı.", details: e.message }), { status: 500 });
    }
}