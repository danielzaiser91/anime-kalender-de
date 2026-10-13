import { PLATFORMS } from '@shared/types.ts'
import { folgeGemeinsam, zeitGemeinsam, zeitText, type AnbieterKachel } from '../../lib/anbieter-kachel.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { anbieterUndFolge, nurFolge, weitereFolgen } from './Marken.tsx'

/**
 * Die Angaben unter dem Titel, wenn ein Titel am selben Tag bei mehreren Anbietern erscheint. Was für alle gleich ist, steht
 * einmal: stimmen Folge und Zeit überein, genügt eine Zeile mit allen Namen („Crunchyroll, Prime Video · Folge 2/≈12");
 * weicht nur die Zeit ab, steht die Folge einmal oben. Sonst steht je Anbieter eine Zeile mit Farbpunkt, Folge und — wenn sie
 * abweicht — Uhrzeit. Die Farbe trägt nie allein: der Name steht immer im Text.
 */
export function AnbieterAngaben({ kachel, t }: { kachel: AnbieterKachel; t: Translate }) {
  const folgeEinmal = folgeGemeinsam(kachel)
  const zeitEinmal = zeitGemeinsam(kachel)
  const folge = [nurFolge(kachel[0]![0]!, t), weitereFolgen(kachel[0], t)].filter(Boolean).join(' · ')
  if (folgeEinmal && zeitEinmal) {
    const namen = kachel.map((b) => PLATFORMS[b[0]!.platform].name).join(', ')
    return <span>{`${namen}${folge ? ` · ${folge}` : ''}`}</span>
  }
  return (
    <span className="flex basis-full flex-col gap-0.5">
      {folgeEinmal && folge && <span>{folge}</span>}
      {kachel.map((b) => {
        const kopf = b[0]!
        const text = folgeEinmal ? PLATFORMS[kopf.platform].name : [anbieterUndFolge(kopf, t), weitereFolgen(b, t)].filter(Boolean).join(' · ')
        const zeit = zeitEinmal ? '' : zeitText(kopf)
        return (
          <span key={kopf.id} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: PLATFORMS[kopf.platform].color }} />
            <span>{`${text}${zeit ? ` · ${zeit}` : ''}`}</span>
          </span>
        )
      })}
    </span>
  )
}
