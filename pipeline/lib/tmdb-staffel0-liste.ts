import { writeText } from './util.ts'
import type { Staffel0Eintrag, Staffel0Urteil } from './tmdb-staffel0.ts'
import type { Staffel0Kandidat } from './tmdb-staffel0-kandidaten.ts'

const DATEI = 'daniel-zum-abarbeiten/listen/tmdb-staffel0-unsicher.md'
const zelle = (s: string): string => s.replace(/\|/g, '/').replace(/\s+/g, ' ')

function zeile(k: Staffel0Kandidat, u: Staffel0Urteil): string {
  const t = u.treffer!
  const m = t.merkmale
  const name = zelle(k.titel.namen.find(Boolean) ?? String(k.id))
  const tmdb = `[tv/${t.serie}/season/0](https://www.themoviedb.org/tv/${t.serie}/season/0) Folge ${t.e}`
  const werte = `${m.tage >= 0 ? '+' : ''}${m.tage} Tage, Länge ${m.laenge === null ? '–' : `±${m.laenge} min`}, Name ${m.name ? 'gleich' : 'anders'}`
  return `| [${name}](https://anime-kalender.de/#/woche?t=${k.id}) | ${k.titel.start} | ${tmdb} | ${werte} | ${zelle(u.grund)} |`
}

/**
 * Die Prüfliste zum Nachsehen von Hand: Titel mit einer nahen, aber nicht tragenden Folge der Staffel 0 (nie automatisch zugeordnet), dazu die, bei denen zwei Titel
 * dieselbe Folge träfen. Titel ganz ohne Folge (`kein`) stehen nicht darin. Lokal, nicht im Repo, wie die übrigen Listen unter `daniel-zum-abarbeiten/listen/`.
 */
export function staffel0ListeText(kandidaten: Staffel0Kandidat[], offen: Map<number, Staffel0Urteil>, doppelt: Set<string>, eintraege: Record<string, Staffel0Eintrag>): string {
  const unsicher = kandidaten.filter((k) => offen.get(k.id)?.stufe === 'unsicher')
  return [
    '# TMDB-Staffel 0: unsichere Treffer',
    '',
    `Erzeugt von \`pipeline/lib/tmdb-staffel0-abruf.ts\` (im Plakat-Lauf). ${Object.keys(eintraege).length} Titel sind zugeordnet (\`data/tmdb-staffel0.json\`), ${unsicher.length} unsicher (diese Liste), ${doppelt.size} ohne Zuordnung, weil zwei Titel dieselbe Folge träfen.`,
    'Sicher heißt: Datum höchstens ±1 Tag, Name der Folge gleich (englisch oder japanisch), Länge gleich, einziger Treffer. Die Spalte „Tage“ ist TMDB minus unser japanischer Start.',
    '',
    '| Titel | Start | TMDB | Werte | Grund |',
    '|---|---|---|---|---|',
    ...unsicher.map((k) => zeile(k, offen.get(k.id)!)),
    '',
  ].join('\n')
}

export const schreibeStaffel0Liste = (...args: Parameters<typeof staffel0ListeText>): void => writeText(DATEI, staffel0ListeText(...args))
