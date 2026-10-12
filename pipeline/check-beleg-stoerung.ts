/**
 * Prüft die Störungsregel der Beleg-Lesung (`pipeline/lib/beleg-stoerung.ts`): Ein Anbieter, der dreimal in Folge versagt, ruht — die übrigen werden weiter gelesen.
 * Und: Der Ruhestand gilt nur für den Lauf, im nächsten Lauf (neue Zählung) wird er wieder gefragt (spätestens nach einem Tag sichtbar).
 * Aufruf: npx tsx pipeline/check-beleg-stoerung.ts   (Exit 1 bei Verstoß)
 */
import { neueStoerungen } from './lib/beleg-stoerung.ts'

let fehler = 0
const pruefe = (name: string, ok: boolean) => {
  if (!ok) { fehler++; console.error(`FEHL ${name}`) }
}

const cr = (n: number) => `https://www.crunchyroll.com/de/news/${n}`
const disney = (n: number) => `https://www.disneyplus.com/browse/entity-${n}`
const a2y = (n: number) => `https://www.anime2you.de/news/${n}/`

/** Die Schlange vom 12.10.2026: fünf Crunchyroll- und drei Disney+-Adressen vorn, dahinter gesunde. Zählt, wie viele gelesen werden. */
function lauf(schlange: string[], liest: (url: string) => boolean): number {
  const st = neueStoerungen(3)
  let gelesen = 0
  for (const url of schlange) {
    if (st.ruht(url)) continue
    if (liest(url)) { st.erfolg(url); gelesen++ } else st.fehl(url)
  }
  return gelesen
}

const schlange = [cr(1), cr(2), cr(3), cr(4), cr(5), disney(1), disney(2), disney(3), ...Array.from({ length: 52 }, (_, i) => a2y(i))]
const kaputt = (u: string) => u.includes('crunchyroll') || u.includes('disneyplus')
pruefe('gesunde Adressen werden trotz kaputter Anbieter vorn gelesen (vorher 0)', lauf(schlange, (u) => !kaputt(u)) === 52)

const gelesenCr: string[] = []
lauf(schlange, (u) => { if (u.includes('crunchyroll')) gelesenCr.push(u); return !kaputt(u) })
pruefe('ein ruhender Anbieter wird nur dreimal gefragt, nicht durchgefragt', gelesenCr.length === 3)

pruefe('eine gelesene Adresse beendet die Serie: abwechselnd gut und schlecht ruht nie', lauf([cr(1), cr(2), cr(3), cr(4), cr(5), cr(6)], (u) => Number(u.split('/').pop()) % 2 === 0) === 3)

pruefe('Änderung wird spätestens im nächsten Lauf sichtbar: neue Zählung, Anbieter wird wieder gefragt', lauf([cr(1), cr(2), cr(3)], () => false) === 0 && lauf([cr(1), cr(2), cr(3), cr(4)], () => true) === 4)

if (fehler) process.exit(1)
console.log('check-beleg-stoerung: ok')
