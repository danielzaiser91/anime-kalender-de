/**
 * Zusicherung: **die Reihe Pokémon zählt die deutschen Staffeln** (Auftrag 20.11.2026: „Staffel 4 von 13“ statt Staffel 14 von 25).
 * Prüft `data/curated/pokemon-staffeln.yaml` (lückenlos, aufsteigend, Summen) und ihre Wirkung auf `alleStaffelQuellen()` und
 * `staffelStaende()`. Ohne die Datei zählte dieselbe Reihe 12 Staffeln (AniList-Sammeltitel). Läuft in `check:logic`.
 */
import { hauptstaffeln, staffelStaende } from '../shared/titles.ts'
import { ladeAlleEigenenWerke, markiereEigeneWerke } from './bau/cartoon-reihen.ts'
import { alleStaffelQuellen } from './bau/staffel-quelle.ts'
import { fehlerInGrenzen, ladeStaffelGrenzen, markiereStaffelTeile, staffelListen, startStaffeln, startTeile } from './lib/pokemon-staffeln.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const grenzen = ladeStaffelGrenzen()
pruefe('Datei hat zwölf Titel', grenzen.length === 12, String(grenzen.length))
for (const t of grenzen) pruefe(`${t.anilistId}: Grenzen in Ordnung`, fehlerInGrenzen(t, undefined).length === 0, fehlerInGrenzen(t, undefined).join('; '))

/* Jede Staffel 1–25 kommt mindestens einmal vor, und die Folgensumme je Staffel liegt in der Nähe der TMDB-Zahl (Abweichung nur dort, wo aniSearch anders zählt). */
const jeStaffel = new Map<number, number>()
for (const t of grenzen) for (const s of t.staffeln) jeStaffel.set(s.nr, (jeStaffel.get(s.nr) ?? 0) + s.folgen)
for (let nr = 1; nr <= 25; nr++) pruefe(`Staffel ${nr} kommt vor`, jeStaffel.has(nr))
pruefe('Summe aller Folgen 1.234', [...jeStaffel.values()].reduce((a, b) => a + b, 0) === 1234)
pruefe('Staffel 9 trägt die Doppelfolge: 47 statt 46 (TMDB)', jeStaffel.get(9) === 47)
pruefe('Staffel 17: 49 statt 48, Staffel 18: 44 statt 45 (TMDB)', jeStaffel.get(17) === 49 && jeStaffel.get(18) === 44)

const start = startStaffeln(grenzen)
pruefe('Startstaffeln der Sammeltitel', [527, 1564, 1565, 9107, 14093, 17115, 17873, 19291, 21356, 97634, 112153, 158870].map((id) => start.get(id)).join() === '1,6,10,14,15,16,16,17,19,20,23,25')
pruefe('Detaildatei-Liste: Titel 527 trägt fünf Staffeln', staffelListen(grenzen).get(527)?.length === 5)

/* Wirkung auf die Zählung: Glieder wie in `franchises.json`, einmal ohne, einmal mit den Grenzen. */
const reihe = [
  [527, 1997], [1564, 2002], [1565, 2006], [9107, 2010], [14093, 2012], [17115, 2013], [17873, 2013], [19291, 2013], [21356, 2015], [97634, 2016], [112153, 2019], [158870, 2023],
].map(([id, jahr]) => ({ id: id!, name: `Pokémon ${id}`, jpYear: jahr }))
const ohne = staffelStaende(reihe, 'Pokémon')
pruefe('Ohne Grenzen zählt die Reihe nur zwölf Staffeln (Zustand vorher)', [...ohne.values()][0]?.von === 12)
const quellen = alleStaffelQuellen([], grenzen)
const teile = startTeile(grenzen)
const mit = staffelStaende(reihe.map((m) => ({ ...m, staffelQuelle: quellen.get(m.id), staffelTeil: teile.get(m.id) })), 'Pokémon')
const stand = (id: number) => `${mit.get(id)?.staffel}${mit.get(id)?.teil ? `.${mit.get(id)!.teil}` : ''}`
pruefe('Mit Grenzen: 25 Staffeln', [...mit.values()][0]?.von === 25, JSON.stringify([...mit.values()][0]))
pruefe('Mit Grenzen: Schwarz & Weiß beginnt bei Staffel 14', stand(9107) === '14', stand(9107))
pruefe('Mit Grenzen: zwei Einträge in Staffel 16 sind Teil 1 und Teil 2', stand(17115) === '16.1' && stand(17873) === '16.2', `${stand(17115)} ${stand(17873)}`)
pruefe('Mit Grenzen: Reisen beginnt bei Staffel 23', stand(112153) === '23', stand(112153))

