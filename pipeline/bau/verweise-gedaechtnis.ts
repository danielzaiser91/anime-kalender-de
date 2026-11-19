import { adressKern } from '../lib/dub-confirmed.ts'
import { NUR_DIESER_TITEL, type EntfernterVerweis } from './grundlagen.ts'

type TitelMitWegen = { id: number; streams?: { url: string }[] }

const schluessel = (e: { titleId?: number; plattform?: string; url?: string }) =>
  `${e.titleId}|${e.plattform}|${adressKern(e.url)}`

/**
 * Alte Einträge, die der Bau in die neue Datei mitnimmt: Frist läuft, dieser Lauf hat sie nicht selbst geschrieben,
 * und die Adresse steht nicht im Datensatz. Ein titelgebundenes Urteil (Princess Principal Kapitel 3/4 an der
 * Serienadresse) zählt nur, wenn der Titel selbst die Adresse trägt — sonst fiele es wegen der Geschwister
 * heraus und käme im nächsten Bau zurück: die Datei flatterte von Bau zu Bau.
 */
export function uebernommeneVerweise(
  alt: EntfernterVerweis[],
  neu: EntfernterVerweis[],
  titel: TitelMitWegen[],
  grenze: string,
): EntfernterVerweis[] {
  const schonDa = new Set(neu.map(schluessel))
  const imBestand = new Set<string>()
  for (const t of titel) {
    for (const st of t.streams ?? []) {
      imBestand.add(adressKern(st.url))
      imBestand.add(`${t.id}|${adressKern(st.url)}`)
    }
  }
  const imBestandFuer = (e: EntfernterVerweis) =>
    imBestand.has(NUR_DIESER_TITEL.test(e.grund ?? '') ? `${e.titleId}|${adressKern(e.url)}` : adressKern(e.url))
  return alt.filter((e) => (e.entferntAm ?? '') >= grenze && !schonDa.has(schluessel(e)) && !imBestandFuer(e))
}

/** Zeitstempel nur erneuern, wenn sich die Verweise ändern — sonst ändert jeder Bau die Datei. */
export function neuerStand(alt: { stand?: string; verweise?: EntfernterVerweis[] }, verweise: EntfernterVerweis[]): string {
  const gleich = alt.stand && JSON.stringify(alt.verweise) === JSON.stringify(verweise)
  return gleich ? alt.stand! : new Date().toISOString()
}

export interface GedaechtnisDatei {
  stand?: string
  verweise?: EntfernterVerweis[]
  /** Per Handbeleg gestrichene Wege (`beleg-wege-protokoll.ts`): nur fürs Wachprotokoll, nie Sperre. */
  belegWege?: EntfernterVerweis[]
}

/** Inhalt von `data/verweise-entfernt.json` nach diesem Lauf: Verweise und Beleg-Wege je mit ihrer Frist, `stand` nur bei Änderung. */
export function gedaechtnisAusgabe(
  alt: GedaechtnisDatei,
  neu: EntfernterVerweis[],
  belegNeu: EntfernterVerweis[],
  titel: TitelMitWegen[],
  grenze: string,
): { stand: string; verweise: EntfernterVerweis[]; belegWege?: EntfernterVerweis[] } {
  const verweise = [...neu, ...uebernommeneVerweise(alt.verweise ?? [], neu, titel, grenze)]
  const belegWege = [...belegNeu, ...uebernommeneVerweise(alt.belegWege ?? [], belegNeu, titel, grenze)]
  const belegGleich = JSON.stringify(alt.belegWege ?? []) === JSON.stringify(belegWege)
  return {
    stand: belegGleich ? neuerStand(alt, verweise) : new Date().toISOString(),
    verweise,
    ...(belegWege.length ? { belegWege } : {}),
  }
}
