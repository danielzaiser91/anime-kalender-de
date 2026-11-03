/**
 * Zusicherungen: Der Start in einem Prime-Kanal bei einem Titel, den Prime Video schon zum Kauf/zur Leihe führt, ist kein „endlich im Stream“
 * und kein Erststart des Anbieters (Angel's Egg, Daniel, 03.11.2026). Läuft in `check:logic`. Titel und Termin sind die echten Datensätze vom
 * 03.11.2026 (`public/data/titles.json`, `releases.json`), nur mit Termin im Jahr 2099, damit keine Uhr mitspielt.
 */
import type { NewsEintrag, NewsMeldung, Release, StreamLink, Title } from '../shared/types.ts'
import { kanalStartBeiKaufweg } from '../shared/kanal-start.ts'
import { baueNews } from './lib/news.ts'
import { felderAenderungen, haltFelderFest } from './lib/news-felder-fest.ts'
import { newsSatz } from '../web/src/lib/news-text.ts'
import { seitDatumFuerPille } from '../web/src/components/detail/chips-regeln.ts'
import { kanalStartVon } from '../web/src/lib/anbieter-kachel.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const KAUF: StreamLink = { platform: 'primevideo', url: 'https://www.amazon.de/gp/video/detail/B0GYJ3ZZ7X', dub: true, zugang: 'kauf' }
const ANGELS_EGG = {
  id: 885,
  slug: 'angel-s-egg-885',
  titleRomaji: 'Tenshi no Tamago',
  titleEn: "Angel's Egg",
  format: 'OVA',
  episodes: 1,
  jpYear: 1985,
  genres: [],
  keywords: [],
  studios: [],
  streams: [KAUF],
  franchiseId: 885,
  titleDe: 'Angel’s Egg',
  deErstausgabe: {
    von: '2026-06-01',
    publisher: 'KSM Anime',
    synchro: true,
  },
} as unknown as Title
const ANIVERSE: Release = {
  slug: 'auto-885-primevideo',
  titleId: 885,
  name: 'Angel’s Egg',
  platform: 'primevideo',
  kanal: 'Aniverse',
  releaseType: 'batch',
  schedule: { firstEpisodeDate: '2099-11-05' },
  year: 2099,
  herkunft: 'Automatisch übernommen aus „»Angel’s Egg«".',
  automatisch: true,
  sources: ['https://www.anime2you.de/news/1065078/aniverse-november-2026-neuzugaenge/'],
} as unknown as Release

const mitStreams = (streams: StreamLink[]): Title => ({ ...ANGELS_EGG, streams }) as Title
const meldung = (t: Title, r: Release): NewsMeldung | undefined => {
  const e = baueNews([t], [r], [], [], { zuerst: {} })
  return e.flatMap((x) => x.meldungen).find((m) => m.art === 'angekuendigt')
}

console.log('Die Weiche:')
pruefe('Angel\'s Egg (Kauf da, Start im Aniverse-Kanal): Kanal', kanalStartBeiKaufweg(ANGELS_EGG.streams, ANIVERSE) === 'Aniverse')
pruefe('ohne Kauf-Weg: kein Kanal-Start-Fall', kanalStartBeiKaufweg([], ANIVERSE) === undefined)
pruefe('Termin ohne Kanal (Anbieter startet selbst): kein Fall', kanalStartBeiKaufweg([KAUF], { ...ANIVERSE, kanal: undefined }) === undefined)
pruefe('Abo-Weg statt Kauf: kein Fall', kanalStartBeiKaufweg([{ ...KAUF, zugang: 'abo' }], ANIVERSE) === undefined)
pruefe('Kauf-Weg ohne Deutsch: kein Fall', kanalStartBeiKaufweg([{ ...KAUF, dub: false }], ANIVERSE) === undefined)
pruefe('Kauf-Weg nur noch als Vermerk (entferntAm): kein Fall', kanalStartBeiKaufweg([{ ...KAUF, entferntAm: '2026-10-01' }], ANIVERSE) === undefined)
pruefe('Kauf-Weg selbst im Kanal: kein Fall', kanalStartBeiKaufweg([{ ...KAUF, kanal: 'Aniverse' }], ANIVERSE) === undefined)
pruefe('Kauf-Weg einer anderen Plattform: kein Fall', kanalStartBeiKaufweg([{ ...KAUF, platform: 'netflix' }], ANIVERSE) === undefined)
pruefe('Termin nur OmU: kein Fall', kanalStartBeiKaufweg([KAUF], { ...ANIVERSE, sprache: 'omu' }) === undefined)
pruefe('Disc-Termin: kein Fall', kanalStartBeiKaufweg([KAUF], { ...ANIVERSE, releaseType: 'disc' }) === undefined)

console.log('Die Meldung (baueNews):')
const m = meldung(ANGELS_EGG, ANIVERSE)
pruefe('Angel\'s Egg: Meldung gebaut, mit schonKaufbar und Kanal', m?.schonKaufbar === true && m.kanal === 'Aniverse', m)
pruefe('Angel\'s Egg: weder Jahre noch Disc-Dauer („endlich im Stream“ entfällt)', m !== undefined && m.jahre === undefined && m.discSeitText === undefined, m)
const ohneKauf = meldung(mitStreams([]), ANIVERSE)
pruefe('Gegenprobe ohne Kauf-Weg: Jahre und Disc-Dauer bleiben, kein schonKaufbar', ohneKauf?.jahre === 114 && ohneKauf.discSeitText === '73 Jahren' && ohneKauf.schonKaufbar === undefined, ohneKauf)
const ohneKanal = meldung(ANGELS_EGG, { ...ANIVERSE, kanal: undefined })
pruefe('Gegenprobe Termin ohne Kanal: Jahre bleiben, kein schonKaufbar', ohneKanal?.jahre === 114 && ohneKanal.schonKaufbar === undefined, ohneKanal)

