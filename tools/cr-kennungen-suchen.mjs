/**
 * Sucht zu unseren Crunchyroll-Verweisen die **richtige Serienkennung im
 * deutschen Katalog** — und legt sie ab, damit der Cloud-Lauf sie nur noch liest.
 *
 * ## Warum es das braucht
 *
 * Bis zum 25.08.2026 leitete der Bau die Serienkennung aus der **Adresse** ab.
 * Das geht schief, sobald die Adresse auf einen anderssprachigen Eintrag zeigt:
 * „Detektiv Conan" stand bei uns als `crunchyroll.com/de/case-closed`, das ist
 * `G6JQVM3ER` — ein Block mit 33 Folgen und `ja-JP`. Die deutsche Serie liegt
 * unter `GW4HM7NV3` und führt 405 deutsche Folgen in neun Blöcken.
 *
 * Gemessen am selben Tag: Von 462 Verweisen ohne Sprachangabe tragen 370 eine
 * Kennung, **313 davon finden damit keine einzige Staffel**. Weitere 92 haben
 * gar keine.
 *
 * ## Warum hier und nicht in der Cloud
 *
 * Crunchyroll leitet die Region aus der **IP** ab. Ein Lauf auf GitHubs
 * Rechnern bekommt den US-Katalog, und dort fehlt genau das, worum es geht.
 * Das Bearer-Token trägt die Region sogar sichtbar mit (`country`).
 *
 * Die Zuordnung Titel → Kennung ändert sich selten. Sie entsteht deshalb hier,
 * wird committet, und der Cloud-Lauf liest sie nur noch.
 *
 * ## Aufruf
 *
 *   node tools/cr-kennungen-suchen.mjs [--limit 50] [--alle] [--trocken]
 *
 * Ohne `--alle` werden nur Verweise gesucht, die heute keine brauchbare Kennung
 * haben. `--trocken` schreibt nichts.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const ZIEL = 'data/crunchyroll-de-kennungen.json'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
/** Öffentliche Client-Kennung der Web-Anwendung — dieselbe, die der Browser nutzt. */
const CLIENT = 'noaihdevm_6iyg0a8l0q'

const args = process.argv.slice(2)
const zahl = (name, vorgabe) => {
  const i = args.indexOf(name)
  return i >= 0 ? Number(args[i + 1]) : vorgabe
}
const LIMIT = zahl('--limit', 0)
const ALLE = args.includes('--alle')
const TROCKEN = args.includes('--trocken')

const warte = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Ein anonymes Bearer-Token — ohne Browser, ohne Anmeldung.
 *
 * Gemessen am 25.08.2026: Der Aufruf gegen `beta-api` antwortet mit HTTP 200
 * und einem Token, das 3600 Sekunden gilt; die Antwort nennt auch das Land.
 * Derselbe Aufruf gegen `www.crunchyroll.com` läuft in Cloudflares Sperre.
 */
