/**
 * Inhalt und Kennung des Standard-Vorschaubilds (`public/og/default.jpg`).
 *
 * Das Bild trägt die Titelzahl. Es wird neu gezeichnet, sobald sich seine Eingaben ändern (Kennung
 * neben der Datei in `public/og/default.txt`), und die Seiten hängen dieselbe Kennung als `?v=` an
 * die Bildadresse — Messenger holen sonst das alte Bild zur alten Adresse (13.10.2026: Vorschau
 * zeigte „2.779 mit Synchro", der Bestand hatte 2.924).
 */
import { createHash } from 'node:crypto'
import { OG_FASSUNG } from './og-fassung.ts'


/** Belegte Titel (`belegtCount`), auf Hunderter abgerundet: Ein neuer Titel soll nicht jedes Mal ein neues Bild (und einen Commit) auslösen. */
export function titelzahlText(belegtCount: number): string {
  const rund = Math.floor(belegtCount / 100) * 100
  return `über ${rund.toLocaleString('de-DE')} Anime, Woche für Woche`
}

export interface StandardDaten {
  claim: string
  liste: string[]
}

/**
 * Die Aussagen des Standardbilds. Keine Plattformen und kein Datum: „Streaming, Disc, Kino und TV"
 * nennt schon, wo die Termine stehen, und eine Wochenleiste würde die Kennung jede Woche ändern.
 */
export function standardKarte(belegtCount: number): StandardDaten {
  return {
    claim: 'Alles mit deutscher Synchro',
    liste: [titelzahlText(belegtCount), 'Streaming, Disc, Kino und TV', 'Kalender-Abo und Newsletter'],
  }
}

/** Fingerabdruck aller Eingaben des Bilds samt Gestaltungsfassung. */
export function standardKennung(karte: StandardDaten): string {
  return createHash('sha1').update(OG_FASSUNG).update(JSON.stringify(karte)).digest('hex').slice(0, 8)
}

/** Zeichnen, wenn das Bild fehlt, erzwungen wird oder die abgelegte Kennung nicht mehr passt. */
export function mussNeuZeichnen(vorhanden: boolean, abgelegt: string | undefined, kennung: string, erzwungen: boolean): boolean {
  return erzwungen || !vorhanden || abgelegt?.trim() !== kennung
}

/** Kennung zum Bestand mit `belegtCount` belegten Titeln. */
export function standardKennungFuer(belegtCount: number): string {
  return standardKennung(standardKarte(belegtCount))
}

/** Bildadresse für `og:image`; die Kennung ersetzt die Gestaltungsfassung allein. */
export function standardBildAdresse(site: string, kennung: string): string {
  return `${site}og/default.jpg?v=${kennung}`
}
