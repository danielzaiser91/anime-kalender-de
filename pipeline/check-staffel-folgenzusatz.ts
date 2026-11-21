/**
 * Zusicherung: **Zwei Einträge mit derselben Staffelbezeichnung bekommen einen Folgenzusatz** (Pokémon 17115/17873, beide „Staffel 16“;
 * Entscheidung Dirigent 21.11.2026). `folgenZusatz` (shared/staffel-folgenzusatz.ts) und die echte Reihe aus `public/data/franchises.json`
 * über `folgenBereiche`/`staffelStaende`. Läuft in `check:logic`.
 */
import { readFileSync } from 'node:fs'
import { hauptstaffeln, staffelStaende } from '../shared/titles.ts'
import { folgenZusatz, type FolgenTeil } from '../shared/staffel-folgenzusatz.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const nr = (staffel: number, bis?: number, teil?: number) => ({ staffel, bis, teil })
const text = (m: Map<number, { text: string; anzahl: boolean }>, id: number) => m.get(id)?.text
const t = (id: number, episodes: number | undefined, jahr: number, staffelQuelle: number | undefined = 3, staffelBis?: number): FolgenTeil => ({
  id,
  episodes,
  jpYear: jahr,
  jpStart: `${jahr}-01-01`,
  staffelQuelle,
  staffelBis,
})

/* Zwei gleiche Bezeichnungen, Folgenzahlen belegt: der Bereich zählt fortlaufend, nach Start geordnet (Eingabe absichtlich vertauscht). */
{
  const teile = [t(902, 20, 2013), t(901, 14, 2012), t(900, 9, 2010, 2)]
  const z = folgenZusatz(teile, new Map([[900, nr(2)], [901, nr(3)], [902, nr(3)]]))
  pruefe('zwei gleiche: erster', text(z, 901) === 'Folge 1–14', String(text(z, 901)))
  pruefe('zwei gleiche: zweiter', text(z, 902) === 'Folge 15–34', String(text(z, 902)))
  pruefe('zwei gleiche: Bereich, keine Anzahl', z.get(902)?.anzahl === false)
  pruefe('einzelne Bezeichnung bleibt ohne Zusatz', !z.has(900))
}
/* Drei Teile. */
{
  const teile = [t(911, 10, 2010), t(912, 12, 2011), t(913, 1, 2012)]
  const z = folgenZusatz(teile, new Map(teile.map((m) => [m.id, nr(3)])))
  pruefe('drei Teile', [911, 912, 913].map((id) => text(z, id)).join('|') === 'Folge 1–10|Folge 11–22|Folge 23', [911, 912, 913].map((id) => text(z, id)).join('|'))
}
/* Fehlt eine Folgenzahl, gibt es für die Gruppe keinen Zusatz. */
{
  const teile = [t(921, 10, 2010), t(922, undefined, 2011)]
  pruefe('ohne Folgenzahl: kein Zusatz', folgenZusatz(teile, new Map(teile.map((m) => [m.id, nr(3)]))).size === 0)
  const null0 = [t(923, 10, 2010), t(924, 0, 2011)]
  pruefe('Folgenzahl 0: kein Zusatz', folgenZusatz(null0, new Map(null0.map((m) => [m.id, nr(3)]))).size === 0)
}
/* Keine Doppelung (Staffel, Spanne und Teil unterscheiden). */
{
  const teile = [t(931, 10, 2010), t(932, 10, 2011), t(933, 10, 2012)]
  const z = folgenZusatz(teile, new Map([[931, nr(3)], [932, nr(3, 4)], [933, nr(3, undefined, 2)]]))
  pruefe('keine Doppelung: unverändert', z.size === 0)
}
/* Gleiche Zählung ohne gemeinsame belegte Quelle sind zwei Serien (Berserk 1997/2016): nichts erfinden. */
{
  const a = [t(941, 12, 2016, undefined), t(942, 12, 2017, 2)]
  pruefe('ohne Quelle: kein Zusatz', folgenZusatz(a, new Map(a.map((m) => [m.id, nr(2)]))).size === 0)
  const b = [t(943, 12, 2016, 2), t(944, 12, 2017, 4)]
  pruefe('verschiedene Quellen: kein Zusatz', folgenZusatz(b, new Map(b.map((m) => [m.id, nr(2)]))).size === 0)
}
/* Reicht ein früherer Eintrag in die Staffel hinein, ist die Startfolge unbekannt: nur die Anzahl (Pokémon 14093 mit Staffel 15–16). */
{
  const teile = [t(951, 24, 2012, 15, 16), t(952, 14, 2013, 16), t(953, 20, 2013, 16)]
  const z = folgenZusatz(teile, new Map([[951, nr(15, 16)], [952, nr(16)], [953, nr(16)]]))
  pruefe('Überhang: Anzahl', text(z, 952) === '14 Folgen' && text(z, 953) === '20 Folgen' && z.get(952)?.anzahl === true, String(text(z, 952)))
  pruefe('Überhang: der Eintrag mit anderer Bezeichnung bleibt ohne Zusatz', !z.has(951))
}
/* Beginnt der Überhang schon in derselben Staffel (Quelle gleich, Spanne länger), ist die Startfolge ebenso unbekannt. */
{
  const teile = [t(961, 24, 2012, 3, 4), t(962, 14, 2013, 3), t(963, 20, 2014, 3)]
  const z = folgenZusatz(teile, new Map([[961, nr(3, 4)], [962, nr(3)], [963, nr(3)]]))
  pruefe('gleiche Quelle mit Spanne: Anzahl', text(z, 962) === '14 Folgen' && text(z, 963) === '20 Folgen', String(text(z, 962)))
}
/* Gleicher Start: die kleinere Kennung zuerst (Eingabe vertauscht). */
{
  const teile = [t(972, 5, 2013), t(971, 7, 2013)]
  const z = folgenZusatz(teile, new Map(teile.map((m) => [m.id, nr(3)])))
  pruefe('gleicher Start: Kennung entscheidet', text(z, 971) === 'Folge 1–7' && text(z, 972) === 'Folge 8–12', `${text(z, 971)} ${text(z, 972)}`)
}

/* Echte Reihe: Pokémon aus franchises.json — beide Staffel-16-Einträge werden getrennt, sonst nichts in der Reihe. */
{
  const reihen = JSON.parse(readFileSync(new URL('../public/data/franchises.json', import.meta.url), 'utf8')) as Record<string, (FolgenTeil & { name: string; format?: string })[]>
  const reihe = reihen['527']
  pruefe('Pokémon-Reihe geladen', Array.isArray(reihe) && reihe.some((m) => m.id === 17873))
  if (reihe) {
    const haupt = hauptstaffeln(reihe)
    const z = folgenZusatz(haupt, staffelStaende(haupt, 'Pokémon'))
    pruefe('Pokémon 17115: 14 Folgen', text(z, 17115) === '14 Folgen', String(text(z, 17115)))
    pruefe('Pokémon 17873: 20 Folgen', text(z, 17873) === '20 Folgen', String(text(z, 17873)))
    pruefe('Pokémon: nur diese beiden', z.size === 2, String(z.size))
  }
}

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-staffel-folgenzusatz: ok')
