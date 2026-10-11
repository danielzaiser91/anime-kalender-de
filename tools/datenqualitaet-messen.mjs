/**
 * **Grundlinie der Datenqualität: was der Besucher je Weg (Titel × Anbieter) zu sehen bekommt.**
 *
 * Misst auf `public/data` (oder `dist/data`, `--daten=dist/data`) — dieselben Dateien, die die Seite lädt —
 * je Titelart (Anime Hauptbestand = titles.json, Anime Katalog ohne Synchro = ohne-synchro.json,
 * Cartoon/TMDB = cartoons.json) und je Anbieter:
 *   wege          sichtbare Pillen (gleiche Pillen zusammengelegt wie `wege-sortieren.ts`); roh = Einträge in `streams`
 *   haken         grüner Haken: `stream.dub === true` (`DubEcke` in `vermerk.tsx`, `antwort-bereich.tsx`)
 *   folgen*       Folgenangabe der Pille, mit der echten Web-Funktion `folgenAuskunft` gerechnet (kein Nachbau):
 *                 belegt = aus Bereichen am Weg, plan = Wochenplan der Releases, abgeleitet = Titelzahl bei
 *                 abgeschlossener Serie, joyn = Abruffenster, einzelwerk = Film/1 Folge (Zahl entfällt), keine
 *   nurSerie      kein Haken, aber „Deutsche Fassung laut JustWatch, für die Serie" (`title.dubHinweis`, nur Cartoons)
 *   haken ohne Zahl   Haken ohne Folgenzahl (Serienebene)
 *   teilt/teilBer Weg auf Anbieterseite, die mehrere unserer Staffeln bedient / davon mit bekanntem Teilbereich
 *   herkunft      WELCHE QUELLE die Sprachangabe trägt — im Datensatz nicht gespeichert, hier aus den Rohdateien
 *                 unter `data/` erschlossen (Näherung, Rangfolge siehe `herkunftVon`; Mehrfachspuren gezählt).
 *
 * Aufruf: node tools/datenqualitaet-messen.mjs [--daten=public/data] [--herkunft=aus|an] [--nur-json]
 * Ausgabe: Tabellen, dann eine Zeile `JSON {...}` mit Datum (zum Anhängen an eine Verlaufsdatei).
 * Läuft ohne Netz, schreibt nichts. Entstanden 11.10.2026 (Grundlinie, Daniel: wöchentlich neu messen).
 */
import { readFileSync, existsSync } from 'node:fs'
import { register, createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1] ?? d
const DATEN = resolve(WURZEL, arg('daten', 'public/data'))
const MIT_HERKUNFT = arg('herkunft', 'an') !== 'aus'
const NUR_JSON = process.argv.includes('--nur-json')
const lies = (p) => JSON.parse(readFileSync(p, 'utf8'))
const liesDaten = (n) => lies(resolve(DATEN, n))

/* ---------- Web-Code laden: der Alias `@shared/` zeigt auf shared/ (wie in tsconfig.json) ---------- */
async function ladeWebCode() {
  const hook = `export async function resolve(s,c,n){if(s.startsWith('@shared/'))return n('${pathToFileURL(WURZEL).href}/shared/'+s.slice(8),c);return n(s,c)}`
  register('data:text/javascript,' + encodeURIComponent(hook))
  const w = (p) => import(pathToFileURL(resolve(WURZEL, p)).href)
  const [fa, sb, zeit] = await Promise.all([
    w('web/src/components/detail/folgen-angabe.ts'),
    w('web/src/components/detail/stream-bereiche.ts'),
    w('shared/time.ts'),
  ])
  return { folgenAuskunft: fa.folgenAuskunft, titelMitTerminBereichen: sb.titelMitTerminBereichen, heute: zeit.todayIso() }
}

/* ---------- Pillen: dieselbe Zusammenlegung wie `wege-sortieren.ts` ---------- */
const sig = (x) => `${x.platform}|${x.zugang ?? ''}|${x.dub}|${JSON.stringify((x.dubRanges ?? []).filter((r) => r.dub).map((r) => [r.from, r.to]))}`
const pillen = (streams) => {
  const arten = ['kostenlos', 'abo', 'kauf', 'unbekannt']
  return arten.flatMap((art) =>
    (streams ?? []).filter((s) => (s.zugang ?? 'abo') === art).filter((s, i, alle) => alle.findIndex((x) => sig(x) === sig(s)) === i),
  )
}

