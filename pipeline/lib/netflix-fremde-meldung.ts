/**
 * Netflix-Rohfolgen unter der falschen Adresse (Barbie unter The Loud House, 13.10.2026).
 *
 * Die Erweiterung hat nach einem Titelwechsel die Folgen der vorigen Seite unter der neuen Adresse gemeldet
 * (`extension/netflix-seitentreue.js`). Die Zeilen liegen in `prime_folge` und lassen sich dort nicht löschen
 * (kein Einmal-SQL); `data/netflix-fremde-meldungen.json` führt sie, der Bau hakt sie ab, ohne sie zuzuordnen.
 * Der Wächter `doppelteNetflixKennungen` meldet, was die Liste noch nicht kennt.
 */
import { existsSync, readFileSync } from 'node:fs'
import { ROOT } from './util.ts'

/** Ein Eintrag der Sperrliste: alle Zeilen unter `url` mit einer dieser Staffelkennungen oder gti sind fremd. */
export type FremdeMeldung = {
  url: string
  richtig: string
  kennungen?: string[]
  gti?: string[]
  beleg: string
}

type Zeile = { id: number; url: string; plattform?: string | null; gti?: string | null; staffel_text?: string | null }

/** Eine Test-Kulisse ohne die Datei hat nichts zu sperren; dass die echte Datei da ist, sichert `check-netflix-fremde-meldung.ts`. */
export function ladeFremdeMeldungen(wurzel: string = ROOT): FremdeMeldung[] {
  const pfad = `${wurzel}/data/netflix-fremde-meldungen.json`
  return existsSync(pfad) ? (JSON.parse(readFileSync(pfad, 'utf8')) as FremdeMeldung[]) : []
}

/** Netflix' Staffelkennung im Menütext-Feld: nur Ziffern, sonst steht dort der Menütext („Staffel 2 …“). */
const ISTKENNUNG = /^\d{6,}$/

function istNetflix(f: Zeile): boolean {
  return f.plattform === 'netflix' || /netflix\.com\/title\//.test(f.url)
}

export function istFremd(f: Zeile, sperre: FremdeMeldung[]): boolean {
  return sperre.some(
    (e) => e.url === f.url && ((f.staffel_text != null && (e.kennungen ?? []).includes(f.staffel_text)) || (f.gti != null && (e.gti ?? []).includes(String(f.gti)))),
  )
}

/** Die Zeilen ohne die fremden; `verworfen` sind deren Kennungen (werden abgehakt, nicht zugeordnet). */
export function ohneFremdeNetflixMeldungen<T extends Zeile>(folgen: T[], sperre: FremdeMeldung[]): { folgen: T[]; verworfen: number[] } {
  const verworfen = folgen.filter((f) => istFremd(f, sperre)).map((f) => f.id)
  if (!verworfen.length) return { folgen, verworfen }
  const weg = new Set(verworfen)
  return { folgen: folgen.filter((f) => !weg.has(f.id)), verworfen }
}

function adressenJe(folgen: Zeile[], schluessel: (f: Zeile) => string | null): Map<string, Set<string>> {
  const je = new Map<string, Set<string>>()
  for (const f of folgen.filter(istNetflix)) {
    const k = schluessel(f)
    if (k) je.set(k, (je.get(k) ?? new Set()).add(f.url))
  }
  return je
}

/** Wächter: dieselbe Staffelkennung oder Folge (gti) unter zwei Netflix-Adressen. Eine Zeile je Befund. */
export function doppelteNetflixKennungen(folgen: Zeile[]): string[] {
  const kennung = adressenJe(folgen, (f) => (f.staffel_text && ISTKENNUNG.test(f.staffel_text) ? f.staffel_text : null))
  const gti = adressenJe(folgen, (f) => (f.gti ? String(f.gti) : null))
  const befund = (art: string, je: Map<string, Set<string>>) =>
    [...je].filter(([, urls]) => urls.size > 1).map(([k, urls]) => `${art} ${k} unter ${[...urls].sort().join(' und ')}`)
  return [...befund('Staffelkennung', kennung), ...befund('Folge (gti)', gti)]
}
