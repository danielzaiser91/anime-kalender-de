/**
 * Zusicherung: Dasselbe Werk als aniSearch-Zeile und AniList-Titel wird auch ohne gemeinsame MAL erkannt (10.10.2026, „Yomi no Tsugai Dai 2 Ki" neben „Yomi no Tsugai 2nd Season"),
 * aber nur mit Beleg von aniSearch (Synonym, Prequel/Sequel) zusammengeführt; der bloße Name bleibt auf der Prüfliste. Regel und Grenzen: `bau/werk-doppelt.ts`.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-werk-doppelt.ts`
 */
import { staffelNummern, findeWerkDubletten, type WerkEintrag, type WerkTitel } from './bau/werk-doppelt.ts'
import { werkDublettenAbziehen, werkDoppelt } from './bau/werk-doppelt-bau.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const BASIS = 10_000_000

console.log('\nStaffelzählung aus dem Namen:')
{
  const nummern = (...namen: string[]) => [...staffelNummern(namen)].sort().join()
  pruefe('„2nd Season", „Staffel 2", „Dai 2 Ki", „第2期", „Season 2" zählen 2', ['Yomi 2nd Season', 'Das Band: Staffel 2', 'Yomi no Tsugai: Dai 2 Ki', '黄泉のツガイ 第2期', 'Thunder 3: Season 2'].every((n) => nummern(n) === '2'))
  pruefe('eine angehängte Ziffer zählt, auch hinter CJK („…父子2")', nummern('Happy Father, Happy Son 2') === '2' && nummern('快乐父子2') === '2')
  pruefe('römisch am Ende („…Naru III") zählt 3', nummern('Katainaka no Ossan, Kensei ni Naru III') === '3')
  pruefe('ein Jahr in Klammern oder „00" zählt nicht', nummern('Chibi Godzilla (2026)') === '' && nummern('Gundam 00') === '')
  pruefe('mehrere Namen können verschiedene Nummern nennen', nummern('Nian Fan 2', 'Too Steady 4th Season') === '2,4')
}

