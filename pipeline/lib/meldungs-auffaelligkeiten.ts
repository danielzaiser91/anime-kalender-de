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

/**
 * Trifft ein bisheriger Befund am geladenen Bestand noch zu? Ein Eintrag lebt so lange wie sein Befund, nicht bis zum
 * Abhaken seiner Meldung. Unlesbarer Text gilt als erledigt.
 */
export function trifftNochZu(
  text: string,
  liste: Array<{ id: number; episodes?: number }>,
  staffelNr: (id: number) => number | undefined,
): boolean {
  const folgen = /: (\d+) Folgen gemeldet, Titel (-?\d+)(?: \(.*?\))? hat \d+ \(/.exec(text)
  if (folgen) return folgenzahlIstBefund(Number(folgen[1]), liste.find((x) => x.id === Number(folgen[2]))?.episodes)
  const staffel = /: Titel (-?\d+)(?: \(.*?\))? ist Staffel (\d+), die Seite .* Staffel (\d+)$/.exec(text)
  if (!staffel) return false
  const nr = staffelNr(Number(staffel[1]))
  return nr !== undefined && nr === Number(staffel[2]) && nr !== Number(staffel[3])
}

/** Momentaufnahme: offene Befunde bleiben samt Datum, neue kommen mit `heute` dazu, erledigte fallen weg. */
export function momentaufnahme(neu: string[], bisher: Auffaelligkeit[], heute: string, offen: (text: string) => boolean): Auffaelligkeit[] {
  const bleibt = bisher.filter((x) => offen(x.text))
  const bekannt = new Set(bleibt.map((x) => x.text))
  return [...bleibt, ...[...new Set(neu)].filter((text) => !bekannt.has(text)).map((text) => ({ am: heute, text }))]
}

export function warnungsText(anzahl: number): string {
  return `${anzahl} Meldung(en) auffällig, siehe data/meldungs-auffaelligkeiten.json`
}

/** Schreibt die Momentaufnahme (auch leer: nichts trifft mehr zu) und gibt sie zurück. */
export function schreibeAuffaelligkeiten(datei: string, neu: string[], heute: string, offen: (text: string) => boolean): Auffaelligkeit[] {
  const bisher = existsSync(datei) ? (JSON.parse(readFileSync(datei, 'utf8')) as Auffaelligkeit[]) : []
  const jetzt = momentaufnahme(neu, bisher, heute, offen)
  writeFileSync(datei, JSON.stringify(jetzt, null, 2) + '\n')
  return jetzt
}
