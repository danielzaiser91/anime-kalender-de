import type { OhneWegEintrag } from '@shared/ohne-weg.ts'
import { formatDate } from '@shared/time.ts'
import type { Translate } from '../../lib/i18n.tsx'

/** Der Satz zum Grund; ein Grund ohne Tag (Datei kaputt) sagt nur, dass nichts belegt ist — nie ein Datum erfinden. */
export function ohneWegText(e: OhneWegEintrag, t: Translate): string {
  const datum = e.reason === 'angekuendigt' ? e.ab : e.checkedAt
  if (!datum) return t('antwort.ohneWegOffen')
  const params = { datum: formatDate(datum) }
  switch (e.reason) {
    case 'angekuendigt':
      return t('antwort.ohneWegAngekuendigt', params)
    case 'kein-dub':
      return t('antwort.ohneWegKeinDub', params)
    case 'nur-kauf':
      return t('antwort.ohneWegNurKauf', params)
    case 'film-ohne-abo':
      return t('antwort.ohneWegFilm', params)
    default:
      return t('antwort.ohneWegOffen')
  }
}
