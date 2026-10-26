import { mockup } from '../register.ts'
import { KopfMitZeile, KopfOhneHinweis, KopfzeileMitHinweis } from './suchhinweis-teile.tsx'

const IPPO = 'Hajime no Ippo: The Fighting!'

/**
 * Adresse der Datenbank je Fall:
 * Hajime no Ippo: 0 Treffer mit Synchro, 6 ohne, einer davon gleicht dem Namen (der schwierige Fall); mit Jahr 2003 verbergen Jahr und Synchro ihn zugleich;
 * Tokyo Revengers mit Jahr 2019: der exakte Treffer hat Synchro, nur das Jahr versteckt ihn; ohne Jahr: Treffer mit Synchro, keiner ohne passt genau;
 * One Piece, Attack on Titan: lange Listen.
 */
mockup({
  name: 'suchhinweis-ohne-synchro',
  titel: 'Suche: Hinweis auf Treffer ohne deutsche Synchro',
  ausschnitt: 'datenbank',
  faelle: ['hajime-no-ippo', 'hajime-no-ippo-jahr', 'tokyo-revengers-jahr', 'tokyo-revengers', 'one-piece', 'attack-on-titan'],
  suchadressen: {
    'hajime-no-ippo': { q: IPPO },
    'hajime-no-ippo-jahr': { q: IPPO, y: '2003' },
    'tokyo-revengers-jahr': { q: 'Tokyo Revengers', y: '2019' },
    'tokyo-revengers': { q: 'Tokyo Revengers' },
    'one-piece': { q: 'One Piece' },
    'attack-on-titan': { q: 'Attack on Titan' },
  },
  varianten: {
    A: {
      ersatz: { DbKopfbereich: KopfOhneHinweis, DbKopfzeile: KopfzeileMitHinweis },
      notiz: 'Hinweis in derselben Zeile wie „0 Ergebnisse für …“: Treffer ohne Synchro, davon exakt; verstecken Filter den exakten Treffer, nennt die Zeile sie und der Knopf „Filter entfernen“ löst genau diese.',
    },
    B: {
      ersatz: { DbKopfbereich: KopfMitZeile },
      notiz: 'Derselbe Hinweis als eigene Zeile direkt unter der Zählzeile.',
    },
  },
})
