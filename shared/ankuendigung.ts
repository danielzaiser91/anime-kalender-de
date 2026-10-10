/**
 * Die Zeile unter der Antwort, wenn ein Simulcast angekündigt ist (`data/ankuendigungen.yaml`):
 * „Crunchyroll · mit Untertiteln ab 07.10.2026 · Synchro-Termin offen".
 *
 * Vor dem Start „ab", danach „seit"; nennt die Quelle nur den Monat („Oktober 2026", PSYREN),
 * steht der Monat da und gilt bis zu seinem Ende als bevorstehend. Rein, damit `check:logic`
 * sie ohne Oberfläche prüfen kann.
 */
import type { StreamLink, Title } from './types.ts'
import { PLATFORMS } from './types.ts'
import { formatDate, monthName, todayIso } from './time.ts'

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

/**
 * Ein Weg beim Anbieter eines angekündigten Simulcasts, an dem noch keine deutsche Fassung belegt ist:
 * dort läuft vorerst nur Originalton mit Untertiteln (PSYREN, Daniel 10.10.2026) — die Pille sagt es.
 */
export function streamNurOmu(t: { ankuendigung?: Ankuendigung }, s: StreamLink): boolean {
  return t.ankuendigung?.platform === s.platform && s.dub !== true && !s.dubRanges?.some((r) => r.dub)
}

export function ankuendigungZeile(
  a: Ankuendigung,
  T: (k: string, v?: Record<string, string | number>) => string,
  heute = todayIso(),
): string {
  const begonnen = nurMonat(a.omuAb) ? omuLetzterTag(a.omuAb) < heute : a.omuAb <= heute
  return [
    PLATFORMS[a.platform]?.name ?? a.platform,
    T(begonnen ? 'antwort.omuSeit' : 'antwort.omuAb', { wann: omuDatumText(a.omuAb) }),
    T(a.synchro === 'angekuendigt' ? 'antwort.synchroTerminOffen' : 'antwort.synchroOffen'),
  ].join(' · ')
}
