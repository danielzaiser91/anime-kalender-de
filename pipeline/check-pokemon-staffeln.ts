/**
 * Zusicherung: **die Reihe Pokémon zählt die deutschen Staffeln** (Auftrag 20.11.2026: „Staffel 4 von 13“ statt Staffel 14 von 25).
 * Prüft `data/curated/pokemon-staffeln.yaml` (lückenlos, aufsteigend, je Staffel gegen die TMDB-Folgenzahl gehalten) und ihre Wirkung
 * auf `alleStaffelQuellen()`, `staffelStaende()` und die Detaildateien. Ohne die Datei zählte dieselbe Reihe 12 Staffeln
 * (AniList-Sammeltitel). Läuft in `check:logic`.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hauptstaffeln, staffelStaende } from '../shared/titles.ts'
import { ladeAlleEigenenWerke, markiereEigeneWerke } from './bau/cartoon-reihen.ts'
import { alleStaffelQuellen } from './bau/staffel-quelle.ts'
import { fehlerInGrenzen, ladeStaffelGrenzen, staffelFeld, staffelListen, startStaffeln } from './lib/pokemon-staffeln.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const grenzen = ladeStaffelGrenzen()
pruefe('Datei hat zwölf Titel', grenzen.length === 12, String(grenzen.length))
for (const t of grenzen) pruefe(`${t.anilistId}: Grenzen in Ordnung`, fehlerInGrenzen(t, undefined).length === 0, fehlerInGrenzen(t, undefined).join('; '))

/* Jede Staffel 1–25 kommt vor, und die Folgensumme je Staffel hält gegen die zweite Größe: die TMDB-Folgenzahl (`data/tmdb-folgen.json`).
   Eine Grenze, die um eine Folge verrutscht, macht zwei Staffeln falsch (A4). Abweichungen nur, wo aniSearch anders zählt (siehe yaml-Kopf). */
const tmdb = (JSON.parse(readFileSync('data/tmdb-folgen.json', 'utf8')) as Record<string, { folgen: { s: number }[] }>)['527']!.folgen
const tmdbJeStaffel = new Map<number, number>()
for (const f of tmdb) if (f.s >= 1) tmdbJeStaffel.set(f.s, (tmdbJeStaffel.get(f.s) ?? 0) + 1)
const jeStaffel = new Map<number, number>()
for (const t of grenzen) for (const s of t.staffeln) jeStaffel.set(s.nr, (jeStaffel.get(s.nr) ?? 0) + s.folgen)
const ABWEICHUNG: Record<number, number> = { 9: 1, 17: 1, 18: -1, 19: -2 }
for (let nr = 1; nr <= 25; nr++) {
  const erwartet = (tmdbJeStaffel.get(nr) ?? -1) + (ABWEICHUNG[nr] ?? 0)
  pruefe(`Staffel ${nr}: ${jeStaffel.get(nr)} Folgen, erwartet ${erwartet} (TMDB ${tmdbJeStaffel.get(nr)}${ABWEICHUNG[nr] ? `, Abweichung ${ABWEICHUNG[nr]}` : ''})`, jeStaffel.get(nr) === erwartet)
}
pruefe('Summe aller Folgen 1.234', [...jeStaffel.values()].reduce((a, b) => a + b, 0) === 1234)

const start = startStaffeln(grenzen)
pruefe('Startstaffeln der Sammeltitel', [527, 1564, 1565, 9107, 14093, 17115, 17873, 19291, 21356, 97634, 112153, 158870].map((id) => start.get(id)).join() === '1,6,10,14,15,16,16,17,19,20,23,25')
pruefe('Detaildatei-Liste: Titel 527 trägt fünf Staffeln', staffelListen(grenzen).get(527)?.length === 5)

/* Der Standardwert von `alleStaffelQuellen()` ist die echte Datei (A3): ohne Argumente kommen die Startstaffeln. */
const standard = alleStaffelQuellen()
pruefe('alleStaffelQuellen() ohne Argumente liefert die Startstaffeln der Datei', standard.get(9107) === 14 && standard.get(14093) === 15 && standard.get(112153) === 23, `${standard.get(9107)} ${standard.get(14093)} ${standard.get(112153)}`)

/* Der Bau schreibt `s` in die Detaildatei (A1): das Feld je Titel, und die Zeile im Schreiber steht genau einmal da. */
pruefe('staffelFeld: Titel der Datei trägt s, fremder Titel nicht', staffelFeld(staffelListen(grenzen), 527).s?.[0]?.join() === '1,1,82' && Object.keys(staffelFeld(staffelListen(grenzen), 1)).length === 0)
const schreiber = readFileSync(new URL('./bau/folgen-dateien.ts', import.meta.url), 'utf8')
pruefe('folgen-dateien.ts schreibt `s` über staffelFeld(staffeln, t.id) genau einmal', schreiber.split('...staffelFeld(staffeln, t.id)').length === 2)
pruefe('folgen-dateien.ts liest die Listen aus der Datei', schreiber.includes('staffelListen(ladeStaffelGrenzen())'))

