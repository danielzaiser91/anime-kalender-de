/** Test der Mängelart `staffel-zuordnung`: Titel an einer geteilten Netflix-Adresse gegen die Staffelliste des Anbieters (Fälle wörtlich aus `anbieter-staffeln.json`). */
import type { Release, Title } from '../shared/types.ts'
import { REGELN, zaehleMaengel, type Kontext } from './lib/maengel-regeln.ts'
import { letzterNetflixStart, staffelZuordnung, type AnbieterStaffeln } from './lib/maengel-staffel.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const adresse = (id: string) => `https://www.netflix.com/title/${id}`
const titel = (id: number, episodes: number, kennung: string, franchiseId = 1): Title =>
  ({ id, episodes, franchiseId, streams: [{ platform: 'netflix', url: adresse(kennung) }] }) as unknown as Title
const liste = (...folgen: number[]) => ({ staffeln: folgen.map((f) => ({ folgen: f })) })
const aus = (t: Title[], s: AnbieterStaffeln, start: Record<number, string> = {}) => [...staffelZuordnung(t, s, (i) => start[i])].map(([i, b]) => `${i}:${b}`).join()

pruefe('überlappung (80063153): 25 + 25 + 1 + 25 Folgen in drei Staffeln zu 25 → alle vier Titel', aus([titel(11771, 25, '80063153'), titel(16894, 25, '80063153'), titel(16916, 1, '80063153'), titel(20725, 25, '80063153')], { 80063153: liste(25, 25, 25) }) === '11771:ueberlappung,16894:ueberlappung,16916:ueberlappung,20725:ueberlappung')
pruefe('überlappung: genau eine Folge zu viel trifft, genau passend nicht', aus([titel(1, 13, '91'), titel(2, 13, '91')], { 91: liste(13, 12) }) === '1:ueberlappung,2:ueberlappung' && aus([titel(1, 13, '91'), titel(2, 12, '91')], { 91: liste(13, 12) }) === '')
pruefe('länger als Staffel (81099976): 26 und 26 Folgen, Staffeln 13 + 13', aus([titel(188066, 26, '81099976'), titel(188067, 26, '81099976')], { 81099976: liste(13, 13) }) === '188066:laenger-als-staffel,188067:laenger-als-staffel')
pruefe('länger als Staffel: gleich lang wie die größte Staffel trifft nicht, eine mehr trifft', aus([titel(1, 25, '91'), titel(2, 1, '91')], { 91: liste(25, 1) }) === '' && aus([titel(1, 26, '91'), titel(2, 1, '91')], { 91: liste(25, 1) }) === '1:laenger-als-staffel,2:laenger-als-staffel')
pruefe('ohne Bereich (80097594): keine Staffelliste, fehlender Eintrag und leere Liste', aus([titel(21665, 12, '80097594'), titel(102498, 6, '80097594')], {}) === '21665:ohne-bereich,102498:ohne-bereich' && aus([titel(1, 12, '92'), titel(2, 6, '92')], { 92: { staffeln: [] } }) === '1:ohne-bereich,2:ohne-bereich')
const blueBox = [titel(170942, 25, '81663323'), titel(189123, 12, '81663323')]
const blueBoxListe = { 81663323: { ...liste(25), gemeldetAm: '2026-09-28' } }
pruefe('Liste veraltet (81663323, Blue Box): Netflix-Termin ab `gemeldetAm` → Ausnahme; Tag davor und ohne Termin offen', aus(blueBox, blueBoxListe, { 189123: '2026-10-04' }) === '170942:liste-veraltet,189123:liste-veraltet' && aus(blueBox, blueBoxListe, { 189123: '2026-09-28' }) === '170942:liste-veraltet,189123:liste-veraltet' && aus(blueBox, blueBoxListe, { 189123: '2026-09-27' }) === '170942:ueberlappung,189123:ueberlappung' && aus(blueBox, blueBoxListe) === '170942:ueberlappung,189123:ueberlappung')
pruefe('Liste veraltet (82116553, Steel Ball Run): Start = Meldetag, 11 und 1 Folgen gegen Staffeln 1 + 1 → Ausnahme (laufende Staffel, die Liste zählt bis zum Meldetag)', aus([titel(210482, 11, '82116553'), titel(190327, 1, '82116553')], { 82116553: { ...liste(1, 1), gemeldetAm: '2026-09-25' } }, { 190327: '2026-09-25' }) === '210482:liste-veraltet,190327:liste-veraltet')
pruefe('Liste veraltet gilt nur bei einem Befund: passende Zuordnung bleibt ohne Eintrag', aus([titel(1, 13, '96'), titel(2, 12, '96')], { 96: { ...liste(13, 12), gemeldetAm: '2026-01-01' } }, { 2: '2026-10-04' }) === '')
pruefe('letzterNetflixStart: nur Netflix, der späteste, ohne Termin leer', letzterNetflixStart([{ platform: 'netflix', schedule: { firstEpisodeDate: '2026-03-19' } }, { platform: 'netflix', schedule: { firstEpisodeDate: '2026-10-04' } }, { platform: 'adn', schedule: { firstEpisodeDate: '2027-01-01' } }] as unknown as Release[]) === '2026-10-04' && letzterNetflixStart([]) === undefined)
pruefe('Staffel ohne Folgenzahl in der Liste zählt 0 Folgen (kaputter Eintrag meldet, statt zu passen)', aus([titel(1, 1, '97'), titel(2, 1, '97')], { 97: { staffeln: [{}] } }) === '1:laenger-als-staffel,2:laenger-als-staffel')
pruefe('passt (70304256): 13 + 12 in 13 + 12 → kein Befund', aus([titel(10087, 13, '70304256'), titel(11741, 12, '70304256')], { 70304256: liste(13, 12) }) === '')
pruefe('Lücke (80135674): Staffeln ohne Titel im Katalog sind kein Befund', aus([titel(21459, 13, '80135674'), titel(139630, 25, '80135674')], { 80135674: liste(13, 25, 25, 25, 25, 25, 25) }) === '')
pruefe('Titel ohne Folgenzahl (81171925): nicht messbar, die Adresse zählt nicht (Art `folgenzahl`)', aus([titel(178533, 12, '81171925'), titel(185731, 12, '81171925'), titel(209872, 0, '81171925')], { 81171925: liste(12) }) === '')
pruefe('ein einzelner Titel an der Adresse ist keine geteilte Adresse', aus([titel(1, 99, '93')], {}) === '')
pruefe('fremdes Franchise zählt `adresse-mehrfach`, nicht diese Art', aus([titel(1, 13, '94', 1), titel(2, 13, '94', 2)], {}) === '')
pruefe('andere Anbieter haben keine Staffelliste: Crunchyroll-Adresse zählt nicht', aus([{ id: 1, episodes: 12, franchiseId: 1, streams: [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/series/X' }] }, { id: 2, episodes: 12, franchiseId: 1, streams: [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/series/X' }] }] as unknown as Title[], {}) === '')
pruefe('Sprachvariante der Adresse (`/de/title/…`) und Duplikat desselben Titels', aus([titel(1, 13, '95'), { ...titel(2, 13, '95'), streams: [{ platform: 'netflix', url: 'https://www.netflix.com/de/title/95' }, { platform: 'netflix', url: adresse('95') }] } as unknown as Title], {}) === '1:ohne-bereich,2:ohne-bereich')

