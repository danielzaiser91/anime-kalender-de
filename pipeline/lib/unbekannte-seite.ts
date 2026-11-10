/**
 * Meldungen aus dem Kasten „Nicht auf der Prüfliste" (F109 = A, 07.11.2026): eine Prime-Seite, die die Erweiterung keinem
 * Titel der Prüfliste zuordnet, trägt in der Notiz `unbekannt=1`. Der Bau ordnet sie über den Seitentitel zu
 * (`ratePerName` gegen `titles.json`; nur ein exakter Treffer auf genau einen Titel entscheidet selbst) oder legt sie mit
 * Grund in die Liste ohne Zuordnung. Nichts davon fällt still weg: jeder Ausgang wird gezählt (`Zaehler`) und steht im Log.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { titelSchluessel } from './zuordnung.ts'

export type Art = 'eindeutig' | 'mehrdeutig' | 'katalog' | 'keiner'

export interface Urteil {
  art: Art
  /** Kennungen, die die Liste als Vorschlag zeigt (Bestand, sonst Katalog ohne Synchro). */
  vorschlag: number[]
  zuTun: string
}

export type Zaehler = Record<Art | 'ueberAdresse', number>

export const neuerZaehler = (): Zaehler => ({ eindeutig: 0, mehrdeutig: 0, katalog: 0, keiner: 0, ueberAdresse: 0 })

/** Trägt eine der Notizen der Gruppe das Kennzeichen der Erweiterung? */
export const istUnbekannteSeite = (notizen: Array<string | null | undefined>): boolean => notizen.some((n) => /(^|[\s,])unbekannt=1(?=$|[\s,])/.test(n ?? ''))

/**
 * Titel, die nur im Katalog ohne Synchro stehen (`ohne-synchro-namen.json`), mit genau diesem Namen.
 * Ein Treffer dort ist nur ein Hinweis: das Werk ist bekannt, die Synchro noch nicht belegt.
 */
export function katalogTreffer(wurzel: string, name: string): number[] {
  const datei = resolve(wurzel, 'public/data/ohne-synchro-namen.json')
  const schluessel = name ? titelSchluessel(name) : ''
  if (!schluessel || !existsSync(datei)) return []
  const katalog = JSON.parse(readFileSync(datei, 'utf8')) as Array<{ id: number; titleDe?: string; titleEn?: string; titleRomaji?: string }>
  return [...new Set(katalog.filter((t) => [t.titleDe, t.titleEn, t.titleRomaji].some((n) => n && titelSchluessel(n) === schluessel)).map((t) => t.id))]
}

/**
 * Passt eine Seite ohne Auftrag zum Titel, dessen Name sie exakt trägt? Sonst der Grund (null = passt).
 * Der Name allein trennt kein Werk von Realfilm, Remake, Film gleichen Namens oder „Staffel 1" jeder Fortsetzung
 * (F109, Prüfer 3117 A1): Folgenzahl in derselben Toleranz wie die Staffelprüfung des Baus (÷/× 1,5), Film nur mit einer Folge,
 * und ein Titel in einer Reihe mit mehreren Einträgen ist ohne Staffelnummer nicht eindeutig.
 */
export function widerspruchZumTitel(gemeldet: number, titel: { episodes?: number; format?: string } | undefined, reihe: number): string | null {
  const soll = titel?.episodes ?? 0
  if (gemeldet > 0 && soll > 0 && (gemeldet > soll * 1.5 || gemeldet < soll / 1.5)) return `Seite nennt ${gemeldet} Folgen, der Titel hat ${soll}`
  if (gemeldet > 1 && titel?.format === 'MOVIE') return `Seite nennt ${gemeldet} Folgen, der Titel ist ein Film`
  if (reihe > 1) return `der Titel gehört zu einer Reihe mit ${reihe} Einträgen, die Staffel der Seite ist nicht bestimmt`
  return null
}

/** Was mit einer Meldung geschieht, die der Bestand nicht zuordnet. `bestand`: Treffer in titles.json, `katalog`: im Katalog, `grund`: warum ein exakter Name nicht reichte. */
export function urteileUnbekannt(bestand: number[], katalog: number[], grund: string | null = null): Urteil {
  if (bestand.length) {
    const zuTun = grund ? `Name stimmt, aber ${grund}: den richtigen Titel wählen, die Seite als Verweis eintragen` : 'Mehrere oder nur ähnliche Treffer: den richtigen Titel wählen, die Seite als Verweis eintragen'
    return { art: 'mehrdeutig', vorschlag: bestand, zuTun }
  }
  if (katalog.length) {
    return { art: 'katalog', vorschlag: katalog, zuTun: 'Titel steht im Katalog ohne Synchro: Seite als Verweis und Synchro-Beleg eintragen' }
  }
  return { art: 'keiner', vorschlag: [], zuTun: 'Kein Treffer im Bestand: Seite öffnen, Titel anlegen oder verwerfen' }
}

/** Die Zeile fürs Protokoll; leer, wenn keine Meldung aus dem Kasten kam. */
export function zaehlzeile(z: Zaehler): string {
  const n = z.eindeutig + z.mehrdeutig + z.katalog + z.keiner + z.ueberAdresse
  if (!n) return ''
  return (
    `Unbekannte Prime-Seiten: ${n} gemeldet — ${z.eindeutig} über den Namen zugeordnet, ${z.ueberAdresse} über die Adresse, ` +
    `${z.mehrdeutig} mehrdeutig, ${z.katalog} im Katalog ohne Synchro, ${z.keiner} ohne Treffer`
  )
}
