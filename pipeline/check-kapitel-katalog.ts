/**
 * Zusicherung: **ein Kapitel-Nein entsteht nur aus dem deutschen Katalog** (Princess Principal: Crown Handler, 17.09.2026).
 * Lauf von `kapitelImBlock` mit beiden Katalogen — ersetzt die Quelltext-Zusicherung auf die Rückgabezeile in `check-logic.ts`.
 */
import { kapitelImBlock } from './lib/crunchyroll-dub.ts'

const fehler: string[] = []
let faelle = 0
const erwarte = (name: string, ist: unknown, soll: unknown) => {
  faelle++
  if (ist !== soll) fehler.push(`${name}: ${String(ist)} statt ${String(soll)}`)
}

const serie = (katalog: string) =>
  ({
    katalog,
    staffeln: [{ name: 'Princess Principal: Crown Handler', folgen: 4, deutscheFolgen: [{ nummer: 1 }, { nummer: 2 }] }],
  }) as unknown as Parameters<typeof kapitelImBlock>[0]
const kapitel = (katalog: string, name: string) =>
  kapitelImBlock(serie(katalog), { format: 'OVA', titleRomaji: name } as unknown as Parameters<typeof kapitelImBlock>[1])
const NAME = 'Princess Principal: Crown Handler - Chapter '

erwarte('deutscher Katalog, Kapitel 3: Nein', kapitel('de', `${NAME}3`), false)
erwarte('deutscher Katalog, Kapitel 1: Ja', kapitel('de', `${NAME}1`), true)
erwarte('US-Katalog, Kapitel 3: kein Nein, nur keine Auskunft', kapitel('us', `${NAME}3`), undefined)
erwarte('US-Katalog, Kapitel 4: kein Nein', kapitel('us', `${NAME}4`), undefined)
erwarte('US-Katalog, Kapitel 2: das Ja gilt trotzdem', kapitel('us', `${NAME}2`), true)
erwarte('Kapitel außerhalb des Blocks: keine Auskunft', kapitel('de', `${NAME}5`), undefined)

if (fehler.length) {
  console.error(`FEHL check-kapitel-katalog:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-kapitel-katalog: ${faelle} Fälle ok.`)
