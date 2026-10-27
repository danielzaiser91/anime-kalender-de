import { mockup } from '../register.ts'
import { DiscKarten, DiscListe, DiscRaster } from './disc-bereich-varianten.tsx'

/*
  Disc-Bereich im Detail-Panel (Daniel, 26.10.2026): Die Einzelausgaben öffneten sich als Block unter dem Kasten, getrennt von
  der Pille, und die Händlerzeilen wiederholten Format und Datum je Anbieter. Hier steht jede Ausgabe einmal — Format im
  Vordergrund, Datum daneben, Händler leise darunter —, direkt im Kasten unter dem Umschalter „Disc“. „Vorher“ ist die Seite.
*/
mockup({
  name: 'disc-bereich',
  titel: 'Disc-Bereich – A: Liste, B: Raster, C: Karten',
  ausschnitt: 'detailpanel',
  /* Die `-disc`-Fälle (`fall-optionen.ts`) öffnen das Panel auf „Disc“, sonst stünde der Umschalter auf „Stream“. */
  faelle: ['sakamoto-days-disc', 'dan-da-dan-disc', 'trigun-stampede-disc', 'chihiro-disc', '86-disc', 'fernsehtag-detektiv-conan-disc', 'one-piece-disc'],
  varianten: {
    A: {
      ersatz: { DiscBereich: DiscListe },
      notiz: 'Eine Zeile je Ausgabe: Formatmarken links, Name als Link zum Händler, Datum rechts („ab“ in Akzent, „seit“ leise). Kommendes steht als „Vorbestellbar“ über „Erhältlich“; ab sieben Ausgaben ein Knopf „Alle n Ausgaben“.',
    },
    B: {
      ersatz: { DiscBereich: DiscRaster },
      notiz: 'Raster Ausgabe × Format: Spalten Blu-ray/DVD/4K, die Zelle trägt das Datum und führt zum aniSearch-Artikel genau dieses Formats; „–“ wo es das Format nicht gibt. Jüngste Ausgabe oben, Kalenderknopf am Zeilenende.',
    },
    C: {
      ersatz: { DiscBereich: DiscKarten },
      notiz: 'Karten zu zweit nebeneinander, die Gesamtausgabe über die ganze Breite; Kommendes trägt einen Akzentring und steht zuerst. Format und Datum oben, Name als Link, Händler und Kalenderknopf unten.',
    },
  },
})
