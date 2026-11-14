import { adressGleich, adressKern, dubKey, type DubCheck } from '../lib/dub-confirmed.ts'
import { kanalAusNotiz } from '../lib/amazon-adresse.ts'
import { vergleicheBelege } from '../lib/staerkste-seite.ts'
import { type PlatformId, type StreamLink, type Title } from '../../shared/types.ts'
import { log } from '../lib/util.ts'
import { belegOhneGenaueAdresse } from '../lib/kanal-titel.ts'
import { kanalWissen } from '../lib/kanal-wissen.ts'

export function belegFuerAus({ checksJePlattform, alleChecks }: {
  checksJePlattform: Map<string, DubCheck[]>
  alleChecks: DubCheck[]
}) {
  const belegFuer = (
    titleId: number,
    plattform: PlatformId,
    url?: string,
    /** Wie viele Verweise dieser Plattform der Titel hat — entscheidet über die Strenge. */
    anzahlWege = 1,
  ): DubCheck | undefined => {
    const alle = checksJePlattform.get(dubKey(titleId, plattform))
    if (!alle?.length) return undefined
    /*
      **Ein Beleg ohne Sprachurteil ist kein Sprachbeleg.**

      In `dub-confirmed.yaml` stehen zwei Arten von Einträgen: Sprachurteile
      (`dub: true|false`) und **Adressbelege** — Zeilen, die nur festhalten, wo
      ein Verweis herkommt („Verweis aus Netflix' eigener Staffelliste
      erschlossen"). Die zweite Art trägt eine `url` und kein `dub`.

      Seit die Belege je Ausgabe getrennt geführt werden (07.09.2026), standen
      beide Arten nebeneinander in derselben Liste — und weil der Adressbeleg
      die passende `url` trug, gewann er nach Regel 1 gegen das Urteil, das
      keine hatte. Fünf Staffeln „My Hero Academia" waren auf Netflix als „ohne
      deutsche Tonspur" geprüft und standen trotzdem im Datensatz;
      `check:handbelege` hat es gemeldet und den Datenlauf rot gemacht.

      Für die Auswahl zählen deshalb nur Einträge mit einer **Aussage über den
      Verweis** — `dub` (gibt es dort deutschen Ton?) oder `available` (gibt es
      dort überhaupt ein Angebot?). Was ein Adressbeleg beiträgt, die richtige
      Adresse, wird an anderer Stelle gelesen.

      **`available` gehört ausdrücklich dazu.** Ein erster Anlauf filterte nur
      auf `dub` und warf damit 262 „nicht verfügbar"-Belege weg — aus sechs
      Meldungen in `check:handbelege` wurden 268. Die beiden Felder sind
      verschiedene Aussagen (siehe `DubCheck.available`), aber beide sind
      Aussagen; nur der Adressbeleg ist keine.
    */
    /*
      **Und innerhalb jeder Stufe gewinnt der jüngste Beleg.**

      `loadDubChecks()` ließ den jüngeren gewinnen, solange es je Schlüssel nur
      einen Eintrag gab. Seit der Trennung je Ausgabe liegen mehrere
      nebeneinander, und `find()` nahm schlicht den ersten der Datei — bei 26
      Verweisen war das ein Beleg, den ein jüngerer längst überholt hatte
      (gemessen 07.09.2026, `check:handbelege` meldet solche Fälle namentlich).

      Ein Sortiervorgang je Aufruf wäre Verschwendung: Die Reihenfolge ist für
      alle Aufrufe dieselbe, also wird sie einmal beim Aufbau der Karte gesetzt.
    */
    const liste = alle
    if (!liste.length) return undefined
    if (url) {
      const genau = liste.find((c) => c.url && adressGleich(c.url, url))
      if (genau) return genau
    }
    const ohneAdresse = liste.find((c) => !c.url)
    if (ohneAdresse) return ohneAdresse
    /*
      **Bei einem einzigen Weg ist die Adresse im Beleg eine Korrektur, keine
      Unterscheidung.**

      Genau dafür ist das Feld da (siehe `DubCheck.url`): „Die richtige
      Adresse, falls die im Datensatz danebenliegt." Wer hier streng vergleicht,
      wirft 60 Belege weg, die den Verweis gerade richtigstellen sollen.

      **Erst ab zwei Wegen wird die Adresse zur Unterscheidung** — dann gibt es
      zwei Ausgaben, und ein Beleg für die eine sagt nichts über die andere. Das
      ist der Date-a-Live-Fall vom 07.09.2026.
    */
    return belegOhneGenaueAdresse(liste, anzahlWege, kanalWissen(alleChecks), titleId, url)
  }
  return { belegFuer }
}

