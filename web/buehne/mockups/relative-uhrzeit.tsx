import type { ComponentProps } from 'react'
import type { TvKasten } from '../../src/components/kalender/TvKasten.tsx'
import { ALLE } from '../faelle.ts'
import { mockup } from '../register.ts'
import { ZeitMarkeJetzt } from './relative-uhrzeit-kachel.tsx'
import { TvKastenJetzt } from './relative-uhrzeit-tv.tsx'

const KastenA = (p: ComponentProps<typeof TvKasten>) => <TvKastenJetzt stil="A" {...p} />
const KastenB = (p: ComponentProps<typeof TvKasten>) => <TvKastenJetzt stil="B" {...p} />
const KastenC = (p: ComponentProps<typeof TvKasten>) => <TvKastenJetzt stil="C" {...p} />

/** Freitag, 16.10.2026 (MESZ): sechs Fernseh-Termine mit Programm, dazu Streaming mit fester, geschätzter und fehlender Uhrzeit. */
const TAG = '2026-10-16'
const zeit = (uhr: string) => `${TAG}T${uhr}:00+02:00`

mockup({
  name: 'relative-uhrzeit',
  titel: 'Relative Uhrzeit in der Woche – Fernseh-Kasten und Kacheln',
  ausschnitt: 'ganz',
  faelle: [ALLE],
  zeiten: {
    '13:30 vor dem ersten Termin': zeit('13:30'),
    '15:10 in 1–3 Std': zeit('15:10'),
    '16:20 gleich': zeit('16:20'),
    '17:42 mittendrin': zeit('17:42'),
    '18:55 Bündel läuft': zeit('18:55'),
    '21:00 alles vorbei': zeit('21:00'),
  },
  varianten: {
    A: {
      ersatz: { TvKasten: KastenA, ZeitMarke: ZeitMarkeJetzt },
      notiz: 'Jetzt-Linie im Fernseh-Kasten, rechts „● Läuft · bis …“ und „in … Min“ an der nächsten Zeile; Kacheln „seit 17:00“ und „in … Min“. Freitag, 16.10.',
    },
    B: {
      ersatz: { TvKasten: KastenB, ZeitMarke: ZeitMarkeJetzt },
      notiz: 'Keine Linie: eine Zeile unter „Im Fernsehen“ („● Läuft: …“, „Nächste in …“, „Heute nichts mehr“). Kacheln wie A.',
    },
    C: {
      ersatz: { TvKasten: KastenC, ZeitMarke: ZeitMarkeJetzt },
      notiz: 'Wie A, aber Linie, Punkt und „Läuft“ in Smaragd wie im Detail-Panel.',
    },
    D: {
      ersatz: {},
      notiz:
        'Gewählt am 13.10.2026 und in die Seite eingebaut (hier ohne Ersatz, die Zelle zeigt die Seite selbst). Farbe wie der gewählte Reiter „Kalender“ (Orange): keine dritte Spalte, „● Läuft“ unter der Uhrzeit (bei mehreren gleichzeitigen Sendungen an jeder Zeile), Folge in der Senderzeile, kein „bis …“. Die Linie „jetzt HH:MM“ steht nur, solange nichts läuft: vor der ersten Sendung (dann „erste Sendung in … Std … Min“ in der Kopfzeile), zwischen zwei Sendungen und nach der letzten („Heute nichts mehr“). Ist die erste Uhrzeit geschätzt oder fehlt sie, gibt es weder Linie davor noch „in … Min“ an einer späteren Zeile.',
    },
  },
})
