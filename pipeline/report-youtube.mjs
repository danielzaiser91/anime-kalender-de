/**
 * Was die YouTube-Prüfung gefunden hat, für einen Menschen aufbereitet.
 *
 * Die Prüfung selbst (`check-youtube.mjs`) trägt nur ein, was der Videotitel
 * ausdrücklich sagt. Alles andere braucht ein Auge — und einen kurzen Blick ins
 * Video, den kein Skript ersetzt.
 *
 * Aufruf: node pipeline/report-youtube.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ANDERE_FASSUNG } from './lib/titel-muster.mjs'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const quelle = resolve(wurzel, 'data/youtube-befunde.json')
if (!existsSync(quelle)) {
  console.error('Erst `node pipeline/check-youtube.mjs` laufen lassen.')
  process.exit(1)
}
const befunde = JSON.parse(readFileSync(quelle, 'utf8'))
const titel = JSON.parse(readFileSync(resolve(wurzel, 'public/data/titles.json'), 'utf8'))
const liste = Array.isArray(titel) ? titel : (titel.titles ?? Object.values(titel))
const name = (id) => {
  const t = liste.find((x) => x.id === id)
  return t?.titleDe ?? t?.titleEn ?? t?.titleRomaji ?? `#${id}`
}

/**
 * Ein senkrechter Strich im Text zerbricht die Tabellenzeile.
 *
 * YouTube-Titel tragen ihn oft als Trenner: „Full Movie | Attack on Titan
 * Part 1 - (English Dub)" wurde dadurch zu zwei Spalten, und die Zeile
 * rutschte um eine Stelle — der Verweis stand unter „Kanal".
 */
const zelle = (text) => String(text ?? '—').replaceAll('|', '\\|')

const andereFassung = []
const kostenpflichtig = []
const deutscherTitel = []
const offen = []
for (const [url, v] of Object.entries(befunde)) {
  // Was schon im Datensatz steht, braucht hier nicht zu stehen.
  const t = liste.find((x) => x.id === v.anilistId)
  const s = (t?.streams ?? []).find((x) => x.url === url)
  if (s?.dub !== undefined) continue
  // Zuerst die Fassung, dann der Preis: „OmU" beantwortet die Frage, um die
  // es in diesem Projekt geht, und beantwortet sie in einem Wort.
  //
  // Geprüft wird hier der Titel selbst, nicht nur das Feld aus dem Befund:
  // Ein Eintrag von vor dem 24.08.2026 kennt das Feld nicht, sein Titel sagt
  // aber dasselbe. Sonst müsste erst ein voller Lauf über alle Adressen
  // laufen, bevor die Liste stimmt.
  if (v.andereFassung || ANDERE_FASSUNG.test(v.videoTitel ?? '')) andereFassung.push([url, v])
  else if (v.kostenpflichtig) kostenpflichtig.push([url, v])
  else if (v.deutscherTitel) deutscherTitel.push([url, v])
  else offen.push([url, v])
}

const zeilen = [
  '# YouTube: was die Prüfung gefunden hat',
  '',
  `Stand: ${new Date().toISOString().slice(0, 10)} · geprüft über YouTubes oEmbed-Schnittstelle`,
  '(Titel und Kanal je Video, ohne Schlüssel und ohne Kontingent).',
  '',
  'Eingetragen wurde nur, wo der **Videotitel die Sprache benennt**. Was hier steht,',
  'braucht einen Blick ins Video — den ersetzt keine Schnittstelle.',
  '',
  '## Der Videotitel nennt eine andere Fassung als Deutsch',
  '',
  'Hier steht es im Klartext: „OmU" heißt Original mit Untertiteln, „(English Dub)"',
  'eine Synchro, nur nicht unsere. Beides beantwortet dieselbe Frage.',
  'Ein Blick zur Bestätigung, dann ist es ein `0` in der Kurzschrift.',
  '',
  '| Unser Titel | Videotitel | Verweis |',
  '|---|---|---|',
  ...andereFassung.map(([u, v]) => `| ${zelle(name(v.anilistId))} | ${zelle(v.videoTitel)} | [öffnen](${u}) |`),
  '',
  '## Deutscher Verleihtitel, Sprache nicht genannt',
  '',
  'Der Titel ist deutsch, über die Tonspur sagt er nichts. Meist stimmt es trotzdem —',
  'aber „meist" ist kein Beleg.',
  '',
  '| Unser Titel | Videotitel | Kanal | Verweis |',
  '|---|---|---|---|',
  ...deutscherTitel.map(([u, v]) => `| ${zelle(name(v.anilistId))} | ${zelle(v.videoTitel)} | ${zelle(v.kanal)} | [öffnen](${u}) |`),
  '',
  '## Hinter einer Kasse',
  '',
  'Diese Videos gibt es dort nur zum Kaufen oder Leihen — belegt über die `offerId`',
  'auf der Videoseite. Ein HTTP 401 bei oEmbed allein reicht dafür nicht: Er hat auch',
  'andere Ursachen, und drei der neun Fälle vom 24.08.2026 waren keine Kauffilme.',
  'Ein Verweis mit Kasse ist kein Stream — ob er in die Kaufwege gehört oder ganz',
  'verschwindet, ist eine Entscheidung, keine Messung.',
  '',
  '| Unser Titel | Verweis |',
  '|---|---|',
  ...kostenpflichtig.map(([u, v]) => `| ${zelle(name(v.anilistId))} | [öffnen](${u}) |`),
  '',
  '## Ohne Hinweis auf die Sprache',
  '',
  `${offen.length} Verweise, deren Videotitel nichts verrät. Für die hilft nur Hinsehen —`,
  'oder die Data API mit Schlüssel, die auch die Tonspuren nennt.',
  '',
  '| Unser Titel | Videotitel | Kanal | Verweis |',
  '|---|---|---|---|',
  ...offen.map(([u, v]) => `| ${zelle(name(v.anilistId))} | ${zelle(v.videoTitel)} | ${zelle(v.kanal)} | [öffnen](${u}) |`),
  '',
]
writeFileSync(resolve(wurzel, 'daniel-zum-abarbeiten/09-youtube-liste.md'), zeilen.join('\n'))
console.log(
  `daniel-zum-abarbeiten/09-youtube-liste.md: ${andereFassung.length} mit fremder Fassung im Titel, ` +
    `${deutscherTitel.length} mit deutschem Titel, ` +
    `${kostenpflichtig.length} kostenpflichtig, ${offen.length} ohne Hinweis`,
)
