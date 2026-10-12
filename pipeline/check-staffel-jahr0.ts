/**
 * Zusicherung: Jahr 0 (aniSearch: Jahr unbekannt, meist eine noch nicht terminierte Fortsetzung) zählt in der Staffelzählung wie „noch offen"
 * und steht hinten, nicht vor der ersten Staffel (11.10.2026: Bookworm, Jujutsu Kaisen Kouhen, Ninja Kamui — 7 von 899 Reihen verschoben).
 * Dazu: Werbe-Einträge (PV, CM, Trailer) sind weder Reihenvertreter noch Staffel (12.10.2026: Jujutsu Kaisen, Houseki no Kuni, Violet Evergarden).
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-staffel-jahr0.ts`
 */
import { ausstrahlungsZeit, hauptstaffeln, istWerbeEintrag, jahrZumSortieren, nachAusstrahlung, nachJahrUndId, reihenVertreter, staffelStaende } from '../shared/titles.ts'
import { staffelNummern } from './lib/staffel-nummern.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nJahr 0 in der Staffelzählung:')
{
  pruefe('Jahr 0 und fehlendes Jahr sortieren hinter jedem echten Jahr, ein Starttag gilt vor dem Jahr', ausstrahlungsZeit({ jpYear: 0 }) === '9999' && ausstrahlungsZeit({}) === '9999' && ausstrahlungsZeit({ jpYear: 2020 }) === '2020' && ausstrahlungsZeit({ jpStart: '2019-10-03', jpYear: 0 }) === '2019-10-03')
  const reihe = [
    { id: 10022017, name: 'Reihe Fortsetzung', format: 'TV', jpYear: 0 },
    { id: 1, name: 'Reihe', format: 'TV', jpYear: 2019, jpStart: '2019-10-03' },
    { id: 2, name: 'Reihe 2nd Season', format: 'TV', jpYear: 2020, jpStart: '2020-04-05' },
  ]
  const staende = staffelStaende(reihe, 'Reihe')
  pruefe('Zeile mit Jahr 0 ist die letzte Staffel, nicht die erste', staende.get(1)?.staffel === 1 && staende.get(2)?.staffel === 2 && staende.get(10022017)?.staffel === 3, [...staende])
  const nummern = staffelNummern(reihe)
  pruefe('Meldungs-Staffelnummer: die Jahr-0-Zeile verdrängt Staffel 1 nicht', nummern.get(1) === 1 && nummern.get(2) === 2, [...nummern])
}

console.log('\nJahr 0 in jeder Reihenfolge einer Reihe (ein gemeinsamer Schlüssel):')
{
  /* Mehrere Jahr-0-Einträge und gemischte Jahre, absichtlich nicht in der Soll-Reihenfolge. */
  const mitglieder = [
    { id: 9, jpYear: 0, jpSeason: 'FALL' },
    { id: 4, jpYear: 2021 },
    { id: 7, jpYear: 0 },
    { id: 3 },
    { id: 8, jpYear: 2019 },
    { id: 5, jpYear: 2021, jpSeason: 'WINTER' },
  ] as Parameters<typeof nachAusstrahlung>[0][]
  const ids = (liste: { id: number }[]) => liste.map((m) => m.id)
  pruefe('jahrZumSortieren: 0 und fehlend hinter jedem echten Jahr', jahrZumSortieren(0) === 9999 && jahrZumSortieren(undefined) === 9999 && jahrZumSortieren(1998) === 1998)
  pruefe('nachJahrUndId: echte Jahre zuerst, dann Jahr 0 und fehlend nach Kennung', ids(mitglieder.slice().sort(nachJahrUndId)).join() === '8,4,5,3,7,9', ids(mitglieder.slice().sort(nachJahrUndId)))
  pruefe('nachAusstrahlung: echte Jahre nach Jahreszeit, danach Jahr 0 und fehlend (Jahreszeit, dann Kennung)', ids(mitglieder.slice().sort(nachAusstrahlung)).join() === '8,5,4,9,3,7', ids(mitglieder.slice().sort(nachAusstrahlung)))
  pruefe('Reihenvertreter ist die erste echte Staffel, nicht der Eintrag ohne Jahr', reihenVertreter(mitglieder.map((m) => ({ ...m, format: 'TV' })).sort(nachAusstrahlung)).id === 8)
}

console.log('\nWerbung (PV, CM, Trailer) ist weder Vertreter noch Staffel:')
{
  const jjk = [
    { id: 147463, name: 'Jujutsu Kaisen PV', format: 'ONA', jpYear: 2018 },
    { id: 113415, name: 'Jujutsu Kaisen', format: 'TV', jpYear: 2020 },
  ]
  pruefe('Vertreter ist die Serie, nicht der frühere PV (Jujutsu Kaisen)', reihenVertreter(jjk).id === 113415)
  pruefe('Reihe nur aus Werbung und Film: Vertreter ist der Film, nicht der PV', reihenVertreter([jjk[0]!, { id: 5, name: 'Reihe: Der Film', format: 'MOVIE', jpYear: 2021 }]).id === 5)
  pruefe('Reihe nur aus Werbung: Vertreter bleibt der früheste Eintrag', reihenVertreter([jjk[0]!]).id === 147463)
  pruefe('Reihe ohne Fernsehstaffel: ein PV-ONA ist keine Hauptstaffel', hauptstaffeln([jjk[0]!, { id: 9, name: 'Reihe', format: 'ONA', jpYear: 2021, episodes: 12 }]).map((m) => m.id).join() === '9')
  const werbung = ['Houseki no Kuni PV', 'Violet Evergarden CM', 'Fate/Grand Order 4th Anniversary Trailer', 'God Eater 3 Opening Movie', 'Rokujouma no Shinryakusha!? Promotion MOVIE', 'One Piece Volume 108 Promo']
  const kein = ['Jujutsu Kaisen', '5 Centimeters per Second', 'Byousoku 5 Centimeter (5 cm)', 'PVC Fighter']
  pruefe('Werbenamen aus den Daten werden erkannt', werbung.every((name) => istWerbeEintrag({ name })), werbung.filter((name) => !istWerbeEintrag({ name })))
  pruefe('Titel mit ähnlichen Wörtern (cm klein, PVC) sind keine Werbung', !kein.some((name) => istWerbeEintrag({ name })), kein.filter((name) => istWerbeEintrag({ name })))
  pruefe('Auch ein Titel mit englischem Namen genügt (Title-Form)', istWerbeEintrag({ titleEn: 'Anime XY PV' }) && !istWerbeEintrag({ titleEn: 'Anime XY' }))
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nOK')
