/**
 * Bestandsteil zum Falten der Cartoon-Wege: Das Panel (`sortiereNachZugang`) zeigt für Om Nom Stories nicht mehr 56 Pillen,
 * und Jacks Bücher bleiben getrennte Pillen (jedes Rohstück trägt die Aussage seiner Pille); an jedem Cartoon gehen beim Falten keine Folgen verloren. Die Zeilen selbst (`streamZeilen`, Aufrufer von `teilAngaben`)
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
import type { Release, StreamLink, Title } from '../shared/types.ts'

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
/** Die Folgen, die die Teilwege eines Titels je Anbieter und Zugang abdecken (Adressen zusammen: `sortiereNachZugang` legt gleiche Wege zusammen). */
function abgedeckt(wege: StreamLink[]): Map<string, Set<number>> {
  const je = new Map<string, Set<number>>()
  for (const w of wege) {
    if (!w.teilBereich) continue
    const schluessel = `${w.platform}|${w.zugang ?? 'abo'}`
    const menge = je.get(schluessel) ?? new Set<number>()
    for (let f = w.teilBereich.von; f <= w.teilBereich.bis; f++) menge.add(f)
    je.set(schluessel, menge)
  }
  return je
}

/** Eigenes Orakel der Aussage einer Pille (bewusst nicht `aussage` aus wege-falten.ts): Urteil, Quelle, Haken-Bereiche, Zugang, Kanal, Entfernung, Teilung. */
const aussageVon = (w: StreamLink) =>
  JSON.stringify([w.dub, w.dubQuelle, w.dubHintOnly, JSON.stringify(w.dubRanges), w.zugang, w.kanal, w.entferntAm, w.sharedWith])

const umfasst = (pille: StreamLink, roh: StreamLink) =>
  pille.platform === roh.platform && pille.teilBereich !== undefined && roh.teilBereich !== undefined &&
  pille.teilBereich.von <= roh.teilBereich.von && roh.teilBereich.bis <= pille.teilBereich.bis

const schliessenAn = (a: StreamLink, b: StreamLink) =>
  a.platform === b.platform && a.url === b.url && a.teilBereich !== undefined && b.teilBereich !== undefined &&
  a.teilBereich.bis + 1 === b.teilBereich.von && aussageVon(a) === aussageVon(b)

/** Folgen je Anbieter und Zugang: keine geht beim Falten verloren, keine kommt hinzu. */
function pruefeAbdeckung(t: Title, gezeigt: StreamLink[]): void {
  const gefaltet = abgedeckt(gezeigt)
  for (const [weg, folgen] of abgedeckt(t.streams ?? [])) {
    const zeigt = gefaltet.get(weg)
    pruefe(zeigt?.size === folgen.size && [...folgen].every((f) => zeigt.has(f)), `${t.id} ${weg}: Folgen ${folgen.size} im Datensatz, ${zeigt?.size ?? 0} in den Pillen`)
  }
}

/** Jedes Rohstück trägt dieselbe Aussage wie eine Pille, die es abdeckt (verschiedene Belege bleiben getrennt); jede Pille hat eine Adresse des Anbieters. */
function pruefeAussagen(t: Title, gezeigt: StreamLink[]): void {
  const roh = (t.streams ?? []).filter((w) => w.teilBereich)
  for (const r of roh) {
    const decken = gezeigt.filter((p) => umfasst(p, r))
    pruefe(decken.some((p) => aussageVon(p) === aussageVon(r)), `${t.id} ${r.platform} Folgen ${r.teilBereich?.von}–${r.teilBereich?.bis}: keine Pille mit derselben Aussage`)
  }
  const adressen = new Set((t.streams ?? []).map((w) => `${w.platform}|${w.url}`))
  for (const p of gezeigt) pruefe(adressen.has(`${p.platform}|${p.url}`), `${t.id} ${p.platform}: Adresse „${p.url}“ der Pille steht nicht im Datensatz`)
}

