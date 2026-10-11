/**
 * Zusicherungen zum Entwurfswerkzeug (11.10.2026): Nur belastbare, neue Vorschläge werden zum Entwurf; der Entwurf ist gültiges YAML im Format von `data/curated/_SCHEMA.md`.
 */
import yaml from 'js-yaml'
import { eintragEntwurf, entwurfSlug, tabelle, urteile } from './lib/anime2you-entwurf.ts'
import type { GespeicherterVorschlag } from './lib/anime2you-bestand.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const yaiba: GespeicherterVorschlag = {
  titel: 'YAIBA: Samurai Legend',
  art: 'start',
  plattform: 'tv',
  anbieter: null,
  sender: 'ProSieben MAXX',
  datum: '2026-11-05',
  uhrzeit: '18:25',
  wochentage: 'Montag bis Freitag',
  sprache: 'deutsch',
  folgen: null,
  zitat: '»YAIBA: Samurai Legend« ist ab dem 5. November 2026 jeweils von Montag bis Freitag um 18:25 Uhr mit deutscher Sprachfassung auf ProSieben MAXX zu sehen.',
  unsicher: null,
  wochentag: 'Donnerstag',
  warnungen: [],
  artikelId: '1059480',
  artikel: 'YAIBA startet',
  quelle: 'https://www.anime2you.de/news/1059480/yaiba-samurai-legend-prosieben-maxx-termin/',
  veroeffentlicht: '2026-10-09',
  gelesenAm: '2026-10-11',
}
const status = (v: Partial<GespeicherterVorschlag>, artikel: string[] = [], slugs: string[] = []): string => urteile([{ ...yaiba, ...v }], new Set(artikel), slugs)[0]!.status

console.log('\nAnime2You-Entwurf: Einordnung')
pruefe('Tag, Weg, deutsche Fassung, unbekannter Artikel und Slug: neu', status({}) === 'neu')
pruefe('Artikel schon Quelle in den Handdateien: schon drin', status({}, ['1059480']) === 'schon drin')
pruefe('Slug besteht (auch mit Zusatz): schon drin', status({}, [], ['yaiba-samurai-legend-prosieben-maxx']) === 'schon drin')
pruefe('Ohne Tag: nicht belastbar', status({ datum: null }) === 'nicht belastbar')
pruefe('Sprache omu oder unklar: nicht belastbar', status({ sprache: 'omu' }) === 'nicht belastbar' && status({ sprache: 'unklar' }) === 'nicht belastbar')
pruefe('Ankündigung, Pause, Sprachfassung: nicht belastbar', ['ankuendigung', 'pause', 'sprachfassung', 'abgang'].every((art) => status({ art: art as never }) === 'nicht belastbar'))
pruefe('Ohne Plattform des Datenmodells: nicht belastbar', status({ plattform: null }) === 'nicht belastbar')
pruefe('Warnung zu Wochentag oder Uhrzeit: nicht belastbar', status({ warnungen: ['2026-11-05 ist ein Donnerstag, das Zitat nennt andere Wochentage – gegenlesen'] }) === 'nicht belastbar' && status({ warnungen: ['Uhrzeit widerspricht 18:30 (Artikel 1059541) – gegenlesen'] }) === 'nicht belastbar')
pruefe('Warnung nur zum Namen: bleibt belastbar', status({ warnungen: ['sender „ProSieben MAXX“ steht nur im Artikeltext, nicht im Zitat – gegenlesen'] }) === 'neu')

console.log('\nAnime2You-Entwurf: Eintrag')
const eintrag = yaml.load(eintragEntwurf({ ...yaiba, folgen: '780–877' })) as Record<string, unknown>[]
const e = eintrag[0] as { slug: string; search: string; platform: string; sender: string; releaseType: string; schedule: Record<string, unknown>; sources: string[] }
pruefe('Entwurf ist YAML mit einem Eintrag', Array.isArray(eintrag) && eintrag.length === 1, eintrag)
pruefe('Slug, Suche, Weg, Sender, Art', e.slug === 'yaiba-samurai-legend-prosieben-maxx' && e.search === 'YAIBA: Samurai Legend' && e.platform === 'tv' && e.sender === 'ProSieben MAXX' && e.releaseType === 'weekly', e)
pruefe('Tag und Uhrzeit als Text, Montag bis Freitag als Tage 1–5', e.schedule.firstEpisodeDate === '2026-11-05' && e.schedule.time === '18:25' && JSON.stringify(e.schedule.wochentage) === '[1,2,3,4,5]', e.schedule)
pruefe('Folgenbereich 780–877: Beginn und Anzahl 98', e.schedule.firstEpisodeNumber === 780 && e.schedule.episodeCount === 98, e.schedule)
pruefe('Quelle ist die Artikeladresse', e.sources.length === 1 && e.sources[0] === yaiba.quelle, e.sources)
const ohne = yaml.load(eintragEntwurf({ ...yaiba, uhrzeit: null, zitat: 'YAIBA startet am 5. November 2026 auf ProSieben MAXX, deutsche Fassung.' })) as { schedule: Record<string, unknown> }[]
pruefe('Ohne Uhrzeit und ohne Tage im Zitat: weder time noch wochentage', !('time' in ohne[0]!.schedule) && !('wochentage' in ohne[0]!.schedule), ohne[0]!.schedule)
const disc = yaml.load(eintragEntwurf({ ...yaiba, titel: 'Beispielfilm', plattform: 'disc', sender: null, art: 'disc', uhrzeit: null })) as { titleDe: string; releaseType: string; publisher?: string }[]
pruefe('Disc: titleDe, releaseType disc, kein erfundener Verlag', disc[0]!.titleDe === 'Beispielfilm' && disc[0]!.releaseType === 'disc' && !('publisher' in disc[0]!), disc[0])
pruefe('Slug ohne Sender bei Streaming', entwurfSlug({ ...yaiba, plattform: 'netflix', sender: null }) === 'yaiba-samurai-legend')
pruefe('Tabelle: Kopf plus eine Zeile je Vorschlag, Zitat wörtlich', tabelle(urteile([yaiba], new Set(), [])).split('\n').length === 3 && tabelle(urteile([yaiba], new Set(), [])).includes(yaiba.zitat))

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nAnime2You-Entwurf: alle Zusicherungen erfüllt')
