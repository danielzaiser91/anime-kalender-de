/** Test der Fortschreibung des Mängel-Registers (neu, behoben, Rückfall, abwesend, `seit` bleibt), der Serialisierung und der Wache-Zeilen. */
import { MAENGEL_VORFASSUNG_ZEILE, maengelWarnZeilen, meldungen, offeneJeArt, schreibeFort, serialisiere, type ArtInfo, type Register } from './lib/maengel-register.ts'
import { warnZeilen } from './lib/qualitaet-warnzeilen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const T = (t: number, art: string, grund?: string) => ({ t, art, wirkung: 2, wer: 'daniel' as const, ...(grund ? { grund } : {}) })
const ARTEN: ArtInfo[] = [{ art: 'a', wirkung: 2, wer: 'daniel' }, { art: 'b', wirkung: 1, wer: 'auto:x' }]
const COVER: ArtInfo[] = [{ art: 'cover', wirkung: 3, wer: 'auto:tmdb-poster' }]
/** Alle Titel 1–9 und 99 sind im Hauptbestand. */
const DA = new Set([1, 2, 3, 4, 5, 9, 99])
const fort = (alt: Register | null, treffer: ReturnType<typeof T>[], heute: string, arten = ARTEN, ids: ReadonlySet<number> = DA) => schreibeFort(alt, treffer, arten, heute, ids)
const zeile = (r: Register, t: number, art = 'a') => r.zeilen.find((z) => z.t === t && z.art === art)!

const erst1 = fort(null, [T(1, 'a'), T(2, 'a'), T(3, 'b', 'zu-recht')], '2026-11-01')
pruefe('Erstlauf: offen gezählt, nichts „neu“, Ausnahme nur im Zähler', erst1.zaehler.a!.offen === 2 && erst1.zaehler.a!.neu === 0 && erst1.zaehler.b!.ausnahme === 1 && erst1.zeilen.length === 2 && erst1.zeilen.every((z) => !z.ereignis), erst1)
pruefe('Zähler tragen Wirkung und wer der Art (auch ohne offene Zeile)', erst1.zaehler.b!.wirkung === 1 && erst1.zaehler.b!.wer === 'auto:x' && erst1.zaehler.a!.wer === 'daniel', erst1.zaehler)

const zweit = fort(erst1, [T(1, 'a'), T(4, 'a')], '2026-11-05')
pruefe('`seit` bleibt, solange offen', zeile(zweit, 1).seit === '2026-11-01' && !zeile(zweit, 1).ereignis, zweit)
pruefe('neuer Titel: neu + ereignis, `seit` heute', zweit.zaehler.a!.neu === 1 && zeile(zweit, 4).ereignis === 'neu' && zeile(zweit, 4).seit === '2026-11-05', zweit)
pruefe('verschwundener Mangel: behoben mit `bis`, `seit` bleibt', zweit.zaehler.a!.behoben === 1 && zeile(zweit, 2).status === 'behoben' && zeile(zweit, 2).bis === '2026-11-05' && zeile(zweit, 2).seit === '2026-11-01', zeile(zweit, 2))

const dritt = fort(zweit, [T(1, 'a'), T(4, 'a')], '2026-11-06')
pruefe('behoben bleibt erhalten, zählt nicht erneut; Ereignis des Vortags ist weg', zeile(dritt, 2).status === 'behoben' && dritt.zaehler.a!.behoben === 0 && !zeile(dritt, 4).ereignis, dritt)

/* Neu und am Folgetag behoben: `ereignis` darf nicht an der behobenen Zeile bleiben. */
const neuDann = fort(zweit, [T(1, 'a')], '2026-11-06')
pruefe('neu am Vortag, heute behoben: Zeile `behoben` ohne `ereignis`', zeile(neuDann, 4).status === 'behoben' && zeile(neuDann, 4).ereignis === undefined && neuDann.zaehler.a!.behoben === 1, zeile(neuDann, 4))
const rueckDann = fort(fort(dritt, [T(1, 'a'), T(2, 'a'), T(4, 'a')], '2026-11-07'), [T(1, 'a'), T(4, 'a')], '2026-11-08')
pruefe('Rückfall am Vortag, heute behoben: ohne `ereignis`', zeile(rueckDann, 2).status === 'behoben' && zeile(rueckDann, 2).ereignis === undefined, zeile(rueckDann, 2))

