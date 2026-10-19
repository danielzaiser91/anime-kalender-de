/**
 * Regel „gemessenes Ja ⇒ mindestens ein Weg“ (`lib/ja-hat-weg.ts`), geprüft an erfundenen Titeln in der Form der echten Fälle.
 * Der Lauf am echten Bestand steht in `check-ja-hat-weg-bestand.ts` (check:bestand-liste und PR-Datenbau).
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bestandsFehler, jaOhneWeg, ueberholteAusnahmen, type JaBeleg, type WegTitel } from './lib/ja-hat-weg.ts'

let verletzt = 0
function erwarte(name: string, ist: unknown, soll: unknown): void {
  const ok = JSON.stringify(ist) === JSON.stringify(soll)
  if (!ok) verletzt++
  console.log(`  ${ok ? '✓' : '✖'} ${name}${ok ? '' : ` — erwartet ${JSON.stringify(soll)}, gefunden ${JSON.stringify(ist)}`}`)
}

const beleg = (anilistId: number, url: string, urteil: Partial<JaBeleg>, checkedAt = '2026-10-12'): JaBeleg => ({
  anilistId,
  platform: 'primevideo',
  url,
  checkedAt,
  ...urteil,
})
const titel = (id: number, o: Partial<WegTitel> = {}): WegTitel => ({ id, titleEn: `Titel ${id}`, streams: [], watchLinks: [], ...o })
const weg = [{ platform: 'netflix', url: 'https://www.netflix.com/title/1' }]

/* Hazbin Hotel: zwei Ja, ein Nein zu einer dritten Seite, dazu Titel davor und danach. */
const hazbin = [
  beleg(-2, 'https://a/1', { dub: true }),
  beleg(-2, 'https://a/2', { dub: true }),
  beleg(-2, 'https://a/3', { dub: false }),
]
erwarte('Ja ohne Weg ist ein Verstoß, Nachbartitel nicht', jaOhneWeg([titel(-1, { streams: weg }), titel(-2), titel(-3, { streams: weg })], hazbin), ['-2 Titel -2'])
erwarte('ein Stream genügt', jaOhneWeg([titel(-2, { streams: weg })], hazbin), [])
erwarte('ein Bezugsweg genügt', jaOhneWeg([titel(-2, { watchLinks: weg })], hazbin), [])
erwarte('Titel ohne Weg und ohne Ja ist kein Verstoß', jaOhneWeg([titel(-9)], hazbin), [])
erwarte('Titel fehlt im Datensatz: kein Verstoß', jaOhneWeg([titel(-1, { streams: weg })], hazbin), [])
erwarte('streams und watchLinks fehlen ganz', jaOhneWeg([{ id: -2, titleEn: 'x' }], hazbin), ['-2 x'])
erwarte('Nein zur selben Adresse am selben Tag hebt das Ja auf', jaOhneWeg([titel(-4)], [beleg(-4, 'https://a/1', { dub: true }), beleg(-4, 'https://a/1', { dub: false })]), [])
erwarte('available: false zur selben Adresse hebt das Ja auf', jaOhneWeg([titel(-4)], [beleg(-4, 'https://a/1', { dub: true }), beleg(-4, 'https://a/1', { available: false })]), [])
erwarte('jüngeres Ja nach altem Nein gilt', jaOhneWeg([titel(-4)], [beleg(-4, 'https://a/1', { dub: false }, '2026-09-01'), beleg(-4, 'https://a/1', { dub: true })]), ['-4 Titel -4'])
erwarte('jüngeres Nein nach altem Ja hebt es auf', jaOhneWeg([titel(-4)], [beleg(-4, 'https://a/1', { dub: true }, '2026-09-01'), beleg(-4, 'https://a/1', { dub: false })]), [])
erwarte('Adressbeleg ohne Urteil, jünger, hebt das Ja nicht auf', jaOhneWeg([titel(-4)], [beleg(-4, 'https://a/1', { dub: true }, '2026-09-01'), beleg(-4, 'https://a/1', {})]), ['-4 Titel -4'])
erwarte(
  'mehrere Nein zur selben Adresse: das jüngste zählt, auch wenn ein älteres danach steht',
  jaOhneWeg([titel(-4)], [beleg(-4, 'https://a/1', { dub: true }, '2026-09-15'), beleg(-4, 'https://a/1', { dub: false }, '2026-10-01'), beleg(-4, 'https://a/1', { dub: false }, '2026-09-01')]),
  [],
)
erwarte('Nein einer anderen Plattform hebt das Ja nicht auf', jaOhneWeg([titel(-4)], [beleg(-4, 'https://a/1', { dub: true }), beleg(-4, 'https://a/1', { dub: false, platform: 'netflix' })]), ['-4 Titel -4'])
erwarte('Nein eines anderen Titels hebt das Ja nicht auf', jaOhneWeg([titel(-4)], [beleg(-4, 'https://a/1', { dub: true }), beleg(-5, 'https://a/1', { dub: false })]), ['-4 Titel -4'])
erwarte('Beleg ohne Urteil ist kein Ja', jaOhneWeg([titel(-6)], [beleg(-6, 'https://a/1', {})]), [])
erwarte('Ausnahme mit Grund nimmt den Titel aus', jaOhneWeg([titel(-2)], hazbin, new Map([[-2, 'Grund']])), [])
erwarte('Ausnahme für anderen Titel nimmt nichts aus', jaOhneWeg([titel(-2)], hazbin, new Map([[-3, 'Grund']])), ['-2 Titel -2'])
erwarte('überholte Ausnahme (Titel hat Weg) wird gemeldet', ueberholteAusnahmen([titel(-2, { streams: weg })], hazbin, new Map([[-2, 'Grund']])), [-2])
erwarte('gültige Ausnahme wird nicht als überholt gemeldet', ueberholteAusnahmen([titel(-2)], hazbin, new Map([[-2, 'Grund']])), [])
erwarte('Bestandsmeldung: grün ist leer', bestandsFehler([titel(-2, { streams: weg })], hazbin, new Map()), [])
erwarte('Bestandsmeldung: Verstoß nennt Zahl und Titel', bestandsFehler([titel(-2)], hazbin, new Map()), ['✖ 1 Titel mit gemessenem Ja ohne jeden Weg:', '    -2 Titel -2'])
erwarte('Bestandsmeldung: überholte Ausnahme nennt die Kennung', bestandsFehler([titel(-2, { streams: weg })], hazbin, new Map([[-2, 'Grund']])), ['✖ Ausnahmen ohne Verstoß (streichen): -2'])
erwarte('Bestandsmeldung: gültige Ausnahme ist grün', bestandsFehler([titel(-2)], hazbin, new Map([[-2, 'Grund']])), [])
/* Der Bestandslauf als eigener Prozess: Exit-Code und Ergebniszeile auf einer Kulisse mit dem Hazbin-Fall. */
const wurzel = mkdtempSync(join(tmpdir(), 'ja-hat-weg-'))
try {
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
  writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
  const eintrag = (id: number, kennung: string) =>
    `- anilistId: ${id}\n  title: "Beispiel"\n  platform: primevideo\n  url: https://www.amazon.de/gp/video/detail/${kennung}\n  dub: true\n  checkedAt: '2026-10-12'\n`
  writeFileSync(join(wurzel, 'data', 'dub-confirmed.yaml'), eintrag(-2, 'B0AAAAAAA1') + eintrag(-3, 'B0AAAAAAA2') + eintrag(-4, 'B0AAAAAAA3'))
  const lauf = (dateien: { titles?: WegTitel[]; cartoons?: WegTitel[]; ohne?: WegTitel[] }) => {
    writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify(dateien.titles ?? []))
    writeFileSync(join(wurzel, 'public', 'data', 'ohne-synchro.json'), JSON.stringify(dateien.ohne ?? []))
    writeFileSync(join(wurzel, 'public', 'data', 'cartoons.json'), JSON.stringify(dateien.cartoons ?? []))
    const r = spawnSync(process.execPath, ['--import', 'tsx', join(import.meta.dirname, 'check-ja-hat-weg-bestand.ts')], {
      env: { ...process.env, AK_ROOT: wurzel },
      encoding: 'utf8',
      windowsHide: true,
    })
    return { exit: r.status, aus: `${r.stdout}${r.stderr}` }
  }
  const ohneWeg = (id: number) => titel(id, { titleDe: `Beispiel ${-id}` })
  const rotC = lauf({ cartoons: [ohneWeg(-2)] })
  erwarte('Bestandslauf: Ja ohne Weg in cartoons.json ist Exit 1 mit dem Titel in der Meldung', [rotC.exit, rotC.aus.includes('-2 Beispiel 2')], [1, true])
  const rotT = lauf({ titles: [ohneWeg(-3)] })
  erwarte('Bestandslauf: Ja ohne Weg in titles.json ist Exit 1', [rotT.exit, rotT.aus.includes('-3 Beispiel 3')], [1, true])
  const rotO = lauf({ ohne: [ohneWeg(-4)] })
  erwarte('Bestandslauf: Ja ohne Weg in ohne-synchro.json ist Exit 1', [rotO.exit, rotO.aus.includes('-4 Beispiel 4')], [1, true])
  const gruen = lauf({ titles: [titel(-3, { streams: weg })], cartoons: [titel(-2, { watchLinks: weg })], ohne: [titel(-4, { streams: weg })] })
  erwarte('Bestandslauf: mit Weg Exit 0 und Ergebniszeile', [gruen.exit, /^✓ Gemessenes Ja ⇒ mindestens ein Weg: 3 Titel/m.test(gruen.aus)], [0, true])
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
if (verletzt) process.exit(1)
