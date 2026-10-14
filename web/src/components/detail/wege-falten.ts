import type { StreamLink, Title } from '@shared/types.ts'
import type { Translate } from '../../lib/i18n.tsx'

/**
 * **Wege je Staffel falten** (Cartoons, 14.10.2026): Der Bau legt einen Weg je Staffel an (`bau/cartoon-wege.ts`), Om Nom Stories
 * hätte 56 Pillen. Aneinander anschließende Teilwege desselben Anbieters mit derselben Aussage sind eine Pille („Flg. 1–71").
 * Was sich in Urteil, Hinweis oder Haken-Bereichen unterscheidet (Jack: je Buch ein eigener Beleg), bleibt getrennt.
 */
const aussage = (w: StreamLink) =>
  JSON.stringify([w.platform, w.url, w.zugang, w.kanal, w.dub, w.dubQuelle, w.dubRanges, w.entferntAm, w.sharedWith])

function schliesstAn(vorher: StreamLink | undefined, w: StreamLink): boolean {
  return Boolean(vorher?.teilBereich && w.teilBereich && vorher.teilBereich.bis + 1 === w.teilBereich.von && aussage(vorher) === aussage(w))
}

export function falteTeilwege(wege: StreamLink[]): StreamLink[] {
  const aus: StreamLink[] = []
  for (const w of wege) {
    const vorher = w.teilBereich ? aus.findLast((x) => x.platform === w.platform && x.url === w.url) : undefined
    if (!vorher || !schliesstAn(vorher, w)) {
      aus.push(w)
      continue
    }
    const stand = [vorher.dubStand, w.dubStand].filter(Boolean).sort()[0]
    aus[aus.indexOf(vorher)] = { ...vorher, teilBereich: { von: vorher.teilBereich!.von, bis: w.teilBereich!.bis }, ...(stand ? { dubStand: stand } : {}) }
  }
  return aus
}

/** Die Staffeln, die ein Ausschnitt (durchlaufende Folgenzählung) genau abdeckt; `undefined`, wo er keine Staffelgrenzen trifft. */
export function staffelSpanne(title: Pick<Title, 'staffeln' | 'staffelnQuelle'>, teil: { von: number; bis: number }): { von: number; bis: number; laut: 'tmdb' | undefined } | undefined {
  let bisher = 0
  const grenzen = (title.staffeln ?? []).map((s) => ({ nr: s.nr, von: bisher + 1, bis: (bisher += s.folgen) }))
  const erste = grenzen.find((g) => g.von === teil.von)
  const letzte = grenzen.find((g) => g.bis === teil.bis)
  if (!erste || !letzte || letzte.nr < erste.nr) return undefined
  return { von: erste.nr, bis: letzte.nr, laut: title.staffelnQuelle === 'tmdb' ? 'tmdb' : undefined }
}

/** Unterzeile und Tooltip eines Teilwegs: Staffel (wo der Ausschnitt genau Staffeln trifft) und Folgenbereich; Staffeln aus TMDB als „laut TMDB". */
export function teilAngaben(title: Pick<Title, 'staffeln' | 'staffelnQuelle'>, teil: { von: number; bis: number }, t: Translate): { unten: string; titel: string } {
  const flg = t('detail.teilBereich', { von: teil.von, bis: teil.bis })
  const titel = t('detail.teilBereichTitel', { von: teil.von, bis: teil.bis })
  const s = staffelSpanne(title, teil)
  if (!s) return { unten: flg, titel }
  const name = s.von === s.bis ? t('detail.teilStaffelEine', { nr: s.von }) : t('detail.teilStaffel', { von: s.von, bis: s.bis })
  const laut = s.laut ? ` (${t('detail.teilLautTmdb')})` : ''
  return { unten: `${name}${laut} · ${flg}`, titel }
}
