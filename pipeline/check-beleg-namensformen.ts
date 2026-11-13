/**
 * Prüft, dass die Suchnamen der Beleg-Lesung die Schreibweisen der Artikel treffen (`pipeline/lib/beleg-suche.ts`, `namensformen`): Kopf vor einem Gedankenstrich, „×" als „x", „and" als „&".
 * Dazu der japanische Starttag („2026年10月2日", `terminMarken`). Die Artikelzeilen stehen wörtlich aus den gespeicherten Lesungen (12.11.2026): ohne diese Formen blieb der Titel „nicht im Text" und der Beleg ohne Marke.
 * Aufruf: npx tsx pipeline/check-beleg-namensformen.ts   (Exit 1 bei Verstoß)
 */
import { gruppenJeAdresse, namensformen, suchbegriffeJeAdresse } from './lib/beleg-suche.ts'
import { enthaeltMarke, terminMarken } from './lib/beleg-stelle.ts'
import type { NewsEintrag, Release, Title } from '../shared/types.ts'

let fehler = 0
const pruefe = (name: string, ok: boolean): void => {
  console.log(ok ? '✓' : '✗', name)
  if (!ok) fehler++
}

/** Wie `stuetzstelle` im Browser: Kleinschreibung, alles außer Buchstaben und Ziffern wird zu einem Leerzeichen. */
const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const trifft = (namen: string[], zeile: string): boolean => namen.some((n) => n.length >= 5 && norm(zeile).includes(norm(n)))

interface Fall { id: number; wie: string; titel: Record<string, string>; zeile: string; nicht?: string }

const FAELLE: Fall[] = [
  { id: 3231, wie: 'Kopf vor -…- (ADN Gunslinger Girl)', titel: { titleDe: 'Gunslinger Girl -Il Teatrino-' }, zeile: 'Gunslinger Girl ist ab sofort in voller Länge bei ADN verfügbar: Streame jetzt Staffel 1-2, mit 2 OVAs' },
  { id: 98320, wie: '„and" als „&" (ADN Love & Lies)', titel: { titleDe: 'Love and Lies' }, zeile: 'Love & Lies jetzt im Stream bei ADN: Dystopisches Romance-Drama' },
  { id: 158927, wie: '„×" als „x" (Spy x Family)', titel: { titleDe: 'Spy × Family: Staffel 2' }, zeile: '4. Oktober: »Spy x Family« – Staffel 1 und 2' },
  { id: 20791, wie: 'Kopf vor „ – " (Fate/stay night, Gesamtausgabe)', titel: { titleDe: "Fate/stay night [Heaven's Feel] – Gesamtausgabe (I. presage flower)" }, zeile: 'Der Publisher peppermint anime gab heute bekannt, dass man die »Fate/stay night: Heaven’s Feel«-Trilogie noch in diesem Jahr veröffentlichen wird.' },
  { id: 131586, wie: 'Kopf vor „ – " (86 – Teil 2)', titel: { titleDe: '86: Eighty Six – Teil 2' }, zeile: 'Ab 08.10.: »86 EIGHTY-SIX« (Dub + Sub)', nicht: 'Ab 08.10.: »School Babysitters« (Dub + Sub)' },
]

function einFall(f: Fall): void {
  const url = `https://example.org/a${f.id}`
  const titles = [{ id: f.id, ...f.titel }] as unknown as Title[]
  const release = { slug: `r${f.id}`, titleId: f.id, name: f.titel.titleDe, sources: [url] } as unknown as Release
  const news = [{ am: '2026-11-12', titelId: f.id, titel: f.titel.titleDe, slug: `n${f.id}`, meldungen: [{ quelle: `${url}-n` }] }] as unknown as NewsEintrag[]
  const gruppe = gruppenJeAdresse([release], titles, news)
  const suchen = gruppe.get(url)?.[0]?.suchen ?? []
  pruefe(`${f.wie}: Gruppe des Termins trifft die Zeile`, trifft(suchen, f.zeile))
  pruefe(`${f.wie}: Suchbegriffe des Termins treffen sie`, trifft(suchbegriffeJeAdresse([release], titles, news).get(url) ?? [], f.zeile))
  pruefe(`${f.wie}: Gruppe aus der Meldung (ohne Termin) trifft sie`, trifft(gruppe.get(`${url}-n`)?.[0]?.suchen ?? [], f.zeile))
  if (f.nicht) pruefe(`${f.wie}: eine fremde Zeile trifft nicht`, !trifft(suchen, f.nicht))
}

function formenFaelle(): void {
  pruefe('Kopf unter 5 Zeichen entsteht nicht („Re - Zero")', !namensformen('Re - Zero').includes('Re'))
  pruefe('Kopf mit genau 5 Zeichen entsteht („Fairy – Tail")', namensformen('Fairy – Tail').includes('Fairy'))
  pruefe('Kopf mit 4 Zeichen entsteht nicht („Fair – Tail")', !namensformen('Fair – Tail').includes('Fair'))
  pruefe('Bindestrich ohne Leerzeichen trennt nicht („Dan-Da-Dan")', namensformen('Dan-Da-Dan').length === 1)
  pruefe('„SPY×FAMILY" ergibt „SPY x FAMILY"', namensformen('SPY×FAMILY').includes('SPY x FAMILY'))
  pruefe('„and" nur als ganzes Wort („Candy" bleibt)', namensformen('Candy Land').length === 1 && namensformen('Love and Lies').includes('Love & Lies'))
  pruefe('ein Name unter 5 Zeichen bleibt als ganzer Name erhalten („K-On")', namensformen('K-On').includes('K-On'))
  pruefe('der ganze Name bleibt an erster Stelle', namensformen('Gunslinger Girl -Il Teatrino-')[0] === 'Gunslinger Girl -Il Teatrino-')
}

