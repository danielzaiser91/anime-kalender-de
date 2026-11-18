import { useEffect, useState } from 'react'
import type { Title } from '@shared/types.ts'
import { ohneStreamingWeg, type OhneWegEintrag } from '@shared/ohne-weg.ts'
import { loadOhneWeg } from '../../lib/data.ts'
import { useLang } from '../../lib/i18n.tsx'
import { ohneWegText } from './ohne-weg.ts'

/** Eine leise Zeile unter dem Antwort-Kasten: warum ein Titel ohne Streaming-Weg keinen hat. Die Datei wird erst für so einen Titel geladen. */
export function OhneWegHinweis({ title }: { title: Title }) {
  const { t } = useLang()
  const gefragt = ohneStreamingWeg(title)
  const [fund, setFund] = useState<{ id: number; eintrag?: OhneWegEintrag }>()

  useEffect(() => {
    if (!gefragt) return
    let alive = true
    loadOhneWeg(title.id).then((eintrag) => {
      if (alive) setFund({ id: title.id, eintrag })
    })
    return () => {
      alive = false
    }
  }, [gefragt, title.id])

  if (!gefragt || fund?.id !== title.id || !fund.eintrag) return null
  return (
    <p data-ohne-weg={fund.eintrag.reason} className="mt-2 text-t4 text-ak-leise">
      {ohneWegText(fund.eintrag, t)}
    </p>
  )
}
