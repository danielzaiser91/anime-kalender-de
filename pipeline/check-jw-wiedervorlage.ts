/**
 * Zusicherungen zur vorzeitigen Wiedervorlage der JustWatch-Befunde (`lib/jw-wiedervorlage.ts`): Titel, deren „Deutsch laut JustWatch“
 * am Befund hängt, werden eine Woche vor Ablauf erneuert — auch ohne `dubQuelle`-Marke (Your Name, 17.10.2026: Befund vom 17.09.,
 * im Wochenlauf vom 12.10. mit 25 Tagen nicht erneuert, am 15.10. abgelaufen). Läuft in `check:logic`.
 */
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import type { Title } from '../shared/types.ts'
import type { JwBefund } from './lib/jw-vertrauen.ts'
import { titelMitJwFlagge, vertrauensBefundAlt, vorgezogen } from './lib/jw-wiedervorlage.ts'
import { unbedingteAufrufe } from './lib/unbedingte-aufrufe.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${JSON.stringify(info)}`)
}

const HEUTE = '2026-10-12'
const KEINE = new Set<number>()
const gti = (n: number) => `amzn1.dv.gti.3004ad12-53d7-4c50-856c-e55711247c${String(n).padStart(2, '0')}`
const amazon = (n: number) => `https://watch.amazon.de/detail?gti=${gti(n)}`
const angebot = (n: number, audio: string[]) => ({ anbieter: 'Arthouse CNMA Amazon Channel', art: 'FLATRATE', audio, url: amazon(n) })
const weg = (n: number, rest: object = {}) => ({ platform: 'primevideo', url: amazon(n), ...rest })
const titel = (id: number, streams: object[], rest: object = {}) => ({ id, fsk: 12, streams, ...rest }) as unknown as Title
const film = (tag: string, angebote: JwBefund['angebote'], rest: object = {}): JwBefund => ({
  geprueftAm: tag,
  jwId: `tm${tag}${angebote.length}`,
  jwPfad: '/de/Film/x',
  angebote,
  ...rest,
})
const serie = (jwId: string, angebote: JwBefund['angebote'], rest: object = {}): JwBefund => ({
  geprueftAm: '2026-09-17',
  jwId,
  jwPfad: '/de/Serie/x',
  angebote,
  ...rest,
})

/* Your Name in der Mitte von drei Kandidaten; die anderen haben je einen Grund, nicht dazuzugehören. */
const yourName = titel(21519, [weg(1)])
const bestand: Record<string, JwBefund> = {
  '100': film('2026-09-17', [angebot(2, ['en'])]),
  '21519': film('2026-09-17', [angebot(0, []), angebot(1, ['de'])], { jwId: 'tm233386' }),
  '300': film('2026-09-17', [angebot(3, ['de'])], { jwId: 'tm300' }),
}
const andere = [titel(100, [weg(2)]), yourName, titel(300, [weg(9)]), titel(400, [weg(1)])]
pruefe('nur Your Name hängt an einer Flagge (en-Ton und fremde Seite nicht)', [...titelMitJwFlagge(andere, bestand, KEINE)].join() === '21519', [...titelMitJwFlagge(andere, bestand, KEINE)])
const flagge = titelMitJwFlagge(andere, bestand, KEINE)
pruefe('Your Name, Befund 25 Tage alt, ohne Marke: im Wochenlauf vorgezogen', vorgezogen(yourName, bestand, HEUTE, flagge))
pruefe('… Befund 20 Tage alt: noch nicht', !vorgezogen(yourName, { '21519': { ...bestand['21519']!, geprueftAm: '2026-09-22' } }, HEUTE, flagge))
pruefe('… Befund 21 Tage alt: genau jetzt', vorgezogen(yourName, { '21519': { ...bestand['21519']!, geprueftAm: '2026-09-21' } }, HEUTE, flagge))
pruefe('… Befund 40 Tage alt (jenseits der Frist): erst recht', vorgezogen(yourName, { '21519': { ...bestand['21519']!, geprueftAm: '2026-09-02' } }, HEUTE, flagge))
pruefe('ohne Flagge nie vorgezogen, auch bei altem Befund', !vorgezogen(titel(100, [weg(2)]), bestand, HEUTE, titelMitJwFlagge(andere, bestand, KEINE)))
pruefe('ohne Befund nie', !vertrauensBefundAlt(true, undefined, HEUTE))
pruefe('Altersangabe nachholen geht weiter ohne Flagge', vorgezogen({ id: 5 } as Title, { '5': { geprueftAm: '2026-10-11', jwId: 'x' } }, HEUTE, new Set()))

const jungeSerie = { '8': { geprueftAm: '2026-10-11', jwId: 'ts8', jwPfad: '/de/Serie/x' } }
pruefe('Staffelangaben nachholen geht weiter ohne Flagge', vorgezogen({ id: 8, fsk: 12 } as Title, jungeSerie, HEUTE, new Set()))
pruefe('ein junger Film ohne Anlass wird nicht vorgezogen', !vorgezogen(titel(1, [weg(1)]), { '1': film('2026-10-11', [angebot(1, ['de'])], { altersangabe: '12' }) }, HEUTE, new Set()))

