/**
 * Tests für tools/nachrechnen-schleife.mjs: Zählung der Durchgänge (Signal 10) und Verdrahtung in liegegut (Signal 10 im Gesamtlauf).
 * Die Kommentare stehen in der Form, die pr-nachrechnen bis 20.11.2026 schrieb.
 */
import { schleifeSignal, schleifenBeginn, zaehlbeginn } from './nachrechnen-schleife.mjs'
import { liegegut, liegtZeile, naechsterSchritt } from './liegegut.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const KENNUNG_TEST = '**Nachrechnen** NICHT AKTUELL:'
const GRUND = 'main bewegte tools/check-x.mjs'
const grundKommentar = (basisKurz, mainKurz, grund) => `${KENNUNG_TEST} Kette gegen ${basisKurz}, main ist ${mainKurz}; ${grund}`
const durchgang = (zeit, text = grundKommentar('7a466acc8', 'c0ffee000', GRUND)) => ({ author: { login: 'derNamenloseDaniel' }, createdAt: zeit, body: text })
const Z = ['2026-11-10T10:00:00Z', '2026-11-10T11:00:00Z', '2026-11-10T12:00:00Z', '2026-11-10T13:00:00Z']

console.log('nachrechnen-schleife: Zählung (Signal 10)')
{
  const sig = (comments, kopfZeit = 0) => schleifeSignal({ comments }, kopfZeit)
  pruefe('0 Durchgänge -> kein Signal', sig([]).length === 0)
  pruefe('2 Durchgänge -> kein Signal (Grenze 3)', sig([durchgang(Z[0]), durchgang(Z[1])]).length === 0)
  const drei = sig([durchgang(Z[0]), durchgang(Z[1]), durchgang(Z[2])])
  pruefe('3 Durchgänge -> Signal 10 mit Zahl, seit = jüngster Durchgang', drei.length === 1 && drei[0].nr === 10 && drei[0].text.includes('3×') && drei[0].seit === Date.parse(Z[2]), drei)
  const vier = sig([durchgang(Z[3]), durchgang(Z[0]), durchgang(Z[2]), durchgang(Z[1])])
  pruefe('4 Durchgänge in beliebiger Reihenfolge -> 4×, seit = jüngster', vier[0].text.includes('4×') && vier[0].seit === Date.parse(Z[3]), vier)
  const fremd = { author: { login: 'x' }, createdAt: Z[0], body: 'Hinweis' }
  const mitten = durchgang(Z[1], `Danach: ${grundKommentar('a', 'b', 'c')}`)
  pruefe('Kommentare ohne Kennung am Anfang zählen nicht', sig([durchgang(Z[0]), durchgang(Z[1]), fremd, mitten, fremd]).length === 0)
  const fremdKonto = (zeit) => ({ ...durchgang(zeit), author: { login: 'fremder' } })
  pruefe('Kennung von fremdem Konto zählt nicht (3 fremde -> kein Signal, 2 eigene + 1 fremder -> kein Signal)', sig([fremdKonto(Z[0]), fremdKonto(Z[1]), fremdKonto(Z[2])]).length === 0 && sig([durchgang(Z[0]), durchgang(Z[1]), fremdKonto(Z[2])]).length === 0)
  const bot = (zeit) => ({ ...durchgang(zeit), author: { login: 'github-actions' } })
  pruefe('Durchgänge des Nacht-Mergers (github-actions) zählen mit', sig([bot(Z[0]), durchgang(Z[1]), bot(Z[2])])[0]?.text.includes('3×'))
  pruefe('Kommentar ohne Autor bricht nicht und zählt nicht', sig([{ createdAt: Z[0], body: KENNUNG_TEST }, durchgang(Z[1]), durchgang(Z[2])]).length === 0)
  const kopf = Date.parse(Z[1])
  pruefe('Zählung nur ab Kopf-Commit: 4 Durchgänge, Kopf zwischen 1. und 2. -> 3× (Durchgang genau zur Kopfzeit zählt)', sig([durchgang(Z[0]), durchgang(Z[1]), durchgang(Z[2]), durchgang(Z[3])], kopf)[0]?.text.includes('3×'))
  pruefe('Kopf eine Millisekunde nach dem 2. Durchgang -> nur 2 zählen -> kein Signal', sig([durchgang(Z[0]), durchgang(Z[1]), durchgang(Z[2]), durchgang(Z[3])], kopf + 1).length === 0)
  pruefe('3 Durchgänge, dann neuer Kopf -> kein Signal', sig([durchgang(Z[0]), durchgang(Z[1]), durchgang(Z[2])], Date.parse(Z[3])).length === 0)
  pruefe('Kommentar ohne body-Text (null) bricht nicht', sig([durchgang(Z[0], null), durchgang(Z[1]), durchgang(Z[2])]).length === 0)
}

