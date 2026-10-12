/**
 * **`/pruefung?stand=1` rechnet „erledigt" wie die Erweiterung** (11.10.2026).
 *
 * Die Statusanzeige zeigte für Disney+ 151 offene Titel, die Erweiterung nach dem Durchgang einen:
 * Meldungen, die im Briefkasten auf die Übernahme warten, aber vor dem letzten Prüfstand liegen,
 * zählte der Worker als offen. Geprüft wird gegen eine Attrappe des Briefkastens, nie gegen den echten.
 *
 * Aufruf: `npx tsx tools/worker-pruefstand.test.ts`
 */
import { rechnePruefstand, type Anbieter, type Zeile } from './worker-pruefstand-attrappe.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}

const ERZEUGT = '2026-10-11T16:00:00.000Z'
const VOR_PRUEFSTAND = '2026-10-10T10:00:00.000Z'
const NACH_PRUEFSTAND = '2026-10-11T17:00:00.000Z'
const URL_NORMAL = 'https://www.disneyplus.com/browse/entity-normal'
const URL_ALT = 'https://www.disneyplus.com/browse/entity-wiedervorlage-alt'
const URL_NEU = 'https://www.disneyplus.com/browse/entity-wiedervorlage-neu'
const URL_STAFFELN = 'https://www.netflix.com/title/1'

function meldung(url: string, gemeldet_am: string, uebernommen: 0 | 1 = 0, staffel: number | null = null): Zeile {
  return { plattform: 'disneyplus', url, staffel, uebernommen, gemeldet_am }
}

function disney(ziele: Anbieter['ziele'], offen = ziele.length): Anbieter {
  return { name: 'Disney+', plattform: 'disneyplus', offen, gesamt: 200, gemeldet: 0, ziele }
}

async function rechneEinen(zeilen: Zeile[], anbieter: Anbieter) {
  const erg = await rechnePruefstand(zeilen, [anbieter], ERZEUGT)
  return erg.anbieter[0]
}

console.log('normales Ziel')
const normal = disney([{ url: URL_NORMAL, titel: 'Normal' }])
const ohne = await rechneEinen([], normal)
pruefe(ohne.titel === 1 && ohne.offen === 1, 'ohne Meldung: offen')
const wartetAlt = await rechneEinen([meldung(URL_NORMAL, VOR_PRUEFSTAND, 0)], normal)
pruefe(wartetAlt.titel === 0 && wartetAlt.offen === 0, 'im Briefkasten, vor dem Prüfstand gemeldet: erledigt')
pruefe(wartetAlt.unterwegs === 1, '… und zählt weiter als unterwegs')
const uebernommenAlt = await rechneEinen([meldung(URL_NORMAL, VOR_PRUEFSTAND, 1)], normal)
pruefe(uebernommenAlt.titel === 1, 'übernommen und vor dem Prüfstand (der Bau führt es trotzdem): offen')
const uebernommenNeu = await rechneEinen([meldung(URL_NORMAL, NACH_PRUEFSTAND, 1)], normal)
pruefe(uebernommenNeu.titel === 0, 'übernommen, aber nach dem Prüfstand gemeldet: erledigt')

console.log('Wiedervorlage (Meldung zählt erst seit dem Prüfstand, wie in der Erweiterung)')
const wv = disney([
  { url: URL_ALT, titel: 'Alt', seit: '2026-10-09' },
  { url: URL_NEU, titel: 'Neu', seit: '2026-10-09' },
])
const wvAlt = [meldung(URL_ALT, VOR_PRUEFSTAND, 0)]
const wvErg = await rechneEinen([...wvAlt, meldung(URL_NEU, NACH_PRUEFSTAND, 0)], wv)
pruefe(wvErg.ziele.some((z) => z.url === URL_ALT), 'alt gemeldet (im Briefkasten, vor dem Prüfstand): offen')
pruefe(!wvErg.ziele.some((z) => z.url === URL_NEU), 'neu gemeldet (nach dem Prüfstand): erledigt')
pruefe(wvErg.titel === 1 && wvErg.offen === 1, 'Zahlen: ein Titel offen')
const wvUebernommen = await rechneEinen([meldung(URL_NEU, NACH_PRUEFSTAND, 1)], wv)
pruefe(!wvUebernommen.ziele.some((z) => z.url === URL_NEU), 'neu gemeldet und schon übernommen: erledigt')
const wvOhneSeit = await rechneEinen(wvAlt, disney([{ url: URL_ALT, titel: 'Alt' }]))
pruefe(wvOhneSeit.titel === 0, 'dieselbe alte Meldung bei einem Ziel ohne seit: erledigt (der Unterschied ist das seit)')

console.log('Staffeln bleiben erhalten')
const netflix: Anbieter = {
  name: 'Netflix',
  plattform: 'netflix',
  offen: 2,
  gesamt: 10,
  gemeldet: 0,
  ziele: [{ url: URL_STAFFELN, titel: 'Dr. STONE', staffeln: [1, 2] }],
}
const staffel = (nr: number): Zeile => ({
  plattform: 'netflix',
  url: URL_STAFFELN,
  staffel: nr,
  uebernommen: 0,
  gemeldet_am: VOR_PRUEFSTAND,
})
const einStaffel = (await rechnePruefstand([staffel(1)], [netflix], ERZEUGT)).anbieter[0]
pruefe(einStaffel.titel === 1, 'nur Staffel 1 im Briefkasten: Ziel bleibt offen')
const beide = (await rechnePruefstand([staffel(1), staffel(2)], [netflix], ERZEUGT)).anbieter[0]
pruefe(beide.titel === 0, 'beide Staffeln im Briefkasten: erledigt')

console.log(fehler ? `\n${fehler} Fehler` : '\nalles ok')
process.exit(fehler ? 1 : 0)
