/**
 * Bestandsteil zum Falten der Cartoon-Wege: Das Panel (`sortiereNachZugang`) zeigt für Om Nom Stories nicht mehr 56 Pillen,
 * und Jack behält seine drei Netflix-Pillen mit je eigenem Haken. Die Zeilen selbst (`streamZeilen`, Aufrufer von `teilAngaben`)
 * stehen einmal je Angabe da: Jack „Fg. 2–11 · Staffel 2", nie zusätzlich „Flg. 2–11". Fängt die Aufrufer, die
 * `check-cartoon-wege-falten.ts` nicht sieht. Läuft in `check:bestand`.
 */
import type { ReactElement } from 'react'
import { sortiereNachZugang } from '../web/src/components/detail/wege-sortieren.ts'
import { streamZeilen } from '../web/src/components/detail/wege-zeilen.tsx'
import { folgenAuskunft } from '../web/src/components/detail/folgen-angabe.ts'
import { translate } from '../web/src/lib/i18n.tsx'
import { todayIso } from '../shared/time.ts'
import { readJson } from './lib/util.ts'
import type { Release, Title } from '../shared/types.ts'

const OM_NOM = -57480
const JACK = -92684
const MAX_PILLEN_OM_NOM = 12

const cartoons = readJson<Title[]>('public/data/cartoons.json', [])
const pillen = (id: number) =>
  sortiereNachZugang({ title: cartoons.find((t) => t.id === id) }).flatMap((g) => g.plattformen)
let fehler = 0
function pruefe(ok: boolean, text: string): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${text}`)
}

/** Unterzeile und Tooltip jeder Stream-Pille, wie sie das Panel zusammensetzt (echte Daten, echte Texte, ohne Termine). */
function zeilenTexte(title: Title): { name: string; unten: string; titel: string }[] {
  const t = translate
  const releases: Release[] = []
  const heute = todayIso()
  const zeilen = streamZeilen({
    sortiertNachZugang: sortiereNachZugang({ title }),
    title,
    t,
    today: heute,
    folgenAngabeFuer: folgenAuskunft({ releases, title, t, releaseJePlattform: new Map(), today: heute }),
    dubZeilen: () => [],
    releaseJePlattform: new Map(),
    streamReleases: [],
    releases,
    tvVorbei: [],
  }) as ReactElement<{ name: string; unten?: string; titel?: string }>[]
  return zeilen.filter((z) => z.props.name !== undefined).map((z) => ({ name: z.props.name, unten: z.props.unten ?? '', titel: z.props.titel ?? '' }))
}
const vorkommen = (text: string, muster: RegExp) => text.match(muster)?.length ?? 0

const om = pillen(OM_NOM)
if (om.length === 0) {
  console.log('Cartoon-Wege falten (Bestand): Om Nom Stories nicht im Bestand, übersprungen')
} else {
  if (om.length > MAX_PILLEN_OM_NOM) {
    fehler++
    console.error(`FEHLER: Om Nom Stories zeigt ${om.length} Pillen (höchstens ${MAX_PILLEN_OM_NOM})`)
  }
  const jack = pillen(JACK).filter((s) => s.platform === 'netflix')
  if (jack.length !== 3 || jack.some((s) => !s.dub)) {
    fehler++
    console.error(`FEHLER: Jack zeigt ${jack.length} Netflix-Pillen mit Haken, erwartet 3`)
  }

  // Die Zeilen: Staffel und Folgen stehen je Pille genau einmal.
  const omZeilen = zeilenTexte(cartoons.find((x) => x.id === OM_NOM)!).filter((z) => z.unten.includes('Flg.'))
  pruefe(omZeilen.length >= 4, `Om Nom: ${omZeilen.length} Zeilen mit Folgenausschnitt, erwartet mindestens 4`)
  for (const z of omZeilen) {
    pruefe(/Staffel \d/.test(z.unten), `Om Nom ${z.name}: keine Staffelangabe in „${z.unten}“`)
    pruefe(vorkommen(z.unten, /Flg\./g) === 1, `Om Nom ${z.name}: „Flg.“ nicht genau einmal in „${z.unten}“`)
    pruefe(!z.unten.includes('Dieser Eintrag'), `Om Nom ${z.name}: Tooltip-Text in der Unterzeile „${z.unten}“`)
    pruefe(z.titel.includes('Dieser Eintrag umfasst dort die Folge'), `Om Nom ${z.name}: Tooltip nennt den Ausschnitt nicht: „${z.titel}“`)
  }
  const jackZeilen = zeilenTexte(cartoons.find((x) => x.id === JACK)!).filter((z) => z.name === 'Netflix')
  pruefe(jackZeilen.length === 3, `Jack: ${jackZeilen.length} Netflix-Zeilen, erwartet 3`)
  for (const z of jackZeilen) {
    pruefe(vorkommen(z.unten, /Fg\./g) === 1 && !z.unten.includes('Flg.'), `Jack: Folgen nicht genau einmal in „${z.unten}“`)
    pruefe(/Staffel \d/.test(z.unten), `Jack: keine Staffelangabe in „${z.unten}“`)
    pruefe(z.titel.includes('Dieser Eintrag umfasst dort die Folge'), `Jack: Tooltip nennt den Ausschnitt nicht: „${z.titel}“`)
  }
}

if (fehler) process.exit(1)
console.log('Cartoon-Wege falten (Bestand): Zusicherungen erfüllt')