/* Kontrolle (18.11.2026): Ein zweiter Bau am selben Tag meldet „neu“ nicht erneut — das Register trägt das Ereignis nur im Bau, der es findet. */
const zweitNochmal = fort(zweit, [T(1, 'a'), T(4, 'a')], '2026-11-05')
pruefe('Kontrolle: zweiter Bau desselben Tages ohne Warnzeile, `seit` bleibt', maengelWarnZeilen(zweitNochmal).length === 0 && zeile(zweitNochmal, 4).seit === '2026-11-05', maengelWarnZeilen(zweitNochmal))
const zweitMehr = fort(zweitNochmal, [T(1, 'a'), T(4, 'a'), T(5, 'a')], '2026-11-05')
pruefe('zweiter Bau desselben Tages mit weiterem neuen Titel meldet nur diesen', JSON.stringify(maengelWarnZeilen(zweitMehr)) === '["MAENGEL_NEU a: 1 (5)"]', maengelWarnZeilen(zweitMehr))

const rueck = fort(dritt, [T(1, 'a'), T(2, 'a'), T(4, 'a')], '2026-11-07')
pruefe('Rückfall: behoben und wieder offen, `seit` neu', rueck.zaehler.a!.rueckfall === 1 && rueck.zaehler.a!.neu === 0 && zeile(rueck, 2).ereignis === 'rueckfall' && zeile(rueck, 2).status === 'offen' && zeile(rueck, 2).seit === '2026-11-07', rueck)

/* 90 Tage: behoben am 2026-11-05 → am 2027-02-02 (89 Tage) noch da, am 2027-02-03 (90 Tage) weg. */
pruefe('behobene Zeile bleibt am Tag 89', fort(zweit, [T(1, 'a'), T(4, 'a')], '2027-02-02').zeilen.some((z) => z.t === 2), 89)
pruefe('behobene Zeile verfällt am Tag 90', !fort(zweit, [T(1, 'a'), T(4, 'a')], '2027-02-03').zeilen.some((z) => z.t === 2), 90)

/* Neu ergänzte Art: kein NEU-Flut beim ersten Bau. */
const ohneB: Register = { ...erst1, zaehler: { a: erst1.zaehler.a! } }
const neueArt = fort(ohneB, [T(1, 'a'), T(5, 'b'), T(9, 'b')], '2026-11-02')
pruefe('Art, die die Vorfassung nicht kannte: Treffer sind Bestand, nicht neu', neueArt.zaehler.b!.neu === 0 && neueArt.zaehler.b!.offen === 2 && neueArt.zeilen.filter((z) => z.art === 'b').every((z) => !z.ereignis), neueArt)
pruefe('… eine bekannte Art zählt weiter neu', fort(ohneB, [T(1, 'a'), T(5, 'a')], '2026-11-02').zaehler.a!.neu === 1)
pruefe('… auch eine Art ohne Zeilen, aber im Zähler der Vorfassung, zählt neu', fort(erst1, [T(1, 'a'), T(5, 'b')], '2026-11-02').zaehler.b!.neu === 1)

/* Titel verschwindet aus titles.json: abwesend, weder behoben noch Rückfall bei Rückkehr. */
const ohne2 = new Set([...DA].filter((i) => i !== 2))
const weg = fort(erst1, [T(1, 'a')], '2026-11-05', ARTEN, ohne2)
pruefe('Titel fehlt im Hauptbestand: Zeile `abwesend` mit `bis`, nicht behoben', zeile(weg, 2).status === 'abwesend' && zeile(weg, 2).bis === '2026-11-05' && weg.zaehler.a!.behoben === 0 && weg.zaehler.a!.offen === 1, weg)
const wegWeiter = fort(weg, [T(1, 'a')], '2026-11-20', ARTEN, ohne2)
pruefe('… bleibt abwesend und zählt nirgends', zeile(wegWeiter, 2).status === 'abwesend' && wegWeiter.zaehler.a!.behoben === 0 && wegWeiter.zaehler.a!.offen === 1, wegWeiter)
const zurueck = fort(weg, [T(1, 'a'), T(2, 'a')], '2026-11-21')
pruefe('Rückkehr mit dem Mangel: offen, `seit` bleibt, weder neu noch Rückfall', zeile(zurueck, 2).status === 'offen' && zeile(zurueck, 2).seit === '2026-11-01' && !zeile(zurueck, 2).ereignis && zurueck.zaehler.a!.neu === 0 && zurueck.zaehler.a!.rueckfall === 0, zurueck)
const zurueckOhne = fort(weg, [T(1, 'a')], '2026-11-21')
pruefe('Rückkehr ohne den Mangel: behoben', zeile(zurueckOhne, 2).status === 'behoben' && zurueckOhne.zaehler.a!.behoben === 1, zurueckOhne)
pruefe('abwesende Zeile verfällt nach 90 Tagen', !fort(weg, [T(1, 'a')], '2027-02-03', ARTEN, ohne2).zeilen.some((z) => z.t === 2) && fort(weg, [T(1, 'a')], '2027-02-02', ARTEN, ohne2).zeilen.some((z) => z.t === 2))
pruefe('Wache meldet abwesende Zeilen nicht', meldungen(weg, 'neu').length === 0 && meldungen(weg, 'rueckfall').length === 0)

