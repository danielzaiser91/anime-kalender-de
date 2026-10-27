import { createContext, type ComponentProps, type ComponentType } from 'react'
import type { DbLeer, DbRaster } from '../src/components/db-bedienung.tsx'
import type { DbKopfzeile } from '../src/components/db-kopfzeile.tsx'
import type { PanelBuehne } from '../src/components/detail/buehne.tsx'
import type { DbKopfbereich } from '../src/components/filter/DbWerkzeug.tsx'
import type { TvKasten } from '../src/components/kalender/TvKasten.tsx'
import type { ZeitMarke } from '../src/components/kalender/Marken.tsx'
import type { discZeilen } from '../src/components/detail/wege-zeilen.tsx'

/** Die Zeilen unter „Disc“ als Bauteil: dieselben Angaben, die `discZeilen()` bekommt. */
export type DiscBereichEigenschaften = Parameters<typeof discZeilen>[0]

/** Bauteile der Seite, die ein Mockup austauschen kann (Weichen: `vite-weichen.ts`). */
export interface Ersatz {
  PanelBuehne: ComponentType<ComponentProps<typeof PanelBuehne>>
  DiscBereich: ComponentType<DiscBereichEigenschaften>
  TvKasten: ComponentType<ComponentProps<typeof TvKasten>>
  ZeitMarke: ComponentType<ComponentProps<typeof ZeitMarke>>
  DbKopfbereich: ComponentType<ComponentProps<typeof DbKopfbereich>>
  DbRaster: ComponentType<ComponentProps<typeof DbRaster>>
  DbLeer: ComponentType<ComponentProps<typeof DbLeer>>
  DbKopfzeile: ComponentType<ComponentProps<typeof DbKopfzeile>>
}

export const ErsatzKontext = createContext<Partial<Ersatz>>({})
