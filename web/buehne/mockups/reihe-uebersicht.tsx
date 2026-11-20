import { mockup } from '../register.ts'
import { spurMit } from './reihe-uebersicht-spur.tsx'
import { uebersichtMit } from './reihe-uebersicht-teile.tsx'

/**
 * „Reihe neu gedacht“ (20.11.2026, Bericht reihe-neu-gedacht-2026-11-20.md, Abschnitt 4): Vorher = echte Reihenliste,
 * A = Übersicht für große Reihen (Empfehlung), B = Untergrenze U (Spur mit Zahl am Kopf, bei 12 gekappt, Karte „Alle n“).
 * A1 bis A4 sind feste Anfangszustände von A, weil die Bühne keine eigenen Schalter im Mockup kennt.
 * Kleine Reihen (86, Tokyo Revengers, Attack on Titan, Gundam) zeigen in A die echte Spur.
 */
const SUCHE = 'der'

mockup({
  name: 'reihe-uebersicht',
  titel: 'Reihe neu gedacht – A: Übersicht, B: Spur mit Zahl',
  ausschnitt: 'detailpanel',
  faelle: [
    'pokemon-horizonte',
    'pokemon-film',
    'pokemon-concierge',
    'pokemon-sammeltitel',
    'detektiv-conan-film',
    'one-piece',
    'gundam-hathaway',
    '86',
    'tokyo-revengers',
    'attack-on-titan',
  ],
  varianten: {
    A: {
      ersatz: { ReihenListe: uebersichtMit({}) },
      notiz: 'Große Reihen: Gruppen mit Zahl, offen nur die des geöffneten Titels (Fenster von 5 und „Alle n zeigen“), Teile als Liste mit vollem Namen. Kleine Reihen bleiben die Spur.',
    },
    A1: {
      ersatz: { ReihenListe: uebersichtMit({ ohne: true }) },
      notiz: 'A mit eingeschaltetem „Teile ohne Synchro zeigen“: Zahlen und Listen wachsen, die Form bleibt.',
    },
    A2: {
      ersatz: { ReihenListe: uebersichtMit({ zweite: true }) },
      notiz: 'A mit einer zweiten, von Hand geöffneten Gruppe (Filme; steht der Titel in den Filmen, die erste andere): sie zeigt sofort alle Teile.',
    },
    A3: {
      ersatz: { ReihenListe: uebersichtMit({ suche: SUCHE }) },
      notiz: `A mit der Suche „${SUCHE}“ (trifft in jeder großen Reihe zwei Gruppen): alle Gruppen mit Treffern offen, die Zahl am Kopf ist die Trefferzahl.`,
    },
    A4: {
      ersatz: { ReihenListe: uebersichtMit({ alle: true }) },
      notiz: 'A nach „Alle n zeigen“: die Gruppe des geöffneten Titels zeigt alle Teile statt des Fensters.',
    },
    B: {
      ersatz: { ReihenListe: spurMit({}) },
      notiz: 'Untergrenze U: Zahl am Kopf jeder Spur, höchstens 12 Karten (bei einem Titel weiter hinten die 12 um ihn), als 13. Karte „Alle n“.',
    },
  },
})
