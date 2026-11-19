/**
 * Das Messwerkzeug `tools/ohne-weg-gruende.ts` (19.11.2026): je Grund ein Titel, je Ursache von `offen` ein Titel (auch mehrdeutig, fremd, abgelaufen).
 * Die Ursachen sind nur Messung (`lib/ohne-weg-offen.ts`); die Gründe selbst prüft `check-ohne-weg.ts`. Aufruf: `npm run check:logic`.
 */
import { baueOhneWeg, type OhneWegEingabe } from './lib/ohne-weg.ts'
import { offenUrsachen, OFFEN_URSACHEN } from './lib/ohne-weg-offen.ts'
import { messe } from '../tools/ohne-weg-gruende.ts'

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
    10: befund(undefined, 0, [], { ohneTreffer: true, namenTreffer: { jwId: 'x' } }),
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
  },
  discAusgaben: { 6: [{ datum: '2020-01-01' }] },
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
pruefe('Die Ursachen zählen genau die `offen`-Titel', ursachen.size === Object.values(eintraege).filter((x) => x.reason === 'offen').length)

/* Das Werkzeug über dieselbe Fixture (nicht über Dateien, die in der PR-Kette fehlen können): Summe der Gründe = Gesamtzahl, Ursachen = offen. */
const m = messe(eingabe)
pruefe('messe: Summe der Gründe = Gesamtzahl', Object.values(m.gruende).reduce((a, b) => a + b, 0) === m.gesamt && m.gesamt === 18, m.gruende)
pruefe('messe: Summe der Ursachen = Zahl offen', Object.values(m.offen).reduce((a, b) => a + b, 0) === m.gruende.offen && m.gruende.offen === 12, m.offen)

if (verletzt) {
  console.error(`\n✖ ${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\n✓ ohne-weg-ursachen: je Grund und je Ursache von „offen“ ein Fall, Summen stimmen')
