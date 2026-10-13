/** Die Zusammenfassung eines Extraktionslaufs als Markdown – Kommentar am Pull Request und Lauf-Zusammenfassung. */
import type { GespeicherterVorschlag } from './anime2you-bestand.ts'

export interface Verworfen {
  artikelId: string
  titel: string
  /** Welcher Vorschlag des Artikels es war (Titel, Art, Tag). */
  vorschlag: string
  grund: string
}

export interface LaufErgebnis {
  neu: GespeicherterVorschlag[]
  verworfen: Verworfen[]
  /** Artikel, die Claude nicht als gelesen gemeldet hat – sie kommen morgen wieder. */
  ungelesen: string[]
  uebersprungen: number
}

const zelle = (s: string | null | undefined): string => (s ?? '–').replace(/[|\r\n[\]]+/g, ' ').trim()

function zeile(v: GespeicherterVorschlag): string {
  const weg = [v.sender ?? v.anbieter, v.plattform ? `(${v.plattform})` : '(nicht im Datenmodell)'].filter(Boolean).join(' ')
  const tag = v.art === 'rhythmus' ? `bis ${v.bis}` : v.datum ? `${v.wochentag}, ${v.datum}` : 'kein Tag'
  const folgen = v.proWoche ? `${v.proWoche[0] === v.proWoche[1] ? v.proWoche[0] : v.proWoche.join('–')} je Woche` : v.folgen
  const hinweise = [...v.warnungen, ...(v.unsicher ? [`unsicher: ${v.unsicher}`] : [])]
  return `| [${zelle(v.artikel)}](${v.quelle}) | ${zelle(v.titel)} | ${v.art} | ${zelle(weg)} | ${tag}${v.uhrzeit ? ` ${v.uhrzeit}` : ''}${v.wochentage ? ` (${zelle(v.wochentage)})` : ''} | ${v.sprache} | ${zelle(folgen)} | „${zelle(v.zitat)}“ | ${zelle(hinweise.join('; '))} |`
}

export function zusammenfassung(e: LaufErgebnis, heute: string): string {
  const kopf = ['| Artikel | Titel | Art | Weg | Tag | Sprache | Folgen | Beleg (wörtlich) | Hinweis |', '|---|---|---|---|---|---|---|---|---|']
  const teile = [
    `## Anime2You-Extraktion ${heute}`,
    '',
    `${e.neu.length} Vorschläge, ${e.verworfen.length} verworfen, ${e.ungelesen.length} Artikel ungelesen (morgen erneut), ${e.uebersprungen} ohne Deutschland-Bezug übersprungen.`,
    'Vorschläge sind keine Termine: Jeder braucht einen Handeintrag mit der Quelle. Wochentag und Uhrzeit vor der Übernahme gegenlesen. Entwurf: npx tsx pipeline/anime2you-entwurf.ts',
  ]
  if (e.neu.length) teile.push('', ...kopf, ...e.neu.map(zeile))
  const ohneModell = e.neu.filter((v) => v.plattform === null && v.anbieter)
  if (ohneModell.length) teile.push('', `Offen: Anbieter ohne Plattform im Datenmodell – ${[...new Set(ohneModell.map((v) => v.anbieter))].join(', ')}.`)
  if (e.verworfen.length) teile.push('', '### Verworfen', ...e.verworfen.map((v) => `- ${v.artikelId} „${zelle(v.titel)}“, ${zelle(v.vorschlag)}: ${v.grund}`))
  return teile.join('\n')
}