/** Ein Titel allein, mit einer Änderung am Weg oder am Befund. */
const flaggeFuer = (t: Title, b: JwBefund): boolean => titelMitJwFlagge([t], { [String(t.id)]: b }, KEINE).has(String(t.id))
const mitTon = film('2026-09-17', [angebot(1, ['de'])])
pruefe('Grundfall: Weg ohne Urteil, Seite mit Ton', flaggeFuer(titel(1, [weg(1)]), mitTon))
pruefe('Weg mit dub true hängt nicht am Befund', !flaggeFuer(titel(1, [weg(1, { dub: true })]), mitTon))
pruefe('Weg mit dub false hängt nicht am Befund', !flaggeFuer(titel(1, [weg(1, { dub: false })]), mitTon))
pruefe('entfernter Weg zählt nicht', !flaggeFuer(titel(1, [weg(1, { entferntAm: '2026-10-01' })]), mitTon))
pruefe('ein entfernter Weg vor dem passenden ändert nichts', flaggeFuer(titel(1, [weg(1, { entferntAm: '2026-10-01' }), weg(1)]), mitTon))
pruefe('ein Weg hinter dem passenden ändert nichts', flaggeFuer(titel(1, [weg(1), weg(7)]), mitTon))
pruefe('Seite des Befunds ist eine andere', !flaggeFuer(titel(1, [weg(7)]), mitTon))
pruefe('Seite mit nur englischem Ton', !flaggeFuer(titel(1, [weg(1)]), film('2026-09-17', [angebot(1, ['en'])])))
pruefe('Befund ohne Treffer', !flaggeFuer(titel(1, [weg(1)]), { ...mitTon, ohneTreffer: true }))
pruefe('Befund ohne jwId', !flaggeFuer(titel(1, [weg(1)]), { ...mitTon, jwId: undefined }))
pruefe('Ton nur in den Staffel-Angeboten zählt', flaggeFuer(titel(1, [weg(1)]), serie('ts1', [], { staffeln: [{ nr: 1, angebote: [angebot(1, ['de'])] }] })))
pruefe('Einzelstaffel (genau eine Staffel) hängt dran', flaggeFuer(titel(1, [weg(1)]), serie('ts1', [angebot(1, ['de'])], { staffeln: [{ nr: 1, angebote: [] }] })))
pruefe('Serie mit mehreren Staffeln trägt den Hinweis und hängt dran', flaggeFuer(titel(1, [weg(1)]), serie('ts1', [angebot(1, ['de'])], { staffeln: [{ nr: 1, angebote: [] }, { nr: 2, angebote: [] }] })))
const einzel = serie('ts9', [angebot(1, ['de'])], { staffeln: [{ nr: 1, angebote: [] }] })
const mehrteiler = titelMitJwFlagge([titel(1, [weg(1)]), titel(2, [weg(1)])], { '1': einzel, '2': einzel }, KEINE)
pruefe('Mehrteiler (zwei Titel, eine JustWatch-Kennung) hängt nicht dran', mehrteiler.size === 0, [...mehrteiler])

/* Cartoons: ein Serien-Grund heißt im Bau weder Flagge noch Hinweis (kennzeichneCartoonJwSeiten), also auch keine Wiedervorlage. */
const serieMitTon = serie('ts1', [angebot(1, ['de'])], { staffeln: [{ nr: 1, angebote: [] }] })
const cartoonFlagge = (t: Title, b: JwBefund) => titelMitJwFlagge([t], { [String(t.id)]: b }, new Set([t.id])).has(String(t.id))
const cartoon = (staffeln: number) => titel(-5, [weg(1)], { staffeln: Array.from({ length: staffeln }, (_, i) => ({ nr: i + 1 })) })
pruefe('Cartoon-Serie mit zwei eigenen Staffeln: keine Wiedervorlage', !cartoonFlagge(cartoon(2), serieMitTon))
pruefe('… derselbe Titel als Anime (Hinweis): schon', flaggeFuer(cartoon(2), serieMitTon))
pruefe('Cartoon-Serie, Staffeln laut JustWatch unbekannt: keine Wiedervorlage', !cartoonFlagge(cartoon(1), serie('ts1', [angebot(1, ['de'])])))
pruefe('Cartoon-Serie mit einer Staffel und passender Seite: Wiedervorlage', cartoonFlagge(cartoon(1), serieMitTon))
pruefe('Cartoon-Film an der de-Seite: Wiedervorlage', cartoonFlagge(cartoon(0), mitTon))
pruefe('Cartoon ohne passende Seite: nie', !cartoonFlagge(titel(-5, [weg(7)]), mitTon))
const imGemisch = titelMitJwFlagge([cartoon(2), titel(1, [weg(1)])], { '-5': serieMitTon, '1': { ...serieMitTon, jwId: 'ts2' } }, new Set([-5]))
pruefe('Cartoon-Ausschluss trifft nur die Kennungen der Cartoons', [...imGemisch].join() === '1', [...imGemisch])