/* ---------- Folgenangabe ---------- */
const tSchluessel = (k, v) => (v ? `${k}#${JSON.stringify(v)}` : k)
function folgenKlasse({ titel, s, fn, releases, heute }) {
  const text = fn(s)
  const hatBereiche = (s.dubRanges ?? []).some((r) => r.dub)
  if (!text) {
    if (titel.format === 'MOVIE' || titel.episodes === 1) return 'einzelwerk'
    return 'keine'
  }
  if (s.platform === 'joyn') return 'joyn'
  if (text.startsWith('detail.neuAm')) return 'plan'
  if (hatBereiche) return 'belegt'
  if (text.startsWith('detail.folgenKurz')) {
    const wochen = releases.some((r) => r.platform === s.platform && r.releaseType === 'weekly')
    return wochen ? 'plan' : 'abgeleitet'
  }
  return 'belegt'
}

/* ---------- Herkunft der Sprachangabe (Näherung aus den Rohdateien) ---------- */
function ladeHerkunftsquellen() {
  const d = (n) => resolve(WURZEL, 'data', n)
  const yaml = createRequire(import.meta.url)('js-yaml')
  const hand = new Map()
  const handTag = new Map()
  for (const e of yaml.load(readFileSync(d('dub-confirmed.yaml'), 'utf8')) ?? []) {
    if (e.dub !== true) continue
    const n = String(e.note ?? '')
    const art = /Tonspuren|mit deutschem Ton/.test(n) ? 'Handbeleg: Tonspurliste am Ort (Erweiterung/Daniel)' : /rein deutsch/.test(n) ? 'Handbeleg: Anbieter rein deutsch (Daniel-Regel)' : 'Handbeleg: Sichtprüfung/sonstige'
    const kk = `${e.anilistId}|${e.platform}`
    if (!hand.has(kk) || art.includes('Tonspurliste')) hand.set(kk, art)
    if (String(e.checkedAt) > (handTag.get(kk) ?? '')) handTag.set(kk, String(e.checkedAt))
  }
  const urteile = new Map()
  for (const [k, v] of Object.entries(lies(d('urteile.json')))) {
    if (v.urteil !== 'deutsch') continue
    const [id, pf] = k.split('|')
    const kk = `${id}|${pf}`
    if (urteile.get(kk) !== 'gemessen') urteile.set(kk, v.art)
  }
  const crSerien = lies(d('crunchyroll-dub.json')).serien ?? []
  const cr = new Set()
  for (const s of crSerien) {
    const deutsch = s.deutschImAngebot || (s.staffeln ?? []).some((st) => (st.deutsch ?? 0) > 0 || st.deutscheFassung)
    if (!deutsch) continue
    if (s.seriesId) cr.add(s.seriesId)
    if (s.url) cr.add(String(s.url).replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop().toLowerCase())
  }
  return {
    hand,
    urteile,
    cr,
    adn: lies(d('adn-vde-historie.json')).serien ?? {},
    motn: lies(d('motn.json')),
    jw: lies(d('justwatch-audio.json')),
    handTag,
    motnTon: new Set(lies(d('motn-tonspur.json')).filter((e) => e.deutsch === true).map((e) => `${e.titleId}|${e.platform}`)),
  }
}
const JW_NAME = { netflix: /netflix/i, primevideo: /amazon|prime/i, disneyplus: /disney/i, crunchyroll: /crunchyroll/i, rtlplus: /rtl/i, joyn: /joyn/i, youtube: /youtube/i, wow: /wow/i, adn: /animation digital|adn/i }
const STARK = /^(Handbeleg|Erweiterung \(gemessen|Anbieter-API|Streaming-Availability)/
const HOST_NAME = (u) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return 'unbekannt' } }

