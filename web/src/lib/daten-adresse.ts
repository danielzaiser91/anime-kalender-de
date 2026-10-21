/**
 * Adresse einer Datendatei mit der Inhalts-Kennung dieser Datei (`tools/daten-kennungen.ts`): die Datei selbst, sonst ihr Ordner,
 * sonst `ersatz` (Entwicklungsserver, nicht erfasste Datei). Unveränderte Dateien behalten ihre Adresse und bleiben in Browser-
 * und Service-Worker-Cache stehen.
 */
export function datenAdresse(basis: string, pfad: string, kennungen: Record<string, string>, ersatz: string): string {
  const ordner = pfad.includes('/') ? `${pfad.split('/')[0]}/` : ''
  return `${basis}data/${pfad}?v=${kennungen[pfad] ?? kennungen[ordner] ?? ersatz}`
}
