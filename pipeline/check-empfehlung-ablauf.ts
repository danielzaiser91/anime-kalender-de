/**
 * Zusicherungen zum Ablauf der Ansicht „Entdecken“ (`web/src/lib/empfehlung-ablauf.ts`, `empfehlung-aktionen.ts`), den die Hooks
 * der Ansicht nur aufrufen: Phasenwechsel Duell → Ergebnis, Ziel 6/10, Zurück, ✕/✓ mit Nachrücken, Mengen fortschreiben,
 * Zurückholen. Läuft über die echten Kernfunktionen an einer erfundenen Pool-Datei. Aufruf: `npm run check:logic`.
 */
import type { EmpfehlungsDatei, Kandidat } from '../shared/empfehlung-pool.ts'
import type { Antwort } from '../shared/empfehlung-kern.ts'
import { baueKontext } from '../shared/empfehlung-vektor.ts'
import { baueAktionen, fuegeHinzu, nimmWeg, type IdMenge } from '../web/src/lib/empfehlung-aktionen.ts'
import {
  ANFANG, antworten, duellZurueck, entfernen, genauerMachen, kannGenauer, neueReise, oeffnen, zuPhase, type Ablauf,
} from '../web/src/lib/empfehlung-ablauf.ts'
import { rangliste } from '../web/src/lib/empfehlung-reise.ts'
import { baueVerzoegerung, fuehreTasteAus, geheZurueck, tasteZuAktion, type TastenEreignis } from '../web/src/lib/empfehlung-bedienung.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

function kulisse(): EmpfehlungsDatei {
  const einstiege: Kandidat[] = []
  for (let i = 0; i < 60; i++) {
    einstiege.push({
      id: 900300 + i,
      n: `Titel ${i}`,
      f: i % 5 === 0 ? 'MOVIE' : 'TV',
      y: 2000 + ((i * 7) % 25),
      e: 1 + ((i * 5) % 40),
      g: [i % 8, (i * 3 + 1) % 8],
      k: [(i * 5) % 8, (i + 2) % 8],
      fsk: [0, 6, 12, 16][i % 4],
      v: 70,
      p: [['netflix']],
      duell: true,
    })
  }
  const genres = ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Romance', 'Fantasy', 'Horror', 'Sport']
  const keywords = ['Schule', 'Magie', 'Gegenwart', 'Isekai', 'Weltraum', 'Slapstick', 'Rache', 'Musik']
  return { pool: 70, genres, keywords, einstiege, reihe: {} }
}
const k = baueKontext(kulisse())
const rang = (z: Parameters<Parameters<typeof antworten>[3]>[0]): Kandidat[] => rangliste(k, z, [], new Set())
const ids = (liste: Kandidat[]): number[] => liste.map((x) => x.id)

/** Spielt `n` Antworten nacheinander; liefert den Ablauf nach jeder. */
function spiele(start: Ablauf, antwortenListe: Antwort[]): Ablauf[] {
  const stufen: Ablauf[] = []
  let a = start
  for (const antwort of antwortenListe) {
    a = antworten(k, a, antwort, rang)
    stufen.push(a)
  }
  return stufen
}

console.log('Start und neue Reise')
pruefe('Anfang: Phase start, Ziel 6, Galerie leer', ANFANG.phase === 'start' && ANFANG.ziel === 6 && ANFANG.gezeigt.length === 0)
const start = neueReise(k, { ...ANFANG, gezeigt: [1, 2], aktuell: 7 }, 5, [900300, 900301])
pruefe('neue Reise: Phase duell, Sitzung da, ohne die zwei Ausgeschlossenen', start.phase === 'duell' && start.sitzung?.zustand.rest.length === 58, start.sitzung?.zustand.rest.length)
pruefe('neue Reise: aktuell zurückgesetzt, Galerie bleibt', start.aktuell === undefined && gleich(start.gezeigt, [1, 2]))
pruefe('neue Reise setzt das Ziel von 10 auf 6', neueReise(k, { ...start, ziel: 10 }, 5, []).ziel === 6)
pruefe('antworten ohne Sitzung ändert nichts', antworten(k, ANFANG, 'A', rang) === ANFANG)

console.log('Duelle bis zu den Vorschlägen')
const verlauf = spiele(start, ['A', 'N', 'B', 'A', 'B', 'B', 'A'])
const fertigIndex = verlauf.findIndex((a) => a.phase === 'ergebnis')
pruefe('Ergebnis nach genau 6 gewerteten Duellen (das neutrale zählt nicht): 7. Antwort', fertigIndex === 6, fertigIndex)
pruefe('davor bleibt es im Duell, die Galerie unverändert', verlauf.slice(0, 6).every((a) => a.phase === 'duell' && gleich(a.gezeigt, [1, 2])))
pruefe('„Andere Vorschläge“ erhöht die gewerteten nicht', verlauf[1].sitzung!.zustand.gewertet === 1)
const ende = verlauf[6]
pruefe('Galerie = die ersten fünf der Rangliste des Endzustands', gleich(ende.gezeigt, ids(rang(ende.sitzung!.zustand)).slice(0, 5)), ende.gezeigt)
pruefe('Galerie ohne Titel aus den Duellen', ende.gezeigt.every((id) => !ende.sitzung!.zustand.gesehen.map((i) => 900300 + i).includes(id)))

