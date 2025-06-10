export async function onRequestGet(context) {
    const { env } = context;
    const apiKey = env.API_FOOTBALL_KEY;
    const url = new URL(context.request.url);
    const fixtureId = url.searchParams.get('id');
    if (!fixtureId) return new Response(JSON.stringify({ error: "Maç ID'si gerekli" }), { status: 400 });

    const apiUrl = `https://v3.football.api-sports.io/fixtures/lineups?fixture=${fixtureId}`;
    const response = await fetch(apiUrl, { headers: { 'x-apisports-key': apiKey, 'x-rapidapi-host': 'v3.football.api-sports.io' } });
    return response;
}