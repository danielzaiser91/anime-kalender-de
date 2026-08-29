/**
 * **Filme, OVAs und Specials im deutschen Crunchyroll-Katalog suchen.**
 *
 * `tools/cr-kennungen-suchen.mjs` sucht mit `type=series` — Filme findet es
 * deshalb nie. Genau die machen aber den Großteil der offenen Verweise aus: Am
 * 29.08.2026 hatten 26 der 56 offenen Crunchyroll-Verweise **keine
 * Serienkennung**, davon 18 Filme, 5 OVAs, 3 Specials.
 *
 * Ohne Typ-Filter gesucht, findet der Katalog sie als `movie_listing` — mit
 * ihren Tonspuren. Gemessen: **8 von 26 tragen `de-DE`**, darunter die drei
 * Project-Itoh-Filme, „Ride Your Wave" und „Kase-san and Morning Glories".
 *
 * **Der Namensvergleich ist exakt**, nicht ähnlich: Verglichen wird nach
 * Kleinschreibung ohne Sonderzeichen, und nur ein Volltreffer zählt. Ein
 * Beinahe-Treffer wäre hier besonders teuer, weil ein Film keinen zweiten
 * Prüfstein hat — keine Folgenzahl, keine Staffelstruktur.
 *
 * **Nur aus Deutschland.** Das anonyme Token trägt die Region der abrufenden
 * IP; aus den USA käme der US-Katalog, und dessen Schweigen belegt nichts
 * (CLAUDE.md). Der Lauf bricht ab, wenn `country` nicht `DE` ist.
 *
 * Aufruf: `npm run data:cr-einzelwerke`
 */
import { readFileSync, writeFileSync } from 'node:fs'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
const titles = JSON.parse(readFileSync('public/data/titles.json', 'utf8'))
const cr = JSON.parse(readFileSync('data/crunchyroll-dub.json', 'utf8'))
const nachUrl = new Map(cr.serien.map((s) => [s.url, s]))

const offen = []
for (const x of titles) {
  for (const s of x.streams ?? []) {
    if (s.platform !== 'crunchyroll' || s.dub !== undefined) continue
    const serie = nachUrl.get(s.url)
    if (serie?.seriesId) continue
    offen.push({ id: x.id, titel: x.titleDe ?? x.titleEn, en: x.titleEn, romaji: x.titleRomaji, format: x.format, folgen: x.episodes, url: s.url })
  }
}
console.log(`${offen.length} Verweise ohne Serienkennung`)

const tok = await fetch('https://beta-api.crunchyroll.com/auth/v1/token', {
  method: 'POST',
  headers: {
    Authorization: 'Basic ' + Buffer.from('noaihdevm_6iyg0a8l0q:').toString('base64'),
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': UA,
  },
  body: 'grant_type=client_id',
}).then((r) => r.json())
if (tok.country !== 'DE') { console.error('Nicht aus Deutschland — Abbruch.'); process.exit(1) }
console.log('Token für', tok.country)

const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const funde = []
for (const o of offen) {
  const namen = [...new Set([o.titel, o.en, o.romaji].filter(Boolean))]
  let treffer = null
  for (const n of namen) {
    const r = await fetch(
      `https://beta-api.crunchyroll.com/content/v2/discover/search?q=${encodeURIComponent(n)}&n=8&locale=de-DE`,
      { headers: { Authorization: `Bearer ${tok.access_token}`, 'User-Agent': UA } },
    ).then((x) => x.json()).catch(() => null)
    await new Promise((r2) => setTimeout(r2, 700))
    for (const gruppe of r?.data ?? []) {
      for (const it of gruppe.items ?? []) {
        /*
          **Der Katalogtitel darf ein Teil unseres Titels sein.**

          Daniel am 29.08.2026, mit Link: „den titel gibt es auf crunchy, wieso
          nicht gefunden?" — „Fruits Basket: Prelude" heißt bei uns englisch
          „Fruits Basket -prelude-", und Crunchyroll führt den Film schlicht als
          **„-prelude-"**. Der exakte Vergleich scheitert an
          „fruitsbasketprelude" gegen „prelude", obwohl beides dasselbe ist.

          Erlaubt ist deshalb auch: Der Katalogtitel steckt **vollständig** in
          unserem, und er ist mindestens sechs Zeichen lang. Die Richtung ist
          wichtig — umgekehrt („unser Titel steckt im Katalogtitel") träfe
          „Fruits Basket" auf jede Staffel der Reihe.

          Zwei Sperren bleiben: Die Suchanfrage nennt bereits den vollen Titel,
          die Trefferliste ist also eingegrenzt; und sechs Zeichen schließen
          Allerweltswörter aus.
        */
        const exakt = namen.some((n2) => norm(it.title) === norm(n2))
        const teil =
          norm(it.title).length >= 6 && namen.some((n2) => norm(n2).includes(norm(it.title)))
        if (!exakt && !teil) continue
        treffer = { id: it.id, typ: gruppe.type ?? it.type, titel: it.title, meta: it.movie_listing_metadata ?? it.series_metadata ?? it.movie_metadata ?? {} }
        break
      }
      if (treffer) break
    }
    if (treffer) break
  }
  const audio = treffer ? (treffer.meta.audio_locales ?? (treffer.meta.audio_locale ? [treffer.meta.audio_locale] : [])) : []
  funde.push({ ...o, treffer: treffer ? { id: treffer.id, typ: treffer.typ, titel: treffer.titel, audio } : null })
  const zeichen = !treffer ? '—' : audio.includes('de-DE') ? 'DE' : audio.length ? audio.join(',').slice(0, 24) : '?'
  console.log(`  ${(o.format ?? '?').padEnd(7)} ${(o.titel ?? '').slice(0, 44).padEnd(46)} ${zeichen}`)
}
writeFileSync('data/cr-einzelwerke.json', JSON.stringify(funde, null, 2) + '\n')
const mitTreffer = funde.filter((f) => f.treffer)
console.log(`\n${mitTreffer.length} von ${funde.length} im deutschen Katalog gefunden`)
console.log(`  mit de-DE: ${mitTreffer.filter((f) => f.treffer.audio.includes('de-DE')).length}`)
console.log(`  ohne de-DE: ${mitTreffer.filter((f) => f.treffer.audio.length && !f.treffer.audio.includes('de-DE')).length}`)
