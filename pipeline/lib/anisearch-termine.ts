/**
 * Deutsche Erstveröffentlichungen aus aniSearch — für die Titel, zu denen wir
 * selbst keinen Termin haben.
 *
 * **Der Anlass ist eine Lücke, keine Idee.** Gemessen am 03.09.2026: 2.202
 * Titel im Bestand haben eine belegte deutsche Synchro und keinen einzigen
 * Termin. Für 2.012 davon nennt aniSearch eine deutsche Veröffentlichung mit
 * Datum und Publisher — „Cowboy Bebop, 08.01.2003 – 02.04.2003, Dybex /
 * Nipponart". Das steht seit Wochen im Haus und wurde von nichts ausgewertet.
 *
 * Für den Besucher ist der Unterschied nicht klein: Der Kasten oben im
 * Detail-Panel sagt heute „Noch keine deutsche Fassung"-Nachbarschaft, obwohl
 * der Titel seit zwanzig Jahren auf Deutsch zu haben ist.
 *
 * ## Was diese Daten sind — und was nicht
 *
 * Sie sind **Erstveröffentlichungen**, keine Sendepläne. „Cowboy Bebop 2003"
 * ist das Datum der DVD, nicht einer Ausstrahlung. Und bei einem Simuldub nennt
 * aniSearch den **Simulcast**-Start statt des Synchro-Starts: Bei „Die
 * Tagebücher der Apothekerin" Staffel 1 steht dort der 21.10.2023, gemessen
 * haben wir den 18.11.2023. Vier Wochen daneben, und aniSearch merkt es nicht.
 *
 * Daraus folgen drei Regeln, und alle drei stehen als Code — hier und an der
 * Übernahmestelle in `build.ts`:
 *
 * 1. **Nur wo wir selbst nichts haben.** Ein eigener Termin schlägt aniSearch
 *    immer — er ist gemessen, dieser ist übernommen.
 * 2. **Es ist kein Termin, sondern eine Stammdatenangabe.** Sie landet als
 *    `deErstausgabe` am Titel, nicht als Release im Kalender: Der erste Anlauf
 *    baute 1.985 Kalendereinträge und blies `titles-core.json` von 554 KB auf
 *    2,7 MB auf — die Datei, die jeder Besucher beim Erstaufruf lädt.
 * 3. **Sie erzeugt nie einen Synchro-Beleg.** Welche Titel eine deutsche
 *    Fassung haben, entscheidet weiterhin unser eigener Bestand; diese Angabe
 *    sagt nur, seit wann es sie gibt, und nennt die Quelle dazu.
 *
 * ## Der Publisher bleibt Klartext
 *
 * aniSearch nennt einen Verlag, keinen Anbieter — und die 141 Namen reichen von
 * „Crunchyroll" über „Kazé Deutschland" bis „The Walt Disney Company" (bei
 * einem Ghibli-Film der Neunziger, also ein Kinoverleih, kein Disney+). Aus
 * einem Verlagsnamen eine Plattform zu raten hieße, eine Pille zu bauen, die
 * ins Leere führt. Der Name steht deshalb so da, wie er dasteht.
 */
/** Was aniSearch je Sprache über eine Veröffentlichung sagt. */
interface Sprachblock {
  language?: string
  dubbed?: boolean
  released?: string
  publisher?: string[]
}

export interface AnisearchTermin {
  /** ISO-Datum des ersten Tages. */
  start: string
  /** ISO-Datum des letzten Tages, falls aniSearch einen Bereich nennt. */
  ende?: string
  /** Der Verlag oder Dienst, der sie herausgebracht hat — als Klartext. */
  publisher?: string
  /** Was im Datensatz stand — damit ein Mensch nachlesen kann, woher das Datum kommt. */
  zitat: string
}

/**
 * Deutsches Datum in ISO-Form.
 *
 * aniSearch schreibt `TT.MM.JJJJ`. Alles Kürzere — „1995", „11.1996" — bleibt
 * draußen: Ein Jahr ist kein Termin, und ein erfundener 1. Januar wäre schlimmer
 * als keine Angabe.
 */
function alsIso(roh: string): string | undefined {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(roh.trim())
  if (!m) return undefined
  const [, tag, monat, jahr] = m
  const datum = `${jahr}-${monat}-${tag}`
  /* Ein 31.02. käme durch die Form und nicht durch den Kalender. */
  const probe = new Date(`${datum}T12:00:00Z`)
  if (Number.isNaN(probe.getTime()) || probe.getUTCDate() !== Number(tag)) return undefined
  return datum
}

/**
 * Liest den deutschen Block eines aniSearch-Eintrags.
 *
 * Gibt `undefined` zurück, wo nichts Verwertbares steht — kein Datum, nur ein
 * Jahr, oder gar kein deutscher Block. Das ist der Normalfall bei rund einem
 * Viertel der Einträge und kein Fehler.
 */
export function terminAusEintrag(info: { languages?: Sprachblock[] } | undefined): AnisearchTermin | undefined {
  const de = (info?.languages ?? []).find((l) => l.language === 'Deutsch')
  if (!de?.released) return undefined
  const roh = de.released.trim()
  const [vonRoh, bisRoh] = roh.split(/\s*-\s*/)
  const start = alsIso(vonRoh ?? '')
  if (!start) return undefined
  const ende = bisRoh ? alsIso(bisRoh) : undefined
  return {
    start,
    ...(ende && ende > start ? { ende } : {}),
    ...(de.publisher?.length ? { publisher: de.publisher[0] } : {}),
    zitat: roh,
  }
}
