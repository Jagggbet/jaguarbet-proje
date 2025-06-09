export async function onRequestGet(context) {
    const nonce = crypto.randomUUID();
    return new Response(JSON.stringify({ nonce }), { headers: { 'Content-Type': 'application/json' } });
}

