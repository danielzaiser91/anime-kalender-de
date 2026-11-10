import { mockup } from '../register.ts'
import { LiveBreit, LiveKurz, PilleKnoepfeDrin, PilleZeileDarunter, ZeileMitSender } from './tv-knoepfe-teile.tsx'

/*
  TV-Zeile im Detail-Panel (Daniel, 10.11.2026): Live, Programm und Kalender sitzen in einer Spalte neben der Sender-Chip und
  nehmen ihr Platz; der Live-Knopf ist nur ein Dreieck und nennt den Sender nicht. Hier steht die Chip über die ganze Breite,
  der Live-Knopf trägt den Sender. „Vorher“ ist die Seite.
*/
mockup({
  name: 'tv-knoepfe',
  titel: 'TV-Zeile – Knöpfe aus der Spalte, Live-Knopf beschriftet',
  ausschnitt: 'detailpanel',
  faelle: ['yaiba-joyn'],
  varianten: {
    A: {
      ersatz: { TerminZeile: ZeileMitSender, Pille: PilleZeileDarunter, LiveLink: LiveKurz },
      notiz: 'Chip über die ganze Breite, darunter eine Knopfzeile: „▶ ProSieben MAXX live“ (Anbieter Joyn im Hinweis), Programm, Kalender.',
    },
    B: {
      ersatz: { TerminZeile: ZeileMitSender, Pille: PilleKnoepfeDrin, LiveLink: LiveKurz },
      notiz: 'Wie A, aber die Knöpfe sitzen als Fußzeile in derselben Fläche: Chip und Knöpfe lesen sich als eine Einheit.',
    },
    C: {
      ersatz: { TerminZeile: ZeileMitSender, Pille: PilleZeileDarunter, LiveLink: LiveBreit },
      notiz: 'Chip über die ganze Breite, darunter ein breiter Live-Knopf in zwei Zeilen („ProSieben MAXX live“ / „auf Joyn“), rechts daneben Programm und Kalender.',
    },
  },
})
