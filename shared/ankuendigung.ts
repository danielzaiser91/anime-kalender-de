/**
 * Die Zeile unter der Antwort, wenn ein Simulcast angekündigt ist (`data/ankuendigungen.yaml`):
 * „Crunchyroll · mit Untertiteln ab 07.10.2026 · Synchro-Termin offen".
 *
 * Vor dem Start „ab", danach „seit"; nennt die Quelle nur den Monat („Oktober 2026", PSYREN),
 * steht der Monat da und gilt bis zu seinem Ende als bevorstehend. Rein, damit `check:logic`
 * sie ohne Oberfläche prüfen kann.
 */
import type { Title } from './types.ts'
import { PLATFORMS } from './types.ts'
import { formatDate, monthName, todayIso } from './time.ts'

export function ankuendigungZeile(
  a: NonNullable<Title['ankuendigung']>,
  T: (k: string, v?: Record<string, string | number>) => string,
  heute = todayIso(),
): string {
  const [jahr, monat] = a.omuAb.split('-')
  const nurMonat = a.omuAb.length === 7
  const wann = nurMonat ? `${monthName(Number(monat) - 1)} ${jahr}` : formatDate(a.omuAb)
  const begonnen = nurMonat ? `${a.omuAb}-31` < heute : a.omuAb <= heute
  return [
    PLATFORMS[a.platform]?.name ?? a.platform,
    T(begonnen ? 'antwort.omuSeit' : 'antwort.omuAb', { wann }),
    T(a.synchro === 'angekuendigt' ? 'antwort.synchroTerminOffen' : 'antwort.synchroOffen'),
  ].join(' · ')
}
