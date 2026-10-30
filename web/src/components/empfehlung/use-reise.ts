import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Antwort } from '@shared/empfehlung-kern.ts'
import type { Kandidat } from '@shared/empfehlung-pool.ts'
import type { Kontext } from '@shared/empfehlung-vektor.ts'
import {
  ANFANG, antworten, duellZurueck, entfernen, fortfahren, genauerMachen, kannGenauer, neueReise, oeffnen, vorschauIds, zuPhase, zuStart, type Ablauf, type Phase,
} from '../../lib/empfehlung-ablauf.ts'
import { reiseMerken, reiseVergessen, reiseWiederherstellen } from '../../lib/empfehlung-reise-speicher.ts'
import { ausgeschlossenFuerReise, rangliste, stand, type Stand } from '../../lib/empfehlung-reise.ts'
import { gesehenLesen } from '../../lib/gesehen.ts'

interface Mengen {
  favoriten: Set<number>
  ausgeblendet: Set<number>
  gesehen: Set<number>
  verworfen: Set<number>
  eigene: string[]
}

/** Verbindet den Ablauf (`empfehlung-ablauf.ts`) mit React: Zustand halten, Rangliste aus den aktuellen Mengen rechnen. */
export function useReise(kontext: Kontext | undefined, m: Mengen, startwert: () => number) {
  const [a, setA] = useState<Ablauf>(ANFANG)
  const eigene = useMemo(() => new Set(m.eigene), [m.eigene])
  const weg = useMemo(() => [...m.verworfen, ...m.gesehen], [m.verworfen, m.gesehen])
  const rang = useMemo<Kandidat[]>(
    () => (kontext && a.sitzung ? rangliste(kontext, a.sitzung.zustand, weg, eigene) : []),
    [kontext, a.sitzung, weg, eigene],
  )
  /* Einmal beim Laden der Daten: gemerkte Vorschläge wieder aufschlagen (vor dem ersten Bild, kein Aufblitzen der Einleitung). */
  const versucht = useRef(false)
  useLayoutEffect(() => {
    if (!kontext || versucht.current) return
    versucht.current = true
    const gemerkt = reiseWiederherstellen(kontext, new Set(weg), undefined, eigene)
    if (gemerkt) setA(gemerkt)
  }, [kontext, weg, eigene])
  useEffect(() => reiseMerken(a, kontext), [a, kontext])
  const aendere = (f: (alt: Ablauf, k: Kontext) => Ablauf) => kontext && setA((alt) => f(alt, kontext))
  const neu = () => {
    const aus = ausgeschlossenFuerReise({ favoriten: m.favoriten, gesehen: m.gesehen, ausgeblendet: m.ausgeblendet, gesehenBis: gesehenLesen() })
    aendere((alt, k) => neueReise(k, alt, startwert(), aus))
  }
  return {
    phase: a.phase,
    sitzung: a.sitzung,
    ziel: a.ziel,
    gezeigt: a.gezeigt,
    aktuell: a.aktuell,
    eigene,
    stehen: kontext && a.sitzung ? stand(kontext, a.sitzung.zustand, a.ziel) : (undefined as Stand | undefined),
    kannGenauer: !!kontext && kannGenauer(kontext, a),
    setPhase: (phase: Phase) => setA((alt) => zuPhase(alt, phase)),
    neu,
    /** Neues Duell; nur die gemerkten Vorschläge gehen, Gesehenes und Verworfenes bleiben. */
    verwerfenUndNeu: () => {
      reiseVergessen()
      neu()
    },
    fortfahren: () => aendere((alt, k) => fortfahren(k, alt)),
    vorschau: kontext ? vorschauIds(kontext, a, rang) : [],
    /** Ob der Start etwas fortzusetzen hat (Vorschläge oder offenes Duell). */
    fortsetzbar: !!a.sitzung,
    vonVorn: () => setA(zuStart),
    antworte: (antwort: Antwort) => aendere((alt, k) => antworten(k, alt, antwort, (z) => rangliste(k, z, weg, eigene))),
    genauer: () => setA(genauerMachen),
    entferne: (id: number) => setA((alt) => entfernen(alt, id, rang)),
    zurueckDuell: () => setA(duellZurueck),
    oeffne: (id: number) => setA((alt) => oeffnen(alt, id)),
  }
}
