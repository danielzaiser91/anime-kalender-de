/**
 * **Die Crunchyroll-Weiche: GitHub-Läufe fragen den deutschen Katalog über Frankfurt.**
 *
 * Crunchyroll leitet die Region aus der IP ab, und GitHub-Runner stehen in den
 * USA — deshalb liefen die Crunchyroll-Urteile bisher nur von Daniels PC aus
 * (CLAUDE.md, „Der deutsche Katalog ist erreichbar"). Gemessen am 16.09.2026
 * mit einem Wegwerf-Worker: Von Cloudflare aus antwortet `auth/v1/token` mit
 * `country: DE`, und die Staffelliste von Fruits Basket stimmt mit der Messung
 * vom PC überein. Das Placement hält den Worker in Frankfurt, damit das nicht
 * davon abhängt, wo die Anfrage eintrifft.
 *
 * Die Weiche leitet **nur** an `https://beta-api.crunchyroll.com/` weiter und
 * nur mit dem Geheimwort `WEICHE_TOKEN` (Header `X-Weiche-Token`). Sie
 * speichert nichts.
 *
 * Aufruf: `POST|GET https://cr-weiche.animekalender.workers.dev/?url=<Crunchyroll-Adresse>`
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

export default {
  async fetch(request, env) {
    if (!env.WEICHE_TOKEN || request.headers.get('X-Weiche-Token') !== env.WEICHE_TOKEN) {
      return new Response('nicht erlaubt', { status: 403 })
    }
    /* Diagnose: wo läuft die Weiche, und als welches Land sieht Crunchyroll sie? */
    if (new URL(request.url).searchParams.has('diag')) {
      const trace = await fetch('https://www.cloudflare.com/cdn-cgi/trace').then((r) => r.text())
      const token = await fetch('https://beta-api.crunchyroll.com/auth/v1/token', {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa('noaihdevm_6iyg0a8l0q:'),
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': UA,
        },
        body: 'grant_type=client_id',
      }).then((r) => r.json())
      return Response.json({
        eingang: request.cf?.colo,
        eingangLand: request.cf?.country,
        ausgang: trace.split('\n').filter((l) => /^(colo|loc|ip)=/.test(l)),
        crunchyroll: token.country,
      })
    }
    let ziel
    try {
      ziel = new URL(new URL(request.url).searchParams.get('url') ?? '')
    } catch {
      return new Response('url fehlt', { status: 400 })
    }
    if (ziel.protocol !== 'https:' || ziel.hostname !== 'beta-api.crunchyroll.com') {
      return new Response('nur beta-api.crunchyroll.com', { status: 400 })
    }
    const headers = new Headers({ 'User-Agent': UA })
    for (const name of ['authorization', 'content-type']) {
      const wert = request.headers.get(name)
      if (wert) headers.set(name, wert)
    }
    const antwort = await fetch(ziel, {
      method: request.method === 'POST' ? 'POST' : 'GET',
      headers,
      body: request.method === 'POST' ? await request.text() : undefined,
    })
    return new Response(antwort.body, {
      status: antwort.status,
      headers: { 'content-type': antwort.headers.get('content-type') ?? 'application/json' },
    })
  },
}
