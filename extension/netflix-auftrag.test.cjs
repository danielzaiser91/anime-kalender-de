/**
 * **Je Folge genau ein Zustand — und Dialog und Knopf lesen denselben.**
 *
 * Daniel am 11.09.2026, nach einem Tag mit vier Fassungen am Haikyu!!-Knopf:
 * „zustände sind schließlich nur: gemeldet (+datum wann zuletzt), zu melden,
 * erneut melden", „das muss übrigens pro episode so implementiert werden",
 * „single source of truth pattern sicherstellen".
 *
 * Die Vorgeschichte, weil jede Stufe eine Zusicherung hinterlassen hat:
 *
 * - 10.09.: `staffelnVon()` legte neun Einträge per **Index** auf vier Staffeln.
 * - 10.09.: Der Knopf las die Staffel aus `f.staffel` — und die Kulisse setzte
 *   sie von Hand, während `staffelnBereinigen()` sie auf der echten Seite löscht.
 * - 11.09.: Der Dialog hielt alles Ungemeldete für offen („S1 E2–25"), der
 *   Knopf sagte „✓ E26 geprüft". Zwei Quellen, zwei Wahrheiten.
 *
 * Geprüft wird durch **Ausführen** an einer Kulisse mit Haikyus Struktur —
 * neun Einträge, vier Anbieterstaffeln — und zwar auf dem Weg, den die echte
 * Seite geht: Rohliste durch `staffelnBereinigen()`, Meldungen über
 * `meldungenMerken()`, Zustand über `folgeZustand()`.
 *
 * Aufruf: `node extension/netflix-auftrag.test.cjs`
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Zusicherungen: Zustand je Folge, eine Quelle (Haikyu!!, 11.09.2026)\n')

const quelle = readFileSync(resolve(__dirname, 'melder.js'), 'utf8')

function schneide(name) {
  const treffer = new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`).exec(quelle)
  return treffer?.[0] ?? null
}

const namen = [
  'staffelnGruppiert',
  'staffelnVon',
  'meldungenMerken',
  'anbieterAufteilung',
  'zaehltDurch',
  'meldungAm',
  'listenZustand',
  'folgeZustand',
  'datumKurz',
  'zustandZeilen',
  'durchlaufAuftrag',
  'folgenJeStaffel',
  'staffelnDerGruppe',
  'zustandDerFolge',
  'geladeneZustaende',
  'staffelnBereinigen',
  'titelIdFuer',
  'alsBereiche',
]
const teile = namen.map((n) => [n, schneide(n)])
for (const [name, code] of teile) pruefe(`${name}() ist im Quelltext auffindbar`, Boolean(code))
const strenge = /const STRENGE = \{[^}]*\}/.exec(quelle)?.[0]
pruefe('STRENGE ist im Quelltext auffindbar', Boolean(strenge))
if (teile.some(([, code]) => !code) || !strenge) {
  console.error('\nOhne die Funktionen prüft der Rest nichts.')
  process.exit(1)
}
const CODE = ['const MELDUNGEN = new Map()', strenge, ...teile.map(([, code]) => code)].join('\n\n')

/** Haikyu!! wie es wirklich dasteht: neun Einträge, in Netflix' vier Staffeln gerechnet. */
const HAIKYU = {
  titel: 'Haikyu!!',
  laut: 'anbieter-gerechnet',
  staffeln: [
    { nr: 1, name: 'Haikyu!!', folgen: 25, erste: 1, film: false, offen: false, zustand: 'belegt', am: null },
    { nr: 1, name: 'Lev ist hier!', folgen: 1, erste: 26, film: false, offen: true, zustand: 'melden' },
    { nr: 2, name: 'Zweite Staffel', folgen: 25, erste: 1, film: false, offen: false, zustand: 'belegt', am: '2026-08-22' },
    { nr: 2, name: 'Noten', folgen: 1, erste: 26, film: false, offen: true, zustand: 'melden' },
    { nr: 3, name: 'Shiratorizawa', folgen: 10, erste: 1, film: false, offen: false, zustand: 'belegt' },
    { nr: 3, name: 'Sonderbeitrag', folgen: 1, erste: 11, film: false, offen: true, zustand: 'melden' },
    { nr: 4, name: 'To the Top', folgen: 13, erste: 1, film: false, offen: false, zustand: 'belegt' },
    { nr: 4, name: 'Land vs. Luft', folgen: 2, erste: 14, film: false, offen: true, zustand: 'melden' },
    { nr: 4, name: 'Cour 2', folgen: 12, erste: 16, film: false, offen: false, zustand: 'belegt' },
  ].map((st, i) => ({ ...st, id: 1000 + i })),
}

