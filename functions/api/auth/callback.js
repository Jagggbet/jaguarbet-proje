// functions/api/auth/callback.js (DÜZELTİLMİŞ)

import { sign } from '@tsndr/cloudflare-worker-jwt';

export async function onRequestGet(context) {
    const requestUrl = new URL(context.request.url);
    const code = requestUrl.searchParams.get('code');
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, DB } = context.env;

    // Projenin ana sayfa URL'sini dinamik olarak alıyoruz
    const siteUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    
    // Google'a gönderdiğimiz redirect URI'nin aynısını burada da kullanıyoruz
    const redirectUri = `${siteUrl}/api/auth/callback`;

    if (!code) {
        return Response.redirect(`${siteUrl}?error=Google'dan+yetki+kodu+alınamadı.`);
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !JWT_SECRET || !DB) {
        return Response.redirect(`${siteUrl}?error=Sunucu+yapılandırması+eksik.`);
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
            throw new Error(`Google Token Hatası: ${tokenData.error_description}`);
        }

        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });

        const userInfo = await userRes.json();
        if (!userInfo.sub) {
             throw new Error('Google kullanıcı bilgileri alınamadı.');
        }

        // Kullanıcıyı veritabanına ekle veya güncelle
        await DB.prepare(`
            INSERT INTO Users (id, email, name, provider)
            VALUES (?, ?, ?, 'google')
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                email = excluded.email,
                provider = 'google'
        `).bind(userInfo.sub, userInfo.email, userInfo.name).run();

        // Kullanıcı için JWT oluştur
        const payload = {
            sub: userInfo.sub, // Google'ın benzersiz kullanıcı ID'si
            email: userInfo.email,
            name: userInfo.name,
            provider: 'google',
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 gün geçerli
        };

        const token = await sign(payload, JWT_SECRET);
        
        // Kullanıcıyı token ile birlikte ana sayfaya yönlendir
        const successUrl = new URL(siteUrl);
        successUrl.searchParams.set('token', token);
        return Response.redirect(successUrl.toString(), 302);

    } catch (error) {
        console.error('Google Auth Callback Hatası:', error);
        return Response.redirect(`${siteUrl}?error=${encodeURIComponent('Giriş sırasında bir sunucu hatası oluştu.')}`);
    }
}