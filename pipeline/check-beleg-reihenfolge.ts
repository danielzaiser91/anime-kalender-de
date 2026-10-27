/**
 * Prüft die Reihenfolge der Beleg-Lesung (`warteschlange` in `pipeline/lib/beleg-lesung.ts`), damit ein neuer Termin
 * spätestens im nächsten Lauf sein Bild bekommt (Avatar: Die sieben Häfen, 13.10.2026: vier Anime2You-Artikel standen
 * auf Platz 253 bis 256 von 288, hinter 238 Neuaufnahmen alter Bilder, und blieben mit dem Limit 60 mehrere Tage ohne Bild).
 * Aufruf: npx tsx pipeline/check-beleg-reihenfolge.ts   (Exit 1 bei Verstoß)
 */
import { warteschlange, type BelegGedaechtnis } from './lib/beleg-lesung.ts'

let fehler = 0
const pruefe = (name: string, ok: boolean) => {
  if (!ok) { fehler++; console.error(`FEHL ${name}`) }
}

const HEUTE = '2026-10-14'
const LIMIT = 60
const a2y = (n: number) => `https://www.anime2you.de/news/${n}/x/`

/** Ein Artikel, dessen Bild noch in der alten Fassung (Fassung 1) vorliegt: wird einmal neu aufgenommen. */
const altesBild = (am: string): BelegGedaechtnis[string] => ({ zuletzt: am, lesungen: [{ am, hash: 'a', bild: 'a.webp', qs: 'ok' }] })

/* Rückstau wie am 13.10.2026: 238 Neuaufnahmen warten, vier Termin-Artikel wurden nie gelesen. */
const rueckstau: BelegGedaechtnis = {}
for (let i = 0; i < 238; i++) rueckstau[a2y(i)] = altesBild('2026-10-06')
const neu = [a2y(1059426), a2y(1059483), a2y(1048545), a2y(1034331)]
const schlange = warteschlange([...Object.keys(rueckstau), ...neu], rueckstau, HEUTE, 7, Infinity)
pruefe('nie gelesene Artikel stehen vor dem Rückstau (Platz 1 bis 4, vorher 239 bis 242)', neu.every((u) => schlange.indexOf(u) < neu.length))
pruefe('Änderung wird spätestens im nächsten Lauf sichtbar: alle vier liegen innerhalb des Limits', neu.every((u) => schlange.indexOf(u) < LIMIT))
pruefe('der Rückstau bleibt in der Schlange', schlange.length === 242)

/* Eine Lesung mit neuer Fassung und eine ältere in alter Fassung: der Artikel ist fertig und wartet bis zum Abstand. */
const jetzt = (am: string) => ({ am, hash: 'b', bild: 'b.webp', qs: 'ok' as const, bildfassung: 3 })
const verlauf: BelegGedaechtnis = {
  [a2y(1)]: { zuletzt: '2026-10-13', lesungen: [{ am: '2026-10-05', hash: 'a', bild: 'a.webp', qs: 'ok' }, jetzt('2026-10-13')] },
  [a2y(2)]: { zuletzt: '2026-10-13', lesungen: [{ am: '2026-10-05', hash: 'a', bild: 'a.webp', qs: 'ok' }] },
}
const fertig = warteschlange(Object.keys(verlauf), verlauf, HEUTE, 7, LIMIT)
pruefe('Lesung in neuer Fassung ersetzt die alte: nicht mehr fällig, bevor der Abstand um ist', !fertig.includes(a2y(1)))
pruefe('Lesung in alter Fassung bleibt fällig', fertig.includes(a2y(2)))

if (fehler) process.exit(1)
console.log('check-beleg-reihenfolge: ok')
