import { mockup } from '../register.ts'

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
  faelle: ['hajime-no-ippo', 'hajime-no-ippo-jahr', 'tokyo-revengers-jahr', 'tokyo-revengers', 'one-piece', 'attack-on-titan', 'attack-on-titan-zusammen', 'hajime-no-ippo-zusammen'],
  suchadressen: {
    'hajime-no-ippo': { q: IPPO },
    'hajime-no-ippo-jahr': { q: IPPO, y: '2003' },
    'tokyo-revengers-jahr': { q: 'Tokyo Revengers', y: '2019' },
    'tokyo-revengers': { q: 'Tokyo Revengers' },
    'one-piece': { q: 'One Piece' },
    'attack-on-titan': { q: 'Attack on Titan' },
    'attack-on-titan-zusammen': { q: 'Attack on Titan', staffeln: '1' },
    'hajime-no-ippo-zusammen': { q: IPPO, staffeln: '1' },
  },
  varianten: {
    A: {
      ersatz: {},
      notiz: 'Gebaut (27.10.2026): die Zeile gehört jetzt zur echten Datenbank, dieses Mockup zeigt sie nur noch an den sechs Fällen. Hinweis in derselben Zeile wie „0 Ergebnisse für …“, getrennt durch „·“; mit „Staffeln zusammenfassen“ zählt er neue Karten, nicht Titel.',
    },
  },
})