const stabil = fort(null, [T(9, 'b'), T(2, 'a'), T(1, 'a')], '2026-11-01')
pruefe('Zeilen stabil sortiert: Art (Tabellenreihenfolge), dann Kennung', stabil.zeilen.map((z) => `${z.art}${z.t}`).join() === 'a1,a2,b9', stabil)
pruefe('Serialisierung ist gültiges JSON und gibt dasselbe Register zurück', JSON.stringify(JSON.parse(serialisiere(rueck))) === JSON.stringify(rueck))
pruefe('Serialisierung: eine Zeile je Mangel', serialisiere(rueck).split('\n').filter((l) => l.includes('"art"')).length === rueck.zeilen.length)
pruefe('Serialisierung: `hinweis` bleibt erhalten', JSON.parse(serialisiere({ ...rueck, hinweis: 'x' })).hinweis === 'x' && JSON.parse(serialisiere(rueck)).hinweis === undefined)
pruefe('Verlauf: offen je Art', JSON.stringify(offeneJeArt(rueck)) === '{"a":3,"b":0}', offeneJeArt(rueck))

const cover = fort(erst1, [T(1, 'cover'), T(2, 'cover')], '2026-11-02', COVER)
pruefe('Wache: NEU und RÜCKFALL je Art mit Beispielen', meldungen(zweit, 'neu').join() === 'a: 1 (4)' && meldungen(rueck, 'rueckfall').join() === 'a: 1 (2)', [meldungen(zweit, 'neu'), meldungen(rueck, 'rueckfall')])
pruefe('Wache: Cover bleibt draußen', meldungen(cover, 'neu').length === 0, meldungen(cover, 'neu'))
pruefe('Warnzeilen: je Ereignis eine Zeile mit Präfix', JSON.stringify(maengelWarnZeilen(rueck)) === '["MAENGEL_RUECKFALL a: 1 (2)"]' && JSON.stringify(maengelWarnZeilen(zweit)) === '["MAENGEL_NEU a: 1 (4)"]', [maengelWarnZeilen(rueck), maengelWarnZeilen(zweit)])
pruefe('Warnzeilen: ohne Register oder ohne Ereignis keine', maengelWarnZeilen(null).length === 0 && maengelWarnZeilen(dritt).length === 0 && maengelWarnZeilen(cover).length === 0)
pruefe('Warnzeilen: der Hinweis des Baus kommt als eigene Zeile', maengelWarnZeilen({ ...dritt, hinweis: 'Vorfassung kaputt' }).join() === `${MAENGEL_VORFASSUNG_ZEILE}Vorfassung kaputt`, maengelWarnZeilen({ ...dritt, hinweis: 'x' }))
const messwerte = { mitStreamingWeg: 100, erstausgabeOhneWeg: 5 }
pruefe('`warnZeilen` reicht die Mängel durch, zuletzt, ohne Register wie bisher', warnZeilen(messwerte, messwerte, zweit).join() === 'MAENGEL_NEU a: 1 (4)' && warnZeilen(messwerte, messwerte).length === 0, warnZeilen(messwerte, messwerte, zweit))
pruefe('`warnZeilen`: Streaming-Rückgang bleibt vor den Mängeln', warnZeilen({ mitStreamingWeg: 50, erstausgabeOhneWeg: 5 }, messwerte, zweit).map((z) => z.split(' ')[0]).join() === 'STREAMING_RUECKGANG,MAENGEL_NEU')
const viele = fort(erst1, [1, 2, 3, 4, 5].map((t) => T(t, 'b')), '2026-11-02')
pruefe('Wache: mehr als drei Beispiele enden auf „…“', meldungen(viele, 'neu').join() === 'b: 5 (1, 2, 3, …)', meldungen(viele, 'neu'))

if (verletzt) {
  console.error(`${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log('Mängel-Register (Fortschreibung): alle Prüfungen bestanden')
