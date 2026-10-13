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
import type { KartenDaten } from './og-karte.ts'

/** Belegte Titel (`belegtCount`), auf Hunderter abgerundet: Ein neuer Titel soll nicht jedes Mal ein neues Bild (und einen Commit) auslösen. */
export function titelzahlText(belegtCount: number): string {
  const rund = Math.floor(belegtCount / 100) * 100
  return `über ${rund.toLocaleString('de-DE')} mit Synchro`
}

/**
 * Keine Plattform-Chips: „Streaming, Disc, Kino, TV" nennt schon, wo die Termine stehen; eine
 * Rangliste einzelner Anbieter würde das wiederholen und mit jedem Datenlauf wandern.
 */
export function standardKarte(belegtCount: number): KartenDaten {
  return {
    title: 'Anime-Kalender DE',
    subtitle: 'Alles mit deutscher Synchro, Woche für Woche',
    lines: [
      { label: 'Anime', value: titelzahlText(belegtCount) },
      { label: 'Termine', value: 'Streaming, Disc, Kino, TV' },
      { label: 'Abo', value: 'Kalender und Newsletter' },
    ],
    badges: [],
    accent: '#ff5a36',
  }
}

/** Fingerabdruck aller Eingaben des Bilds samt Gestaltungsfassung. */
export function standardKennung(karte: KartenDaten): string {
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
