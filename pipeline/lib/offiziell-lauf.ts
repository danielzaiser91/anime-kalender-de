/**
 * Ein Lauf des Sammlers: die fälligen Hosts in zwei Stufen lesen (erst Feed, WordPress-REST und JSON, dann HTML), Stand fortschreiben, Vorschläge sammeln.
 * Ohne Dateizugriff und mit eingesteckter Uhr, damit die Prüfung Fristen und Fälligkeit ohne Netz und ohne Warten nachrechnet.
 */
import type { Holer } from './offiziell-abruf.ts'
import { leseHost } from './offiziell-abruf.ts'
import { hostSchluessel, type Seite } from './offiziell-seiten.ts'
import { faelligeSeiten, type Stand } from './offiziell-stand.ts'
import { kandidaten, type Vorschlag } from './offiziell-vorschlaege.ts'

export interface LaufEinstellung {
  jetzt: Date
  /** Höchstens so viele Hosts je Lauf (kleine Blöcke). */
  grenze: number
  /** Nach dieser Zeit (Millisekunden der `uhr`) beginnt der Lauf keinen weiteren Host. */
  ende: number
  uhr: () => number
  /** Ausdrücklich genannte Hosts lesen, gleich ob fällig. */
  hosts?: string[]
}

export interface LaufErgebnis {
  stand: Stand
  neu: Vorschlag[]
  gelesen: number
  zeilen: string[]
  uebrig: number
}

/** Stufe 1 (maschinenlesbar) vor Stufe 2 (HTML); innerhalb der Stufe bleibt die Reihenfolge der Fälligkeit. */
export const inStufen = (seiten: Seite[]): Seite[] => [...seiten.filter((s) => s.muster !== 'html'), ...seiten.filter((s) => s.muster === 'html')]

export async function lauf(
  seiten: Seite[],
  stand: Stand,
  titel: Map<string, number[]>,
  e: LaufEinstellung,
  holer: Holer,
  schlafen: (ms: number) => Promise<void>,
): Promise<LaufErgebnis> {
  const heute = e.jetzt.toISOString().slice(0, 10)
  const gewaehlt = e.hosts ? seiten.filter((s) => e.hosts!.includes(s.host)) : faelligeSeiten(seiten, stand, e.jetzt, e.grenze)
  const ergebnis: LaufErgebnis = { stand: { hosts: { ...stand.hosts } }, neu: [], gelesen: 0, zeilen: [], uebrig: 0 }
  const reihe = inStufen(gewaehlt)
  for (const [i, seite] of reihe.entries()) {
    if (e.uhr() > e.ende) {
      ergebnis.uebrig = reihe.length - i
      break
    }
    const lesung = await leseHost(seite, ergebnis.stand.hosts[seite.host], e.jetzt, holer, schlafen)
    ergebnis.stand.hosts[seite.host] = lesung.stand
    const gefunden = kandidaten(seite, lesung.eintraege, titel.get(hostSchluessel(seite.host)) ?? [], heute)
    ergebnis.neu.push(...gefunden)
    ergebnis.gelesen += lesung.eintraege.length
    ergebnis.zeilen.push(`${seite.host.padEnd(34)} ${seite.muster.padEnd(5)} ${(lesung.stand.ausgang ?? '').padEnd(8)} ${String(lesung.eintraege.length).padStart(3)} Meldungen, ${gefunden.length} relevant`)
  }
  return ergebnis
}
