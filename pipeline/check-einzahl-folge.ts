/**
 * Einzahl „1 Folge“ statt „1 Folgen“ in der Web-App: jeder Text mit „{Zahl} Folgen“ bei n = 1 und n = 2.
 * Aufruf: npx tsx pipeline/check-einzahl-folge.ts
 */
import { translate, einzahlFolge, type TranslationKey } from '../web/src/lib/i18n.tsx'

let verletzt = 0
let gezaehlt = 0
function pruefe(name: string, ist: string, soll: string): void {
  gezaehlt++
  if (ist === soll) return
  verletzt++
  console.error(`  ✖ ${name}: ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)
}

type Fall = [TranslationKey, Record<string, string | number>, string, string]
const FAELLE: Fall[] = [
  ['card.missedCount', { n: 1 }, 'beim Anbieter stehen 1 Folge', 'beim Anbieter stehen 2 Folgen'],
  ['detail.dubKopfVon', { n: 1, m: 1 }, '1 von 1 Folge auf Deutsch', '2 von 2 Folgen auf Deutsch'],
  ['detail.dubKopf', { n: 1 }, '1 Folge auf Deutsch', '2 Folgen auf Deutsch'],
  ['antwort.alleFolgen', { count: 1 }, 'Alle 1 Folge', 'Alle 2 Folgen'],
  ['antwort.nochFolgen', { count: 1, datum: 'x' }, 'noch 1 Folge bis zum Finale am x', 'noch 2 Folgen bis zum Finale am x'],
  ['antwort.erschienenZahl', { raus: 1, gesamt: 1 }, '1 von 1 Folge erschienen', '2 von 2 Folgen erschienen'],
  ['antwort.erschienenRest', { gesamt: 1 }, 'von 1 Folge erschienen', 'von 2 Folgen erschienen'],
  ['antwort.fertigZahl', { count: 1 }, 'Alle 1 Folge auf Deutsch', 'Alle 2 Folgen auf Deutsch'],
  ['antwort.teilweiseZahl', { raus: 1, gesamt: 1 }, '1 von 1 Folge auf Deutsch', '2 von 2 Folgen auf Deutsch'],
  ['kostenlos.zahl', { frei: 1, von: 1 }, '1 von 1 Folge', '2 von 2 Folgen'],
  ['antwort.fertigUngefaehr', { count: '≈ 1' }, 'Auf Deutsch, ≈ 1 Folge', 'Auf Deutsch, ≈ 2 Folgen'],
  ['kal.buendelStream', { n: 1 }, '+1 Folge', '+2 Folgen'],
  ['kal.folgen', { n: 1 }, '1 Folge', '2 Folgen'],
]
for (const [schluessel, params, eins, zwei] of FAELLE) {
  const zahlen = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v === '≈ 1' ? '≈ 2' : 2]))
  pruefe(`${schluessel} n=1`, translate(schluessel, params), eins)
  pruefe(`${schluessel} n=2`, translate(schluessel, typeof params.datum === 'string' ? { ...zahlen, datum: 'x' } : zahlen), zwei)
}
pruefe('11 und 21 bleiben Mehrzahl', translate('kal.folgen', { n: 11 }) + translate('kal.folgen', { n: 21 }), '11 Folgen21 Folgen')
pruefe('Wort „Folgen“ ohne Zahl bleibt', einzahlFolge('Alle Folgen {n}', { n: 1 }), 'Alle Folgen {n}')

if (verletzt) {
  console.error(`${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log(`check-einzahl-folge: ${gezaehlt} Zusicherungen erfüllt (${FAELLE.length} Texte je n = 1 und n = 2)`)