console.log('\nDasselbe Werk ohne MAL:')
{
  const katalog = (id: number, felder: Partial<WerkTitel>): WerkTitel => ({ id, format: 'TV', ...felder })
  const reihe1 = katalog(195600, { titleRomaji: 'Yomi no Tsugai', titleEn: 'Daemons of the Shadow Realm', titleDe: 'Das Band der Unterwelt', titleNative: '黄泉のツガイ', anisearchId: 20717, jpYear: 2026 })
  const staffel2 = katalog(217013, { titleRomaji: 'Yomi no Tsugai 2nd Season', titleNative: '黄泉のツガイ 第2期', franchiseId: 195600, malId: 65024 })
  const zeile = BASIS + 21973
  const zeileTitel = katalog(zeile, { titleRomaji: 'Yomi no Tsugai: Dai 2 Ki', titleNative: '黄泉のツガイ 第2期', franchiseId: 195600, episodes: 12 })
  const e = (felder: Partial<WerkEintrag>): WerkEintrag => ({ t: 'Yomi no Tsugai: Dai 2 Ki', n: '黄泉のツガイ 第2期', ty: 'TV-Serie', y: 0, f: 12, dub: '-', ...felder })
  const titel = [reihe1, staffel2, zeileTitel]
  const urteil = (eintrag: WerkEintrag, alle: WerkTitel[] = titel) => findeWerkDubletten(alle, { '21973': eintrag }, new Set(alle.filter((t) => t.id < BASIS).map((t) => t.id)))

  const ueberBeziehung = urteil(e({ rel: { '20717': 'Prequel' } }))
  pruefe('Prequel in der Reihe und gleiche Staffelnummer: sicher', ueberBeziehung.sicher.length === 1 && ueberBeziehung.sicher[0]!.titel === 217013 && ueberBeziehung.sicher[0]!.grund === 'beziehung', ueberBeziehung)
  const ueberSynonym = urteil(e({ syn: ['Das Band der Unterwelt: Staffel 2'] }))
  pruefe('Synonym „Reihenname: Staffel 2" und Staffel 2 des Titels: sicher', ueberSynonym.sicher.length === 1 && ueberSynonym.sicher[0]!.grund === 'synonym', ueberSynonym)
  const nurName = urteil(e({}))
  pruefe('nur der gleiche Name (Native): wahrscheinlich, nichts wird versteckt', nurName.sicher.length === 0 && nurName.wahrscheinlich.length === 1 && nurName.wahrscheinlich[0]!.grund === 'name', nurName)
  pruefe('ein Synonym „Staffel 3" widerspricht der Staffel 2 des Titels', urteil(e({ syn: ['Das Band der Unterwelt: Staffel 3'] })).sicher.length === 0)
  pruefe('Zeile mit Deutsch (Handdatei) bleibt außen vor', urteil(e({ dub: 'd', rel: { '20717': 'Prequel' } })).sicher.length === 0)
  pruefe('anderes Format (Film gegen Serie) ist kein Paar', urteil(e({ ty: 'Film', rel: { '20717': 'Prequel' } })).sicher.length === 0)
  pruefe('Jahr zwei daneben ist kein Paar', urteil(e({ y: 2024, rel: { '20717': 'Prequel' } }), [reihe1, { ...staffel2, jpYear: 2027 }, zeileTitel]).sicher.length === 0)
  pruefe('Folgenzahl abweichend ist kein Paar', urteil(e({ f: 24, rel: { '20717': 'Prequel' } }), [reihe1, { ...staffel2, episodes: 12 }, zeileTitel]).sicher.length === 0)
  pruefe('trägt der Titel schon eine andere aniSearch-Kennung, ist es nicht dasselbe Werk', urteil(e({ rel: { '20717': 'Prequel' } }), [reihe1, { ...staffel2, anisearchId: 99 }, zeileTitel]).sicher.length === 0)
  const zwei = [reihe1, staffel2, { ...staffel2, id: 217014, titleRomaji: 'Yomi no Tsugai 2nd Season Part 2' }, zeileTitel]
  pruefe('zwei Titel passen zur Zeile: mehrdeutig, nichts wird zusammengeführt', urteil(e({ rel: { '20717': 'Prequel' } }), zwei).sicher.length === 0)
  pruefe('Staffelzählung widerspricht (Native …父子 gegen …父子2): nie ein Paar', findeWerkDubletten(
    [katalog(129474, { titleNative: '快乐父子', titleEn: 'Happy Father, Happy Son' }), katalog(BASIS + 5, { titleNative: '快乐父子2', titleEn: 'Happy Father, Happy Son' })],
    { '5': { t: 'X', n: '快乐父子2', en: 'Happy Father, Happy Son', ty: 'TV-Serie', dub: '-' } }, new Set([129474]),
  ).sicher.length === 0)

  console.log('\nZusammenführen im Bau und Zusicherung an der Ausgabe:')
  const eintraege = { '21973': e({ rel: { '20717': 'Prequel' } }) }
  const ergebnis = werkDublettenAbziehen([staffel2, zeileTitel], [reihe1], new Set(), eintraege)
  pruefe('die Zeile entfällt, der Titel trägt ihre aniSearch-Kennung', ergebnis.titel.length === 1 && ergebnis.titel[0]!.id === 217013 && ergebnis.titel[0]!.anisearchId === 21973, ergebnis.titel)
  const imHaupt = werkDublettenAbziehen([staffel2], [reihe1, zeileTitel], new Set(), eintraege)
  pruefe('steht die Zeile im Hauptbestand, entfällt der Katalogtitel', imHaupt.titel.length === 0)
  const mitTermin = werkDublettenAbziehen([staffel2, zeileTitel], [reihe1], new Set([zeile]), eintraege)
  pruefe('trägt die Zeile einen Termin, entfällt ebenfalls der Katalogtitel', mitTermin.titel.length === 1 && mitTermin.titel[0]!.id === zeile)
  pruefe('bleibt ein sicheres Paar in der Ausgabe, wird die Zusicherung rot', werkDoppelt([reihe1], [staffel2, zeileTitel], eintraege).some((f) => f.includes('sicher dasselbe Werk')))
  pruefe('nach dem Zusammenführen ist die Ausgabe in Ordnung', werkDoppelt([reihe1], ergebnis.titel, eintraege).length === 0)
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\ncheck-werk-doppelt: alle Zusicherungen halten.')
