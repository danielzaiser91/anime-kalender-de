import { useLayoutEffect, useRef, type ComponentProps } from 'react'
import { titelSynchroAngekuendigt } from '@shared/ankuendigung.ts'
import { AntwortKastenMitMarke } from '../../src/components/detail/kasten-marke.tsx'
import { mockup } from '../register.ts'
import { KarteUnterKasten, ZeileImKasten } from './synchro-angekuendigt-teile.tsx'
import type { Ankuendigung } from './synchro-angekuendigt-text.ts'

type Kasten = ComponentProps<typeof AntwortKastenMitMarke>

/** Die Ankündigung, die der Kasten in seiner Nebenzeile nennt (Zustand „ohne“, nicht widerlegt); sonst bleibt der echte Kasten, wie er ist. */
function ankuendigungVon({ title, antwort }: Kasten): Ankuendigung | undefined {
  return titelSynchroAngekuendigt(title) && antwort.art === 'ohne' ? title.ankuendigung : undefined
}

/** Ohne die Pille des Ankündigungs-Anbieters: Der Anbieter steht schon in der Ankündigung (die Pillen tragen ihren Schlüssel `Anbieter|Adresse`). */
function ohnePille(p: Kasten, a: Ankuendigung): Kasten {
  const stream = (p.stream ?? []).filter((pille) => !String((pille as { key?: string })?.key ?? '').startsWith(`${a.platform}|`))
  return { ...p, stream }
}

/** Die Adresse der Serie beim Anbieter der Ankündigung. */
const anbieterUrl = (p: Kasten, a: Ankuendigung): string | undefined => (p.title.streams ?? []).find((s) => s.platform === a.platform)?.url

/** Blendet die Nebenzeile des echten Kastens aus (`p[title^="Laut "]`); die Ankündigung übernimmt sie. */
function nebenzeileAus(wurzel: HTMLElement | null, kastenKleiner: boolean): void {
  const neben = wurzel?.querySelector<HTMLElement>('section p[title^="Laut "]')
  if (neben) neben.hidden = true
  const kasten = wurzel?.querySelector<HTMLElement>('section')
  if (kasten && kastenKleiner) kasten.style.minHeight = '0'
}

/** Variante A: Kopf-Nebenzeile mit Link, Stand und Quelle, Knopf — alles im Kasten; die Pille entfällt. */
function KastenMitZeile(p: Kasten) {
  const wurzel = useRef<HTMLDivElement>(null)
  const a = ankuendigungVon(p)
  useLayoutEffect(() => {
    if (a) nebenzeileAus(wurzel.current, false)
  })
  if (!a) return <AntwortKastenMitMarke {...p} />
  const hinweis = (
    <>
      {p.hinweis}
      <ZeileImKasten a={a} anbieterUrl={anbieterUrl(p, a)} />
    </>
  )
  return (
    <div ref={wurzel}>
      <AntwortKastenMitMarke {...ohnePille(p, a)} hinweis={hinweis} />
    </div>
  )
}

/** Variante B: der Kasten nur mit der Überschrift; Ankündigung, Quelle und Knopf stehen in einer eigenen Karte darunter. */
function KastenMitKarte(p: Kasten) {
  const wurzel = useRef<HTMLDivElement>(null)
  const a = ankuendigungVon(p)
  useLayoutEffect(() => {
    if (a) nebenzeileAus(wurzel.current, true)
  })
  if (!a) return <AntwortKastenMitMarke {...p} />
  return (
    <div ref={wurzel} className="flex flex-col gap-3">
      <AntwortKastenMitMarke {...ohnePille(p, a)} />
      <KarteUnterKasten a={a} anbieterUrl={anbieterUrl(p, a)} />
    </div>
  )
}

mockup({
  name: 'synchro-angekuendigt-kasten',
  titel: 'Antwortkasten: Synchro angekündigt',
  ausschnitt: 'detailpanel',
  faelle: ['vermilion-mask', 'firefly-wedding', 'black-clover-s2'],
  varianten: {
    A: {
      ersatz: { AntwortKasten: KastenMitZeile },
      notiz: 'Im Kasten: Anbieter einmal (als Link zur Serie), darunter „Angekündigt, Stand … · Quelle“ und der Knopf „Bescheid bei Termin“; die Pille unter „Weitere Anbieter“ entfällt.',
    },
    B: {
      ersatz: { AntwortKasten: KastenMitKarte },
      notiz: 'Der Kasten behält nur die Überschrift; eine eigene Karte „Termin offen“ trägt Anbieter, Stand, Quelle und Knopf. Keine Pille mehr unter „Weitere Anbieter“.',
    },
  },
})
