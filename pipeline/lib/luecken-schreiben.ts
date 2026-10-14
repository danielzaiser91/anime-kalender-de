import { log, readJson, writeText } from './util.ts'
import { FELDER } from './luecken-felder.ts'
import { ladeKontext } from './luecken-kontext.ts'
import { feldMarkdown, uebersichtMarkdown, werteFeldAus, type Ergebnis, type Kontext } from './luecken-rahmen.ts'

/** Ablage außerhalb des Repos (`.git/info/exclude`): Arbeitslisten für Daniel, wie `banner-luecken.md` und `cover-ohne-tmdb.md`. */
export const LUECKEN_ORDNER = 'daniel-zum-abarbeiten/listen/luecken'

/** Gegenprobe gegen `data/luecken-titel.json` (Bau): dieselben Felder müssen dieselben Zahlen ergeben. */
export function gegenprobe(ergebnisse: Ergebnis[], titel: Record<string, string> | undefined): string[] {
  const vergleich: [string, string][] = [
    ['titel-de.md', 't'],
    ['jahr.md', 'j'],
    ['cover-sd.md', 'c'],
  ]
  const abweichungen: string[] = []
  for (const [datei, kuerzel] of vergleich) {
    const e = ergebnisse.find((x) => x.feld.datei === datei)
    const erwartet = Object.values(titel ?? {}).filter((f) => f.includes(kuerzel)).length
    const gezaehlt = (e?.a.length ?? 0) + (e?.b.length ?? 0)
    if (titel && gezaehlt !== erwartet) abweichungen.push(`${datei}: ${gezaehlt} statt ${erwartet} in luecken-titel.json`)
  }
  return abweichungen
}

/** Schreibt je Feld eine Datei und die Übersicht; liefert die Ergebnisse zurück. */
export function schreibeLueckenListen(heute: string, k: Kontext = ladeKontext(heute)): Ergebnis[] {
  const ergebnisse = FELDER.map((feld) => werteFeldAus(feld, k))
  for (const e of ergebnisse) writeText(`${LUECKEN_ORDNER}/${e.feld.datei}`, feldMarkdown(e, k))
  writeText(`${LUECKEN_ORDNER}/00-uebersicht.md`, uebersichtMarkdown(ergebnisse, k))
  const bau = readJson<{ titel?: { hb?: Record<string, string> } }>('data/luecken-titel.json', {})
  for (const a of gegenprobe(ergebnisse, bau.titel?.hb)) log(`Lückenlisten weichen ab: ${a}`)
  log(`Lückenlisten: ${ergebnisse.length} Felder nach ${LUECKEN_ORDNER}`)
  return ergebnisse
}
