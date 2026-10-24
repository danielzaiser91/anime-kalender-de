/**
 * **Abgelehnte Meldungen protokollieren** (11.10.2026).
 *
 * Am 11.10.2026 kamen Netflix-Meldungen als „bestätigt 0" an (HTTP 200, jeder Eintrag `ok: false`),
 * und im Worker stand nirgends, warum. Jetzt schreibt jede Ablehnung eine Zeile für
 * `wrangler tail` und die Workers Logs: Route, Status, Grund, Plattform, Kennung.
 *
 * **Datenschutz:** Plattform und Kennung (letzter Pfadabschnitt der Titeladresse, z. B. die
 * Netflix-Titelnummer) benennen einen Titel, keine Person. Nie ins Protokoll: Token, Adresse samt
 * Suchteil, Titel, Notiz, Browserkennung, IP.
 */
import { kurzeMeldung } from './werte.ts'
import { EXPORT_PAUSE_TEXT, istD1Export } from './d1-limit.ts'

export type Ablehnung = { status: number; grund: string; fehler?: string }

/** Letzter Pfadabschnitt der Adresse ohne Suchteil: bei Netflix die Titelnummer, bei Prime die ASIN. */
export function kennungAus(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const pfad = url.split(/[?#]/)[0] ?? ''
  const letzter = pfad.split('/').filter(Boolean).pop() ?? ''
  const kennung = /^[\w-]{1,40}$/.test(letzter) && !letzter.includes('.') ? letzter : ''
  return kennung || null
}

/**
 * Die Kennung fürs Protokoll: zuerst die Seite, auf der gelesen wurde (`seiten_kennung`, bei Prime die ASIN).
 * Ein Suchauftrag schickt als `url` die Suchadresse (`amazon.de/s?k=…`), deren letzter Abschnitt „s“ ist
 * (Log vom 16.10.2026: `kennung: "s"` für B00LDDJYB4); sie benennt keinen Titel.
 */
export function kennungDerMeldung(m: Record<string, unknown>): string | null {
  const seite = kennungAus(m.seiten_kennung)
  if (seite) return seite
  return m.url === m.suchUrl ? null : kennungAus(m.url)
}

/**
 * Grund einer Ausnahme: der Fehlername für die Erweiterung, die gekürzte Meldung nur fürs Protokoll.
 * Ein laufender D1-Export ist vorübergehend: 503 mit dem Satz zum Wiederholen statt 500.
 */
export function ausnahmeAls(e: unknown): Ablehnung {
  if (istD1Export(e)) return { status: 503, grund: EXPORT_PAUSE_TEXT, fehler: kurzeMeldung(e) }
  const name = (e as Error)?.name ?? 'Fehler'
  return { status: 500, grund: `ausnahme ${name}`, fehler: kurzeMeldung(e) }
}

/** 403 für ein fehlendes oder falsches Token; das Token selbst kommt nie ins Protokoll. */
export function nichtErlaubt(antwort: (body: unknown, status?: number) => Response): Response {
  ablehnungLoggen('pruefung', { status: 403, grund: 'Token fehlt oder falsch' })
  return antwort({ error: 'Nicht erlaubt' }, 403)
}

export function ablehnungLoggen(route: string, ablehnung: Ablehnung, meldung?: unknown) {
  const m = (meldung && typeof meldung === 'object' ? meldung : {}) as Record<string, unknown>
  const zeile = JSON.stringify({
    ereignis: 'meldung_abgelehnt',
    route,
    status: ablehnung.status,
    grund: ablehnung.grund,
    fehler: ablehnung.fehler,
    plattform: typeof m.plattform === 'string' ? m.plattform.slice(0, 20) : undefined,
    kennung: kennungDerMeldung(m) ?? undefined,
  })
  if (ablehnung.status >= 500) console.error(zeile)
  else console.warn(zeile)
}