async function token() {
  const r = await fetch('https://beta-api.crunchyroll.com/auth/v1/token', {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${CLIENT}:`).toString('base64'),
    },
    body: 'grant_type=client_id',
  })
  if (!r.ok) throw new Error(`Token: HTTP ${r.status}`)
  const j = await r.json()
  return { wert: j.access_token, land: j.country }
}

/** Wörter, die für den Vergleich nichts hergeben. */
const FUELLWOERTER = new Set(['the', 'a', 'an', 'no', 'to', 'of', 'und', 'der', 'die', 'das'])

function woerter(s) {
  return (s ?? '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !FUELLWOERTER.has(w))
}

/**
 * Wie gut passt ein Suchtreffer zu unserem Titel?
 *
 * Geteilte Wörter zählen doppelt, fremde einfach dagegen — dieselbe Logik wie
 * `bewerteTreffer` in der ADN-Zuordnung, und aus demselben Grund: Der erste
 * Treffer ist selten der beste. „Detektiv Conan" liefert 21 Serien, darunter
 * „Star Detective Precure!" und „Woodpecker Detective's Office".
 */
function bewerte(unser, ihrer) {
  const a = new Set(woerter(unser))
  const b = woerter(ihrer)
  if (!a.size || !b.length) return -Infinity
  let geteilt = 0
  let fremd = 0
  for (const w of b) (a.has(w) ? geteilt++ : fremd++)
  const fehlend = [...a].filter((w) => !b.includes(w)).length
  return geteilt * 2 - fremd - fehlend
}

async function suche(kopf, frage) {
  const url =
    'https://beta-api.crunchyroll.com/content/v2/discover/search' +
    `?q=${encodeURIComponent(frage)}&n=12&type=series&locale=de-DE`
  const r = await fetch(url, { headers: kopf })
  if (!r.ok) return { fehler: r.status, treffer: [] }
  const j = await r.json()
  const gruppe = (j.data ?? []).find((g) => g.type === 'series') ?? (j.data ?? [])[0]
  return {
    treffer: (gruppe?.items ?? []).map((i) => ({
      id: i.id,
      titel: i.title,
      folgen: i.series_metadata?.episode_count ?? null,
      staffeln: i.series_metadata?.season_count ?? null,
      sprachen: i.series_metadata?.audio_locales ?? [],
    })),
  }
}

async function main() {
  const roh = JSON.parse(readFileSync('public/data/titles.json', 'utf8'))
  const titel = Array.isArray(roh) ? roh : (roh.titles ?? Object.values(roh))
  const befund = JSON.parse(readFileSync('data/crunchyroll-dub.json', 'utf8'))
  const jeAdresse = new Map((befund.serien ?? []).map((s) => [s.url, s]))
  const bestand = existsSync(ZIEL) ? JSON.parse(readFileSync(ZIEL, 'utf8')) : { kennungen: {} }

  /** Wen suchen wir? Alles ohne brauchbare Kennung — oder alles, mit `--alle`. */
  const offen = []
  for (const t of titel) {
    for (const s of t.streams ?? []) {
      if (s.platform !== 'crunchyroll') continue
      if (!ALLE && s.dub !== undefined) continue
      const b = jeAdresse.get(s.url)
      const brauchbar = Boolean(b?.seriesId && (b.staffeln ?? []).length)
      if (!ALLE && brauchbar) continue
      if (bestand.kennungen[t.id] && !ALLE) continue
      offen.push({ id: t.id, titel: t.titleDe ?? t.titleEn ?? t.titleRomaji ?? `#${t.id}`, url: s.url })
    }
  }
  const arbeit = LIMIT > 0 ? offen.slice(0, LIMIT) : offen
  console.log(`${offen.length} Verweise ohne brauchbare Kennung, ${arbeit.length} in diesem Lauf.`)
  if (!arbeit.length) return

  const t = await token()
  console.log(`Token für ${t.land}${t.land === 'DE' ? '' : '  ⚠ NICHT Deutschland — Abbruch'}`)
  if (t.land !== 'DE') return
  const kopf = { 'User-Agent': UA, Authorization: `Bearer ${t.wert}` }

  let gefunden = 0
  let mitDeutsch = 0
  let ohne = 0
  for (const [i, o] of arbeit.entries()) {
    const { treffer, fehler } = await suche(kopf, o.titel)
    await warte(350)
    if (fehler) {
      console.log(`  ✗ HTTP ${fehler} bei „${o.titel}"`)
      continue
    }
    const bewertet = treffer
      .map((x) => ({ ...x, punkte: bewerte(o.titel, x.titel) }))
      .sort((a, b) => b.punkte - a.punkte)
    const beste = bewertet[0]
    /*
      Ein schwacher Treffer ist schlimmer als keiner: Er bindet unseren Titel an
      eine fremde Serie, und der Folgen-Lauf urteilt danach über die falsche.
      Die Schwelle verlangt, dass mindestens die Hälfte unserer Wörter vorkommt.
    */
    if (!beste || beste.punkte < 1) {
      ohne++
      continue
    }
    bestand.kennungen[o.id] = {
      seriesId: beste.id,
      crTitel: beste.titel,
      sprachen: beste.sprachen,
      folgen: beste.folgen,
      staffeln: beste.staffeln,
      punkte: beste.punkte,
      unserTitel: o.titel,
      /* Die Adresse gehört dazu — über sie liest der Abruf die Kennung. */
      url: o.url,
      gesuchtAm: new Date().toISOString().slice(0, 10),
    }
    gefunden++
    if (beste.sprachen?.includes('de-DE')) mitDeutsch++
    if ((i + 1) % 25 === 0) console.log(`  … ${i + 1}/${arbeit.length}`)
  }

  console.log(`\n${gefunden} Kennungen gefunden, davon ${mitDeutsch} mit de-DE.`)
  console.log(`${ohne} ohne ausreichend guten Treffer — die bleiben offen.`)
  if (TROCKEN) return console.log('(trocken — nichts geschrieben)')
  bestand.gesuchtAm = new Date().toISOString()
  bestand.hinweis =
    'Serienkennungen aus dem deutschen Crunchyroll-Katalog. Entsteht nur auf einem Rechner ' +
    'in Deutschland (die Region hängt an der IP); der Cloud-Lauf liest die Datei nur.'
  writeFileSync(ZIEL, JSON.stringify(bestand, null, 1) + '\n')
  console.log(`→ ${ZIEL}`)
}

await main()
