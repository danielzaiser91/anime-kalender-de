/**
 * Die Liste `daniel-zum-abarbeiten/listen/justwatch-widersprueche.md`, vom Bau erzeugt: wo unsere Messung JustWatchs „de“ an
 * derselben Seite widerspricht, der Wächter je Anbieter und die Seiten mit „de“ ohne eigenen Weg. Anime und Cartoons entstehen in
 * verschiedenen Phasen (`11-6-jw-vertrauen.ts`, `nebendateien.ts`); jede ersetzt nur ihren Abschnitt zwischen den Markierungen.
 * Kein Baudatum im Text: Die Datei ändert sich nur, wenn sich ein Befund ändert.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT, writeText } from '../lib/util.ts'
import { WAECHTER_GRENZE } from '../lib/jw-seite.ts'
import type { JwSeitenErgebnis } from './jw-seite-ton.ts'

export const WIDERSPRUCHS_LISTE = 'daniel-zum-abarbeiten/listen/justwatch-widersprueche.md'

const KOPF = [
  '# JustWatch-Widersprüche',
  '',
  'Vom Bau erzeugt (`pipeline/bau/jw-widerspruchs-liste.ts`), nicht von Hand ändern. Regel: `docs/wissen/quellen.md`,',
  'Abschnitt „JustWatch-Ton je Seite“. Unsere Messung (Handbeleg, Meldung der Erweiterung, Messurteil) geht vor;',
  `über ${WAECHTER_GRENZE * 100} % Widersprüche zeigt ein Anbieter nur den Hinweis „laut JustWatch“.`,
  '',
]

const zelle = (x: string | number): string => String(x).replace(/\|/g, '\\|')
/** Wege, die wegen bloßer Serienangabe beim Hinweis bleiben, je Grund. */
export const nurSerieText = (e: JwSeitenErgebnis): string =>
  [...e.nurSerie].map(([grund, n]) => `${grund} ${n}`).join(', ') || 'keine'

const prozent = (z: { gemessen: number; widerspruch: number }): string => `${((z.widerspruch / z.gemessen) * 100).toFixed(1)} %`

/** Der Abschnitt einer Phase als Markdown, mit Start- und Endmarke. */
export function abschnitt(art: 'Anime' | 'Cartoons', e: JwSeitenErgebnis): string {
  const marke = art.toLowerCase()
  const waechter = [...e.zaehlung].sort(([a], [b]) => a.localeCompare(b)).map(([anbieter, z]) =>
    `| ${anbieter} | ${z.gemessen} | ${z.widerspruch} | ${prozent(z)} | ${e.abgeschaltet.has(anbieter) ? 'nur Hinweis' : 'Flagge'} |`)
  const widersprueche = e.widersprueche.map((w) => `| ${zelle(w.titel)} (${w.id}) | ${w.platform} | ${zelle(w.url)} | de, Stand ${w.jw} | ${zelle(w.gemessen)} |`)
  const kandidaten = e.kandidaten.map((k) => `| ${zelle(k.titel)} (${k.id}) | ${zelle(k.anbieter)} | ${k.seite} | ${k.wegOhneKennung ? 'ja' : 'nein'} |`)
  return [
    `<!-- ${marke}:start -->`,
    `## ${art}`,
    '',
    `Flagge „Deutsch“: ${e.flaggen} Wege, nur Hinweis: ${e.hinweise}.`,
    '',
    `JustWatch-„de“ nur als Serienangabe (Mehrteiler oder mehrere Staffeln, keine Flagge): ${nurSerieText(e)}.`,
    '',
    '| Anbieter | mit eigener Messung | Widersprüche | Anteil | Anzeige |',
    '|---|---|---|---|---|',
    ...waechter,
    '',
    `### Widersprüche (${e.widersprueche.length})`,
    '',
    '| Titel | Anbieter | Adresse | JustWatch | Gemessen |',
    '|---|---|---|---|---|',
    ...widersprueche,
    '',
    `### Kandidaten für neue Wege (${e.kandidaten.length})`,
    '',
    'JustWatch nennt deutschen Ton an einer Seite, zu der wir keinen Weg haben. „Weg ohne Kennung“: ein Weg zum Anbieter steht, seine Adresse trägt aber keine Seitenkennung.',
    '',
    '| Titel | Anbieter laut JustWatch | Seite | Weg ohne Kennung |',
    '|---|---|---|---|',
    ...kandidaten,
    `<!-- ${marke}:end -->`,
  ].join('\n')
}

/** Ersetzt den Abschnitt einer Phase in `text` oder hängt ihn an; Anime steht vor Cartoons. */
export function ersetzeAbschnitt(text: string, art: 'Anime' | 'Cartoons', neu: string): string {
  const marke = art.toLowerCase()
  const muster = new RegExp(`<!-- ${marke}:start -->[\\s\\S]*?<!-- ${marke}:end -->`)
  if (muster.test(text)) return text.replace(muster, () => neu)
  const basis = text.trim() ? text.trimEnd() : KOPF.join('\n').trimEnd()
  if (art === 'Anime' && basis.includes('<!-- cartoons:start -->')) return basis.replace('<!-- cartoons:start -->', () => `${neu}\n\n<!-- cartoons:start -->`) + '\n'
  return `${basis}\n\n${neu}\n`
}

/** Prüfungen, die den Wege-Abschluss durchlaufen, lenken die Liste wie die Suchadressen per `SUCHADRESSEN_ORDNER` um (`suchadressenInTemp`). */
export function widerspruchsZiel(): string {
  const ordner = process.env.SUCHADRESSEN_ORDNER
  return ordner ? `${ordner}/justwatch-widersprueche.md` : WIDERSPRUCHS_LISTE
}

export function schreibeJwWidersprueche(art: 'Anime' | 'Cartoons', e: JwSeitenErgebnis): void {
  const ziel = widerspruchsZiel()
  const voll = resolve(ROOT, ziel)
  const alt = existsSync(voll) ? readFileSync(voll, 'utf8') : ''
  writeText(ziel, ersetzeAbschnitt(alt, art, abschnitt(art, e)))
}