export function ergaenzeZweiteAusgaben({ checksJePlattform, titles }: {
  checksJePlattform: Map<string, DubCheck[]>
  titles: Map<number, Title>
}) {
  /**
   * **Eine zweite Ausgabe mit Deutsch wird ein eigener Verweis.**
   *
   * Digimon stand mit genau einer Prime-Adresse im Bestand, der
   * Crunchyroll-Kanal-Ausgabe `B0CHHNJJW3` — ohne deutschen Ton. Die Ausgabe
   * „In Prime enthalten" (`B0CGRJGJX1`) hat ihn, und ihr Beleg trägt die
   * Adresse. `belegFuer()` nimmt bei einem einzigen Weg aber zuerst den Beleg mit
   * **derselben** Adresse; das Nein zur Kanal-Seite gewann, der Verweis flog
   * heraus, und das Ja zur anderen Seite fand keinen Weg, an dem es hängen
   * konnte.
   *
   * Angelegt wird nur, wenn **jeder** vorhandene Weg dieser Plattform belegt
   * ohne Deutsch ist. Sonst ist die Adresse im Beleg eine Korrektur (siehe
   * `belegFuer()`), und ein zusätzlicher Verweis wäre eine Dublette. Nur für
   * Amazon-Titelseiten: Dort sind Ausgaben mit eigener Kennung die Regel.
   */
  let ausgabeErgaenzt = 0
  for (const [schluessel, liste] of checksJePlattform) {
    const [idRoh, plattform] = schluessel.split('|')
    const title = titles.get(Number(idRoh))
    if (!title) continue
    const wege = title.streams.filter((s) => s.platform === plattform)
    if (!wege.length) continue
    /* Je Adresse zählt der jüngste Beleg — die Liste ist oben schon sortiert. */
    const neuestes = new Map<string, DubCheck>()
    for (const c of liste) if (c.url && !neuestes.has(adressKern(c.url))) neuestes.set(adressKern(c.url), c)
    if (!wege.every((s) => neuestes.get(adressKern(s.url))?.dub === false)) continue
    for (const c of neuestes.values()) {
      if (c.dub !== true || !/amazon\.de\/(?:dp|gp\/video\/detail)\//.test(c.url ?? '')) continue
      if (title.streams.some((s) => adressGleich(s.url, c.url))) continue
      title.streams.push({ platform: plattform as PlatformId, url: c.url! } as StreamLink)
      ausgabeErgaenzt++
    }
  }
  if (ausgabeErgaenzt) log(`${ausgabeErgaenzt} Verweise auf eine zweite Ausgabe mit deutschem Ton angelegt`)
}

export function checksNachPlattform({ alleChecks }: {
  alleChecks: DubCheck[]
}) {
  const checksJePlattform = new Map<string, DubCheck[]>()
  for (const c of alleChecks) {
    /*
      **Adressbelege bleiben draußen — sie tragen keine Aussage über den Verweis.**

      `dub-confirmed.yaml` führt neben den Urteilen auch Zeilen, die nur die
      Herkunft einer Adresse festhalten („Verweis aus Netflix' eigener
      Staffelliste erschlossen"): mit `url`, ohne `dub` und ohne `available`.
      Solange `loadDubChecks()` beide verschmolz, fiel das nicht auf; seit der
      Trennung je Ausgabe (07.09.2026) gewann der Adressbeleg gegen das Urteil,
      weil er die passende Adresse trug — fünf Staffeln „My Hero Academia"
      standen so trotz belegtem Nein im Datensatz.

      **`available` gehört dazu, `dub` allein genügt nicht.** Ein erster Anlauf
      filterte nur auf `dub` und warf 262 „nicht verfügbar"-Belege weg; aus
      sechs Meldungen in `check:handbelege` wurden 268. Beide Felder sind
      verschiedene Aussagen (siehe `DubCheck.available`), aber beide sind
      Aussagen.
    */
    if (typeof c.dub !== 'boolean' && typeof c.available !== 'boolean') continue
    const k = dubKey(c.anilistId, c.platform)
    const liste = checksJePlattform.get(k) ?? []
    liste.push(c)
    checksJePlattform.set(k, liste)
  }
  /*
    **Der jüngste Beleg steht vorn — einmal sortiert, nicht bei jedem Aufruf.**

    `belegFuer()` greift in jeder Stufe den ersten passenden Eintrag. Ohne
    Sortierung ist das der erste der Datei, und bei 26 Verweisen war das ein
    Beleg, den ein jüngerer längst überholt hatte (07.09.2026). Die Reihenfolge
    ist für alle Aufrufe dieselbe, also wird sie einmal hier festgelegt.
  */
  for (const liste of checksJePlattform.values()) {
    liste.sort(vergleicheBelege)
  }
  return { checksJePlattform }
}

export function kanalUndZugangJeAdresse({ alleChecks }: {
  alleChecks: DubCheck[]
}) {
  /*
    **Der Zusatzkanal hängt an der Adresse, nicht am Sprachurteil** (21.09.2026). Gelesen
    wird er aus dem jüngsten Beleg der Adresse, der Abos nennt — auch aus einem ohne
    Urteil. Genau die Kanal-Pillen ohne Urteil (ein Kanal-Nein wird bewusst nicht
    übernommen) brauchen den Hinweis am meisten; Golden Wind stand nach dem ersten
    Anlauf als nacktes „Prime Video" da, obwohl die Meldung „Abos: crunchyrollde" trug.
  */
  const kanalJeAdresse = new Map<string, string | undefined>()
  /*
    **Und die Zugangsart, die die Erweiterung auf genau dieser Seite gemessen hat** (21.09.2026).
    Sie stand in jeder Meldung („zugang=kauf") und wurde nie gelesen; die Pille nahm JustWatchs
    Angabe je Titel oder die Vorgabe „Prime = Abo". Gemessen über 700 Prime-Seiten mit Angabe:
    111 zeigten die falsche Zugangsart — 46 als Kauf, obwohl im Abo, 65 als Abo, obwohl nur zu
    kaufen oder zu leihen. Lupin III. Part 6 stand als Abo da, Daniels Bild zeigte „Als
    Kauftitel verfügbar". JustWatch spricht über den Titel, die Meldung über die Ausgabe.
  */
  const zugangJeAdresse = new Map<string, 'abo' | 'kauf'>()
  for (const c of [...alleChecks].sort((a, b) => (b.checkedAt ?? '').localeCompare(a.checkedAt ?? ''))) {
    if (c.platform !== 'primevideo' || !c.url) continue
    const k = adressKern(c.url)
    if (/Abos: /.test(c.note ?? '') && !kanalJeAdresse.has(k)) kanalJeAdresse.set(k, kanalAusNotiz(c.note))
    const z = /zugang=([a-z_]+)/.exec(c.note ?? '')?.[1]
    if (z && !zugangJeAdresse.has(k)) {
      if (z === 'abo' || z === 'abo_und_kauf') zugangJeAdresse.set(k, 'abo')
      else if (z === 'kauf' || z === 'kauf_oder_leihe') zugangJeAdresse.set(k, 'kauf')
    }
  }
  return { zugangJeAdresse, kanalJeAdresse }
}
