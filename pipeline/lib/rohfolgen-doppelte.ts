/** Rohfolgen, wie der Worker sie ausliefert — nur die Felder, die das Entdoppeln braucht. */
interface MitKennung {
  id: number
  url: string
  nummer: number | null
  titel: string | null
  erschienen: string | null
  sprachen: string | null
  gemeldet_am: string
}

/**
 * Die doppelten Rohfolgen eines Altbestands: behalten wird je Inhalt die jüngste Zeile, die übrigen sind `veraltet` (Kennungen).
 * Herausgelöst aus `fetch-rohfolgen.ts` (Umbau, Verhalten unverändert).
 */
export function ohneDoppelte<T extends MitKennung>(folgen: T[]): { folgen: T[]; veraltet: number[] } {
  /*
    **Dubletten aus dem Altbestand wegräumen.**

    Bis zum 28.08.2026 hängte jede erneute Meldung derselben Adresse ihre Folgen
    an, statt die offenen zu ersetzen — der Worker macht es seitdem richtig, aber
    was davor entstand, liegt noch da: **3.569 Zeilen allein unter „Captain
    Tsubasa"**, einer Seite mit 91 Folgen, weil Daniel an dem Titel oft gemeldet
    hat. Sie machen zwei Drittel des Briefkastens aus und blockieren jeden Lauf.

    Behalten wird je Adresse und Folgennummer die **jüngste** Zeile; die
    überzähligen werden abgehakt. Das ist kein Datenverlust: Es sind wörtliche
    Wiederholungen derselben Meldung.
  */
  const jungste = new Map<string, T>()
  const veraltet: number[] = []
  for (const f of folgen) {
    /*
      **Der Schlüssel ist der Inhalt, nicht nur die Nummer.**

      Prime führt in einer Liste die deutsche Zählung neben der japanischen
      Gesamtzählung (Detektiv Conan: 149–151 neben 1146–1148, siehe CLAUDE.md).
      Zwei verschiedene Folgen mit derselben Nummer sind damit möglich, und ein
      Schlüssel aus Adresse und Nummer allein würde eine davon wegwerfen.

      Gemessen am Altbestand vom 29.08.2026: 5.633 Zeilen, 1.169 Gruppen, und in
      **keiner einzigen** unterscheidet sich der Inhalt. Die Verschärfung kostet
      also nichts und schließt den Fall trotzdem aus, bevor er eintritt.
    */
    const k = `${f.url}|${f.nummer ?? ""}|${f.titel ?? ""}|${f.erschienen ?? ""}|${f.sprachen ?? ""}`
    const da = jungste.get(k)
    if (!da) {
      jungste.set(k, f)
      continue
    }
    /* Die spätere Meldung gewinnt; bei gleichem Zeitpunkt die höhere Kennung. */
    const neuer = f.gemeldet_am > da.gemeldet_am || (f.gemeldet_am === da.gemeldet_am && f.id > da.id)
    if (neuer) {
      veraltet.push(da.id)
      jungste.set(k, f)
    } else {
      veraltet.push(f.id)
    }
  }
  return { folgen: veraltet.length ? [...jungste.values()] : folgen, veraltet }
}