console.log('Genauer, Ziel 10')
const genauer = genauerMachen(ende)
pruefe('genauer: Ziel 10, Phase duell, Sitzung bleibt', genauer.ziel === 10 && genauer.phase === 'duell' && genauer.sitzung === ende.sitzung)
pruefe('genauer bei 10 bleibt 10', genauerMachen(genauer).ziel === 10)
pruefe('genauer ohne Sitzung ändert nichts', genauerMachen(ANFANG) === ANFANG)
const weiter = spiele(genauer, ['A', 'B', 'A', 'B'])
pruefe('mit Ziel 10: nach 3 weiteren Duellen noch Duell, nach dem 4. Ergebnis', weiter.slice(0, 3).every((a) => a.phase === 'duell') && weiter[3].phase === 'ergebnis', weiter.map((a) => a.phase))
pruefe('kannGenauer: am Start ja, nach 6 ja, nach 10 gewerteten nein', kannGenauer(k, start) && kannGenauer(k, ende) && !kannGenauer(k, weiter[3]))
pruefe('kannGenauer ohne Sitzung nein', !kannGenauer(k, ANFANG))

console.log('Zurück')
const z1 = verlauf[0]
const zurueck = duellZurueck(z1)
pruefe('Zurück stellt den Zustand vor dem Duell her', gleich(zurueck.sitzung!.zustand, start.sitzung!.zustand))
pruefe('Zurück am Anfang bleibt', duellZurueck(start).sitzung!.zustand === start.sitzung!.zustand)
pruefe('Zurück ohne Sitzung ändert nichts', duellZurueck(ANFANG) === ANFANG)

console.log('✕/✓ und Leinwand')
const ersetzt = entfernen({ ...ende, phase: 'leinwand' }, ende.gezeigt[2], rang(ende.sitzung!.zustand))
pruefe('entfernen: Phase ergebnis, Platz bleibt, der sechste rückt ein', ersetzt.phase === 'ergebnis' && gleich(ersetzt.gezeigt, [...ende.gezeigt.slice(0, 2), ids(rang(ende.sitzung!.zustand))[5], ...ende.gezeigt.slice(3)]), ersetzt.gezeigt)
pruefe('entfernen: ohne Ersatz rückt die Galerie zusammen', gleich(entfernen(ende, ende.gezeigt[0], []).gezeigt, ende.gezeigt.slice(1)))
pruefe('öffnen: Phase leinwand, Titel gemerkt', oeffnen(ende, 42).phase === 'leinwand' && oeffnen(ende, 42).aktuell === 42)
pruefe('zuPhase wechselt nur die Phase', zuPhase(ende, 'start').phase === 'start' && zuPhase(ende, 'start').gezeigt === ende.gezeigt)

console.log('Aktionen und Mengen')
function menge(start: number[]): IdMenge & { inhalt: () => number[]; gespeichert: Set<number> } {
  const speicher = { s: new Set(start) }
  return {
    read: () => speicher.s,
    write: (ids) => {
      speicher.s = ids
    },
    inhalt: () => [...speicher.s].sort((a, b) => a - b),
    get gespeichert() {
      return speicher.s
    },
  }
}
const gesehen = menge([5])
const verworfen = menge([6])
const entfernt: number[] = []
const favoriten: number[] = []
const geoeffnet: number[] = []
const aktionen = baueAktionen({ gesehen, verworfen, favorit: (id) => favoriten.push(id), oeffne: (id) => geoeffnet.push(id), entferne: (id) => entfernt.push(id) })
aktionen.gesehen(11)
pruefe('gesehen: in der Gesehen-Menge, alte bleiben, nicht bei den Verworfenen, Galerie rückt nach', gleich(gesehen.inhalt(), [5, 11]) && gleich(verworfen.inhalt(), [6]) && gleich(entfernt, [11]))
aktionen.nein(12)
pruefe('nein: in der Verworfenen-Menge, nicht bei Gesehen, Galerie rückt nach', gleich(verworfen.inhalt(), [6, 12]) && gleich(gesehen.inhalt(), [5, 11]) && gleich(entfernt, [11, 12]))
aktionen.favorit(13)
aktionen.oeffne(14)
pruefe('favorit und öffne reichen die Kennung durch, ohne Menge und Nachrücken', gleich(favoriten, [13]) && gleich(geoeffnet, [14]) && entfernt.length === 2)
aktionen.gesehen(11)
pruefe('zweimal gesehen: Menge bleibt gleich', gleich(gesehen.inhalt(), [5, 11]))
const vorher = new Set([1, 2, 3])
const m = menge([])
m.write(vorher)
nimmWeg(m, 2)
pruefe('Zurückholen: nur diese Kennung weg', gleich(m.inhalt(), [1, 3]))
pruefe('Zurückholen verändert die gelesene Menge nicht (neue Menge geschrieben)', gleich([...vorher], [1, 2, 3]) && m.gespeichert !== vorher)
nimmWeg(m, 99)
pruefe('Zurückholen einer unbekannten Kennung ändert nichts', gleich(m.inhalt(), [1, 3]))
fuegeHinzu(m, 4)
pruefe('fuegeHinzu: schreibt eine neue Menge mit allen alten', gleich(m.inhalt(), [1, 3, 4]))

