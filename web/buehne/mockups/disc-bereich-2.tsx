import { mockup } from '../register.ts'
import { KastenFolgenDarunter } from './disc-bereich-2-kasten.tsx'
import { DiscChips, DiscDropdown, DiscGruppen } from './disc-bereich-2-varianten.tsx'

/*
  Disc-Bereich, Runde 2 (Daniel, 27.10.2026): Aus Runde 1 hat er das Raster (B) gewählt. Jetzt zuerst eine klare Übersicht aller
  Varianten (Gesamtausgabe, Box, Vol. × Blu-ray, DVD, 4K), die Händler erst nach der Wahl; Volumes erst hinter einem Ausklapper,
  wo es Gesamtausgaben oder Boxen gibt; die Folgenliste unter dem Kasten; der Kalendereintrag als Knopf über die Zeilenbreite.
  Händlerlinks: Amazon nur als `/dp/<ASIN>`; die Daten kennen für diese Fälle keine ASIN (nur Suchadressen) — das Mockup zeigt
  den Link, wie er mit ASIN aussähe (Platzhalter `ASIN-FEHLT`). „Vorher“ ist die Seite.
*/
mockup({
  name: 'disc-bereich-2',
  titel: 'Disc-Bereich Runde 2 – B1: Dropdown, B2: Chips, B3: Gruppen',
  ausschnitt: 'detailpanel',
  faelle: ['sakamoto-days-disc', 'fernsehtag-detektiv-conan-disc', 'dan-da-dan-disc'],
  varianten: {
    B1: {
      ersatz: { DiscBereich: DiscDropdown, AntwortKasten: KastenFolgenDarunter },
      notiz: 'Dropdown „Version“ (Alle, nur Boxen, nur Blu-ray …) über der Matrix; ein Tipp auf die Zeile klappt Händler und Kalendereintrag direkt darunter auf. Volumes hinter dem Ausklapper, wo es Gesamtausgaben oder Boxen gibt.',
    },
    B2: {
      ersatz: { DiscBereich: DiscChips, AntwortKasten: KastenFolgenDarunter },
      notiz: 'Zwei Chip-Reihen (Format, Art) filtern die Matrix; die gewählte Variante steht mit Händler und Kalendereintrag in einer Karte, die am unteren Rand des Panels mitläuft.',
    },
    B3: {
      ersatz: { DiscBereich: DiscGruppen, AntwortKasten: KastenFolgenDarunter },
      notiz: 'Die Matrix nach Art gruppiert: Gesamtausgaben und Boxen offen, Volumes und Filme zugeklappt (Zahl und Jahre am Kopf); Händler klappen unter der Zeile auf.',
    },
  },
})
