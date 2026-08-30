/**
 * Den RTL+-Katalog über seine eigenen Sitemaps abgleichen.
 *
 * ## Warum das der richtige Weg ist
 *
 * Daniel am 30.08.2026, mit Bild der Staffel-25-Seite: „hier kann man sich
 * übrigens die 25. staffel (ultimative reisen) komplett auf deutsch angucken …
 * außerdem bietet rtl+ fast alle staffeln von pokemon an. haben wir rtl+
 * verweise dafür bereits?"
 *
 * Hatten wir nicht — und der Bestand war in schlechtem Zustand: 40 Verweise,
 * davon **zehn auf `tvnow.de`**, die Domain vor der Umbenennung zu RTL+.
 *
 * **Die robots.txt lädt ausdrücklich ein** (geprüft 30.08.2026):
 *
 *     User-agent: *
 *     Allow: /
 *     Sitemap: https://plus.rtl.de/programs.sitemap.xml
 *     Sitemap: https://plus.rtl.de/seasons.sitemap.xml
 *     …
 *
 * Keine einzige namentliche Bot-Sperre — der Gegensatz zu Amazon, wo neunzehn
 * stehen (siehe CLAUDE.md). Was ein Betreiber selbst als Sitemap anbietet, ist
 * der ausdrücklich vorgesehene Weg, seinen Bestand zu lesen.
 *
 * ## Was geholt wird
 *
 * `programs.sitemap.xml` ist ein Index über 211 Teilkarten à 1000 Adressen —
 * rund 211.000 Programme, also der ganze Katalog samt Podcasts und Hörbüchern.
 * Geholt werden sie einmal, 400 ms auseinander; verglichen wird über den
 * **Slug**, der den Titel trägt (`pokemon-ultimative-reisen-p_10819`).
 *
 * Gespeichert wird nur, was zu einem unserer Titel passt. Der Rest wird nicht
 * archiviert: Es ist ein fremder Gesamtkatalog, und wir brauchen davon die
 * Schnittmenge, nicht die Kopie.
 *
 * ## Was der Befund wert ist
 *
 * Ein Treffer belegt, **dass** RTL+ den Titel führt — nicht, dass er dort
 * deutsch ist. Auch wenn das bei einem deutschen Sender naheliegt: Dieses
 * Projekt behauptet nichts, was es nicht gemessen hat (CLAUDE.md). Der Verweis
 * bekommt deshalb `dub: undefined` und landet in der Prüfliste.
 *
 * Aufruf: node pipeline/fetch-rtlplus-katalog.mjs [--limit N] [--pause MS]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const zahl = (name, standard) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : standard
}
const LIMIT = zahl('--limit', 0)
const PAUSE = zahl('--pause', 400)

const KENNUNG =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36'

async function hole(url) {
  const antwort = await fetch(url, { headers: { 'User-Agent': KENNUNG } })
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status} für ${url}`)
  return antwort.text()
}

/**
 * Der Slug ohne Kennung und Bindestriche — dieselbe Kürzung wie beim
 * Crunchyroll-Abgleich, damit „Pokémon Ultimative Reisen" und
 * „pokemon-ultimative-reisen-p_10819" zusammenfinden.
 */
const kurz = (t) =>
  (t ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')

const titel = JSON.parse(readFileSync(resolve(wurzel, 'public/data/titles.json'), 'utf8'))
const liste = Array.isArray(titel) ? titel : (titel.titles ?? Object.values(titel))

/*
  Je Kurzform der Titel, der sie trägt. Mehrdeutige Kurzformen fallen heraus —
  ein Treffer, der auf zwei Werke passt, belegt keins von beiden.
*/
const nachKurz = new Map()
const mehrdeutig = new Set()
for (const t of liste) {
  for (const n of [t.titleDe, t.titleEn, t.titleRomaji]) {
    const k = kurz(n)
    if (k.length < 6) continue
    if (nachKurz.has(k) && nachKurz.get(k).id !== t.id) mehrdeutig.add(k)
    else nachKurz.set(k, t)
  }
}
for (const k of mehrdeutig) nachKurz.delete(k)
console.log(`[rtlplus] ${nachKurz.size} eindeutige Titel-Schreibweisen im Bestand`)

const index = await hole('https://plus.rtl.de/programs.sitemap.xml')
const karten = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
const arbeit = LIMIT > 0 ? karten.slice(0, LIMIT) : karten
console.log(`[rtlplus] ${karten.length} Teilkarten, davon ${arbeit.length} in diesem Lauf`)

const ZIEL = resolve(wurzel, 'data/rtlplus-katalog.json')
const bestand = existsSync(ZIEL) ? JSON.parse(readFileSync(ZIEL, 'utf8')) : {}
let neu = 0
let gesehen = 0

for (const [i, karte] of arbeit.entries()) {
  let xml
  try {
    xml = await hole(karte)
  } catch (err) {
    console.log(`[rtlplus] ${i + 1}/${arbeit.length} ? ${err.message}`)
    await new Promise((r) => setTimeout(r, PAUSE))
    continue
  }
  for (const m of xml.matchAll(/<loc>https:\/\/plus\.rtl\.de\/([^<]+)<\/loc>/g)) {
    const pfad = m[1]
    gesehen++
    /*
      Nur Programmseiten: `…-p_<zahl>`. Videos und Ordner tragen andere Kürzel
      und meinen einzelne Folgen — die Serienseite ist der Verweis, den ein
      Besucher braucht.
    */
    const treffer = /^(.+)-p_(\d+)$/.exec(pfad)
    if (!treffer) continue
    const k = kurz(treffer[1])
    const t = nachKurz.get(k)
    if (!t) continue
    const url = `https://plus.rtl.de/${pfad}`
    if (bestand[String(t.id)]?.url === url) continue
    bestand[String(t.id)] = { url, slug: pfad, titel: t.titleDe ?? t.titleEn ?? null, gefundenAm: new Date().toISOString().slice(0, 10) }
    neu++
    console.log(`[rtlplus]   ${t.titleDe ?? t.titleEn} → ${url}`)
  }
  if ((i + 1) % 20 === 0) console.log(`[rtlplus] ${i + 1}/${arbeit.length} Karten, ${neu} Treffer`)
  await new Promise((r) => setTimeout(r, PAUSE))
}

writeFileSync(ZIEL, `${JSON.stringify(bestand, null, 2)}\n`, 'utf8')
console.log(
  `[rtlplus] ${gesehen} Adressen gelesen, ${neu} neue Treffer, ${Object.keys(bestand).length} im Bestand → ${ZIEL}`,
)
