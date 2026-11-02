import { amazonTitelAdresse } from './amazon-adresse.ts'

/**
 * **Eine Suchadresse ist kein Weg — die gelesene Seite schon.**
 *
 * Ein Suchauftrag wird auf der Titelseite gemeldet, die Meldung läuft aber unter
 * der Adresse aus dem Bestand: der Suchadresse. Kennt der Bau keinen besseren
 * Weg, schreibt er genau die als `url` in `dub-confirmed.yaml` — und damit landet
 * sie im Kalender.
 *
 * Fünf solche Wege stehen dort (Stand 02.09.2026), etwa bei „Shakugan no Shana:
 * Season III". Wer auf „Wo läuft es" klickt, landet in einer Amazon-Suche statt
 * beim Titel; das beantwortet die Frage nicht, die dieses Projekt stellt.
 *
 * Die Angabe fehlt nicht — sie wurde nur nicht gelesen: Jede Meldung trägt
 * `seiten_kennung`, die Kennung der Seite, auf der wirklich nachgesehen wurde.
 * Daraus wird der Weg gebaut, wo die Meldung selbst nur eine Suche nennt.
 *
 * Bei allem anderen bleibt die gemeldete Adresse stehen: Sie ist die aus unserem
 * Bestand, und die Pipeline sucht nach ihr.
 */
export function wegAusMeldung(p: { url: string; seiten_kennung?: string | null; staffel?: number | null }): string {
  const kennung = String(p.seiten_kennung ?? '').trim()
  /*
    **Eine Staffel ab 2 bekommt die Adresse ihrer eigenen Seite** (17.09.2026,
    Golden Kamuy): Der Staffelwechsel läuft auf der Seite von Staffel 1, die
    Meldung trägt deren Adresse. Stünde sie im Beleg, zeigte der Weg der
    zweiten Staffel auf die erste.
  */
  if (
    /amazon\.de/.test(p.url) &&
    Number(p.staffel) >= 2 &&
    /^[A-Z0-9]{10,26}$/.test(kennung) &&
    !p.url.includes(kennung)
  ) {
    return amazonTitelAdresse(kennung)
  }
  if (!p.url.includes('/s?k=')) return p.url
  if (!/^[A-Z0-9]{8,}$/i.test(kennung)) return p.url
  return `https://www.amazon.de/gp/video/detail/${kennung}`
}
