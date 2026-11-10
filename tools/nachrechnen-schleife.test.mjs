/**
 * Tests für tools/nachrechnen-schleife.mjs: Kommentartext, Zählung der Durchgänge (Signal 10), Fehlerpfad des Kommentars,
 * Verdrahtung in pr-nachrechnen (Kommentar nach dem Anstoßen) und in liegegut (Signal 10 im Gesamtlauf).
 */
import { grundKommentar, kommentiereGrund, schleifeSignal } from './nachrechnen-schleife.mjs'
import { nachrechnen } from './pr-nachrechnen.mjs'
import { liegegut, liegtZeile, naechsterSchritt } from './liegegut.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const KENNUNG_TEST = '**Nachrechnen** NICHT AKTUELL:'
const GRUND = 'main bewegte tools/check-x.mjs'
const durchgang = (zeit, text = grundKommentar('7a466acc8', 'c0ffee000', GRUND)) => ({ author: { login: 'danielzaiser91' }, createdAt: zeit, body: text })
const Z = ['2026-11-10T10:00:00Z', '2026-11-10T11:00:00Z', '2026-11-10T12:00:00Z', '2026-11-10T13:00:00Z']

console.log('nachrechnen-schleife: Kommentartext')
pruefe('eine Zeile, Kennung am Anfang, beide Stände und Grund', grundKommentar('aaa111111', 'bbb222222', GRUND) === `**Nachrechnen** NICHT AKTUELL: Kette gegen aaa111111, main ist bbb222222; ${GRUND}`)

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

console.log('nachrechnen-schleife: Fehlerpfad des Kommentars')
{
  const meldungen = []
  kommentiereGrund(() => { throw new Error('HTTP 403: Forbidden\nzweite Zeile') }, (t) => meldungen.push(t), 7, 'x')
  pruefe('gh scheitert -> keine Ausnahme, erste Ursache in der Meldung', meldungen.join() === 'PR 7: Grund-Kommentar nicht geschrieben (HTTP 403: Forbidden)', meldungen)
}

console.log('nachrechnen-schleife: Verdrahtung in pr-nachrechnen')
{
  const BASIS = '7a466acc8119e87fbe8dc51782126a6167c5b70a'
  const MAIN = 'c0ffee'.padEnd(40, '0')
  const KOPF = '08798af3f0daf193fc754d6eda60ee60b526450f'
  const log = `2026-10-19T14:15:22Z HEAD is now at 810f0279 Merge ${KOPF} into ${BASIS}\n`
  // `abw`: mergeable (PR-Zustand), main (Stand von main), dateien (Compare), ersetzer (offene PRs); Standard = NICHT AKTUELL
  const lauf = (abw = {}) => {
    const aufrufe = []
    const gh = (args) => {
      const k = args.join(' ')
      aufrufe.push(args)
      if (k.startsWith('pr view 7')) return JSON.stringify({ number: 7, state: 'OPEN', mergeable: abw.mergeable ?? 'MERGEABLE', headRefOid: KOPF, headRefName: 'fix/x' })
      if (k.startsWith('pr list')) return JSON.stringify(abw.offene ?? [])
      if (k.startsWith('run list')) return abw.keinLauf ? '[]' : JSON.stringify([{ headSha: KOPF, createdAt: '2026-10-19T14:00:00Z', databaseId: 12, status: 'completed', conclusion: 'success' }])
      if (k === 'run view 12 --json jobs') return JSON.stringify({ jobs: [{ name: 'Kette – Workflows', databaseId: 92, status: 'completed' }] })
      if (k.includes('/jobs/92/logs')) return log
      if (k.includes('git/ref/heads/main')) return `${abw.main ?? MAIN}\n`
      if (k.includes('compare')) return JSON.stringify({ status: 'ahead', anzahl: 1, dateien: abw.dateien ?? ['tools/check-x.mjs'], commitsGesamt: 1, autoren: ['danielzaiser91'] })
      if (k.includes('/commits/')) return `${abw.main ?? MAIN}\n`
      if (k.includes('pulls/7/files')) return 'web/src/andere.ts\n'
      if (k.includes('merge_commit_sha')) return 'a'.repeat(40)
      if (k.startsWith('pr ')) return ''
      throw new Error(`unerwartet: ${k}`)
    }
    const meldungen = []
    let code
    try {
      code = nachrechnen(7, gh, (t) => meldungen.push(t), () => {}, { liest: () => false, dateien: () => [] })
    } catch (e) {
      code = `Ausnahme ${e.message}`
    }
    const kommentare = aufrufe.filter((a) => a[0] === 'pr' && a[1] === 'comment')
    return { code, aufrufe, kommentare, meldungen }
  }
  const { code, aufrufe, kommentare: kommentar } = lauf()
  const reihenfolge = aufrufe.map((a) => a.slice(0, 2).join(' ')).filter((a) => ['pr reopen', 'pr comment'].includes(a))
  pruefe('NICHT AKTUELL -> Exit 1 und genau ein Kommentar mit Kennung und beiden Ständen', code === 1 && kommentar.length === 1 && kommentar[0][2] === '7' && kommentar[0].join(' ').includes(`${KENNUNG_TEST} Kette gegen 7a466acc8, main ist c0ffee000;`), { code, aufrufe: aufrufe.map((a) => a.join(' ')) })
  pruefe('Kommentar kommt nach dem Wiederöffnen', reihenfolge.at(-1) === 'pr comment' && reihenfolge.includes('pr reopen'), reihenfolge)

  // Gegenfälle: in jedem anderen Zweig entsteht kein Kommentar (sonst zählt die Schleife Durchgänge, die keine sind)
  const ohneKommentar = (name, erwartet, abw) => {
    const r = lauf(abw)
    pruefe(`${name} -> Exit ${erwartet}, kein Kommentar`, r.code === erwartet && r.kommentare.length === 0, { code: r.code, meldungen: r.meldungen })
  }
  ohneKommentar('Basis = main (aktuell)', 0, { main: BASIS })
  ohneKommentar('nur Daten bewegt (Ausnahme)', 0, { dateien: ['public/data/titles.json'] })
  ohneKommentar('Konflikt mit main (Hindernis)', 2, { mergeable: 'CONFLICTING' })
  ohneKommentar('Kettenlauf zum Kopf fehlt (Basis unbekannt)', 2, { keinLauf: true })
  ohneKommentar('ersetzt durch anderen PR', 3, { offene: [{ number: 9, title: 'x', body: 'Ersetzt PR 7' }] })
}