/* Horizonte (eigene deutsche Zählung) und die chinesische ONA ohne Synchro zählen nicht zur Hauptserie 1–25 (Dirigent, 20.11.2026). */
const mitAnhang = markiereEigeneWerke({
  527: [
    ...reihe.map((m) => ({ ...m, format: 'TV', staffelQuelle: quellen.get(m.id), staffelTeil: teile.get(m.id) })),
    { id: 158871, name: 'Pokémon Horizonte', format: 'TV', jpYear: 2023 },
    { id: 10019539, name: 'Baokemeng Donghua Tujian: Xiaoqi Dao Zhong', format: 'ONA', episodes: 10, jpYear: 2024 },
  ],
}, ladeAlleEigenenWerke().filter((e) => e.ids.some((id) => id === 158871 || id === 10019539)))[527]!
const haupt = hauptstaffeln(mitAnhang)
const standAnhang = staffelStaende(haupt, 'Pokémon')
pruefe('Hauptserie zählt „von 25“, Horizonte und ONA stehen nicht darin', [...standAnhang.values()][0]?.von === 25 && !standAnhang.has(158871) && !standAnhang.has(10019539), JSON.stringify([...standAnhang.values()][0]))
pruefe('Horizonte und ONA sind als eigene Werke markiert', mitAnhang.filter((m) => (m as { eigenesWerk?: boolean }).eigenesWerk).map((m) => m.id).join() === '158871,10019539')

/* Der Bau schreibt `staffelTeil` nur an die Titel mit `teil` in der Datei. */
const markiert = markiereStaffelTeile({ 527: reihe.map((m): { id: number; staffelTeil?: number } => ({ id: m.id })) }, grenzen)[527]!
pruefe('staffelTeil nur an 17115 (1) und 17873 (2)', markiert.filter((m) => m.staffelTeil).map((m) => `${m.id}:${m.staffelTeil}`).join() === '17115:1,17873:2')

/* Hand schlägt die Grenzen nicht ab: ein Handeintrag überschreibt sie (Reihenfolge wie bei aniSearch). */
const hand = alleStaffelQuellen([{ anilistId: 14093, staffel: 99, quelle: 'https://x', belegtAm: '2026-11-20' }], grenzen)
pruefe('Handeintrag schlägt die Grenzen', hand.get(14093) === 99)

/* Kein Nebeneffekt: Zwei Einträge mit derselben belegten Staffelnummer ohne `staffelTeil` bleiben doppelt; der Wächter `doppelteNummern` (check-remake-zaehlung) braucht das. */
const fremd = staffelStaende(
  [
    { id: 1, name: 'Reihe', jpYear: 2019, staffelQuelle: 2 },
    { id: 2, name: 'Reihe: Anderes', jpYear: 2021, staffelQuelle: 2 },
  ],
  'Reihe',
)
pruefe('Ohne staffelTeil kein Teil', fremd.get(2)?.staffel === 2 && fremd.get(2)?.teil === undefined, JSON.stringify([...fremd]))

/* Fehlerfälle des Prüfers. */
const gut = { anilistId: 1, staffeln: [{ nr: 1, von: 1, bis: 10, folgen: 10 }, { nr: 2, von: 11, bis: 20, folgen: 10 }] }
pruefe('Gültige Grenzen ohne Befund', fehlerInGrenzen(gut, 20).length === 0)
pruefe('Lücke zwischen den Staffeln', fehlerInGrenzen({ ...gut, staffeln: [gut.staffeln[0]!, { nr: 2, von: 12, bis: 20, folgen: 9 }] }, 20).length === 1)
pruefe('Folgenzahl des Titels weicht ab', fehlerInGrenzen(gut, 21).length === 1)
pruefe('Staffelnummer fällt', fehlerInGrenzen({ ...gut, staffeln: [gut.staffeln[1]!, { ...gut.staffeln[0]!, von: 21, bis: 30 }] }, undefined).length >= 1)
pruefe('Falsche Folgenzahl je Abschnitt', fehlerInGrenzen({ ...gut, staffeln: [{ nr: 1, von: 1, bis: 10, folgen: 9 }] }, 10).length === 1)

if (fehler) process.exit(1)
console.log('check-pokemon-staffeln: ok')
