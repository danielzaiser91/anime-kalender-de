/**
 * `wegAusMeldung()` mit den echten Meldungen des Anlasses (Kopie vom 02.11.2026):
 * Higurashi Kai, Meldungen 25000 und 25061 — Staffel 1, gelesene Seite B09JTSD79F / B09JZHRQ18, Bestandsadresse der Staffel 4.
 * Golden Kamuy (Staffel 2 auf der Seite von Staffel 1) bleibt, wie es war.
 */
import { wegAusMeldung } from './lib/weg-aus-meldung.ts'

const AMAZON = 'https://www.amazon.de/gp/video/detail/'
const S4 = `${AMAZON}B0CBKJKYM4`
const faelle: Array<[string, { url: string; seiten_kennung: string | null; staffel: number | null }, string]> = [
  ['Higurashi Kai 25000 (Staffel 1, fremde Seite)', { url: S4, seiten_kennung: 'B09JTSD79F', staffel: 1 }, `${AMAZON}B09JTSD79F`],
  ['Higurashi Kai 25061 (Staffel 1, andere fremde Seite)', { url: S4, seiten_kennung: 'B09JZHRQ18', staffel: 1 }, `${AMAZON}B09JZHRQ18`],
  ['Staffel ohne Angabe, fremde Seite', { url: S4, seiten_kennung: 'B09JTSD79F', staffel: null }, `${AMAZON}B09JTSD79F`],
  ['Staffel 2 auf der Seite von Staffel 1 (Golden Kamuy)', { url: `${AMAZON}B07TESTAAA`, seiten_kennung: 'B07TESTBBB', staffel: 2 }, `${AMAZON}B07TESTBBB`],
  ['Kennung gleich der Adresse bleibt', { url: S4, seiten_kennung: 'B0CBKJKYM4', staffel: 1 }, S4],
  ['Suchadresse wird zur gelesenen Seite', { url: 'https://www.amazon.de/s?k=Higurashi', seiten_kennung: 'B09JTSD79F', staffel: 1 }, `${AMAZON}B09JTSD79F`],
  ['Suchadresse ohne Kennung bleibt', { url: 'https://www.amazon.de/s?k=Higurashi', seiten_kennung: null, staffel: 1 }, 'https://www.amazon.de/s?k=Higurashi'],
  ['keine Kennung, Adresse bleibt', { url: S4, seiten_kennung: null, staffel: 1 }, S4],
  ['unlesbare Kennung, Adresse bleibt', { url: S4, seiten_kennung: 'b09jtsd79f', staffel: 1 }, S4],
  ['Adresse in /dp/-Form mit gleicher Kennung bleibt', { url: 'https://www.amazon.de/dp/B09JTSD79F', seiten_kennung: 'B09JTSD79F', staffel: 1 }, 'https://www.amazon.de/dp/B09JTSD79F'],
  ['Adresse mit langer Kennung, gleiche Kennung bleibt', { url: `${AMAZON}0Q6QUJIEW346VMM87OG648DPND`, seiten_kennung: '0Q6QUJIEW346VMM87OG648DPND', staffel: 1 }, `${AMAZON}0Q6QUJIEW346VMM87OG648DPND`],
  ['26 Zeichen (GTI-Kennung) gelten', { url: S4, seiten_kennung: '0Q6QUJIEW346VMM87OG648DPND', staffel: 1 }, `${AMAZON}0Q6QUJIEW346VMM87OG648DPND`],
  ['27 Zeichen gelten nicht', { url: S4, seiten_kennung: '0Q6QUJIEW346VMM87OG648DPNDX', staffel: 1 }, S4],
  ['9 Zeichen gelten nicht', { url: S4, seiten_kennung: 'B09JTSD79', staffel: 1 }, S4],
  ['kein Amazon, Adresse bleibt', { url: 'https://www.netflix.com/title/81152346', seiten_kennung: 'B09JTSD79F', staffel: 1 }, 'https://www.netflix.com/title/81152346'],
]
const fehler = faelle.flatMap(([name, p, soll]) => {
  const ist = wegAusMeldung(p)
  return ist === soll ? [] : [`${name}: ${ist} statt ${soll}`]
})
if (fehler.length) {
  console.error(`check-weg-aus-meldung: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log(`check-weg-aus-meldung: ${faelle.length} Fälle — Adresse folgt der gelesenen Seite, Staffel egal; Golden Kamuy, gleiche Kennung, Suche, kein Amazon unverändert.`)