// Verzögerte Antwort im Duell: Timer läuft, dann Zurück/Weg
let uhr = 0
let nextId = 1
const geplant = new Map<number, { f: () => void; ab: number }>()
const verz = baueVerzoegerung(
  (f, ms) => { geplant.set(nextId, { f, ab: uhr + ms }); return nextId++ },
  (h) => void geplant.delete(h),
)
const vergeh = (ms: number) => {
  uhr += ms
  for (const [h, e] of [...geplant]) if (e.ab <= uhr) { geplant.delete(h); e.f() }
}
let antwortLief = 0
verz.start(() => antwortLief++, 380)
vergeh(100)
verz.stopp()
vergeh(1000)
pruefe('Timer läuft, dann Zurück: die alte Antwort feuert nicht mehr', antwortLief === 0)
verz.start(() => antwortLief++, 380)
vergeh(379)
pruefe('Ohne Zurück: vor Ablauf keine Antwort', antwortLief === 0)
vergeh(1)
pruefe('Ohne Zurück: genau nach 380 ms feuert die Antwort einmal', antwortLief === 1)
verz.stopp()
verz.stopp()
pruefe('stopp ohne laufenden Timer ist harmlos', antwortLief === 1 && geplant.size === 0)
verz.start(() => antwortLief += 10, 50)
verz.start(() => antwortLief += 100, 50)
vergeh(500)
pruefe('Neuer Start ersetzt den laufenden (nur eine Antwort)', antwortLief === 101)

// Tastatur der Leinwand
const taste = (key: string, mehr: Partial<TastenEreignis> = {}): string | undefined =>
  tasteZuAktion({ key, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ziel: 'BODY', ...mehr })
pruefe('Tasten ohne Modifikator: Pfeile, G, Esc', gleich(['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'g', 'G', 'Escape'].map((k) => taste(k)), ['favorit', 'nein', 'runter', 'hoch', 'gesehen', 'gesehen', 'zurueck']))
pruefe('Alt+← (Browser zurück) löst nichts aus', taste('ArrowLeft', { altKey: true }) === undefined)
pruefe('Alt+→ löst nichts aus', taste('ArrowRight', { altKey: true }) === undefined)
pruefe('Strg+G und Meta+G (Suche) lösen nichts aus', taste('g', { ctrlKey: true }) === undefined && taste('g', { metaKey: true }) === undefined)
pruefe('Umschalt+Pfeil löst nichts aus', taste('ArrowLeft', { shiftKey: true }) === undefined)
pruefe('Aus einem Eingabefeld löst nichts aus', taste('g', { ziel: 'INPUT' }) === undefined && taste('ArrowLeft', { ziel: 'TEXTAREA' }) === undefined && taste('Escape', { ziel: 'SELECT' }) === undefined)
pruefe('G mit Fokus auf einem Button löst nichts aus, Pfeil schon', taste('g', { ziel: 'BUTTON' }) === undefined && taste('ArrowLeft', { ziel: 'BUTTON' }) === 'nein')
pruefe('Andere Taste löst nichts aus', taste('x') === undefined)

// Verdrahtung der Handler (laufen wirklich, in dieser Reihenfolge)
console.log('Duell-Zurück und Tasten-Verdrahtung')
const spur: string[] = []
geheZurueck({ stopp: () => spur.push('stopp') }, () => spur.push('loesche'), () => spur.push('zurueck'))
pruefe('Zurück: stoppt Timer, löscht Wahl, geht zurück – genau so, in dieser Reihenfolge', gleich(spur, ['stopp', 'loesche', 'zurueck']))
const namen = ['favorit', 'nein', 'runter', 'hoch', 'gesehen', 'zurueck'] as const
const tun = (): Record<(typeof namen)[number], () => void> => {
  const r = {} as Record<(typeof namen)[number], () => void>
  for (const n of namen) r[n] = () => void spur.push(n)
  return r
}
for (const n of namen) {
  spur.length = 0
  fuehreTasteAus(n, tun())
  pruefe(`Taste-Aktion „${n}“ ruft genau ihren Handler`, gleich(spur, [n]))
}
spur.length = 0
fuehreTasteAus(undefined, tun())
pruefe('Ohne Aktion läuft kein Handler', spur.length === 0)
spur.length = 0
fuehreTasteAus(tasteZuAktion({ key: 'ArrowLeft', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ziel: 'BODY' }), tun())
pruefe('Pfeil links über die ganze Kette: nur „nein“', gleich(spur, ['nein']))

if (verletzt > 0) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nEmpfehlung (Ablauf): Phasen, Ziel, Zurück, Nachrücken, Mengen und Zurückholen in Ordnung')