/* Wirkung auf die Zählung: Glieder wie in `franchises.json`, einmal ohne, einmal mit den Grenzen. */
const reihe = [
  [527, 1997], [1564, 2002], [1565, 2006], [9107, 2010], [14093, 2012], [17115, 2013], [17873, 2013], [19291, 2013], [21356, 2015], [97634, 2016], [112153, 2019], [158870, 2023],
].map(([id, jahr]) => ({ id: id!, name: `Pokémon ${id}`, jpYear: jahr }))
const ohne = staffelStaende(reihe, 'Pokémon')
pruefe('Ohne Grenzen zählt die Reihe nur zwölf Staffeln (Zustand vorher)', [...ohne.values()][0]?.von === 12)
const quellen = alleStaffelQuellen([], grenzen)
const mit = staffelStaende(reihe.map((m) => ({ ...m, staffelQuelle: quellen.get(m.id) })), 'Pokémon')
const stand = (id: number) => mit.get(id)?.staffel
pruefe('Mit Grenzen: 25 Staffeln', [...mit.values()][0]?.von === 25, JSON.stringify([...mit.values()][0]))
pruefe('Mit Grenzen: Schwarz & Weiß beginnt bei Staffel 14', stand(9107) === 14, String(stand(9107)))
pruefe('Mit Grenzen: beide Einträge in Staffel 16 heißen 16 (kein belegtes 16A/16B)', stand(17115) === 16 && stand(17873) === 16 && mit.get(17873)?.teil === undefined, `${stand(17115)} ${stand(17873)}`)
pruefe('Mit Grenzen: Reisen beginnt bei Staffel 23', stand(112153) === 23, String(stand(112153)))

/* Horizonte (eigene deutsche Zählung) und die chinesische ONA ohne Synchro zählen nicht zur Hauptserie 1–25 (Dirigent, 20.11.2026). */
const mitAnhang = markiereEigeneWerke({
  527: [
    ...reihe.map((m) => ({ ...m, format: 'TV', staffelQuelle: quellen.get(m.id) })),
    { id: 158871, name: 'Pokémon Horizonte', format: 'TV', jpYear: 2023 },
    { id: 10019539, name: 'Baokemeng Donghua Tujian: Xiaoqi Dao Zhong', format: 'ONA', episodes: 10, jpYear: 2024 },
  ],
}, ladeAlleEigenenWerke().filter((e) => e.ids.some((id) => id === 158871 || id === 10019539)))[527]!
const standAnhang = staffelStaende(hauptstaffeln(mitAnhang), 'Pokémon')
pruefe('Hauptserie zählt „von 25“, Horizonte und ONA stehen nicht darin', [...standAnhang.values()][0]?.von === 25 && !standAnhang.has(158871) && !standAnhang.has(10019539), JSON.stringify([...standAnhang.values()][0]))
pruefe('Horizonte und ONA sind als eigene Werke markiert', mitAnhang.filter((m) => (m as { eigenesWerk?: boolean }).eigenesWerk).map((m) => m.id).join() === '158871,10019539')

/* Hand schlägt die Grenzen: ein Handeintrag überschreibt sie (Reihenfolge wie bei aniSearch). */
const hand = alleStaffelQuellen([{ anilistId: 14093, staffel: 99, quelle: 'https://x', belegtAm: '2026-11-20' }], grenzen)
pruefe('Handeintrag schlägt die Grenzen', hand.get(14093) === 99)

/* Fehlerfälle des Prüfers (A5). */
const gut = { anilistId: 1, staffeln: [{ nr: 1, von: 1, bis: 10, folgen: 10 }, { nr: 2, von: 11, bis: 20, folgen: 10 }] }
pruefe('Gültige Grenzen ohne Befund', fehlerInGrenzen(gut, 20).length === 0)
pruefe('Lücke zwischen den Staffeln', fehlerInGrenzen({ ...gut, staffeln: [gut.staffeln[0]!, { nr: 2, von: 12, bis: 20, folgen: 9 }] }, 20).length === 1)
pruefe('Folgenzahl des Titels weicht ab', fehlerInGrenzen(gut, 21).length === 1)
pruefe('Staffelnummer fällt', fehlerInGrenzen({ ...gut, staffeln: [gut.staffeln[1]!, { ...gut.staffeln[0]!, von: 21, bis: 30 }] }, undefined).length >= 1)
pruefe('Dieselbe Staffelnummer zweimal im Titel', fehlerInGrenzen({ ...gut, staffeln: [gut.staffeln[0]!, { ...gut.staffeln[0]!, von: 11, bis: 20 }] }, 20).length === 1)
pruefe('Falsche Folgenzahl je Abschnitt', fehlerInGrenzen({ ...gut, staffeln: [{ nr: 1, von: 1, bis: 10, folgen: 9 }] }, 10).length === 1)

/* Laden: ein Titel ohne Staffeln fällt weg, eine fehlende Datei ergibt eine leere Liste. */
const ordner = mkdtempSync(join(tmpdir(), 'pokemon-staffeln-'))
const probe = join(ordner, 'probe.yaml')
writeFileSync(probe, 'titel:\n  - { anilistId: 1, staffeln: [] }\n  - { anilistId: 2, staffeln: [{ nr: 1, von: 1, bis: 3, folgen: 3 }] }\n  - { anilistId: 3 }\n')
pruefe('Titel ohne Staffeln fallen beim Laden weg', ladeStaffelGrenzen(probe).map((t) => t.anilistId).join() === '2')
pruefe('Fehlende Datei ergibt eine leere Liste', ladeStaffelGrenzen(join(ordner, 'gibt-es-nicht.yaml')).length === 0)

if (fehler) process.exit(1)
console.log('check-pokemon-staffeln: ok')
