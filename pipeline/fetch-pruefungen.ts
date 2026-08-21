/**
 * Holt die Prüfergebnisse ab, die Daniel im Browser abgeschickt hat.
 *
 * Der Weg (21.08.2026): Er öffnet einen Titel beim Anbieter, die Erweiterung in
 * `extension/` blendet einen Knopf ein, der Klick schickt die gelesenen
 * Tonspuren an den Worker. Dieses Skript holt sie von dort und trägt sie in
 * `data/dub-confirmed.yaml` ein — die Datei bleibt die maßgebliche Fassung, der
 * Worker ist nur der Briefkasten dazwischen.
 *
 * Warum das kein Scraping ist: Die Seiten hat er selbst geöffnet, die
 * Erweiterung liest nur, was der Player ohnehin geladen hat. Für Netflix ist das
 * der einzige erlaubte Weg — deren `robots.txt` untersagt jeden automatisierten
 * Abruf.
 *
 * Aufruf: npm run data:pruefungen
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { log, ROOT, warn } from './lib/util.ts'

const WORKER = process.env.LAUF_WORKER ?? 'https://newsletter.animekalender.workers.dev'
const TOKEN = process.env.LAUF_TOKEN

interface Pruefung {
  id: number
  plattform: string
  url: string
  sprachen: string | null
  befund: 'dub' | 'kein_dub' | 'weg'
  titel: string | null
  folgen: number | null
  notiz: string | null
  gemeldet_am: string
}

if (!TOKEN) {
  warn('LAUF_TOKEN fehlt — ohne das Token gibt der Worker die Prüfungen nicht heraus.')
  process.exit(0)
}

const antwort = await fetch(`${WORKER}/pruefung?token=${encodeURIComponent(TOKEN)}`)
if (!antwort.ok) {
  warn(`Prüfungen nicht abrufbar: HTTP ${antwort.status}`)
  process.exit(1)
}
const { pruefungen } = (await antwort.json()) as { pruefungen: Pruefung[] }

if (!pruefungen.length) {
  log('Keine neuen Prüfungen.')
  process.exit(0)
}

/**
 * Von der Adresse zum Titel.
 *
 * Die Erweiterung meldet die Adresse, die im Browser stand. Unser Datensatz
 * führt dieselbe Adresse an einem oder mehreren Titeln — bei Demon Slayer teilen
 * sich fünf AniList-Einträge eine Netflix-Adresse, und eine Prüfung belegt dann
 * alle fünf.
 */
const titles = JSON.parse(readFileSync(resolve(ROOT, 'public/data/titles.json'), 'utf8'))
const liste: Array<{ id: number; titleDe?: string; titleEn?: string; streams?: Array<{ platform: string; url: string }> }> =
  Array.isArray(titles) ? titles : (titles.titles ?? Object.values(titles))

const nachUrl = new Map<string, number[]>()
for (const t of liste) {
  for (const s of t.streams ?? []) {
    if (!s.url) continue
    const liste2 = nachUrl.get(s.url) ?? []
    liste2.push(t.id)
    nachUrl.set(s.url, liste2)
  }
}

const heute = new Date().toISOString().slice(0, 10)
const zeilen: string[] = []
let uebernommen = 0
const offenGeblieben: string[] = []

for (const p of pruefungen) {
  const ids = nachUrl.get(p.url) ?? []
  if (!ids.length) {
    offenGeblieben.push(`${p.url} — im Datensatz nicht gefunden`)
    continue
  }
  const sprachen = p.sprachen ? (JSON.parse(p.sprachen) as string[]) : []
  for (const id of ids) {
    const t = liste.find((x) => x.id === id)
    zeilen.push('')
    zeilen.push(`- anilistId: ${id}`)
    if (t?.titleDe || t?.titleEn) zeilen.push(`  title: ${JSON.stringify(t.titleDe ?? t.titleEn)}`)
    zeilen.push(`  platform: ${p.plattform}`)
    if (p.befund === 'weg') zeilen.push('  available: false')
    else zeilen.push(`  dub: ${p.befund === 'dub'}`)
    zeilen.push(`  checkedAt: '${p.gemeldet_am.slice(0, 10)}'`)
    const notiz = [sprachen.length ? `Tonspuren: ${sprachen.join(', ')}` : '', p.notiz ?? '']
      .filter(Boolean)
      .join(' — ')
    if (notiz) zeilen.push(`  note: ${JSON.stringify(notiz)}`)
    uebernommen++
  }
}

if (zeilen.length) {
  const p = resolve(ROOT, 'data/dub-confirmed.yaml')
  const alt = readFileSync(p, 'utf8')
  const kopf = `\n# --- Aus dem Browser gemeldet, abgeholt am ${heute} ---`
  writeFileSync(p, alt.trimEnd() + '\n' + kopf + '\n' + zeilen.join('\n') + '\n')
}

log(`${pruefungen.length} Prüfungen abgeholt, ${uebernommen} Einträge geschrieben`)
for (const o of offenGeblieben) warn(o)
log('Die Prüfungen bleiben im Worker stehen, bis sie dort als übernommen markiert werden.')
