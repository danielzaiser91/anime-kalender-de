import { createContext, type ComponentProps, type ComponentType } from 'react'
import type { DbLeer, DbRaster } from '../src/components/db-bedienung.tsx'
import type { DbKopfzeile } from '../src/components/db-kopfzeile.tsx'
import type { PanelBuehne } from '../src/components/detail/buehne.tsx'
import type { DbKopfbereich } from '../src/components/filter/DbWerkzeug.tsx'
import type { TvKasten } from '../src/components/kalender/TvKasten.tsx'
import type { ZeitMarke } from '../src/components/kalender/Marken.tsx'
import type { discZeilen } from '../src/components/detail/wege-zeilen.tsx'
import type { AntwortKastenMitMarke } from '../src/components/detail/kasten-marke.tsx'
import type { FilterBarProps } from '../src/components/FilterBar.tsx'
import type { Werkzeugleiste } from '../src/components/filter/Werkzeugleiste.tsx'

/** Die Zeilen unter „Disc“ als Bauteil: dieselben Angaben, die `discZeilen()` bekommt. */
export type DiscBereichEigenschaften = Parameters<typeof discZeilen>[0]

/** Bauteile der Seite, die ein Mockup austauschen kann (Weichen: `vite-weichen.ts`). */
export interface Ersatz {
  PanelBuehne: ComponentType<ComponentProps<typeof PanelBuehne>>
  DiscBereich: ComponentType<DiscBereichEigenschaften>
  /** Der Antwortkasten samt Folgenliste (`AntwortKastenMitMarke`); das Mockup kann die Folgenliste unter den Kasten setzen. */
  AntwortKasten: ComponentType<ComponentProps<typeof AntwortKastenMitMarke>>
  TvKasten: ComponentType<ComponentProps<typeof TvKasten>>
  ZeitMarke: ComponentType<ComponentProps<typeof ZeitMarke>>
  DbKopfbereich: ComponentType<ComponentProps<typeof DbKopfbereich>>
  DbRaster: ComponentType<ComponentProps<typeof DbRaster>>
  DbLeer: ComponentType<ComponentProps<typeof DbLeer>>
  DbKopfzeile: ComponentType<ComponentProps<typeof DbKopfzeile>>
  /** Die unten angedockte Filterleiste der Datenbank am Rechner (`FilterBar.tsx`). */
  FilterBarDock: ComponentType<FilterBarProps>
  /** Die Werkzeugleiste am unteren Rand des Handys (`filter/Werkzeugleiste.tsx`), geteilt mit dem Kalender. */
  Werkzeugleiste: ComponentType<ComponentProps<typeof Werkzeugleiste>>
}

export const ErsatzKontext = createContext<Partial<Ersatz>>({})
