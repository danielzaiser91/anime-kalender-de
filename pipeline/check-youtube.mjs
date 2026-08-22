/**
 * Die YouTube-Verweise prüfen, ohne YouTube zu scrapen.
 *
 * ## Warum oEmbed
 *
 * YouTube betreibt unter `/oembed` eine dokumentierte, öffentliche
 * Schnittstelle: Sie nimmt eine Videoadresse und gibt Titel, Kanal und
 * Vorschaubild zurück. Kein Schlüssel, kein Kontingent, und `robots.txt`
 * sperrt sie nicht — geprüft am 22.08.2026, gesperrt sind dort nur
 * `/watch_ajax` und Verwandte.
 *
 * Damit lassen sich zwei Fragen beantworten, für die bisher niemand Zeit hatte:
 *
 * - **Lebt der Verweis noch?** Ein gelöschtes oder gesperrtes Video antwortet
 *   mit 404 oder 401. 93 Verweise stehen im Datensatz, jeder davon eine Kachel,
 *   die einen Besucher ins Leere schicken kann.
 * - **Welche Fassung ist es?** Der Titel verrät sie oft: „Pokémon – Der Film"
 *   ist die deutsche, „Akira" sagt nichts. Das ist ein **Hinweis**, kein Beleg —
 *   ein deutscher Titel kann über einem Video mit Originalton stehen. Er landet
 *   deshalb in einer Vorschlagsliste, nicht im Datensatz.
 *
 * ## Was hier nicht passiert
 *
 * Es wird nichts gerendert und keine Seite gelesen. Wer mehr will — etwa die
 * Tonspuren eines Videos —, braucht die Data API mit Schlüssel und Kontingent;
 * das ist eine eigene Entscheidung und keine Nebensache dieses Skripts.
 *
 * Aufruf: node pipeline/check-youtube.mjs [--limit N] [--pause MS]
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
const PAUSE = zahl('--pause', 350)

const titel = JSON.parse(readFileSync(resolve(wurzel, 'public/data/titles.json'), 'utf8'))
const liste = Array.isArray(titel) ? titel : (titel.titles ?? Object.values(titel))

/** Alle YouTube-Verweise, deren Sprachfassung offen ist. */
const offen = []
for (const t of liste) {
  for (const s of t.streams ?? []) {
    if (s.platform !== 'youtube' || s.dub !== undefined) continue
    offen.push({ id: t.id, titel: t.titleDe ?? t.titleEn ?? t.titleRomaji ?? String(t.id), url: s.url })
  }
}

const ZIEL = resolve(wurzel, 'data/youtube-befunde.json')
const bestand = existsSync(ZIEL) ? JSON.parse(readFileSync(ZIEL, 'utf8')) : {}

/**
 * Ein deutscher Titel ist ein Hinweis, kein Beleg.
 *
 * Gesucht wird nach Wörtern, die es nur im Deutschen gibt — „der", „das" und
 * „ein" stehen auch in anderen Sprachen, „Der Film" und „Ganzer Film" nicht.
 */
const DEUTSCHE_SPUR =
  /\b(der Film|ganzer Film|deutsch|german dub|auf Deutsch|Synchronfassung|Staffel|Folge)\b/i

let gelesen = 0
let tot = 0
let kasse = 0
let deutsch = 0
const arbeit = LIMIT > 0 ? offen.slice(0, LIMIT) : offen

for (const [i, v] of arbeit.entries()) {
  const adresse = `https://www.youtube.com/oembed?url=${encodeURIComponent(v.url)}&format=json`
  let befund
  try {
    const antwort = await fetch(adresse)
    /**
     * 404 heißt gelöscht. 401 heißt **kostenpflichtig** — das ist etwas anderes.
     *
     * Am 22.08.2026 antworteten neun Verweise mit 401: „Your Name", „Tokyo
     * Godfathers", „FF7 Advent Children", fünf Pokémon-Filme. Keiner davon ist
     * weg; sie liegen bei YouTube Movies zum Kaufen oder Leihen, und oEmbed
     * verweigert dort die Auskunft. Sie als tot zu entfernen hätte neun gültige
     * Kaufwege gelöscht.
     *
     * Für diese Seite ist das trotzdem eine Auskunft: Ein Verweis, hinter dem
     * eine Kasse steht, ist kein Stream. Wohin er gehört, entscheidet ein
     * Mensch — hier wird er nur unterschieden.
     */
    if (antwort.status === 404) {
      befund = { status: 404, lebt: false }
      tot++
    } else if (antwort.status === 401 || antwort.status === 403) {
      befund = { status: antwort.status, lebt: true, kostenpflichtig: true }
      kasse++
    } else if (!antwort.ok) {
      // Ein anderer Fehler ist keine Auskunft — beim nächsten Lauf noch einmal.
      console.log(`  ${i + 1}/${arbeit.length} ? ${v.titel.slice(0, 34)} — HTTP ${antwort.status}`)
      continue
    } else {
      const daten = await antwort.json()
      befund = {
        status: 200,
        lebt: true,
        videoTitel: daten.title ?? null,
        kanal: daten.author_name ?? null,
        deutscherTitel: DEUTSCHE_SPUR.test(daten.title ?? ''),
      }
      if (befund.deutscherTitel) deutsch++
    }
  } catch (err) {
    console.log(`  ${i + 1}/${arbeit.length} ? ${v.titel.slice(0, 34)} — ${err.message}`)
    continue
  }
  bestand[v.url] = { ...befund, anilistId: v.id, geprueftAm: new Date().toISOString().slice(0, 10) }
  gelesen++
  const zeichen = !befund.lebt ? '✕' : befund.kostenpflichtig ? '€' : befund.deutscherTitel ? '🇩🇪' : '·'
  console.log(`  ${i + 1}/${arbeit.length} ${zeichen} ${v.titel.slice(0, 40)}`)
  await new Promise((r) => setTimeout(r, PAUSE))
}

writeFileSync(ZIEL, JSON.stringify(bestand, null, 1) + '\n')
console.log('')
console.log(
  `${gelesen} Verweise geprüft: ${tot} gelöscht, ${kasse} kostenpflichtig, ${deutsch} mit deutschem Videotitel`,
)
console.log(`Befunde in data/youtube-befunde.json`)