/** Eigenschaften der Faltung an jedem Cartoon: nichts geht verloren, nichts Faltbares bleibt getrennt, nichts Verschiedenes wird vermengt. */
function pruefeAlleCartoons(): void {
  for (const t of cartoons) {
    const gezeigt = sortiereNachZugang({ title: t }).flatMap((g) => g.plattformen)
    pruefeAbdeckung(t, gezeigt)
    pruefeAussagen(t, gezeigt)
    const getrennt = gezeigt.some((a) => gezeigt.some((b) => schliessenAn(a, b)))
    pruefe(!getrennt, `${t.id}: zwei Pillen, die zusammengehören`)
  }
}
const vorkommen = (text: string, muster: RegExp) => text.match(muster)?.length ?? 0

/** Jacks Netflix-Zeilen: je Pille eine Zeile; wo die Pille ein Teilweg ist, stehen Folgen und Staffel genau einmal und der Tooltip nennt den Ausschnitt. */
function pruefeJackZeilen(): void {
  const titel = cartoons.find((x) => x.id === JACK)
  const netflix = pillen(JACK).filter((s) => s.platform === 'netflix')
  if (!titel || !netflix.some((s) => s.teilBereich)) return
  const zeilen = zeilenTexte(titel).filter((z) => z.name === 'Netflix')
  pruefe(zeilen.length === netflix.length, `Jack: ${zeilen.length} Netflix-Zeilen für ${netflix.length} Netflix-Pillen`)
  zeilen.forEach((z, i) => {
    if (!netflix[i]?.teilBereich) return
    pruefe(vorkommen(z.unten, /Fg\./g) === 1 && !z.unten.includes('Flg.'), `Jack: Folgen nicht genau einmal in „${z.unten}“`)
    pruefe(/Staffel \d/.test(z.unten), `Jack: keine Staffelangabe in „${z.unten}“`)
    pruefe(z.titel.includes('Dieser Eintrag umfasst dort die Folge'), `Jack: Tooltip nennt den Ausschnitt nicht: „${z.titel}“`)
  })
}

/** Om-Nom-Anker: Pillenzahl, Staffel und Folgen je Zeile; übersprungen, wenn der Titel im Bestand fehlt (die Eigenschaften aller Cartoons laufen trotzdem). */
function pruefeOmNom(): void {
  const om = pillen(OM_NOM)
  if (om.length === 0) {
    console.log('Cartoon-Wege falten (Bestand): Om Nom Stories nicht im Bestand, Anker übersprungen')
    return
  }
  pruefe(om.length <= MAX_PILLEN_OM_NOM, `Om Nom Stories zeigt ${om.length} Pillen (höchstens ${MAX_PILLEN_OM_NOM})`)
  // Die Zeilen: Staffel und Folgen stehen je Pille genau einmal.
  const omZeilen = zeilenTexte(cartoons.find((x) => x.id === OM_NOM)!).filter((z) => z.unten.includes('Flg.'))
  // Eigenschaft statt Zahl: wie viele Ausschnitte JustWatch trennt, wechselt mit den Live-Daten (18.10.2026: 6 → 3).
  pruefe(omZeilen.length >= 1, 'Om Nom: keine Zeile mit Folgenausschnitt')
  for (const z of omZeilen) {
    pruefe(/Staffel \d/.test(z.unten), `Om Nom ${z.name}: keine Staffelangabe in „${z.unten}“`)
    pruefe(vorkommen(z.unten, /Flg\./g) === 1, `Om Nom ${z.name}: „Flg.“ nicht genau einmal in „${z.unten}“`)
    pruefe(!z.unten.includes('Dieser Eintrag'), `Om Nom ${z.name}: Tooltip-Text in der Unterzeile „${z.unten}“`)
    pruefe(z.titel.includes('Dieser Eintrag umfasst dort die Folge'), `Om Nom ${z.name}: Tooltip nennt den Ausschnitt nicht: „${z.titel}“`)
  }
}

pruefeAlleCartoons()
pruefeOmNom()
// Jacks Bücher haben je einen eigenen Beleg; ihre Getrenntheit prüft `pruefeAussagen`, hier nur der Haken (Vorhandensein und Anzahl wechseln mit den Daten).
const jack = pillen(JACK).filter((s) => s.platform === 'netflix' && s.teilBereich)
pruefe(jack.every((s) => s.dub), `Jack: ${jack.length} Netflix-Teilpillen, nicht jede mit Haken`)
pruefeJackZeilen()

if (fehler) process.exit(1)
console.log('Cartoon-Wege falten (Bestand): Zusicherungen erfüllt')
