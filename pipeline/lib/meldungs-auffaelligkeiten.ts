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

/** Wortlaut des Folgen-Befunds; „(je Staffel)“ zeigt, dass je Staffel gezählt wurde (`gemeldeteFolgen`), und liest `trifftNochZu`. */
export const folgenBefundText = (gemeldet: number, titel: string, episodes: number | undefined, adresse: string): string =>
  `${gemeldet} Folgen gemeldet (je Staffel), ${titel} hat ${episodes} (${adresse})`

type Meldungszeile = { folgen?: unknown; folge_nr?: number | null; staffel?: unknown }

/**
 * Folgenzahl, die eine Meldungsgruppe für den Titel meldet (18.11.2026): Eine Seite mit mehreren Staffeln (ADN 1350: Staffel 1 und 2
 * unter einer Adresse) zählt nur die Zeilen der Staffel des Titels; ist sie nicht bestimmbar, gibt es keine Zahl (null) — kein Befund.
 */
export function gemeldeteFolgen(gruppe: Meldungszeile[], titelStaffel: number | undefined): number | null {
  const staffeln = new Set(gruppe.map((x) => x.staffel).filter((n): n is number => typeof n === 'number' && Number.isFinite(n)))
  const mehrere = staffeln.size >= 2
  if (mehrere && (titelStaffel === undefined || !staffeln.has(titelStaffel))) return null
  const zeilen = mehrere ? gruppe.filter((x) => x.staffel === titelStaffel) : gruppe
  const angegeben = zeilen.map((x) => (typeof x.folgen === 'number' && Number.isFinite(x.folgen) ? x.folgen : 0))
  return Math.max(...angegeben, zeilen.filter((x) => x.folge_nr != null).length)
}

/** „Titel 123 (Name)“: die Kennung bleibt, der Name erspart das Nachschlagen. */
export function titelMitName(id: number, liste: Benennbar[]): string {
  const t = liste.find((x) => x.id === id)
  return t ? `Titel ${id} (${anzeigeName(t)})` : `Titel ${id}`
}

/**
 * Folgenzahl der Meldung gegen den Titel — nur grobe Abweichungen. Weniger Folgen als der Titel ist bei keinem Anbieter ein Befund
 * (die Seite zeigt eine Staffel). `ungeprueft`: mehrere Staffeln auf der Seite, die des Titels unbestimmbar.
 */
export function pruefeFolgenzahl(
  gruppe: Array<Meldungszeile & { id: number }>,
  t: (Benennbar & { episodes?: number }) | undefined,
  titelStaffel: number | undefined,
  liste: Benennbar[],
  adresse: string,
): { befund: string | null; ungeprueft: boolean } {
  const gemeldet = gemeldeteFolgen(gruppe, titelStaffel)
  if (gemeldet === null) return { befund: null, ungeprueft: true }
  if (!t || !folgenzahlIstBefund(gemeldet, t.episodes)) return { befund: null, ungeprueft: false }
  const text = folgenBefundText(gemeldet, titelMitName(t.id, liste), t.episodes, adresse)
  return { befund: `Meldung ${gruppe.map((x) => x.id).join(',')}: ${text}`, ungeprueft: false }
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
  const folgen = /: (\d+) Folgen gemeldet \(je Staffel\), Titel (-?\d+)(?: \(.*?\))? hat \d+ \(/.exec(text)
  if (folgen) return folgenzahlIstBefund(Number(folgen[1]), liste.find((x) => x.id === Number(folgen[2]))?.episodes)
  const staffel = /: Titel (-?\d+)(?: \(.*?\))? ist Staffel (\d+), die Seite .* Staffel (\d+)$/.exec(text)
  if (!staffel) return false
  const nr = staffelNr(Number(staffel[1]))
  return nr === Number(staffel[2]) && nr !== Number(staffel[3])
}

/** Momentaufnahme: offene Befunde bleiben samt Datum, neue kommen mit `heute` dazu, erledigte fallen weg. */
export function momentaufnahme(neu: string[], bisher: Auffaelligkeit[], heute: string, offen: (text: string) => boolean): Auffaelligkeit[] {
  const bleibt = bisher.filter((x) => offen(x.text))
  const bekannt = new Set(bleibt.map((x) => x.text))
  return [...bleibt, ...[...new Set(neu)].filter((text) => !bekannt.has(text)).map((text) => ({ am: heute, text }))]
}

/** Einträge von `jetzt`, die vorher nicht in der Datei standen. Nur sie lösen die Warnung aus; offene Altbefunde bleiben still in der Liste. */
export function neueBefunde(bisher: Auffaelligkeit[], jetzt: Auffaelligkeit[]): Auffaelligkeit[] {
  const bekannt = new Set(bisher.map((x) => x.text))
  return jetzt.filter((x) => !bekannt.has(x.text))
}

/** Eine lange Kennungsliste („Meldung 1,2,…,16: …“) auf die erste Kennung und die Zahl kürzen. */
function kurzText(text: string): string {
  return text.replace(/^Meldung (\d+)((?:,\d+)+)/, (_t, erste: string, rest: string) => `Meldung ${erste} (+${rest.split(',').length - 1})`)
}

/** Die neuen Texte stehen in der Warnung, damit sie sich selbst erklärt (höchstens drei, der Rest als Zahl). */
export function warnungsText(neu: number, offen: number, neue: Auffaelligkeit[] = []): string {
  const basis = `${neu} neue Meldung(en) auffällig (${offen} offen), siehe data/meldungs-auffaelligkeiten.json`
  if (!neue.length) return basis
  const mehr = neue.length > 3 ? ` (+${neue.length - 3} weitere)` : ''
  return `${basis} — neu: ${neue.slice(0, 3).map((x) => kurzText(x.text)).join(' | ')}${mehr}`
}

/** Schreibt die Momentaufnahme (auch leer: nichts trifft mehr zu); `neue` sind die Einträge, die vorher nicht in der Datei standen. */
export function schreibeAuffaelligkeiten(
  datei: string,
  neu: string[],
  heute: string,
  offen: (text: string) => boolean,
): { jetzt: Auffaelligkeit[]; neue: Auffaelligkeit[] } {
  const bisher = existsSync(datei) ? (JSON.parse(readFileSync(datei, 'utf8')) as Auffaelligkeit[]) : []
  const jetzt = momentaufnahme(neu, bisher, heute, offen)
  writeFileSync(datei, JSON.stringify(jetzt, null, 2) + '\n')
  return { jetzt, neue: neueBefunde(bisher, jetzt) }
}
