/**
 * Pendeln des Bestandsbaus: Wechseln aufeinanderfolgende Historie-Zeilen zwischen genau zwei Ständen (18./19.10.2026: 18 Zeilen
 * zwischen 1999 und 2036 Urteilen), ist das EIN Befund und nicht ein Verlust/Gewinn je Zeile. Endet das Pendeln, zählt nur der
 * Netto-Unterschied gegen den Stand vor dem Pendeln.
 */
import { findeAuffaelliges, type Kennzahlen } from './bestand-delta.ts'
import type { HistorieZeile } from './historie-zeilen.ts'

export interface Pendel {
  /** Erste und letzte Zeile des Pendelns (Indizes in der Zeilenliste). */
  von: number
  bis: number
  /** Übergänge zwischen den Zeilen von `von` bis `bis`. */
  wechsel: number
  /** Index der Zeile vor dem Pendeln, -1 am Dateianfang. */
  davor: number
}

export type Ereignis =
  | { art: 'zeile'; zeile: HistorieZeile; auffaellig: string[]; erklaert: string[]; netto: boolean }
  | { art: 'pendel'; pendel: Pendel; text: string; laufend: boolean; zeitpunkt: string }

const zahl = (z: HistorieZeile, feld: string) => String(z[feld] ?? '?')
const standText = (z: HistorieZeile) => `${zahl(z, 'mitUrteil')} Urteile, ${zahl(z, 'titelMitSynchro')} Titel mit Synchro`

/** Urteile, die so nah beieinander liegen, gelten als derselbe Stand: Im echten Pendeln (18.10.) wanderten beide Stände um 1–3 Urteile, die Schwingung maß 37. */
export const TOLERANZ = 5
const nah = (a: number, b: number) => Math.abs(a - b) <= TOLERANZ

/** Läufe von mindestens drei Zeilen A,B,A,B…, in denen jede Zeile (bis auf die Toleranz) den Stand der übernächsten wiederholt und sich vom Nachbarn abhebt.
 * Beide Stände bleiben innerhalb der Toleranz ihres Anfangsstands; wandern sie weiter (je Zyklus -5), ist das eine Drift, kein Pendeln. */
export function findePendel(zeilen: HistorieZeile[]): Pendel[] {
  const k = zeilen.map((z) => Number(z.mitUrteil))
  const kehrtZurueck = (n: number) => nah(k[n], k[n - 2]) && !nah(k[n], k[n - 1])
  const gefunden: Pendel[] = []
  let i = 2
  while (i < zeilen.length) {
    if (!kehrtZurueck(i)) {
      i++
      continue
    }
    const von = i - 2
    let bis = i
    const amAnfang = (n: number) => nah(k[n], k[von + ((n - von) % 2)])
    while (bis + 1 < zeilen.length && kehrtZurueck(bis + 1) && amAnfang(bis + 1)) bis++
    gefunden.push({ von, bis, wechsel: bis - von, davor: von - 1 })
    i = bis + 3
  }
  return gefunden
}

const kz = (z: HistorieZeile) => z as unknown as Kennzahlen
const strs = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : [])
const uhr = (iso: unknown) => new Date(String(iso)).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Teilpendel, die lückenlos aneinanderstoßen (langsame Drift: die Stände wandern je Zyklus weiter), bilden eine Kette; zurück bis zu ihrem ersten Glied. */
function kette(pendel: Pendel[], p: Pendel): Pendel[] {
  const glieder = [p]
  for (let q = pendel.find((x) => x.bis === p.von - 1); q; q = pendel.find((x) => x.bis === q.von - 1)) glieder.unshift(q)
  return glieder
}

/** Gesamtverlust der Kette (nur bei mindestens zwei Teilpendeln und bekanntem Stand davor): Urteile vor der Kette gegen die Zeile nach ihrem Ende. */
function kettenText(zeilen: HistorieZeile[], glieder: Pendel[], ende: Pendel): string {
  const davor = glieder[0].davor
  if (glieder.length < 2 || davor < 0) return ''
  const von = Number(zeilen[davor].mitUrteil)
  const nach = Number(zeilen[Math.min(ende.bis + 1, zeilen.length - 1)].mitUrteil)
  const d = nach - von
  return `; Kette aus ${glieder.length} Teilpendeln seit ${uhr(zeilen[glieder[0].von].zeitpunkt)}: ${von} -> ${nach} Urteile (${d > 0 ? '+' : ''}${d}) gegen den Stand davor`
}

function pendelText(zeilen: HistorieZeile[], p: Pendel, laufend: boolean, glieder: Pendel[]): string {
  const zwischen = `zwischen ${standText(zeilen[p.von])} und ${standText(zeilen[p.von + 1])} (${p.wechsel} Wechsel)`
  const kopf = laufend ? `pendelt seit ${uhr(zeilen[p.von].zeitpunkt)} ${zwischen}` : `pendelte von ${uhr(zeilen[p.von].zeitpunkt)} bis ${uhr(zeilen[p.bis].zeitpunkt)} ${zwischen}`
  return kopf + kettenText(zeilen, glieder, p)
}

/** Die Zeilen der Historie als Ereignisse: Pendeln als eines, die Zeile nach dem Pendeln netto gegen den Stand davor, alle anderen wie gespeichert. */
export function ereignisse(zeilen: HistorieZeile[]): Ereignis[] {
  const pendel = findePendel(zeilen)
  const aus: Ereignis[] = []
  let i = 0
  while (i < zeilen.length) {
    const p = pendel.find((x) => x.von === i)
    if (p) {
      const laufend = p.bis === zeilen.length - 1
      aus.push({ art: 'pendel', pendel: p, text: pendelText(zeilen, p, laufend, kette(pendel, p)), laufend, zeitpunkt: String(zeilen[p.bis].zeitpunkt) })
      i = p.bis + 1
      continue
    }
    const ende = pendel.find((x) => x.bis === i - 1)
    const bezug = ende ? kette(pendel, ende)[0].davor : -1
    if (bezug >= 0) {
      const b = findeAuffaelliges(kz(zeilen[i]), kz(zeilen[bezug]))
      aus.push({ art: 'zeile', zeile: zeilen[i], auffaellig: b.auffaellig, erklaert: b.erklaert, netto: true })
    } else {
      aus.push({ art: 'zeile', zeile: zeilen[i], auffaellig: strs(zeilen[i].auffaellig), erklaert: strs(zeilen[i].erklaert), netto: false })
    }
    i++
  }
  return aus
}
