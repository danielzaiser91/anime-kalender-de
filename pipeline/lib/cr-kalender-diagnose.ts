/**
 * Kurzdiagnose, wenn der Crunchyroll-Kalender keine Kachel liefert (26.10.2026: seit 21.10. stumm, und das Skript
 * hatte nichts protokolliert, woran sich Sperre von Umbau unterscheiden ließ). Nur sichtbarer Text und Merkmale,
 * nie Cookies, Header oder Adressen mit Token.
 */
import { recordSource } from './health.ts'
import { warn } from './util.ts'

export interface KalenderSeite {
  status?: number
  titel: string
  /** Sichtbarer Text der Seite (innerText), nicht das HTML. */
  text: string
  html: string
}

/** Merkmale der Cloudflare-Prüfseite im HTML. */
const CHALLENGE_MERKMALE = ['__cf_chl', 'challenge-form', 'cf-challenge', 'Just a moment', 'Einen Moment']

const TEXT_LAENGE = 200

function kurz(text: string): string {
  const flach = text.replace(/\s+/g, ' ').trim().replace(/[A-Za-z0-9_-]{40,}/g, '…')
  return flach.length > TEXT_LAENGE ? `${flach.slice(0, TEXT_LAENGE)}…` : flach
}

/** `lastError` landet über den Blocker in `public/data/blocker.json` und in der Statusanzeige: höchstens so viele Zeichen (26.10.2026, Prüfer 2125). */
export const FEHLER_LAENGE = 160

/** Fehlertext für `data/source-health.json`: die Woche mit der ersten Diagnose, auf `FEHLER_LAENGE` gekürzt; ohne Diagnose (kein Seitenabruf gelungen) der alte Satz. */
export function fehlerText(diagnosen: string[]): string {
  const grund = 'keine Kachel im Kalender gefunden'
  const text = diagnosen.length ? `${grund} — ${diagnosen[0]}` : grund
  return text.length > FEHLER_LAENGE ? `${text.slice(0, FEHLER_LAENGE - 1)}…` : text
}

/** Alle Wochen leer: Diagnose ins Log, Kurzfassung in die Quellengesundheit. Der Lauf bleibt grün (Daniel, 30.08.2026). */
export function meldeLeerenKalender(diagnosen: string[]): void {
  for (const d of diagnosen) warn(`Diagnose ${d}`)
  recordSource('crunchyroll', 0, fehlerText(diagnosen))
  warn('Keine Einträge gefunden — Seitenaufbau geändert oder Sperre? Bestehende Daten bleiben unangetastet.')
}

export function kalenderDiagnose(seite: KalenderSeite): string {
  const merkmale = CHALLENGE_MERKMALE.filter((m) => seite.html.includes(m) || seite.titel.includes(m))
  const challenge = merkmale.length ? `Challenge-Merkmale: ${merkmale.join(', ')}` : 'keine Challenge-Merkmale'
  const status = seite.status === undefined ? 'unbekannt' : String(seite.status)
  return `HTTP ${status}; Titel „${kurz(seite.titel)}“; ${challenge}; Text „${kurz(seite.text)}“`
}
