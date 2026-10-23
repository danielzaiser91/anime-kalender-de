/**
 * Zusicherung: Bei einem Nein-Handbeleg (`neinHandbelege`) entscheidet das Datum, und Such-/Start-/Länderseiten zählen nicht als Ausgabe.
 * (a) Ein älteres Ja an derselben Adresse hebt ein jüngeres Nein nicht auf (und umgekehrt), wie in `verschmelze`.
 * (b) `amazon.de/s?k=…`, `crunchyroll.com`, `…/de` beschränken ein Nein nicht auf sich und belegen mit einem Ja keine zweite Ausgabe.
 * Der Weg ist der echte: `data/dub-confirmed.yaml` einer Kulisse (`AK_ROOT`) → `ladeHandbelege` → `neinHandbelege` → `wegVerneint`.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-nein-handbeleg-datum.ts`
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const kulisse = mkdtempSync(join(tmpdir(), 'ak-nein-datum-'))
mkdirSync(join(kulisse, 'data'))
process.env.AK_ROOT = kulisse
const { ladeHandbelege, neinHandbelege, wegVerneint } = await import('./lib/dub-confirmed.ts')
const { istSammelKern } = await import('../shared/adresse-kern.ts')

const prime = (asin: string) => `https://www.amazon.de/dp/${asin}`
const FREMD = 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.70a9f6b2-e01c-dfe3-ef0c-dc0ae2d750a5'
const BEREICH = '  dubRanges:\n    - { from: 1, to: 12, dub: true }\n'

/** Schreibt die Zeilen als Handbelegdatei der Kulisse und liefert, ob `wegVerneint` den Weg zu `url` für Titel `id` (Prime) sperrt. */
function sperrt(zeilen: string[], id: number, url: string): boolean {
  writeFileSync(join(kulisse, 'data', 'dub-confirmed.yaml'), zeilen.join(''))
  return wegVerneint(neinHandbelege(ladeHandbelege()), id, 'primevideo', url)
}
const beleg = (id: number, url: string, datum: string, urteil: string) =>
  `- anilistId: ${id}\n  platform: primevideo\n  url: ${url}\n  checkedAt: '${datum}'\n${urteil}`

