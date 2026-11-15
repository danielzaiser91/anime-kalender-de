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
import { todayIso } from '../shared/time.ts'
import { pruefeGattungen, uebernimmKandidaten } from './lib/rtlplus-gattung.ts'

const wurzel = process.env.AK_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '..')
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
const datei = existsSync(ZIEL) ? JSON.parse(readFileSync(ZIEL, 'utf8')) : {}
// `_verworfen`: Hörbuch-Adressen mit Tag der Feststellung, damit der Wochenlauf sie nicht jedes Mal neu liest.
const { _verworfen: bekannteHoerbuecher = {}, ...bestand } = datei
const kandidaten = new Map()
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
    const liste = kandidaten.get(String(t.id)) ?? []
    if (!liste.some((k) => k.url === url)) liste.push({ url, slug: pfad, titel: t.titleDe ?? t.titleEn ?? null })
    kandidaten.set(String(t.id), liste)
  }
  if ((i + 1) % 20 === 0) console.log(`[rtlplus] ${i + 1}/${arbeit.length} Karten, ${kandidaten.size} Titel mit Treffer`)
  await new Promise((r) => setTimeout(r, PAUSE))
}

/*
  Gleichnamige Hörbücher stehen in derselben Sitemap (Tom Sawyer, Peter Pan …): jeder Treffer wird vor dem
  Eintragen gegen die Beschreibung seiner Seite gelesen, ein Hörbuch überschreibt nie einen Videoeintrag.
  Danach bekommen Altlasten ohne Gattung ihren Stempel. Erkannte Hörbuch-Adressen merkt `_verworfen`; sie werden erst nach 90 Tagen erneut gelesen.
*/
const pause = () => new Promise((r) => setTimeout(r, PAUSE))
const aufnahme = await uebernimmKandidaten(bestand, kandidaten, hole, pause, console.log, todayIso(), bekannteHoerbuecher)
const gattung = await pruefeGattungen(aufnahme.bestand, hole, pause, console.log)
const verworfen = aufnahme.verworfen.length + gattung.verworfen.length
const ohneAuskunft = aufnahme.unklar.length + gattung.unklar.length
const geprueft = aufnahme.neu.length + aufnahme.verworfen.length + aufnahme.unklar.length + gattung.geprueft
console.log(
  `[rtlplus] Gattung: ${geprueft} Seiten geprüft, ${verworfen} Hörbücher/Hörspiele verworfen, ${ohneAuskunft} ohne Auskunft, ${aufnahme.uebersprungen} bekannte Hörbuch-Adressen übersprungen`,
)

writeFileSync(ZIEL, `${JSON.stringify({ ...gattung.bestand, _verworfen: aufnahme.hoerbuecher }, null, 2)}\n`, 'utf8')
console.log(
  `[rtlplus] ${gesehen} Adressen gelesen, ${aufnahme.neu.length} neue Treffer, ${Object.keys(gattung.bestand).length} im Bestand → ${ZIEL}`,
)
