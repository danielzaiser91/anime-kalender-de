/**
 * Zuordnung über Episodentitel: Zusicherungen an echten Fällen (Spezifikation: `daniel-zum-abarbeiten/berichte/zuordnung-ueber-episodentitel.md`).
 *
 * Fälle: Avatar (Cartoon -246, Netflix Buch 1–3 = 20/20/21 gegen 61 Folgen bei uns), Niko (Cartoon -72898, Prime 13 + 10) und zwei
 * Anime mit Netflix-Teilen (Great Pretender 14 + 9 je Teil ab 1, Carole & Tuesday 12 + 12 durchgezählt). Die Titel stammen aus
 * `pipeline/fixtures/cartoon-folgen-probe.json` (Auszug aus `data/cartoon-folgen.json` (TMDB) und `data/anisearch-folgen.json`,
 * Stand 11.10.2026); die Meldungen daraus mit anderer Schreibweise nachgebaut. Die Prüfung läuft ohne die große Datei.
 */
import { readFileSync } from 'node:fs'
import { readJson } from './lib/util.ts'
import { ordneBlockZu, folgenZuTitel, unsereFolgen, type CartoonFolge, type UnsereFolge } from './lib/episodentitel-block.ts'
import { blockUrteile, folgenlisteVon, nummerUeberBlock, probelisten, type BlockEingang } from './lib/titel-bloecke.ts'
import { verteileMeldungen } from './lib/meldungen-verteilen.ts'
import { ordneMeldungZu, ordneNachStaffelliste, type AnbieterStaffel } from './lib/folgenbereiche.ts'

let fehler = 0
const pruefe = (name: string, ok: boolean, gefunden?: unknown) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler++
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

/** Schreibweise, wie ein Anbieter sie abweichend führen kann: Großschreibung, Anführungszeichen, Schlusspunkt. */
const variante = (t: string | null) => `„${(t ?? '').toUpperCase()}“.`

const block = (liste: UnsereFolge[], von: number, bis: number) =>
  liste.filter((f) => f.nr >= von && f.nr <= bis).map((f, i) => ({ pos: i + 1, titel: variante(f.de) }))

/** Meldungen eines Anbieter-Blocks, wie die Erweiterung sie schickt: Staffel, Nummer im Block, Titel in der Notiz. */
function meldungen(liste: UnsereFolge[], seq: number, erste: number, von: number, bis: number, nurRand = false): Array<BlockEingang & { plattform: string }> {
  return liste
    .filter((f) => f.nr >= von && f.nr <= bis && (!nurRand || f.nr === von || f.nr === bis))
    .map((f) => ({
      staffel: seq,
      folge_nr: f.nr - von + erste,
      notiz: `Folge ${f.nr - von + erste}: ${variante(f.de)} — Netflix: Staffel ${seq}`,
      befund: 'dub',
      plattform: 'netflix',
    }))
}

const anbieter = (groessen: number[], durchgezaehlt: boolean): AnbieterStaffel[] =>
  groessen.map((folgen, i) => ({
    seq: i + 1,
    name: `Buch ${i + 1}`,
    folgen,
    erste: durchgezaehlt ? groessen.slice(0, i).reduce((n, x) => n + x, 0) + 1 : 1,
  }))

function pruefeBloecke(name: string, liste: UnsereFolge[] | null, groessen: number[], durchgezaehlt: boolean): void {
  console.log(`\n${name}`)
  if (!liste) return pruefe(`${name}: Folgenliste liegt vor`, false)
  const summe = groessen.reduce((n, x) => n + x, 0)
  pruefe(`Folgenliste führt ${summe} Folgen`, liste.length === summe, liste.length)
  const a = anbieter(groessen, durchgezaehlt)
  let davor = 0
  for (const st of a) {
    const eingang = meldungen(liste, st.seq, st.erste, davor + 1, davor + st.folgen)
    const urteil = blockUrteile(eingang, a, liste).get(st.seq)
    pruefe(`Block ${st.seq}: sicher mit Versatz ${davor}`, urteil?.sicher === true && urteil.versatz === davor, urteil)
    const rand = blockUrteile(meldungen(liste, st.seq, st.erste, davor + 1, davor + st.folgen, true), a, liste).get(st.seq)
    pruefe(`Block ${st.seq}: auch nur Anfang und Ende (E1 + E${st.folgen}) genügen`, rand?.sicher === true && rand.versatz === davor, rand)
    const nr = nummerUeberBlock(eingang[eingang.length - 1]!, a, blockUrteile(eingang, a, liste))
    pruefe(`Block ${st.seq}: letzte Folge ist unsere Nr. ${davor + st.folgen}`, nr === davor + st.folgen, nr)
    davor += st.folgen
  }
  const unser = [{ id: 1, titel: name, folgen: summe }]
  const z = ordneNachStaffelliste(a, unser)
  pruefe(
    'ohne Titel: Versatz je Block aus den Summen davor',
    z.paare.map((p) => p.versatz ?? 0).join() === groessen.map((_, i) => groessen.slice(0, i).reduce((n, x) => n + x, 0)).join(),
    z.paare.map((p) => p.versatz),
  )
  const letzter = a[a.length - 1]!
  const ohne = ordneMeldungZu({ folge: letzter.erste, staffel: letzter.seq }, unser, a)
  pruefe('ohne Titel: erste Folge des letzten Blocks liegt hinter den früheren', ohne?.folgeInStaffel === summe - letzter.folgen + 1, ohne)
}