/** Alle Spuren, die diesen Weg stützen, in Rangfolge (stärkste zuerst); leer = keine rückführbare Spur. */
function spurenVon(titel, s, q, releases) {
  const spuren = []
  const id = titel.id
  if (q.hand.has(`${id}|${s.platform}`)) spuren.push(q.hand.get(`${id}|${s.platform}`))
  const u = q.urteile.get(`${id}|${s.platform}`)
  if (u === 'gemessen') spuren.push('Erweiterung (gemessen)')
  const crKennung = /\/series\/([A-Z0-9]+)/i.exec(s.url)?.[1]
  const crSlug = String(s.url).replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop().toLowerCase()
  if (s.platform === 'crunchyroll' && ((crKennung && q.cr.has(crKennung)) || q.cr.has(crSlug))) spuren.push('Anbieter-API (Crunchyroll)')
  const adnId = /\/video\/(\d+)/.exec(s.url)?.[1]
  if (s.platform === 'adn' && adnId && q.adn[adnId] && Object.keys(q.adn[adnId]).length) spuren.push('Anbieter-API (ADN vde)')
  const imdb = q.motn.gesucht?.[String(id)]?.imdbId
  const mDeutsch = imdb && q.motn.shows?.[imdb]?.dienste?.[s.platform]?.deutsch
  if ((Array.isArray(mDeutsch) && mDeutsch.length) || q.motnTon.has(`${id}|${s.platform}`)) spuren.push('Streaming-Availability-Archiv (MotN)')
  const eigene = releases.filter((r) => r.platform === s.platform)
  for (const r of eigene) {
    const host = HOST_NAME((r.sources ?? [])[0] ?? '')
    spuren.push(/anime2you/.test(host) ? 'Anime2You-Meldung (Termin)' : `Termin-Quelle (${host})`)
    break
  }
  if (u === 'angenommen') spuren.push('Erweiterung (angenommen, Randprobe)')
  const jw = q.jw[String(id)]?.angebote?.some((a) => JW_NAME[s.platform]?.test(a.anbieter) && (a.audio ?? []).includes('de'))
  if (s.platform === 'joyn') spuren.push('Regel: Joyn ist ein deutscher Anbieter')
  if (jw) spuren.push('JustWatch (Tonspur de laut Aggregator)')
  return spuren
}
/** Die Quelle, die als Herkunft gilt: die stärkste Spur; ohne Spur „nicht rückführbar". */
const herkunftVon = (spuren) => spuren[0] ?? 'nicht rückführbar (Bau leitet ab)'

/* ---------- Zählen ---------- */
const HOST_ERWARTET = { netflix: /netflix\.com$/, primevideo: /amazon\.|primevideo\.com$/, crunchyroll: /crunchyroll\.com$/, disneyplus: /disneyplus\.com$/, joyn: /joyn\.de$/, rtlplus: /rtl\.de$/, wow: /wowtv\.de$/, youtube: /youtube\.com$|youtu\.be$/, adn: /animationdigitalnetwork\./ }
const adressePasst = (s) => !HOST_ERWARTET[s.platform] || HOST_ERWARTET[s.platform].test(HOST_NAME(s.url))
const tageZwischen = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)
const alterKlasse = (tag, heute) => { if (!tag) return 'ohne Datum'; const t = tageZwischen(tag, heute); return t <= 30 ? '<= 30 Tage' : t <= 60 ? '31-60 Tage' : '> 60 Tage' }
const leer = () => ({ wegeRoh: 0, wege: 0, haken: 0, hakenOhneZahl: 0, belegt: 0, plan: 0, abgeleitet: 0, joyn: 0, einzelwerk: 0, keine: 0, nurSerie: 0, ohneUrteil: 0, teilt: 0, teilBer: 0, herkunft: {}, zweitbeleg: 0, handAlter: {}, adresseFremd: 0, ohneAdresse: 0 })
const plus = (o, k, n = 1) => { o[k] = (o[k] ?? 0) + n }