try {
  console.log('\nJüngeres Urteil derselben Adresse gewinnt:')
  const A = prime('B0DATUM001')
  const ja = (id: number, d: string) => beleg(id, A, d, '  dub: true\n')
  const jaBereich = (id: number, d: string) => beleg(id, A, d, BEREICH)
  const nein = (id: number, d: string) => beleg(id, A, d, '  dub: false\n')
  const weg = (id: number, d: string) => beleg(id, A, d, '  available: false\n')
  pruefe('älteres Ja (Bereich), jüngeres dub: false: Nein gilt', sperrt([jaBereich(1, '2026-09-01'), nein(1, '2026-09-10')], 1, FREMD))
  pruefe('… in der Datei umgekehrt angeordnet: dasselbe', sperrt([nein(2, '2026-09-10'), jaBereich(2, '2026-09-01')], 2, FREMD))
  pruefe('älteres Ja (dub: true), jüngeres available: false: Nein gilt', sperrt([ja(3, '2026-09-01'), weg(3, '2026-09-10')], 3, FREMD))
  pruefe('älteres Nein, jüngeres Ja (dub: true): kein Nein', !sperrt([nein(4, '2026-09-01'), ja(4, '2026-09-10')], 4, FREMD))
  pruefe('älteres available: false, jüngeres Ja: kein Nein', !sperrt([weg(5, '2026-09-01'), ja(5, '2026-09-10')], 5, FREMD))
  pruefe('älteres Nein, jüngeres Ja (Bereich): kein Nein', !sperrt([nein(6, '2026-09-01'), jaBereich(6, '2026-09-10')], 6, FREMD))
  pruefe('Ja und Nein am selben Tag: das Nein gilt (wie bisher)', sperrt([ja(7, '2026-09-10'), weg(7, '2026-09-10')], 7, FREMD))
  /* Folgezeile ohne Urteil oder mit gleichem Urteil ändert nichts: das jüngste Urteil bleibt. */
  const notiz = (id: number, d: string) => beleg(id, A, d, '  note: "Nachsehen ohne Befund"\n')
  pruefe('Ja (Bereich), Nein, dann Zeile nur mit Notiz: Nein gilt weiter', sperrt([jaBereich(8, '2026-09-01'), nein(8, '2026-09-10'), notiz(8, '2026-09-20')], 8, FREMD))
  pruefe('Ja (Bereich), Nein, dann ein zweites Nein: Nein gilt weiter', sperrt([jaBereich(9, '2026-09-01'), nein(9, '2026-09-10'), nein(9, '2026-09-20')], 9, FREMD))
  pruefe('Ja (Bereich), Nein, dann wieder Ja (Bereich): kein Nein', !sperrt([jaBereich(10, '2026-09-01'), nein(10, '2026-09-10'), jaBereich(10, '2026-09-20')], 10, FREMD))
  pruefe('Nein, Ja, dann Zeile nur mit Notiz: kein Nein', !sperrt([nein(11, '2026-09-01'), ja(11, '2026-09-10'), notiz(11, '2026-09-20')], 11, FREMD))
  /* Gleicher Tag: kein Urteil „gewinnt“, es zählt der Feldvergleich in Dateireihenfolge (hier bleibt „nicht verfügbar“ stehen). */
  pruefe('Nein und Ja am selben Tag, Nein zuerst: das Nein gilt (available: false bleibt)', sperrt([weg(15, '2026-09-10'), ja(15, '2026-09-10')], 15, FREMD))
  pruefe('Ja (Bereich), Nein, dann Ja am Tag des Nein: kein Nein (das Urteil des Nein-Tages gilt nicht mehr)', !sperrt([jaBereich(16, '2026-09-01'), nein(16, '2026-09-10'), ja(16, '2026-09-10')], 16, FREMD))
  pruefe('Ja (Bereich), Nein vom 10.09., Ja (Bereich) vom 05.09., Datei in dieser Reihenfolge: das Nein bleibt das jüngste', sperrt([jaBereich(17, '2026-09-01'), nein(17, '2026-09-10'), jaBereich(17, '2026-09-05')], 17, FREMD))
  /* Ohne Adresse sperrt ein Nein die Plattform: auch dort entscheidet das Datum. */
  const ohne = (id: number, d: string, urteil: string) => `- anilistId: ${id}\n  platform: primevideo\n  checkedAt: '${d}'\n${urteil}`
  pruefe('ohne Adresse: älteres Ja, jüngeres Nein: Nein gilt', sperrt([ohne(18, '2026-09-01', '  dub: true\n'), ohne(18, '2026-09-10', '  available: false\n')], 18, FREMD))
  pruefe('ohne Adresse: älteres Nein, jüngeres Ja: kein Nein', !sperrt([ohne(19, '2026-09-01', '  available: false\n'), ohne(19, '2026-09-10', '  dub: true\n')], 19, FREMD))
  /* Ein jüngeres „nicht verfügbar“ löst auch ein Ja ab, das selbst schon ein Nein abgelöst hat. */
  pruefe('Nein, Ja, dann „nicht verfügbar“: Nein gilt', sperrt([nein(21, '2026-09-01'), ja(21, '2026-09-05'), weg(21, '2026-09-10')], 21, FREMD))
  const jaUndWeg = beleg(22, A, '2026-09-10', '  dub: true\n  available: false\n')
  pruefe('Nein, Ja, dann eine Zeile mit dub: true und available: false: Nein gilt', sperrt([nein(22, '2026-09-01'), ja(22, '2026-09-05'), jaUndWeg], 22, FREMD))
  /* Mehrere Staffeln einer Serie: Zeilen anderer Titel und anderer Adressen bleiben unberührt. */
  const zwei = [jaBereich(12, '2026-09-01'), nein(12, '2026-09-10'), beleg(13, A, '2026-09-10', '  dub: true\n')]
  pruefe('anderer Titel mit derselben Adresse und Ja: kein Nein', !sperrt(zwei, 13, FREMD))
  pruefe('Nein an Adresse X, jüngeres Ja an Adresse Y: Nein gilt nur X', sperrt([beleg(14, prime('B0ADRESSEX1'), '2026-09-01', '  dub: false\n'), beleg(14, prime('B0ADRESSEY1'), '2026-09-10', '  dub: true\n')], 14, prime('B0ADRESSEX1')) && !sperrt([beleg(14, prime('B0ADRESSEX1'), '2026-09-01', '  dub: false\n'), beleg(14, prime('B0ADRESSEY1'), '2026-09-10', '  dub: true\n')], 14, FREMD))

  console.log('\nSuch-, Start- und Länderseiten sind keine Ausgabe:')
  const SUCHE = 'https://www.amazon.de/s?k=Jormungand%3A%20Perfect%20Order&i=instant-video'
  const ASIN = prime('B0DNCGXVNT')
  /* Anlassfall 13331 Jormungand: Ja an B0DNCGXVNT (30.08.), Nein an der Prime-Suche (19.09.). */
  const jormungand = [beleg(20, ASIN, '2026-08-30', '  dub: true\n'), beleg(20, SUCHE, '2026-09-19', '  available: false\n')]
  pruefe('Nein an der Suche neben einem Ja an echter Adresse: es widerlegt die Seite nicht, kein Nein', !sperrt(jormungand, 20, FREMD) && !sperrt(jormungand, 20, ASIN))
  pruefe('Nein an der Suche allein: es sperrt die Plattform, nicht nur „amazon.de/s“', sperrt([beleg(24, SUCHE, '2026-09-19', '  available: false\n')], 24, FREMD))
  pruefe('Nein an der Suche, Ja ohne Adresse daneben: das Ja belegt keine Ausgabe, die Plattform bleibt gesperrt', sperrt([beleg(25, SUCHE, '2026-09-19', '  available: false\n'), `- anilistId: 25\n  platform: primevideo\n  checkedAt: '2026-09-20'\n  dub: true\n`], 25, FREMD))
  pruefe('Nein an echter Adresse, Ja an der Suche: das Ja belegt keine zweite Ausgabe, das Nein sperrt die Plattform', sperrt([beleg(21, ASIN, '2026-09-01', '  dub: false\n'), beleg(21, SUCHE, '2026-09-10', '  dub: true\n')], 21, FREMD))
  pruefe('Nein an der Startseite crunchyroll.com neben Ja an echter Adresse: kein Nein', !sperrt([beleg(22, ASIN, '2026-08-30', '  dub: true\n'), beleg(22, 'https://www.crunchyroll.com/', '2026-09-19', '  dub: false\n')], 22, FREMD))
  pruefe('Nein an echter Adresse neben Ja an echter Adresse bleibt auf seine beschränkt', !sperrt([beleg(23, ASIN, '2026-08-30', '  dub: true\n'), beleg(23, prime('B0ANDERESNE'), '2026-09-19', '  dub: false\n')], 23, FREMD))

  const ohneUrl = (id: number, urteil: string) => `- anilistId: ${id}\n  platform: primevideo\n  checkedAt: '2026-09-25'\n${urteil}`
  pruefe('Nein an der Suche und Nein ohne Adresse neben Ja an echter Adresse: das Nein ohne Adresse sperrt die Plattform', sperrt([beleg(26, ASIN, '2026-08-30', '  dub: true\n'), beleg(26, SUCHE, '2026-09-19', '  available: false\n'), ohneUrl(26, '  available: false\n')], 26, FREMD))
  /* Rohzeilen ohne Verschmelzung (kein `ladeHandbelege`): Ja trägt an Sammeladresse und ohne Adresse nichts, das Nein bleibt. */
  const roh = (url: string | undefined, rest: object) => ({ anilistId: 27, platform: 'primevideo' as const, url, ...rest })
  pruefe('Ja und Nein beide ohne Adresse: das Nein gilt', wegVerneint(neinHandbelege([roh(undefined, { dub: true }), roh(undefined, { available: false })]), 27, 'primevideo', FREMD))
  pruefe('Ja und Nein beide an derselben Suche: das Nein gilt', wegVerneint(neinHandbelege([roh(SUCHE, { dub: true }), roh(SUCHE, { available: false })]), 27, 'primevideo', FREMD))
  pruefe('… in umgekehrter Reihenfolge ebenso', wegVerneint(neinHandbelege([roh(SUCHE, { available: false }), roh(SUCHE, { dub: true })]), 27, 'primevideo', FREMD))

  console.log('\nistSammelKern:')
  const sammel = ['amazon.de/s', 'amazon.de/s/ref=nb_sb_noss', 'crunchyroll.com', 'crunchyroll.com/de', 'crunchyroll.com/de-de', 'netflix.com/search', 'anbieter.de/suche']
  const echt = ['amazon:B0DNCGXVNT', 'amazon-gti:amzn1.dv.gti.70a9f6b2-e01c-dfe3-ef0c-dc0ae2d750a5', 'netflix.com/title/7', 'crunchyroll.com/series/g6nvw1fb5/titel', 'youtube.com/watch?v=RiuV5W30Xvc', 'crunchyroll.com/deutsch', 'anbieter.de/series', 'amazon.de/dp', '']
  pruefe('Suche, Start, Land: ja', sammel.every((k) => istSammelKern(k)), sammel.filter((k) => !istSammelKern(k)))
  pruefe('Ausgabe-Adressen und leerer Kern: nein', echt.every((k) => !istSammelKern(k)), echt.filter((k) => istSammelKern(k)))
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