/** Die Verteilung der Meldungen auf unseren einen Titel, wie `fetch-pruefungen.ts` sie benutzt. */
function pruefeVerteilung(): void {
  console.log('\nAvatar: Meldungen von Netflix auf unsere 61 Folgen verteilen')
  const liste = folgenlisteVon(-246)
  if (!liste) return pruefe('Folgenliste liegt vor', false)
  const a = anbieter([20, 20, 21], false)
  const unser = [{ id: -246, titel: 'Avatar', folgen: 61 }]
  const buecher = (nurRand: boolean) => [
    ...meldungen(liste, 1, 1, 1, 20, nurRand),
    ...meldungen(liste, 2, 1, 21, 40, nurRand),
    ...meldungen(liste, 3, 1, 41, 61, nurRand),
  ]
  const folgenVon = (v: ReturnType<typeof verteileMeldungen>) => (v.jeStaffel.get(-246) ?? []).map((x) => x.folge).sort((x, y) => x - y)
  const voll = verteileMeldungen(buecher(false), a, unser)
  const alle = Array.from({ length: 61 }, (_, i) => i + 1).join()
  pruefe('alle 61 Folgen kommen an ihre Stelle, jede über den Titel', folgenVon(voll).join() === alle && voll.ueberFolgentitel === 61, voll.ueberFolgentitel)
  const rand = verteileMeldungen(buecher(true), a, unser)
  pruefe('nur E1 + E20 je Buch: Folgen 1, 20, 21, 40, 41, 61', folgenVon(rand).join() === '1,20,21,40,41,61', folgenVon(rand))
  const ohneTitel = buecher(true).map((m) => ({ ...m, notiz: 'Netflix' }))
  const nurZahl = verteileMeldungen(ohneTitel, a, unser)
  pruefe('ohne Titel entscheidet die Zahl mit Versatz: Buch 2 Folge 1 ist unsere 21', folgenVon(nurZahl).join() === '1,20,21,40,41,61' && nurZahl.ueberFolgentitel === 0, folgenVon(nurZahl))
  const gegen = verteileMeldungen(meldungen(liste, 2, 1, 41, 60), a, unser)
  pruefe('Titel gewinnt gegen die gemeldete Staffel: Buch-3-Titel unter „Buch 2" landen bei 41–60', folgenVon(gegen).join() === Array.from({ length: 20 }, (_, i) => i + 41).join(), folgenVon(gegen))
  const streit = verteileMeldungen([...meldungen(liste, 2, 1, 21, 30), ...meldungen(liste, 2, 11, 41, 50)], a, unser)
  pruefe('Titel aus zwei Blöcken in einer Staffel: nichts zugeordnet, Grund für die Prüfliste', folgenVon(streit).length === 0 && streit.zuPruefen.length === 1, streit.zuPruefen)
}

/** Die Liste der Erweiterung kennt Cartoons: Avatars Netflix-Adresse steht mit der Kennung -246 und 61 Folgen darin. */
function pruefeErweiterungsliste(): void {
  console.log('\nErweiterung: Cartoons stehen in der Liste der Netflix-Adressen')
  const text = readFileSync('extension/offene-netflix.js', 'utf8').replace(/^globalThis\.AK_OFFENE_TITEL = /, '')
  const avatar = (JSON.parse(text) as Record<string, { staffeln: Array<{ id?: number; folgen: number }> }>)['70142405']
  pruefe('Avatar (Netflix 70142405): ein Eintrag -246 mit 61 Folgen, damit „S?" entfällt', avatar?.staffeln.length === 1 && avatar.staffeln[0]!.id === -246 && avatar.staffeln[0]!.folgen === 61, avatar)
}

console.log('Zuordnung über Episodentitel')

