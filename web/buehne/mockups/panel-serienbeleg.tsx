import { mockup } from '../register.ts'

/** Hamtaro: Synchro für die Serie belegt, keine Folge mit Flagge — der aufgeklappte Folgenbereich sagt es (Bild: Folgenliste aufklappen). */
mockup({
  name: 'panel-serienbeleg',
  titel: 'Folgenbereich: Serienbeleg ohne Folgenbeleg',
  ausschnitt: 'detailpanel',
  faelle: ['hamtaro'],
  varianten: {
    A: {
      ersatz: {},
      notiz: 'Gebaut: das echte Panel; der Satz steht über der Folgenliste, sobald sie aufgeklappt ist.',
    },
  },
})
