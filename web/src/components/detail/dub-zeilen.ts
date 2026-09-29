import { type StreamLink, type Title } from '@shared/types.ts'
import { dubBild, dubGrenze, dubLuecken, bereicheKurz } from '@shared/dub-grenze.ts'
import type { Translate } from '../../lib/i18n.tsx'

export function dubZeilenVon({ title, t }: {
  title: Title | undefined
  t: Translate
}) {
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
      title?.episodes
        ? t('detail.dubKopfVon', { n: bild.deutscheFolgen, m: title.episodes })
        : t('detail.dubKopf', { n: bild.deutscheFolgen }),
      bereicheKurz(bild.deutsch),
      bild.ohneTon.length ? t('detail.dubOhneTonZeile', { bereiche: bereicheKurz(bild.ohneTon) }) : '',
      bild.nichtImAngebot.length
        ? t('detail.dubNichtImAngebot', { bereiche: bereicheKurz(bild.nichtImAngebot) })
        : '',
    ].filter(Boolean)
  }
  return dubZeilen
}
