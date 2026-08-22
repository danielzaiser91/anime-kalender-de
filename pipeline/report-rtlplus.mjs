/**
 * Was die RTL+-Prüfung gefunden hat.
 *
 * Die Sprache steht nicht darunter — RTL+ nennt sie nirgends strukturiert, und
 * das `inLanguage: "de"` der Seite ist die Sprache der Seite, nicht der Tonspur.
 * Was hier steht, sind Verweise: welche leben, welche zum falschen Titel führen,
 * und welche sich nicht bestätigen lassen.
 *
 * Aufruf: node pipeline/report-rtlplus.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const quelle = resolve(wurzel, 'data/rtlplus-befunde.json')
if (!existsSync(quelle)) {
  console.error('Erst `node pipeline/check-rtlplus.mjs` laufen lassen.')
  process.exit(1)
}
const befunde = JSON.parse(readFileSync(quelle, 'utf8'))
const titel = JSON.parse(readFileSync(resolve(wurzel, 'public/data/titles.json'), 'utf8'))
const liste = Array.isArray(titel) ? titel : (titel.titles ?? Object.values(titel))
const name = (id) => {
  const t = liste.find((x) => x.id === id)
  return t?.titleDe ?? t?.titleEn ?? t?.titleRomaji ?? `#${id}`
}

const bestaetigt = []
const ohneNamen = []
for (const [url, v] of Object.entries(befunde)) {
  const t = liste.find((x) => x.id === v.anilistId)
  const s = (t?.streams ?? []).find((x) => x.url === url)
  if (s?.dub !== undefined) continue
  if (v.seitenTitel && v.passt) bestaetigt.push([url, v])
  else if (!v.seitenTitel) ohneNamen.push([url, v])
}

const zeilen = [
  '# RTL+: Stand der Verweise',
  '',
  `Stand: ${new Date().toISOString().slice(0, 10)}`,
  '',
  '**Die Tonspur sagt RTL+ nicht.** Der `TVSeries`-Block nach schema.org enthält Name,',
  'Beschreibung, Adresse und Bild — kein `audio`, kein `inLanguage` zur Fassung. Das',
  'einzige `inLanguage: "de"` gehört zur Seite selbst und stünde auch über einem Video',
  'mit Originalton. Wer die Synchro belegen will, muss hinsehen.',
  '',
  'Dass RTL+ ein deutscher Dienst ist und dort fast nur synchronisierte Fassungen laufen,',
  'ist plausibel — aber plausibel ist kein Beleg.',
  '',
  `## ${bestaetigt.length} Verweise führen nachweislich zum richtigen Titel`,
  '',
  'Die Seite existiert und nennt denselben Namen. Nur die Sprache fehlt.',
  '',
  '| Unser Titel | Seite nennt | Verweis |',
  '|---|---|---|',
  ...bestaetigt.map(([u, v]) => `| ${name(v.anilistId)} | ${v.seitenTitel} | [öffnen](${u}) |`),
  '',
  `## ${ohneNamen.length} Verweise ohne Titelangabe`,
  '',
  'Die Seite antwortet, nennt aber keinen Namen im strukturierten Block — meist Filme',
  'und die alten `tvnow.de`-Adressen. Weder bestätigt noch widerlegt.',
  '',
  '| Unser Titel | Verweis |',
  '|---|---|',
  ...ohneNamen.map(([u, v]) => `| ${name(v.anilistId)} | [öffnen](${u}) |`),
  '',
]
writeFileSync(resolve(wurzel, 'data/rtlplus-pruefliste.md'), zeilen.join('\n'))
console.log(`data/rtlplus-pruefliste.md: ${bestaetigt.length} bestätigt, ${ohneNamen.length} ohne Titelangabe`)
