import { useLayoutEffect, useRef, type ComponentProps } from 'react'
import { AntwortKastenMitMarke } from '../../src/components/detail/kasten-marke.tsx'
import { mockup } from '../register.ts'
import { angekuendigtMitNebenzeile, satzAlsUeberschrift, VORSTART, type Erscheinung, type Vorstartzeilen } from './antwortkasten-vorstart-text.ts'

type Kasten = ComponentProps<typeof AntwortKastenMitMarke>

/** „0 von 10 Folgen erschienen“ samt leerem Balken entfällt: „0“ wird nie gezeigt. */
function nullZaehlungEntfernen(wurzel: HTMLElement): void {
  for (const p of wurzel.querySelectorAll('section p')) if (/^0 von /.test(p.textContent ?? '')) p.remove()
  wurzel.querySelector('section div.rounded-full[aria-hidden="true"]')?.remove()
}

/**
 * Setzt die Überschrift (und die Nebenzeile) des echten Kastens auf den neuen Text. Der Kasten rechnet seine Zeilen
 * selbst; das Mockup tauscht nur den Text im fertigen Bild (die Seite bleibt unberührt, Weiche `AntwortKasten`).
 */
function setzeZeilen(wurzel: HTMLElement, zeilen: Vorstartzeilen): void {
  const haupt = wurzel.querySelector<HTMLElement>('section p.font-bold')
  if (!haupt) return
  haupt.textContent = zeilen.haupt
  nullZaehlungEntfernen(wurzel)
  const vorhanden = haupt.parentElement?.nextElementSibling
  const neben = vorhanden instanceof HTMLElement && vorhanden.tagName === 'P' ? vorhanden : null
  if (!zeilen.neben) {
    neben?.remove()
    return
  }
  if (neben) {
    neben.textContent = zeilen.neben
    return
  }
  const neu = document.createElement('p')
  neu.className = 'mt-0.5 text-t4 text-slate-500 dark:text-slate-400'
  neu.textContent = zeilen.neben
  haupt.parentElement?.after(neu)
}

function kastenMit(zeilenVon: (e: Erscheinung) => Vorstartzeilen) {
  return function VorstartKasten(eigenschaften: Kasten) {
    const wurzel = useRef<HTMLDivElement>(null)
    const erscheinung = VORSTART[eigenschaften.title.id]
    useLayoutEffect(() => {
      if (erscheinung && wurzel.current) setzeZeilen(wurzel.current, zeilenVon(erscheinung))
    })
    return (
      <div ref={wurzel}>
        <AntwortKastenMitMarke {...eigenschaften} />
      </div>
    )
  }
}

mockup({
  name: 'antwortkasten-vorstart',
  titel: 'Antwortkasten vor dem ersten deutschen Termin',
  ausschnitt: 'detailpanel',
  faelle: ['virgin-road', 'cyberpunk-edgerunners', 'tokyo-revengers'],
  varianten: {
    A: {
      ersatz: { AntwortKasten: kastenMit(satzAlsUeberschrift) },
      notiz: 'Solange keine deutsche Folge erschienen ist, steht der Satz „… erscheint am …“ als Überschrift; keine Zahl, keine Nebenzeile.',
    },
    B: {
      ersatz: { AntwortKasten: kastenMit(angekuendigtMitNebenzeile) },
      notiz: 'Überschrift „Deutsch angekündigt“, darunter das Datum als Nebenzeile.',
    },
  },
})
