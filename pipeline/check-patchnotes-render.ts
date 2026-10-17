import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { auslieferbarePatchnotes } from '../shared/patchnotes.ts'
import { EntwurfHinweis, PatchTagBlock } from '../web/src/components/patchnotes-teile.tsx'
import { PT } from '../web/src/lib/patchnotes-texte.ts'
import { tageVon } from '../web/src/lib/patchnotes-tage.ts'

/**
 * Der Stift im gerenderten Dialog hängt am Stempel, nicht am Kalendertag (Fehler 17.10.2026: `tag.datum === heute` hätte
 * den 16.10. am Folgetag den Stift genommen, ohne dass ein Check es merkte). Gerendert wird `PatchTagBlock` mit fester „heute“-Angabe.
 */
let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const eintrag = (datum: string) => ({ datum, kategorie: 'bugfix', text: `Eintrag ${datum}` })
// Stempel 15.10.: die Tage 16. und 17. sind Entwurf, 14. und 15. nicht — der Entwurfs-Anfang liegt in der Mitte der Liste.
const tage = tageVon(auslieferbarePatchnotes(['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'].map(eintrag), '2026-10-15'), 'alles')

function stiftTage(heute: string, gestern: string): string {
  return tage
    .filter((tag, index) => renderToStaticMarkup(createElement(PatchTagBlock, { tag, index, heute, gestern, schliessen: () => undefined })).includes('pn-entwurf'))
    .map((tag) => tag.datum)
    .sort()
    .join()
}

pruefe('Stift: am Folgetag des Entwurfs (heute 18.10.) zeigen ihn der 16. und der 17.', stiftTage('2026-10-18', '2026-10-17') === '2026-10-16,2026-10-17', stiftTage('2026-10-18', '2026-10-17'))
pruefe('Stift: mitten im Entwurf (heute 16.10.) zeigt ihn auch der 17. und nicht der 15.', stiftTage('2026-10-16', '2026-10-15') === '2026-10-16,2026-10-17', stiftTage('2026-10-16', '2026-10-15'))
pruefe('Stift: eine Woche später (heute 25.10.) bleibt er an denselben Tagen', stiftTage('2026-10-25', '2026-10-24') === '2026-10-16,2026-10-17', stiftTage('2026-10-25', '2026-10-24'))

const mitStift = tage.find((t) => t.datum === '2026-10-16')!
const html = renderToStaticMarkup(createElement(PatchTagBlock, { tag: mitStift, index: 0, heute: '2026-10-18', gestern: '2026-10-17', schliessen: () => undefined }))
pruefe('Stift: trägt den Tooltip-Text als Beschriftung', html.includes(`aria-label="${PT.heuteHinweis}"`), html)
pruefe('Stift: ist für Hilfsmittel ein Bild mit Beschriftung (role="img")', html.includes('role="img"'), html)
// Die Blase selbst wird erst beim Öffnen gezeichnet, im Server-Render fehlt sie; deshalb die Eigenschaften des Elements.
const hinweis = EntwurfHinweis()
pruefe('Stift: die Blase trägt den Tooltip-Text (nicht leer, nicht eine andere Konstante)', hinweis.props.text === PT.heuteHinweis, hinweis.props.text)
pruefe('Stift: die Blase öffnet unten', hinweis.props.seite === 'unten', hinweis.props.seite)
pruefe('Stift: Tooltip-Text ist „Entwurf: Texte werden noch überarbeitet.“', PT.heuteHinweis === 'Entwurf: Texte werden noch überarbeitet.', PT.heuteHinweis)
const ohne = tage.find((t) => t.datum === '2026-10-15')!
const htmlOhne = renderToStaticMarkup(createElement(PatchTagBlock, { tag: ohne, index: 0, heute: '2026-10-18', gestern: '2026-10-17', schliessen: () => undefined }))
pruefe('Stift: ein überarbeiteter Tag zeigt weder Stift noch Tooltip-Text', !htmlOhne.includes('pn-entwurf') && !htmlOhne.includes(PT.heuteHinweis), htmlOhne)

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
