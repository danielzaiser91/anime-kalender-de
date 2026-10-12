/**
 * Prüft die Störungsregel der Beleg-Lesung (`pipeline/lib/beleg-stoerung.ts`): Ein Anbieter, der dreimal in Folge versagt, ruht — die übrigen werden weiter gelesen.
 * Und: Der Ruhestand gilt nur für den Lauf, im nächsten Lauf (neue Zählung) wird er wieder gefragt (spätestens nach einem Tag sichtbar).
 * Dazu (12.10.2026): eine ungültige Adresse beendet den Lauf nicht; ruhende Anbieter verbrauchen keine Plätze der Obergrenze; eine gescheiterte Adresse steht
 * hinter den übrigen und kommt nach ihrer Pause wieder vorn (`pipeline/lib/beleg-fehlschlag.ts`).
 * Aufruf: npx tsx pipeline/check-beleg-stoerung.ts   (Exit 1 bei Verstoß)
 */
import { neueStoerungen, ohneRuhende } from './lib/beleg-stoerung.ts'
import { inPause, merkeFehlschlag, pausenTage, vergissFehlschlag, PAUSE_MAX_TAGE, type Fehlschlaege } from './lib/beleg-fehlschlag.ts'
import { warteschlange, type BelegGedaechtnis } from './lib/beleg-lesung.ts'

let fehler = 0
const pruefe = (name: string, ok: boolean) => {
  if (!ok) { fehler++; console.error(`FEHL ${name}`) }
}

const cr = (n: number) => `https://www.crunchyroll.com/de/news/anime/2026/${n}`
const disney = (n: number) => `https://www.disneyplus.com/browse/entity-${n}`
const a2y = (n: number) => `https://www.anime2you.de/news/${n}/`

/** Der Lauf wie in `belege-lesen.ts`: `ohneRuhende` gibt die Adressen vor, ein Fehlschlag zählt zur Störung. Liefert die gelesenen und die versuchten Adressen. */
function lauf(schlange: string[], liest: (url: string) => boolean, limit = Infinity): { gelesen: string[]; versucht: string[] } {
  const st = neueStoerungen(3)
  const gelesen: string[] = []
  const versucht: string[] = []
  for (const url of ohneRuhende(schlange, limit, st)) {
    versucht.push(url)
    if (liest(url)) { st.erfolg(url); gelesen.push(url) } else st.fehl(url)
  }
  return { gelesen, versucht }
}

/** Die Schlange vom 12.10.2026: fünf Crunchyroll- und drei Disney+-Adressen vorn, dahinter gesunde. */
const schlange = [cr(1), cr(2), cr(3), cr(4), cr(5), disney(1), disney(2), disney(3), ...Array.from({ length: 52 }, (_, i) => a2y(i))]
const kaputt = (u: string) => u.includes('crunchyroll') || u.includes('disneyplus')
pruefe('gesunde Adressen werden trotz kaputter Anbieter vorn gelesen (vorher 0)', lauf(schlange, (u) => !kaputt(u)).gelesen.length === 52)

pruefe('ein ruhender Anbieter wird nur dreimal gefragt, nicht durchgefragt', lauf(schlange, (u) => !kaputt(u)).versucht.filter((u) => u.includes('crunchyroll')).length === 3)

pruefe('eine gelesene Adresse beendet die Serie: abwechselnd gut und schlecht ruht nie', lauf([cr(1), cr(2), cr(3), cr(4), cr(5), cr(6)], (u) => Number(u.split('/').pop()) % 2 === 0).gelesen.length === 3)

pruefe(
  'Änderung wird spätestens im nächsten Lauf sichtbar: neue Zählung, Anbieter wird wieder gefragt',
  lauf([cr(1), cr(2), cr(3)], () => false).gelesen.length === 0 && lauf([cr(1), cr(2), cr(3), cr(4)], () => true).gelesen.length === 4,
)

