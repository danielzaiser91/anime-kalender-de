/**
 * **Filme und Specials über ihren eigenen Block im deutschen Katalog belegen.**
 *
 * Daniel am 29.08.2026: „wenn der lauf gesamten crunchy bestand hat und alles
 * sammelt, wieso kannst du dann nicht alle fragen selbst lösen? … also such
 * sicher, nicht grob."
 *
 * Der Schluss stimmt, und der Weg führt über eine Struktur, die wir bis dahin
 * nicht genutzt haben: Crunchyroll führt **Filmreihen als eigene Serie**, und
 * jeder Film ist dort ein Block mit eigener Sprachangabe. Gemessen:
 *
 *     G4PH0WMN7  Fairy Tail Movies
 *       GRGGCVMMK  Fairy Tail Movie 2 - Dragon Cry           de-DE, ja-JP
 *       G609CX33Q  Fairy Tail Movie 1 - Phoenix Priestess    ja-JP, de-DE
 *
 * Unser offener Eintrag heißt „Fairy Tail: The Movie - Phoenix Priestess" — der
 * zweite Block ist er. Dass die Serie „Fairy Tail" 175 deutsche Folgen hat,
 * sagt darüber nichts; der Block sagt es.
 *
 * **Verglichen wird das Kennwort, nicht der ganze Name.** „Phoenix Priestess"
 * steht in beiden Titeln; alles davor ist Reihenname und Nummerierung, und die
 * schreibt jede Seite anders („The Movie" gegen „Movie 1"). Das Kennwort muss
 * mindestens sechs Zeichen haben — sonst träfe „Teil 2" auf jeden zweiten Film.
 *
 * **Was nicht funktioniert, und warum es hierher gehört:** Der japanische
 * Originaltitel taugt bei Crunchyroll nicht als Suchanker. Vier Fälle geprüft,
 * kein einziger Treffer — die Suche indiziert nur lokalisierte Titel
 * („Gyakusatsu Kikan" findet KONOHANA KITAN). Und das Jahr in der Antwort ist
 * das der Aufnahme ins Angebot, nicht der Erstausstrahlung: „Ride Your Wave"
 * von 2019 steht dort mit 2021. Als Prüfstein ist beides unbrauchbar.
 *
 * Aufruf: npm run data:cr-filmbloecke
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
    if (x.format === 'TV' || x.format === 'ONA') continue
    offen.push({ id: x.id, titel: x.titleDe, en: x.titleEn, romaji: x.titleRomaji, format: x.format, jahr: x.jpYear, url: s.url, serie: nachUrl.get(s.url) })
  }
}
console.log(`${offen.length} offene Filme/OVAs/Specials`)

const tok = await fetch('https://beta-api.crunchyroll.com/auth/v1/token', {
  method: 'POST',
  headers: { Authorization: 'Basic ' + Buffer.from('noaihdevm_6iyg0a8l0q:').toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
  body: 'grant_type=client_id',
}).then((r) => r.json())
if (tok.country !== 'DE') { console.error('Nicht aus Deutschland — Abbruch.'); process.exit(1) }
const hol = (u) => fetch(u, { headers: { Authorization: `Bearer ${tok.access_token}`, 'User-Agent': UA } }).then((r) => r.json()).catch(() => null)
const warte = () => new Promise((r) => setTimeout(r, 700))

const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
/** Der unterscheidende Teil eines Filmtitels: alles nach dem letzten Trenner. */
const kennwortRoh = (s) => {
  const t = (s ?? '').split(/s[-–—:]s|s*:s*/).filter(Boolean)
  return (t[t.length - 1] ?? s ?? '').replace(/[~„"]/g, '').trim()
}
const kennwort = (s) => {
  const t = (s ?? '').split(/\s[-–—:]\s|\s*:\s*/).filter(Boolean)
  return norm(t[t.length - 1] ?? s)
}

const blockCache = new Map()
async function bloeckeVon(serienId) {
  if (blockCache.has(serienId)) return blockCache.get(serienId)
  const r = await hol(`https://beta-api.crunchyroll.com/content/v2/cms/series/${serienId}/seasons?locale=de-DE`)
  await warte()
  const bl = (r?.data ?? []).map((st) => ({ id: st.id, titel: st.title ?? '', audio: st.audio_locales ?? [] }))
  blockCache.set(serienId, bl)
  return bl
}

const funde = []
for (const o of offen) {
  const namen = [o.titel, o.en, o.romaji].filter(Boolean)
  /* Kandidaten-Serien: die eigene Kennung, dazu die Suche nach „<Reihe> Movies". */
  const serienIds = new Set()
  if (o.serie?.seriesId) serienIds.add(o.serie.seriesId)
  const reihe = (o.titel ?? o.en ?? '').split(/\s[-–—:]\s|\s*:\s*/)[0]
  for (const frage of [`${reihe} Movies`, reihe]) {
    const s = await hol(`https://beta-api.crunchyroll.com/content/v2/discover/search?q=${encodeURIComponent(frage)}&n=8&type=series&locale=de-DE`)
    await warte()
    for (const it of (s?.data ?? []).flatMap((g) => g.items ?? [])) {
      if (norm(it.title).includes(norm(reihe))) serienIds.add(it.id)
    }
    if (serienIds.size > 3) break
  }

  /* In den Blöcken den Film suchen — über sein Kennwort, nicht über den ganzen Namen. */
  let treffer = null
  for (const sid of serienIds) {
    for (const b of await bloeckeVon(sid)) {
      const bn = norm(b.titel)
      const passt =
        namen.some((n) => norm(n) === bn) ||
        namen.some((n) => bn.includes(kennwort(n)) && kennwort(n).length >= 6)
      if (!passt) continue
      treffer = { serienId: sid, blockId: b.id, blockTitel: b.titel, audio: b.audio }
      break
    }
    if (treffer) break
  }
  /*
    **Dritter Weg: die OVA ist eine Folge, keine Serie.**

    „TONIKAWA: Over The Moon For You ~Uniform~" führt Crunchyroll als Episode
    innerhalb der Serie — und die Episode nennt in `versions` alle ihre
    Sprachfassungen, `de-DE` eingeschlossen. Gemessen am 29.08.2026: Zehn
    Treffer für dieselbe Folge, einer je Tonspur, und jeder trägt dieselbe
    vollständige `versions`-Liste.

    **Zwei Merkmale müssen zusammen passen**, sonst gilt der Treffer nicht: der
    Serienname und das Kennwort im Episodentitel. „Uniform" allein wäre zu
    wenig — in einer Serie mit fünfzig Folgen heißt leicht mehr als eine so.
  */
  if (!treffer) {
    const s2 = await hol(
      `https://beta-api.crunchyroll.com/content/v2/discover/search?q=${encodeURIComponent(`${reihe} ${kennwortRoh(o.titel ?? o.en)}`)}&n=12&type=episode&locale=de-DE`,
    )
    await warte()
    for (const it of (s2?.data ?? []).flatMap((g) => g.items ?? [])) {
      const md = it.episode_metadata ?? {}
      const serieOk = norm(md.series_title ?? '').includes(norm(reihe)) || norm(reihe).includes(norm(md.series_title ?? ''))
      const kw = namen.map(kennwort).find((k) => k.length >= 6 && norm(it.title).includes(k))
      if (!serieOk || !kw) continue
      const versionen = (md.versions ?? []).map((v) => v.audio_locale).filter(Boolean)
      if (!versionen.length) continue
      treffer = { serienId: md.series_id ?? null, blockId: it.id, blockTitel: `Folge „${it.title}" in ${md.series_title}`, audio: versionen }
      break
    }
  }

  funde.push({ ...o, serie: undefined, treffer })
  const z = !treffer ? '—' : treffer.audio.includes('de-DE') ? 'DE' : treffer.audio.length ? 'kein DE' : '?'
  console.log(`  ${(o.format ?? '?').padEnd(7)} ${(o.titel ?? o.en ?? '').slice(0, 42).padEnd(44)} ${z.padEnd(8)} ${treffer ? treffer.blockTitel.slice(0, 34) : ''}`)
}

writeFileSync('data/cr-filmbloecke.json', JSON.stringify(funde, null, 2) + '\n')
const mit = funde.filter((f) => f.treffer)
console.log(`\n${mit.length} von ${funde.length} über einen eigenen Block gefunden`)
console.log(`  mit de-DE: ${mit.filter((f) => f.treffer.audio.includes('de-DE')).length}`)
console.log(`  ohne de-DE: ${mit.filter((f) => f.treffer.audio.length && !f.treffer.audio.includes('de-DE')).length}`)
