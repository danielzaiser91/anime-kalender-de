/**
 * Die Liste der Amazon-Adressen, bei denen eine Prüfung noch etwas bringt.
 *
 * ## Warum Amazon anders liegt als Netflix
 *
 * Bei Netflix muss Daniel **jede Folge einzeln** anspielen, damit der Player
 * seine Tonspuren preisgibt. Amazon nennt sie **im ausgelieferten HTML** — je
 * Folge ein `audioTracks`-Feld, dazu je Staffel ein `benefitId`, das sagt,
 * welches Abo nötig ist (gemessen am 23.08.2026 an „Naruto Shippuden").
 *
 * Ein Seitenaufruf trägt damit eine ganze Staffel statt einer Folge. Deshalb
 * braucht diese Liste auch keine Folgenempfehlungen wie die Netflix-Fassung —
 * es genügt, die Seite zu öffnen.
 *
 * ## Warum die Erweiterung und kein Abruf
 *
 * `amazon.de/robots.txt` wäre kein Hindernis, aber die Nutzungsbedingungen
 * untersagen „Data Mining, Robots oder ähnliche Datensammel- und
 * Extraktionsprogramme" ausdrücklich (Abschnitt 5, „Lizenz und Zugang").
 * Ein Mensch, der eine Seite ansieht, nutzt die Lizenz bestimmungsgemäß —
 * ein Abrufer nicht. Die vollständige Bewertung steht in `status.md`.
 *
 * Aufruf: node tools/extension-offene-amazon.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const roh = JSON.parse(readFileSync(resolve(wurzel, 'public/data/titles.json'), 'utf8'))
const titel = Array.isArray(roh) ? roh : (roh.titles ?? Object.values(roh))

/**
 * Die Kennung aus einer Amazon-Adresse.
 *
 * Beide Formen kommen im Bestand vor: `/dp/B0CQ4VL364` und
 * `/gp/video/detail/B0DDJ1CH7R`. Suchadressen (`/s?k=…`) tragen keine und
 * fallen damit heraus — dort gibt es nichts zu öffnen.
 */
function kennung(url) {
  return /\/(?:dp|detail)\/([A-Z0-9]{10})/.exec(url)?.[1]
}

/** Alle unsere Einträge je Amazon-Kennung — auch die schon beantworteten. */
const jeAsin = new Map()
for (const t of titel) {
  for (const s of t.streams ?? []) {
    if (s.platform !== 'primevideo') continue
    const asin = kennung(s.url)
    if (!asin) continue
    jeAsin.set(asin, [...(jeAsin.get(asin) ?? []), { t, dub: s.dub, url: s.url }])
  }
}

const JAHRESZEIT = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 }
const offen = {}
for (const [asin, eintraege] of jeAsin) {
  // Ist unter dieser Adresse schon alles beantwortet, gibt es nichts zu tun.
  if (eintraege.every((e) => e.dub !== undefined)) continue
  const sortiert = eintraege
    .slice()
    .sort((a, b) => (a.t.jpYear ?? 0) - (b.t.jpYear ?? 0) || (JAHRESZEIT[a.t.jpSeason] ?? 0) - (JAHRESZEIT[b.t.jpSeason] ?? 0))
  offen[asin] = {
    titel: sortiert[0].t.titleRomaji ?? sortiert[0].t.titleEn ?? '?',
    url: sortiert[0].url,
    eintraege: sortiert.map((e) => ({
      id: e.t.id,
      name: e.t.titleRomaji ?? e.t.titleEn ?? '?',
      folgen: e.t.episodes ?? null,
      offen: e.dub === undefined,
    })),
  }
}

writeFileSync(
  resolve(wurzel, 'extension/offene-amazon.js'),
  'globalThis.AK_OFFENE_AMAZON = ' + JSON.stringify(offen) + '\n',
)
const eintraege = Object.values(offen).reduce((n, o) => n + o.eintraege.filter((e) => e.offen).length, 0)
console.log(`${Object.keys(offen).length} Amazon-Adressen mit ${eintraege} offenen Einträgen`)
