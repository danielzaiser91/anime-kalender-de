import type { ViewId } from '../lib/router.ts'
import type { Dataset } from '../lib/data.ts'
import { NewsView } from './NewsView.tsx'
import { SaisonView } from './SaisonView.tsx'
import { DatenschutzView, ImpressumView, NewsletterView, SourcesView, SubscribeView } from './StaticViews.tsx'

/** Die Ansichten außerhalb von Kalender und Datenbank — je Adresse eine; die beiden Kalender-Ansichten und die Datenbank zeichnet `App.tsx` selbst. */
export function SeitenAnsicht({ view, data, favorites, oeffne }: { view: ViewId; data: Dataset; favorites: Set<number>; oeffne: (id: number) => void }) {
  switch (view) {
    case 'news':
      return <NewsView data={data} oeffne={oeffne} />
    case 'saison':
      return <SaisonView data={data} favorites={favorites} oeffne={oeffne} />
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