/* Verdrahtung im Abruf: main bildet die Schlange unbedingt aus den Titeln und dem Bestand. */
const abruf = readFileSync('pipeline/fetch-justwatch-audio.ts', 'utf8')
const aufruf = unbedingteAufrufe(abruf, 'main').filter((a) => a.name === 'warteschlange')
pruefe('main ruft warteschlange({ titles, bestand, … }) unbedingt auf', aufruf.length === 1 && aufruf[0]!.args[0] === '{ titles, bestand, tmdb, grenze, heute: todayIso(), cartoonIds: new Set(cartoons.map((t) => t.id)) }', aufruf)

/* `offen` (die Schlange) wird in main nur gelesen: `offen.length` und `offen.slice(0, limit)`, kein Umsortieren, kein Zweitzugriff. */
function offenZugriffe(quelltext: string): string[] {
  const datei = ts.createSourceFile('x.ts', quelltext, ts.ScriptTarget.Latest, true)
  const rumpf = datei.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === 'main')
  const zugriffe: string[] = []
  const besuche = (n: ts.Node): void => {
    if (ts.isIdentifier(n) && n.text === 'offen' && !(ts.isVariableDeclaration(n.parent) && n.parent.name === n)) {
      const p = n.parent
      const nutzung = ts.isPropertyAccessExpression(p) && p.expression === n ? (ts.isCallExpression(p.parent) && p.parent.expression === p ? p.parent.getText(datei) : p.getText(datei)) : n.getText(datei)
      zugriffe.push(nutzung)
    }
    ts.forEachChild(n, besuche)
  }
  if (rumpf) besuche(rumpf)
  return zugriffe
}
const zugriffe = offenZugriffe(abruf)
const erlaubt = ['offen.length', 'offen.slice(0, limit)']
pruefe('main liest die Schlange nur mit offen.length und offen.slice(0, limit)', zugriffe.length > 0 && zugriffe.every((z) => erlaubt.includes(z)) && zugriffe.includes('offen.slice(0, limit)'), zugriffe)
const mutiert = offenZugriffe(abruf.replace('offen.slice(0, limit)', 'offen.reverse().slice(0, limit)'))
pruefe('Selbsttest: offen.reverse().slice(…) fällt auf', mutiert.some((z) => !erlaubt.includes(z)), mutiert)

/* Bindung und Verwendung: genau eine `const offen = warteschlange(…)`, und `offen.slice(0, limit)` ist direkt das Ziel der Schleife. */
function offenBindung(quelltext: string): { istConst: boolean; aufruf: string }[] {
  const datei = ts.createSourceFile('x.ts', quelltext, ts.ScriptTarget.Latest, true)
  const rumpf = datei.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === 'main')
  const gefunden: { istConst: boolean; aufruf: string }[] = []
  const besuche = (n: ts.Node): void => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'offen') {
      const i = n.initializer
      const aufruf = i && ts.isCallExpression(i) && ts.isIdentifier(i.expression) ? i.expression.text : '?'
      gefunden.push({ istConst: (n.parent.flags & ts.NodeFlags.Const) !== 0, aufruf })
    }
    ts.forEachChild(n, besuche)
  }
  if (rumpf) besuche(rumpf)
  return gefunden
}
function sliceIstSchleifenZiel(quelltext: string): boolean[] {
  const datei = ts.createSourceFile('x.ts', quelltext, ts.ScriptTarget.Latest, true)
  const treffer: boolean[] = []
  const besuche = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && n.getText(datei) === 'offen.slice(0, limit)') treffer.push(ts.isForOfStatement(n.parent) && n.parent.expression === n)
    ts.forEachChild(n, besuche)
  }
  besuche(datei)
  return treffer
}
const bindung = offenBindung(abruf)
pruefe('main bindet offen genau einmal: const offen = warteschlange(…)', bindung.length === 1 && bindung[0]!.istConst && bindung[0]!.aufruf === 'warteschlange', bindung)
const umweg = offenBindung(abruf.replace('const offen = warteschlange({', 'const offen0 = warteschlange({').replace('t.id)) })', 't.id)) }); const offen = offen0.filter((t) => t.id > 0)'))
pruefe('Selbsttest: offen aus .filter(…) statt warteschlange(…) fällt auf', umweg.length === 1 && umweg[0]!.aufruf === '?', umweg)
const veraenderlich = offenBindung(abruf.replace('const offen = warteschlange({', 'let offen = warteschlange({'))
pruefe('Selbsttest: let offen fällt auf', veraenderlich.length === 1 && !veraenderlich[0]!.istConst, veraenderlich)
const ziel = sliceIstSchleifenZiel(abruf)
pruefe('offen.slice(0, limit) steht genau einmal, direkt als Ziel der for…of-Schleife', ziel.length === 1 && ziel[0] === true, ziel)
for (const nach of ['.filter((t) => t.id > 0)', '.reverse()']) {
  const z = sliceIstSchleifenZiel(abruf.replace('offen.slice(0, limit)', `offen.slice(0, limit)${nach}`))
  pruefe(`Selbsttest: offen.slice(0, limit)${nach} fällt auf`, z.length === 1 && z[0] === false, z)
}

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-jw-wiedervorlage: ok')
