/**
 * Das Messwerkzeug `tools/ohne-weg-gruende.ts` (19.11.2026): je Grund ein Titel, je Ursache von `offen` ein Titel (auch mehrdeutig, fremd, abgelaufen).
 * Die Ursachen sind nur Messung (`lib/ohne-weg-offen.ts`); die Gründe selbst prüft `check-ohne-weg.ts`. Aufruf: `npm run check:logic`.
 */
import { baueOhneWeg, type OhneWegEingabe } from './lib/ohne-weg.ts'
import { offenUrsachen, OFFEN_URSACHEN } from './lib/ohne-weg-offen.ts'
import { messe } from '../tools/ohne-weg-gruende.ts'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = '2026-11-19'
type Befund = OhneWegEingabe['justwatch'][string]
const titel = (id: number, format = 'TV') => ({ id, format, streams: [] }) as unknown as OhneWegEingabe['titel'][number]
const befund = (jwId: string | undefined, tmdbId: number, angebote: { art: string; audio?: string[] }[], extra: Record<string, unknown> = {}) =>
  ({ geprueftAm: '2026-11-17', ...(jwId ? { jwId, tmdbId } : {}), angebote: angebote.map((a) => ({ anbieter: 'X', ...a })), ...extra }) as unknown as Befund
const check = (anilistId: number, platform: string, extra: Record<string, unknown>) => ({ anilistId, platform, checkedAt: '2026-10-01', ...extra }) as unknown as OhneWegEingabe['handbelege'][number]

