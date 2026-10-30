/**
 * Die Zeile unter der Antwort, wenn ein Simulcast angekündigt ist (`data/ankuendigungen.yaml`):
 * „Crunchyroll · mit Untertiteln ab 07.10.2026 · Synchro-Termin offen".
 *
 * Vor dem Start „ab", danach „seit"; nennt die Quelle nur den Monat („Oktober 2026", PSYREN),
 * steht der Monat da und gilt bis zu seinem Ende als bevorstehend. Rein, damit `check:logic`
 * sie ohne Oberfläche prüfen kann.
 */
import type { Release, StreamLink, Title } from './types.ts'
import { PLATFORMS } from './types.ts'
import { diffDays, formatDate, monthName, todayIso } from './time.ts'

type Ankuendigung = NonNullable<Title['ankuendigung']>

/** `JJJJ-MM` — die Quelle nennt keinen Tag. */
const nurMonat = (omuAb: string): boolean => omuAb.length === 7

/** „07.10.2026", wo die Quelle nur den Monat nennt „Oktober 2026". */
export function omuDatumText(omuAb: string): string {
  if (!nurMonat(omuAb)) return formatDate(omuAb)
  const [jahr, monat] = omuAb.split('-')
  return `${monthName(Number(monat) - 1)} ${jahr}`
}

/** „am 07.10.2026" bzw. „im Oktober 2026" — für Sätze der Art „Start … bei Crunchyroll". */
export function omuStartText(omuAb: string): string {
  return `${nurMonat(omuAb) ? 'im' : 'am'} ${omuDatumText(omuAb)}`
}

/** Letzter Tag, an dem der Start noch bevorsteht: der Tag selbst, bei einem Monat sein Ende. */
export function omuLetzterTag(omuAb: string): string {
  return nurMonat(omuAb) ? `${omuAb}-31` : omuAb
}

/** Tage nach `omuAb`, in denen eine Synchro-Ankündigung des Anbieters gilt, auch wenn dessen Katalog noch keine deutsche Tonspur führt. */
export const ANKUENDIGUNG_FRIST_TAGE = 60

/** Gilt die Synchro-Ankündigung mit Start `omuAb` an `heute` noch? Bei nur genanntem Monat zählt dessen erster Tag. */
export function ankuendigungFrisch(omuAb: string, heute: string): boolean {
  const tag = nurMonat(omuAb) ? `${omuAb}-01` : omuAb
  return diffDays(tag, heute) <= ANKUENDIGUNG_FRIST_TAGE
}

/**
 * Ein Weg beim Anbieter eines angekündigten Simulcasts, an dem noch keine deutsche Fassung belegt ist:
 * dort läuft vorerst nur Originalton mit Untertiteln (PSYREN, Daniel 10.10.2026) — die Pille sagt es.
 */
export function streamNurOmu(t: { ankuendigung?: Ankuendigung }, s: StreamLink, releases: Release[] = []): boolean {
  if (s.dub === true || s.dubRanges?.some((r) => r.dub)) return false
  if (t.ankuendigung?.platform === s.platform) return true
  // Auch ein Termin, dessen Quelle nur den Originalton nennt (`Release.sprache`), macht den Weg dort zu „nur Untertitel“.
  const termine = releases.filter((r) => r.platform === s.platform)
  return termine.length > 0 && termine.every((r) => r.sprache === 'omu')
}

/** Hinweis im Tooltip: nur eine angekündigte Synchro darf „noch nicht erschienen“ heißen; sonst ist keine bekannt. */
export const synchroAngekuendigt = (t: { ankuendigung?: Ankuendigung }, s: StreamLink): boolean =>
  t.ankuendigung?.platform === s.platform && t.ankuendigung.synchro === 'angekuendigt'

/** Hat der Anbieter für diesen Titel eine deutsche Synchro angekündigt? Westliche Animation nie (dort gilt die Ankündigung nicht). Antwortkasten und Kachel fragen hier. */
export const titelSynchroAngekuendigt = (t: { westlich?: true; ankuendigung?: Ankuendigung }): boolean =>
  !t.westlich && t.ankuendigung?.synchro === 'angekuendigt'

/**
 * Die Ankündigung, die im Panel die Karte „Termin offen“ trägt (statt Nebenzeile des Kastens und Anbieter-Pille): Synchro angekündigt
 * und noch kein deutscher Termin (Antwort „ohne“). Jede andere Antwort behält den Kasten, wie er ist.
 */
export const ankuendigungOhneTermin = (t: { westlich?: true; ankuendigung?: Ankuendigung }, antwortArt: string | undefined): Ankuendigung | undefined =>
  antwortArt === 'ohne' && titelSynchroAngekuendigt(t) ? t.ankuendigung : undefined

type Uebersetze = (k: string, v?: Record<string, string | number>) => string

/** „mit Untertiteln ab/seit 07.10.2026“ — vor dem Start „ab“, danach „seit“. */
export function omuZeile(a: Ankuendigung, T: Uebersetze, heute = todayIso()): string {
  const begonnen = nurMonat(a.omuAb) ? omuLetzterTag(a.omuAb) < heute : a.omuAb <= heute
  return T(begonnen ? 'antwort.omuSeit' : 'antwort.omuAb', { wann: omuDatumText(a.omuAb) })
}

export function ankuendigungZeile(a: Ankuendigung, T: Uebersetze, heute = todayIso()): string {
  return [
    PLATFORMS[a.platform]?.name ?? a.platform,
    omuZeile(a, T, heute),
    T(a.synchro === 'angekuendigt' ? 'antwort.synchroTerminOffen' : 'antwort.synchroOffen'),
  ].join(' · ')
}
