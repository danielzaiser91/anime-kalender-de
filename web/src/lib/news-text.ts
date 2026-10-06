import { PLATFORMS, type NewsMeldung, type PlatformId } from '@shared/types.ts'
import { translate as t } from './i18n.tsx'
import { weekdayName } from '@shared/time.ts'

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

/** „19:00" → „19 Uhr", „18:30" → „18:30 Uhr". */
export function uhrzeitKurz(zeit: string): string {
  return zeit.endsWith(':00') ? `${Number(zeit.slice(0, 2))} Uhr` : `${zeit} Uhr`
}

export function anbieterDerMeldung(m: NewsMeldung): string {
  const name = m.platform ? (PLATFORMS[m.platform as PlatformId]?.name ?? m.platform) : (m.anbieter ?? '')
  return m.kanal ? `${name} (${m.kanal})` : name
}

/** Die Beschriftung der Art-Pille: „Angekündigt · neuer Anbieter", wo der Titel schon bei einem anderen Anbieter auf Deutsch läuft. */
export const artLabel = (m: NewsMeldung): string =>
  t(m.art === 'angekuendigt' && m.weiterer ? 'news.art.angekuendigtNeuerAnbieter' : (`news.art.${m.art}` as never))

/**
 * **Beide Daten offen nennen** (Daniel, 05.10.2026): Der Eintrag trägt den Tag, an dem wir die Meldung veröffentlichen; war die Quelle älter, steht ihr Tag dabei —
 * „… — laut anime2you.de vom 21.08." —, statt den Eintrag zurückzudatieren. Gilt für Termin-Meldungen, wenn die Quelle ein früheres Veröffentlichungsdatum nennt.
 */
function lautQuelle(m: NewsMeldung, am?: string): string {
  if (!am || (m.art !== 'angekuendigt' && m.art !== 'disc' && m.art !== 'kino')) return ''
  const frueh = (m.belege ?? []).filter((b) => b.veroeffentlichtAm && b.veroeffentlichtAm < am).sort((a, b) => a.veroeffentlichtAm!.localeCompare(b.veroeffentlichtAm!))[0]
  return frueh ? ` ${t('news.lautQuelle', { quelle: frueh.name, datum: datumKurz(frueh.veroeffentlichtAm!) })}` : ''
}

/** Der ausführliche Satz — auf der Seite im aufgeklappten Bereich, im Feed als Eintrag; mit `am` (Tag des Eintrags) nennt er das ältere Quelldatum. */
export function newsSatz(m: NewsMeldung, am?: string): string {
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
      if (m.omu) return t(m.omu === 'synchro-angekuendigt' ? 'news.omuAngekuendigt' : 'news.omuOffen', { datum, anbieter }) + lautQuelle(m, am)
      return t('news.angekuendigt', { datum, anbieter }) + lautQuelle(m, am)
    case 'disc':
      return t(m.ausgabe ? 'news.discAusgabe' : 'news.disc', { datum, ausgabe: m.ausgabe ?? '' }) + lautQuelle(m, am)
    case 'kino':
      return t('news.kino', { datum }) + lautQuelle(m, am)
    case 'verspaetet':
      return t('news.verspaetet', { von: m.von ?? '', datum })
    case 'nachgetragen':
      return m.zeit && m.datum
        ? t('news.nachgetragenZeit', { von: m.von ?? 1, tag: weekdayName(m.datum), datum, zeit: uhrzeitKurz(m.zeit), anbieter })
        : t('news.nachgetragen', { von: m.von ?? 1, datum, anbieter })
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