/** Was Netflix selbst gemeldet hat — vier Staffeln, gröber als unsere Liste. */
const NETFLIX = [
  { seq: 1, name: 'Haikyu!!', folgen: 26, erste: 1 },
  { seq: 2, name: 'Staffel 2', folgen: 26, erste: 1 },
  { seq: 3, name: 'Staffel 3', folgen: 11, erste: 1 },
  { seq: 4, name: 'Staffel 4', folgen: 27, erste: 1 },
]

/** Die Kennung einer Folge: Staffel mal tausend plus Nummer — eindeutig über alle Staffeln. */
const vid = (staffel, nummer) => staffel * 1000 + nummer
const AM = '2026-09-11T10:00:00.000Z'
const meldung = (staffel, nummer, am = AM) => ({ nummer, staffel, staffelBekannt: true, folge: String(vid(staffel, nummer)), am })

/**
 * Führt einen Ausdruck mit einer geladenen Staffel aus — so, wie die Liste auf
 * der Titelseite ankommt: Der Leser nummeriert nach Ladereihenfolge, und
 * `staffelnBereinigen()` löscht die Staffel, sobald nur eine geladen ist.
 */
function ausfuehren(ausdruck, { staffelNr = 1, anzahl = 26, meldungen = [], anbieter = NETFLIX, eintrag = HAIKYU } = {}) {
  const roh = Array.from({ length: anzahl }, (_, i) => ({
    nummer: i + 1,
    staffel: 1,
    seasonId: `s${staffelNr}`,
    videoId: vid(staffelNr, i + 1),
  }))
  const kontext = {
    anbieterStaffeln: anbieter ? { '80090673': anbieter } : {},
    offeneTitel: { '80090673': eintrag },
    stand: { staffel: null },
    DURCHLAUF: { folgen: [], gemeldet: new Set() },
    gemeinteReihe: () => '80090673',
    imPlayer: () => false,
    roh,
    meldungen,
    Number,
    Set,
    Map,
    Math,
    Boolean,
    String,
    Array,
    ergebnis: null,
  }
  vm.createContext(kontext)
  vm.runInContext(
    CODE +
      "\nDURCHLAUF.folgen = staffelnBereinigen(roh)\nmeldungenMerken('80090673', meldungen)\nergebnis = " +
      ausdruck,
    kontext,
  )
  return kontext.ergebnis
}
const auftrag = (opt) => ausfuehren('durchlaufAuftrag()', opt)?.map((f) => f.nummer) ?? null

/* Die Kulisse stellt den Fehlerfall wirklich nach. */
pruefe(
  'staffelnBereinigen() löscht die Staffel bei nur einer geladenen Staffel',
  ausfuehren('DURCHLAUF.folgen.filter((f) => f.staffel != null).length') === 0,
)

/* ── Der Knopf ─────────────────────────────────────────────────────────── */

const s1 = auftrag({ meldungen: [meldung(1, 1)] })
pruefe('S1 mit gemeldeter E1: der Knopf will genau E26', JSON.stringify(s1) === '[26]', s1)

const s1fertig = auftrag({ meldungen: [meldung(1, 1), meldung(1, 26)] })
pruefe('S1 mit gemeldeter E26: leerer Auftrag statt Stichprobe', JSON.stringify(s1fertig) === '[]', s1fertig)

pruefe('S2 will E26', JSON.stringify(auftrag({ staffelNr: 2 })) === '[26]', auftrag({ staffelNr: 2 }))
pruefe('S3 will E11', JSON.stringify(auftrag({ staffelNr: 3, anzahl: 11 })) === '[11]')
pruefe('S4 will E14 und E15', JSON.stringify(auftrag({ staffelNr: 4, anzahl: 27 })) === '[14,15]')

/*
  **Die Kennungen entscheiden, wo die Zahl nicht reicht.** S1 und S2 haben je
  26 Folgen. Ist „Lev ist hier!" übernommen, will S1 nichts mehr, S2 weiter E26.
*/
const OHNE_LEV = {
  ...HAIKYU,
  staffeln: HAIKYU.staffeln.map((st) => (st.nr === 1 ? { ...st, offen: false, zustand: 'belegt' } : st)),
}
const MIT_IDS = NETFLIX.map((st) => ({ ...st, ids: Array.from({ length: st.folgen }, (_, i) => vid(st.seq, i + 1)) }))
pruefe('mit Kennungen: S1 ohne Offenes ergibt nichts', JSON.stringify(auftrag({ eintrag: OHNE_LEV, anbieter: MIT_IDS })) === '[]')
pruefe(
  'mit Kennungen: S2 will weiter E26',
  JSON.stringify(auftrag({ staffelNr: 2, eintrag: OHNE_LEV, anbieter: MIT_IDS })) === '[26]',
)
pruefe(
  'ohne Kennungen und mehrdeutig: der strengere Zustand, eine Folge zu viel statt der Stichprobe',
  JSON.stringify(auftrag({ eintrag: OHNE_LEV })) === '[26]',
)
pruefe(
  'eine Meldung aus dem Player verrät die Staffel',
  JSON.stringify(auftrag({ eintrag: OHNE_LEV, meldungen: [meldung(1, 3)] })) === '[]',
)