/** Die offizielle Seite nennt den Starttag japanisch (tokyo-revengers-anime.com/news/archives/4935, Lesung vom 05.10.2026). */
function japanischeTage(): void {
  const zeile = 'TVアニメ『東京リベンジャーズ』三天戦争編 2026年10月2日から毎週金曜深夜、MBS・TBS・CBC”アニメイズム”枠、AT-Xほかにて放送開始！'
  const trifftTag = (iso: string, text: string): boolean => terminMarken([iso]).some((m) => enthaeltMarke(text, m))
  pruefe('Japanisch: „2026年10月2日" trägt den 2. Oktober', trifftTag('2026-10-02', zeile))
  pruefe('Japanisch: einstelliger Monat („2026年2月2日") trägt den 2. Februar', trifftTag('2026-02-02', '2026年2月2日から放送'))
  pruefe('Japanisch: „12月2日" trägt den 2. Februar nicht (Suffix des zweistelligen Monats)', !trifftTag('2026-02-02', '2026年12月2日から放送'))
  pruefe('Japanisch: „11月5日" trägt den 5. Januar nicht', !trifftTag('2026-01-05', '2026年11月5日から放送'))
  pruefe('Japanisch: „10月20日" trägt den 2. Oktober nicht', !trifftTag('2026-10-02', '2026年10月20日から放送'))
  pruefe('Japanisch: „10月3日" trägt den 2. Oktober nicht', !trifftTag('2026-10-02', '2026年10月3日から放送'))
}

/** Wortgrenze: Zeilen nach echten Artikeln (aniSearch „22. Okt 2026", ADN „24 August 2026", Tabelle „04.12."); die Marke des 2. darf nicht im 12. oder 22. stecken. */
function wortgrenzen(): void {
  const trifft = (iso: string, text: string): boolean => terminMarken([iso]).some((m) => enthaeltMarke(text.toLowerCase(), m))
  pruefe('Wortgrenze: „2.10." steht nicht in „12.10."', !trifft('2026-10-02', 'Start am 12.10. im Fernsehen'))
  pruefe('Wortgrenze: „2.10." steht nicht in „22.10.2026"', !trifft('2026-10-02', 'Erscheint am 22.10.2026'))
  pruefe('Wortgrenze: „02.10." steht nicht in „102.10."', !trifft('2026-10-02', 'Zeile 102.10. der Liste'))
  pruefe('Wortgrenze: „2.10." trägt „2.10.2026" (Punkt am Ende, Jahr folgt)', trifft('2026-10-02', 'Erscheint am 2.10.2026'))
  pruefe('Wortgrenze: „2.10." trägt den Tag am Zeilenanfang und nach Leerzeichen', trifft('2026-10-02', '2.10. Neue Folge') && trifft('2026-10-02', 'Start: 2.10. um 20 Uhr'))
  pruefe('Wortgrenze: Satzzeichen davor und danach stören nicht („(2.10.)")', trifft('2026-10-02', 'Start (2.10.) im TV'))
  pruefe('Wortgrenze: „2. okt 2026" steht nicht in „12. Okt 2026"', !trifft('2026-10-02', 'Veröffentlicht: 12. Okt 2026'))
  pruefe('Wortgrenze: „2. okt 2026" trägt „2. Okt 2026"', trifft('2026-10-02', 'Veröffentlicht: 2. Okt 2026'))
  pruefe('Wortgrenze: Marke „2 oktober 2026" steht nicht in „12 Oktober 2026" (ADN, die Monatsmarke trägt dort allein)', !enthaeltMarke('autor: mady | 12 oktober 2026', '2 oktober 2026'))
  pruefe('Wortgrenze: „8. august" steht nicht in „8. augustus" (Buchstabe danach)', !terminMarken(['2026-08-08']).some((m) => enthaeltMarke('am 8. augustus', m)))
  pruefe('Wortgrenze: „oktober 2026" steht nicht in „nachoktober 2026" (Buchstabe davor)', !terminMarken(['2026-10-02']).some((m) => enthaeltMarke('im nachoktober 2026', m)))
  pruefe('Wortgrenze: der Punkt der Marke ist wörtlich („2.10." ist nicht „2x10.")', !trifft('2026-10-02', 'Start am 2x10. im TV'))
}

for (const f of FAELLE) einFall(f)
formenFaelle()
japanischeTage()
wortgrenzen()
console.log(fehler ? `✖ ${fehler} Verstöße` : `✔ Beleg-Suchnamen: ${FAELLE.length} Artikelzeilen wörtlich getroffen, Köpfe, Zeichen-Formen, japanische Starttage und Wortgrenzen der Datumsmarken abgegrenzt`)
process.exit(fehler ? 1 : 0)
