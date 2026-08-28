/**
 * Für Titel ohne Verweis nachsehen, ob ADN sie mit deutscher Synchro führt.
 *
 * **Dasselbe Verfahren wie bei Crunchyroll, nur einfacher.** ADNs Suche nennt je
 * Serie ein Feld `languages`, und `vde` heißt dort „version deutsch" — also
 * Synchro, nicht Untertitel (`vostde`). Das ist die klarste Sprachauskunft aller
 * Anbieter in diesem Projekt.
 *
 * **Kein Regionsproblem.** Anders als Crunchyroll leitet ADN die Auswahl nicht
 * aus der IP ab, sondern aus dem Kopf `X-Target-Distribution: de`. Der Lauf kann
 * deshalb in der Cloud laufen.
 *
 * **Was hier nicht passiert.** Es entsteht kein Verweis. Geschrieben wird
 * `data/adn-vorschlaege.json`; was daraus wird, entscheidet der Bau.
 *
 * **Der Ertrag ist heute klein, und das liegt am Katalog.** `data/adn-catalog.json`
 * führt 112 Serien; von 16 Vorschlägen traf einer, und der ohne Synchro. Das
 * Werkzeug bleibt trotzdem: Es kostet keinen Abruf, und der Katalog wächst
 * wöchentlich. Sobald er vollständiger ist, trägt derselbe Lauf mehr.
 *
 * Aufruf: `node tools/adn-vorschlaege-pruefen.mjs [--limit N]`
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || 60

/** Kürzung wie beim Serienabgleich. */
const kurz = (t) => (t ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * **Gesucht wird im eigenen Katalog, nicht über ADNs Suchendpunkt.**
 *
 * `GET /show?search=…` nimmt den Parameter entgegen und ignoriert ihn: Für
 * „Parasyte", „Maid-sama" und „Gushing over Magical Girls" kamen am 28.08.2026
 * dieselben vier Shows zurück (Servamp, Spirou, Billy & Buddy, Dark Gathering).
 * Ein Abgleich darauf hätte jeden Titel einer fremden Serie zugeordnet.
 *
 * `data/adn-catalog.json` wird wöchentlich geholt und liegt im Repo. Dort
 * suchen kostet nichts und trifft.
 */
function katalog(wurzelPfad) {
  const roh = JSON.parse(readFileSync(`${wurzelPfad}/data/adn-catalog.json`, 'utf8'))
  return Array.isArray(roh) ? roh : (roh.shows ?? Object.values(roh))
}
async function main() {
  const vorschlaege = JSON.parse(readFileSync(resolve(wurzel, 'data/anbieter-vorschlaege.json'), 'utf8'))
  const titel = JSON.parse(readFileSync(resolve(wurzel, 'public/data/titles.json'), 'utf8'))
  const arr = Array.isArray(titel) ? titel : (titel.titles ?? Object.values(titel))
  const jeId = new Map(arr.map((t) => [t.id, t]))

  const bestand = (() => {
    try {
      return JSON.parse(readFileSync(resolve(wurzel, 'data/adn-vorschlaege.json'), 'utf8'))
    } catch {
      return {}
    }
  })()

  const offen = vorschlaege
    .filter((v) => v.anbieter?.includes('adn'))
    .filter((v) => !bestand[v.id])
    .slice(0, LIMIT)

  if (!offen.length) {
    console.log('Nichts offen — alle ADN-Vorschläge sind geprüft.')
    return
  }
  const shows = katalog(wurzel)
  console.log(`${offen.length} ADN-Vorschläge, Katalog mit ${shows.length} Serien`)

  let mitSynchro = 0
  let ohneTreffer = 0

  for (const v of offen) {
    const t = jeId.get(v.id)
    const namen = [t?.titleDe, t?.titleEn, t?.titleRomaji].filter(Boolean)
    let treffer = null
    for (const n of namen) {
      /* Titel und Originaltitel — ADN führt beides, und mal trifft das eine. */
      const genau = shows.find((s) => kurz(s.title) === kurz(n) || kurz(s.originalTitle) === kurz(n))
      if (genau) {
        treffer = genau
        break
      }
    }

    if (!treffer) {
      bestand[v.id] = { titel: v.titel, gefunden: false, geprueftAm: new Date().toISOString().slice(0, 10) }
      ohneTreffer++
      continue
    }

    /*
      `vde` ist die deutsche Synchro, `vostde` der deutsche Untertitel. Genau die
      Trennlinie, an der sich dieses Projekt von jedem anderen Kalender scheidet.
    */
    const sprachen = treffer.languages ?? treffer.sprachen ?? []
    const synchro = sprachen.includes('vde')
    if (synchro) mitSynchro++
    bestand[v.id] = {
      titel: v.titel,
      gefunden: true,
      showId: treffer.id,
      adnTitel: treffer.title,
      url: treffer.url ?? null,
      sprachen,
      synchro,
      geprueftAm: new Date().toISOString().slice(0, 10),
    }
  }

  writeFileSync(resolve(wurzel, 'data/adn-vorschlaege.json'), JSON.stringify(bestand, null, 2) + '\n')
  console.log(
    `${offen.length} geprüft: ${mitSynchro} mit deutscher Synchro, ` +
      `${offen.length - mitSynchro - ohneTreffer} gefunden ohne, ${ohneTreffer} nicht gefunden`,
  )
}

await main()
