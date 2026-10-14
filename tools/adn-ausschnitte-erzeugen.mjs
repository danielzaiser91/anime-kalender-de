/**
 * Erzeugt `extension/adn-ausschnitte.fixture.json`: die gekürzten Testdaten der ADN-Erweiterung.
 *
 * Zwei Quellen, beide ohne persönliche Daten:
 * - `videos`: je Fall die ersten Videos jeder Staffel aus dem Archiv der Pipeline (`data/adn-raw/<id>.json.gz`,
 *   dieselbe Schnittstelle, die die Erweiterung liest), nur die Felder, die `adn-leser.js` braucht.
 * - `seite`: aus den gespeicherten ADN-Seiten (Daniel, 13.10.2026) nur die Liste der `data-testid` aus `<main>`,
 *   beschränkt auf eine feste Positivliste, dazu Überschrift und der Hinweis „Kein Video verfügbar".
 *   Konto, Profil, Name und Tokens stehen im Kopf der Seite außerhalb von `<main>` und in `__NEXT_DATA__`;
 *   beides wird nie gelesen.
 *
 * Aufruf: node tools/adn-ausschnitte-erzeugen.mjs "<Ordner mit den gespeicherten Seiten>"
 * Die Beziehung zum Archiv rechnet `extension/adn.test.cjs` bei jedem Lauf nach.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'

const ordner = process.argv[2]
if (!ordner) throw new Error('Ordner mit den gespeicherten ADN-Seiten fehlt')

const FAELLE = [
  { name: 'film-synchro', show: 1140, datei: 'example - film page - dub' },
  { name: 'film-ohne-video', show: null, datei: 'example - film page - no video', seite: 'THE LEGEND OF HEI II' },
  { name: 'film-untertitel-3', show: 1225, datei: 'example - film page - sub - 3 filme' },
  { name: 'serie-synchro-s1', show: 1375, datei: 'example - serien page - dub - abgeschlossen - 2 staffeln', seite: 'Dorohedoro - Staffel 1' },
  { name: 'serie-synchro-s2', show: 1375, datei: 'example - serien page - dub - abgeschlossen - 2 staffeln', seite: 'Dorohedoro - Staffel 2' },
  { name: 'serie-untertitel', show: 1369, datei: 'example - serien page - sub' },
  { name: 'serie-woechentlich', show: 1433, datei: 'example - serien page - sub - weekly release - 2 folgen' },
]

const ERLAUBT = /^(text-(SYNCHRO|UNTERTITEL|HD|SD|count|NEUE FOLGE)|show-tab|show-videos|show-video-item|season-\d+(-selected)?|button-resume)$/
const JE_STAFFEL = 2

function videosAusArchiv(id) {
  const archiv = JSON.parse(gunzipSync(readFileSync(`data/adn-raw/${id}.json.gz`)))
  const gesehen = new Map()
  const aus = []
  for (const v of [...archiv.videos].sort((a, b) => a.order - b.order)) {
    const n = gesehen.get(v.season) ?? 0
    if (n >= JE_STAFFEL) continue
    gesehen.set(v.season, n + 1)
    aus.push({
      id: v.id,
      title: v.title,
      name: v.name,
      number: v.number,
      shortNumber: v.shortNumber,
      season: v.season,
      reference: v.reference,
      type: v.type,
      languages: v.languages,
      releaseDate: v.releaseDate,
      duration: v.duration,
      show: { id: v.show.id, title: v.show.title },
    })
  }
  return aus
}

function seiteAus(pfad) {
  const html = readFileSync(pfad, 'utf8')
  const haupt = html.slice(html.indexOf('<main'), html.indexOf('</main>'))
  const alle = [...haupt.matchAll(/data-testid="([^"]*)"/g)].map((m) => m[1])
  return {
    h1: /<h1[^>]*>([^<]*)</.exec(haupt)?.[1]?.trim() ?? null,
    testids: alle.filter((t) => ERLAUBT.test(t)),
    keinVideo: haupt.includes('Kein Video verfügbar'),
    zaehler: /data-testid="text-count">([^<]*)</.exec(haupt)?.[1] ?? null,
  }
}

function seitenDatei(dir, teil) {
  const treffer = readdirSync(dir).filter((f) => f.endsWith('.html') && (!teil || f.startsWith(teil)))
  if (treffer.length !== 1) throw new Error(`${dir}: ${treffer.length} Treffer für ${teil ?? 'die Seite'}`)
  return join(dir, treffer[0])
}

const ausgabe = {}
for (const fall of FAELLE) {
  const pfad = seitenDatei(join(ordner, fall.datei), fall.seite)
  ausgabe[fall.name] = { show: fall.show, seite: seiteAus(pfad), videos: fall.show ? videosAusArchiv(fall.show) : [] }
}
writeFileSync('extension/adn-ausschnitte.fixture.json', JSON.stringify(ausgabe, null, 1) + '\n')
console.log(`${Object.keys(ausgabe).length} Fälle geschrieben`)