const ganz = auftrag({
  anzahl: 12,
  eintrag: { titel: 'Ganz', laut: 'anbieter-gerechnet', staffeln: [{ nr: 1, folgen: 12, erste: 1, offen: true, zustand: 'melden' }] },
  anbieter: [{ seq: 1, folgen: 12, erste: 1 }],
})
pruefe('eine ganz offene Staffel geht an die Stichprobe', ganz === null, ganz)

/* ── Der Zustand je Folge ─────────────────────────────────────────────── */

pruefe(
  'belegt im Bestand zählt als gemeldet, mit dem Datum des Belegs',
  JSON.stringify(ausfuehren("folgeZustand('80090673', 2, 5)")) ===
    JSON.stringify({ zustand: 'gemeldet', am: '2026-08-22', ausBestand: true }),
  ausfuehren("folgeZustand('80090673', 2, 5)"),
)
pruefe(
  'eine abgeleitete Folge gilt als gemeldet — mit dem Datum ihrer Meldung',
  ausfuehren("folgeZustand('80090673', 1, 26)", { meldungen: [meldung(1, 26)] })?.am === AM,
)
pruefe(
  'S2 E5 gemeldet macht S1 E5 nicht zu gemeldet (jede Staffel fängt bei 1 an)',
  ausfuehren("meldungAm('80090673', 1, 5)", { meldungen: [{ ...meldung(2, 5), folge: null }] }) === undefined,
)
pruefe('Haikyu!! zählt nicht durch', ausfuehren("zaehltDurch('80090673')") === false)

const ERNEUT = {
  ...HAIKYU,
  staffeln: HAIKYU.staffeln.map((st) =>
    st.nr === 3 && st.erste === 1 ? { ...st, offen: true, zustand: 'erneut', seit: '2026-09-11T08:00:00.000Z' } : st,
  ),
}
pruefe(
  'erneut: eine ältere Meldung löst es nicht ab',
  ausfuehren("folgeZustand('80090673', 3, 4)", { eintrag: ERNEUT, meldungen: [meldung(3, 4, '2026-09-01T00:00:00Z')] })
    ?.zustand === 'erneut',
)
pruefe(
  'erneut: eine neuere Meldung löst es ab',
  ausfuehren("folgeZustand('80090673', 3, 4)", { eintrag: ERNEUT, meldungen: [meldung(3, 4)] })?.zustand === 'gemeldet',
)

/* ── Der Dialog ───────────────────────────────────────────────────────── */

const pillen = ausfuehren("staffelnVon('80090673', offeneTitel['80090673'])")
pruefe('der Dialog zeigt vier Pillen, nicht neun', pillen?.length === 4, pillen?.length)
pruefe('S1 reicht von E1 bis E26', pillen?.[0]?.erste === 1 && pillen?.[0]?.folgen === 26)
pruefe('S4 reicht bis E27', pillen?.[3]?.folgen === 27)
pruefe(
  'ohne gespeicherte Anbieterzählung wird die gerechnete Liste trotzdem gruppiert',
  ausfuehren("staffelnVon('80090673', offeneTitel['80090673'])", { anbieter: null })?.length === 4,
)
pruefe(
  'die Pille nimmt ihren Zustand aus folgeZustand(), nicht aus dem lokalen Speicher',
  /folgeZustand\(id, st\.nr, n\)/.test(quelle) && !/alle\.filter\(\(n\) => kuerzelErledigt\(id,/.test(quelle),
)
const zeilen = ausfuehren(
  "zustandZeilen([1,2,3].map((n) => ({ n, ...folgeZustand('80090673', 2, n) })).concat([{ n: 26, ...folgeZustand('80090673', 2, 26) }]))",
)
pruefe(
  'der Tooltip nennt Herkunft und Datum',
  JSON.stringify(zeilen) === JSON.stringify(['✓ belegt 22.08.: E1-3', 'zu melden: E26']),
  zeilen,
)

/* Das ✕ an der Pille meldet den offenen Titel, nicht den ersten. */
pruefe('das ✕ an S1 meint die offene OVA', ausfuehren("titelIdFuer('80090673', 1)") === 1001)

/* Das Format, das Daniel vorgegeben hat — ein E vorn, danach nur Zahlen. */
pruefe(
  'Bereiche lesen sich wie E1-3, 5-6, 9-12, 26',
  ausfuehren("'E' + alsBereiche([1, 2, 3, 5, 6, 9, 10, 11, 12, 26]).join(', ')") === 'E1-3, 5-6, 9-12, 26',
)
pruefe('kein zweites E hinter dem Komma', !/join\(", E"\)/.test(quelle))

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zum Netflix-Zustand halten.')
