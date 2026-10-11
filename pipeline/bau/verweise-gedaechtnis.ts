import { adressKern } from '../lib/dub-confirmed.ts'
import { type EntfernterVerweis } from './grundlagen.ts'

type TitelMitWegen = { streams?: { url: string }[] }

const schluessel = (e: { titleId?: number; plattform?: string; url?: string }) =>
  `${e.titleId}|${e.plattform}|${adressKern(e.url)}`

/** Alte Einträge, die der Bau in die neue Datei mitnimmt: Frist läuft, dieser Lauf hat sie nicht selbst geschrieben, Adresse nicht im Datensatz. */
export function uebernommeneVerweise(
  alt: EntfernterVerweis[],
  neu: EntfernterVerweis[],
  titel: TitelMitWegen[],
  grenze: string,
): EntfernterVerweis[] {
  const schonDa = new Set(neu.map(schluessel))
  const imBestand = new Set<string>()
  for (const t of titel) for (const st of t.streams ?? []) imBestand.add(adressKern(st.url))
  return alt.filter(
    (e) => (e.entferntAm ?? '') >= grenze && !schonDa.has(schluessel(e)) && !imBestand.has(adressKern(e.url)),
  )
}
