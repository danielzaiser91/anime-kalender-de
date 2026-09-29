/**
 * Prüft an **einer** AniList-Seite, ob `katalogSeite` die MAL-Kennung mitliefert (29.09.2026).
 * Ein Abruf, kein Lauf: Es geht nur um die Frage, ob `mal` überhaupt im Ergebnis steht.
 */
import { katalogSeite } from '../pipeline/lib/anilist.ts'

const ergebnis = await katalogSeite(1, undefined, undefined, true)
console.log(`Einträge: ${ergebnis.eintraege.length}`)
console.log(`mit mal: ${ergebnis.eintraege.filter((e) => e.mal).length}`)
console.log(`erster Eintrag: ${JSON.stringify(ergebnis.eintraege[0])}`)
