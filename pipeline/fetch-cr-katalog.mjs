/**
 * **Den vollständigen deutschen Crunchyroll-Katalog holen und lokal abgleichen.**
 *
 * Daniel am 29.08.2026: „egal als was crunchy den Titel führt, wir scrapen doch
 * metadata und haben mehr info als nur titel? prüf ob du mit anderen
 * suchparameter den titel gefunden hättest."
 *
 * Der Einwand trifft, und die Antwort ist einfacher als jede Suche:
 * `discover/browse` gibt den **ganzen** Katalog heraus — 1.591 Einträge in 16
 * Abrufen, davon 352 mit deutscher Tonspur. Danach braucht es keine Suchanfrage
 * mehr; abgeglichen wird lokal, mit allen Merkmalen auf einmal.
 *
 * **Der Anlass war „Fruits Basket: Prelude".** Unser englischer Titel lautet
 * „Fruits Basket -prelude-", Crunchyroll führt den Film schlicht als
 * **„-prelude-"** — kein Namensvergleich der Welt findet das über die Suche.
 * Im Katalog steht er an dritter Stelle, mit `de-DE`.
 *
 * **Und die eigentliche Lehre steht im Filter, nicht im Abruf.** Ein erster
 * Versuch ordnete 16 der 30 offenen Verweise zu — und die Mehrzahl davon
 * falsch:
 *
 *     „Sword Art Online: Extra Edition"  ->  „Sword Art Online"
 *     „One Punch Man OVAs"               ->  „One-Punch Man"
 *     „The Promised Neverland Staffel 2" ->  „THE PROMISED NEVERLAND"
 *
 * Ein Namensteil trifft **immer** den Reihennamen, und die Serie vererbt ihre
 * Sprache nicht an Specials und OVAs. Deshalb verlangt der Abgleich ein
 * zweites, **zählbares** Merkmal: die Folgenzahl. Bei einem Film heißt das 0
 * oder 1.
 *
 * Übrig bleibt genau ein sicherer Treffer — „-prelude-", mit einer Folge und
 * passendem Format. Das ist wenig, und es ist richtig so: Die anderen fünfzehn
 * wären Behauptungen gewesen.
 *
 * Aufruf: npm run data:cr-katalog
 */
import { readFileSync, writeFileSync } from 'node:fs'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
const tok = await fetch('https://beta-api.crunchyroll.com/auth/v1/token', {
  method: 'POST',
  headers: { Authorization: 'Basic ' + Buffer.from('noaihdevm_6iyg0a8l0q:').toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
  body: 'grant_type=client_id',
}).then((r) => r.json())
if (tok.country !== 'DE') { console.error('Nicht aus Deutschland — Abbruch.'); process.exit(1) }
const hol = (u) => fetch(u, { headers: { Authorization: `Bearer ${tok.access_token}`, 'User-Agent': UA } }).then((r) => r.json()).catch(() => null)

const alle = []
for (let start = 0; start < 3000; start += 100) {
  const r = await hol(`https://beta-api.crunchyroll.com/content/v2/discover/browse?n=100&start=${start}&locale=de-DE`)
  const seite = r?.data ?? []
  if (!seite.length) break
  for (const it of seite) {
    const md = it.movie_listing_metadata ?? it.series_metadata ?? {}
    alle.push({
      id: it.id,
      typ: it.type,
      titel: it.title,
      beschreibung: (it.description ?? '').slice(0, 300),
      audio: md.audio_locales ?? (md.audio_locale ? [md.audio_locale] : []),
      untertitel: md.subtitle_locales ?? [],
      folgen: md.episode_count ?? null,
      staffeln: md.season_count ?? null,
      jahr: md.series_launch_year ?? md.movie_release_year ?? null,
    })
  }
  process.stdout.write(`\r  ${alle.length} / ${r?.total ?? '?'}`)
  await new Promise((x) => setTimeout(x, 700))
}
console.log(`\n${alle.length} Einträge geholt, ${alle.filter((x) => x.audio.includes('de-DE')).length} mit de-DE`)
writeFileSync('data/cr-katalog-de.json', JSON.stringify({ geholtAm: new Date().toISOString(), eintraege: alle }, null, 2) + '\n')

/*
  **Der Abgleich: Name UND Folgenzahl, sonst nichts.**

  Ein Namensteil trifft immer den Reihennamen — „One Punch Man OVAs" enthält
  „One-Punch Man", und die Serie vererbt ihre Sprache nicht an die OVA. Ein
  erster Versuch ordnete so 16 von 30 zu, die Mehrzahl falsch.
*/
const titles = JSON.parse(readFileSync('public/data/titles.json', 'utf8'))
const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const offen = []
for (const x of titles) {
  for (const s of x.streams ?? []) {
    if (s.platform !== 'crunchyroll' || s.dub !== undefined) continue
    offen.push({ id: x.id, titel: x.titleDe, en: x.titleEn, romaji: x.titleRomaji, format: x.format, folgen: x.episodes })
  }
}

const zuordnung = []
for (const o of offen) {
  const namen = [o.titel, o.en, o.romaji].filter(Boolean).map(norm)
  const kandidaten = alle
    .map((k) => {
      const kn = norm(k.titel)
      const exakt = namen.includes(kn)
      const teil = kn.length >= 6 && !exakt && namen.some((n) => n.includes(kn))
      if (!exakt && !teil) return null
      const folgenPasst =
        (o.folgen && k.folgen === o.folgen) ||
        (o.format === 'MOVIE' && o.folgen === 1 && (k.folgen === 0 || k.folgen === 1))
      if (!folgenPasst) return null
      return { ...k, punkte: exakt ? 5 : 3, art: exakt ? 'Name exakt' : 'Katalogtitel steckt in unserem' }
    })
    .filter(Boolean)
    .sort((a, b) => b.punkte - a.punkte)
  const [a, b] = kandidaten
  if (!a || (b && b.punkte === a.punkte)) continue
  zuordnung.push({ id: o.id, unser: o.titel ?? o.en, katalogId: a.id, katalogTitel: a.titel, audio: a.audio, art: a.art, folgen: a.folgen })
}
writeFileSync('data/cr-katalog-zuordnung.json', JSON.stringify(zuordnung, null, 2) + '\n')
console.log(`${zuordnung.length} von ${offen.length} offenen Verweisen sicher zugeordnet, ${zuordnung.filter((z) => z.audio.includes('de-DE')).length} mit de-DE`)
for (const z of zuordnung) console.log(`  ${z.audio.includes('de-DE') ? 'DE' : '--'} ${z.unser.slice(0, 40)} -> ${z.katalogTitel}`)