console.log('nachrechnen-schleife: Verdrahtung in liegegut')
{
  const JETZT = Date.parse('2026-11-10T14:00:00Z')
  const iso = (stunden) => new Date(JETZT - stunden * 3600 * 1000).toISOString()
  const KOPF = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
  const pr = (nummer, comments) => ({ number: nummer, title: `fix(x): ${nummer}`, headRefOid: KOPF, createdAt: iso(20), mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', isDraft: false, body: '', comments, statusCheckRollup: [], reviews: [] })
  const kommentar = (stunden) => ({ author: { login: 'derNamenloseDaniel' }, createdAt: iso(stunden), body: grundKommentar('a', 'b', 'c') })
  // `kopf`: Commit-Zeit des Kopfs; `commitListe`: Zeilen der PR-Commit-Liste (Zeit TAB erste Nachrichtenzeile), Standard = nur der Kopf-Commit
  const gh = (liste, kopf = iso(10), commitListe = `${iso(10)}\tfix(x): nachbessern\n`) => (args) => {
    if (args[0] === 'pr') return JSON.stringify(liste)
    if (args[1].includes('/commits/')) return kopf
    if (/\/pulls\/\d+\/commits\?per_page=100$/.test(args[1])) return commitListe
    throw new Error(`unerwartet: ${args.join(' ')}`)
  }
  const git = (args) => {
    if (args[0] === 'rev-parse') return '.git\n'
    throw Object.assign(new Error('kein Treffer'), { status: 1 })
  }
  const zeilen = liegegut(gh([pr(31, [kommentar(5), kommentar(4), kommentar(3)]), pr(32, [kommentar(5), kommentar(4)]), pr(33, [kommentar(15), kommentar(14), kommentar(13)])]), git, JETZT)
  pruefe('PR mit 3 Durchgängen bekommt eine Zeile (SCHLEIFE, Signal 10), PR mit 2 keine, PR mit 3 Durchgängen vor dem Kopf-Commit (10 h) keine', zeilen.length === 1 && /^anime-kalender-de PR 31: SCHLEIFE .*Signal 10 Nachrechnen 3×/.test(zeilen[0]), zeilen)
  // A4 (PR 4104): update-branch setzt je Durchgang einen neuen Kopf („Merge branch 'main' into …“); gezählt wird ab dem letzten anderen Commit
  const mergeKopf = `${iso(20)}\tfix(x): bauen\n${iso(6)}\tMerge branch 'main' into fix/x\n${iso(2)}\tMerge branch 'main' into fix/x\n`
  const drei = [kommentar(5), kommentar(4), kommentar(3)]
  const ueberUpdate = liegegut(gh([pr(34, drei)], iso(2), mergeKopf), git, JETZT)
  pruefe('drei Durchgänge, jeder mit neuem update-branch-Kopf (Kopf 2 h, Bauer-Commit 20 h) -> SCHLEIFE', ueberUpdate.length === 1 && /^anime-kalender-de PR 34: SCHLEIFE .*Signal 10 Nachrechnen 3×/.test(ueberUpdate[0]), ueberUpdate)
  const nachBauer = `${iso(20)}\tfix(x): bauen\n${iso(4.5)}\tfix(x): nachbessern\n${iso(2)}\tMerge branch 'main' into fix/x\n`
  pruefe('Bauer-Commit zwischen den Durchgängen (4,5 h) -> Zählung beginnt dort, 2 Durchgänge -> kein Signal', liegegut(gh([pr(35, drei)], iso(2), nachBauer), git, JETZT).length === 0)
  const zeitPunkt = (h) => JETZT - h * 3600 * 1000
  pruefe('zaehlbeginn: jüngster Commit ohne „Merge branch \'main\' into“; nur Merges -> Kopfzeit', zaehlbeginn([{ nachricht: 'fix', zeit: zeitPunkt(9) }, { nachricht: "Merge branch 'main' into x", zeit: zeitPunkt(1) }], zeitPunkt(1)) === zeitPunkt(9) && zaehlbeginn([{ nachricht: "Merge branch 'main' into x", zeit: zeitPunkt(1) }], zeitPunkt(1)) === zeitPunkt(1) && zaehlbeginn([{ nachricht: "Merge remote-tracking branch 'origin/main' into x", zeit: zeitPunkt(3) }, { nachricht: "Merge branch 'main' into x", zeit: zeitPunkt(1) }], zeitPunkt(1)) === zeitPunkt(3))
  let abfragen = 0
  const zaehl = (c) => schleifenBeginn(() => { abfragen++; return `${iso(20)}\tfix\n` }, { number: 36, comments: c }, zeitPunkt(2))
  pruefe('schleifenBeginn: unter 3 Durchgängen keine Abfrage (Kopfzeit), ab 3 die Commit-Liste', zaehl([kommentar(5), kommentar(4)]) === zeitPunkt(2) && abfragen === 0 && zaehl(drei) === Date.parse(iso(20)) && abfragen === 1)
  const funde = [{ nr: 31, signale: [{ nr: 10, seit: JETZT - 5 * 3600 * 1000 }] }]
  pruefe('LIEGT-Zeile nennt „Nachrechnen-Schleife“ mit Stunden', liegtZeile(funde, JETZT) === 'LIEGT: 31 (Nachrechnen-Schleife 5 h)', liegtZeile(funde, JETZT))
  pruefe('Schritt: Signale 10 und 8 zusammen -> SCHLEIFE (Reihenfolge egal); 8 allein bleibt STILLSTAND', naechsterSchritt([10, 8], [], false).startsWith('SCHLEIFE') && naechsterSchritt([8, 10], [], false).startsWith('SCHLEIFE') && naechsterSchritt([8], [], false) === 'STILLSTAND')
  pruefe('Schritt: nur Signal 10 -> SCHLEIFE; mit Konflikt (3) -> NACHBESSERN; mit Freigabe (1) -> MERGEN', naechsterSchritt([10], [], false).startsWith('SCHLEIFE') && naechsterSchritt([3, 10], [], false) === 'NACHBESSERN' && naechsterSchritt([1, 10], [], false) === 'MERGEN')
}

if (fehler.length > 0) {
  console.error(`nachrechnen-schleife.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('nachrechnen-schleife.test: alle Fälle grün (Zählung ab 3, Verdrahtung in liegegut)')
