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
  { importeur: '/web/src/components/WeekView.tsx', quelle: './kalender/TvKasten.tsx', ziel: './weichen/tv-kasten.tsx' },
  { importeur: '/web/src/components/kalender/PosterKarte.tsx', quelle: './Marken.tsx', ziel: './weichen/marken.tsx' },
  { importeur: '/web/src/components/DatabaseView.tsx', quelle: './filter/DbWerkzeug.tsx', ziel: './weichen/db-werkzeug.tsx' },
  { importeur: '/web/src/components/DatabaseView.tsx', quelle: './db-bedienung.tsx', ziel: './weichen/db-bedienung.tsx' },
  { importeur: '/web/src/components/db-bedienung.tsx', quelle: './db-kopfzeile.tsx', ziel: './weichen/db-kopfzeile.tsx' },
  { importeur: '/web/src/components/filter/DbWerkzeug.tsx', quelle: '../db-kopfzeile.tsx', ziel: './weichen/db-kopfzeile.tsx' },
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
