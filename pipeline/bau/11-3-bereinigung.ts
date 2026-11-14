import { type IstTot } from '../lib/adresse-tot.ts'
import { type Title } from '../../shared/types.ts'
import { log } from '../lib/util.ts'
import { type AnisearchEintrag } from './01-quellen.ts'
import { type EntfernterVerweis } from './grundlagen.ts'
import {
  entferneFremdePrimeWege,
  entferneToteWegeSpaet,
  entferneWegeOhneDatum,
  ergaenzeWegeFuerTitelOhneWeg,
  ordneDigitaleShopsEin,
} from './11-3-1-wege-pruefen.ts'
import { entferneDoppelteWege, entferneWegeNachNein } from './11-3-2-doppelte-wege.ts'
import { entferneStummeYoutubeWege, entferneSuchadressen } from './11-3-3-youtube-und-suche.ts'

export function bereinigeWege({
  titles,
  anisearch,
  istTot,
  linkBefunde,
  verweiseEntfernt,
  crAdresseZu,
  beantworteteSuchen,
  suchOffen,
}: {
  titles: Map<number, Title>
  anisearch: Record<string, AnisearchEintrag>
  istTot: IstTot
  linkBefunde: Record<string, { status: number | string; prime?: boolean; geprueftAm?: string; }>
  verweiseEntfernt: EntfernterVerweis[]
  crAdresseZu: (name: string) => string | undefined
  beantworteteSuchen: Set<string>
  suchOffen: { id: number; titel: string; plattform: string; url: string; }[]
}) {
  ergaenzeWegeFuerTitelOhneWeg({ titles, anisearch, istTot })

  entferneWegeOhneDatum({ titles })

  entferneToteWegeSpaet({ titles, linkBefunde })

  ordneDigitaleShopsEin({ titles })

  entferneFremdePrimeWege({ titles })

  entferneDoppelteWege({ titles })
  entdoppleCrWege(titles)

  entferneWegeNachNein({ verweiseEntfernt, titles })

  entferneStummeYoutubeWege({ titles })


  entferneSuchadressen({ titles, crAdresseZu, beantworteteSuchen, suchOffen })
}

/**
 * **Zwei Wege auf dieselbe Serienkennung sind einer** (02.10.2026).
 *
 * Overgeared und Re:Zero Staffel 4 trugen dieselbe Crunchyroll-Serie zweimal — einmal in der kurzen
 * Form (`/de/series/GT00384004`, aus dem Simulcast-Slot) und einmal in der ausgeschriebenen
 * (`/de/series/GT00384004/overgeared`, aus dem Katalog). Der Block darüber vergleicht nur Verweise
 * gegen Bezugswege **über die Adresse** — zwei Schreibweisen derselben Serie sind für ihn zwei
 * Adressen.
 *
 * Gemessen am 02.10.2026: genau zwei Titel. **Der Weg mit Sprachurteil bleibt**, er trägt die
 * Auskunft; die Reihenfolge sonst unverändert. Rückgabe ist die Zahl der entfernten Wege.
 *
 * **Ein Folgen-Link (`/watch/…`) geht in der Serienseite auf** (01.11.2026, The Vermilion Mask: „Crunchyroll ✓ Deutsch“ und
 * darunter „nur Untertitel“ mit dem JustWatch-Link `/watch/GE00384363JAJP`): Hat der Titel eine Serienadresse, entfällt jeder
 * Crunchyroll-Weg ohne Serienkennung.
 */
export function entdoppleCrWege(titles: Map<number, Title>): number {
  const kennung = (u: string): string | undefined => /\/series\/([A-Z0-9]+)/i.exec(u)?.[1]?.toLowerCase()
  let entfernt = 0
  for (const title of titles.values()) {
    if ((title.streams?.length ?? 0) < 2) continue
    const hatSerie = title.streams.some((s) => s.platform === 'crunchyroll' && kennung(s.url))
    const gesehen = new Map<string, (typeof title.streams)[number]>()
    const behalten = new Set<(typeof title.streams)[number]>()
    for (const s of title.streams) {
      const k = s.platform === 'crunchyroll' ? kennung(s.url) : undefined
      if (!k && s.platform === 'crunchyroll' && hatSerie) continue
      if (!k) {
        behalten.add(s)
        continue
      }
      const bisher = gesehen.get(k)
      if (!bisher) {
        gesehen.set(k, s)
        behalten.add(s)
        continue
      }
      if (bisher.dub === undefined && s.dub !== undefined) {
        behalten.delete(bisher)
        behalten.add(s)
        gesehen.set(k, s)
      }
    }
    const neu = title.streams.filter((s) => behalten.has(s))
    if (neu.length < title.streams.length) {
      entfernt += title.streams.length - neu.length
      title.streams = neu
    }
  }
  if (entfernt) log(`${entfernt} Crunchyroll-Wege entfernt, die dieselbe Serie in zwei Schreibweisen nannten`)
  return entfernt
}
