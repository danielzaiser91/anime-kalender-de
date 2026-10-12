/**
 * Zusicherungen zur deutschen Folgenzahl (`deFolgen` in `data/erstausgabe-von-hand.yaml`, 12.10.2026): ohne Quelle und kurzes Zitat gilt kein Eintrag; sie gilt nur, wo sie unter der
 * Folgenzahl des Werks liegt; der Bau legt sie in die Detaildaten (nicht in `titles.json`); das Panel sagt dann „26 von 41 Folgen auf Deutsch“ mit der Quelle darunter, sonst bleibt alles wie bisher.
 */
import type { Release, Title } from '../shared/types.ts'
import { deFolgenFehler, deFolgenGilt, handErstausgabe, ladeErstausgabeVonHand, type ErstausgabeVonHand } from './lib/erstausgabe-von-hand.ts'
import { ergaenzeDeutscheFolgenzahl } from './bau/deutsche-folgenzahl-einbinden.ts'
import type { SynopsisEintrag } from './bau/13-1-anreichern.ts'
import { berechneAntwortMitDeFolgen } from '../web/src/components/detail/antwort-de-folgen.ts'
import { teilweiseNeben } from '../web/src/components/detail/antwort-regeln.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const gut: ErstausgabeVonHand = {
  anilistId: 7,
  title: 'Beispiel',
  von: '1993-12-24',
  sources: ['https://de.wikipedia.org/wiki/Beispiel'],
  deFolgen: { n: 26, name: 'fernsehserien.de', url: 'https://www.fernsehserien.de/beispiel', zitat: '26 tlg. US-jap. Zeichentrickserie' },
}
const mitFolgen = (f: Partial<NonNullable<ErstausgabeVonHand['deFolgen']>>): ErstausgabeVonHand => ({ ...gut, deFolgen: { ...gut.deFolgen!, ...f } })

pruefe('Struktur: ein vollständiger Eintrag ist in Ordnung', deFolgenFehler([gut]).length === 0, deFolgenFehler([gut]).join('; '))
pruefe('Struktur: Eintrag ohne deFolgen wird nicht geprüft', deFolgenFehler([{ anilistId: 1 }]).length === 0)
pruefe('Struktur: ohne Quellenadresse kein Eintrag', deFolgenFehler([mitFolgen({ url: '' })]).some((f) => f.includes('https')))
pruefe('Struktur: Quellenadresse nur mit https', deFolgenFehler([mitFolgen({ url: 'http://a.de' })]).length === 1)
pruefe('Struktur: ohne Quellenname kein Eintrag', deFolgenFehler([mitFolgen({ name: ' ' })]).some((f) => f.includes('Quellenname')))
pruefe('Struktur: ohne Zitat kein Eintrag', deFolgenFehler([mitFolgen({ zitat: ' ' })]).some((f) => f.includes('Zitat fehlt')))
pruefe('Struktur: 14 Wörter sind erlaubt', deFolgenFehler([mitFolgen({ zitat: 'a b c d e f g h i j k l m n' })]).length === 0)
pruefe('Struktur: 15 Wörter sind zu viel', deFolgenFehler([mitFolgen({ zitat: 'a b c d e f g h i j k l m n o' })]).some((f) => f.includes('15 Wörter')))
pruefe('Struktur: die Zahl muss eine Folgenzahl sein', deFolgenFehler([mitFolgen({ n: 0 }), mitFolgen({ n: 2.5 })]).length === 2)
pruefe('Struktur: Datum und Quelle der Erstausgabe sind Pflicht', deFolgenFehler([{ ...gut, sources: [] }]).length === 1)

pruefe('Geltung: unter der Folgenzahl des Werks gilt sie', deFolgenGilt(gut.deFolgen, 41))
pruefe('Geltung: gleich oder darüber gilt sie nicht', !deFolgenGilt(gut.deFolgen, 26) && !deFolgenGilt(gut.deFolgen, 12))
pruefe('Geltung: ohne Folgenzahl des Werks gilt sie nicht', !deFolgenGilt(gut.deFolgen, undefined))

const titel = (episodes: number) => ({ id: 7, episodes }) as Title
pruefe('Erstausgabe: kürzere deutsche Fassung trägt „teil“ und „synchro“', handErstausgabe(gut, titel(41)).teil === true && handErstausgabe(gut, titel(41)).synchro === true)
pruefe('Erstausgabe: ohne deFolgen bleibt es wie bisher', JSON.stringify(handErstausgabe({ ...gut, deFolgen: undefined, publisher: 'VOX' }, titel(41))) === '{"von":"1993-12-24","publisher":"VOX","synchro":true}')
pruefe('Erstausgabe: deFolgen nicht unter dem Werk setzt kein „teil“', handErstausgabe(gut, titel(26)).teil === undefined)

