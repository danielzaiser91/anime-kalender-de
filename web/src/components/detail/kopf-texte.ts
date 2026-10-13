import { FORMAT_DE } from '@shared/mappings.ts'
import type { Title, FranchiseMember } from '@shared/types.ts'
import { jpAngabe } from './kino.tsx'
import type { Translate } from '../../lib/i18n.tsx'

/** Zweite Zeile unter dem Namen: der Teil der Reihe („Staffel 3“), die Folgenzahl (wo der Kasten sie nicht nennt) und die Altersfreigabe. */
export function unterzeileVon(title: Title, teil: string | undefined, folgenImKasten: boolean, t: Translate): string {
  return [
    teil,
    title.episodes && title.episodes > 1 && !folgenImKasten ? `${title.episodes} ${t('detail.episodes')}` : undefined,
    /* „ab 0“ sagt nichts — nur eine Freigabe ab 6 aufwärts steht da (Daniel, 11.10.2026). */
    title.fsk ? t(title.fskQuelle ? 'antwort.fskAnbieter' : 'antwort.fsk', { n: title.fsk }) : undefined,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Dritte Zeile: Format, Laufzeit (nur hier), Start und Studio. */
export function metaVon(title: Title, eigenerTeil: FranchiseMember | undefined, t: Translate): string {
  return [
    title.format ? (FORMAT_DE[title.format] ?? title.format) : undefined,
    title.runtimeMin ? t(title.episodes && title.episodes > 1 ? 'detail.laufzeitJe' : 'detail.laufzeit', { n: title.runtimeMin }) : undefined,
    jpAngabe(eigenerTeil?.jpStart ?? (title.westlich ? title.jpStart : undefined), title.jpYear, title.land),
    title.studios?.[0],
  ]
    .filter(Boolean)
    .join(' · ')
}
