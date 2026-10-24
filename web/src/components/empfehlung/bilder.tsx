import { useEffect, useState } from 'react'
import type { Title } from '@shared/types.ts'
import { coverBild } from '../../lib/cover.ts'
import './empfehlung.css'

/** Banner in der gewünschten TMDB-Breite; AniList-Banner und fehlende bleiben, wie sie sind. */
export function bannerUrl(t: Title | undefined, breite: 300 | 780 | 1280): string | undefined {
  return t?.bannerImage?.replace(/\/t\/p\/w\d+\//, `/t/p/w${breite}/`)
}

/** Cover als `<img>`-Attribute in der Größe, in der es gezeigt wird. */
export function Cover({ titel, breite, klasse, hoch }: { titel?: Title; breite: number; klasse?: string; hoch?: boolean }) {
  const bild = coverBild(titel?.coverImage, breite)
  if (!bild.src) return <span className={klasse} aria-hidden />
  return <img {...bild} alt="" decoding="async" loading={hoch ? undefined : 'lazy'} fetchPriority={hoch ? 'high' : undefined} className={klasse} />
}

/** Farbschein hinter allem: zwei stehende Lagen, die nur per Deckkraft wechseln (kein animierter Filter). */
export function Hintergrund({ url }: { url?: string }) {
  const [lagen, setLagen] = useState<{ urls: [string?, string?]; an: 0 | 1 }>({ urls: [], an: 1 })
  useEffect(() => {
    if (!url) return
    setLagen((l) => {
      if (l.urls[l.an] === url) return l
      const an = l.an === 0 ? 1 : 0
      const urls: [string?, string?] = [l.urls[0], l.urls[1]]
      urls[an] = url
      return { urls, an }
    })
  }, [url])
  return (
    <div className="empf-hg" aria-hidden>
      {[0, 1].map((i) => (
        <div key={i} className={`empf-hg-lage ${lagen.an === i && lagen.urls[i] ? 'an' : ''}`} style={lagen.urls[i] ? { backgroundImage: `url(${lagen.urls[i]})` } : undefined} />
      ))}
    </div>
  )
}
