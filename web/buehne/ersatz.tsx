import { createContext, type ComponentProps, type ComponentType } from 'react'
import type { PanelKopf } from '../src/components/detail/kopf.tsx'

/** Bauteile des Detail-Panels, die ein Mockup austauschen kann (Weichen: `vite-weichen.ts`). */
export interface Ersatz {
  PanelKopf: ComponentType<ComponentProps<typeof PanelKopf>>
}

export const ErsatzKontext = createContext<Partial<Ersatz>>({})