/* Kennung → (erwarteter Grund, erwartete Ursache bei `offen`) */
const faelle: Record<number, [string, string | undefined]> = {
  1: ['angekuendigt', undefined],
  2: ['kein-dub', undefined],
  3: ['nur-kauf', undefined],
  4: ['film-ohne-abo', undefined],
  5: ['abo-ohne-ton', undefined],
  6: ['nur-disc', undefined],
  7: ['offen', 'handbeleg-deutsch'],
  8: ['offen', 'jw-kein-befund'],
  9: ['offen', 'jw-kein-treffer'],
  10: ['offen', 'jw-mehrdeutig'],
  11: ['offen', 'jw-fremd'],
  12: ['offen', 'jw-verfehlt'],
  13: ['offen', 'jw-abgelaufen'],
  14: ['offen', 'jw-abgelaufen'],
  15: ['offen', 'jw-gilt-ohne-angebot'],
  16: ['offen', 'jw-gilt-abo-mit-deutsch'],
  17: ['offen', 'jw-gilt-abo-ton-unbekannt'],
  18: ['offen', 'jw-gilt-sonst'],
  /* Grenztag: 28 Tage alt gilt nicht mehr (jw-abgelaufen), 27 gilt (hier Grund abo-ohne-ton). */
  20: ['offen', 'jw-abgelaufen'],
  21: ['abo-ohne-ton', undefined],
  /* Kino und Leihe neben einem Abo ohne Tonangabe zählen nicht als Abo-Ton: bleibt „ton-unbekannt“, auch wenn sie Deutsch nennen. */
  22: ['offen', 'jw-gilt-abo-ton-unbekannt'],
  23: ['offen', 'jw-gilt-abo-ton-unbekannt'],
  /* Mehrdeutig geht vor abgelaufen. */
  24: ['offen', 'jw-mehrdeutig'],
  /* Wie 15, aber mit erschienener Disc: der Disc-Mangel ist der Unterschied zwischen offen und nur-disc. */
  25: ['nur-disc', undefined],
  /* Namenstreffer ohne gleichen Namen ist Suchrauschen: frisch = kein-treffer, alt = abgelaufen (nur gleicherName: true ist mehrdeutig). */
  26: ['offen', 'jw-kein-treffer'],
  27: ['offen', 'jw-abgelaufen'],
}
const eingabe: OhneWegEingabe = {
  titel: Object.keys(faelle).map((k) => titel(Number(k), Number(k) === 4 ? 'MOVIE' : 'TV')),
  termine: [{ titleId: 1, platform: 'netflix', date: '2999-01-01' }],
  handbelege: [check(2, 'prime', { dub: false }), check(7, 'prime', { dub: true })],
  justwatch: {
    3: befund('k3', 3, [{ art: 'RENT' }]),
    4: befund('k4', 4, []),
    5: befund('k5', 5, [{ art: 'FLATRATE', audio: ['en'] }]),
    6: befund(undefined, 0, [], { ohneTreffer: true }),
    9: befund(undefined, 0, [], { ohneTreffer: true }),
    10: befund(undefined, 0, [], { ohneTreffer: true, namenTreffer: { jwId: 'x', gleicherName: true } }),
    /* 11 und 19 teilen jwId `k11` bei verschiedener TMDB-Kennung; 19 ist kein ohne-Weg-Titel, nur der zweite Halter. */
    11: befund('k11', 11, [{ art: 'FLATRATE', audio: [] }]),
    19: befund('k11', 190, [{ art: 'FLATRATE', audio: ['de'] }]),
    12: befund('k12', 12, [{ art: 'FLATRATE', audio: ['en'] }], { verfehltAm: '2026-11-10' }),
    13: befund('k13', 13, [{ art: 'FLATRATE', audio: ['en'] }], { geprueftAm: '2026-10-01' }),
    14: befund(undefined, 0, [], { ohneTreffer: true, geprueftAm: '2026-10-01' }),
    15: befund('k15', 15, []),
    16: befund('k16', 16, [{ art: 'FLATRATE', audio: ['de'] }]),
    17: befund('k17', 17, [{ art: 'FLATRATE', audio: [] }]),
    18: befund('k18', 18, [{ art: 'CINEMA', audio: ['en'] }]),
    20: befund('k20', 20, [{ art: 'FLATRATE', audio: ['en'] }], { geprueftAm: '2026-10-22' }),
    21: befund('k21', 21, [{ art: 'FLATRATE', audio: ['en'] }], { geprueftAm: '2026-10-23' }),
    22: befund('k22', 22, [{ art: 'FLATRATE', audio: [] }, { art: 'CINEMA', audio: ['de'] }]),
    23: befund('k23', 23, [{ art: 'FLATRATE', audio: [] }, { art: 'RENT', audio: ['de'] }]),
    24: befund(undefined, 0, [], { ohneTreffer: true, namenTreffer: { jwId: 'x', gleicherName: true }, geprueftAm: '2026-10-01' }),
    25: befund('k25', 25, []),
    26: befund(undefined, 0, [], { ohneTreffer: true, namenTreffer: { jwId: 'x', gleicherName: false } }),
    27: befund(undefined, 0, [], { ohneTreffer: true, namenTreffer: { jwId: 'x', gleicherName: false }, geprueftAm: '2026-10-01' }),
  },
  discAusgaben: { 6: [{ datum: '2020-01-01' }], 25: [{ datum: '2020-01-01' }] },
  heute: HEUTE,
}

const eintraege = baueOhneWeg(eingabe)
const ursachen = offenUrsachen(eingabe, eintraege)
for (const [k, [grund, ursache]] of Object.entries(faelle)) {
  const id = Number(k)
  pruefe(`Titel ${id}: Grund ${grund}${ursache ? ` / ${ursache}` : ''}`, eintraege[id]?.reason === grund && ursachen.get(id) === ursache, [eintraege[id]?.reason, ursachen.get(id)])
}
pruefe('Jeder Fixture-Titel ohne Weg hat genau einen Eintrag (19 ist nur der zweite Halter von k11, kein Titel)', Object.keys(eintraege).length === Object.keys(faelle).length, Object.keys(eintraege).length)
pruefe('Jede Ursache der Liste kommt in der Fixture vor (sonst ist ein Zweig ungeprüft)', OFFEN_URSACHEN.every((u) => [...ursachen.values()].includes(u)), OFFEN_URSACHEN.filter((u) => ![...ursachen.values()].includes(u)))
pruefe('Die Ursachen gibt es genau für die `offen`-Titel (nie für einen Titel mit anderem Grund)', ursachen.size === Object.values(eintraege).filter((x) => x.reason === 'offen').length && [...ursachen.keys()].every((id) => eintraege[id]?.reason === 'offen'))