/* Regel in der Tabelle: reine Mengenabfrage, Wirkung und Zuständigkeit wie `adresse-mehrfach` */
const regel = REGELN.find((r) => r.art === 'staffel-zuordnung')!
const ohneKontext = { staffelZuordnung: new Map([[7, 'ueberlappung']]) } as unknown as Kontext
const treffer = zaehleMaengel([{ id: 7 }, { id: 8 }] as unknown as Title[], ohneKontext, [regel])
pruefe('Regel: nur der Titel in der Menge trifft, ohne Ausnahme', treffer.length === 1 && treffer[0]!.t === 7 && !treffer[0]!.grund, treffer)
const veraltet = zaehleMaengel([{ id: 7 }, { id: 8 }, { id: 9 }, { id: 10 }] as unknown as Title[], { staffelZuordnung: new Map([[7, 'ueberlappung'], [8, 'liste-veraltet'], [9, 'ohne-bereich'], [10, 'laenger-als-staffel']]) } as unknown as Kontext, [regel])
pruefe('Regel: nur belegte Widersprüche sind offen; liste-veraltet und ohne-bereich sind Ausnahme mit Grund', veraltet.map((x) => `${x.t}:${x.grund ?? 'offen'}`).join() === '7:offen,8:liste-veraltet,9:ohne-staffelliste,10:offen', veraltet)
pruefe('Regel: Gruppe falsch, Wirkung 2, wer wie adresse-mehrfach', regel.gruppe === 'falsch' && regel.wirkung === 2 && regel.wer === REGELN.find((r) => r.art === 'adresse-mehrfach')!.wer)

if (verletzt) {
  console.error(`${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log('Mängelart staffel-zuordnung: alle Prüfungen bestanden')