function messeGruppe({ titel: liste, web, releasesJeTitel, q, mitMehrstaffel }) {
  const jeAnbieter = {}
  const gesamt = leer()
  const beispiele = {}
  let titelMitWeg = 0
  for (const roh of liste) {
    const rel = releasesJeTitel.get(roh.id) ?? []
    const t = web.titelMitTerminBereichen(roh, rel)
    const fn = web.folgenAuskunft({ releases: rel, title: t, t: tSchluessel, releaseJePlattform: new Map(rel.map((r) => [r.platform, r]).reverse()), today: web.heute })
    const alle = roh.streams ?? []
    if (alle.length) titelMitWeg++
    const sichtbar = pillen(t?.streams)
    for (const s of alle) for (const z of [jeAnbieter[s.platform] ??= leer(), gesamt]) z.wegeRoh++
    for (const s of sichtbar) {
      for (const z of [jeAnbieter[s.platform] ??= leer(), gesamt]) zaehleWeg(z, { roh, t, s, fn, rel, web, q, beispiele })
    }
  }
  return { jeAnbieter, gesamt, titelMitWeg, titel: liste.length, beispiele, mitMehrstaffel }
}

function zaehleWeg(z, { roh, t, s, fn, rel, web, q, beispiele }) {
  z.wege++
  const haken = s.dub === true
  if (haken) z.haken++
  const klasse = folgenKlasse({ titel: roh, s, fn, releases: rel, heute: web.heute })
  z[klasse]++
  const merke = (tag) => (beispiele[tag] ??= []).push({ id: roh.id, platform: s.platform, name: roh.titleDe ?? roh.titleEn ?? roh.titleRomaji, score: roh.score ?? 0, url: s.url })
  if (haken && klasse === 'keine') { z.hakenOhneZahl++; merke('hakenOhneZahl') }
  if (klasse === 'abgeleitet') merke('folgenAbgeleitet')
  if (!haken && s.dub !== false) merke('ohneUrteil')
  if (!haken && s.dub !== false) z.ohneUrteil++
  const jwName = JW_NAME[s.platform]
  const hinweis = roh.dubHinweis?.anbieter?.some((a) => (jwName ? jwName.test(a) : false))
  if (!haken && hinweis) { z.nurSerie++; merke('nurSerie') }
  if (!s.url) { z.ohneAdresse++; merke('ohneAdresse') } else if (!adressePasst(s)) { z.adresseFremd++; merke('adresseFremd') }
  if ((s.sharedWith ?? 0) > 1) { z.teilt++; merke('teiltSeite'); if (s.teilBereich) z.teilBer++ }
  if (haken && q) {
    const spuren = spurenVon(roh, s, q, rel)
    plus(z.herkunft, spuren.length ? herkunftVon(spuren) : 'nicht rückführbar (Bau leitet ab)')
    if (spuren[0]?.startsWith('Handbeleg')) plus(z.handAlter, alterKlasse(q.handTag.get(`${roh.id}|${s.platform}`), web.heute))
    if (!spuren.length) merke('hakenOhneSpur')
    if (new Set(spuren.filter((x) => STARK.test(x)).map((x) => x.split(/[:(]/)[0])).size >= 2) z.zweitbeleg++
  } else if (s.herkunft === 'tmdb') plus(z.herkunft, 'TMDB (nur Anbieter, ohne Sprache)')
  else if (hinweis) plus(z.herkunft, 'JustWatch (nur Serie)')
  else if (!haken) plus(z.herkunft, 'keine Sprachangabe')
}

/* ---------- Ausgabe ---------- */
const prozent = (n, g) => (g ? `${Math.round((100 * n) / g)} %` : '–')
function tabelle(titel, zeilen) {
  const spalten = ['Anbieter', 'Wege', 'roh', 'Haken', 'Fg.belegt', 'Fg.Plan', 'Fg.abgel.', 'Joyn', 'Einzelw.', 'ohneFg', 'Haken/ohneZahl', 'nurSerie', 'ohneUrteil', 'teilt', 'teilt+Teilber.']
  const rows = zeilen.map(([name, z]) => [name, z.wege, z.wegeRoh, z.haken, z.belegt, z.plan, z.abgeleitet, z.joyn, z.einzelwerk, z.keine, z.hakenOhneZahl, z.nurSerie, z.ohneUrteil, z.teilt, z.teilBer])
  const breite = spalten.map((s, i) => Math.max(s.length, ...rows.map((r) => String(r[i]).length)))
  const zeile = (r) => r.map((c, i) => (i ? String(c).padStart(breite[i]) : String(c).padEnd(breite[i]))).join('  ')
  console.log(`\n### ${titel}\n${zeile(spalten)}\n${breite.map((b) => '-'.repeat(b)).join('  ')}\n${rows.map(zeile).join('\n')}`)
}
function herkunftsTabelle(titel, jeAnbieter, gesamt) {
  const quellen = [...new Set(Object.values(jeAnbieter).flatMap((z) => Object.keys(z.herkunft)).concat(Object.keys(gesamt.herkunft)))]
  quellen.sort((a, b) => (gesamt.herkunft[b] ?? 0) - (gesamt.herkunft[a] ?? 0))
  const pf = Object.keys(jeAnbieter).sort((a, b) => jeAnbieter[b].wege - jeAnbieter[a].wege)
  console.log(`\n### Herkunft der Sprachangabe — ${titel}  (Wege; Näherung aus data/*, stärkste Spur zählt)`)
  console.log(['Quelle'.padEnd(46), 'gesamt'.padStart(7), ...pf.map((p) => p.slice(0, 8).padStart(9))].join(' '))
  for (const q of quellen) console.log([q.padEnd(46), String(gesamt.herkunft[q] ?? 0).padStart(7), ...pf.map((p) => String(jeAnbieter[p].herkunft[q] ?? 0).padStart(9))].join(' '))
  if (Object.keys(gesamt.handAlter).length) console.log(`Alter der Handbeleg-Wege (Prüftag bis heute): ${Object.entries(gesamt.handAlter).map(([k, v]) => `${k}: ${v}`).join(', ')}`)
  console.log(`Adresse: ${gesamt.ohneAdresse} Wege ohne Adresse (Pille ohne Link), ${gesamt.adresseFremd} mit Adresse eines anderen Anbieters`)
  if (gesamt.zweitbeleg !== undefined) console.log(`Haken mit mindestens zwei starken, unabhängigen Spuren (Hand, Messung, Anbieter-API, MotN): ${gesamt.zweitbeleg} von ${gesamt.haken}`)
}

function staffelKennzahlen(haupt, franchises) {
  const mehr = new Set()
  for (const mitglieder of Object.values(franchises)) {
    const staffeln = mitglieder.filter((m) => ['TV', 'ONA', 'TV_SHORT'].includes(m.format) && !m.beiwerk)
    if (staffeln.length >= 2) for (const m of staffeln) mehr.add(m.id)
  }
  const inMehr = haupt.filter((t) => mehr.has(t.id)).length
  return { titelInMehrstaffelFranchise: inMehr, titelEinzelstaffel: haupt.length - inMehr }
}

function beispieleAusgeben(gruppen) {
  const n = Number(arg('anzahl', 6))
  for (const [name, g] of Object.entries(gruppen)) {
    for (const [tag, liste] of Object.entries(g.beispiele)) {
      const einmal = [...new Map(liste.map((b) => [b.id + '|' + b.platform + '|' + b.url, b])).values()]
      const top = einmal.sort((a, b) => b.score - a.score).slice(0, n)
      console.log(`\n## Beispiele ${name} / ${tag} (${einmal.length} Wege, die ${n} mit höchster Wertung)`)
      for (const b of top) console.log(`  ${b.id} ${b.platform} ${b.name} (Wertung ${b.score}) ${b.url}`)
    }
  }
}

async function main() {
  const web = await ladeWebCode()
  const haupt = liesDaten('titles.json')
  const katalog = liesDaten('ohne-synchro.json')
  const cartoons = liesDaten('cartoons.json')
  const releases = liesDaten('releases.json')
  const franchises = liesDaten('franchises.json')
  const releasesJeTitel = new Map()
  for (const r of releases) (releasesJeTitel.get(r.titleId) ?? releasesJeTitel.set(r.titleId, []).get(r.titleId)).push(r)
  const q = MIT_HERKUNFT && existsSync(resolve(WURZEL, 'data/dub-confirmed.yaml')) ? ladeHerkunftsquellen() : undefined
  const gruppen = {
    'Anime Hauptbestand': messeGruppe({ titel: haupt, web, releasesJeTitel, q }),
    'Anime Katalog ohne Synchro': messeGruppe({ titel: katalog, web, releasesJeTitel, q }),
    'Cartoon/TMDB': messeGruppe({ titel: cartoons, web, releasesJeTitel, q }),
  }
  const staffel = staffelKennzahlen(haupt, franchises)
  const ohneDubHinweisCartoons = cartoons.filter((t) => t.dubHinweis).length
  const kennzahlen = {
    hauptTitel: haupt.length,
    hauptMitWeg: gruppen['Anime Hauptbestand'].titelMitWeg,
    katalogTitel: katalog.length,
    katalogMitWeg: gruppen['Anime Katalog ohne Synchro'].titelMitWeg,
    cartoonTitel: cartoons.length,
    cartoonMitWeg: gruppen['Cartoon/TMDB'].titelMitWeg,
    cartoonMitJustWatchHinweis: ohneDubHinweisCartoons,
    cartoonOhneStaffelwissen: cartoons.length,
    ...staffel,
    hauptOhneStreamMitDisc: haupt.filter((t) => !t.streams?.length && t.watchLinks?.length).length,
    hauptOhneJedenWeg: haupt.filter((t) => !t.streams?.length && !t.watchLinks?.length && !releasesJeTitel.has(t.id)).length,
    cartoonOhneStream: cartoons.filter((t) => !t.streams?.length).length,
    releasesTitelOhneStream: [...releasesJeTitel].filter(([id]) => ![...haupt, ...cartoons].find((t) => t.id === id)?.streams?.length).length,
    hauptDubConfidence: haupt.reduce((o, t) => (plus(o, t.dubConfidence), o), {}),
  }
  if (!NUR_JSON) {
    console.log(`Datenqualität Grundlinie — Stand ${web.heute}, Daten: ${DATEN}`)
    console.log(`Titel: Hauptbestand ${haupt.length} (mit Weg ${kennzahlen.hauptMitWeg}), Katalog ${katalog.length} (mit Weg ${kennzahlen.katalogMitWeg}), Cartoons ${cartoons.length} (mit Weg ${kennzahlen.cartoonMitWeg}, davon ${ohneDubHinweisCartoons} mit JustWatch-Hinweis)`)
    console.log(`Hauptbestand ohne Stream: ${kennzahlen.hauptOhneStreamMitDisc} nur mit Kauf-/Disc-Weg, ${kennzahlen.hauptOhneJedenWeg} ohne jeden Weg (auch ohne Termin); Cartoons ohne Stream: ${kennzahlen.cartoonOhneStream}`)
    console.log(`Staffeln: Hauptbestand ${staffel.titelInMehrstaffelFranchise} Titel in Mehrstaffel-Franchise, ${staffel.titelEinzelstaffel} sonst; Cartoons: alle ${cartoons.length} als eine Sammelstaffel (TMDB-Staffelliste wird nicht gespeichert)`)
    for (const [name, g] of Object.entries(gruppen)) {
      const pf = Object.entries(g.jeAnbieter).sort((a, b) => b[1].wege - a[1].wege)
      tabelle(name, [...pf, ['SUMME', g.gesamt]])
      if (q || name === 'Cartoon/TMDB') herkunftsTabelle(name, g.jeAnbieter, g.gesamt)
    }
    const g = gruppen['Anime Hauptbestand'].gesamt
    console.log(`\nHauptbestand: ${prozent(g.haken, g.wege)} der Wege mit Haken; Folgenzahl belegt/abgeleitet an ${prozent(g.belegt + g.plan + g.abgeleitet + g.joyn, g.wege - g.einzelwerk)} der Serien-Wege (ohne Einzelwerke)`)
  }
  if (!NUR_JSON && process.argv.includes('--beispiele')) beispieleAusgeben(gruppen)
  const ausgabe = { datum: web.heute, daten: arg('daten', 'public/data'), kennzahlen, gruppen: Object.fromEntries(Object.entries(gruppen).map(([k, g]) => [k, { titel: g.titel, titelMitWeg: g.titelMitWeg, gesamt: g.gesamt, jeAnbieter: g.jeAnbieter }])) }
  console.log('JSON ' + JSON.stringify(ausgabe))
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(0) })
