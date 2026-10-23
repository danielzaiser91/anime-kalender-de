/**
 * Grenzen des Website-Hostings auf Cloudflare Workers Static Assets (Plan `daniel-zum-abarbeiten/berichte/plan-cloudflare-hosting-2026-10-16.md`).
 *
 * - **Dateibudget:** Eine Worker-Version trägt höchstens 20.000 Dateien (Free, Doku workers/platform/limits, 17.10.2026).
 *   Über 15.000 wird gebündelt (`voices/`, `folgen/`), bevor die Grenze den Deploy bricht.
 * - **Nur Assets:** Die Website-Config hat weder `main` noch Bindings noch `run_worker_first`. Sonst läuft je Aufruf ein
 *   Worker und teilt sich die 100.000 Aufrufe/Tag des Kontos mit dem Newsletter-Worker (danach 429 statt Seite).
 *   Geprüft wird per Positivliste: jeder Schlüssel, der nicht ausdrücklich erlaubt ist, ist ein Fehler.
 */
import { readdirSync } from 'node:fs'
import { addDays } from '../shared/time.ts'

export const DATEIEN_BUDGET = 15_000
export const DATEIEN_GRENZE = 20_000
/** Zuwachs je Tag, gemessen 10.–17.10.2026 an `public/` auf origin/main (Gegenentwurf vom 17.10.2026). */
export const ZUWACHS_PRO_TAG = 73

/** Bewertung der Dateizahl in `dist/`: `ok` ist falsch über dem Budget; der Text nennt Zahl und Prognose. */
export function bewerteDateibudget(zahl: number, heute: string): { ok: boolean; text: string } {
  const prognose = (ziel: number) => {
    if (zahl >= ziel) return 'erreicht'
    return `≈ ${addDays(heute, Math.ceil((ziel - zahl) / ZUWACHS_PRO_TAG))}`
  }
  const text =
    `${zahl} Dateien in dist/ (Budget ${DATEIEN_BUDGET}, Grenze ${DATEIEN_GRENZE}); ` +
    `bei +${ZUWACHS_PRO_TAG}/Tag Budget ${prognose(DATEIEN_BUDGET)}, Grenze ${prognose(DATEIEN_GRENZE)}`
  return { ok: zahl <= DATEIEN_BUDGET, text }
}

/** Ergebnis des Laufs `tools/dateibudget.ts`: Exit-Code und Zeile (über dem Budget mit FEHL und Abhilfe). */
export function dateibudgetErgebnis(zahl: number, heute: string): { code: 0 | 1; zeile: string } {
  const { ok, text } = bewerteDateibudget(zahl, heute)
  if (ok) return { code: 0, zeile: `[dateibudget] ${text}` }
  return { code: 1, zeile: `[dateibudget] FEHL ${text} — vor dem nächsten Deploy bündeln (voices/, folgen/).` }
}

/** Dateien (nicht Ordner) unter `ordner`, rekursiv. */
export function zaehleDateien(ordner: string): number {
  return readdirSync(ordner, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).length
}

const ERLAUBT_OBEN = new Set(['$schema', 'name', 'compatibility_date', 'workers_dev', 'preview_urls', 'assets'])
const ERLAUBT_ASSETS = new Set(['directory', 'html_handling', 'not_found_handling'])

/** Fehler der Website-Config (leer = in Ordnung): nur erlaubte Schlüssel, eigener Name, echte 404. */
export function pruefeWebConfig(config: Record<string, unknown>): string[] {
  const fehler = Object.keys(config)
    .filter((k) => !ERLAUBT_OBEN.has(k))
    .map((k) => `Schlüssel „${k}“ nicht erlaubt (kein main, keine Bindings: die Website bleibt ohne Worker-Aufruf)`)
  const assets = (config.assets ?? {}) as Record<string, unknown>
  for (const k of Object.keys(assets).filter((k) => !ERLAUBT_ASSETS.has(k))) {
    fehler.push(`assets.${k} nicht erlaubt (kein run_worker_first, keine Assets-Bindung)`)
  }
  if (config.name !== 'anime-kalender-web') fehler.push(`name ist ${JSON.stringify(config.name)}, erwartet "anime-kalender-web"`)
  if (assets.directory !== './dist') fehler.push('assets.directory muss "./dist" sein')
  if (assets.not_found_handling !== '404-page') fehler.push('assets.not_found_handling muss "404-page" sein (sonst Soft-404)')
  return fehler
}

/** JSONC lesen: ganze Kommentarzeilen (`//`) fallen weg, der Rest ist JSON. */
export function leseJsonc(text: string): Record<string, unknown> {
  return JSON.parse(text.replace(/^\s*\/\/.*$/gm, '')) as Record<string, unknown>
}
