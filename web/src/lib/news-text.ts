import { PLATFORMS, type NewsMeldung, type PlatformId } from '@shared/types.ts'
import { translate as t } from './i18n.tsx'

/**
 * **Der Satz zu einer Meldung — für die Nachrichtenseite und den RSS-Feed.**
 *
 * Stand bis zum 18.09.2026 nur in `NewsView.tsx`. Der RSS-Feed braucht denselben
 * Wortlaut; zwei Fassungen derselben Sätze laufen auseinander.
 */

/**
 * **Nur die ersten zehn Zeichen sind das Datum.** Manche Meldungen tragen einen vollen
 * Zeitstempel („2026-08-30T15:00:00.000Z"); das Zerlegen an „-" machte daraus
 * „30T15:00:00.000Z.08.2026".
 */
export function datumKurz(iso: string): string {
  const [j, m, t] = iso.slice(0, 10).split('-')
  return `${t}.${m}.${j}`
}

export function anbieterDerMeldung(m: NewsMeldung): string {
  const name = m.platform ? (PLATFORMS[m.platform as PlatformId]?.name ?? m.platform) : (m.anbieter ?? '')
  return m.kanal ? `${name} (${m.kanal})` : name
}

/** Die Beschriftung der Art-Pille: „Angekündigt · neuer Anbieter", wo der Titel schon bei einem anderen Anbieter auf Deutsch läuft. */
export const artLabel = (m: NewsMeldung): string =>
  t(m.art === 'angekuendigt' && m.weiterer ? 'news.art.angekuendigtNeuerAnbieter' : (`news.art.${m.art}` as never))

/** Der ausführliche Satz — auf der Seite im aufgeklappten Bereich, im Feed als Eintrag. */
export function newsSatz(m: NewsMeldung): string {
  const anbieter = anbieterDerMeldung(m)
  const datum = m.datum ? datumKurz(m.datum) : ''
  switch (m.art) {
    case 'neu':
      if (m.weiterer) return t('news.auchBei', { anbieter })
      return anbieter ? t('news.neu', { anbieter }) : t('news.neuOhne')
    case 'folgen':
      return m.von === m.bis || m.bis === undefined
        ? t('news.folge', { von: m.von ?? '', anbieter })
        : t('news.folgen', { von: m.von ?? '', bis: m.bis, anbieter })
    case 'angekuendigt':
      /* **Der Satz bleibt kurz**. Der Vermerk (`hinweis`) steht seitdem als
         eigene, leisere Zeile daneben — in der Übersicht kurz, im Aufgeklappten ausführlich. */
      return t('news.angekuendigt', { datum, anbieter })
    case 'disc':
      return t('news.disc', { datum })
    case 'kino':
      return t('news.kino', { datum })
    case 'verspaetet':
      return t('news.verspaetet', { von: m.von ?? '', datum })
    case 'nachgetragen':
      return t('news.nachgetragen', { von: m.von ?? 1, datum, anbieter })
    case 'nachgereicht': {
      const erwartet = aufzaehlen((m.erwartet ?? []).map((d) => (m.erwartet!.length > 1 ? datumKurz(d).slice(0, 6) : datumKurz(d))))
      const p = m.planmaessig
      const plan = p?.length ? (p.length > 1 ? t('news.planMehrere', { von: p[0]!, bis: p.at(-1)! }) : t('news.planEine', { n: p[0]! })) : ''
      const mehrere = m.bis !== undefined && m.bis !== m.von
      if (plan) return t(mehrere ? 'news.nachgereichtMehrereMitPlan' : 'news.nachgereichtMitPlan', { von: m.von ?? '', bis: m.bis ?? '', plan, erwartet })
      return mehrere
        ? t('news.nachgereichtMehrere', { von: m.von ?? '', bis: m.bis ?? '', erwartet })
        : t('news.nachgereicht', { von: m.von ?? '', erwartet })
    }
  }
}

/** „16.09., 23.09. und 30.09." */
function aufzaehlen(teile: string[]): string {
  return teile.length > 1 ? `${teile.slice(0, -1).join(', ')} und ${teile.at(-1)}` : (teile[0] ?? '')
}