console.log('\nSchreibweisen und Platzhalter')
const probe: UnsereFolge[] = [
  { nr: 1, de: 'Der Junge im Eisberg', en: 'The Boy in the Iceberg' },
  { nr: 2, de: 'Die Rückkehr des Avatars', en: 'The Avatar Returns' },
  { nr: 3, de: 'Folge 3', en: 'Episode 3' },
  { nr: 4, de: 'Das Finale', en: 'The Finale' },
  { nr: 5, de: 'Das Finale', en: 'The Finale' },
  { nr: 6, de: 'Die Reise nach Ba Sing Se im Zug der Erde', en: 'Journey to Ba Sing Se' },
]
pruefe('Groß-/Kleinschreibung, Satzzeichen, Akzente zählen nicht', folgenZuTitel('der JUNGE im eisberg!', probe).join() === '1')
pruefe('englischer Titel trifft, wenn der deutsche nicht passt', folgenZuTitel('The Avatar Returns', probe).join() === '2')
pruefe('Platzhalter („Folge 3") zählen nie', folgenZuTitel('Folge 3', probe).length === 0)
pruefe('zwei gleich heißende Folgen bleiben beide Kandidat', folgenZuTitel('Das Finale', probe).join() === '4,5')
pruefe('Wortüberlappung ≥ 0,8 mit einem Treffer', folgenZuTitel('Die Reise nach Ba Sing Se im Zug', probe).join() === '6')
pruefe('Wortüberlappung darunter trifft nichts', folgenZuTitel('Die Reise nach Ba Sing Se', probe).length === 0)

console.log('\nEntscheidung je Block (synthetisch)')
const lang: UnsereFolge[] = Array.from({ length: 40 }, (_, i) => ({ nr: i + 1, de: `Eigener Folgentitel Nummer ${i + 1} im Test`, en: null }))
pruefe('ein einzelner Titel entscheidet nicht', ordneBlockZu(block(lang, 21, 21), lang).sicher === false)
pruefe('zwei Titel mit demselben Versatz genügen', (() => { const u = ordneBlockZu([block(lang, 21, 40)[0]!, block(lang, 21, 40)[19]!], lang); return u.sicher && u.versatz === 20 })())
const gemischt = [...block(lang, 1, 5), ...block(lang, 21, 25).map((m) => ({ ...m, pos: m.pos + 5 }))]
const unklar = ordneBlockZu(gemischt, lang)
pruefe('zwei Blöcke gleich stark: keine Zuordnung, Widerspruch', unklar.sicher === false && unklar.widerspruch === true, unklar)
const meist = [...block(lang, 21, 38), ...block(lang, 1, 2).map((m) => ({ ...m, pos: m.pos + 18 }))]
pruefe('18 von 20 Titeln im selben Block (90 %): sicher, zwei Abweichungen gezählt', (() => { const u = ordneBlockZu(meist, lang); return u.sicher && u.versatz === 20 && u.abweichend === 2 })())
const zuwenig = [...block(lang, 21, 23), ...block(lang, 1, 2).map((m) => ({ ...m, pos: m.pos + 3 })), ...block(lang, 11, 12).map((m) => ({ ...m, pos: m.pos + 5 }))]
pruefe('weniger als 80 % im selben Block: nicht sicher, Widerspruch', (() => { const u = ordneBlockZu(zuwenig, lang); return u.sicher === false && u.widerspruch })())
pruefe('Titel ohne Treffer: nicht sicher, aber kein Widerspruch (die Zahl entscheidet)', (() => { const u = ordneBlockZu([{ pos: 1, titel: 'Unbekannt A B C' }, { pos: 2, titel: 'Unbekannt D E F' }], lang); return u.sicher === false && !u.widerspruch })())

const fixture = readJson<{ cartoons: Record<string, { folgen: CartoonFolge[] }>; anime: Record<string, UnsereFolge[]> }>('pipeline/fixtures/cartoon-folgen-probe.json', { cartoons: {}, anime: {} })
for (const [id, c] of Object.entries(fixture.cartoons)) probelisten.set(Number(id), unsereFolgen(c.folgen))
for (const [id, liste] of Object.entries(fixture.anime)) probelisten.set(Number(id), liste)
pruefe('Fixture: Avatar (-246), Niko (-72898), Great Pretender und Carole & Tuesday liegen vor', probelisten.size === 4, [...probelisten.keys()])

pruefeBloecke('Avatar – Der Herr der Elemente (-246): Netflix Buch 1–3 = 20/20/21 bei 61 Folgen', folgenlisteVon(-246), [20, 20, 21], false)
pruefeBloecke('Niko (-72898): Prime 13 + 10', folgenlisteVon(-72898), [13, 10], false)
pruefeBloecke('Great Pretender (110349): Netflix 14 + 9, je Teil ab 1', folgenlisteVon(110349), [14, 9], false)
pruefeBloecke('Carole & Tuesday (101281): Netflix 12 + 12, durchgezählt', folgenlisteVon(101281), [12, 12], true)
pruefeVerteilung()
pruefeErweiterungsliste()

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlles grün.')
process.exit(fehler ? 1 : 0)
