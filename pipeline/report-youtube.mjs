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

const kostenpflichtig = []
const deutscherTitel = []
const offen = []
for (const [url, v] of Object.entries(befunde)) {
  // Was schon im Datensatz steht, braucht hier nicht zu stehen.
  const t = liste.find((x) => x.id === v.anilistId)
  const s = (t?.streams ?? []).find((x) => x.url === url)
  if (s?.dub !== undefined) continue
  if (v.kostenpflichtig) kostenpflichtig.push([url, v])
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
  '## Deutscher Verleihtitel, Sprache nicht genannt',
  '',
  'Der Titel ist deutsch, über die Tonspur sagt er nichts. Meist stimmt es trotzdem —',
  'aber „meist" ist kein Beleg.',
  '',
  '| Unser Titel | Videotitel | Kanal | Verweis |',
  '|---|---|---|---|',
  ...deutscherTitel.map(([u, v]) => `| ${name(v.anilistId)} | ${v.videoTitel} | ${v.kanal} | [öffnen](${u}) |`),
  '',
  '## Hinter einer Kasse',
  '',
  'Diese Videos gibt es dort nur zum Kaufen oder Leihen (HTTP 401 bei oEmbed).',
  'Ein Verweis mit Kasse ist kein Stream — ob er in die Kaufwege gehört oder ganz',
  'verschwindet, ist eine Entscheidung, keine Messung.',
  '',
  '| Unser Titel | Verweis |',
  '|---|---|',
  ...kostenpflichtig.map(([u, v]) => `| ${name(v.anilistId)} | [öffnen](${u}) |`),
  '',
  '## Ohne Hinweis auf die Sprache',
  '',
  `${offen.length} Verweise, deren Videotitel nichts verrät. Für die hilft nur Hinsehen —`,
  'oder die Data API mit Schlüssel, die auch die Tonspuren nennt.',
  '',
  '| Unser Titel | Videotitel | Kanal | Verweis |',
  '|---|---|---|---|',
  ...offen.map(([u, v]) => `| ${name(v.anilistId)} | ${v.videoTitel ?? '—'} | ${v.kanal ?? '—'} | [öffnen](${u}) |`),
  '',
]
writeFileSync(resolve(wurzel, 'daniel-zum-abarbeiten/09-youtube-liste.md'), zeilen.join('\n'))
console.log(
  `daniel-zum-abarbeiten/09-youtube-liste.md: ${deutscherTitel.length} mit deutschem Titel, ` +
    `${kostenpflichtig.length} kostenpflichtig, ${offen.length} ohne Hinweis`,
)