/* Das Werkzeug über dieselbe Fixture (nicht über Dateien, die in der PR-Kette fehlen können): Summe der Gründe = Gesamtzahl, Ursachen = offen. */
const m = messe(eingabe)
pruefe('messe: Summe der Gründe = Gesamtzahl', Object.values(m.gruende).reduce((a, b) => a + b, 0) === m.gesamt && m.gesamt === Object.keys(faelle).length, m.gruende)
pruefe('messe: Summe der Ursachen = Zahl offen', Object.values(m.offen).reduce((a, b) => a + b, 0) === m.gruende.offen && m.gruende.offen === Object.values(faelle).filter(([g]) => g === 'offen').length, m.offen)

/* Das Werkzeug als Prozess über eine Kulisse (AK_ROOT, ohne Handbelege): ohne Start von main() bliebe die Ausgabe leer. */
const wurzel = mkdtempSync(join(tmpdir(), 'ohne-weg-gruende-'))
try {
  for (const o of ['public/data', 'data']) mkdirSync(join(wurzel, o), { recursive: true })
  const schreibe = (pfad: string, d: unknown) => writeFileSync(join(wurzel, pfad), JSON.stringify(d))
  schreibe('public/data/titles.json', eingabe.titel)
  schreibe('public/data/cartoons.json', [])
  schreibe('public/data/events.json', eingabe.termine)
  schreibe('data/justwatch-audio.json', eingabe.justwatch)
  schreibe('data/disc-ausgaben.json', eingabe.discAusgaben)
  const skript = fileURLToPath(new URL('../tools/ohne-weg-gruende.ts', import.meta.url))
  const aufruf = (...args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', skript, ...args, '--heute', HEUTE], { encoding: 'utf8', windowsHide: true, timeout: 60_000, env: { ...process.env, AK_ROOT: wurzel } })
  const erwartet = messe({ ...eingabe, handbelege: [] })
  const json = aufruf('--json')
  const gelesen = json.status === 0 ? JSON.parse(json.stdout) : undefined
  pruefe('Prozess --json: Exit 0, gesamt und Gründe wie messe()', gelesen?.gesamt > 0 && JSON.stringify(gelesen.gruende) === JSON.stringify(erwartet.gruende) && JSON.stringify(gelesen.offen) === JSON.stringify(erwartet.offen), { status: json.status, stdout: json.stdout.slice(0, 200), stderr: json.stderr.slice(0, 300) })
  const text = aufruf()
  pruefe('Prozess ohne Option: Kopfzeile mit Gesamtzahl und Bau-Logzeile', text.stdout.includes(`Titel ohne Streaming-Weg am ${HEUTE}: ${erwartet.gesamt}`) && text.stdout.includes('Bau-Logzeile: ohne-weg.json:'), text.stdout.slice(0, 200))
  const alleOffen = aufruf('--grund', 'offen')
  pruefe('Prozess --grund offen: eine Zeile je offenen Titel, nicht leer', alleOffen.stdout.trim().split('\n').length === erwartet.gruende.offen, alleOffen.stdout.slice(0, 200))
  const liste = aufruf('--grund', 'offen/jw-mehrdeutig')
  pruefe('Prozess --grund offen/jw-mehrdeutig: genau Kennung 10 und 24', liste.stdout.trim().split('\n').map((z) => z.split('\t')[0]).join() === '10,24', liste.stdout)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n✖ ${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\n✓ ohne-weg-ursachen: je Grund und je Ursache von „offen“ ein Fall, Summen stimmen')
