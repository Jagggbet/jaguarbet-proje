import { sign } from '@tsndr/cloudflare-worker-jwt';

export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const code = url.searchParams.get('code');
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, DB } = context.env;
    // DÄ°KKAT: Yeni dosya yoluna gÃ¶re callback URL'sini gÃ¼ncelledik.
    const redirectUri = 'https://rusakh.store/api/auth/callback';

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !JWT_SECRET || !DB) {
        return Response.redirect(`https://rusakh.store?error=Sunucu+yap%C4%B1land%C4%B1rmas%C4%B1+eksik.`);
    }

    try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            })
        });

        const tokenData = await tokenRes.json();
        if (tokenData.error) {
            throw new Error(tokenData.error_description || 'Google token alÄ±namadÄ±.');
        }

        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });

        const userInfo = await userRes.json();

        await DB.prepare(`
            INSERT INTO Users (id, email, name, provider)
            VALUES (?, ?, ?, 'google')
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                email = excluded.email
        `).bind(userInfo.sub, userInfo.email, userInfo.name).run();

        const payload = {
            sub: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
            provider: 'google',
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7)
        };

        const token = await sign(payload, JWT_SECRET);
        const successUrl = new URL('https://rusakh.store');
        successUrl.searchParams.set('token', token);
        return Response.redirect(successUrl.toString(), 302);
    } catch (error) {
        console.error('Google auth error:', error);
        return Response.redirect(`https://rusakh.store?error=${encodeURIComponent(error.message)}`);
    }
}

