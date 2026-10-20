/**
 * Zusicherung: Der Teil-Abgleich der Einzelwerk-Suche belegt gegen eine Serie nichts (Dorohedoro OVA, Persona 5 Special,
 * 20.10.2026). Läuft in `check:logic`; der Bau-Teil lässt `belegeEinzelwerke` (vom Bau aufgerufen) laufen.
 */
import { einzelwerkBelegt, katalogTrefferPasst, belegeEinzelwerke } from './lib/cr-einzelwerk-urteil.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const DE = ['de-DE', 'ja-JP']
// Echte Fälle aus PR 1691 (Daten der Einzelwerk-Suche), Art ergänzt wie der nächste Lauf sie liefert.
const dorohedoro = { id: 114622, titel: 'Dorohedoro: Teuflische Anekdoten', romaji: 'Dorohedoro: Ma no Omake', treffer: { titel: 'Dorohedoro', audio: DE } }
const persona = { id: 106169, titel: 'Persona 5 the Animation: Dunkle Sonne', en: 'PERSONA5 the Animation: Dark Sun...', treffer: { titel: 'PERSONA5 the Animation', audio: DE } }
const organ = { id: 20919, titel: 'Project Itoh: Genocidal Organ', en: 'Genocidal Organ', treffer: { titel: 'Genocidal Organ', audio: DE } }
const organTeil = { ...organ, en: undefined, treffer: { ...organ.treffer } }
const mitArt = (e: { treffer: object }, art: string) => ({ ...e, treffer: { ...e.treffer, art } })


console.log('Bau-Urteil (einzelwerkBelegt)')
pruefe('Dorohedoro (Serie, Teil-Abgleich) abgelehnt', !einzelwerkBelegt(mitArt(dorohedoro as never, 'series')))
pruefe('Persona 5 (Serie, Teil-Abgleich) abgelehnt', !einzelwerkBelegt(mitArt(persona as never, 'series')))
pruefe('Genocidal Organ (movie_listing) angenommen', einzelwerkBelegt(mitArt(organTeil, 'movie_listing')))
pruefe('Altdaten ohne Art: reiner Teil-Abgleich abgelehnt (Genocidal Organ, nur Titel)', !einzelwerkBelegt(organTeil))
pruefe('Altdaten ohne Art: Genocidal Organ über englischen Namen exakt = Ja', einzelwerkBelegt(organ))
pruefe('Altdaten ohne Art: Dorohedoro abgelehnt', !einzelwerkBelegt(dorohedoro as never))
const exaktSerie = { id: 1, titel: 'Dorohedoro', treffer: { titel: 'Dorohedoro', art: 'series', audio: DE } }
pruefe('exakter Name bleibt Ja, auch bei Serie', einzelwerkBelegt(exaktSerie))
pruefe('Altdaten: exakter Name (Normalisierung) ist Ja', einzelwerkBelegt({ ...exaktSerie, treffer: { titel: 'DOROHEDORO!', audio: DE } }))
pruefe('ohne de-DE kein Ja', !einzelwerkBelegt(mitArt({ ...organ, treffer: { titel: 'Genocidal Organ', audio: ['ja-JP'] } }, 'movie_listing')))
pruefe('ohne Treffer kein Ja', !einzelwerkBelegt({ titel: 'X', treffer: null }))

pruefe('nicht-lateinischer Titel, Serie, de-DE: kein Ja', !einzelwerkBelegt({ titel: '進撃', treffer: { titel: '進撃の巨人', art: 'series', audio: DE } }))
console.log('Sammler-Abgleich (katalogTrefferPasst)')
const namen = (e: { titel: string; en?: string; romaji?: string }) => [e.titel, e.en, e.romaji].filter(Boolean) as string[]
pruefe('Serie "Dorohedoro": kein Treffer', !katalogTrefferPasst({ title: 'Dorohedoro', type: 'series' }, namen(dorohedoro)).passt)
pruefe('Serie "PERSONA5 the Animation": kein Treffer', !katalogTrefferPasst({ title: 'PERSONA5 the Animation', type: 'series' }, namen(persona)).passt)
const film = katalogTrefferPasst({ title: 'Genocidal Organ', type: 'movie_listing' }, namen(organ))
pruefe('Film "Genocidal Organ": Treffer, exakt über en', film.passt && film.exakt, film)
const teilFilm = katalogTrefferPasst({ title: 'Genocidal Organ', type: 'movie_listing' }, ['Project Itoh: Genocidal Organ'])
pruefe('Film-Teil-Abgleich: Treffer, nicht exakt', teilFilm.passt && !teilFilm.exakt, teilFilm)
pruefe('Serie mit exaktem Namen: Treffer', katalogTrefferPasst({ title: 'Dorohedoro', type: 'series' }, ['Dorohedoro']).passt)
pruefe('Teil unter sechs Zeichen: kein Treffer', !katalogTrefferPasst({ title: 'Prelu', type: 'movie_listing' }, ['Fruits Basket Prelu x']).passt)

pruefe('nicht-lateinischer Titel: kein exakter Treffer im Sammler', !katalogTrefferPasst({ title: '進撃', type: 'series' }, ['進撃']).passt)
console.log('Bau-Lauf (belegeEinzelwerke)')
const mk = (id: number) => ({ id, streams: [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/x' }] })
const titles = new Map([114622, 106169, 20919, 5].map((id) => [id, mk(id)])) as never
belegeEinzelwerke(titles, [dorohedoro, persona, organTeil, { ...mitArt(organTeil, 'movie_listing'), id: 5 }])
const dub = (id: number) => (titles as Map<number, ReturnType<typeof mk> & { streams: { dub?: boolean }[] }>).get(id)!.streams[0].dub
const vorbelegt = new Map([[7, { id: 7, streams: [{ platform: 'crunchyroll', dub: false }] }]]) as never
belegeEinzelwerke(vorbelegt, [{ ...mitArt(organTeil, 'movie_listing'), id: 7 }])
pruefe('Lauf: bereits gesetztes dub: false bleibt', (vorbelegt as Map<number, { streams: { dub?: boolean }[] }>).get(7)!.streams[0].dub === false)
pruefe('Lauf: Dorohedoro bleibt offen', dub(114622) === undefined, dub(114622))
pruefe('Lauf: Persona 5 bleibt offen', dub(106169) === undefined, dub(106169))
pruefe('Lauf: Genocidal Organ nur Titel, ohne Art bleibt offen (Altdaten)', dub(20919) === undefined, dub(20919))
pruefe('Lauf: Genocidal Organ mit Art movie_listing = Ja', dub(5) === true, dub(5))

if (fehler) {
  console.error(`${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('check-cr-einzelwerk-urteil: 3 echte Fälle (Dorohedoro, Persona 5, Genocidal Organ) in Bau-Urteil, Sammler und Bau-Lauf ok')