/* Ungültige Adresse: kein Absturz, nur ein Fehlschlag dieser Adresse; die übrigen werden gelesen. */
const st = neueStoerungen(3)
let wirft = false
try {
  st.ruht('keine adresse')
  st.fehl('keine adresse')
  st.erfolg('keine adresse')
} catch {
  wirft = true
}
pruefe('ungültige Adresse wirft in ruht/fehl/erfolg nicht (vorher: TypeError beendete den Lauf)', !wirft)
const mitKaputter = lauf(['keine adresse', a2y(1), 'noch eine', a2y(2)], (u) => URL.canParse(u))
pruefe('ungültige Adresse = Fehlschlag dieser Adresse, der Lauf liest die übrigen', mitKaputter.gelesen.length === 2 && mitKaputter.versucht.length === 4)
pruefe('zwei ungültige Adressen sind keine Serie eines Anbieters', lauf(['a', 'b', 'c', a2y(1)], (u) => URL.canParse(u)).gelesen.length === 1)

/* Obergrenze: Ruhende Anbieter belegen keinen Platz, gesunde rücken nach. 8 kaputte vorn, 70 gesunde dahinter, 60 Plätze. */
const lang = [cr(1), cr(2), cr(3), cr(4), cr(5), disney(1), disney(2), disney(3), ...Array.from({ length: 70 }, (_, i) => a2y(i))]
const begrenzt = lauf(lang, (u) => !kaputt(u), 60)
pruefe('Obergrenze zählt Abrufe: 60 Versuche', begrenzt.versucht.length === 60)
pruefe('zwei übersprungene ruhende Adressen verbrauchen keinen Platz (vorher 52 gelesen, jetzt 54)', begrenzt.gelesen.length === 54)

/* Fehlschlag-Marke und Schlangenreihenfolge. */
const HEUTE = '2026-10-12'
const tagVor = (n: number) => new Date(Date.parse(HEUTE) - n * 86_400_000).toISOString().slice(0, 10)
const kein: BelegGedaechtnis = {}
const marken = (n: number, vorTagen: number): Fehlschlaege => ({ [cr(1)]: { am: tagVor(vorTagen), anzahl: n } })
const reihe = (m: Fehlschlaege) => warteschlange([cr(1), a2y(1), a2y(2)], kein, HEUTE, 7, 60, new Set(), m)

pruefe('ohne Marke bleibt die Reihenfolge: nie gescheitert (fehlendes Feld)', reihe({})[0] === cr(1))
pruefe('eben gescheiterte Adresse steht hinter den ungelesenen, bleibt aber in der Schlange', reihe(marken(1, 0)).join() === [a2y(1), a2y(2), cr(1)].join())
pruefe('nach der Pause (1 Tag bei erstem Fehlschlag) steht sie wieder vorn', reihe(marken(1, 1))[0] === cr(1))
pruefe('Pause wächst: dritter Fehlschlag, drei Tage her = noch hinten, vier Tage = vorn', reihe(marken(3, 3))[2] === cr(1) && reihe(marken(3, 4))[0] === cr(1))
pruefe('Pause endet spätestens nach PAUSE_MAX_TAGE', pausenTage(50) === PAUSE_MAX_TAGE && reihe(marken(50, PAUSE_MAX_TAGE - 1))[2] === cr(1) && reihe(marken(50, PAUSE_MAX_TAGE))[0] === cr(1))
pruefe('inPause ohne Marke ist falsch', !inPause(undefined, HEUTE))

const m: Fehlschlaege = {}
merkeFehlschlag(m, cr(1), tagVor(1))
merkeFehlschlag(m, cr(1), HEUTE)
pruefe('zweiter Fehlschlag zählt hoch und trägt das neue Datum', m[cr(1)]?.anzahl === 2 && m[cr(1)]?.am === HEUTE)
vergissFehlschlag(m, cr(1))
pruefe('eine gelesene Adresse löscht die Marke', m[cr(1)] === undefined)

if (fehler) process.exit(1)
console.log('check-beleg-stoerung: ok')