const echte = ladeErstausgabeVonHand()
const mitZahl = echte.filter((e) => e.deFolgen)
pruefe('Datei: data/erstausgabe-von-hand.yaml ist gültig', deFolgenFehler(echte).length === 0, deFolgenFehler(echte).join('; '))
pruefe('Datei: Wundersame Geschichten führt 26 deutsche Folgen mit Quelle', mitZahl.some((e) => e.anilistId === 10003453 && e.deFolgen!.n === 26 && /fernsehserien\.de/.test(e.deFolgen!.url)))

/* Der Bau: nur die Detaildaten bekommen die Zahl, vorhandene Felder bleiben, ein überholter Eintrag fällt weg. */
const synopsen: Record<number, SynopsisEintrag> = { 10003453: { de: 'Ein Text', deSource: { name: 'x', url: 'https://x.de' } } }
const episodes = new Map<number, number | undefined>(mitZahl.map((e) => [e.anilistId!, 1000]))
episodes.set(10003453, 41)
ergaenzeDeutscheFolgenzahl(synopsen, episodes)
pruefe('Bau: die Detaildaten tragen Zahl, Quelle und Zitat', synopsen[10003453]?.deFolgen?.n === 26 && synopsen[10003453]?.deFolgen?.quelle.url === 'https://www.fernsehserien.de/wundersame-geschichten' && Boolean(synopsen[10003453]?.deFolgen?.zitat))
pruefe('Bau: der vorhandene Text bleibt', synopsen[10003453]?.de === 'Ein Text')
const ueberholt: Record<number, SynopsisEintrag> = {}
ergaenzeDeutscheFolgenzahl(ueberholt, new Map(mitZahl.map((e) => [e.anilistId!, e.deFolgen!.n])))
pruefe('Bau: eine Zahl, die nicht unter dem Werk liegt, wird nicht eingebunden', Object.keys(ueberholt).length === 0)

/* Das Panel: „26 von 41“ mit Quelle, aber nur mit Zahl und nur wenn sie kleiner ist; „Alle 41“ bleibt ohne sie. */
const HEUTE = '2026-10-12'
const wundersame = { id: 10003453, format: 'TV', episodes: 41, jpYear: 1988, jpEnd: '1990-03-23', streams: [], deErstausgabe: { von: '1993-12-24', synchro: true, teil: true } } as unknown as Title
const ohneTeil = { ...wundersame, deErstausgabe: { von: '1993-12-24', synchro: true } } as unknown as Title
const folgen = synopsen[10003453]!.deFolgen!
const releases: Release[] = []
const mit = berechneAntwortMitDeFolgen({ title: wundersame, releases, today: HEUTE, deFolgen: folgen })
pruefe('Panel: mit Zahl „26 von 41“', mit?.art === 'teilweise' && mit.raus === 26 && mit.gesamt === 41, JSON.stringify(mit))
const ohne = berechneAntwortMitDeFolgen({ title: wundersame, releases, today: HEUTE, deFolgen: undefined })
pruefe('Panel: ohne Zahl bleibt es „teilweise“ ohne Zahl', ohne?.art === 'teilweise' && ohne.raus === undefined, JSON.stringify(ohne))
const alle = berechneAntwortMitDeFolgen({ title: ohneTeil, releases, today: HEUTE, deFolgen: undefined })
pruefe('Panel: ohne „teil“ und ohne Zahl bleibt es „fertig“ wie bisher', alle?.art === 'fertig', JSON.stringify(alle))
const mitUeberOriginal = berechneAntwortMitDeFolgen({ title: ohneTeil, releases, today: HEUTE, deFolgen: { ...folgen, n: 41 } })
pruefe('Panel: eine Zahl nicht unter dem Werk ändert nichts', mitUeberOriginal?.art === 'fertig', JSON.stringify(mitUeberOriginal))
const T = (k: string, v?: Record<string, string | number>): string => (v ? `${k}${JSON.stringify(v)}` : k)
pruefe(
  'Panel: unter „26 von 41“ steht die Quelle mit Zitat',
  mit?.art === 'teilweise' && teilweiseNeben(mit, T) === `antwort.deFolgenQuelle${JSON.stringify({ quelle: folgen.quelle.name, zitat: folgen.zitat })}`,
)
pruefe('Panel: ohne Zahl bleibt die Nebenzeile wie bisher', ohne?.art === 'teilweise' && teilweiseNeben(ohne, T) === 'antwort.teilweiseNeben')

if (fehler) {
  console.error(`\nDeutsche Folgenzahl: ${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('Deutsche Folgenzahl: alle Zusicherungen halten.')
