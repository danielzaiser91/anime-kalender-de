import type { Plugin } from 'vite'
import { fileURLToPath } from 'node:url'

/**
 * Weichen: Der Bau der Bühne lenkt einzelne Importe des Detail-Panels auf eine Datei in `web/buehne/weichen/` um.
 * Die Weiche zeigt standardmäßig das echte Bauteil und tauscht es nur, wenn ein Mockup einen Ersatz mitbringt
 * (`ersatz.tsx`). So bleibt der Panel-Code unberührt, und „Vorher" ist immer der Stand von `main`.
 * Neue Weiche: eine Zeile hier und die Datei dazu.
 */
const WEICHEN: Record<string, string> = {
  './detail/kopf.tsx': './weichen/kopf.tsx',
}

export function buehnenWeichen(): Plugin {
  return {
    name: 'buehnen-weichen',
    enforce: 'pre',
    resolveId(quelle, importeur) {
      const ziel = WEICHEN[quelle]
      if (!ziel || !importeur?.split('\\').join('/').endsWith('/web/src/components/DetailPanel.tsx')) return null
      return fileURLToPath(new URL(ziel, import.meta.url))
    },
  }
}
