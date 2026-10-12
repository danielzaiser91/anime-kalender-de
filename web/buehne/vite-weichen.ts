import type { Plugin } from 'vite'
import { fileURLToPath } from 'node:url'

/**
 * Weichen: Der Bau der Bühne lenkt einzelne Importe der Seite auf eine Datei in `web/buehne/weichen/` um.
 * Eine Weiche zeigt das echte Bauteil und tauscht es nur, wenn ein Mockup einen Ersatz mitbringt (`ersatz.tsx`),
 * oder sie nimmt dem Bauteil den Netzzugriff (`cover-max`). So bleibt der Seiten-Code unberührt, und „Vorher"
 * ist immer der Stand von `main`. Neue Weiche: eine Zeile hier und die Datei dazu.
 */
const WEICHEN = [
  { importeur: '/web/src/components/DetailPanel.tsx', quelle: './detail/buehne.tsx', ziel: './weichen/buehne.tsx' },
  { importeur: '/web/src/components/detail/buehne.tsx', quelle: './cover-max.tsx', ziel: './weichen/cover-max.tsx' },
]

export function buehnenWeichen(): Plugin {
  return {
    name: 'buehnen-weichen',
    enforce: 'pre',
    resolveId(quelle, importeur) {
      const datei = importeur?.split('\\').join('/') ?? ''
      const weiche = WEICHEN.find((w) => w.quelle === quelle && datei.endsWith(w.importeur))
      return weiche ? fileURLToPath(new URL(weiche.ziel, import.meta.url)) : null
    },
  }
}
