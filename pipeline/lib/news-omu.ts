/**
 * **OmU-Starts angekündigter Serien als Meldung** (Daniel, 03.10.2026, an „Dragon Ball Super: Beerus").
 *
 * `data/ankuendigungen.yaml` führt Simulcasts, die Crunchyroll vor dem deutschen Start nennt („OmU: 11.10.",
 * „DE: TBA"). Sie sind kein Kalendertermin — aber eine Nachricht mit Quelle: Wer die Serie sucht, soll lesen
 * können, dass sie zuerst nur mit Untertiteln kommt und ob eine Synchro angekündigt ist. Die Meldung steht
 * am Tag der Quelle (`stand`), nicht am Tag, an dem der Start liegt.
 *
 * Nur wo es **kein** Release desselben Anbieters gibt: Sonst steht der Start schon als Termin da und hat
 * seine Meldung.
 */
import type { NewsMeldung, Release, Title } from '../../shared/types.ts'
import { hostVon } from '../../shared/quelle.ts'

export function omuMeldungen(
  titles: Iterable<Title>,
  releases: Release[],
): (NewsMeldung & { schluessel: string; fallback: string; titel: Title })[] {
  const raus: (NewsMeldung & { schluessel: string; fallback: string; titel: Title })[] = []
  for (const t of titles) {
    const a = t.ankuendigung
    /* Nur ein Tag ist ein Termin; „JJJJ-MM" nennt die Quelle, wo sie keinen Tag kennt. */
    if (!a || a.omuAb.length !== 10) continue
    if (releases.some((r) => r.titleId === t.id && r.platform === a.platform && !r.widerlegt)) continue
    raus.push({
      schluessel: `omu:${t.id}:${a.platform}:${a.omuAb}`,
      fallback: a.stand,
      art: 'angekuendigt',
      titel: t,
      platform: a.platform,
      datum: a.omuAb,
      quelle: a.quellen[0],
      belege: a.quellen.map((url) => ({ url, name: hostVon(url) })),
      hinweis:
        a.synchro === 'angekuendigt'
          ? 'Zuerst mit Untertiteln (OmU). Eine deutsche Synchro ist angekündigt, ihr Termin steht noch aus.'
          : 'Zuerst nur mit Untertiteln (OmU). Eine deutsche Synchro ist nicht angekündigt.',
    })
  }
  return raus
}
