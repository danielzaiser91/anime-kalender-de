import { useEffect, useState } from 'react'
import type { Title } from '@shared/types.ts'
import { ohneStreamingWeg, type OhneWegEintrag } from '@shared/ohne-weg.ts'
import { loadOhneWeg, ohneWegText } from './ohne-weg.ts'

/** Eine leise Zeile unter dem Antwort-Kasten: warum ein Titel ohne Streaming-Weg keinen hat. Die Datei wird erst für so einen Titel geladen. */
export function OhneWegHinweis({ title }: { title: Title }) {
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

  const satz = gefragt && fund?.id === title.id && fund.eintrag ? ohneWegText(fund.eintrag) : undefined
  if (!fund?.eintrag || !satz) return null
  return (
    <p data-ohne-weg={fund.eintrag.reason} className="mt-2 text-t4 text-ak-leise">
      {satz}
    </p>
  )
}
