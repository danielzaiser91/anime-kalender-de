import { mockup } from '../register.ts'

/** Kachel eines Titels, dessen Synchro angekündigt ist, ohne deutsche Folge: Streifen „keine deutsche Synchro“ und Abzeichen „angekündigt“ zugleich (F71). */
mockup({
  name: 'synchro-angekuendigt-abzeichen',
  titel: 'Kachel: Synchro angekündigt',
  ausschnitt: 'datenbank',
  faelle: ['black-clover-s2'],
  suchadressen: { 'black-clover-s2': { q: 'Black Clover', ohne: '1' } },
  varianten: {
    A: { ersatz: {}, notiz: 'Gebaut: die echte Kachel der Datenbank; das Abzeichen sitzt oben links, der Streifen unten.' },
  },
})
