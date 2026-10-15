import { formatDate } from '@shared/time.ts'
import type { Translate } from '../../lib/i18n.tsx'

/** „ab“ oder „seit“ — ein nacktes Datum sagt beides nicht; ohne Datum nichts. */
export function seitAbText(datum: string | undefined, today: string, t: Translate): string | undefined {
  return datum ? t(datum > today ? 'detail.abDatum' : 'detail.seitDatum', { d: formatDate(datum) }) : undefined
}