console.log('Der Satz (Seite):')
const satz = newsSatz({ ...m!, anbieter: undefined, platform: 'primevideo', datum: '2099-11-05' } as NewsMeldung)
pruefe('Satz: „Ab 05.11.2099 im Abo bei Prime Video (Aniverse)!“', satz === 'Ab 05.11.2099 im Abo bei Prime Video (Aniverse)!', satz)
const alt = newsSatz({ ...ohneKauf!, platform: 'primevideo', datum: '2099-11-05' } as NewsMeldung)
pruefe('Gegenprobe: ohne schonKaufbar bleibt der Satz „endlich im Stream“', alt.includes('endlich im Stream'), alt)
const mitQuelle = newsSatz({ ...m!, platform: 'primevideo', datum: '2099-11-05', belege: [{ url: 'https://x.test', name: 'anime2you.de', veroeffentlichtAm: '2099-10-28' }] } as NewsMeldung, '2099-10-29')
pruefe('Quellenzusatz bleibt: „— laut anime2you.de vom 28.10.2099“', mitQuelle.endsWith('— laut anime2you.de vom 28.10.2099'), mitQuelle)

console.log('Berichtigte Meldung im Gedächtnis:')
const K = 'angekuendigt:auto-885-primevideo:2026-11-05'
const lebend = { art: 'angekuendigt', platform: 'primevideo', release: 'auto-885-primevideo', datum: '2026-11-05', am: '2026-10-29', titel: ANGELS_EGG, schluessel: K, kanal: 'Aniverse', jahre: 41, discSeitText: '5 Monaten' } as never
const h = { zuerst: {}, felder: { [K]: { kanal: 'Aniverse', schonKaufbar: true } } }
const fest = haltFelderFest(h, [lebend], [])[0]!
pruefe('Gedächtnis mit schonKaufbar: die alte Meldung verliert Jahre und Disc-Dauer', fest.jahre === undefined && fest.discSeitText === undefined && fest.schonKaufbar === true, fest)
const eintrag = (extra: Partial<NewsMeldung>, release = 'auto-885-primevideo', datum = '2026-11-05'): NewsEintrag[] =>
  [{ am: '2026-10-29', titelId: 885, titel: 'Angel’s Egg', slug: 'a', meldungen: [{ art: 'angekuendigt', platform: 'primevideo', release, datum, kanal: 'Aniverse', ...extra } as NewsMeldung] }]
const vorstand = eintrag({ jahre: 41, discSeitText: '5 Monaten' })
pruefe('Bestandswächter: die berichtigte Meldung darf Jahre/Disc-Dauer verlieren und schonKaufbar bekommen', felderAenderungen(vorstand, eintrag({ schonKaufbar: true })).length === 0)
pruefe('Bestandswächter: dieselbe Änderung an einer anderen Meldung bleibt ein Fehler (3 Felder)', felderAenderungen(eintrag({ jahre: 41, discSeitText: '5 Monaten' }, 'auto-1-primevideo'), eintrag({ schonKaufbar: true }, 'auto-1-primevideo')).length === 3)
pruefe('Bestandswächter: bei der berichtigten Meldung bleibt ein anderes Feld (kanal) geschützt', felderAenderungen(vorstand, eintrag({ schonKaufbar: true, kanal: 'RTL+' })).length === 1)

console.log('Panel und Kachel:')
const KAUF_PILLE = { ...KAUF }
pruefe('Panel: die Kauf-Pille übernimmt nicht das Startdatum des Aniverse-Kanals („ab 05.11.“)', seitDatumFuerPille(ANGELS_EGG, 'primevideo', [ANIVERSE], KAUF_PILLE.kanal) === undefined)
pruefe('Panel: eine Aniverse-Pille bekommt das Startdatum des Kanals', seitDatumFuerPille(ANGELS_EGG, 'primevideo', [ANIVERSE], 'aniverse') === '2099-11-05')
pruefe('Panel: eine Pille ohne Kanal bekommt weiter das Datum eines Termins ohne Kanal', seitDatumFuerPille(ANGELS_EGG, 'primevideo', [{ ...ANIVERSE, kanal: undefined }]) === '2099-11-05')
const von = kanalStartVon(new Map([[885, ANGELS_EGG]]), new Map([[ANIVERSE.slug, ANIVERSE]]))
const ev = { titleId: 885, releaseSlug: ANIVERSE.slug } as never
pruefe('Kachel: der Termin nennt den Kanal („neu bei Aniverse“)', von(ev) === 'Aniverse')
pruefe('Kachel: unbekannter Titel oder Termin: nichts', kanalStartVon(new Map(), new Map())(ev) === undefined)

console.log(`check-kanal-start: ${faelle} Zusicherungen, ${fehler} Fehler`)
process.exit(fehler ? 1 : 0)
