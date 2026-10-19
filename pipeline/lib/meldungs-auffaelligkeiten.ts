/**
 * Auffälligkeiten der Browser-Meldungen (19.10.2026): welche Folgenzahl ein Befund ist und wie die Datei
 * `data/meldungs-auffaelligkeiten.json` geführt wird.
 *
 * Weniger Folgen als der Titel ist bei keinem Anbieter ein Befund: Die Seite zeigt eine Staffel, der Titel ist die
 * ganze Serie (669 von 762 Einträgen am 19.10., vor allem Prime und Disney+). Mehr Folgen bleibt verdächtig.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { anzeigeName } from '../../shared/titles.ts'

export type Auffaelligkeit = { am: string; text: string }

type Benennbar = { id: number; titleDe?: string; titleEn?: string; titleRomaji?: string }

export function folgenzahlIstBefund(gemeldet: number, episodes: number | undefined): boolean {
  if (!episodes) return false
  return gemeldet - episodes > Math.max(2, episodes * 0.25)
}

/** „Titel 123 (Name)“: die Kennung bleibt, der Name erspart das Nachschlagen. */
export function titelMitName(id: number, liste: Benennbar[]): string {
  const t = liste.find((x) => x.id === id)
  return t ? `Titel ${id} (${anzeigeName(t)})` : `Titel ${id}`
}

/** Momentaufnahme: nur was der Lauf jetzt erzeugt; ein bekannter Text behält sein Datum. */
export function momentaufnahme(neu: string[], bisher: Auffaelligkeit[], heute: string): Auffaelligkeit[] {
  const alt = new Map(bisher.map((x) => [x.text, x.am]))
  return [...new Set(neu)].map((text) => ({ am: alt.get(text) ?? heute, text }))
}

export function warnungsText(anzahl: number): string {
  return `${anzahl} Meldung(en) auffällig, siehe data/meldungs-auffaelligkeiten.json`
}

/** Schreibt die Momentaufnahme (auch leer: Der Lauf sah nichts mehr) und gibt sie zurück. */
export function schreibeAuffaelligkeiten(datei: string, neu: string[], heute: string): Auffaelligkeit[] {
  const bisher = existsSync(datei) ? (JSON.parse(readFileSync(datei, 'utf8')) as Auffaelligkeit[]) : []
  const jetzt = momentaufnahme(neu, bisher, heute)
  writeFileSync(datei, JSON.stringify(jetzt, null, 2) + '\n')
  return jetzt
}
