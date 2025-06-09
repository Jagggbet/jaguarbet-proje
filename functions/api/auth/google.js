// functions/api/auth/google.js (GÃœNCELLENMÄ°Åž VE KONTROL EDÄ°LMÄ°Åž HALÄ°)

export async function onRequestGet(context) {
    const googleClientId = context.env.GOOGLE_CLIENT_ID;

    // EÄŸer Client ID ortam deÄŸiÅŸkeni ayarlanmamÄ±ÅŸsa, hata ver.
    if (!googleClientId) {
        return new Response("Hata: GOOGLE_CLIENT_ID sunucuda ayarlanmamÄ±ÅŸ.", { status: 500 });
    }

    const redirectUri = 'https://rusakh.store/api/auth/callback';
    const state = crypto.randomUUID(); // GÃ¼venlik iÃ§in state parametresi

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', googleClientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state);

    // En Ã¶nemli kÄ±sÄ±m: Response.redirect ile tarayÄ±cÄ±yÄ± yÃ¶nlendiriyoruz.
    // 302, geÃ§ici yÃ¶nlendirme demektir.
    return Response.redirect(authUrl.toString(), 302);
}
