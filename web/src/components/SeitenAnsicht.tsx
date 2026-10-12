import type { AppRoute } from '../lib/router.ts'
import type { Dataset } from '../lib/data.ts'
import { NewsView } from './NewsView.tsx'
import { SaisonView } from './SaisonView.tsx'
import { DatenschutzView } from './Datenschutz.tsx'
import { ImpressumView, NewsletterView, SourcesView, SubscribeView } from './StaticViews.tsx'

/** Die Ansichten außerhalb von Kalender und Datenbank — je Adresse eine; die beiden Kalender-Ansichten und die Datenbank zeichnet `App.tsx` selbst. */
export function SeitenAnsicht({ route, ersetze, data, favorites, oeffne }: {
  route: AppRoute
  ersetze: (next: Partial<AppRoute>) => void
  data: Dataset
  favorites: Set<number>
  oeffne: (id: number) => void
}) {
  switch (route.view) {
    case 'news':
      return <NewsView data={data} oeffne={oeffne} />
    case 'saison':
      return <SaisonView data={data} favorites={favorites} oeffne={oeffne} reiter={route.saison ?? 'jetzt'} setReiter={(saison) => ersetze({ saison })} />
    case 'abo':
      return <SubscribeView meta={data.meta} />
    case 'newsletter':
      return <NewsletterView meta={data.meta} data={data} />
    case 'quellen':
      return <SourcesView meta={data.meta} />
    case 'impressum':
      return <ImpressumView />
    case 'datenschutz':
      return <DatenschutzView />
    default:
      return null
  }
}
