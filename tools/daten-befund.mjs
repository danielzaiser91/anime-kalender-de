// Unabhängige Gegenprobe auf den ausgelieferten Datensatz (public/data). Liest nur, schreibt nichts.
// Fängt, was pipeline/lib/pruefung.ts nicht prüft: doppelte Slugs, doppelte Folgennummern, Datumsreihenfolge,
// Termine ohne Titel, Zahlen in meta.json, Belegklassen der Titel, Ladelast. Aufruf: node tools/daten-befund.mjs
// Endet immer mit Exit 0 (Messlauf); jede Zeile mit ✗ ist ein Befund.
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const D = fileURLToPath(new URL('../public/data/', import.meta.url))
const lies = (f) => JSON.parse(readFileSync(D + f, 'utf8'))
const rel = lies('releases.json'), ev = lies('events.json'), tit = lies('titles.json')
const car = lies('cartoons.json'), news = lies('news.json'), meta = lies('meta.json')
const heute = new Date().toISOString().slice(0, 10)
let befunde = 0
const melde = (ok, text, proben = []) => {
  if (!ok) befunde++
  console.log(`${ok ? '✓' : '✗'} ${text}`)
  for (const p of proben.slice(0, 5)) console.log('    ', typeof p === 'string' ? p : JSON.stringify(p))
}
const nachSlug = new Map()
for (const e of ev) (nachSlug.get(e.releaseSlug) ?? nachSlug.set(e.releaseSlug, []).get(e.releaseSlug)).push(e)
const titelIds = new Set([...tit, ...car].map((t) => t.id))

// 1. Kennungen
const slugZahl = {}
for (const r of rel) slugZahl[r.slug] = (slugZahl[r.slug] ?? 0) + 1
const doppelt = Object.entries(slugZahl).filter(([, n]) => n > 1)
melde(!doppelt.length, `Release-Slugs eindeutig (${doppelt.length} doppelt)`, doppelt)
const ohneTitel = rel.filter((r) => !titelIds.has(r.titleId))
melde(!ohneTitel.length, `jedes Release hat einen Titel (${ohneTitel.length} ohne)`, ohneTitel.map((r) => [r.slug, r.titleId]))

// 2. Folgennummern und Datumsreihenfolge je Release
const dopp = [], rueck = []
for (const [slug, es] of nachSlug) {
  const r = rel.find((x) => x.slug === slug)
  if (!r || r.releaseType === 'disc') continue
  const nr = {}
  for (const e of es) if (e.episode != null) nr[e.episode] = (nr[e.episode] ?? 0) + 1
  const d = Object.entries(nr).filter(([, n]) => n > 1)
  if (d.length) dopp.push([slug, d.map((x) => x.join('×')).join(',')])
  const s = es.filter((e) => e.episode != null).sort((a, b) => a.episode - b.episode || a.date.localeCompare(b.date))
  for (let i = 1; i < s.length; i++)
    if (s[i].episode !== s[i - 1].episode && s[i].date < s[i - 1].date) { rueck.push([slug, `Folge ${s[i - 1].episode}@${s[i - 1].date} > Folge ${s[i].episode}@${s[i].date}`]); break }
}
melde(!dopp.length, `keine Folgennummer doppelt im Release (${dopp.length} Releases)`, dopp)
melde(!rueck.length, `spätere Folge nie vor früherer (${rueck.length} Releases)`, rueck)

// 3. Zahlen, die die Seite nennt
melde(meta.releaseCount === rel.length, `meta.releaseCount ${meta.releaseCount} = releases.json ${rel.length}`)
melde(meta.eventCount === ev.length, `meta.eventCount ${meta.eventCount} = events.json ${ev.length}`)

// 4. Belegklassen: was steht hinter „belegter deutscher Synchro" (Fußzeile: titleCount)?
const mitTermin = new Set(rel.filter((r) => r.platform !== 'disc').map((r) => r.titleId))
const mitDisc = new Set(rel.filter((r) => r.platform === 'disc').map((r) => r.titleId))
const ohneBeleg = tit.filter((t) => !t.streams.some((s) => s.dub === true) && !mitTermin.has(t.id) && !mitDisc.has(t.id) &&
  !t.deErstausgabe && !(t.watchLinks?.length) && !t.ankuendigung)
melde(!ohneBeleg.length, `Titel ohne jeden Beleg, gezählt als „belegt“: ${ohneBeleg.length} von ${tit.length}`,
  ohneBeleg.map((t) => `${t.id} ${t.titleDe ?? t.titleRomaji} (${t.dubConfidence})`))
const eng = tit.filter((t) => !t.streams.some((s) => s.dub === true) && !mitTermin.has(t.id) && !mitDisc.has(t.id) && !t.deErstausgabe?.synchro)
melde(false, `ohne Stream, Termin, Disc-Termin und aniSearch-Marke „Synchronisiert“: ${eng.length} von ${tit.length}; dubConfidence=low insgesamt ${tit.filter((t) => t.dubConfidence === 'low').length}; Cartoons ${car.length} (alle low)`)

// 5. Cartoons mit unmöglichem Jahr
const zuspaet = car.filter((c) => c.jpYear > +heute.slice(0, 4) + 1)
melde(!zuspaet.length, `Cartoons ohne Zukunftsjahr > +1 (${zuspaet.length})`, zuspaet.map((c) => [c.titleEn, c.jpYear, c.land]))

// 6. Disc: Kaufen-Knopf zeigt auf eine Suche
const disc = rel.filter((r) => r.releaseType === 'disc')
const suche = disc.filter((r) => /amazon\.[a-z.]+\/s\?/.test(r.buyUrl ?? ''))
melde(!suche.length, `Disc-Kaufadressen sind keine Suchseiten (${suche.length} von ${disc.length})`)

// 7. News gegen Release
const abw = []
for (const n of news) for (const m of n.meldungen) {
  const r = m.release && rel.find((x) => x.slug === m.release)
  if (r && m.datum && ['angekuendigt', 'disc', 'kino'].includes(m.art) && r.schedule.firstEpisodeDate !== m.datum) abw.push([n.titel, m.art, m.datum, r.schedule.firstEpisodeDate])
}
melde(!abw.length, `News-Datum = Release-Datum (${abw.length} Abweichungen)`, abw)

// 8. Ladelast des Erstaufrufs (nur Daten; Bündel und Schriften kommen dazu)
const gz = (f) => gzipSync(readFileSync(D + f)).length
const start = ['meta.json', 'titles-core.json', 'releases.json', 'events.json'].reduce((s, f) => s + gz(f), 0)
console.log(`  Startdaten gzip: ${(start / 1024).toFixed(0)} KB (ARCHITEKTUR.md: 300 KB gesamt als Umbauschwelle)`)
const vergangen = ev.filter((e) => e.date < heute).length
melde(vergangen / ev.length < 0.5, `Anteil vergangener Termine in events.json: ${(100 * vergangen / ev.length).toFixed(0)} % (${vergangen} von ${ev.length})`)
console.log(`\n${befunde} Befund(e).`)
