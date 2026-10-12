import { createContext, type ComponentProps, type ComponentType } from 'react'
import type { PanelBuehne } from '../src/components/detail/buehne.tsx'

/** Bauteile des Detail-Panels, die ein Mockup austauschen kann (Weichen: `vite-weichen.ts`). */
export interface Ersatz {
  PanelBuehne: ComponentType<ComponentProps<typeof PanelBuehne>>
}

export const ErsatzKontext = createContext<Partial<Ersatz>>({})
