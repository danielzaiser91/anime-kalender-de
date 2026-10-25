import { ALLE } from '../faelle.ts'
import { mockup } from '../register.ts'

/**
 * Systemschriften statt Manrope/Unbounded (25.10.2026, F59): spart 35 KB beim Start. Jede Variante setzt nur `--font-sans` und
 * `--font-display` über der echten App; die Aufnahmen zeigen die Windows-Schrift, Android (Poco) und iOS nennt die Notiz.
 */
function schrift(text: string, display: string, notiz: string) {
  return { ersatz: {}, stil: `:root { --font-sans: ${text}; --font-display: ${display}; }`, notiz }
}

const SYSTEM = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

const VARIANTEN = {
  A: schrift(SYSTEM, SYSTEM, 'System: Windows Segoe UI, Android Roboto (HyperOS: MiSans), iPhone SF Pro. Überall die Hausschrift des Geräts.'),
  B: schrift(SYSTEM, "Bahnschrift, 'DIN Alternate', 'Roboto Condensed', sans-serif-condensed, sans-serif", 'Überschriften im DIN-Stil: Windows Bahnschrift, iPhone DIN Alternate, Android Roboto Condensed. Text wie A.'),
  C: schrift("Seravek, 'Gill Sans Nova', Ubuntu, Calibri, 'DejaVu Sans', sans-serif", "Seravek, 'Gill Sans Nova', Ubuntu, Calibri, sans-serif", 'Humanistisch, weich: Windows Calibri, iPhone Seravek, Android Roboto.'),
  D: schrift("Avenir, Montserrat, Corbel, 'URW Gothic', sans-serif", "Avenir, Montserrat, Corbel, 'URW Gothic', sans-serif", 'Geometrisch: Windows Corbel, iPhone Avenir, Android Roboto.'),
  E: schrift(SYSTEM, "'Sitka Banner', Charter, 'Bitstream Charter', Cambria, 'Noto Serif', serif", 'Überschriften mit Serifen: Windows Sitka, iPhone Charter, Android Noto Serif. Text wie A.'),
}

// Freitag 09.10. 18:00: voller Simulcast-Tag, damit viele Titel im Bild stehen (der Standardtag der Fälle ist ein ruhiger Sonntag).
mockup({
  name: 'schriften',
  titel: 'Systemschrift statt Manrope/Unbounded – Woche',
  ausschnitt: 'ganz',
  faelle: [ALLE],
  zeiten: { 'Fr 09.10. 18:00': '2026-10-09T18:00:00+02:00', 'So 11.10. 12:00': '2026-10-11T12:00:00+02:00' },
  varianten: VARIANTEN,
})

mockup({
  name: 'schriften-kacheln',
  titel: 'Systemschrift statt Manrope/Unbounded – Datenbank',
  ausschnitt: 'kachel',
  faelle: [ALLE],
  varianten: VARIANTEN,
})
