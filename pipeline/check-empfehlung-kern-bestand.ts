/**
 * Bestandsprüfung zum Rechenkern der Empfehlung an der echten `public/data/empfehlung.json`: Simulation mit künstlichen Nutzern
 * (Trefferquote nach 6 Duellen gegen den Wert aus Spezifikation 17.3), Restmenge, und Eigenschaften über viele Läufe: nie ein
 * Einstieg ohne Teil 1 im Duell, Verworfenes kommt nicht wieder, Zurück stellt den Vorzustand exakt her. Aufruf: `npm run check:bestand`.
 */
import { readFileSync } from 'node:fs'
import type { EmpfehlungsDatei } from '../shared/empfehlung-pool.ts'
import { antworteSitzung, DUELLE_START, naechstesPaar, neueSitzung, neuerZustand, vorschlaege, zurueck, type Antwort, type Sitzung } from '../shared/empfehlung-kern.ts'
import { baueKontext } from '../shared/empfehlung-vektor.ts'
import { brauchbareProfile, MIN_KERN, schwellenFehler, spiele } from './lib/empfehlung-simulation.ts'

const datei = JSON.parse(readFileSync(new URL('../public/data/empfehlung.json', import.meta.url), 'utf8')) as EmpfehlungsDatei
const k = baueKontext(datei)
const fehler: string[] = []
const LAEUFE = 60

/** Die Profile hängen an Schlagwortnamen; wird eines umbenannt oder selten, ist das ein Hinweis, kein Fehler des Kerns. Unter 3 Profilen misst die Wache nichts Belastbares. */
const { profile, uebersprungen } = brauchbareProfile(k)
for (const u of uebersprungen) console.warn(`  ! Profil ${u} hat weniger als ${MIN_KERN} Kerntitel und wird übersprungen (Schlagwort umbenannt?)`)
if (profile.length < 3) {
  console.error(`  ✖ nur ${profile.length} von 5 Profilen mit mindestens ${MIN_KERN} Kerntiteln: Simulation nicht belastbar, Profile in pipeline/lib/empfehlung-simulation.ts an die Schlagwörter anpassen`)
  console.log('VERSTÖSSE: 1')
  process.exit(1)
}

const quote = (duelle: number, neutral = 0.1): number => {
  let summe = 0
  let n = 0
  for (const profil of profile) {
    for (let s = 1; s <= LAEUFE; s++) {
      summe += spiele(k, profil, s, duelle, neutral).treffer / 5
      n++
    }
  }
  return summe / n
}

const q4 = quote(4)
const q6 = quote(DUELLE_START)
const q12 = quote(12)
const q6neutral = quote(DUELLE_START, 0.3)

/** Restmenge nach 2 / 4 / 6 gewerteten Duellen, Mittel über Profile und Läufe (Spezifikation 17.3 zählt gezeigte Duelle mit 10 % neutral: 236–249 / 69–79 / 22–26, hier alle gewertet, daher kleiner). */
const restNach = (duelle: number): number => {
  let summe = 0
  let n = 0
  for (const profil of profile) {
    for (let s = 1; s <= 20; s++, n++) summe += spiele(k, profil, s, duelle).zustand.rest.length
  }
  return summe / n
}
const rest = [2, 4, DUELLE_START].map(restNach)
fehler.push(...schwellenFehler({ q4, q6, q12, q6neutral, rest }))

const ohneTeil1 = new Set(datei.einstiege.map((e, i) => (e.duell ? -1 : i)).filter((i) => i >= 0))
let teil2 = 0
let verworfenWieder = 0
let zurueckFalsch = 0
let vorschlagsFehler = 0
const muster: Antwort[] = ['A', 'N', 'B', 'B', 'A', 'N', 'A', 'B']
for (let s = 1; s <= 200; s++) {
  let sitzung: Sitzung = neueSitzung(neuerZustand(k, s, [1, 2, 3]))
  const stand: string[] = []
  for (let i = 0; i < 10; i++) {
    const paar = naechstesPaar(k, sitzung.zustand)
    if (!paar) break
    stand.push(JSON.stringify(sitzung))
    if (paar.some((t) => ohneTeil1.has(t))) teil2++
    sitzung = antworteSitzung(k, sitzung, muster[(i + s) % muster.length])
  }
  for (let i = stand.length - 1; i >= 0; i--) {
    sitzung = zurueck(sitzung)
    if (JSON.stringify(sitzung) !== stand[i]) zurueckFalsch++
  }
  const v = neueSitzung(neuerZustand(k, s))
  const verworfen: number[] = []
  for (let i = 0; i < 12; i++) {
    const liste = vorschlaege(k, v.zustand, verworfen)
    verworfenWieder += liste.filter((x) => verworfen.includes(x.id)).length
    if (liste.length !== 5 || new Set(liste.map((x) => x.id)).size !== 5) vorschlagsFehler++
    verworfen.push(liste[i % liste.length].id)
  }
}
if (teil2) fehler.push(`${teil2} Duell-Titel ohne Teil 1 im Pool (duell fehlt)`)
if (verworfenWieder) fehler.push(`${verworfenWieder} verworfene Titel tauchen wieder auf`)
if (zurueckFalsch) fehler.push(`${zurueckFalsch} Mal stellt „Zurück“ nicht den Vorzustand her`)
if (vorschlagsFehler) fehler.push(`${vorschlagsFehler} Vorschlagslisten ohne fünf verschiedene Titel`)

for (const f of fehler) console.error(`  ✖ ${f}`)
if (fehler.length) {
  console.log(`VERSTÖSSE: ${fehler.length}`)
  process.exit(1)
}
console.log(
  `Empfehlung (Kern, Bestand): ${datei.einstiege.length} Einstiege, ${profile.length} Profile, Trefferquote ${(q4 * 100).toFixed(0)} / ${(q6 * 100).toFixed(0)} / ${(q12 * 100).toFixed(0)} % nach 4 / 6 / 12 Duellen ` +
    `(30 % unentschieden nach 6: ${(q6neutral * 100).toFixed(0)} %), Restmenge nach 2/4/6 Duellen ${rest.map((r) => r.toFixed(0)).join('/')}, ` +
    `200 Läufe ohne Teil-2-Duell, ohne wiederkehrendes Verworfenes, Zurück exakt`,
)
console.log('VERSTÖSSE: 0')
