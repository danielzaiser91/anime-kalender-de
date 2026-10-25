/**
 * **Eine erneute Messung mit demselben Nein erneuert das Messdatum** (24.10.2026).
 *
 * Ein Nein („dort nicht verfügbar", „ohne deutschen Ton") kommt nach `NEIN_FRIST_TAGE` Tagen zur Wiedervorlage
 * (`shared/nein-wiedervorlage.ts`), gerechnet ab `checkedAt` des jüngsten Belegs. `neueBelegBloecke()` vergleicht
 * ohne `checkedAt` und warf eine gleichlautende Meldung deshalb weg: Die Wiedervorlage blieb nach jedem „nichts da?"
 * bestehen (Disney+: Fire Force, One-Punch Man und vier weitere, 24.10.2026). Hier wird das Datum des vorhandenen
 * Nein-Belegs im Text nachgezogen; angehängt wird weiter nichts.
 *
 * Nur wenn das Nein das jüngste Urteil seines Titels und Anbieters ist: Ein jüngeres oder gleich altes Ja hebt es
 * auf und darf durch eine Datumsänderung nicht wieder obenauf liegen.
 */
import yaml from 'js-yaml'
import { belegSchluessel, urteilVon } from './dub-confirmed.ts'

type Beleg = Record<string, unknown>

const istNein = (b: Beleg) => b.available === false || b.dub === false
const tag = (b: Beleg) => String(b.checkedAt ?? '').slice(0, 10)
const paar = (b: Beleg) => `${b.anilistId}|${b.platform}`

/** Zeilenindex, an dem je ein Beleg („- …" am Zeilenanfang) beginnt. */
const anfaenge = (zeilen: string[]) => zeilen.flatMap((z, i) => (z.startsWith('- ') ? [i] : []))

function lies(zeilen: string[]): Beleg | null {
  try {
    const roh = (yaml.load(zeilen.join('\n')) as unknown[] | null)?.[0]
    return roh && typeof roh === 'object' ? (roh as Beleg) : null
  } catch {
    return null
  }
}

/** Je Schlüssel das jüngste Datum der neuen Nein-Belege. */
function neueNein(stapel: (Beleg | null)[]): Map<string, string> {
  const raus = new Map<string, string>()
  for (const b of stapel) {
    if (!b || !istNein(b)) continue
    const k = belegSchluessel(b)
    if (tag(b) > (raus.get(k) ?? '')) raus.set(k, tag(b))
  }
  return raus
}

/** Die gelesenen Belege eines Zeilenstapels, ein Eintrag je „- “-Block (`null` = unlesbar). */
function leseBloecke(zeilen: string[]): (Beleg | null)[] {
  const von = anfaenge(zeilen)
  return von.map((start, n) => lies(zeilen.slice(start, von[n + 1] ?? zeilen.length)))
}

/** Das jüngste Ja (`urteilVon`, wie der Bau es rechnet) je Titel und Anbieter, aus Bestand und Stapel. */
function juengsteJa(belege: (Beleg | null)[]): Map<string, string> {
  const ja = new Map<string, string>()
  for (const b of belege) {
    if (b && urteilVon(b) === 'ja' && tag(b) > (ja.get(paar(b)) ?? '')) ja.set(paar(b), tag(b))
  }
  return ja
}

/** Setzt `checkedAt` im Block auf `datum`; Einrückung bleibt, Anführungszeichen werden einfach. */
function ersetzeDatum(block: string[], datum: string): string[] {
  return block.map((z) => (/^\s+checkedAt:/.test(z) ? `${/^\s+/.exec(z)![0]}checkedAt: '${datum}'` : z))
}

export function erneuereNeinDatum(alt: string, zeilen: string[]): { text: string; erneuert: number } {
  const stapel = leseBloecke(zeilen)
  const neu = neueNein(stapel)
  if (!neu.size) return { text: alt, erneuert: 0 }
  const text = alt.split('\n')
  const von = anfaenge(text)
  const bloecke = von.map((start, n) => ({ start, ende: von[n + 1] ?? text.length }))
  const gelesen = bloecke.map((b) => lies(text.slice(b.start, b.ende)))
  const ja = juengsteJa([...gelesen, ...stapel])
  let erneuert = 0
  gelesen.forEach((b, n) => {
    const datum = b ? neu.get(belegSchluessel(b)) : undefined
    if (!b || !datum || datum <= tag(b) || (ja.get(paar(b)) ?? '') >= tag(b)) return
    const { start, ende } = bloecke[n]!
    text.splice(start, ende - start, ...ersetzeDatum(text.slice(start, ende), datum))
    erneuert++
  })
  return { text: text.join('\n'), erneuert }
}