console.log('nachrechnen-schleife: Verdrahtung in liegegut')
{
  const JETZT = Date.parse('2026-11-10T14:00:00Z')
  const iso = (stunden) => new Date(JETZT - stunden * 3600 * 1000).toISOString()
  const KOPF = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
  const pr = (nummer, comments) => ({ number: nummer, title: `fix(x): ${nummer}`, headRefOid: KOPF, createdAt: iso(20), mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', isDraft: false, body: '', comments, statusCheckRollup: [], reviews: [] })
  const kommentar = (stunden) => ({ author: { login: 'danielzaiser91' }, createdAt: iso(stunden), body: grundKommentar('a', 'b', 'c') })
  const gh = (liste) => (args) => {
    if (args[0] === 'pr') return JSON.stringify(liste)
    if (args[1].includes('/commits/')) return iso(10)
    throw new Error(`unerwartet: ${args.join(' ')}`)
  }
  const git = (args) => {
    if (args[0] === 'rev-parse') return '.git\n'
    throw Object.assign(new Error('kein Treffer'), { status: 1 })
  }
  const zeilen = liegegut(gh([pr(31, [kommentar(5), kommentar(4), kommentar(3)]), pr(32, [kommentar(5), kommentar(4)]), pr(33, [kommentar(15), kommentar(14), kommentar(13)])]), git, JETZT)
  pruefe('PR mit 3 Durchgängen bekommt eine Zeile (SCHLEIFE, Signal 10), PR mit 2 keine, PR mit 3 Durchgängen vor dem Kopf-Commit (10 h) keine', zeilen.length === 1 && /^PR 31: SCHLEIFE .*Signal 10 Nachrechnen 3×/.test(zeilen[0]), zeilen)
  const funde = [{ nr: 31, signale: [{ nr: 10, seit: JETZT - 5 * 3600 * 1000 }] }]
  pruefe('LIEGT-Zeile nennt „Nachrechnen-Schleife“ mit Stunden', liegtZeile(funde, JETZT) === 'LIEGT: 31 (Nachrechnen-Schleife 5 h)', liegtZeile(funde, JETZT))
  pruefe('Schritt: Signale 10 und 8 zusammen -> SCHLEIFE (Reihenfolge egal); 8 allein bleibt STILLSTAND', naechsterSchritt([10, 8], [], false).startsWith('SCHLEIFE') && naechsterSchritt([8, 10], [], false).startsWith('SCHLEIFE') && naechsterSchritt([8], [], false) === 'STILLSTAND')
  pruefe('Schritt: nur Signal 10 -> SCHLEIFE; mit Konflikt (3) -> NACHBESSERN; mit Freigabe (1) -> MERGEN', naechsterSchritt([10], [], false).startsWith('SCHLEIFE') && naechsterSchritt([3, 10], [], false) === 'NACHBESSERN' && naechsterSchritt([1, 10], [], false) === 'MERGEN')
}

if (fehler.length > 0) {
  console.error(`nachrechnen-schleife.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('nachrechnen-schleife.test: alle Fälle grün (Text, Zählung ab 3, Fehlerpfad, Verdrahtung in pr-nachrechnen und liegegut)')
