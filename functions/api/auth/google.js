// functions/api/auth/google.js (DÜZELTİLMİŞ)

export async function onRequestGet(context) {
    const googleClientId = context.env.GOOGLE_CLIENT_ID;

    if (!googleClientId) {
        return new Response("Hata: GOOGLE_CLIENT_ID sunucuda ayarlanmamış.", { status: 500 });
    }

    // Gelen isteğin URL'sinden domain'i dinamik olarak alıyoruz.
    const url = new URL(context.request.url);
    const redirectUri = `${url.protocol}//${url.host}/api/auth/callback`;
    
    const state = crypto.randomUUID();

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', googleClientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state); // Güvenlik için state parametresi eklendi
    authUrl.searchParams.set('access_type', 'offline'); // Refresh token almak için (opsiyonel ama iyi bir pratik)
    

    // Tarayıcıyı Google'ın giriş sayfasına yönlendir
    return Response.redirect(authUrl.toString(), 302);
}