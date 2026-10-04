import { type Release, type StreamLink, type Title } from '@shared/types.ts'
import { dubBild, dubGrenze, dubLuecken, bereicheKurz } from '@shared/dub-grenze.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { deutschAbgeschlossen } from './antwort-regeln.ts'

/**
 * Der Tooltip an einer Weg-Pille nennt nur, was Pille und Kasten nicht sagen: was ohne deutschen Ton dort liegt und,
 * bei einem deutsch abgeschlossenen Titel, was der Anbieter nie führt. Zahl und Bereiche der deutschen Folgen
 * stehen in der Pille, noch ausstehende Folgen im Kasten (Daniel, 04.10.2026).
 */
export function dubZeilenVon({ title, t, releases, today }: {
  title: Title | undefined
  t: Translate
  releases: Release[]
  today: string
}) {
  const abgeschlossen = title ? deutschAbgeschlossen(title, releases, today) : true
  const dubZeilen = (s: { dubRanges?: StreamLink['dubRanges'] }): string[] => {
    const bild = dubBild(s.dubRanges, title?.episodes)
    if (!bild?.deutsch.length || (!bild.ohneTon.length && !bild.nichtImAngebot.length)) {
      const grenze = dubGrenze(s.dubRanges)
      return [
        dubLuecken(s.dubRanges) ? t('detail.dubLueckenTitel') : '',
        grenze
          ? t(grenze.schluessel === 'detail.dubUntil' ? 'detail.dubUntilTitel' : 'detail.dubFromTitel', {
              n: grenze.n,
            })
          : '',
      ].filter(Boolean)
    }
    return [
      bild.ohneTon.length ? t('detail.dubOhneTonZeile', { bereiche: bereicheKurz(bild.ohneTon) }) : '',
      abgeschlossen && bild.nichtImAngebot.length
        ? t('detail.dubNichtImAngebot', { bereiche: bereicheKurz(bild.nichtImAngebot) })
        : '',
    ].filter(Boolean)
  }
  return dubZeilen
}
