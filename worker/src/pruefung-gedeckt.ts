/**
 * **Netflix-Ziele, deren offene Staffeln der Briefkasten schon deckt** (24.10.2026).
 *
 * Daniel: Statusanzeige „27 Titel“, Erweiterungsknopf „5“. Die Erweiterung hielt jede Reihe für erledigt, zu der jede offene
 * Staffel eine Meldung hat (`akNetflixStaffelnGedeckt`, `extension/netflix-uebernahme.js`), der Worker zog nur Meldungen
 * seit dem Prüfstand-Bau ab. Jetzt rechnet der Worker die Regel und nimmt solche Ziele aus `ziele`/`titel`; die Erweiterung
 * liest den Stand und zählt nur noch, was darin steht.
 *
 * D1: eine Abfrage für alle Netflix-Ziele, je Titel die eine Zeile `titel_zeile` (Folgen im Worker gelesen, wie bei
 * `?gemeldet=`), kein `json_each` über Folgen. Ohne Titelzeile oder bei Fehler gilt ein Ziel als nicht gedeckt.
 */
import { type Env } from './env.ts'
import { AM, lies, NUMMER, STAFFEL } from './titelzeile-format.ts'

export type GedecktZiel = { url: string; staffeln?: number[]; seit?: string }

/** Jede offene Staffel hat mindestens eine Meldung ab der Wiedervorlage (`seit`); ohne jede Meldung nie. */
export function istGedeckt(ziel: GedecktZiel, paare: { staffel: number; am: string | null }[]): boolean {
  const neue = paare.filter((p) => String(p.am ?? '') >= (ziel.seit ?? ''))
  if (!neue.length) return false
  return (ziel.staffeln ?? []).every((nr) => neue.some((p) => p.staffel === nr))
}

export async function gedeckteZiele(env: Env, ziele: GedecktZiel[]): Promise<Set<string>> {
  const gedeckt = new Set<string>()
  if (!ziele.length) return gedeckt
  try {
    const { results } = await env.DB.prepare('SELECT url, daten FROM titel_zeile WHERE url IN (SELECT value FROM json_each(?1))')
      .bind(JSON.stringify(ziele.map((z) => z.url)))
      .all<{ url: string; daten: string }>()
    for (const zeile of results ?? []) {
      const ziel = ziele.find((z) => z.url === zeile.url)
      const paare = lies(zeile.daten)
        .f.filter((e) => e[NUMMER] !== null)
        .map((e) => ({ staffel: e[STAFFEL] ?? 1, am: e[AM] }))
      if (ziel && istGedeckt(ziel, paare)) gedeckt.add(zeile.url)
    }
  } catch {
    /* Ohne Auskunft bleibt offen, was nicht gelesen wurde: lieber einmal zu viel prüfen. */
  }
  return gedeckt
}

/** Die Netflix-Ziele des Prüfstands (`stand.anbieter`) in der Form für `gedeckteZiele`. */
export function netflixZiele(anbieter: unknown[] = []): GedecktZiel[] {
  const netflix = (anbieter as { plattform?: string; ziele?: GedecktZiel[] }[]).find((a) => a.plattform === 'netflix')
  return (netflix?.ziele ?? []).map((z) => ({ url: z.url, staffeln: z.staffeln, seit: z.seit }))
}
